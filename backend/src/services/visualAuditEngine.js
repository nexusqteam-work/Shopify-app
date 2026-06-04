// ═══════════════════════════════════════════════════
//  DOM Visual Analysis Engine
//  Uses Puppeteer to visit store pages and extract
//  real layout, conversion, and UX data
//  NO screenshots sent — pure DOM measurement
// ═══════════════════════════════════════════════════

import puppeteer from 'puppeteer';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Plan limits for visual analysis ─────────────────
export const VISUAL_PLAN_CONFIG = {
  FREE:   { enabled: false, pages: 0,  checks: 0,  codeGen: false, autoFix: false },
  GROWTH: { enabled: false, pages: 0,  checks: 0,  codeGen: false, autoFix: false },
  // GROWTH = Advanced plan (₹1,999) — basic DOM analysis
  // We map plan names: GROWTH→Advanced, PRO→Pro, AGENCY→Agent
  BASIC:  { enabled: false, pages: 0,  checks: 0,  codeGen: false, autoFix: false },
};

export const VISUAL_FEATURES = {
  FREE:   { enabled: true,  pages: 99, checks: 50, codeGen: true,  autoFix: true  },
  GROWTH: { enabled: true,  pages: 99, checks: 50, codeGen: true,  autoFix: true  }, // Advanced ₹1,999
  PRO:    { enabled: true,  pages: 99, checks: 50, codeGen: true,  autoFix: true  }, // Pro ₹2,999
  AGENCY: { enabled: true,  pages: 99, checks: 50, codeGen: true,  autoFix: true  }, // Agent ₹29,999
};

// ── Browser singleton ────────────────────────────────
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless:  'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
    logger.info('Puppeteer browser launched');
  }
  return browserInstance;
}

// ── Close browser gracefully ─────────────────────────
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

process.on('beforeExit', closeBrowser);

// ═══════════════════════════════════════════════════
//  MAIN FUNCTION — Run full visual audit
// ═══════════════════════════════════════════════════
export async function runVisualAudit(shopDomain, plan, products = []) {
  const config = VISUAL_FEATURES[plan] || VISUAL_FEATURES.FREE;

  if (!config.enabled) {
    return {
      enabled:  false,
      message:  'Visual analysis requires Advanced plan or higher',
      issues:   [],
      score:    null,
    };
  }

  logger.info(`Visual audit starting: ${shopDomain} (plan: ${plan})`);

  const storeUrl    = `https://${shopDomain}`;
  const allIssues   = [];
  const pageResults = {};

  // ── Determine which pages to scan ───────────────
  const pagesToScan = buildPageList(storeUrl, products, config.pages);

  for (const pageConfig of pagesToScan) {
    try {
      logger.info(`Scanning page: ${pageConfig.url} (${pageConfig.type})`);
      const result = await scanPage(pageConfig.url, pageConfig.type, shopDomain);
      pageResults[pageConfig.type] = result;

      // Extract issues from this page
      const pageIssues = extractIssues(result, pageConfig.type, config.checks);
      allIssues.push(...pageIssues);

    } catch (err) {
      logger.warn(`Page scan failed for ${pageConfig.url}: ${err.message}`);
    }

    // Small delay between pages to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  // ── Calculate visual score ───────────────────────
  const visualScore = calculateVisualScore(allIssues);

  // ── Generate AI analysis ─────────────────────────
  const aiAnalysis = await generateVisualInsights(
    shopDomain, allIssues, pageResults, plan
  );

  logger.info(`Visual audit complete: ${shopDomain} — ${allIssues.length} issues, score: ${visualScore}`);

  return {
    enabled:    true,
    score:      visualScore,
    pageResults,
    issues:     allIssues,
    aiAnalysis,
    pagesScanned: pagesToScan.length,
    config,
  };
}

// ── Build list of pages to scan ──────────────────────
function buildPageList(storeUrl, products, maxPages) {
  const pages = [
    { url: storeUrl,                       type: 'homepage'   },
    { url: `${storeUrl}/collections/all`,  type: 'collection' },
    { url: `${storeUrl}/cart`,             type: 'cart'       },
  ];

  // Add product pages (up to 3 top products)
  if (products.length > 0) {
    const topProducts = products.slice(0, 3);
    topProducts.forEach(p => {
      if (p.handle) {
        pages.push({
          url:  `${storeUrl}/products/${p.handle}`,
          type: 'product',
          name: p.title,
        });
      }
    });
  }

  // Add search and contact pages
  pages.push(
    { url: `${storeUrl}/pages/contact`, type: 'contact' },
    { url: `${storeUrl}/search`,        type: 'search'  },
  );

  return pages.slice(0, maxPages);
}

// ═══════════════════════════════════════════════════
//  CORE: Scan a single page using Puppeteer
// ═══════════════════════════════════════════════════
async function scanPage(url, pageType, shopDomain) {
  const browser = await getBrowser();
  const page    = await browser.newPage();

  // Block images and fonts to speed up scanning
  // We only need the DOM structure, not visual rendering
  await page.setRequestInterception(true);
  page.on('request', req => {
    const type = req.resourceType();
    if (['image', 'font', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  );

  const results = {
    mobile:  {},
    desktop: {},
    shared:  {},
    url,
    pageType,
    loadTime: 0,
    errors:   [],
  };

  try {
    // ── MOBILE SCAN (390×844 — iPhone 14) ──────────
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    const mobileStart = Date.now();
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout:   20000,
    });
    results.loadTime    = Date.now() - mobileStart;
    results.httpStatus  = response?.status();

    if (!response || response.status() >= 400) {
      results.errors.push(`Page returned ${response?.status()}`);
      await page.close();
      return results;
    }

    // Wait for dynamic content
    await new Promise(r => setTimeout(r, 1500));

    // ── Extract mobile DOM data ─────────────────────
    results.mobile = await page.evaluate((pType) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const getEl      = (sel)  => document.querySelector(sel);
      const getAllEl   = (sel)  => [...document.querySelectorAll(sel)];
      const isVisible  = (el)  => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0;
      };
      const isAboveFold = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < vh;
      };
      const getPos = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
      };

      // ── CTA / Add to Cart ──────────────────────────
      const ctaSelectors = [
        'button[name="add"]', '#AddToCart', '.btn-add-to-cart',
        '[data-testid="add-to-cart"]', '.product-form__submit',
        'button[data-action="add-to-cart"]', '.shopify-payment-button',
        'button:not([type="submit"]):not([aria-label*="close"])',
      ];
      let ctaEl = null;
      for (const sel of ctaSelectors) {
        ctaEl = getEl(sel);
        if (ctaEl) break;
      }

      // ── Navigation ────────────────────────────────
      const nav         = getEl('nav, header nav, .site-header');
      const navLinks    = getAllEl('nav a, header nav a').length;
      const hamburger   = getEl('[class*="hamburger"], [class*="menu-toggle"], [aria-label*="menu"], .mobile-nav-toggle');
      const stickyHeader = getEl('[style*="position: sticky"], [style*="position:sticky"], header[class*="sticky"], .sticky-header');

      // ── Product page specific ──────────────────────
      const productTitle  = getEl('h1');
      const productPrice  = getEl('.price, [class*="price__regular"], [class*="product-price"], .price-item');
      const productImages = getAllEl('.product__media img, .product-image img, [class*="product"] img');
      const reviews       = getEl('[class*="review"], [class*="rating"], [data-reviewio], .loox-rating, .stamped-badge, .yotpo');
      const trustBadges   = getEl('[class*="trust"], [class*="badge"], [class*="secure"], [class*="guarantee"], [class*="payment-icon"]');
      const urgency       = getEl('[class*="urgency"], [class*="countdown"], [class*="low-stock"], [class*="scarcity"], [class*="stock-counter"]');
      const sizeSelector  = getEl('[class*="variant"], select[name="id"], .single-option-selector');
      const breadcrumb    = getEl('[class*="breadcrumb"], nav[aria-label*="breadcrumb"]');
      const recentlyViewed = getEl('[class*="recently-viewed"], [class*="related-products"]');

      // ── Homepage specific ──────────────────────────
      const heroSection   = getEl('[class*="hero"], [class*="banner"], [class*="slideshow"], .index-section');
      const heroHeading   = heroSection ? heroSection.querySelector('h1, h2') : null;
      const heroCTA       = heroSection ? heroSection.querySelector('a.btn, a.button, a[class*="btn"]') : null;
      const heroText      = heroHeading?.innerText?.trim();

      // ── Collection page ────────────────────────────
      const productCards  = getAllEl('.product-card, .grid__item, [class*="product-item"]').length;
      const filterBar     = getEl('[class*="filter"], [class*="sort-by"], [data-filter]');
      const pagination    = getEl('[class*="pagination"], .pagination');

      // ── Cart page ─────────────────────────────────
      const cartItems     = getAllEl('[class*="cart-item"], .cart__item').length;
      const checkoutBtn   = getEl('[name="checkout"], [class*="checkout"], #checkout');
      const upsellInCart  = getEl('[class*="upsell"], [class*="cross-sell"]');

      // ── General UX ────────────────────────────────
      const allLinks      = getAllEl('a').length;
      const allButtons    = getAllEl('button').length;
      const forms         = getAllEl('form').length;
      const scripts       = getAllEl('script[src]').length;
      const domElements   = document.querySelectorAll('*').length;
      const hasSearch     = !!getEl('[type="search"], [placeholder*="Search"], [class*="search"]');
      const popups        = getAllEl('[class*="popup"], [class*="modal"], [class*="overlay"]').filter(el => isVisible(el)).length;
      const scrollDepth   = document.body.scrollHeight;
      const cookieBanner  = getEl('[class*="cookie"], [id*="cookie"], [class*="gdpr"]');
      const chatWidget    = getEl('[class*="chat"], [id*="chat"], [class*="intercom"], [class*="crisp"]');

      // ── Mobile specific checks ──────────────────────
      const tooSmallTaps  = getAllEl('a, button').filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
      }).length;
      const hasHorizontalScroll = document.body.scrollWidth > vw;
      const fontSizes = getAllEl('p, span, li').slice(0, 20).map(el =>
        parseInt(window.getComputedStyle(el).fontSize)
      ).filter(s => s > 0);
      const avgFontSize = fontSizes.length
        ? Math.round(fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length)
        : 0;

      return {
        viewport:          { width: vw, height: vh },
        pageType:          pType,

        // CTA
        ctaPresent:        !!ctaEl,
        ctaAboveFold:      isAboveFold(ctaEl),
        ctaPosition:       getPos(ctaEl),
        ctaText:           ctaEl?.innerText?.trim(),

        // Navigation
        navLinksCount:     navLinks,
        hasHamburgerMenu:  !!hamburger,
        hasStickyHeader:   !!stickyHeader,
        navPosition:       getPos(nav),

        // Product elements
        hasH1:             !!productTitle,
        h1Text:            productTitle?.innerText?.trim()?.substring(0, 80),
        h1AboveFold:       isAboveFold(productTitle),
        priceAboveFold:    isAboveFold(productPrice),
        pricePosition:     getPos(productPrice),
        productImageCount: productImages.length,
        hasReviews:        !!reviews,
        hasTrustBadges:    !!trustBadges,
        hasUrgencySignals: !!urgency,
        hasSizeSelector:   !!sizeSelector,
        hasBreadcrumb:     !!breadcrumb,
        hasRecentlyViewed: !!recentlyViewed,

        // Homepage
        heroTextPresent:   !!heroText,
        heroText:          heroText?.substring(0, 100),
        heroCTAPresent:    !!heroCTA,

        // Collection
        productCardCount:  productCards,
        hasFilterBar:      !!filterBar,
        hasPagination:     !!pagination,

        // Cart
        cartItemCount:     cartItems,
        checkoutBtnPresent: !!checkoutBtn,
        hasCartUpsell:     !!upsellInCart,

        // General UX
        totalLinks:        allLinks,
        totalButtons:      allButtons,
        formCount:         forms,
        scriptCount:       scripts,
        domElementCount:   domElements,
        hasSearch:         hasSearch,
        visiblePopupsOnLoad: popups,
        pageScrollHeight:  scrollDepth,
        hasCookieBanner:   !!cookieBanner,
        hasChatWidget:     !!chatWidget,

        // Mobile UX
        tooSmallTapTargets:    tooSmallTaps,
        hasHorizontalScroll:   hasHorizontalScroll,
        averageFontSizePx:     avgFontSize,
      };
    }, pageType);

    // ── DESKTOP SCAN (1440×900) ─────────────────────
    await page.setViewport({ width: 1440, height: 900, isMobile: false });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));

    results.desktop = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isAboveFold = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < vh;
      };
      const getPos = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
      };

      const ctaSelectors = [
        'button[name="add"]', '#AddToCart', '.btn-add-to-cart',
        '.product-form__submit', '.shopify-payment-button',
      ];
      let ctaEl = null;
      for (const sel of ctaSelectors) {
        ctaEl = document.querySelector(sel);
        if (ctaEl) break;
      }

      const productImages = [...document.querySelectorAll('.product__media img, .product-image img, [class*="product"] img')];
      const hasImageGallery = productImages.length > 1;
      const hasVideoProduct = !!document.querySelector('video, [class*="video"]');
      const hasZoomFeature  = !!document.querySelector('[class*="zoom"], [data-zoom]');
      const has3Column      = document.querySelectorAll('.grid--3-col, [class*="col-3"]').length > 0;
      const footerLinks     = document.querySelectorAll('footer a').length;

      return {
        ctaAboveFold:      isAboveFold(ctaEl),
        ctaPosition:       getPos(ctaEl),
        hasImageGallery,
        hasVideoProduct,
        hasZoomFeature,
        has3ColumnLayout:  has3Column,
        footerLinkCount:   footerLinks,
        viewportWidth:     vw,
      };
    });

    // ── Shared performance metrics ───────────────────
    results.shared = {
      loadTimeMs:     results.loadTime,
      url,
      pageType,
      scannedAt:      new Date().toISOString(),
    };

  } catch (err) {
    logger.error(`Puppeteer scan error for ${url}: ${err.message}`);
    results.errors.push(err.message);
  } finally {
    await page.close();
  }

  return results;
}

// ═══════════════════════════════════════════════════
//  ISSUE EXTRACTION — Convert DOM data to issues
// ═══════════════════════════════════════════════════
function extractIssues(pageResult, pageType, maxChecks) {
  const issues  = [];
  const mobile  = pageResult.mobile  || {};
  const desktop = pageResult.desktop || {};

  const add = (issue) => {
    if (issues.length < maxChecks) issues.push(issue);
  };

  // ── PRODUCT PAGE CHECKS ──────────────────────────
  if (pageType === 'product') {

    // CTA below fold on mobile — CRITICAL
    if (mobile.ctaPresent === false) {
      add({
        type:          'VISUAL',
        priority:      'CRITICAL',
        category:      'CONVERSION',
        title:         'Add to Cart Button Not Found on Product Page',
        description:   'No Add to Cart button was detected on the product page. Customers cannot purchase. This may be a theme configuration issue.',
        impact:        45000,
        effortMinutes: 30,
        location:      'Product page',
        pageType,
        domData:       { ctaPresent: false },
        fixDescription: 'Check your theme settings — ensure the product form section is enabled on product page template.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    } else if (mobile.ctaPresent && !mobile.ctaAboveFold) {
      add({
        type:          'VISUAL',
        priority:      'CRITICAL',
        category:      'CONVERSION',
        title:         `Add to Cart Button Below Fold on Mobile (at ${mobile.ctaPosition?.top}px)`,
        description:   `Your Add to Cart button is at ${mobile.ctaPosition?.top}px — below the 844px mobile viewport. 68% of shoppers are on mobile. If they cannot see the buy button without scrolling, most will not scroll.`,
        impact:        32000,
        effortMinutes: 45,
        location:      'Product page — mobile viewport',
        pageType,
        domData:       mobile.ctaPosition,
        fixDescription: 'Move Add to Cart button above the product description on mobile. Reorder sections in theme customizer or add CSS to restructure the product form layout.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
        cssFixTarget:   '.product__info-container, .product-form',
      });
    }

    // Price not above fold
    if (mobile.ctaPresent && !mobile.priceAboveFold) {
      add({
        type:          'VISUAL',
        priority:      'HIGH',
        category:      'CONVERSION',
        title:         'Product Price Hidden Below Fold on Mobile',
        description:   `Price is at ${mobile.pricePosition?.top}px — not visible without scrolling. Shoppers cannot see what they are paying before deciding to engage with the page.`,
        impact:        14000,
        effortMinutes: 30,
        location:      'Product page — price section',
        pageType,
        domData:       mobile.pricePosition,
        fixDescription: 'Move the price block above the fold. In theme customizer, drag the price section to appear immediately under the product title.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
        cssFixTarget:   '.product__info .price',
      });
    }

    // No product reviews
    if (!mobile.hasReviews) {
      add({
        type:          'VISUAL',
        priority:      'HIGH',
        category:      'CONVERSION',
        title:         'No Review Widget Visible on Product Page',
        description:   'No customer review section was detected on the product page. Products with reviews convert at 3.5x the rate of products without. This is your biggest trust gap.',
        impact:        22000,
        effortMinutes: 60,
        location:      'Product page — below description',
        pageType,
        domData:       { hasReviews: false },
        fixDescription: 'Install Shopify Product Reviews (free) or Judge.me (freemium). Add the review block to your product page template in theme customizer.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }

    // No urgency signals
    if (!mobile.hasUrgencySignals) {
      add({
        type:          'VISUAL',
        priority:      'HIGH',
        category:      'CONVERSION',
        title:         'No Urgency or Scarcity Signals on Product Page',
        description:   'No urgency signals detected — no stock countdown, no low-stock warning, no social proof counter. Urgency signals increase conversion by 12-18% on average.',
        impact:        18000,
        effortMinutes: 30,
        location:      'Product page — near CTA',
        pageType,
        domData:       { hasUrgencySignals: false },
        fixDescription: 'Add a low-stock badge showing remaining inventory. Add a "X people viewing this" counter. Both are available in Shopify theme settings for supported themes.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }

    // No trust badges
    if (!mobile.hasTrustBadges) {
      add({
        type:          'VISUAL',
        priority:      'MEDIUM',
        category:      'CONVERSION',
        title:         'No Trust Badges Near Add to Cart Button',
        description:   'No trust signals (secure checkout, money-back guarantee, payment icons) detected near the purchase area. Trust badges near the CTA reduce purchase anxiety.',
        impact:        9000,
        effortMinutes: 45,
        location:      'Product page — below CTA',
        pageType,
        domData:       { hasTrustBadges: false },
        fixDescription: 'Add a trust badge section below your Add to Cart button. Include: SSL secure, free returns, and accepted payment method icons.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }

    // Too few product images
    if (mobile.productImageCount < 3 && mobile.productImageCount > 0) {
      add({
        type:          'VISUAL',
        priority:      'MEDIUM',
        category:      'CONVERSION',
        title:         `Only ${mobile.productImageCount} Product Image — Needs 5+`,
        description:   `Only ${mobile.productImageCount} product image detected. Products with 5+ images convert 25% better. Customers need multiple angles to feel confident buying online.`,
        impact:        11000,
        effortMinutes: 120,
        location:      'Product page — image gallery',
        pageType,
        domData:       { imageCount: mobile.productImageCount },
        fixDescription: 'Add front, back, side, lifestyle, and close-up detail shots. Minimum 5 images per product. Upload in Admin → Products → select product → Images.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/products',
      });
    }

    // No image gallery on desktop
    if (!desktop.hasImageGallery) {
      add({
        type:          'VISUAL',
        priority:      'MEDIUM',
        category:      'CONVERSION',
        title:         'No Image Gallery Visible on Desktop Product Page',
        description:   'No multi-image gallery detected on desktop. Single image display reduces buyer confidence significantly on larger screens.',
        impact:        8000,
        effortMinutes: 60,
        location:      'Product page — desktop gallery',
        pageType,
        domData:       { hasImageGallery: false },
      });
    }
  }

  // ── HOMEPAGE CHECKS ──────────────────────────────
  if (pageType === 'homepage') {

    // No hero CTA
    if (!mobile.heroCTAPresent) {
      add({
        type:          'VISUAL',
        priority:      'HIGH',
        category:      'CONVERSION',
        title:         'Homepage Hero Section Has No Call-to-Action Button',
        description:   'No CTA button found in the hero section. Every homepage hero must have a clear action — "Shop Now", "Browse Collection", or "Get Started". Without it visitors have no direction.',
        impact:        16000,
        effortMinutes: 20,
        location:      'Homepage — hero section',
        pageType,
        domData:       { heroCTAPresent: false },
        fixDescription: 'Add a prominent button to your hero banner in Theme Customizer → Homepage → Hero/Slideshow section → Button label and link.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }

    // Too many nav links on mobile
    if (mobile.navLinksCount > 7 && !mobile.hasHamburgerMenu) {
      add({
        type:          'VISUAL',
        priority:      'HIGH',
        category:      'MOBILE',
        title:         `${mobile.navLinksCount} Navigation Links Visible on Mobile Without Hamburger Menu`,
        description:   `${mobile.navLinksCount} nav links are showing directly on mobile without collapsing into a menu. This makes navigation cluttered and pushes content down.`,
        impact:        10000,
        effortMinutes: 30,
        location:      'Navigation — mobile',
        pageType,
        domData:       { navLinksCount: mobile.navLinksCount },
        fixDescription: 'Enable hamburger/collapsible menu for mobile in Theme Customizer → Header → Mobile menu settings.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }

    // Popup on load
    if (mobile.visiblePopupsOnLoad > 0) {
      add({
        type:          'VISUAL',
        priority:      'HIGH',
        category:      'CONVERSION',
        title:         `${mobile.visiblePopupsOnLoad} Popup Appearing Immediately on Page Load`,
        description:   `A popup is appearing within seconds of landing on your store. Immediate popups increase bounce rate by 15-20% because they block the content before the visitor has any context.`,
        impact:        13000,
        effortMinutes: 15,
        location:      'Homepage — popup/modal',
        pageType,
        domData:       { popupsOnLoad: mobile.visiblePopupsOnLoad },
        fixDescription: 'Change popup trigger from "on load" to "after 30 seconds" or "on exit intent". This dramatically reduces its negative impact on bounce rate.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/apps',
      });
    }

    // No search
    if (!mobile.hasSearch) {
      add({
        type:          'VISUAL',
        priority:      'MEDIUM',
        category:      'CONVERSION',
        title:         'No Search Bar Visible on Homepage',
        description:   'No search functionality detected. 30% of shoppers who use search convert at 5x the rate of those who browse. Missing search means missing high-intent buyers.',
        impact:        8000,
        effortMinutes: 15,
        location:      'Homepage — header',
        pageType,
        domData:       { hasSearch: false },
        fixDescription: 'Enable search icon in Theme Customizer → Header → Show search icon.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }
  }

  // ── COLLECTION PAGE CHECKS ───────────────────────
  if (pageType === 'collection') {
    if (!mobile.hasFilterBar) {
      add({
        type:          'VISUAL',
        priority:      'MEDIUM',
        category:      'CONVERSION',
        title:         'No Filter or Sort Options on Collection Page',
        description:   'No filter or sort functionality detected. Shoppers browsing collections need to filter by price, size, or color. Without filters, high-intent buyers leave rather than scroll through all products.',
        impact:        9000,
        effortMinutes: 30,
        location:      'Collection page — filter bar',
        pageType,
        domData:       { hasFilterBar: false },
        fixDescription: 'Enable filters in Online Store → Navigation → Filters. Enable sort options in Theme Customizer → Collection pages.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }
  }

  // ── CART PAGE CHECKS ─────────────────────────────
  if (pageType === 'cart') {
    if (mobile.cartItemCount > 0 && !mobile.hasCartUpsell) {
      add({
        type:          'VISUAL',
        priority:      'MEDIUM',
        category:      'CONVERSION',
        title:         'No Upsell or Cross-Sell in Cart Page',
        description:   'Cart page has no product recommendations or upsell offers. Cart upsells increase average order value by 10-30% with minimal friction.',
        impact:        12000,
        effortMinutes: 60,
        location:      'Cart page — below items',
        pageType,
        domData:       { hasCartUpsell: false },
        fixDescription: 'Add a "You might also like" or "Complete the look" section to your cart page. Available via cart template customization or a dedicated upsell app.',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }
  }

  // ── MOBILE UX CHECKS — all pages ─────────────────

  // Horizontal scroll
  if (mobile.hasHorizontalScroll) {
    add({
      type:          'VISUAL',
      priority:      'CRITICAL',
      category:      'MOBILE',
      title:         'Horizontal Scrollbar Present on Mobile — Broken Layout',
      description:   'Your store has horizontal overflow on mobile. This breaks the layout and signals poor quality to visitors. A horizontally scrolling page loses 40%+ of mobile visitors immediately.',
      impact:        20000,
      effortMinutes: 60,
      location:      `${pageType} page — mobile layout`,
      pageType,
      domData:       { hasHorizontalScroll: true },
      fixDescription: 'Add `overflow-x: hidden` to body and html in your theme CSS. Then find the element causing overflow — usually a wide image, table, or section with a fixed pixel width.',
      cssFixTarget:   'body, html',
    });
  }

  // Small tap targets
  if (mobile.tooSmallTapTargets > 5) {
    add({
      type:          'VISUAL',
      priority:      'HIGH',
      category:      'MOBILE',
      title:         `${mobile.tooSmallTapTargets} Tap Targets Too Small for Mobile (Under 44px)`,
      description:   `${mobile.tooSmallTapTargets} buttons and links are smaller than Apple's recommended 44×44px minimum tap size. Small tap targets cause mis-taps and frustration on mobile.`,
      impact:        7000,
      effortMinutes: 90,
      location:      `${pageType} page — multiple elements`,
      pageType,
      domData:       { smallTapTargets: mobile.tooSmallTapTargets },
      fixDescription: 'Increase padding on small buttons and links. Target minimum 44px height for all interactive elements. Add CSS: `a, button { min-height: 44px; padding: 12px; }`',
      cssFixTarget:   'a, button, .nav-link',
    });
  }

  // Font too small
  if (mobile.averageFontSizePx > 0 && mobile.averageFontSizePx < 14) {
    add({
      type:          'VISUAL',
      priority:      'MEDIUM',
      category:      'MOBILE',
      title:         `Average Font Size ${mobile.averageFontSizePx}px — Too Small for Mobile Reading`,
      description:   `Average text size is ${mobile.averageFontSizePx}px on mobile. Google recommends minimum 16px. Small text forces visitors to zoom in, increasing bounce rate.`,
      impact:        5000,
      effortMinutes: 30,
      location:      `${pageType} page — body text`,
      pageType,
      domData:       { avgFontSize: mobile.averageFontSizePx },
      fixDescription: 'Increase base font size in theme settings or add CSS: `body { font-size: 16px; }`. Check Theme Customizer → Typography for font size controls.',
      cssFixTarget:   'body, p, .rte',
    });
  }

  // DOM too large
  if (mobile.domElementCount > 1500) {
    add({
      type:          'VISUAL',
      priority:      'HIGH',
      category:      'SPEED',
      title:         `DOM Has ${mobile.domElementCount} Elements — Severely Impacting Performance`,
      description:   `Your page has ${mobile.domElementCount} DOM elements. Google recommends under 1,500. Excessive DOM slows rendering, makes scrolling janky, and increases memory usage on mobile.`,
      impact:        11000,
      effortMinutes: 120,
      location:      `${pageType} page — DOM structure`,
      pageType,
      domData:       { domCount: mobile.domElementCount },
      fixDescription: 'Audit installed apps — each one adds DOM elements. Remove unused apps. Use lazy loading for sections below the fold. Consider a lighter theme.',
      shopifyAdminUrl: 'https://admin.shopify.com/store/apps',
    });
  }

  // Too many scripts
  if (mobile.scriptCount > 15) {
    add({
      type:          'VISUAL',
      priority:      'HIGH',
      category:      'SPEED',
      title:         `${mobile.scriptCount} JavaScript Files Loading on ${pageType} Page`,
      description:   `${mobile.scriptCount} separate script files detected. Each requires a separate HTTP request and parsing time. This is significantly above the recommended maximum of 8.`,
      impact:        14000,
      effortMinutes: 90,
      location:      `${pageType} page — script loading`,
      pageType,
      domData:       { scriptCount: mobile.scriptCount },
      fixDescription: 'Identify which apps are loading scripts. Remove any app you do not actively use. Consolidate functionality into fewer apps where possible.',
      shopifyAdminUrl: 'https://admin.shopify.com/store/apps',
    });
  }

  return issues;
}

// ── Calculate visual score ────────────────────────────
function calculateVisualScore(issues) {
  let score = 100;
  for (const issue of issues) {
    if (issue.priority === 'CRITICAL') score -= 15;
    else if (issue.priority === 'HIGH') score -= 8;
    else if (issue.priority === 'MEDIUM') score -= 4;
    else score -= 2;
  }
  return Math.max(0, Math.min(100, score));
}

// ── AI insights from visual data ─────────────────────
async function generateVisualInsights(shopDomain, issues, pageResults, plan) {
  if (!issues.length) {
    return 'Visual analysis found no significant conversion issues. Your store layout appears well-optimised.';
  }

  const topIssues = issues.slice(0, 5).map(i =>
    `${i.priority}: ${i.title} — ₹${i.impact.toLocaleString('en-IN')}/mo estimated impact`
  ).join('\n');

  const totalImpact = issues.reduce((s, i) => s + i.impact, 0);

  const prompt = `You are an expert Shopify conversion rate optimiser. Analyse these visual audit findings for ${shopDomain}:

Top Issues Found:
${topIssues}

Total estimated monthly revenue impact: ₹${totalImpact.toLocaleString('en-IN')}
Pages scanned: ${Object.keys(pageResults).join(', ')}
Total issues: ${issues.length}

Write a 2-sentence executive summary. Be specific about the biggest visual conversion problem and its business impact. Use Indian rupees.`;

  try {
    const response = await ai.models.generateContent({
      model:      'gemini-3.5-flash',
      contents:   prompt,
      config:     { maxOutputTokens: 150 },
    });
    return response.text?.trim() || '';
  } catch (err) {
    logger.warn('Visual insights AI call failed:', err.message);
    return `Visual analysis found ${issues.length} conversion issues with an estimated ₹${totalImpact.toLocaleString('en-IN')}/month revenue impact. The highest priority fix is: ${issues[0]?.title}.`;
  }
}
