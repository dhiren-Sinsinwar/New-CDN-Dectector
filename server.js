const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_IMAGES   = 100;   // stop after 100 images if no CDN found
const PARALLEL     = 4;     // crawl 4 sites at the same time
const PAGE_TIMEOUT = 20000; // 20s max per site
const AFTER_WAIT   = 1500;  // 1.5s wait after load for lazy images
const SCROLL_PX    = 3000;  // max scroll depth

// ── CDN patterns ──────────────────────────────────────────────────────────────
const IMGIX_PAT = [/imgix\.net/i, /\.imgix\./i, /ix\.imgix/i, /imgix\.com/i];
const CLOUD_PAT = [/cloudinary\.com/i, /res\.cloudinary/i, /images\.cloudinary/i, /cloudinary\.net/i];

function detectUrl(url) {
  if (IMGIX_PAT.some(p => p.test(url))) return 'imgix';
  if (CLOUD_PAT.some(p => p.test(url))) return 'cloudinary';
  return null;
}
function detectHeaders(h = {}) {
  const s = [h['server'],h['x-served-by'],h['x-server'],h['via'],h['x-cache'],h['x-cdn']]
    .filter(Boolean).join(' ').toLowerCase();
  if (IMGIX_PAT.some(p => p.test(s))) return 'imgix';
  if (CLOUD_PAT.some(p => p.test(s))) return 'cloudinary';
  return null;
}
function normalise(raw) {
  raw = (raw||'').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { new URL(raw); return raw; } catch { return null; }
}
const IMG_CT = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','image/avif','image/svg+xml','image/bmp','image/tiff','image/x-icon'];
function isImgCT(ct='') { return IMG_CT.some(t => ct.toLowerCase().includes(t)); }

// ── Block unnecessary resource types to speed up loading ─────────────────────
const BLOCK_TYPES = new Set(['font','stylesheet','media','websocket','eventsource','manifest','other']);
const BLOCK_DOMAINS = [
  'google-analytics.com','googletagmanager.com','googlesyndication.com',
  'doubleclick.net','facebook.net','fbcdn.net','hotjar.com',
  'segment.com','intercom.io','drift.com','zendesk.com',
];
function shouldBlock(req) {
  if (BLOCK_TYPES.has(req.resourceType())) return true;
  if (BLOCK_DOMAINS.some(d => req.url().includes(d))) return true;
  return false;
}

// ── Crawl a single site ───────────────────────────────────────────────────────
async function crawlSite(browser, rawUrl) {
  const url = normalise(rawUrl);
  if (!url) return { cdn: 'Not available', confidence: 'Low', detail: 'Invalid URL' };

  let foundResult = null;
  let imageCount  = 0;
  let page;

  try {
    page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });

    await page.setRequestInterception(true);

    // ── Block junk, abort images once CDN found or limit reached ─────────────
    page.on('request', req => {
      if (shouldBlock(req))                                { req.abort();    return; }
      if (foundResult && req.resourceType() === 'image')  { req.abort();    return; }
      req.continue();
    });

    // ── Check every image response — DevTools Network → Img tab ──────────────
    page.on('response', async response => {
      if (foundResult) return;
      try {
        const resUrl = response.url();
        const status = response.status();
        const headers = response.headers();
        const ct = headers['content-type'] || '';
        const rt = response.request().resourceType();

        if ((rt !== 'image' && !isImgCT(ct)) || status < 200 || status >= 400) return;

        imageCount++;

        // ── 100 image cap ────────────────────────────────────────────────────
        if (imageCount >= MAX_IMAGES) {
          foundResult = { cdn: 'Not available', confidence: 'Low', detail: `Checked ${MAX_IMAGES} images — no CDN found`, matchedUrl: null };
          console.log(`[CDN] ⛔ ${MAX_IMAGES} image cap — moving on`);
          page.evaluate(() => window.stop()).catch(() => {});
          return;
        }

        // ── Check URL + headers ───────────────────────────────────────────────
        const cdn = detectHeaders(headers) || detectUrl(resUrl);
        if (cdn) {
          const via = detectHeaders(headers) ? 'response header' : 'image URL';
          foundResult = {
            cdn:        cdn === 'imgix' ? 'Imgix' : 'Cloudinary',
            confidence: 'High',
            detail:     `Image #${imageCount} matched via ${via}: ${resUrl.slice(0, 100)}`,
            matchedUrl: resUrl,
          };
          console.log(`[CDN] ✅ ${foundResult.cdn} on image #${imageCount} — stopping`);
          page.evaluate(() => window.stop()).catch(() => {});
        }
      } catch { /* ignore */ }
    });

    // ── Navigate — domcontentloaded is faster than networkidle2 ──────────────
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    } catch {
      if (!foundResult) {
        try {
          const http = url.replace(/^https:/i, 'http:');
          await page.goto(http, { waitUntil: 'domcontentloaded', timeout: 12000 });
        } catch (e) {
          await page.close().catch(() => {});
          return { cdn: 'Not available', confidence: 'Low', detail: `Could not open: ${e.message}` };
        }
      }
    }

    // ── Short wait + scroll only if CDN not yet found ─────────────────────────
    if (!foundResult) {
      await new Promise(r => setTimeout(r, AFTER_WAIT));

      try {
        await page.evaluate(async (maxPx) => {
          await new Promise(resolve => {
            let total = 0;
            const t = setInterval(() => {
              window.scrollBy(0, 300);
              total += 300;
              if (total >= maxPx) { clearInterval(t); resolve(); }
            }, 80);
          });
        }, SCROLL_PX);
        await new Promise(r => setTimeout(r, 1000));
      } catch { /* page may have stopped */ }
    }

  } catch (err) {
    if (page) await page.close().catch(() => {});
    return { cdn: 'Not available', confidence: 'Low', detail: `Error: ${err.message}` };
  }

  await page.close().catch(() => {});

  return foundResult || {
    cdn: 'Not available', confidence: 'Low',
    detail: `${imageCount} images checked — no Imgix or Cloudinary found`,
  };
}

// ── Parallel crawl runner ─────────────────────────────────────────────────────
// Processes up to PARALLEL sites at the same time using a shared browser instance
async function crawlBatch(entries) {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const results = new Array(entries.length);
  const queue   = [...entries.map((e, i) => ({ ...e, i }))];
  const active  = new Set();

  await new Promise((resolve) => {
    function next() {
      while (active.size < PARALLEL && queue.length > 0) {
        const item = queue.shift();
        active.add(item.i);
        crawlSite(browser, item.url)
          .then(result => {
            results[item.i] = { ...result, company: item.company, website: item.url };
            active.delete(item.i);
            if (queue.length === 0 && active.size === 0) resolve();
            else next();
          })
          .catch(err => {
            results[item.i] = { company: item.company, website: item.url, cdn: 'Not available', confidence: 'Low', detail: err.message };
            active.delete(item.i);
            if (queue.length === 0 && active.size === 0) resolve();
            else next();
          });
      }
    }
    next();
  });

  await browser.close().catch(() => {});
  return results;
}

// ── SSE crawl endpoint — streams results back as they complete ────────────────
app.post('/crawl-stream', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const { entries } = req.body || {};
  if (!entries || !entries.length) {
    send({ type: 'error', message: 'No entries provided' });
    return res.end();
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
        '--disable-gpu','--no-first-run','--no-zygote','--single-process',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const queue  = [...entries.map((e, i) => ({ ...e, i }))];
    const active = new Set();
    let   done   = 0;

    await new Promise((resolve) => {
      function next() {
        while (active.size < PARALLEL && queue.length > 0) {
          const item = queue.shift();
          active.add(item.i);

          send({ type: 'progress', index: item.i, company: item.company, website: item.url, status: 'scanning' });

          crawlSite(browser, item.url)
            .then(result => {
              done++;
              active.delete(item.i);
              send({ type: 'result', index: item.i, company: item.company, website: item.url, ...result, done, total: entries.length });
              if (queue.length === 0 && active.size === 0) resolve();
              else next();
            })
            .catch(err => {
              done++;
              active.delete(item.i);
              send({ type: 'result', index: item.i, company: item.company, website: item.url, cdn: 'Not available', confidence: 'Low', detail: err.message, done, total: entries.length });
              if (queue.length === 0 && active.size === 0) resolve();
              else next();
            });
        }
      }
      next();
    });

    await browser.close().catch(() => {});
    send({ type: 'done', total: entries.length });

  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// ── Single crawl (kept for backward compat) ───────────────────────────────────
app.post('/crawl', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-zygote','--single-process'],
  });

  try {
    const result = await crawlSite(browser, url);
    res.json(result);
  } catch (err) {
    res.json({ cdn: 'Not available', confidence: 'Low', detail: err.message });
  } finally {
    await browser.close().catch(() => {});
  }
});

app.options(['/crawl', '/crawl-stream'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CDN Detector on port ${PORT} | parallel=${PARALLEL} | maxImages=${MAX_IMAGES}`));
