const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── CDN Detection ─────────────────────────────────────────────────────────────
const IMGIX_PATTERNS = [
  /imgix\.net/i,
  /\.imgix\./i,
  /ix\.imgix/i,
  /imgix\.com/i,
];
const CLOUDINARY_PATTERNS = [
  /cloudinary\.com/i,
  /res\.cloudinary/i,
  /images\.cloudinary/i,
  /cloudinary\.net/i,
];

function detectInUrl(url) {
  if (IMGIX_PATTERNS.some(p => p.test(url)))      return 'imgix';
  if (CLOUDINARY_PATTERNS.some(p => p.test(url))) return 'cloudinary';
  return null;
}

function detectInHeaders(headers = {}) {
  const relevant = [
    headers['server'],
    headers['x-served-by'],
    headers['x-server'],
    headers['via'],
    headers['x-cache'],
    headers['x-cdn'],
  ].filter(Boolean).join(' ').toLowerCase();

  if (IMGIX_PATTERNS.some(p => p.test(relevant)))      return 'imgix';
  if (CLOUDINARY_PATTERNS.some(p => p.test(relevant))) return 'cloudinary';
  return null;
}

function normaliseUrl(raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { new URL(raw); return raw; } catch { return null; }
}

// Exact image content types shown in DevTools Network → Img tab
const IMAGE_CONTENT_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/avif', 'image/svg+xml', 'image/bmp',
  'image/tiff', 'image/ico', 'image/x-icon',
];

function isImageContentType(contentType = '') {
  return IMAGE_CONTENT_TYPES.some(t => contentType.toLowerCase().includes(t));
}

// ── Main crawl ────────────────────────────────────────────────────────────────
async function crawl(rawUrl) {
  const url = normaliseUrl(rawUrl);
  if (!url) return { cdn: 'Not available', confidence: 'Low', detail: 'Invalid URL', imageRequests: [] };

  let browser;
  const imageRequests = []; // every image request — like DevTools Network → Img tab

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await browser.newPage();

    // Spoof as real Chrome browser
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Hide automation flags
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3] });
      window.chrome = { runtime: {} };
    });

    // ── Intercept all network requests ────────────────────────────────────────
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      req.continue(); // let everything through — we only observe
    });

    // ── Listen to responses — this is the "Img" tab in DevTools Network ───────
    // Every image the browser loads fires this event with full headers
    page.on('response', async (response) => {
      try {
        const resUrl     = response.url();
        const status     = response.status();
        const headers    = response.headers();
        const contentType = headers['content-type'] || '';
        const resourceType = response.request().resourceType();

        // Only process actual image responses — exactly like DevTools Img filter
        const isImg = resourceType === 'image' || isImageContentType(contentType);
        if (!isImg) return;
        if (status < 200 || status >= 400) return;

        // Check the image URL for CDN patterns
        const cdnFromUrl    = detectInUrl(resUrl);
        // Check the response headers for CDN patterns
        const cdnFromHeader = detectInHeaders(headers);
        const cdn           = cdnFromHeader || cdnFromUrl; // header match wins

        imageRequests.push({
          url:         resUrl,
          contentType,
          status,
          headers: {
            server:         headers['server']        || null,
            'x-served-by':  headers['x-served-by']  || null,
            via:            headers['via']           || null,
            'x-cache':      headers['x-cache']       || null,
            'content-type': contentType,
          },
          cdnDetected: cdn,
          detectedVia: cdnFromHeader ? 'header' : cdnFromUrl ? 'url' : null,
        });

      } catch { /* ignore parse errors */ }
    });

    // ── Open the website ──────────────────────────────────────────────────────
    try {
      // networkidle2 = wait until no more than 2 network connections for 500ms
      // This ensures all images have fully loaded — same as watching Network tab go quiet
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 20000 });
        await new Promise(r => setTimeout(r, 3000));
      } catch {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(r => setTimeout(r, 4000));
        } catch (e) {
          await browser.close().catch(() => {});
          return { cdn: 'Not available', confidence: 'Low', detail: `Could not open: ${e.message}`, imageRequests: [] };
        }
      }
    }

    // ── Scroll to trigger lazy-loaded images ──────────────────────────────────
    // Sites like Shopify, Next.js load images as you scroll — this triggers them
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let total = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, 300);
          total += 300;
          if (total >= Math.min(document.body.scrollHeight, 4000)) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait for lazy images to load after scroll
    await new Promise(r => setTimeout(r, 2500));

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { cdn: 'Not available', confidence: 'Low', detail: `Browser error: ${err.message}`, imageRequests: [] };
  }

  await browser.close().catch(() => {});

  // ── Score all captured image requests ─────────────────────────────────────
  const totalImages   = imageRequests.length;
  const imgixReqs     = imageRequests.filter(r => r.cdnDetected === 'imgix');
  const cloudReqs     = imageRequests.filter(r => r.cdnDetected === 'cloudinary');
  const imgixCount    = imgixReqs.length;
  const cloudCount    = cloudReqs.length;

  // Weight header detections 3x more than URL pattern matches
  const imgixScore = imgixReqs.reduce((s, r) => s + (r.detectedVia === 'header' ? 3 : 1), 0);
  const cloudScore = cloudReqs.reduce((s, r) => s + (r.detectedVia === 'header' ? 3 : 1), 0);
  const total      = imgixScore + cloudScore;

  if (total === 0) {
    return {
      cdn: 'Not available',
      confidence: 'Low',
      detail: `${totalImages} image requests captured — no Imgix or Cloudinary found`,
      imageRequests: imageRequests.slice(0, 10),
    };
  }

  let cdn, confidence;

  if (imgixScore > 0 && cloudScore > 0) {
    cdn        = 'Imgix, Cloudinary';
    confidence = 'Medium';
  } else if (imgixScore >= cloudScore) {
    cdn        = 'Imgix';
    confidence = imgixReqs.some(r => r.detectedVia === 'header') ? 'High'
               : imgixCount >= 3 ? 'High'
               : imgixCount >= 2 ? 'Medium' : 'Low';
  } else {
    cdn        = 'Cloudinary';
    confidence = cloudReqs.some(r => r.detectedVia === 'header') ? 'High'
               : cloudCount >= 3 ? 'High'
               : cloudCount >= 2 ? 'Medium' : 'Low';
  }

  const sample = [...imgixReqs, ...cloudReqs][0];
  const detail = `${totalImages} images captured — Imgix: ${imgixCount}, Cloudinary: ${cloudCount}${sample ? ' | ' + sample.url.slice(0, 70) + '…' : ''}`;

  return {
    cdn,
    confidence,
    detail,
    imageRequests: imageRequests.slice(0, 15),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.options('/crawl', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.post('/crawl', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  console.log(`[CDN] Opening: ${url}`);
  try {
    const result = await crawl(url);
    console.log(`[CDN] ${url} → ${result.cdn} (${result.confidence}) | ${result.detail}`);
    res.json(result);
  } catch (err) {
    console.error(`[CDN] Error for ${url}:`, err.message);
    res.json({ cdn: 'Not available', confidence: 'Low', detail: err.message, imageRequests: [] });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CDN Detector (Puppeteer headless) on port ${PORT}`));
