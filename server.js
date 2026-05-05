const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── CDN Detection patterns ────────────────────────────────────────────────────
const IMGIX_PATTERNS = [
  /imgix\.net/i, /\.imgix\./i, /ix\.imgix/i, /imgix\.com/i,
];
const CLOUDINARY_PATTERNS = [
  /cloudinary\.com/i, /res\.cloudinary/i, /images\.cloudinary/i, /cloudinary\.net/i,
];

function detectInUrl(url) {
  if (IMGIX_PATTERNS.some(p => p.test(url)))      return 'imgix';
  if (CLOUDINARY_PATTERNS.some(p => p.test(url))) return 'cloudinary';
  return null;
}

function detectInHeaders(headers = {}) {
  const str = [
    headers['server'], headers['x-served-by'], headers['x-server'],
    headers['via'], headers['x-cache'], headers['x-cdn'],
  ].filter(Boolean).join(' ').toLowerCase();
  if (IMGIX_PATTERNS.some(p => p.test(str)))      return 'imgix';
  if (CLOUDINARY_PATTERNS.some(p => p.test(str))) return 'cloudinary';
  return null;
}

function normaliseUrl(raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { new URL(raw); return raw; } catch { return null; }
}

const IMAGE_TYPES = [
  'image/jpeg','image/jpg','image/png','image/gif','image/webp',
  'image/avif','image/svg+xml','image/bmp','image/tiff','image/x-icon',
];
function isImageCT(ct = '') { return IMAGE_TYPES.some(t => ct.toLowerCase().includes(t)); }

// ── Crawl ─────────────────────────────────────────────────────────────────────
async function crawl(rawUrl) {
  const url = normaliseUrl(rawUrl);
  if (!url) return { cdn: 'Not available', confidence: 'Low', detail: 'Invalid URL' };

  let browser, foundResult = null, imageCount = 0;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',           // important for Railway/Docker
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });

    await page.setRequestInterception(true);

    // ── Intercept requests: abort image requests once CDN is found ────────────
    page.on('request', (req) => {
      if (foundResult && req.resourceType() === 'image') {
        req.abort(); // ← stop loading more images once CDN identified
        return;
      }
      req.continue();
    });

    // ── Intercept responses: check every image — like DevTools Network → Img ──
    page.on('response', async (response) => {
      if (foundResult) return; // already done

      try {
        const resUrl       = response.url();
        const status       = response.status();
        const headers      = response.headers();
        const contentType  = headers['content-type'] || '';
        const resourceType = response.request().resourceType();

        // Only process actual image responses
        const isImg = resourceType === 'image' || isImageCT(contentType);
        if (!isImg || status < 200 || status >= 400) return;

        imageCount++;

        const cdnFromUrl    = detectInUrl(resUrl);
        const cdnFromHeader = detectInHeaders(headers);
        const cdn           = cdnFromHeader || cdnFromUrl;

        if (cdn) {
          const via = cdnFromHeader ? 'response header' : 'image URL';
          foundResult = {
            cdn:        cdn === 'imgix' ? 'Imgix' : 'Cloudinary',
            confidence: 'High',
            detail:     `Image #${imageCount} matched via ${via}: ${resUrl.slice(0, 100)}`,
            matchedUrl: resUrl,
          };
          console.log(`[CDN] ✅ ${foundResult.cdn} found on image #${imageCount} — stopping`);
          page.evaluate(() => window.stop()).catch(() => {});
        }
      } catch { /* ignore */ }
    });

    // ── Open the website ──────────────────────────────────────────────────────
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
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
            return { cdn: 'Not available', confidence: 'Low', detail: `Could not open: ${e.message}` };
          }
        }
      }
    }

    // ── Scroll to trigger lazy images — only if CDN not found yet ─────────────
    if (!foundResult) {
      try {
        await page.evaluate(async () => {
          await new Promise(resolve => {
            let total = 0;
            const t = setInterval(() => {
              window.scrollBy(0, 300);
              total += 300;
              if (total >= Math.min(document.body.scrollHeight, 4000)) { clearInterval(t); resolve(); }
            }, 100);
          });
        });
        await new Promise(r => setTimeout(r, 2000));
      } catch { /* page may have stopped */ }
    }

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { cdn: 'Not available', confidence: 'Low', detail: `Browser error: ${err.message}` };
  }

  await browser.close().catch(() => {});

  return foundResult || {
    cdn:        'Not available',
    confidence: 'Low',
    detail:     `${imageCount} image requests checked — no Imgix or Cloudinary found`,
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
    res.json({ cdn: 'Not available', confidence: 'Low', detail: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CDN Detector on port ${PORT}`));
