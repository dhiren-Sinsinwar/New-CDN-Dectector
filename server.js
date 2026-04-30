const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── CDN Detection patterns ────────────────────────────────────────────────────
const PATTERNS = {
  imgix: [
    /imgix\.net/i,
    /\.imgix\./i,
    /ix\.imgix/i,
    /imgix\.com/i,
  ],
  cloudinary: [
    /cloudinary\.com/i,
    /res\.cloudinary/i,
    /images\.cloudinary/i,
    /cloudinary\.net/i,
  ],
};

const HEADER_KEYWORDS = {
  imgix: ['imgix'],
  cloudinary: ['cloudinary'],
};

function detectCDN(url, headers = {}) {
  // Check URL patterns
  for (const [cdn, patterns] of Object.entries(PATTERNS)) {
    if (patterns.some(p => p.test(url))) return cdn;
  }
  // Check headers
  const headerStr = Object.values(headers).join(' ').toLowerCase();
  for (const [cdn, keywords] of Object.entries(HEADER_KEYWORDS)) {
    if (keywords.some(k => headerStr.includes(k))) return cdn;
  }
  return null;
}

function normaliseUrl(raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { new URL(raw); return raw; } catch { return null; }
}

function scoreSignals(signals) {
  let imgixScore = 0, cloudinaryScore = 0;
  
  for (const s of signals) {
    // Header detections are worth more
    const weight = s.source === 'header' ? 3 : 1;
    if (s.cdn === 'imgix') imgixScore += weight;
    if (s.cdn === 'cloudinary') cloudinaryScore += weight;
  }

  const total = imgixScore + cloudinaryScore;
  if (total === 0) return { cdn: 'Not available', confidence: 'Low' };

  const winner = imgixScore >= cloudinaryScore ? 'imgix' : 'cloudinary';
  const winnerScore = Math.max(imgixScore, cloudinaryScore);
  const cdn = imgixScore > 0 && cloudinaryScore > 0
    ? 'Imgix, Cloudinary'
    : winner === 'imgix' ? 'Imgix' : 'Cloudinary';

  const confidence = winnerScore >= 6 ? 'High' : winnerScore >= 2 ? 'Medium' : 'Low';
  return { cdn, confidence };
}

// ── Main crawl function ───────────────────────────────────────────────────────
async function crawlWithBrowser(rawUrl) {
  const url = normaliseUrl(rawUrl);
  if (!url) return { cdn: 'Not available', confidence: 'Low', detail: 'Invalid URL', signals: [] };

  let browser;
  const signals = [];
  const imageUrls = new Set();

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled', // hide automation flag
      ],
    });

    const page = await browser.newPage();

    // ── Spoof as a real Chrome browser ──
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    });

    // ── Override navigator properties to hide Puppeteer ──
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      window.chrome = { runtime: {} };
    });

    // ── Intercept ALL network requests ──
    // This is the "Network tab" equivalent — catches every request the browser makes
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      const reqUrl = req.url();
      const resourceType = req.resourceType();

      // Check every image/media/fetch request URL for CDN patterns
      if (['image', 'media', 'fetch', 'xhr', 'other'].includes(resourceType)) {
        imageUrls.add(reqUrl);
        const cdn = detectCDN(reqUrl);
        if (cdn) {
          signals.push({ cdn, source: 'url', url: reqUrl, type: resourceType });
        }
      }

      req.continue();
    });

    // ── Intercept responses — check headers ──
    page.on('response', async (res) => {
      const resUrl = res.url();
      const status = res.status();
      if (status < 200 || status >= 400) return;

      try {
        const headers = res.headers();

        // Check response headers for CDN signals
        const headerStr = JSON.stringify(headers).toLowerCase();
        if (headerStr.includes('imgix')) {
          signals.push({ cdn: 'imgix', source: 'header', url: resUrl, header: headers['server'] || headers['x-served-by'] || 'response header' });
        }
        if (headerStr.includes('cloudinary')) {
          signals.push({ cdn: 'cloudinary', source: 'header', url: resUrl, header: headers['server'] || headers['x-served-by'] || 'response header' });
        }

        // Also check image response URLs
        const resourceType = res.request().resourceType();
        if (['image', 'media'].includes(resourceType)) {
          imageUrls.add(resUrl);
          const cdn = detectCDN(resUrl, headers);
          if (cdn && !signals.find(s => s.url === resUrl && s.source === 'url')) {
            signals.push({ cdn, source: 'response-url', url: resUrl });
          }
        }
      } catch { /* ignore */ }
    });

    // ── Navigate to the page ──
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2', // wait until network is quiet (all images loaded)
        timeout: 30000,
      });
    } catch {
      // Try with less strict wait condition
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 3000)); // wait 3s for lazy images
      } catch (e2) {
        // Try http fallback
        const httpUrl = url.replace(/^https:/i, 'http:');
        await page.goto(httpUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // ── Scroll down to trigger lazy-loaded images ──
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= Math.min(document.body.scrollHeight, 3000)) {
            clearInterval(timer);
            resolve();
          }
        }, 150);
      });
    });

    // Wait a bit more for any lazy images triggered by scroll
    await new Promise(r => setTimeout(r, 2000));

    // ── Also scan DOM for image src/srcset in case request interception missed any ──
    const domImageUrls = await page.evaluate(() => {
      const urls = new Set();
      document.querySelectorAll('img, source').forEach(el => {
        ['src', 'srcset', 'data-src', 'data-lazy-src', 'data-original'].forEach(attr => {
          const val = el.getAttribute(attr);
          if (val) val.split(',').forEach(p => { const u = p.trim().split(/\s+/)[0]; if (u) urls.add(u); });
        });
      });
      // CSS background images
      document.querySelectorAll('[style]').forEach(el => {
        const m = el.getAttribute('style').match(/url\(['"]?([^'")\s]+)['"]?\)/gi) || [];
        m.forEach(match => urls.add(match.replace(/url\(['"]?/i,'').replace(/['"]?\)$/,'')));
      });
      return [...urls];
    });

    for (const u of domImageUrls) {
      const absUrl = u.startsWith('http') ? u : (u.startsWith('//') ? 'https:' + u : null);
      if (absUrl) {
        imageUrls.add(absUrl);
        const cdn = detectCDN(absUrl);
        if (cdn) signals.push({ cdn, source: 'dom', url: absUrl });
      }
    }

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return {
      cdn: 'Not available',
      confidence: 'Low',
      detail: `Browser error: ${err.message}`,
      signals: [],
      imageUrls: [],
    };
  }

  if (browser) await browser.close().catch(() => {});

  const { cdn, confidence } = scoreSignals(signals);
  const imgixSigs    = signals.filter(s => s.cdn === 'imgix').length;
  const cloudSigs    = signals.filter(s => s.cdn === 'cloudinary').length;
  const detail = cdn === 'Not available'
    ? `Scanned ${imageUrls.size} network requests — no CDN signals found`
    : `${imageUrls.size} requests intercepted — Imgix signals: ${imgixSigs}, Cloudinary signals: ${cloudSigs}`;

  return {
    cdn,
    confidence,
    detail,
    signals: signals.slice(0, 5),
    imageUrls: [...imageUrls].filter(u => detectCDN(u)).slice(0, 5),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/crawl', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const result = await crawlWithBrowser(url);
    res.json(result);
  } catch (err) {
    res.json({ cdn: 'Not available', confidence: 'Low', detail: err.message, signals: [], imageUrls: [] });
  }
});

app.options('/crawl', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CDN Detector (Puppeteer) running on port ${PORT}`));
