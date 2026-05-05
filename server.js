const express = require('express');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
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

const IMAGE_CONTENT_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/avif', 'image/svg+xml', 'image/bmp',
  'image/tiff', 'image/ico', 'image/x-icon',
];

function isImageContentType(ct = '') {
  return IMAGE_CONTENT_TYPES.some(t => ct.toLowerCase().includes(t));
}

// ── Main crawl ────────────────────────────────────────────────────────────────
async function crawl(rawUrl) {
  const url = normaliseUrl(rawUrl);
  if (!url) return { cdn: 'Not available', confidence: 'Low', detail: 'Invalid URL', matchedUrl: null };

  let browser;

  // ── Shared result — written as soon as first CDN image is found ──
  let foundResult = null;  // set this to stop scanning immediately
  let imageCount  = 0;     // total image requests seen

  try {
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Spoof as real Chrome
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3] });
      window.chrome = { runtime: {} };
    });

    await page.setRequestInterception(true);

    // ── Request handler ───────────────────────────────────────────────────────
    page.on('request', (req) => {
      // ── EARLY EXIT: if we already found a CDN, abort remaining image requests
      // This is the key optimisation — stop loading images once CDN is identified
      if (foundResult && req.resourceType() === 'image') {
        req.abort();
        return;
      }
      req.continue();
    });

    // ── Response handler — DevTools "Img" tab equivalent ─────────────────────
    page.on('response', async (response) => {
      // Already found — skip processing
      if (foundResult) return;

      try {
        const resUrl      = response.url();
        const status      = response.status();
        const headers     = response.headers();
        const contentType = headers['content-type'] || '';
        const resourceType = response.request().resourceType();

        // Only look at image responses — exactly like DevTools Network → Img filter
        const isImg = resourceType === 'image' || isImageContentType(contentType);
        if (!isImg || status < 200 || status >= 400) return;

        imageCount++;

        // ── Check URL first (fastest) ──
        const cdnFromUrl = detectInUrl(resUrl);

        // ── Check response headers ──
        const cdnFromHeader = detectInHeaders(headers);

        const cdn = cdnFromHeader || cdnFromUrl;

        if (cdn) {
          // ✅ Found it — record result and stop scanning
          const detectedVia = cdnFromHeader ? 'response header' : 'image URL';
          foundResult = {
            cdn:        cdn === 'imgix' ? 'Imgix' : 'Cloudinary',
            confidence: cdnFromHeader ? 'High' : 'High', // first confirmed signal = High
            detail:     `Found on image #${imageCount} via ${detectedVia}: ${resUrl.slice(0, 80)}`,
            matchedUrl: resUrl,
          };

          console.log(`[CDN] ✅ Found ${foundResult.cdn} on image #${imageCount} — stopping scan`);

          // Stop the page navigation — no need to load more
          page.evaluate(() => window.stop()).catch(() => {});
        }

      } catch { /* ignore */ }
    });

    // ── Navigate ──────────────────────────────────────────────────────────────
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      // If we already found the CDN during navigation, that's fine
      if (!foundResult) {
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 20000 });
          await new Promise(r => setTimeout(r, 2000));
        } catch {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await new Promise(r => setTimeout(r, 3000));
          } catch (e) {
            await browser.close().catch(() => {});
            return { cdn: 'Not available', confidence: 'Low', detail: `Could not open: ${e.message}`, matchedUrl: null };
          }
        }
      }
    }

    // ── If not found yet, scroll to trigger lazy images ───────────────────────
    // Only scroll if we haven't found CDN yet
    if (!foundResult) {
      try {
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
        // Wait briefly for lazy images to fire
        await new Promise(r => setTimeout(r, 2000));
      } catch { /* page may have been stopped */ }
    }

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { cdn: 'Not available', confidence: 'Low', detail: `Browser error: ${err.message}`, matchedUrl: null };
  }

  await browser.close().catch(() => {});

  // ── Return result ─────────────────────────────────────────────────────────
  if (foundResult) {
    return foundResult;
  }

  return {
    cdn:        'Not available',
    confidence: 'Low',
    detail:     `${imageCount} image requests scanned — no Imgix or Cloudinary signals found`,
    matchedUrl: null,
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
    console.error(`[CDN] Error:`, err.message);
    res.json({ cdn: 'Not available', confidence: 'Low', detail: err.message, matchedUrl: null });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CDN Detector running on port ${PORT}`));
