const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_IMAGES   = 200;
const MIN_IMAGES   = 100;  // must scan at least this many before stopping early
const PARALLEL     = 2;    // keep low — discovery opens up to 21 pages per company
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

// ── Image format / tier priority ──────────────────────────────────────────────
// Pass 1 (priority): jpeg/webp/avif, non-banner  — scan first; stop early if CDN found
// Pass 2 (fallback): png/gif/svg/etc, non-banner  — only if pass 1 found nothing
// Pass 3 (banner):   any banner/hero image        — absolute last resort
const PRIORITY_FORMATS   = /\.(jpe?g|webp|avif)(\?|$|#)/i;
const PRIORITY_MIMETYPES = ['image/jpeg','image/jpg','image/webp','image/avif'];

function isPriorityFormat(url = '', ct = '') {
  return (
    PRIORITY_FORMATS.test(url) ||
    PRIORITY_MIMETYPES.some(t => ct.toLowerCase().includes(t))
  ) && !BANNER_URL_PATTERNS.test(url);  // banners go to pass 3 even if jpeg/webp/avif
}

function isBannerImage(url = '') {
  return BANNER_URL_PATTERNS.test(url);
}

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
  /\/favicon\./i,          // any favicon (favicon.ico, favicon.png, favicon-32x32.png, etc.)
  /favicon-\d/i,           // favicon-32x32, favicon-16x16, etc.
  /apple-touch-icon/i,     // Apple home screen icons
  /\/logo\./i,             // /logo.png, /logo.svg, etc.
  /\/logos?\//i,           // /logo/ or /logos/ directory
  /\/brand\//i,            // /brand/ directory (often brand assets)
  /cdnjs\.cloudflare\.com/i,
];
function isExcludedUrl(url) { return EXCLUDED_URL_PATTERNS.some(p => p.test(url)); }

// ── URL patterns that indicate a banner / hero image ────────────────────────
// Banners are valid CDN evidence but deprioritised — processed last
const BANNER_URL_PATTERNS = /\/(banner|hero|masthead|carousel|slider|splash|header[-_]?img|billboard|jumbotron|cover|bg[-_]?image|background[-_]?image)/i;

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

// ── Page discovery config ─────────────────────────────────────────────────────
const MAX_DISCOVER_PAGES = 20;   // max internal pages to probe in discovery phase
const DISCOVER_TIMEOUT   = 12000; // timeout per discovery page
const DISCOVER_WAIT      = 800;   // ms to wait after load before counting images

// ── Discover internal links from a page ───────────────────────────────────────
// Returns same-origin hrefs found in <a> tags, deduplicated, excluding
// mailto/tel/hash-only links, file downloads, and non-HTML paths.
function extractInternalLinks(pageUrl, hrefs) {
  const base = new URL(pageUrl);
  const seen = new Set();
  const links = [];
  for (const href of hrefs) {
    if (!href) continue;
    try {
      const u = new URL(href, base);
      // Same origin only
      if (u.origin !== base.origin) continue;
      // Skip non-html paths
      if (/\.(pdf|zip|docx?|xlsx?|jpg|jpeg|png|gif|svg|webp|mp4|mp3|csv|xml|json)$/i.test(u.pathname)) continue;
      // Skip hash-only and empty paths
      if (u.pathname === base.pathname && u.search === base.search) continue;
      const key = u.pathname + u.search;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push(u.href);
    } catch { /* invalid href */ }
  }
  return links;
}

// ── Phase 1: Visit up to MAX_DISCOVER_PAGES pages and count images on each ───
// Returns { url, imageCount } for the richest page found.
// Uses lightweight DOM query (querySelectorAll('img')) + network image counter.
async function discoverRichestPage(browser, homeUrl, pageSetup) {
  let page;
  const results = [];  // { url, imageCount }

  // Helper: visit one URL, count images, return count
  async function probePage(url) {
    try {
      page = await browser.newPage();
      await pageSetup(page);  // apply UA, headers, spoofing, viewport

      let netImages = 0;
      page.on('response', res => {
        const ct = res.headers()['content-type'] || '';
        const rt = res.request().resourceType();
        if ((rt === 'image' || isImgCT(ct)) && res.status() >= 200 && res.status() < 400) {
          const u = res.url();
          if (!isExcludedUrl(u)) netImages++;
        }
      });

      // Best-effort navigate — just need the page to partially render
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DISCOVER_TIMEOUT });
      } catch {
        try { await page.goto(url, { waitUntil: 'commit', timeout: 8000 }); } catch { /* ignore */ }
      }
      await new Promise(r => setTimeout(r, DISCOVER_WAIT));

      // Count <img> tags in DOM as a secondary signal
      const domImages = await page.evaluate(() =>
        document.querySelectorAll('img[src]:not([src=""])').length
      ).catch(() => 0);

      const total = Math.max(netImages, domImages);
      console.log(`[DISCOVER] ${url} → ${total} images (net:${netImages} dom:${domImages})`);
      await page.close().catch(() => {});
      page = null;
      return total;
    } catch (err) {
      if (page) { await page.close().catch(() => {}); page = null; }
      console.log(`[DISCOVER] ${url} → error: ${err.message}`);
      return 0;
    }
  }

  // Step 1: Visit homepage, count images, collect internal links
  let homeImageCount = 0;
  let internalLinks  = [];
  try {
    page = await browser.newPage();
    await pageSetup(page);
    page.on('response', res => {
      const ct = res.headers()['content-type'] || '';
      const rt = res.request().resourceType();
      if ((rt === 'image' || isImgCT(ct)) && res.status() >= 200 && res.status() < 400) {
        if (!isExcludedUrl(res.url())) homeImageCount++;
      }
    });
    try {
      await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: DISCOVER_TIMEOUT });
    } catch {
      try { await page.goto(homeUrl, { waitUntil: 'commit', timeout: 8000 }); } catch { /* ignore */ }
    }
    await new Promise(r => setTimeout(r, DISCOVER_WAIT));

    // Count DOM images on home too
    const homeDom = await page.evaluate(() =>
      document.querySelectorAll('img[src]:not([src=""])').length
    ).catch(() => 0);
    homeImageCount = Math.max(homeImageCount, homeDom);

    // Extract all internal links
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'))
    ).catch(() => []);
    internalLinks = extractInternalLinks(homeUrl, hrefs);
    console.log(`[DISCOVER] Home: ${homeUrl} → ${homeImageCount} images, ${internalLinks.length} links found`);
    await page.close().catch(() => {});
    page = null;
  } catch (err) {
    if (page) { await page.close().catch(() => {}); page = null; }
    console.log(`[DISCOVER] Home visit failed: ${err.message}`);
  }

  results.push({ url: homeUrl, imageCount: homeImageCount });

  // Step 2: Probe up to MAX_DISCOVER_PAGES - 1 internal pages (skip if home already failed)
  const toProbe = internalLinks.slice(0, MAX_DISCOVER_PAGES - 1);
  for (const link of toProbe) {
    const count = await probePage(link);
    results.push({ url: link, imageCount: count });
  }

  // Pick the page with the most images
  results.sort((a, b) => b.imageCount - a.imageCount);
  const richest = results[0] || { url: homeUrl, imageCount: 0 };
  console.log(`[DISCOVER] Richest page: ${richest.url} (${richest.imageCount} images) out of ${results.length} pages scanned`);
  return { richestUrl: richest.url, richestImageCount: richest.imageCount, pagesScanned: results.length, allPages: results };
}

// ── Crawl a single site ───────────────────────────────────────────────────────

// Shared page setup: UA spoofing, headers, navigator patches, viewport, request interception
// Call this on every new page before navigating.
async function applyPageSetup(page, domain) {
  await page.setBypassCSP(true);
  await page._client().send('Security.setIgnoreCertificateErrors', { ignore: true }).catch(() => {});

  const UAS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  ];
  let hash = 0;
  for (const c of domain) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  await page.setUserAgent(UAS[Math.abs(hash) % UAS.length]);

  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    const makePlugin = (name, filename, desc) => {
      const plugin = Object.create(Plugin.prototype);
      Object.defineProperty(plugin, 'name',        { get: () => name });
      Object.defineProperty(plugin, 'filename',    { get: () => filename });
      Object.defineProperty(plugin, 'description', { get: () => desc });
      Object.defineProperty(plugin, 'length',      { get: () => 0 });
      return plugin;
    };
    try {
      const plugins = [
        makePlugin('Chrome PDF Plugin',  'internal-pdf-viewer',            'Portable Document Format'),
        makePlugin('Chrome PDF Viewer',  'mhjfbmdgcfjbbpaeojofohoefgiehjai', ''),
        makePlugin('Native Client',      'internal-nacl-plugin',            ''),
      ];
      Object.defineProperty(navigator, 'plugins',   { get: () => plugins });
      Object.defineProperty(navigator, 'mimeTypes', { get: () => ({ length: 4 }) });
    } catch(e) {}
    Object.defineProperty(navigator, 'languages',          { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory',        { get: () => 8 });
    Object.defineProperty(navigator, 'platform',            { get: () => 'Win32' });
    window.chrome = {
      app: { isInstalled: false, InstallState: { DISABLED:'disabled', INSTALLED:'installed', NOT_INSTALLED:'not_installed' }, RunningState: { CANNOT_RUN:'cannot_run', READY_TO_RUN:'ready_to_run', RUNNING:'running' } },
      runtime: {
        OnInstalledReason: { CHROME_UPDATE:'chrome_update', INSTALL:'install', SHARED_MODULE_UPDATE:'shared_module_update', UPDATE:'update' },
        OnRestartRequiredReason: { APP_UPDATE:'app_update', GC_PRESSURE:'gc_pressure', OS_UPDATE:'os_update' },
        PlatformArch: { ARM:'arm', ARM64:'arm64', MIPS:'mips', MIPS64:'mips64', X86_32:'x86-32', X86_64:'x86-64' },
        PlatformNaclArch: { ARM:'arm', MIPS:'mips', MIPS64:'mips64', X86_32:'x86-32', X86_64:'x86-64' },
        PlatformOs: { ANDROID:'android', CROS:'cros', LINUX:'linux', MAC:'mac', OPENBSD:'openbsd', WIN:'win' },
        RequestUpdateCheckStatus: { NO_UPDATE:'no_update', THROTTLED:'throttled', UPDATE_AVAILABLE:'update_available' },
      },
    };
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = (params) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(params);
    }
    try {
      const getParam = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Intel Inc.';
        if (param === 37446) return 'Intel Iris OpenGL Engine';
        return getParam.call(this, param);
      };
    } catch(e) {}
    Object.defineProperty(window, 'outerWidth',  { get: () => 1920 });
    Object.defineProperty(window, 'outerHeight', { get: () => 1080 });
    Object.defineProperty(window, 'screenX',     { get: () => 0 });
    Object.defineProperty(window, 'screenY',     { get: () => 0 });
  });

  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);

  const BLOCK_TYPES   = new Set(['font','media','websocket','eventsource','manifest']);
  const BLOCK_DOMAINS = ['google-analytics.com','googletagmanager.com','doubleclick.net','facebook.net','hotjar.com','segment.com','intercom.io','clarity.ms','mouseflow.com','fullstory.com'];
  page.on('request', req => {
    const rt  = req.resourceType();
    const rUrl = req.url();
    if (BLOCK_TYPES.has(rt)) { req.abort(); return; }
    if (BLOCK_DOMAINS.some(d => rUrl.includes(d))) { req.abort(); return; }
    req.continue();
  });
}

async function crawlSite(browser, rawUrl) {
  const url = normalise(rawUrl);
  if (!url) return {
    cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available',
    matchedUrl: '', confidence: 'Low', detail: 'Invalid URL',
    reason: 'Invalid or missing URL', keywordCounts: { cloudinary: 0, imgix: 0 },
  };

  const domain = new URL(url).hostname;

  // ── Phase 1: Discover which page has the most images ─────────────────────────
  let richestUrl          = url;
  let richestImageCount   = 0;
  let pagesScanned        = 1;
  try {
    const discovery = await discoverRichestPage(browser, url, (page) => applyPageSetup(page, domain));
    richestUrl        = discovery.richestUrl;
    richestImageCount = discovery.richestImageCount;
    pagesScanned      = discovery.pagesScanned;
    console.log(`[CRAWL] Richest page selected: ${richestUrl} (${richestImageCount} imgs, ${pagesScanned} pages scanned)`);
  } catch (err) {
    console.log(`[CRAWL] Discovery failed, falling back to homepage: ${err.message}`);
  }

  // ── Phase 2: Deep-scan the richest page for CDN/DAM/keywords ─────────────────
  let imageCount       = 0;
  let priorityCount    = 0;
  let done             = false;

  let cdnFromUrl   = null;
  let serverHeader = null;
  let serverCDN    = null;
  let damFromUrl   = null;
  let matchedUrl   = null;
  let bestImageUrl = null;
  const keywordCounts = { cloudinary: 0, imgix: 0 };

  const fallbackQueue = [];
  const bannerQueue   = [];

  let page;

  try {
    page = await browser.newPage();
    await applyPageSetup(page, domain);

    // Override request handler to also respect `done` flag for image blocking
    page.removeAllListeners('request');
    const BLOCK_TYPES   = new Set(['font','media','websocket','eventsource','manifest']);
    const BLOCK_DOMAINS = ['google-analytics.com','googletagmanager.com','doubleclick.net','facebook.net','hotjar.com','segment.com','intercom.io','clarity.ms','mouseflow.com','fullstory.com'];
    page.on('request', req => {
      const rt   = req.resourceType();
      const rUrl = req.url();
      if (BLOCK_TYPES.has(rt)) { req.abort(); return; }
      if (BLOCK_DOMAINS.some(d => rUrl.includes(d))) { req.abort(); return; }
      if (done && rt === 'image') { req.abort(); return; }
      req.continue();
    });

    // ── Helper: process one image response for CDN/DAM signals ───────────────
    function processImageResponse(resUrl, ct, headers) {
      // Track best real image URL (fallback when matchedUrl is empty)
      if (!isExcludedUrl(resUrl) && resUrl.startsWith('http')) {
        const isLikelyContent = /\.(jpe?g|png|webp|gif|avif)/i.test(resUrl) &&
          !/favicon|favicon-\d|apple-touch-icon|icon|logo|logos?\/|pixel|spacer|blank|1x1|sprite/i.test(resUrl);
        if (!bestImageUrl || isLikelyContent) bestImageUrl = resUrl;
      }

      // Extract server header
      const rawServer = extractServerHeader(headers);
      if (rawServer && !serverHeader) serverHeader = rawServer;

      // Check server headers for CDN
      const svrCDN = detectFromServerHeader(headers);
      if (svrCDN && !serverCDN) serverCDN = svrCDN.name;

      // Check image URL for CDN
      const urlCDN = detectCDNFromUrl(resUrl);
      if (urlCDN) {
        const newPriority = getCDNPriority(urlCDN);
        const curPriority = cdnFromUrl ? getCDNPriority(cdnFromUrl) : -1;
        if (newPriority > curPriority) {
          cdnFromUrl = urlCDN;
          if (!isExcludedUrl(resUrl)) matchedUrl = resUrl;
        } else if (newPriority === curPriority && !matchedUrl && !isExcludedUrl(resUrl)) {
          matchedUrl = resUrl;
        }
      }

      // Check image URL for DAM
      const imgDam = detectDAMFromUrl(resUrl);
      if (imgDam && !damFromUrl) damFromUrl = imgDam;
    }

    // ── Main response handler — DevTools Network → Img tab ───────────────────
    // PASS 1: only process jpeg / webp / avif — the priority formats.
    // Non-priority images (png, gif, svg, etc.) are queued in fallbackQueue.
    // After the page finishes loading, if nothing was found from priority images,
    // PASS 2 processes the fallbackQueue (up to MAX_IMAGES total).
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

        // ── Image cap (across both passes) ────────────────────────────────────
        if (imageCount > MAX_IMAGES) {
          done = true;
          page.evaluate(() => window.stop()).catch(() => {});
          return;
        }

        const isPriority = isPriorityFormat(resUrl, ct);
        const isBanner   = isBannerImage(resUrl);

        if (isPriority) {
          // ── Pass 1: process jpeg/webp/avif (non-banner) immediately ────────
          priorityCount++;
          processImageResponse(resUrl, ct, headers);

          // Early stop: high-priority CDN confirmed with a real URL AND min images scanned
          if (cdnFromUrl && matchedUrl && getCDNPriority(cdnFromUrl) >= 8 && imageCount >= MIN_IMAGES) {
            done = true;
            console.log(`[CDN] ✅ ${cdnFromUrl} via priority format (image #${imageCount}) — stopping (min ${MIN_IMAGES} reached)`);
            page.evaluate(() => window.stop()).catch(() => {});
          }
        } else if (isBanner) {
          // ── Pass 3: defer banner/hero images — absolute last resort ─────────
          if (bannerQueue.length < MAX_IMAGES) {
            bannerQueue.push({ resUrl, ct, headers });
          }
        } else {
          // ── Pass 2: defer png/gif/svg/etc for fallback processing ───────────
          if (fallbackQueue.length < MAX_IMAGES) {
            fallbackQueue.push({ resUrl, ct, headers });
          }
        }

      } catch { /* ignore */ }
    });

    // ── Navigate to the richest page for deep CDN/DAM analysis ──────────────
    let navSuccess = done;
    if (!navSuccess) {
      const richestHttps = richestUrl.startsWith('http') ? richestUrl : url;
      const richestHttp  = richestHttps.replace(/^https:/i, 'http:');
      const attempts = [
        { url: richestHttps, opts: { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT } },
        { url: richestHttps, opts: { waitUntil: 'commit',           timeout: 25000 } },
        { url: richestHttp,  opts: { waitUntil: 'domcontentloaded', timeout: 20000 } },
        { url: richestHttp,  opts: { waitUntil: 'commit',           timeout: 15000 } },
      ];

      let lastError = null;
      for (const attempt of attempts) {
        if (done) { navSuccess = true; break; } // CDN already found, stop trying
        try {
          await page.goto(attempt.url, attempt.opts);
          navSuccess = true;
          break;
        } catch (e) {
          lastError = e;
          // If we already captured some images/signals, that's good enough
          if (imageCount > 0 || serverHeader || damFromUrl) { navSuccess = true; break; }
        }
      }

      if (!navSuccess) {
        await page.close().catch(() => {});
        const errMsg = lastError?.message || 'Unknown navigation error';
        const reason = errMsg.includes('CERT') || errMsg.includes('SSL') || errMsg.includes('certificate')
          ? `SSL/Certificate error: ${errMsg}`
          : errMsg.includes('timeout') || errMsg.includes('Timeout')
          ? `Page too slow to load (timeout after ${PAGE_TIMEOUT/1000}s)`
          : errMsg.includes('ERR_NAME_NOT_RESOLVED') || errMsg.includes('DNS')
          ? `Domain not found (DNS error)`
          : errMsg.includes('ERR_CONNECTION_REFUSED')
          ? `Connection refused — site may be down`
          : `Could not open site: ${errMsg}`;
        return { cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', matchedUrl: '', bestImageUrl: null, confidence: 'Low', detail: reason, reason };
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

    // ── Simulate human behaviour: mouse move + scroll ───────────────────────
    if (!done) {
      await new Promise(r => setTimeout(r, AFTER_WAIT));
      try {
        // Move mouse randomly — bots never move the mouse
        await page.mouse.move(
          400 + Math.floor(Math.random() * 400),
          300 + Math.floor(Math.random() * 200)
        );
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
        await page.mouse.move(
          200 + Math.floor(Math.random() * 600),
          200 + Math.floor(Math.random() * 400)
        );
        await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

        // Scroll with human-like variable speed
        await page.evaluate(async (maxPx) => {
          await new Promise(resolve => {
            let total = 0;
            const t = setInterval(() => {
              // Variable scroll distance like a human
              const step = 200 + Math.floor(Math.random() * 200);
              window.scrollBy(0, step);
              total += step;
              if (total >= maxPx) { clearInterval(t); resolve(); }
            }, 100 + Math.floor(Math.random() * 80));
          });
        }, SCROLL_PX);
        await new Promise(r => setTimeout(r, 1000));
      } catch { /* page may have stopped */ }
    }

    // ── DOM keyword search — counts Cloudinary / Imgix mentions in the page ──
    // Searches the full rendered DOM (outerHTML) — equivalent to Inspect Element
    // → Elements tab, then Ctrl+F for the keyword.
    try {
      const kwCounts = await page.evaluate(() => {
        const html = document.documentElement.outerHTML.toLowerCase();
        // Count all non-overlapping occurrences
        const countOf = (kw) => {
          let n = 0, pos = 0;
          while ((pos = html.indexOf(kw, pos)) !== -1) { n++; pos += kw.length; }
          return n;
        };
        return {
          cloudinary: countOf('cloudinary'),
          imgix:      countOf('imgix'),
        };
      });
      keywordCounts.cloudinary = kwCounts.cloudinary;
      keywordCounts.imgix      = kwCounts.imgix;
      console.log(`[KW] Cloudinary:${kwCounts.cloudinary} Imgix:${kwCounts.imgix}`);
    } catch { /* page may have been navigated away */ }

  } catch (err) {
    if (page) await page.close().catch(() => {});
    return { cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', matchedUrl: '', confidence: 'Low', detail: `Error: ${err.message}`, reason: `Browser error: ${err.message}`, keywordCounts: { cloudinary: 0, imgix: 0 } };
  }

  // ── Pass 2: process fallback images (png/gif/svg/etc, non-banner) ───────────
  // Only runs if the priority pass (jpeg/webp/avif) found no CDN signal
  if (!cdnFromUrl && !serverCDN && fallbackQueue.length > 0) {
    console.log(`[CDN] No CDN in ${priorityCount} priority images — checking ${fallbackQueue.length} fallback images (png/gif/etc)`);
    let fallbackCount = 0;
    for (const { resUrl, ct, headers } of fallbackQueue) {
      processImageResponse(resUrl, ct, headers);
      fallbackCount++;
      const totalScanned = priorityCount + fallbackCount;
      if (cdnFromUrl && matchedUrl && getCDNPriority(cdnFromUrl) >= 8 && totalScanned >= MIN_IMAGES) {
        console.log(`[CDN] ✅ ${cdnFromUrl} found in fallback images after ${totalScanned} total images — stopping`);
        break;
      }
    }
  }

  // ── Pass 3: process banner/hero images — only if passes 1 & 2 found nothing ─
  if (!cdnFromUrl && !serverCDN && bannerQueue.length > 0) {
    console.log(`[CDN] No CDN in passes 1+2 — checking ${bannerQueue.length} banner/hero images as last resort`);
    let bannerCount = 0;
    for (const { resUrl, ct, headers } of bannerQueue) {
      processImageResponse(resUrl, ct, headers);
      bannerCount++;
      const totalScanned = priorityCount + bannerCount;
      if (cdnFromUrl && matchedUrl && getCDNPriority(cdnFromUrl) >= 8 && totalScanned >= MIN_IMAGES) {
        console.log(`[CDN] ✅ ${cdnFromUrl} found in banner images after ${totalScanned} total images — stopping`);
        break;
      }
    }
  }

  await page.close().catch(() => {});

  // ── Score confidence ──────────────────────────────────────────────────────
  let confidence = 'Low';
  if (cdnFromUrl && serverHeader)      confidence = 'High';
  else if (cdnFromUrl || serverCDN)    confidence = 'High';
  else if (damFromUrl)                 confidence = 'Medium';

  const finalCDN  = cdnFromUrl  || serverCDN || 'Not available';
  const finalDAM  = damFromUrl  || 'Not available';
  const detail = `Pages scanned: ${pagesScanned} | Richest page: ${richestUrl} (${richestImageCount} imgs) | ${imageCount} images deep-scanned (${priorityCount} priority, ${fallbackQueue.length} fallback, ${bannerQueue.length} banners)${cdnFromUrl ? ' | CDN: '+cdnFromUrl : ''}${serverHeader ? ' | Server: '+serverHeader : ''}${damFromUrl ? ' | DAM: '+damFromUrl : ''}`;

  // ── Reason for "Not available" — shown in the Error/Reason column ───────────
  let reason = '';
  if (finalCDN === 'Not available') {
    if (imageCount === 0) {
      reason = 'No images loaded — site may have blocked the crawler (bot protection / CAPTCHA)';
    } else if (imageCount >= MAX_IMAGES) {
      reason = `Checked ${MAX_IMAGES} images — no Imgix, Cloudinary or known CDN patterns found`;
    } else {
      reason = `${imageCount} images scanned — no known CDN or DAM patterns detected in URLs or headers`;
    }
  }

  // Use matchedUrl if we have one; otherwise fall back to the best real image URL
  // This fills in URLs for sites where CDN was detected from server headers only
  const finalUrl = matchedUrl || bestImageUrl || '';

  return {
    cdnFromUrl:         finalCDN,
    server:             serverHeader || serverCDN || '',
    damFromUrl:         finalDAM,
    matchedUrl:         finalUrl,
    confidence,
    detail,
    reason,
    keywordCounts,
    richestPage:        richestUrl,
    richestImageCount,
    pagesScanned,
  };
}

// ── Shared persistent browser ─────────────────────────────────────────────────
// A single Chrome instance is reused for all crawls.
// If it dies (EAGAIN, crash), it is automatically restarted before the next use.
const BROWSER_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process',
  '--disable-blink-features=AutomationControlled',
  '--ignore-certificate-errors', '--ignore-certificate-errors-spki-list',
  '--max-old-space-size=512',
];

let sharedBrowser = null;
let browserLaunching = false;

async function getBrowser() {
  // If already healthy, return it
  if (sharedBrowser) {
    try {
      const pages = await sharedBrowser.pages();
      if (pages) return sharedBrowser;  // still alive
    } catch { sharedBrowser = null; }
  }

  // Wait if another call is already launching
  if (browserLaunching) {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (sharedBrowser) return sharedBrowser;
    }
    throw new Error('Browser launch timeout');
  }

  browserLaunching = true;
  try {
    // Retry up to 3 times on EAGAIN
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        sharedBrowser = await puppeteer.launch({
          headless: 'new',
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
          ignoreHTTPSErrors: true,
          args: BROWSER_ARGS,
        });
        sharedBrowser.on('disconnected', () => {
          console.log('[BROWSER] Disconnected — will relaunch on next request');
          sharedBrowser = null;
        });
        console.log('[BROWSER] Launched successfully');
        return sharedBrowser;
      } catch (err) {
        console.error(`[BROWSER] Launch attempt ${attempt} failed: ${err.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
        else throw err;
      }
    }
  } finally {
    browserLaunching = false;
  }
}

// Launch the browser at startup so the first request is fast
getBrowser().catch(err => console.error('[BROWSER] Initial launch failed:', err.message));

// Catch any unhandled promise rejections so the server never crashes
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

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

  try {
    const browser = await getBrowser();

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
              send({ type: 'result', index: item.i, company: item.company, website: item.url, cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', matchedUrl: '', confidence: 'Low', detail: err.message, reason: err.message, keywordCounts: { cloudinary: 0, imgix: 0 }, richestPage: '', richestImageCount: 0, pagesScanned: 0, done, total: entries.length });
              if (queue.length === 0 && active.size === 0) resolve(); else next();
            });
        }
      }
      next();
    });

    // Do NOT close the shared browser here
    send({ type: 'done', total: entries.length });

  } catch (err) {
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
app.post('/crawl', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const browser = await getBrowser();
    const result = await crawlSite(browser, url);
    res.json(result);
  } catch (err) {
    res.json({ cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', matchedUrl: '', confidence: 'Low', detail: err.message, reason: err.message, keywordCounts: { cloudinary: 0, imgix: 0 }, richestPage: '', richestImageCount: 0, pagesScanned: 0 });
  }
  // Do NOT close the shared browser here
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
