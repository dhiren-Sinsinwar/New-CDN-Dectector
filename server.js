const express = require('express');
let puppeteer = require('puppeteer');
try {
  const pe = require('puppeteer-extra');
  pe.use(require('puppeteer-extra-plugin-stealth')());
  puppeteer = pe;
  console.log('[init] puppeteer-extra stealth plugin enabled');
} catch (e) { console.log('[init] stealth plugin unavailable, using plain puppeteer:', e.message); }
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_IMAGES   = 100;   // max images per page
const PARALLEL     = 6;     // server-side parallel Chrome instances
const PAGE_TIMEOUT = 15000; // 15s per page load
const AFTER_WAIT   = 1200;   // wait after load
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
  ['/image/upload/',        'Cloudinary'],
  ['/image/private/',       'Cloudinary'],
  ['/image/fetch/',         'Cloudinary'],
  ['/image/authenticated/', 'Cloudinary'],
  ['/video/upload/',        'Cloudinary'],
  ['/image/upload/f_auto',  'Cloudinary'],
  ['ik.imagekit.io',        'ImageKit'],
  ['imagekit.io',           'ImageKit'],
  ['gumlet.io',             'Gumlet'],
  ['gumlet',                'Gumlet'],
  ['scene7.com',            'Scene7 (Adobe DM)'],
  ['scene7.net',            'Scene7 (Adobe DM)'],
  ['.scene7.',              'Scene7 (Adobe DM)'],
  ['/is/image/',            'Scene7 (Adobe DM)'],
  ['/is/content/',          'Scene7 (Adobe DM)'],
  ['?im=',                  'Akamai Image Manager'],
  ['&im=',                  'Akamai Image Manager'],
  ['imwidth=',              'Akamai Image Manager'],
  ['impolicy=',             'Akamai Image Manager'],
  ['brightspotcdn.com',     'Brightspot CDN'],
  ['/dims4/',               'Brightspot CDN'],
  ['vtexassets.com',        'VTEX CDN'],
  ['/_next/image?url=',     'Next.js Image Optimizer'],
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
  ['/aprimo/',              'Aprimo DAM'],
  ['aprimo.com',            'Aprimo DAM'],
  ['/assets-dam.',          'Cloudinary DAM'],
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
  ['demandware.static',         'Salesforce Commerce Cloud'],
  ['/dw/image/v2/',             'Salesforce Commerce Cloud'],
  ['/-/media/',                 'Sitecore CMS'],
  ['/-/jssmedia/',              'Sitecore JSS'],
  ['sfvrsn=',                   'Sitefinity CMS'],
  ['/sites/default/files/',     'Drupal CMS'],
  ['format=webply',             'AEM Edge Delivery'],
  ['optimize=medium',           'AEM Edge Delivery'],
  ['/etc.clientlibs/',          'Adobe Experience Manager'],
  ['/_next/image',              'Next.js'],
  ['/_next/static/',            'Next.js'],
  ['graphassets.com',           'Hygraph CMS'],
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
  ['imperva',       'Imperva'],
  ['incapsula',     'Imperva'],
  ['sucuri',        'Sucuri'],
  ['volt-adc',      'F5 Distributed Cloud'],
  ['volterra',      'F5 Distributed Cloud'],
  ['ns-cache',      'Citrix NetScaler'],
  ['netscaler',     'Citrix NetScaler'],
  ['akamainetstorage','Akamai NetStorage'],
  ['akamaighost',   'Akamai'],
  ['1.1 google',    'Google Cloud CDN'],
  ['microsoft-iis', 'Microsoft IIS'],
  ['istio-envoy',   'Envoy (Kubernetes)'],
  ['envoy',         'Envoy'],
  ['caddy',         'Caddy'],
  ['gws',           'Google Web Server'],
];
// Generic origin servers — a DNS/CNAME CDN result should override these
const GENERIC_SERVERS = new Set(['Varnish','Nginx','Apache','OpenResty','LiteSpeed','Microsoft IIS','Envoy','Envoy (Kubernetes)','Caddy','Google Web Server','Unknown']);

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

// Use Node's built-in DNS resolver — works inside Fly.io without outbound HTTP restrictions
const dnsModule = require('dns').promises;

// Public resolver fallback — some platform resolvers flatten CNAME chains
const publicResolver = new (require('dns').promises.Resolver)();
try { publicResolver.setServers(['1.1.1.1', '8.8.8.8']); } catch {}

async function resolveOneCname(host) {
  // 1. system resolver
  try { const c = await dnsModule.resolveCname(host); if (c && c.length) return c[0]; } catch {}
  // 2. public resolver over UDP/53
  try { const c = await publicResolver.resolveCname(host); if (c && c.length) return c[0]; } catch {}
  // 3. DNS-over-HTTPS (Cloudflare, then Google)
  for (const u of [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=CNAME`,
    `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=CNAME`,
  ]) {
    try {
      const r = await fetch(u, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const j = await r.json();
      const a = (j.Answer || []).find(x => x.type === 5);
      if (a && a.data) return a.data;
    } catch {}
  }
  return null;
}

async function resolveCnameChain(host) {
  const chain = []; const seen = new Set(); let current = host.toLowerCase();
  for (let i = 0; i < 10; i++) {
    if (seen.has(current)) break; seen.add(current);
    const next = await resolveOneCname(current);
    if (!next) break;
    current = next.toLowerCase().replace(/\.$/, '');
    chain.push(current);
  }
  return chain;
}
function matchDnsCdn(chain) {
  for (const name of chain) for (const [pattern, cdn] of DNS_CDN_PATTERNS)
    if (name.endsWith(pattern.toLowerCase()) || name.includes(pattern.toLowerCase())) return cdn;
  return null;
}
// Try the given host, then www.<root>, then the apex. Apex domains cannot carry a
// CNAME (RFC 1034) — the CDN CNAME almost always lives on www. or an asset subdomain.
async function dnsLookupCDN(hostname) {
  const root = getRootDomain(hostname);
  const candidates = [...new Set([hostname, 'www.' + root, root])];
  for (const host of candidates) {
    const chain = await resolveCnameChain(host);
    if (!chain.length) continue;
    const cdn = matchDnsCdn(chain);
    if (cdn) { console.log(`[DNS] ✅ ${host} → ${chain.join(' → ')} → ${cdn}`); return { cdn, cname: host + ' → ' + chain.join(' → ') }; }
    console.log(`[DNS] ${host} → ${chain.join(' → ')} (no CDN match)`);
  }
  console.log(`[DNS] No CNAME chain for: ${candidates.join(', ')}`);
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
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[String(k).toLowerCase()] = String(v ?? '');
  const srv = h['server'] || '', via = h['via'] || '', xsb = h['x-served-by'] || '';
  // ── Header-NAME fingerprints — most reliable CDN tells ──
  if (h['x-amz-cf-id'] || h['x-amz-cf-pop'] || /cloudfront/i.test(via))                       return 'AWS CloudFront';
  if (h['x-akamai-transformed'] || h['akamai-grn'] || h['x-akamai-request-id'] ||
      /akamaighost|akamai/i.test(srv))                                                        return 'Akamai';
  if (h['x-fastly-request-id'] || h['fastly-restarts'] ||
      /cache-[a-z]{3}[\w-]*-[a-z]{3}\b/i.test(xsb) || (/\bvarnish\b/i.test(via) && /^cache-/i.test(xsb))) return 'Fastly';
  if (h['x-iinfo'] || /imperva|incapsula/i.test(srv + ' ' + (h['x-cdn'] || '')))              return 'Imperva';
  if (h['x-sucuri-id'] || h['x-sucuri-cache'] || /sucuri/i.test(srv))                         return 'Sucuri';
  if (h['x-vercel-id'] || h['x-vercel-cache'] || /vercel/i.test(srv))                         return 'Vercel';
  if (h['x-nf-request-id'] || /netlify/i.test(srv))                                           return 'Netlify';
  if (h['x-azure-ref'] || h['x-msedge-ref'] || h['x-fd-int-roxy-purgeid'])                    return 'Azure Front Door / CDN';
  if (h['cdn-pullzone'] || h['cdn-requestid'] || /bunnycdn/i.test(srv))                       return 'Bunny CDN';
  if (/volt-adc|volterra/i.test(srv))                                                         return 'F5 Distributed Cloud';
  if (h['cf-ray'] || h['cf-cache-status'] || /cloudflare/i.test(srv))                         return 'Cloudflare';
  if (/ns-cache|netscaler|citrix/i.test(srv + ' ' + via))                                     return 'Citrix NetScaler';
  if (/1\.1 google/i.test(via))                                                               return 'Google Cloud CDN';
  if (h['x-goog-generation'] || h['x-goog-hash'])                                             return 'Google Cloud Storage';
  // ── Fallback: substring patterns across common headers ──
  const str = [srv, h['x-server'], xsb, via, h['x-cache'], h['x-cdn'], h['x-powered-by']]
    .filter(Boolean).join(' ').toLowerCase();
  for (const [pattern, name] of SERVER_PATTERNS) if (str.includes(pattern.toLowerCase())) return name;
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

function getRootDomain(h) {
  const parts = String(h || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2], tld = parts[parts.length - 1];
  if (tld.length === 2 && /^(co|com|org|net|gov|edu|ac|gob|or|ne|nom|ltd|plc)$/.test(sld)) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}
// trustedRoots: Set of root domains the target has resolved/redirected to
// (e.g. {'bbw.com','bathandbodyworks.com'}) — plus known CDN hosts and brand-name hosts
function isFromTrustedOrSameDomain(imgUrl, trustedRoots) {
  try {
    const imgHost = new URL(imgUrl).hostname.toLowerCase();
    const imgRoot = getRootDomain(imgHost);
    const hostFlat = imgHost.replace(/-/g, '');
    for (const root of trustedRoots) {
      if (imgRoot === root) return true;
      const brand = root.split('.')[0].replace(/-/g, '');
      if (brand.length > 3 && hostFlat.includes(brand)) return true;
    }
    if (ALWAYS_TRUSTED_CDN_HOSTS.some(cdn => imgHost.endsWith(cdn))) return true;
    return false;
  } catch { return false; }
}

// ── Extension-less content-image heuristic (for DOM/HTML-extracted URLs) ─────
// Modern CDNs often serve without a file extension (graphassets, scene7 /is/image/,
// cloudinary f_auto, imgix). Reject known non-image assets; accept by ext, CDN host,
// path hint, or image-transform query params.
const NON_IMAGE_EXT      = /\.(m?js|css|svg|gif|ico|woff2?|ttf|otf|eot|json|xml|html?|php|aspx?|jsp|mp4|webm|m3u8|mp3|pdf|zip|txt|map|csv)(\?|$|#)/i;
const IMAGE_PATH_HINTS   = /\/(image|images|img|imgs|media|photo|photos|picture|pictures|uploads|content\/dam|is\/image|dw\/image|cdn\/shop|_next\/image|resize|thumb|thumbnail|thumbnails|assets\/images|wp-content\/uploads)\//i;
const IMAGE_QUERY_HINTS  = /(?:[?&](?:format|fmt|w|h|wid|hei|width|height|q|quality|im|imwidth|impolicy|auto|fit|crop|dpr|resize|output|sw|sh|itok)=|f_auto|q_auto|c_fill|c_fit|c_lfill|\/w_\d+|\/h_\d+|output=format|\/resize=|resize:fit)/i;
function looksLikeContentImage(u) {
  if (!u || !/^https?:\/\//i.test(u) || NON_IMAGE_EXT.test(u)) return false;
  if (IMAGE_EXTENSIONS.test(u)) return true;
  if (detectCDNFromUrl(u)) return true;
  if (IMAGE_PATH_HINTS.test(u)) return true;
  if (IMAGE_QUERY_HINTS.test(u)) return true;
  return false;
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
  let effectiveUrl = url;               // URL after redirects (bbw.com → bathandbodyworks.com)
  let blockedBy    = null;              // bot-protection vendor detected from a block page
  const seenDomUrls = new Set();        // DOM/HTML image URLs already counted
  let UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const startedAt  = Date.now();
  const BUDGET_MS  = 26000;             // stay under the frontend's per-company timeout
  const trustedRoots = new Set([getRootDomain(new URL(url).hostname)]);
  function addTrustedRoot(u) {
    try { const r = getRootDomain(new URL(u).hostname);
      if (r && !trustedRoots.has(r)) { trustedRoots.add(r); console.log(`[CDN] Trusted root added: ${r}`); } } catch {}
  }
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
    if (!isFromTrustedOrSameDomain(imgUrl, trustedRoots)) return;

    // DOM/HTML scan: keep content images (ext, CDN host, path/query hints) — no SVG/GIF/ICO/JS/CSS
    if (source === 'dom' || source === 'html') {
      if (!looksLikeContentImage(imgUrl)) return;
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
      const isContent = (/\.(jpg|jpeg|png|webp|avif)/i.test(imgUrl) || looksLikeContentImage(imgUrl)) &&
        !/favicon|icon|logo|pixel|spacer|blank|1x1|sprite|\.svg|\.gif/i.test(imgUrl);
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
    UA = UAS[Math.abs(hash) % UAS.length];
    await page.setUserAgent(UA);

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
        if (!isFromTrustedOrSameDomain(resUrl, trustedRoots)) return;

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
      const wwwUrl  = targetUrl.replace(/^(https?:\/\/)(?!www\.)/i, '$1www.');
      const httpUrl = targetUrl.replace(/^https:/i, 'http:');
      const attempts = [
        { url: targetUrl, opts: { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT } },
      ];
      if (wwwUrl !== targetUrl) attempts.push({ url: wwwUrl, opts: { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT } });
      attempts.push({ url: targetUrl, opts: { waitUntil: 'load', timeout: 18000 } });
      attempts.push({ url: httpUrl,   opts: { waitUntil: 'domcontentloaded', timeout: 12000 } });
      let lastErr = null;
      for (const a of attempts) {
        if (done) return true;
        if (Date.now() - startedAt > BUDGET_MS) break;
        try { await page.goto(a.url, a.opts); addTrustedRoot(page.url()); return true; }
        catch (e) {
          lastErr = e;
          addTrustedRoot(page.url());
          // A partial load that already produced image/server signals is good enough
          if (networkImageCount > 0 || serverHeader) return true;
        }
      }
      throw lastErr || new Error('Navigation failed');
    }

    // ── Detect bot-protection / WAF block pages — the block itself names the CDN ──
    async function detectBlockPage() {
      try {
        const info = await page.evaluate(() => ({
          title: document.title || '',
          text: ((document.body && document.body.innerText) || '').slice(0, 4000),
          html: (document.documentElement && document.documentElement.outerHTML || '').slice(0, 30000),
          imgs: document.images ? document.images.length : 0,
        }));
        const blob = (info.title + ' ' + info.text + ' ' + info.html).toLowerCase();
        if (/_incapsula_resource|incapsula|imperva/.test(blob))                                   return 'Imperva';
        if (/cf-browser-verification|challenges\.cloudflare\.com|cf_chl_|just a moment|checking your browser|attention required/.test(blob)) return 'Cloudflare';
        if (/akamaighost|errors\.edgesuite\.net|reference\s*#\s*[0-9a-f]+\.[0-9a-f]+/.test(blob) && info.imgs < 3) return 'Akamai';
        if (/perimeterx|px-captcha|_pxhd|press\s*&\s*hold|human challenge/.test(blob))         return 'PerimeterX';
        if (/datadome|geo\.captcha-delivery\.com/.test(blob))                                   return 'DataDome';
        if (/kasada|kpsdk/.test(blob))                                                           return 'Kasada';
        if (/shape security|shapesecurity/.test(blob))                                           return 'F5 Shape';
        if (/access denied|request blocked|request unsuccessful|403 forbidden/.test(blob) && info.imgs < 3) return 'WAF';
        return null;
      } catch { return null; }
    }

    // ── Raw-HTML fallback: fetch the page as a plain browser GET and mine image URLs ──
    // Bypasses JS-executed bot checks that blank out headless Chrome but still serve HTML.
    async function rawHtmlFallback(targetUrl) {
      const tries = [targetUrl];
      const www = targetUrl.replace(/^(https?:\/\/)(?!www\.)/i, '$1www.');
      if (www !== targetUrl) tries.push(www);
      for (const u of tries) {
        try {
          console.log(`[HTML] Fallback fetch: ${u}`);
          const r = await fetch(u, {
            redirect: 'follow',
            headers: {
              'User-Agent': UA,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
              'Cache-Control': 'max-age=0',
            },
            signal: AbortSignal.timeout(12000),
          });
          addTrustedRoot(r.url);
          if (r.url && r.url !== effectiveUrl) effectiveUrl = r.url;
          const hdrs = {}; r.headers.forEach((v, k) => { hdrs[k.toLowerCase()] = v; });
          const rawSvr = extractServerHeader(hdrs); if (rawSvr && !serverHeader) serverHeader = rawSvr;
          const svrCDN = detectFromServerHeader(hdrs); if (svrCDN && !serverCDN) serverCDN = svrCDN;
          const html = await r.text();
          console.log(`[HTML] ${r.status} ${html.length} bytes from ${r.url}`);
          const lower = html.toLowerCase();
          if (!blockedBy) {
            if (/_incapsula_resource|incapsula/.test(lower)) blockedBy = 'Imperva';
            else if (/cf-browser-verification|cf_chl_|just a moment/.test(lower)) blockedBy = 'Cloudflare';
            else if (/akamaighost|errors\.edgesuite\.net/.test(lower)) blockedBy = 'Akamai';
            else if (/perimeterx|px-captcha/.test(lower)) blockedBy = 'PerimeterX';
            else if (/datadome/.test(lower)) blockedBy = 'DataDome';
          }
          const found = new Set();
          const base = new URL(r.url);
          const abs = /https?:\/\/[^\s"'<>()\\]+/gi; let m;
          while ((m = abs.exec(html)) && found.size < 800) found.add(m[0].replace(/&amp;/g, '&').replace(/[,.;)]+$/, ''));
          const rel = /(?:src|data-src|data-srcset|srcset|data-bg|data-background|data-original|data-lazy-src|content|href)=["']?(\/\/[^\s"'<>]+|\/[^\s"'<>]+)/gi;
          while ((m = rel.exec(html)) && found.size < 1200) { try { found.add(new URL(m[1], base).href); } catch {} }
          let n = 0;
          for (const cand of found) {
            const d = detectDAMFromUrl(cand); if (d && !damFromUrl) damFromUrl = d;
            detectTechStackFromUrl(cand).forEach(t => techStackSet.add(t));
            if (!looksLikeContentImage(cand) || isExcludedUrl(cand)) continue;
            if (!isFromTrustedOrSameDomain(cand, trustedRoots)) continue;
            if (seenDomUrls.has(cand)) continue;
            seenDomUrls.add(cand);
            trackEndpoint(cand, detectCDNFromUrl(cand));
            processImageUrl(cand, 'html');
            domImageCount++; n++;
          }
          console.log(`[HTML] ${n} content image URLs extracted (CDN: ${cdnFromUrl || 'none'})`);
          if (n > 0 || html.length > 3000) return;
        } catch (e) { console.log(`[HTML] Fallback failed for ${u}: ${e.message}`); }
      }
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
          if (seenDomUrls.has(imgUrl)) continue;   // dedupe across homepage + inner-page passes
          seenDomUrls.add(imgUrl);
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
    let navFailReason = null;

    // ── Phase A: Load homepage to collect links ───────────────────────────────
    console.log(`[CDN] Loading homepage for inner page links: ${url}`);
    let innerPages = [];

    try {
      await navigateTo(url);
      effectiveUrl = page.url() || url;
      addTrustedRoot(effectiveUrl);
      if (effectiveUrl.replace(/\/$/, '') !== url.replace(/\/$/, '')) console.log(`[CDN] Redirected: ${url} → ${effectiveUrl}`);
      await dismissCookies();
      await new Promise(r => setTimeout(r, AFTER_WAIT));

      // The homepage counts too — full DOM scan + scroll to trigger lazy images
      await scanDOMElements();
      await humanScroll(SCROLL_PX);
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 2500 }).catch(() => {});
      await scanDOMElements(); // second pass picks up lazy-loaded srcs
      console.log(`[CDN] Homepage scan — Network: ${networkImageCount}, DOM: ${domImageCount}, CDN: ${cdnFromUrl || 'none'}`);

      // Block page? The vendor name is itself a CDN/WAF signal
      const blk = await detectBlockPage();
      if (blk) { blockedBy = blk; console.log(`[CDN] Bot protection detected: ${blk}`); }

      // Inner page links — based on the URL we actually landed on
      innerPages = await findInnerPages(effectiveUrl, 8);
      console.log(`[CDN] Found ${innerPages.length} inner pages: ${innerPages.slice(0,4).join(', ')}`);

      // Second DNS pass on the effective hostname if it differs from the input
      dnsPromise = dnsPromise.then(async () => {
        if (cdnFromDNS) return;
        const eh = new URL(effectiveUrl).hostname;
        if (getRootDomain(eh) !== getRootDomain(new URL(url).hostname)) {
          const r = await dnsLookupCDN(eh);
          if (r) { cdnFromDNS = r.cdn; cnameRecord = r.cname; }
        }
      }).catch(() => {});
    } catch (e) {
      lastNavError = e;
      console.log(`[CDN] Homepage failed: ${e.message}`);
    }

    // Homepage failed → remember why, but keep going (DNS + raw-HTML fallback may still answer)
    if (lastNavError && networkImageCount === 0 && domImageCount === 0) {
      const errMsg = lastNavError.message || 'Unknown error';
      navFailReason = errMsg.includes('CERT') || errMsg.includes('SSL')
        ? `SSL/Certificate error: ${errMsg}`
        : /timeout/i.test(errMsg)
        ? `Page too slow to load (timeout after ${PAGE_TIMEOUT/1000}s)`
        : errMsg.includes('ERR_NAME_NOT_RESOLVED')
        ? `Domain not found (DNS error)`
        : errMsg.includes('ERR_CONNECTION_REFUSED')
        ? `Connection refused — site may be down`
        : `Could not open site: ${errMsg}`;
    }

    // ── Phase B: Full scan of top inner pages (homepage already scanned above) ──
    const pagesToFullScan = innerPages.slice(0, 2);

    for (let pageIdx = 0; pageIdx < pagesToFullScan.length; pageIdx++) {
      if (done) break;

      const targetUrl = pagesToFullScan[pageIdx];
      if (Date.now() - startedAt > BUDGET_MS - 6000) { console.log('[CDN] Time budget reached — skipping remaining inner pages'); break; }
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
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 2500 }).catch(() => {});
        await scanDOMElements();

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

    // ── Phase C: raw-HTML fallback when the browser saw (almost) nothing ──────
    if (networkImageCount + domImageCount < 5 && Date.now() - startedAt < BUDGET_MS + 8000) {
      await rawHtmlFallback(effectiveUrl);
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

  // ── DNS pass 3: resolve the hosts that actually serve the images ──────────
  // e.g. www1.bac-assets.com → edgekey.net (Akamai); media.deloitte.com → scene7.com
  if (!cdnFromDNS) {
    const tried = new Set();
    const hostsToTry = Object.entries(endpointCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([h]) => h);
    for (const h of hostsToTry) {
      if (!h || tried.has(h) || Date.now() - startedAt > BUDGET_MS + 10000) continue;
      tried.add(h);
      const r = await dnsLookupCDN(h).catch(() => null);
      if (r) { cdnFromDNS = r.cdn; cnameRecord = r.cname; break; }
    }
  }

  // Priority: URL/majority CDN > server-header CDN > DNS CDN > bot-protection vendor
  let finalCDN;
  if (majorityHostCDN && cdnFromUrl) {
    finalCDN = getCDNPriority(majorityHostCDN) >= getCDNPriority(cdnFromUrl)
      ? majorityHostCDN : cdnFromUrl;
  } else {
    finalCDN = majorityHostCDN || cdnFromUrl || serverCDN || 'Not available';
  }
  // A real CDN from DNS beats a generic origin server name (Varnish/Nginx/Apache/IIS)
  if (cdnFromDNS && (finalCDN === 'Not available' || GENERIC_SERVERS.has(finalCDN))) {
    console.log(`[DNS] Using DNS CDN "${cdnFromDNS}" over "${finalCDN}"`);
    finalCDN = cdnFromDNS;
  }
  // Blocked by Imperva/Akamai/Cloudflare? That vendor IS the edge in front of the site
  const BLOCK_IS_CDN = { 'Imperva': 'Imperva', 'Akamai': 'Akamai', 'Cloudflare': 'Cloudflare' };
  if (finalCDN === 'Not available' && blockedBy && BLOCK_IS_CDN[blockedBy]) {
    finalCDN = BLOCK_IS_CDN[blockedBy];
    console.log(`[CDN] Using bot-protection vendor as CDN: ${finalCDN}`);
  }
  if (blockedBy && !['Imperva','Akamai','Cloudflare'].includes(blockedBy)) techStackSet.add(blockedBy + ' (bot protection)');

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
    if (navFailReason && totalImages === 0)
      reason = navFailReason;
    else if (totalImages === 0)
      reason = blockedBy ? `Blocked by ${blockedBy} bot protection — no images rendered` : 'No images loaded — site blocks headless browsers or requires login';
    else if (totalImages >= MAX_IMAGES)
      reason = `Checked ${MAX_IMAGES} images — no known CDN patterns (images served from own domain)`;
    else
      reason = `${totalImages} images scanned — served from own domain, no CDN/DAM patterns`;
  } else if (blockedBy) {
    reason = `Bot protection: ${blockedBy}${totalImages === 0 ? ' (CDN inferred from edge, no images rendered)' : ''}`;
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
