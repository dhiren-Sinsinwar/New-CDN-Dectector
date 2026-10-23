const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_IMAGES   = 100;   // max images per page
const PARALLEL     = 6;     // server-side parallel Chrome instances
const PAGE_TIMEOUT = 15000; // 15s per page load
const AFTER_WAIT   = 800;   // wait after load
const SCROLL_PX    = 2500;  // scroll depth

// ── CDN URL patterns ──────────────────────────────────────────────────────────
const CDN_URL_PATTERNS = [
  ['imgix.net',             'Imgix'],
  ['.imgix.',               'Imgix'],
  ['ix.imgix',              'Imgix'],
  ['imgix.com',             'Imgix'],
  ['ixlib=',                'Imgix'],
  ['res.cloudinary.com',    'Cloudinary'],
  ['cloudinary.com',        'Cloudinary'],
  ['images.cloudinary',     'Cloudinary'],
  ['cloudinary.net',        'Cloudinary'],
  ['ik.imagekit.io',        'ImageKit'],
  ['imagekit.io',           'ImageKit'],
  ['gumlet.io',             'Gumlet'],
  ['gumlet',                'Gumlet'],
  ['scene7.com',            'Scene7 (Adobe DM)'],
  ['scene7.net',            'Scene7 (Adobe DM)'],
  ['.scene7.',              'Scene7 (Adobe DM)'],
  ['cloudimage.io',         'Cloudimage'],
  ['cloudimg.io',           'Cloudimage'],
  ['imageengine.io',        'ImageEngine'],
  ['imgeng.in',             'ImageEngine'],
  ['sirv.com',              'Sirv'],
  ['twicpics.com',          'Twicpics'],
  ['fastly.net',            'Fastly'],
  ['fastly.com',            'Fastly'],
  ['akamaized.net',         'Akamai'],
  ['akamai.net',            'Akamai'],
  ['akamaitech.net',        'Akamai'],
  ['cloudflare.com',        'Cloudflare'],
  ['cloudfront.net',        'AWS CloudFront'],
  ['amazonaws.com',         'AWS S3'],
  ['googleusercontent.com', 'Google Cloud'],
  ['storage.googleapis.com','Google Cloud Storage'],
  ['firebasestorage',       'Firebase Storage'],
  ['azureedge.net',         'Azure CDN'],
  ['azurefd.net',           'Azure Front Door'],
  ['blob.core.windows.net', 'Azure Blob Storage'],
  ['b-cdn.net',             'Bunny CDN'],
  ['bunnycdn.com',          'Bunny CDN'],
  ['bunny.net',             'Bunny CDN'],
  ['kxcdn.com',             'KeyCDN'],
  ['ucarecdn.com',          'Uploadcare'],
  ['uploadcare.com',        'Uploadcare'],
  ['storyblok.com',         'Storyblok CDN'],
  ['a.storyblok',           'Storyblok CDN'],
  ['ctfassets.net',         'Contentful CDN'],
  ['cdn.shopify.com',       'Shopify CDN'],
  ['shopifycdn.com',        'Shopify CDN'],
  ['i0.wp.com',             'Jetpack CDN (WordPress)'],
  ['i1.wp.com',             'Jetpack CDN (WordPress)'],
  ['i2.wp.com',             'Jetpack CDN (WordPress)'],
  ['wp.com',                'WordPress CDN'],
  ['wixstatic.com',         'Wix CDN'],
  ['squarespace-cdn.com',   'Squarespace CDN'],
  ['sqspcdn.com',           'Squarespace CDN'],
  ['cdn.sanity.io',         'Sanity CDN'],
  ['prismic.io',            'Prismic CDN'],
  ['framerusercontent.com', 'Framer CDN'],
  ['webflow.com',           'Webflow CDN'],
  ['cdn.prod.website-files','Webflow CDN'],
  ['datocms-assets.com',    'DatoCMS CDN'],
  ['graphassets.com',       'Hygraph CDN'],
  ['arthrex.io',            'Cloudinary'],   // cdn.arthrex.io is Cloudinary
  ['.graphassets.com',      'Hygraph CDN'],
  ['graphcms-assets.com',   'Hygraph CDN'],
  ['media.graphassets.com', 'Hygraph CDN'],
  ['assets.graphassets.com','Hygraph CDN'],
  ['hygraph.com',           'Hygraph CDN'],
  ['graphcms.com',          'GraphCMS CDN'],
  ['bfldr.com',             'Brandfolder CDN'],
  ['images.unsplash.com',   'Unsplash CDN'],
  ['cdn.prod.website-files.com','Webflow CDN'],
  ['assets.website-files.com', 'Webflow CDN'],
  ['cdn77.org',             'CDN77'],
  ['edgecastcdn.net',       'Edgecast CDN'],
  ['limelight.com',         'Limelight CDN'],
  ['stackpathcdn.com',      'StackPath CDN'],
];

// ── DAM URL patterns ──────────────────────────────────────────────────────────
const DAM_URL_PATTERNS = [
  ['bynder.com',            'Bynder DAM'],
  ['bynder',                'Bynder DAM'],
  ['widen.net',             'Widen / Acquia DAM'],
  ['widencdn.net',          'Widen / Acquia DAM'],
  ['canto.com',             'Canto DAM'],
  ['canto.de',              'Canto DAM'],
  ['brandfolder.com',       'Brandfolder DAM'],
  ['mediavalet.com',        'MediaValet DAM'],
  ['nuxeo.com',             'Nuxeo DAM'],
  ['aprimo.com',            'Aprimo DAM'],
  ['salsify.com',           'Salsify DAM'],
  ['celum.com',             'Celum DAM'],
  ['intelligencebank.com',  'IntelligenceBank DAM'],
  ['webdam.com',            'Webdam DAM'],
  ['frontify.com',          'Frontify DAM'],
  ['pimcore.com',           'Pimcore DAM'],
  ['openasset.com',         'OpenAsset DAM'],
  ['photoshelter.com',      'PhotoShelter DAM'],
  ['filecamp.com',          'Filecamp DAM'],
  ['thirdlight.com',        'Third Light DAM'],
  ['lytho.com',             'Lytho DAM'],
  ['assetbank.co.uk',       'Asset Bank DAM'],
  ['/content/dam/',         'Adobe AEM DAM'],
  ['/dam/',                 'DAM System'],
  ['scene7.com',            'Adobe Experience Manager DAM'],
];

// ── Tech stack patterns from image URLs ───────────────────────────────────────
// These identify what platform/CMS/ecomm the site is built on
const TECH_STACK_PATTERNS = [
  // E-commerce platforms
  ['cdn.shopify.com',           'Shopify'],
  ['shopifycdn.com',            'Shopify'],
  ['/cdn/shop/',                'Shopify'],
  ['myshopify.com',             'Shopify'],
  ['bigcommerce.com',           'BigCommerce'],
  ['bcapp.io',                  'BigCommerce'],
  ['demandware.net',            'Salesforce Commerce Cloud'],
  ['demandware.edgesuite.net',  'Salesforce Commerce Cloud'],
  ['commercecloud.salesforce',  'Salesforce Commerce Cloud'],
  ['magento',                   'Magento'],
  ['woocommerce',               'WooCommerce'],
  ['wc-',                       'WooCommerce'],
  ['squarespace-cdn.com',       'Squarespace'],
  ['sqspcdn.com',               'Squarespace'],
  ['wixstatic.com',             'Wix'],
  ['wix.com',                   'Wix'],
  // CMS platforms
  ['/wp-content/',              'WordPress'],
  ['/wp-includes/',             'WordPress'],
  ['wordpress.com',             'WordPress'],
  ['i0.wp.com',                 'WordPress (Jetpack)'],
  ['ghost.io',                  'Ghost CMS'],
  ['ghost.org',                 'Ghost CMS'],
  ['contentful',                'Contentful CMS'],
  ['ctfassets.net',             'Contentful CMS'],
  ['prismic.io',                'Prismic CMS'],
  ['storyblok.com',             'Storyblok CMS'],
  ['datocms',                   'DatoCMS'],
  ['sanity.io',                 'Sanity CMS'],
  ['cdn.sanity.io',             'Sanity CMS'],
  ['/content/dam/',             'Adobe Experience Manager'],
  ['scene7.com',                'Adobe Experience Manager'],
  ['drupal',                    'Drupal CMS'],
  ['sites/default/files',       'Drupal CMS'],
  ['craft',                     'Craft CMS'],
  ['kentico',                   'Kentico CMS'],
  ['sitecore',                  'Sitecore CMS'],
  ['episerver',                 'Optimizely (Episerver)'],
  ['optimizely.com',            'Optimizely'],
  // Web builders
  ['webflow.com',               'Webflow'],
  ['cdn.prod.website-files',    'Webflow'],
  ['framerusercontent.com',     'Framer'],
  ['bubble.io',                 'Bubble'],
  ['cargo.site',                'Cargo'],
  ['format.com',                'Format'],
  ['smugmug.com',               'SmugMug'],
  // Cloud / hosting
  ['storage.googleapis.com',    'Google Cloud Storage'],
  ['firebasestorage',           'Firebase'],
  ['googleusercontent.com',     'Google Cloud'],
  ['amazonaws.com',             'AWS'],
  ['cloudfront.net',            'AWS CloudFront'],
  ['s3.amazonaws',              'AWS S3'],
  ['blob.core.windows.net',     'Azure'],
  ['azureedge.net',             'Azure CDN'],
  // Marketing / analytics platforms
  ['hubspot.com',               'HubSpot'],
  ['hs-sites.com',              'HubSpot CMS'],
  ['hsappstatic.net',           'HubSpot'],
  ['pardot.com',                'Salesforce Pardot'],
  ['marketo.com',               'Marketo'],
  // Media & image platforms
  ['mux.com',                   'Mux Video'],
  ['cloudflare-stream.com',     'Cloudflare Stream'],
  ['imgix.net',                 'Imgix'],
  ['cloudinary.com',            'Cloudinary'],
  ['imagekit.io',               'ImageKit'],
  ['gumlet.io',                 'Gumlet'],
  ['uploadcare.com',            'Uploadcare'],
  ['sirv.com',                  'Sirv'],
  // Social / embeds
  ['instagram.com',             'Instagram Embed'],
  ['cdninstagram.com',          'Instagram CDN'],
  ['twimg.com',                 'Twitter/X CDN'],
  ['fbcdn.net',                 'Facebook CDN'],
  ['pinimg.com',                'Pinterest CDN'],
];

// ── Server header patterns ────────────────────────────────────────────────────
const SERVER_PATTERNS = [
  ['imgix',         'Imgix'],
  ['cloudinary',    'Cloudinary'],
  ['imagekit',      'ImageKit'],
  ['gumlet',        'Gumlet'],
  ['scene7',        'Scene7'],
  ['cloudflare',    'Cloudflare'],
  ['cloudfront',    'AWS CloudFront'],
  ['cloudfront.net','AWS CloudFront'],
  ['(cloudfront)',  'AWS CloudFront'],
  ['akamai',        'Akamai'],
  ['fastly',        'Fastly'],
  ['bunny',         'Bunny CDN'],
  ['varnish',       'Varnish'],
  ['nginx',         'Nginx'],
  ['apache',        'Apache'],
  ['litespeed',     'LiteSpeed'],
  ['openresty',     'OpenResty'],
  ['vercel',        'Vercel'],
  ['netlify',       'Netlify'],
  ['amazons3',      'AWS S3'],
  ['windows-azure', 'Azure'],
];

// ── CDN priority (specific beats generic) ────────────────────────────────────
const CDN_PRIORITY = {
  'Imgix':10,'Cloudinary':10,'ImageKit':10,'Gumlet':10,
  'Scene7 (Adobe DM)':10,'Cloudimage':10,'ImageEngine':10,'Sirv':10,'Twicpics':10,'Uploadcare':10,
  'Storyblok CDN':9,'Contentful CDN':9,'Sanity CDN':9,'Prismic CDN':9,
  'Shopify CDN':8,'Jetpack CDN (WordPress)':7,'WordPress CDN':7,'Wix CDN':7,'Squarespace CDN':7,
  'Framer CDN':7,'Webflow CDN':7,'DatoCMS CDN':7,
  'Firebase Storage':6,'Google Cloud Storage':6,'AWS S3':6,'Azure Blob Storage':6,
  'Bunny CDN':5,'KeyCDN':5,
  'AWS CloudFront':4,'Akamai':4,'Fastly':4,'Azure CDN':4,'Azure Front Door':4,
  'Cloudflare':2,
  'Nginx':1,'Apache':1,'LiteSpeed':1,'Varnish':1,
};
function getCDNPriority(name) { return CDN_PRIORITY[name] || 3; }

// ── DNS CNAME patterns — identify CDN from DNS records (like dig) ────────────
// Maps CNAME suffixes to CDN names — same as running dig on the domain
const DNS_CDN_PATTERNS = [
  // Akamai
  ['edgekey.net',           'Akamai'],
  ['edgesuite.net',         'Akamai'],
  ['akamaiedge.net',        'Akamai'],
  ['akamaihd.net',          'Akamai'],
  ['akadns.net',            'Akamai'],
  ['akamai.net',            'Akamai'],
  ['akamaized.net',         'Akamai'],
  // AWS CloudFront
  ['cloudfront.net',        'AWS CloudFront'],
  // Fastly
  ['fastly.net',            'Fastly'],
  ['fastlylb.net',          'Fastly'],
  ['freetls.fastly.net',    'Fastly'],
  // Cloudflare
  ['cdn.cloudflare.net',    'Cloudflare'],
  ['cloudflare.net',        'Cloudflare'],
  // Azure
  ['azureedge.net',         'Azure CDN'],
  ['azurefd.net',           'Azure Front Door'],
  ['trafficmanager.net',    'Azure Traffic Manager'],
  ['azurewebsites.net',     'Azure'],
  // Bunny CDN
  ['b-cdn.net',             'Bunny CDN'],
  // Imgix
  ['imgix.net',             'Imgix'],
  // Cloudinary
  ['cloudinary.com',        'Cloudinary'],
  // KeyCDN
  ['kxcdn.com',             'KeyCDN'],
  // CDN77
  ['rsc.cdn77.org',         'CDN77'],
  ['cdn77.org',             'CDN77'],
  // Limelight / Edgio
  ['llnwd.net',             'Limelight / Edgio'],
  ['edgio.net',             'Edgio'],
  ['cachefly.net',          'CacheFly'],
  // Vercel
  ['vercel.app',            'Vercel'],
  ['vercel-dns.com',        'Vercel'],
  // Netlify
  ['netlify.app',           'Netlify'],
  ['netlify.com',           'Netlify'],
  // Shopify
  ['myshopify.com',         'Shopify CDN'],
  ['shopify.com',           'Shopify CDN'],
  // Wix
  ['wixdns.net',            'Wix CDN'],
  // Squarespace
  ['squarespace.com',       'Squarespace CDN'],
  // StackPath
  ['stackpathcdn.com',      'StackPath CDN'],
  ['hwcdn.net',             'StackPath CDN'],
  // Sucuri
  ['sucuri.net',            'Sucuri / Cloudproxy'],
  // Imperva
  ['incapdns.net',          'Imperva CDN'],
  // Verizon / Edgecast
  ['edgecastcdn.net',       'Edgecast / Verizon'],
  ['systemcdn.net',         'Edgecast / Verizon'],
  // BrightEdge / others
  ['georedirect.net',       'Geo Redirect CDN'],
  ['zenedge.net',           'Oracle Dyn CDN'],
];

async function dnsLookupCDN(hostname) {
  // Use DNS-over-HTTPS to resolve CNAME chain (same as: dig <hostname>)
  hostname = hostname.replace(/^www\./, '');
  console.log(`[DNS] Looking up CNAME for: ${hostname}`);

  // Try Cloudflare DoH first, then Google DoH as fallback
  const endpoints = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`,
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=CNAME`,
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) {
        console.log(`[DNS] HTTP ${r.status} from ${new URL(url).hostname}`);
        continue;
      }
      const data = await r.json();

      const answers = (data.Answer || []).filter(a => a.type === 5); // CNAME = type 5
      if (answers.length === 0) {
        console.log(`[DNS] No CNAME records for ${hostname}`);
        break; // No point trying fallback
      }

      for (const ans of answers) {
        const cname = (ans.data || '').toLowerCase().replace(/\.$/, '');
        for (const [pattern, cdn] of DNS_CDN_PATTERNS) {
          if (cname.endsWith(pattern.toLowerCase()) || cname.includes(pattern.toLowerCase())) {
            console.log(`[DNS] ✅ ${hostname} → ${cname} → ${cdn}`);
            return { cdn, cname };
          }
        }
        console.log(`[DNS] CNAME found but no CDN match: ${cname}`);
      }
      break; // Got a valid response, no fallback needed
    } catch (e) {
      console.log(`[DNS] Error: ${e.message}`);
    }
  }
  return null;
}


// ── Detection helpers ─────────────────────────────────────────────────────────
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

function detectTechStackFromUrl(url) {
  const lower = url.toLowerCase();
  const found = new Set();
  for (const [pattern, name] of TECH_STACK_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) found.add(name);
  }
  return [...found];
}

function detectFromServerHeader(headers = {}) {
  const str = [
    headers['server'], headers['x-server'], headers['x-served-by'],
    headers['via'], headers['x-cache'], headers['x-cdn'], headers['x-powered-by'],
  ].filter(Boolean).join(' ').toLowerCase();
  for (const [pattern, name] of SERVER_PATTERNS) {
    if (str.includes(pattern.toLowerCase())) return name;
  }
  return null;
}

function extractServerHeader(headers = {}) {
  // Build a meaningful server string from all relevant headers
  // This is what shows in the Server column in the sheet
  const parts = [];
  if (headers['server'])        parts.push(headers['server']);
  if (headers['x-server'])      parts.push(headers['x-server']);
  if (headers['x-served-by'])   parts.push(headers['x-served-by']);
  // Via often contains the real CDN: "1.1 59baab.cloudfront.net (CloudFront)"
  if (headers['via'])           parts.push(headers['via']);
  // X-Cache tells us hit/miss and from which CDN: "Hit from cloudfront"
  if (headers['x-cache'])       parts.push(headers['x-cache']);
  if (headers['x-cdn'])         parts.push(headers['x-cdn']);
  return parts.length > 0 ? parts.join(' | ') : null;
}

function normalise(raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { new URL(raw); return raw; } catch { return null; }
}

// Only real content image types — no SVG logos, GIFs, ICO favicons, BMP
const IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif',
];
// Also check URL extension as a fallback when content-type is missing/wrong
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif)(\?|$|#)/i;
function isImgCT(ct = '') { return IMAGE_TYPES.some(t => ct.toLowerCase().includes(t)); }
function isContentImage(url = '', ct = '') {
  return isImgCT(ct) || IMAGE_EXTENSIONS.test(url);
}

// ── Excluded URLs ────────────────────────────────────────────────────────────
// Block: bot challenges, trackers, ad pixels, social media pixels,
// third-party analytics — anything that doesn't belong to the target site
const EXCLUDED_URL_PATTERNS = [
  // Cloudflare bot protection
  /challenges\.cloudflare\.com/i,
  /cdn-cgi\/challenge/i,
  /cdn-cgi\//i,
  /cdnjs\.cloudflare\.com/i,
  // Tracking pixels & analytics
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /\.wp\.com\/g\.gif/i,
  /\/beacon\./i,
  /\/track\//i,
  /\/pixel\//i,
  /\/collect\?/i,
  /g\.gif/i,
  /spacer\.gif/i,
  /blank\.gif/i,
  /pixel\.gif/i,
  /1x1\.gif/i,
  /\/favicon\.ico/i,
  // LinkedIn trackers
  /px\.ads\.linkedin\.com/i,
  /linkedin\.com\/px/i,
  /\/li\.lms-analytics/i,
  /snap\.licdn\.com/i,
  // Social media pixels
  /facebook\.com\/tr/i,
  /connect\.facebook\.net/i,
  /\.fbcdn\.net/i,
  /t\.co\/i/i,
  /analytics\.twitter\.com/i,
  /ct\.pinterest\.com/i,
  /sc-static\.net/i,
  /tiktok\.com/i,
  // HubSpot / marketing trackers
  /hubspot\.com\/__ptq/i,
  /track\.hubspot/i,
  /js\.hs-analytics\.net/i,
  /\.hubspot\.com/i,
  // Ad networks
  /doubleclick\.net/i,
  /googlesyndication\.com/i,
  /googleadservices\.com/i,
  /adsystem\.com/i,
  /amazon-adsystem\.com/i,
  /moatads\.com/i,
  /criteo\.com/i,
  /adnxs\.com/i,
  /rubiconproject\.com/i,
  /pubmatic\.com/i,
  /openx\.net/i,
  /insight_tag_errors/i,
  // Other third-party tracking
  /\.hotjar\.com/i,
  /\.segment\.com/i,
  /\.amplitude\.com/i,
  /\.mixpanel\.com/i,
  /\.intercom\.io/i,
  /\.clarity\.ms/i,
  /bat\.bing\.com/i,
  /\.omtrdc\.net/i,     // Adobe Analytics
  /\.demdex\.net/i,     // Adobe Audience Manager
  /\/v1\/rum/i,         // Real User Monitoring pixels
];
function isExcludedUrl(url) { return EXCLUDED_URL_PATTERNS.some(p => p.test(url)); }

// ── Third-party domain filter ─────────────────────────────────────────────────
// Only trust image URLs that plausibly belong to the target site:
// - Same root domain (ashleyfurniture.com → ashley*.com subdomains)
// - OR a recognised CDN/DAM pattern (imgix, cloudinary, graphassets etc.)
// This prevents ad pixels, LinkedIn trackers, social embeds from being counted
const ALWAYS_TRUSTED_CDN_HOSTS = [
  'imgix.net','cloudinary.com','imagekit.io','gumlet.io','scene7.com',
  'cloudimage.io','imageengine.io','sirv.com','twicpics.com','fastly.net',
  'akamaized.net','cloudfront.net','amazonaws.com','azureedge.net',
  'azurefd.net','windows.net','b-cdn.net','bunnycdn.com','bunny.net',
  'kxcdn.com','ucarecdn.com','shopify.com','shopifycdn.com',
  'squarespace-cdn.com','sqspcdn.com','wixstatic.com','wp.com',
  'ctfassets.net','sanity.io','storyblok.com','prismic.io',
  'datocms-assets.com','graphassets.com','graphcms-assets.com',
  'hygraph.com','framerusercontent.com','webflow.com','website-files.com',
  'googleusercontent.com','googleapis.com','firebasestorage.googleapis.com',
];

function isFromTrustedOrSameDomain(imgUrl, targetUrl) {
  try {
    const imgHost    = new URL(imgUrl).hostname.toLowerCase();
    const targetHost = new URL(targetUrl).hostname.toLowerCase();

    // Get root domain (last 2 parts: ashleyfurniture.com, not www.)
    const getRootDomain = h => h.split('.').slice(-2).join('.');
    const targetRoot = getRootDomain(targetHost);
    const imgRoot    = getRootDomain(imgHost);

    // Same root domain — always trust
    if (imgRoot === targetRoot) return true;

    // Known CDN/image delivery host — always trust
    if (ALWAYS_TRUSTED_CDN_HOSTS.some(cdn => imgHost.endsWith(cdn))) return true;

    // img host contains target brand name (e.g. "ashley" in "us-east-1-ashley.graphassets.com")
    const brand = targetRoot.split('.')[0].replace(/-/g, '');
    if (brand.length > 3 && imgHost.includes(brand)) return true;

    return false;
  } catch { return false; }
}

// ── Cookie texts ──────────────────────────────────────────────────────────────
const COOKIE_TEXTS = [
  'accept all','accept','allow all','allow cookies','accept cookies',
  'i agree','agree','got it','continue','ok','okay','yes, i agree',
  'confirm my choices','save preferences','allow','accept & continue',
  'agree & continue','accept all cookies','allow all cookies',
  'understand','dismiss','consent','continue shopping',
];

// ── Inner page priority patterns ──────────────────────────────────────────────
const INNER_PAGE_PRIORITY = [
  // Priority 5 — product/shop/category (richest images)
  { score: 5, re: /\/(shop|store|products?|collections?|catalogue|catalog|category|categories|range|ranges|buy)/i },
  // Priority 4 — portfolio/gallery
  { score: 4, re: /\/(portfolio|gallery|galleries|work|projects?|case-studies|showcase)/i },
  // Priority 3 — solutions/services/features
  { score: 3, re: /\/(solutions?|services?|features?|platform|offerings?|industries)/i },
  // Priority 2 — about/team/news
  { score: 2, re: /\/(about|team|news|press|media|resources?|insights?|blog)/i },
  // Priority 1 — any other inner page
  { score: 1, re: /.+/ },
];
const SKIP_PATHS = /\/(login|signin|sign-in|signup|sign-up|register|cart|checkout|account|logout|admin|api|cdn|static|assets|wp-admin|wp-json|sitemap|feed|rss|robots)/i;

// ── Crawl a single site ───────────────────────────────────────────────────────
async function crawlSite(browser, rawUrl) {
  const url = normalise(rawUrl);
  if (!url) return {
    cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available',
    techStack: '', matchedUrl: '', confidence: 'Low',
    detail: 'Invalid URL', reason: 'Invalid or missing URL',
  };

  // ── Collected signals ─────────────────────────────────────────────────────
  let networkImageCount = 0;  // images from Network tab (Img filter)
  let domImageCount     = 0;  // images from Elements tab (DOM)
  let done              = false;

  let cdnFromUrl   = null;
  let cdnFromDNS   = null;  // CDN detected via DNS CNAME lookup
  let cnameRecord  = null;  // raw CNAME chain from DNS
  let dnsPromise   = Promise.resolve(); // declared here so catch block can always await it
  let serverHeader = null;
  let serverCDN    = null;
  let damFromUrl   = null;
  let matchedUrl   = null;
  let bestImageUrl = null;
  let largestImageUrl = null;   // URL of the largest image seen (by Content-Length)
  let largestImageSize = 0;     // bytes
  const techStackSet = new Set();

  // ── Endpoint (domain) tracker ─────────────────────────────────────────────
  // Counts how many content images come from each hostname
  // The majority domain = the real image serving infrastructure
  const endpointCounts = {};   // { 'images.xyz.com': 12, 'cdn.abc.com': 3 }
  const endpointCDN    = {};   // { 'images.xyz.com': 'Cloudinary' }

  function trackEndpoint(imgUrl, cdnName) {
    try {
      const host = new URL(imgUrl).hostname;
      endpointCounts[host] = (endpointCounts[host] || 0) + 1;
      if (cdnName && !endpointCDN[host]) endpointCDN[host] = cdnName;
    } catch { /* ignore */ }
  }

  // Find the endpoint with the most images
  function getMajorityEndpoint() {
    let topHost = null, topCount = 0;
    for (const [host, count] of Object.entries(endpointCounts)) {
      if (count > topCount) { topCount = count; topHost = host; }
    }
    return topHost ? { host: topHost, count: topCount, cdn: endpointCDN[topHost] || null } : null;
  }

  let page;

  // ── Process a single image URL (shared between DOM and Network scans) ─────
  function processImageUrl(imgUrl, source) {
    if (!imgUrl || isExcludedUrl(imgUrl)) return;

    // ── Domain trust filter — only process images from the target site or known CDNs ──
    // Blocks LinkedIn pixels, Facebook trackers, ad networks, social embeds
    if (!isFromTrustedOrSameDomain(imgUrl, url)) return;

    // DOM scan: only keep jpg/jpeg/png/webp/avif — no SVG/GIF/ICO
    if (source === 'dom') {
      if (!/\.(jpe?g|png|webp|avif)(\?|$|#)/i.test(imgUrl)) return;
      if (/logo|icon|sprite|favicon|badge|flag|arrow|bullet|avatar/i.test(imgUrl) &&
          !/product|photo|image|img|banner|hero|background/i.test(imgUrl)) return;
    }

    // CDN detection
    const urlCDN = detectCDNFromUrl(imgUrl);
    if (urlCDN) {
      const newP = getCDNPriority(urlCDN);
      const curP = cdnFromUrl ? getCDNPriority(cdnFromUrl) : -1;
      if (newP > curP) {
        cdnFromUrl = urlCDN;
        if (!isExcludedUrl(imgUrl)) matchedUrl = imgUrl;
      } else if (newP === curP && !matchedUrl) {
        matchedUrl = imgUrl;
      }
    }

    // DAM detection
    const dam = detectDAMFromUrl(imgUrl);
    if (dam && !damFromUrl) damFromUrl = dam;

    // Tech stack detection
    const stacks = detectTechStackFromUrl(imgUrl);
    stacks.forEach(s => techStackSet.add(s));

    // Track best real content image for fallback URL
    if (imgUrl.startsWith('http') && !isExcludedUrl(imgUrl)) {
      const isContent = /\.(jpg|jpeg|png|webp|gif|avif)/i.test(imgUrl) &&
        !/favicon|icon|logo|pixel|spacer|blank|1x1|sprite/i.test(imgUrl);
      if (!bestImageUrl || isContent) bestImageUrl = imgUrl;
    }
  }

  try {
    page = await browser.newPage();

    await page.setBypassCSP(true);
    await page._client().send('Security.setIgnoreCertificateErrors', { ignore: true }).catch(() => {});

    // Consistent UA per domain
    const domain = new URL(url).hostname;
    const UAS = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
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
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      window.chrome = { runtime: {}, app: { isInstalled: false } };
      try {
        const getParam = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(p) {
          if (p === 37445) return 'Intel Inc.';
          if (p === 37446) return 'Intel Iris OpenGL Engine';
          return getParam.call(this, p);
        };
      } catch(e) {}
      Object.defineProperty(window, 'outerWidth',  { get: () => 1920 });
      Object.defineProperty(window, 'outerHeight', { get: () => 1080 });
    });

    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    // ── DNS lookup — runs in parallel with page load ───────────────────────
    // Resolves CNAME chain to identify CDN (like running dig on the domain)
    dnsPromise = dnsLookupCDN(new URL(url).hostname).then(result => {
      if (result) {
        cdnFromDNS  = result.cdn;
        cnameRecord = result.cname;
        console.log(`[DNS] CDN from CNAME: ${cdnFromDNS} (${cnameRecord})`);
      }
    }).catch(() => {});
    await page.setRequestInterception(true);

    const BLOCK_TYPES = new Set(['font','media','websocket','eventsource','manifest']);
    const BLOCK_DOMAINS = ['google-analytics.com','googletagmanager.com','doubleclick.net',
      'facebook.net','hotjar.com','segment.com','intercom.io','clarity.ms',
      'mouseflow.com','fullstory.com','mixpanel.com'];

    page.on('request', req => {
      const rt = req.resourceType();
      const rUrl = req.url();
      if (BLOCK_TYPES.has(rt)) { req.abort(); return; }
      if (BLOCK_DOMAINS.some(d => rUrl.includes(d))) { req.abort(); return; }
      if (done && rt === 'image') { req.abort(); return; }
      req.continue();
    });

    // ── NETWORK TAB SCAN: intercept all image responses ───────────────────────
    // Equivalent to DevTools → Network → Img filter
    page.on('response', async response => {
      if (done) return;
      try {
        const resUrl  = response.url();
        const status  = response.status();
        const headers = response.headers();
        const ct      = headers['content-type'] || '';
        const rt      = response.request().resourceType();

        // Check ALL responses for DAM/tech signals
        const dam = detectDAMFromUrl(resUrl);
        if (dam && !damFromUrl) damFromUrl = dam;
        detectTechStackFromUrl(resUrl).forEach(s => techStackSet.add(s));

        // Only process real content images (JPEG/PNG/WebP/AVIF) — skip SVG/GIF/ICO
        const isRealImage = (rt === 'image' || isContentImage(resUrl, ct));
        if (!isRealImage || status < 200 || status >= 400) return;
        // Extra filter: skip logos/icons/sprites
        if (/logo|icon|sprite|favicon|badge|flag|arrow|bullet|avatar/i.test(resUrl) &&
            !/product|photo|image|img|banner|hero|background/i.test(resUrl)) return;

        // Domain trust filter — skip third-party trackers, ad pixels, social embeds
        if (!isFromTrustedOrSameDomain(resUrl, url)) return;

        networkImageCount++;
        if (networkImageCount > MAX_IMAGES) {
          done = true;
          page.evaluate(() => window.stop()).catch(() => {});
          return;
        }

        // Extract server header from image response
        const rawSvr = extractServerHeader(headers);
        if (rawSvr && !serverHeader) serverHeader = rawSvr;
        const svrCDN = detectFromServerHeader(headers);
        if (svrCDN && !serverCDN) serverCDN = svrCDN;

        // Track image size from Content-Length header
        const contentLength = parseInt(headers['content-length'] || '0', 10);
        if (contentLength > largestImageSize) {
          largestImageSize = contentLength;
          largestImageUrl  = resUrl;
        }

        // Track endpoint (hostname) counts
        const urlCDNForEndpoint = detectCDNFromUrl(resUrl);
        trackEndpoint(resUrl, urlCDNForEndpoint);

        // Process the image URL
        processImageUrl(resUrl, 'network');

        // Early stop if high-priority CDN found
        if (cdnFromUrl && matchedUrl && getCDNPriority(cdnFromUrl) >= 8) {
          done = true;
          console.log(`[CDN] ✅ ${cdnFromUrl} via Network tab on image #${networkImageCount}`);
          page.evaluate(() => window.stop()).catch(() => {});
        }
      } catch { /* ignore */ }
    });

    // ── Helper: navigate with fallback chain ──────────────────────────────────
    async function navigateTo(targetUrl) {
      const attempts = [
        { url: targetUrl,                               opts: { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT } },
        { url: targetUrl,                               opts: { waitUntil: 'load',             timeout: 20000 } },
        { url: targetUrl.replace(/^https:/i, 'http:'), opts: { waitUntil: 'domcontentloaded', timeout: 18000 } },
        { url: targetUrl.replace(/^https:/i, 'http:'), opts: { waitUntil: 'load',             timeout: 15000 } },
      ];
      let lastErr = null;
      for (const a of attempts) {
        if (done) return true;
        try { await page.goto(a.url, a.opts); return true; }
        catch (e) { lastErr = e; if (networkImageCount > 0 || serverHeader) return true; }
      }
      throw lastErr || new Error('Navigation failed');
    }

    // ── Helper: dismiss cookie banners ────────────────────────────────────────
    async function dismissCookies() {
      try {
        await page.evaluate((texts) => {
          for (const el of document.querySelectorAll('button, a, [role="button"]')) {
            if (texts.includes(el.innerText?.toLowerCase().trim())) { el.click(); return; }
          }
        }, COOKIE_TEXTS);
        await new Promise(r => setTimeout(r, 500));
      } catch { /* ignore */ }
    }

    // ── Helper: human-like scroll ─────────────────────────────────────────────
    async function humanScroll(maxPx) {
      try {
        await page.mouse.move(400 + Math.random()*400, 300 + Math.random()*200);
        await new Promise(r => setTimeout(r, 150 + Math.random()*200));
        await page.evaluate(async (px) => {
          await new Promise(res => {
            let total = 0;
            const t = setInterval(() => {
              window.scrollBy(0, 200 + Math.floor(Math.random()*200));
              total += 300;
              if (total >= px) { clearInterval(t); res(); }
            }, 80 + Math.floor(Math.random()*60));
          });
        }, maxPx);
        await new Promise(r => setTimeout(r, 800));
      } catch { /* page may have stopped */ }
    }

    // ── Helper: DOM ELEMENTS SCAN ─────────────────────────────────────────────
    // Equivalent to DevTools → Elements tab — scans all image URLs in the DOM
    async function scanDOMElements() {
      try {
        const domUrls = await page.evaluate(() => {
          const urls = new Set();
          const base = window.location.origin;

          // 1. <img> src, srcset, data-src, data-lazy-src, data-original
          document.querySelectorAll('img').forEach(img => {
            ['src','srcset','data-src','data-lazy-src','data-original',
             'data-srcset','data-lazy','data-bg','data-background'].forEach(attr => {
              const val = img.getAttribute(attr);
              if (val) val.split(',').forEach(p => {
                const u = p.trim().split(/\s+/)[0];
                if (u && u.startsWith('http')) urls.add(u);
              });
            });
          });

          // 2. <source> srcset (picture element)
          document.querySelectorAll('source').forEach(src => {
            const val = src.getAttribute('srcset') || src.getAttribute('data-srcset') || '';
            val.split(',').forEach(p => {
              const u = p.trim().split(/\s+/)[0];
              if (u && u.startsWith('http')) urls.add(u);
            });
          });

          // 3. CSS background-image in style attributes
          document.querySelectorAll('[style]').forEach(el => {
            const style = el.getAttribute('style') || '';
            const matches = style.match(/url\(['"]?(https?[^'")\s]+)['"]?\)/gi) || [];
            matches.forEach(m => {
              const u = m.replace(/url\(['"]?/i,'').replace(/['"]?\)$/,'');
              if (u.startsWith('http')) urls.add(u);
            });
          });

          // 4. Inline <style> blocks — background-image declarations
          document.querySelectorAll('style').forEach(styleEl => {
            const text = styleEl.textContent || '';
            const matches = text.match(/url\(['"]?(https?[^'")\s]+)['"]?\)/gi) || [];
            matches.forEach(m => {
              const u = m.replace(/url\(['"]?/i,'').replace(/['"]?\)$/,'');
              if (u.startsWith('http')) urls.add(u);
            });
          });

          // 5. Computed styles — gets background images set via CSS classes
          document.querySelectorAll('div, section, article, header, span, a').forEach(el => {
            try {
              const bg = window.getComputedStyle(el).backgroundImage;
              if (bg && bg !== 'none') {
                const m = bg.match(/url\(['"]?(https?[^'")\s]+)['"]?\)/);
                if (m && m[1]) urls.add(m[1]);
              }
            } catch { /* ignore */ }
          });

          // 6. <script> JSON blobs — only jpg/jpeg/png/webp/avif (not svg/gif)
          document.querySelectorAll('script').forEach(s => {
            const text = s.textContent || '';
            const matches = text.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif)[^\s"'<>]*/gi) || [];
            matches.forEach(u => urls.add(u));
          });

          // 7. data-* attributes on any element (lazy loaders use these)
          document.querySelectorAll('[data-image],[data-img],[data-background-image],[data-bg-image]').forEach(el => {
            ['data-image','data-img','data-background-image','data-bg-image'].forEach(attr => {
              const val = el.getAttribute(attr);
              if (val && val.startsWith('http')) urls.add(val);
            });
          });

          return [...urls].slice(0, 300);
        });

        console.log(`[CDN] DOM scan found ${domUrls.length} image URLs`);

        for (const imgUrl of domUrls) {
          if (done) break;
          domImageCount++;
          processImageUrl(imgUrl, 'dom');

          // Early stop if high-priority CDN found from DOM
          if (cdnFromUrl && matchedUrl && getCDNPriority(cdnFromUrl) >= 8) {
            done = true;
            console.log(`[CDN] ✅ ${cdnFromUrl} via DOM Elements scan`);
            break;
          }
        }
      } catch { /* ignore */ }
    }

    // ── Helper: find inner pages (category/product/portfolio) ─────────────────
    async function findInnerPages(baseUrl, limit = 3) {
      try {
        const base = new URL(baseUrl);
        // Get root domain — e.g. amway.com from www.amway.com
        // This way links work even when homepage redirects to www subdomain
        const rootDomain = base.hostname.replace(/^www\./, '');

        const links = await page.evaluate((rootDomain) => {
          const currentRoot = window.location.hostname.replace(/^www\./, '');
          return Array.from(document.querySelectorAll('a[href]'))
            .map(a => {
              try {
                const url = new URL(a.href, window.location.href);
                return url.href;
              } catch { return null; }
            })
            .filter(h => {
              if (!h) return false;
              try {
                const u = new URL(h);
                // Accept same root domain (with or without www, or subdomains)
                const hRoot = u.hostname.replace(/^www\./, '');
                return hRoot === rootDomain || hRoot.endsWith('.' + rootDomain);
              } catch { return false; }
            })
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 150);
        }, rootDomain);

        // Score and sort links
        const scored = [];
        for (const link of links) {
          let path;
          try { path = new URL(link).pathname; } catch { continue; }
          if (SKIP_PATHS.test(path)) continue;
          if (path === '/' || path === '') continue;
          if (path === new URL(baseUrl).pathname) continue; // skip current page

          let score = 0;
          for (const { score: s, re } of INNER_PAGE_PRIORITY) {
            if (re.test(path)) { score = s; break; }
          }
          if (score > 0) scored.push({ url: link, score, path });
        }

        scored.sort((a, b) => b.score - a.score);

        // Return top N unique pages, preferring different score levels
        const seen = new Set();
        const result = [];
        for (const item of scored) {
          if (seen.has(item.url)) continue;
          seen.add(item.url);
          result.push(item.url);
          if (result.length >= limit) break;
        }
        return result;
      } catch { return []; }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN CRAWL FLOW
    // ═══════════════════════════════════════════════════════════════════════════

    // ── PAGE DISCOVERY AND SCAN ───────────────────────────────────────────────
    // Strategy:
    // 1. Load homepage — collect navigation links + any image signals
    // 2. Extract all inner page links, score by image-richness priority
    // 3. Load the top-scoring inner page and do full dual scan (Network + DOM)
    // 4. If CDN not found, try a second inner page

    let lastNavError = null;
    let pagesScanned = 0;

    // ── Phase A: Load homepage to collect links ───────────────────────────────
    console.log(`[CDN] Loading homepage for inner page links: ${url}`);
    let innerPages = [];

    try {
      await navigateTo(url);
      await dismissCookies();
      await new Promise(r => setTimeout(r, 500));

      // Extract and score all inner page links
      innerPages = await findInnerPages(url, 8);
      console.log(`[CDN] Found ${innerPages.length} inner pages: ${innerPages.slice(0,4).join(', ')}`);

      // Reset — don't count homepage images toward results
      networkImageCount = 0;
      domImageCount = 0;
      // Keep server header + CDN signals from homepage if found — they're valid
    } catch (e) {
      lastNavError = e;
      console.log(`[CDN] Homepage failed: ${e.message}`);
    }

    // If homepage failed completely with no links found
    if (innerPages.length === 0 && lastNavError && networkImageCount === 0) {
      const errMsg = lastNavError.message || 'Unknown error';
      const reason = errMsg.includes('CERT') || errMsg.includes('SSL')
        ? `SSL/Certificate error: ${errMsg}`
        : errMsg.includes('timeout') || errMsg.includes('Timeout')
        ? `Page too slow to load (timeout after ${PAGE_TIMEOUT/1000}s)`
        : errMsg.includes('ERR_NAME_NOT_RESOLVED')
        ? `Domain not found (DNS error)`
        : errMsg.includes('ERR_CONNECTION_REFUSED')
        ? `Connection refused — site may be down`
        : `Could not open site: ${errMsg}`;
      await page.close().catch(() => {});
      return { cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', techStack: '', matchedUrl: '', confidence: 'Low', detail: reason, reason };
    }

    // ── Phase B: Full scan of top inner pages ────────────────────────────────
    // If no inner pages found, scan homepage itself as fallback
    const pagesToFullScan = innerPages.length > 0 ? innerPages.slice(0, 3) : [url];

    for (let pageIdx = 0; pageIdx < pagesToFullScan.length; pageIdx++) {
      if (done) break;

      const targetUrl = pagesToFullScan[pageIdx];
      console.log(`[CDN] Full scan ${pageIdx + 1}/${pagesToFullScan.length}: ${targetUrl}`);
      pagesScanned++;

      try {
        await navigateTo(targetUrl);
        await dismissCookies();
        await new Promise(r => setTimeout(r, AFTER_WAIT));

        // DOM scan — Elements tab equivalent
        await scanDOMElements();

        // Scroll — triggers lazy images captured by Network tab listener
        await humanScroll(SCROLL_PX);

        await new Promise(r => setTimeout(r, 500));

        console.log(`[CDN] Scan ${pageIdx + 1} done — Network: ${networkImageCount}, DOM: ${domImageCount}, CDN: ${cdnFromUrl || 'none'}`);

      } catch (e) {
        console.log(`[CDN] Scan ${pageIdx + 1} failed: ${e.message} — trying next`);
        continue;
      }

      // Stop early if high-confidence CDN found with a real URL
      if (done || (cdnFromUrl && getCDNPriority(cdnFromUrl) >= 8 && matchedUrl)) {
        console.log(`[CDN] High-confidence CDN found after ${pagesScanned} pages — stopping`);
        break;
      }
    }

  } catch (err) {
    if (page) await page.close().catch(() => {});
    return {
      cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available',
      techStack: '', matchedUrl: '', confidence: 'Low',
      detail: `Error: ${err.message}`, reason: `Browser error: ${err.message}`,
    };
  }

  await page.close().catch(() => {});
  await dnsPromise; // ensure DNS lookup is complete

  // ── Score and build result ────────────────────────────────────────────────
  const totalImages = networkImageCount + domImageCount;

  // ── Majority endpoint analysis ─────────────────────────────────────────────
  // The endpoint with the most images is the real CDN — more reliable than
  // the first CDN signal found
  const majorityEP = getMajorityEndpoint();
  let majorityHostCDN = null;
  if (majorityEP && majorityEP.count >= 3) {
    // Check if majority endpoint itself reveals CDN
    majorityHostCDN = majorityEP.cdn || detectCDNFromUrl('https://' + majorityEP.host + '/');
    console.log(`[CDN] Majority endpoint: ${majorityEP.host} (${majorityEP.count} images)${majorityHostCDN ? ' → ' + majorityHostCDN : ''}`);
  }

  // Priority: URL/majority CDN > DNS CDN > server CDN
  // URL-based detection is most accurate; DNS is a strong fallback
  let finalCDN;
  if (majorityHostCDN && cdnFromUrl) {
    finalCDN = getCDNPriority(majorityHostCDN) >= getCDNPriority(cdnFromUrl)
      ? majorityHostCDN : cdnFromUrl;
  } else {
    finalCDN = majorityHostCDN || cdnFromUrl || serverCDN || 'Not available';
  }
  // DNS CDN fills in when HTTP methods found nothing
  if (finalCDN === 'Not available' && cdnFromDNS) {
    finalCDN = cdnFromDNS;
    console.log(`[DNS] Using DNS CDN as fallback: ${finalCDN}`);
  }

  const finalDAM = damFromUrl || 'Not available';

  // Prefer: matched CDN URL → largest image URL → best content image URL
  const finalUrl = matchedUrl || largestImageUrl || bestImageUrl || '';

  // Log endpoint summary
  const epSummary = Object.entries(endpointCounts)
    .sort((a,b) => b[1]-a[1])
    .slice(0,3)
    .map(([h,c]) => `${h}(${c})`)
    .join(', ');
  if (epSummary) console.log(`[CDN] Endpoint breakdown: ${epSummary}`);

  // Tech stack — dedupe and join
  // Remove CDN names that are already in the CDN column to avoid repetition
  const cdnNames = new Set([finalCDN, serverCDN, damFromUrl].filter(Boolean).map(s => s.toLowerCase()));
  const techStackFinal = [...techStackSet]
    .filter(s => !cdnNames.has(s.toLowerCase()))
    .join(', ') || '';

  let confidence = 'Low';
  if (cdnFromUrl && serverHeader)   confidence = 'High';
  else if (cdnFromUrl || serverCDN) confidence = 'High';
  else if (damFromUrl)              confidence = 'Medium';

  let reason = '';
  if (finalCDN === 'Not available') {
    if (totalImages === 0)
      reason = 'No images loaded on inner pages — site may block crawlers or require login';
    else if (totalImages >= MAX_IMAGES)
      reason = `Checked ${MAX_IMAGES} images across inner pages — no known CDN patterns found`;
    else
      reason = `${totalImages} images scanned across inner pages — no CDN/DAM patterns detected`;
  }

  const detail = `Network: ${networkImageCount} imgs, DOM: ${domImageCount} imgs${cdnFromUrl ? ' | CDN: '+cdnFromUrl : ''}${serverHeader ? ' | Server: '+serverHeader : ''}${finalDAM !== 'Not available' ? ' | DAM: '+finalDAM : ''}${techStackFinal ? ' | Stack: '+techStackFinal : ''}`;

  return {
    cdnFromUrl:  finalCDN,
    server:      serverHeader || serverCDN || '',
    damFromUrl:  finalDAM,
    techStack:   techStackFinal,
    matchedUrl:  finalUrl,
    cdnFromDNS:  cdnFromDNS   || '',
    cnameRecord: cnameRecord   || '',
    confidence,
    detail,
    reason,
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
  if (!entries?.length) { send({ type: 'error', message: 'No entries' }); return res.end(); }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
             '--disable-gpu','--no-first-run','--no-zygote','--single-process',
             '--disable-blink-features=AutomationControlled','--ignore-certificate-errors'],
    });

    const queue = [...entries.map((e, i) => ({ ...e, i }))];
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
              send({ type: 'result', index: item.i, company: item.company, website: item.url,
                cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', techStack: '',
                matchedUrl: '', confidence: 'Low', detail: err.message, reason: err.message,
                done, total: entries.length });
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

// ── Single crawl endpoint ─────────────────────────────────────────────────────
app.post('/crawl', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
           '--disable-gpu','--no-first-run','--no-zygote','--single-process',
           '--disable-blink-features=AutomationControlled','--ignore-certificate-errors'],
  });

  try {
    const result = await crawlSite(browser, url);
    res.json(result);
  } catch (err) {
    res.json({ cdnFromUrl: 'Not available', server: '', damFromUrl: 'Not available', techStack: '', matchedUrl: '', confidence: 'Low', detail: err.message, reason: err.message });
  } finally {
    await browser.close().catch(() => {});
  }
});

app.options(['/crawl','/crawl-stream'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CDN Detector on port ${PORT}`));
