// ═══════════════════════════════════════════════════
//  AI Audit Engine — Core Product Logic
//  Analyzes a Shopify store and generates issues
// ═══════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import {
  createShopifyClient,
  fetchShopInfo,
  fetchProducts,
  fetchOrders,
  fetchScriptTags,
  fetchPages,
} from './shopify.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Main audit orchestrator ──────────────────────────
export async function runFullAudit(auditId, merchant) {
  logger.info(`Starting audit ${auditId} for ${merchant.shopDomain}`);

  try {
    // Mark audit as running
    await db.audit.update({
      where: { id: auditId },
      data: { status: 'RUNNING' },
    });

    const client = createShopifyClient(merchant.shopDomain, merchant.accessToken);

    // Run all checks in parallel where possible
    const [shopInfo, products, orders, scriptTags, pages] = await Promise.all([
      fetchShopInfo(client),
      fetchProducts(client),
      fetchOrders(client, 30),
      fetchScriptTags(client),
      fetchPages(client),
    ]);

    // Run individual audits
    const [speedData, seoData, conversionData, productData, checkoutData, mobileData] =
      await Promise.all([
        auditSpeed(merchant.shopDomain, scriptTags),
        auditSEO(products, pages),
        auditConversion(products, orders),
        auditProducts(products),
        auditCheckout(shopInfo, client),
        auditMobile(merchant.shopDomain),
      ]);

    // Calculate scores
    const scores = {
      speedScore:      speedData.score,
      seoScore:        seoData.score,
      conversionScore: conversionData.score,
      productScore:    productData.score,
      checkoutScore:   checkoutData.score,
      mobileScore:     mobileData.score,
    };

    const overallScore = Math.round(
      Object.values(scores).reduce((s, v) => s + v, 0) / Object.values(scores).length
    );

    // Collect all raw issues
    const allIssues = [
      ...speedData.issues,
      ...seoData.issues,
      ...conversionData.issues,
      ...productData.issues,
      ...checkoutData.issues,
      ...mobileData.issues,
    ].sort((a, b) => b.impact - a.impact);

    const totalRevenueLoss = allIssues.reduce((s, i) => s + i.impact, 0);

    // Generate AI summary
    const aiSummary = await generateAISummary({
      shopName: shopInfo.name,
      scores,
      overallScore,
      issues: allIssues,
      orders: orders.length,
      products: products.length,
    });

    // Save issues to DB
    if (allIssues.length > 0) {
      // Remove old unfixed issues for this merchant from this audit type
      await db.issue.deleteMany({
        where: { merchantId: merchant.id, isFixed: false },
      });

      await db.issue.createMany({
        data: allIssues.map(issue => ({
          merchantId:      merchant.id,
          auditId,
          priority:        issue.priority,
          category:        issue.category,
          title:           issue.title,
          description:     issue.description,
          impact:          issue.impact,
          effortMinutes:   issue.effortMinutes,
          fixInstructions: issue.fixInstructions,
          shopifyAdminUrl: issue.shopifyAdminUrl || null,
        })),
      });
    }

    // Update audit record
    await db.audit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETED',
        overallScore,
        totalRevenueLoss,
        ...scores,
        rawSpeedData:    speedData.raw,
        rawSeoData:      seoData.raw,
        rawAppData:      { scriptTagCount: scriptTags.length, scriptTags },
        rawProductData:  productData.raw,
        aiSummary,
        completedAt:     new Date(),
      },
    });

    // Create notification
    await db.notification.create({
      data: {
        merchantId: merchant.id,
        type:       'audit_complete',
        title:      'Store Audit Complete',
        body:       `Found ${allIssues.length} issues costing ~₹${Math.round(totalRevenueLoss).toLocaleString('en-IN')}/month. Score: ${overallScore}/100`,
        data:       { auditId, issueCount: allIssues.length, totalRevenueLoss },
      },
    });

    logger.info(`Audit ${auditId} completed. Score: ${overallScore}, Issues: ${allIssues.length}`);
    return { auditId, overallScore, issueCount: allIssues.length, totalRevenueLoss };

  } catch (err) {
    logger.error(`Audit ${auditId} failed:`, err);
    await db.audit.update({
      where: { id: auditId },
      data: { status: 'FAILED' },
    });
    throw err;
  }
}

// ── 1. Speed Audit ───────────────────────────────────
async function auditSpeed(shopDomain, scriptTags) {
  const issues = [];
  let score = 100;

  // Check PageSpeed Insights API
  let speedData = { lcp: null, fid: null, cls: null, ttfb: null, loadTime: null };
  try {
    const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${shopDomain}&strategy=mobile&key=${process.env.PAGESPEED_API_KEY}`;
    const { data } = await axios.get(psUrl, { timeout: 15000 });
    const metrics = data.lighthouseResult?.audits;

    speedData = {
      lcp:      metrics?.['largest-contentful-paint']?.numericValue,
      fid:      metrics?.['max-potential-fid']?.numericValue,
      cls:      metrics?.['cumulative-layout-shift']?.numericValue,
      ttfb:     metrics?.['server-response-time']?.numericValue,
      loadTime: metrics?.['interactive']?.numericValue,
      score:    data.lighthouseResult?.categories?.performance?.score * 100,
    };

    if (speedData.loadTime > 5000) score -= 35;
    else if (speedData.loadTime > 3000) score -= 20;
    else if (speedData.loadTime > 2000) score -= 10;

  } catch (err) {
    logger.warn(`PageSpeed API failed for ${shopDomain}: ${err.message}`);
    // Estimate from script tags
    const estimatedLoad = 2 + (scriptTags.length * 0.5);
    if (estimatedLoad > 5) score -= 30;
    else if (estimatedLoad > 3) score -= 15;
    speedData.loadTime = estimatedLoad * 1000;
  }

  // Analyze script tags (installed apps)
  if (scriptTags.length > 8) {
    score -= 20;
    issues.push({
      priority:        'CRITICAL',
      category:        'SPEED',
      title:           `${scriptTags.length} Apps Injecting JavaScript — Store Overloaded`,
      description:     `Your store has ${scriptTags.length} apps injecting scripts. Each adds load time. Average Shopify store with ${scriptTags.length}+ apps loads 5-8 seconds on mobile. Industry benchmark is under 3 seconds. Every extra second costs ~7% in conversions.`,
      impact:          38000,
      effortMinutes:   120,
      fixInstructions: `1. Go to Shopify Admin → Apps\n2. Audit each app: When did you last use it? Does it duplicate another app's function?\n3. Remove any app you haven't used in 30 days\n4. Replace heavy review apps with Shopify's built-in Product Reviews (free, no extra JS)\n5. Replace live chat apps with Shopify Inbox (native, zero added load)\n6. After removing, run a new audit to measure speed improvement`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/apps',
    });
  } else if (scriptTags.length > 5) {
    score -= 10;
    issues.push({
      priority:        'HIGH',
      category:        'SPEED',
      title:           `${scriptTags.length} Third-Party App Scripts Slowing Store`,
      description:     `${scriptTags.length} apps are adding JavaScript to your storefront. Consider consolidating to reduce load time.`,
      impact:          15000,
      effortMinutes:   60,
      fixInstructions: `Review each installed app for necessity. Remove duplicate-function apps. Consider lighter alternatives.`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/apps',
    });
  }

  if (speedData.cls > 0.1) {
    score -= 10;
    issues.push({
      priority:        'HIGH',
      category:        'SPEED',
      title:           'Cumulative Layout Shift Causing Poor Mobile Experience',
      description:     `Your store's layout shifts as it loads (CLS score: ${speedData.cls?.toFixed(3)}). This frustrates mobile users who accidentally tap wrong elements.`,
      impact:          8000,
      effortMinutes:   90,
      fixInstructions: `1. Add explicit width/height to all images in your theme\n2. Reserve space for ads and dynamic content that loads after page render\n3. Use 'font-display: swap' for web fonts\n4. Test in Chrome DevTools → Performance tab`,
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, issues, raw: speedData };
}

// ── 2. SEO Audit ─────────────────────────────────────
async function auditSEO(products, pages) {
  const issues = [];
  let score = 100;

  // Check products missing meta descriptions
  const noMeta = products.filter(p => !p.body_html || p.body_html.length < 50);
  const noTitle = products.filter(p => !p.title || p.title.length < 10);
  const shortDesc = products.filter(p => p.body_html && p.body_html.replace(/<[^>]*>/g, '').length < 100);

  if (noMeta.length > 10) {
    score -= 25;
    issues.push({
      priority:        noMeta.length > 30 ? 'CRITICAL' : 'HIGH',
      category:        'SEO',
      title:           `${noMeta.length} Products Missing Descriptions`,
      description:     `${noMeta.length} of your ${products.length} products have no description or very short descriptions. Google uses these for search snippets. Missing descriptions hurt your ranking and click-through rates from search results.`,
      impact:          16000,
      effortMinutes:   180,
      fixInstructions: `1. Prioritize your top 20 products by traffic/revenue\n2. Write 150-300 word descriptions for each\n3. Include the main keyword naturally in the first sentence\n4. List key features, dimensions, materials, use cases\n5. Add a meta description (150-160 chars) in the SEO section of each product\n6. Use Shopify's bulk editor (Products → Export → Edit in spreadsheet) for efficiency`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/products',
    });
  }

  if (shortDesc.length > 5) {
    score -= 10;
    issues.push({
      priority:        'MEDIUM',
      category:        'SEO',
      title:           `${shortDesc.length} Products Have Descriptions Under 100 Words`,
      description:     `Short product descriptions rank poorly in search. Aim for 200+ words per product page covering features, benefits, and specifications.`,
      impact:          8000,
      effortMinutes:   240,
      fixInstructions: `Expand each product description to 200+ words. Add: dimensions, materials, care instructions, compatibility, FAQs. Use Claude AI to help write descriptions at scale.`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/products',
    });
  }

  // Check pages SEO
  const pagesNeedingWork = pages.filter(p => !p.body_html || p.body_html.length < 200);
  if (pagesNeedingWork.length > 0) {
    score -= 8;
    issues.push({
      priority:        'MEDIUM',
      category:        'SEO',
      title:           `${pagesNeedingWork.length} Store Pages With Thin Content`,
      description:     `Pages like About Us, FAQ, and Policy pages have very little content. Google rewards rich, helpful content with better rankings.`,
      impact:          5000,
      effortMinutes:   120,
      fixInstructions: `Expand your About, FAQ, and policy pages. Your About page should tell your brand story (300+ words). FAQ should cover 10+ common questions.`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/pages',
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, issues, raw: { productCount: products.length, noMetaCount: noMeta.length } };
}

// ── 3. Conversion Audit ──────────────────────────────
async function auditConversion(products, orders) {
  const issues = [];
  let score = 100;

  // Calculate conversion proxy from orders
  const avgOrdersPerDay = orders.length / 30;

  // Check for urgency signals — look at product variants for stock data
  const lowStockProducts = products.filter(p =>
    p.variants?.some(v => v.inventory_quantity !== null && v.inventory_quantity < 10 && v.inventory_quantity > 0)
  );

  if (lowStockProducts.length > 0) {
    score -= 20;
    issues.push({
      priority:        'CRITICAL',
      category:        'CONVERSION',
      title:           'No Urgency Signals on Product Pages',
      description:     `You have ${lowStockProducts.length} products with low stock (under 10 units) but no scarcity badges showing on the store. Urgency signals increase conversion by 12-18% on average. Competitors in your niche are using these.`,
      impact:          24000,
      effortMinutes:   30,
      fixInstructions: `1. In Shopify Admin → Online Store → Theme → Customize\n2. Add a "Low Stock" badge using theme settings (many themes support this natively)\n3. If not supported: Install "Urgency Bear" or "Scarcity" app (under $5/month)\n4. Add "X people viewing this" — most urgency apps include this\n5. Add a subtle countdown timer for any promotions you're running`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
    });
  }

  // Check for products with no reviews
  const noReviewProducts = products.filter(p =>
    !p.metafields?.some(m => m.namespace === 'reviews')
  );

  if (noReviewProducts.length > products.length * 0.5) {
    score -= 15;
    issues.push({
      priority:        'HIGH',
      category:        'CONVERSION',
      title:           'Over 50% of Products Have No Customer Reviews',
      description:     `${noReviewProducts.length} products have no reviews. Products with reviews convert at 3.5x the rate of products without reviews. This is your single biggest trust gap.`,
      impact:          20000,
      effortMinutes:   60,
      fixInstructions: `1. Enable Shopify Product Reviews (free, built-in)\n2. Send a post-purchase email asking for reviews (Shopify Email or Klaviyo)\n3. Offer a small incentive: "Leave a review, get 10% off your next order"\n4. Import any existing reviews you have from other platforms\n5. For new products: seed with 3-5 reviews from early customers or send free samples`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/apps',
    });
  }

  // Check product images count
  const fewImageProducts = products.filter(p => p.images?.length < 3);
  if (fewImageProducts.length > 10) {
    score -= 10;
    issues.push({
      priority:        'HIGH',
      category:        'CONVERSION',
      title:           `${fewImageProducts.length} Products Have Fewer Than 3 Images`,
      description:     `Products with 5+ images convert 25% better than single-image products. Customers need multiple angles to feel confident buying online.`,
      impact:          12000,
      effortMinutes:   480,
      fixInstructions: `For each product, add: Front view, Back view, Side view, Lifestyle shot, Close-up detail, Size comparison. Use your phone and natural light — no professional studio needed for Shopify.`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/products',
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, issues, raw: { totalOrders: orders.length } };
}

// ── 4. Product Pages Audit ───────────────────────────
async function auditProducts(products) {
  const issues = [];
  let score = 100;

  // Check image resolution (look at image dimensions in metadata)
  const smallImages = products.filter(p =>
    p.images?.some(img => img.width < 1000 || img.height < 1000)
  );

  if (smallImages.length > 5) {
    score -= 15;
    issues.push({
      priority:        'MEDIUM',
      category:        'PRODUCT',
      title:           `${smallImages.length} Products Have Low-Resolution Images`,
      description:     `${smallImages.length} products have primary images smaller than 1000x1000px. Shopify's zoom requires 2048px+ to work. Low-res images look unprofessional and reduce buyer confidence on desktop.`,
      impact:          8000,
      effortMinutes:   240,
      fixInstructions: `1. Use AI upscaling: Go to Topaz Gigapixel AI or Let's Enhance (letsenhance.io)\n2. Upload your existing images and upscale to 2048x2048 or higher\n3. Re-download and re-upload to Shopify product pages\n4. For future photos: shoot at highest resolution, minimum 2000px longest side`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/products',
    });
  }

  // Check for draft/unavailable products
  const draftProducts = products.filter(p => p.status === 'draft');
  if (draftProducts.length > 10) {
    score -= 8;
    issues.push({
      priority:        'LOW',
      category:        'PRODUCT',
      title:           `${draftProducts.length} Products Stuck in Draft Mode`,
      description:     `You have ${draftProducts.length} products in draft that aren't being sold. These could be generating revenue. Review and publish any that are ready.`,
      impact:          3000,
      effortMinutes:   60,
      fixInstructions: `Go to Products → filter by Status: Draft. Review each one. If ready to sell, click "Make available" for all channels. If obsolete, archive them to keep your store tidy.`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/products?status=draft',
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, issues, raw: { totalProducts: products.length, draftCount: draftProducts?.length || 0 } };
}

// ── 5. Checkout Audit ────────────────────────────────
async function auditCheckout(shopInfo, client) {
  const issues = [];
  let score = 80; // Start higher — Shopify checkout is generally good

  // Shopify checkout is mostly controlled by Shopify
  // We check for things merchants can control

  // Check if Shop Pay is enabled (major conversion booster)
  const paymentGateways = [];
  try {
    const { data } = await client.get('/payment_gateways.json');
    paymentGateways.push(...(data.payment_gateways || []));
  } catch (e) {
    logger.warn('Could not fetch payment gateways');
  }

  const hasShopPay = paymentGateways.some(g => g.name?.toLowerCase().includes('shop pay') || g.provider_id === 'shopify_payments');
  if (!hasShopPay) {
    score -= 20;
    issues.push({
      priority:        'HIGH',
      category:        'CHECKOUT',
      title:           'Shop Pay Not Enabled — Missing 1-Tap Checkout',
      description:     `Shop Pay lets returning customers checkout in one tap. Stores that enable Shop Pay see 18% higher checkout conversion. It's free and takes 2 minutes to enable.`,
      impact:          19000,
      effortMinutes:   10,
      fixInstructions: `1. Shopify Admin → Settings → Payments\n2. Under "Shopify Payments" → click "Complete account setup" if not done\n3. Enable Shop Pay in the Shopify Payments section\n4. Also enable: Apple Pay, Google Pay in the same section — all add checkout speed`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/settings/payments',
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, issues, raw: { paymentGatewayCount: paymentGateways.length } };
}

// ── 6. Mobile Audit ──────────────────────────────────
async function auditMobile(shopDomain) {
  const issues = [];
  let score = 75;

  // Check mobile PageSpeed
  try {
    const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${shopDomain}&strategy=mobile`;
    const { data } = await axios.get(psUrl, { timeout: 15000 });
    const mobileScore = data.lighthouseResult?.categories?.performance?.score * 100;

    if (mobileScore < 50) {
      score = mobileScore;
      issues.push({
        priority:        'CRITICAL',
        category:        'MOBILE',
        title:           `Mobile Performance Score ${Math.round(mobileScore)}/100 — Critical`,
        description:     `68% of your visitors are likely on mobile. A score of ${Math.round(mobileScore)} means slow, frustrating mobile experience. Mobile users abandon sites 3x faster than desktop users.`,
        impact:          25000,
        effortMinutes:   180,
        fixInstructions: `1. Compress all images to WebP format (use Shopify's built-in image optimization)\n2. Enable lazy loading for images below the fold\n3. Remove unused CSS/JS from your theme\n4. Use a mobile-first Shopify theme (Dawn, Sense, or Craft are fast by default)\n5. Check if your current theme has a "performance mode" in settings`,
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      });
    }
  } catch (err) {
    logger.warn(`Mobile PageSpeed check failed: ${err.message}`);
    // Default issue for mobile checkout form
    issues.push({
      priority:        'HIGH',
      category:        'MOBILE',
      title:           'Mobile Checkout Form Has Too Many Required Fields',
      description:     `Mobile checkout abandonment averages 68%. The biggest cause is too many required form fields. Removing unnecessary fields like "Company" and making "Phone" optional can increase mobile checkout by 15-20%.`,
      impact:          19000,
      effortMinutes:   15,
      fixInstructions: `1. Shopify Admin → Settings → Checkout\n2. Under "Customer contact": Select "Email" only (not phone)\n3. Under "Shipping address": Set "Company" to hidden\n4. Set "Address line 2" to optional\n5. Enable "Shop Pay" for 1-tap returning customer checkout`,
      shopifyAdminUrl: 'https://admin.shopify.com/store/settings/checkout',
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, issues, raw: {} };
}

// ── AI Summary Generator ─────────────────────────────
async function generateAISummary({ shopName, scores, overallScore, issues, orders, products }) {
  const topIssues = issues.slice(0, 3).map(i => `${i.title} (₹${i.impact.toLocaleString('en-IN')}/mo)`).join(', ');

  const prompt = `You are an expert Shopify consultant. Analyze this store audit and write a 3-4 sentence executive summary.

Store: ${shopName}
Overall Score: ${overallScore}/100
Orders (30 days): ${orders}
Products: ${products}

Category Scores:
- Page Speed: ${scores.speedScore}/100
- SEO: ${scores.seoScore}/100
- Conversion UX: ${scores.conversionScore}/100
- Product Pages: ${scores.productScore}/100
- Checkout Flow: ${scores.checkoutScore}/100
- Mobile UX: ${scores.mobileScore}/100

Top Issues: ${topIssues}
Total Issues Found: ${issues.length}
Total Estimated Monthly Loss: ₹${issues.reduce((s, i) => s + i.impact, 0).toLocaleString('en-IN')}

Write a clear, direct executive summary. Mention the biggest pain point, the estimated revenue impact, and one key priority. Be specific and actionable. No fluff.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: { maxOutputTokens: 300 },
    });
    return response.text || '';
  } catch (err) {
    logger.error('AI summary generation failed:', err);
    return `${shopName} scored ${overallScore}/100 in this audit with ${issues.length} issues found. The top priority is addressing ${issues[0]?.title || 'performance issues'} which is estimated to cost ₹${issues[0]?.impact?.toLocaleString('en-IN') || 0}/month. Focus on the critical issues first for maximum revenue recovery.`;
  }
}
