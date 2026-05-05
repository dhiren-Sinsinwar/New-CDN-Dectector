const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_IMAGES   = 200;
const PARALLEL     = 4;
const PAGE_TIMEOUT = 20000;
const AFTER_WAIT   = 1500;
const SCROLL_PX    = 4000;

// ── CDN URL patterns (expanded from analyzer.py) ──────────────────────────────
// Each entry: [urlFragment, displayName]
const CDN_URL_PATTERNS = [
  // Imgix
  ['imgix.net',             'Imgix'],
  ['.imgix.',               'Imgix'],
  ['ix.imgix',              'Imgix'],
  ['imgix.com',             'Imgix'],
  ['ixlib=',                'Imgix'],
  // Cloudinary
  ['res.cloudinary.com',    'Cloudinary'],
  ['cloudinary.com',        'Cloudinary'],
  ['images.cloudinary',     'Cloudinary'],
  ['cloudinary.net',        'Cloudinary'],
  // ImageKit
  ['ik.imagekit.io',        'ImageKit'],
  ['imagekit.io',           'ImageKit'],
  ['imagekit',              'ImageKit'],
  // Gumlet
  ['gumlet.io',             'Gumlet'],
  ['gumlet',                'Gumlet'],
  // Scene7 / Adobe Dynamic Media
  ['scene7.com',            'Scene7'],
  ['scene7',                'Scene7'],
  // Cloudimage
  ['cloudimage.io',         'Cloudimage'],
  ['cloudimg.io',           'Cloudimage'],
  ['cloudimage',            'Cloudimage'],
  ['cloudimg',              'Cloudimage'],
  // ImageEngine
  ['imageengine.io',        'ImageEngine'],
  ['imgeng.in',             'ImageEngine'],
  ['imgeng',                'ImageEngine'],
  ['imageengine',           'ImageEngine'],
  // Sirv
  ['sirv.com',              'Sirv'],
  // Twicpics
  ['twicpics.com',          'Twicpics'],
  // Fastly
  ['fastly.net',            'Fastly'],
  ['fastly.com',            'Fastly'],
  // Akamai
  ['akamaized.net',         'Akamai'],
  ['akamai.net',            'Akamai'],
  ['akamaitech.net',        'Akamai'],
  ['akamai',                'Akamai'],
  // Cloudflare
  ['cloudflare.com',        'Cloudflare'],
  ['cdn.cloudflare',        'Cloudflare'],
  // AWS CloudFront
  ['cloudfront.net',        'CloudFront'],
  // AWS S3
  ['amazonaws.com',         'AWS S3'],
  ['s3.amazonaws',          'AWS S3'],
  // Google Cloud CDN / Firebase
  ['googleusercontent.com', 'Google Cloud'],
  ['storage.googleapis.com','Google Cloud Storage'],
  ['firebasestorage',       'Firebase Storage'],
  // Azure CDN
  ['azureedge.net',         'Azure CDN'],
  ['azurefd.net',           'Azure Front Door'],
  ['blob.core.windows.net', 'Azure Blob'],
  // Bunny CDN
  ['b-cdn.net',             'Bunny CDN'],
  ['bunnycdn.com',          'Bunny CDN'],
  ['bunny.net',             'Bunny CDN'],
  // KeyCDN
  ['kxcdn.com',             'KeyCDN'],
  // Uploadcare
  ['ucarecdn.com',          'Uploadcare'],
  ['uploadcare.com',        'Uploadcare'],
  // Storyblok
  ['storyblok.com',         'Storyblok'],
  ['a.storyblok',           'Storyblok'],
  // Contentful
  ['ctfassets.net',         'Contentful'],
  // Shopify CDN
  ['cdn.shopify.com',       'Shopify CDN'],
  ['shopifycdn.com',        'Shopify CDN'],
  // WordPress.com / Jetpack CDN
  ['wp.com',                'WordPress CDN'],
  ['wordpress.com',         'WordPress CDN'],
  ['i0.wp.com',             'Jetpack CDN'],
  ['i1.wp.com',             'Jetpack CDN'],
  ['i2.wp.com',             'Jetpack CDN'],
  // Wix
  ['wixstatic.com',         'Wix CDN'],
  ['wix.com',               'Wix CDN'],
  // Squarespace
  ['squarespace-cdn.com',   'Squarespace CDN'],
  ['sqspcdn.com',           'Squarespace CDN'],
  // Sanity
  ['sanity.io',             'Sanity CDN'],
  ['cdn.sanity.io',         'Sanity CDN'],
  // Prismic
  ['prismic.io',            'Prismic CDN'],
  // Optimizely / Episerver
  ['optimizely.com',        'Optimizely CDN'],
  // Rackspace / Limelight
  ['limelight.com',         'Limelight CDN'],
  // StackPath
  ['stackpathcdn.com',      'StackPath'],
  // CDN77
  ['cdn77.org',             'CDN77'],
  // MaxCDN / StackPath legacy
  ['maxcdn.com',            'MaxCDN'],
  // Verizon / Edgecast
  ['edgecastcdn.net',       'Edgecast CDN'],
];

// ── DAM URL patterns ──────────────────────────────────────────────────────────
// Digital Asset Management platforms
const DAM_URL_PATTERNS = [
  // Bynder
  ['bynder.com',            'Bynder'],
  ['bynder',                'Bynder'],
  // Widen (now Acquia DAM)
  ['widen.net',             'Widen / Acquia DAM'],
  ['widencdn.net',          'Widen / Acquia DAM'],
  ['widen',                 'Widen / Acquia DAM'],
  // Canto
  ['canto.com',             'Canto'],
  ['canto.de',              'Canto'],
  ['canto',                 'Canto'],
  // Brandfolder
  ['brandfolder.com',       'Brandfolder'],
  ['brandfolder',           'Brandfolder'],
  // Extensis Portfolio
  ['extensis.com',          'Extensis Portfolio'],
  // MediaValet
  ['mediavalet.com',        'MediaValet'],
  // Nuxeo
  ['nuxeo.com',             'Nuxeo'],
  // Aprimo
  ['aprimo.com',            'Aprimo'],
  // Salsify
  ['salsify.com',           'Salsify'],
  // Cloudinary DAM (also a CDN)
  ['cloudinary.com/dam',    'Cloudinary DAM'],
  // Adobe Experience Manager / AEM DAM
  ['scene7.com',            'Adobe Experience Manager DAM'],
  ['/content/dam/',         'Adobe AEM DAM'],
  ['/dam/',                 'DAM'],
  // Bynder compact view
  ['/m/portal',             'Bynder Portal'],
  // Celum
  ['celum.com',             'Celum DAM'],
  // IntelligenceBank
  ['intelligencebank.com',  'IntelligenceBank DAM'],
  // Acquia
  ['acquia.com',            'Acquia DAM'],
  // Webdam
  ['webdam.com',            'Webdam'],
  // Percolate
  ['percolate.com',         'Percolate DAM'],
  // Lytho
  ['lytho.com',             'Lytho DAM'],
  // Third Light
  ['thirdlight.com',        'Third Light DAM'],
  // Photoshelter
  ['photoshelter.com',      'PhotoShelter DAM'],
  // Asset Bank
  ['assetbank.co.uk',       'Asset Bank DAM'],
  // Filecamp
  ['filecamp.com',          'Filecamp DAM'],
  // Frontify
  ['frontify.com',          'Frontify DAM'],
  // Pimcore
  ['pimcore.com',           'Pimcore DAM'],
  // OpenAsset
  ['openasset.com',         'OpenAsset DAM'],
];

// ── Server header CDN patterns ────────────────────────────────────────────────
const SERVER_CDN_PATTERNS = [
  ['imgix',         'Imgix'],
  ['cloudinary',    'Cloudinary'],
  ['imagekit',      'ImageKit'],
  ['gumlet',        'Gumlet'],
  ['scene7',        'Scene7'],
  ['cloudimage',    'Cloudimage'],
  ['fastly',        'Fastly'],
  ['akamai',        'Akamai'],
  ['cloudflare',    'Cloudflare'],
  ['cloudfront',    'CloudFront'],
  ['bunny',         'Bunny CDN'],
  ['varnish',       'Varnish CDN'],
  ['nginx',         'Nginx'],
  ['apache',        'Apache'],
  ['litespeed',     'LiteSpeed'],
  ['openresty',     'OpenResty'],
];

// ── Detection functions ───────────────────────────────────────────────────────
function detectCDNFromUrl(url) {
  const lower = url.toLowerCase();
  for (const [pattern, name] of CDN_URL_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) return name;
  }
  return null;
}

function detectDAMFromUrl(url) {
  const lower = url.toLowerCase();
  for (const [pattern, name] of DAM_URL_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) return name;
  }
  return null;
}

function detectFromServerHeader(headers = {}) {
  const serverVal = [
    headers['server'],
    headers['x-server'],
    headers['x-served-by'],
    headers['x-cdn'],
    headers['via'],
    headers['x-cache'],
    headers['x-powered-by'],
  ].filter(Boolean).join(' ').toLowerCase();

  for (const [pattern, name] of SERVER_CDN_PATTERNS) {
    if (serverVal.includes(pattern.toLowerCase())) return { name, raw: serverVal };
  }
  return null;
}

function extractServerHeader(headers = {}) {
  return headers['server'] || headers['x-server'] || headers['x-served-by'] || null;
}

function normalise(raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { new URL(raw); return raw; } catch { return null; }
}

const IMAGE_TYPES = [
  'image/jpeg','image/jpg','image/png','image/gif','image/webp',
  'image/avif','image/svg+xml','image/bmp','image/tiff','image/x-icon',
];
function isImgCT(ct = '') { return IMAGE_TYPES.some(t => ct.toLowerCase().includes(t)); }

// ── URLs to NEVER save as matched URL ───────────────────────────────────────
const EXCLUDED_URL_PATTERNS = [
  /challenges\.cloudflare\.com/i,
  /cdn-cgi\/challenge/i,
  /cdn-cgi\//i,
  /pixel\.wp\.com\/g\.gif/i,
  /\.wp\.com\/g\.gif/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /\/beacon\./i,
  /g\.gif\?/i,
  /spacer\.gif/i,
  /blank\.gif/i,
  /pixel\.gif/i,
  /1x1\.gif/i,
  /\/favicon\.ico/i,
  /cdnjs\.cloudflare\.com/i,
];
function isExcludedUrl(url) { return EXCLUDED_URL_PATTERNS.some(p => p.test(url)); }

// ── CDN priority — specific image CDNs beat generic infrastructure ───────────
const CDN_PRIORITY = {
  'Imgix':10,'Cloudinary':10,'ImageKit':10,'Gumlet':10,'Scene7':10,
  'Cloudimage':10,'ImageEngine':10,'Sirv':10,'Twicpics':10,'Uploadcare':10,
  'Storyblok':9,'Contentful':9,'Sanity CDN':9,'Prismic CDN':9,
  'Shopify CDN':8,'WordPress CDN':7,'Jetpack CDN':7,'Wix CDN':7,'Squarespace CDN':7,
  'Firebase Storage':6,'Google Cloud Storage':6,'AWS S3':6,'Azure Blob':6,
  'Bunny CDN':5,'KeyCDN':5,'CloudFront':4,'Akamai':4,'Fastly':4,
  'Azure CDN':4,'Azure Front Door':4,
  'Cloudflare':2,'Nginx':1,'Apache':1,'LiteSpeed':1,'Varnish CDN':1,
};
function getCDNPriority(name) { return CDN_PRIORITY[name] || 3; }

// ── Cookie / modal bypass texts (from analyzer.py) ───────────────────────────
const COOKIE_TEXTS = [
  'accept all','accept','allow all','allow cookies','accept cookies',
  'i agree','agree','got it','continue','ok','okay','yes, i agree',
  'confirm my choices','save preferences','allow','accept & continue',
  'agree & continue','accept all cookies','allow all cookies',
  'understand','dismiss','consent','got it!','continue shopping',
];

// ── Crawl a single site ───────────────────────────────────────────────────────
async function crawlSite(browser, rawUrl) {
  const url = normalise(rawUrl);
  if (!url) return {
    cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available',
    matchedUrl: '', confidence: 'Low', detail: 'Invalid URL',
  };

  let imageCount   = 0;
  let done         = false;

  // Results we collect
  let cdnFromUrl   = null;  // CDN identified from image URL
  let serverHeader = null;  // raw server header value
  let serverCDN    = null;  // CDN identified from server header
  let damFromUrl   = null;  // DAM identified from any URL
  let matchedUrl   = null;  // the exact image URL that triggered CDN detection
  let bestImageUrl = null;  // best real image URL seen (fallback when matchedUrl is empty)
  let page;

  try {
    page = await browser.newPage();

    // Pick UA consistent per domain
    const domain = new URL(url).hostname;
    const UAS = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    ];
    let hash = 0;
    for (const c of domain) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    const ua = UAS[Math.abs(hash) % UAS.length];

    await page.setUserAgent(ua);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
      window.chrome = { runtime: {} };
    });

    await page.setRequestInterception(true);

    // Block junk resources to speed up loading
    const BLOCK_TYPES = new Set(['font','stylesheet','media','websocket','eventsource','manifest']);
    const BLOCK_DOMAINS = ['google-analytics.com','googletagmanager.com','doubleclick.net','facebook.net','hotjar.com','segment.com','intercom.io'];

    page.on('request', req => {
      const rt  = req.resourceType();
      const rUrl = req.url();
      if (BLOCK_TYPES.has(rt)) { req.abort(); return; }
      if (BLOCK_DOMAINS.some(d => rUrl.includes(d))) { req.abort(); return; }
      if (done && rt === 'image') { req.abort(); return; }
      req.continue();
    });

    // ── Main response handler — DevTools Network → Img tab ────────────────────
    page.on('response', async response => {
      if (done) return;
      try {
        const resUrl  = response.url();
        const status  = response.status();
        const headers = response.headers();
        const ct      = headers['content-type'] || '';
        const rt      = response.request().resourceType();

        // ── Check ALL responses for DAM signals (not just images) ────────────
        const damSignal = detectDAMFromUrl(resUrl);
        if (damSignal && !damFromUrl) damFromUrl = damSignal;

        // ── Only process image responses below ────────────────────────────────
        if ((rt !== 'image' && !isImgCT(ct)) || status < 200 || status >= 400) return;

        imageCount++;

        // ── Image cap ────────────────────────────────────────────────────────
        if (imageCount > MAX_IMAGES) {
          done = true;
          page.evaluate(() => window.stop()).catch(() => {});
          return;
        }

        // ── Track the best real image URL seen so far (fallback for matchedUrl) ─
        // Prefer larger images — skip tiny icons/SVG logos/trackers
        if (!isExcludedUrl(resUrl) && resUrl.startsWith('http')) {
          // Prefer URLs that look like real content images over logos/icons
          const isLikelyContent = /\.(jpg|jpeg|png|webp|gif|avif)/i.test(resUrl) &&
            !/favicon|icon|logo|pixel|spacer|blank|1x1|sprite/i.test(resUrl);
          if (!bestImageUrl || isLikelyContent) {
            bestImageUrl = resUrl;
          }
        }

        // ── Extract server header from this image response ────────────────────
        const rawServer = extractServerHeader(headers);
        if (rawServer && !serverHeader) serverHeader = rawServer;

        // ── Check server headers for CDN ──────────────────────────────────────
        const svrCDN = detectFromServerHeader(headers);
        if (svrCDN && !serverCDN) serverCDN = svrCDN.name;

        // ── Check image URL for CDN ───────────────────────────────────────────
        const urlCDN = detectCDNFromUrl(resUrl);
        if (urlCDN) {
          const newPriority = getCDNPriority(urlCDN);
          const curPriority = cdnFromUrl ? getCDNPriority(cdnFromUrl) : -1;

          // Use this CDN if it has higher priority than what we found before
          // AND the URL is not a bot-protection/tracking URL
          if (newPriority > curPriority) {
            cdnFromUrl = urlCDN;
            // Only save matchedUrl if it's a real content URL (not challenge/tracker)
            if (!isExcludedUrl(resUrl)) {
              matchedUrl = resUrl;
            }
          } else if (newPriority === curPriority && !matchedUrl && !isExcludedUrl(resUrl)) {
            // Same priority but no URL saved yet — save this one
            matchedUrl = resUrl;
          }
        }

        // ── Also check image URL for DAM ──────────────────────────────────────
        const imgDam = detectDAMFromUrl(resUrl);
        if (imgDam && !damFromUrl) damFromUrl = imgDam;

        // ── Early stop: high-priority CDN confirmed with a real URL ───────────
        if (cdnFromUrl && matchedUrl && getCDNPriority(cdnFromUrl) >= 8) {
          done = true;
          console.log(`[CDN] ✅ ${cdnFromUrl} (priority ${getCDNPriority(cdnFromUrl)}) on image #${imageCount} — stopping`);
          page.evaluate(() => window.stop()).catch(() => {});
        }

      } catch { /* ignore */ }
    });

    // ── Navigate ──────────────────────────────────────────────────────────────
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    } catch {
      if (!done) {
        try {
          const http = url.replace(/^https:/i, 'http:');
          await page.goto(http, { waitUntil: 'domcontentloaded', timeout: 12000 });
        } catch (e) {
          await page.close().catch(() => {});
          return { cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', matchedUrl: '', confidence: 'Low', detail: `Could not open: ${e.message}` };
        }
      }
    }

    // ── Dismiss cookie banners ────────────────────────────────────────────────
    if (!done) {
      try {
        await page.evaluate((cookieTexts) => {
          const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
          for (const btn of buttons) {
            const text = btn.innerText?.toLowerCase().trim() || '';
            if (cookieTexts.includes(text)) { btn.click(); return; }
          }
        }, COOKIE_TEXTS);
        await new Promise(r => setTimeout(r, 500));
      } catch { /* ignore */ }
    }

    // ── Wait + scroll if not done ─────────────────────────────────────────────
    if (!done) {
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
    return { cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', matchedUrl: '', confidence: 'Low', detail: `Error: ${err.message}` };
  }

  await page.close().catch(() => {});

  // ── Score confidence ──────────────────────────────────────────────────────
  let confidence = 'Low';
  if (cdnFromUrl && serverHeader)      confidence = 'High';
  else if (cdnFromUrl || serverCDN)    confidence = 'High';
  else if (damFromUrl)                 confidence = 'Medium';

  const finalCDN  = cdnFromUrl  || serverCDN || 'Not available';
  const finalDAM  = damFromUrl  || 'Not available';
  const detail    = `${imageCount} images scanned${cdnFromUrl ? ' | CDN URL: '+cdnFromUrl : ''}${serverHeader ? ' | Server: '+serverHeader : ''}${damFromUrl ? ' | DAM: '+damFromUrl : ''}`;

  // Use matchedUrl if we have one; otherwise fall back to the best real image URL
  // This fills in URLs for sites where CDN was detected from server headers only
  const finalUrl = matchedUrl || bestImageUrl || '';

  return {
    cdnFromUrl:  finalCDN,
    server:      serverHeader || serverCDN || '',
    damFromUrl:  finalDAM,
    matchedUrl:  finalUrl,
    confidence,
    detail,
  };
}

// ── SSE parallel stream endpoint ──────────────────────────────────────────────
app.post('/crawl-stream', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const { entries } = req.body || {};
  if (!entries || !entries.length) { send({ type: 'error', message: 'No entries' }); return res.end(); }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-zygote','--single-process','--disable-blink-features=AutomationControlled'],
    });

    const queue  = [...entries.map((e, i) => ({ ...e, i }))];
    const active = new Set();
    let done = 0;

    await new Promise((resolve) => {
      function next() {
        while (active.size < PARALLEL && queue.length > 0) {
          const item = queue.shift();
          active.add(item.i);
          send({ type: 'progress', index: item.i, company: item.company, website: item.url });

          crawlSite(browser, item.url)
            .then(result => {
              done++;
              active.delete(item.i);
              send({ type: 'result', index: item.i, company: item.company, website: item.url, ...result, done, total: entries.length });
              if (queue.length === 0 && active.size === 0) resolve(); else next();
            })
            .catch(err => {
              done++;
              active.delete(item.i);
              send({ type: 'result', index: item.i, company: item.company, website: item.url, cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', matchedUrl: '', confidence: 'Low', detail: err.message, done, total: entries.length });
              if (queue.length === 0 && active.size === 0) resolve(); else next();
            });
        }
      }
      next();
    });

    await browser.close().catch(() => {});
    send({ type: 'done', total: entries.length });

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    send({ type: 'error', message: err.message });
  }

  res.end();
});

app.options('/crawl-stream', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

// ── Single company crawl endpoint — used by frontend polling loop ─────────────
// Each request is short-lived (~5-15s), no streaming, no timeout issues
app.post('/crawl', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-zygote','--single-process','--disable-blink-features=AutomationControlled'],
  });

  try {
    const result = await crawlSite(browser, url);
    res.json(result);
  } catch (err) {
    res.json({ cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', matchedUrl: '', confidence: 'Low', detail: err.message });
  } finally {
    await browser.close().catch(() => {});
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
app.listen(PORT, () => console.log(`CDN Detector on port ${PORT}`));
