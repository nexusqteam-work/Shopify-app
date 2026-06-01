// ═══════════════════════════════════════════════════
//  Database Seed — Dev/Demo Data
//  Run: node scripts/seed.js
// ═══════════════════════════════════════════════════

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/utils/encryption.js';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo merchant
  const merchant = await db.merchant.upsert({
    where:  { shopDomain: 'demo-store.myshopify.com' },
    create: {
      shopDomain:  'demo-store.myshopify.com',
      shopName:    'Aura Lifestyle Store',
      email:       'owner@auralifestyle.in',
      accessToken: encrypt('shpat_demo_token_not_real'),
      plan:        'GROWTH',
      currency:    'INR',
      timezone:    'Asia/Kolkata',
    },
    update: {},
  });
  console.log(`✅ Merchant: ${merchant.shopName}`);

  // Create completed audit
  const audit = await db.audit.create({
    data: {
      merchantId:      merchant.id,
      status:          'COMPLETED',
      overallScore:    52,
      totalRevenueLoss: 105000,
      speedScore:      38,
      seoScore:        61,
      conversionScore: 44,
      productScore:    52,
      checkoutScore:   71,
      mobileScore:     45,
      aiSummary:       'Aura Lifestyle Store scored 52/100, significantly below the industry average of 72. The most critical issue is page speed — at 7.8 seconds on mobile, the store is losing approximately ₹38,000/month in potential revenue. Fixing the JavaScript bloat from 11 installed apps and enabling urgency signals on product pages would recover an estimated ₹62,000/month within 48 hours of implementation.',
      completedAt:     new Date(),
    },
  });
  console.log(`✅ Audit created: ${audit.id}`);

  // Create demo issues
  const issues = await db.issue.createMany({
    data: [
      {
        merchantId:      merchant.id,
        auditId:         audit.id,
        priority:        'CRITICAL',
        category:        'SPEED',
        title:           '11 Apps Injecting 2.4MB of JavaScript',
        description:     'Your store loads in 7.8 seconds on mobile. Industry benchmark is under 3 seconds. Each extra second costs ~7% conversion. 3 apps are the biggest offenders.',
        impact:          38000,
        effortMinutes:   120,
        fixInstructions: '1. Go to Shopify Admin → Apps\n2. Remove ReviewBuddy Pro (423KB)\n3. Remove LiveChat Plus (380KB)\n4. Remove ExitPop Master (290KB)\n5. Replace with Shopify native alternatives\n6. Re-audit to confirm improvement',
        shopifyAdminUrl: 'https://admin.shopify.com/store/apps',
      },
      {
        merchantId:      merchant.id,
        auditId:         audit.id,
        priority:        'CRITICAL',
        category:        'CONVERSION',
        title:           'No Urgency Signals on Product Pages',
        description:     'Your top 12 products have zero urgency signals. Competitors show scarcity badges and social proof on every product page, driving higher conversion rates.',
        impact:          24000,
        effortMinutes:   30,
        fixInstructions: '1. Go to Theme Customizer\n2. Enable stock badges in product settings\n3. Add "X people viewing" counter via free app\n4. Add limited-time offer banner for promotions',
        shopifyAdminUrl: 'https://admin.shopify.com/store/themes',
      },
      {
        merchantId:      merchant.id,
        auditId:         audit.id,
        priority:        'HIGH',
        category:        'MOBILE',
        title:           'Mobile Checkout Has 7-Step Form',
        description:     'Mobile checkout abandonment is at 68%. Your checkout has 7 required fields. Best practice is 4 or fewer. Phone and company fields are unnecessary.',
        impact:          19000,
        effortMinutes:   15,
        fixInstructions: '1. Settings → Checkout\n2. Set Phone Number to Hidden\n3. Set Company to Hidden\n4. Enable Shop Pay for 1-tap checkout',
        shopifyAdminUrl: 'https://admin.shopify.com/store/settings/checkout',
      },
      {
        merchantId:      merchant.id,
        auditId:         audit.id,
        priority:        'HIGH',
        category:        'SEO',
        title:           '43 Products Missing Meta Descriptions',
        description:     '43 of 87 products have blank meta descriptions. Google auto-generates poor ones, hurting click-through rates from search results.',
        impact:          16000,
        effortMinutes:   180,
        fixInstructions: '1. Go to each product → SEO section\n2. Write 150-160 char meta description\n3. Include main keyword + benefit\n4. Use bulk editor for efficiency',
        shopifyAdminUrl: 'https://admin.shopify.com/store/products',
      },
      {
        merchantId:      merchant.id,
        auditId:         audit.id,
        priority:        'MEDIUM',
        category:        'PRODUCT',
        title:           'Product Images Below 1000px on 18 Products',
        description:     '18 products have images smaller than 1000x1000px. Shopify zoom requires 2048px+. Low-res images reduce buyer confidence.',
        impact:          8000,
        effortMinutes:   240,
        fixInstructions: '1. Use AI upscaler: letsenhance.io\n2. Upload images, upscale to 2048px\n3. Re-upload to Shopify products\n4. Priority: top 18 by revenue',
        shopifyAdminUrl: 'https://admin.shopify.com/store/products',
      },
    ],
  });
  console.log(`✅ Issues created: ${issues.count}`);

  // Create 30 days of metrics
  const metricsData = [];
  const baseRevenue = 14000;
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const variance   = 0.7 + Math.random() * 0.6;
    const revenue    = Math.round(baseRevenue * variance);
    const orders     = Math.round(revenue / 1545);
    const visitors   = Math.round(orders / 0.0169);
    metricsData.push({
      merchantId:     merchant.id,
      date,
      revenue,
      orders,
      visitors,
      conversionRate: parseFloat((1.5 + Math.random() * 0.5).toFixed(2)),
      avgOrderValue:  Math.round(revenue / Math.max(orders, 1)),
      newCustomers:   Math.round(orders * 0.35),
      refundRate:     parseFloat((2 + Math.random() * 2).toFixed(2)),
    });
  }
  await db.storeMetric.createMany({ data: metricsData, skipDuplicates: true });
  console.log(`✅ Metrics: 30 days seeded`);

  // Create demo competitors
  await db.competitor.createMany({
    data: [
      { merchantId: merchant.id, storeName: 'ZenHome Store',   storeUrl: 'zenhome.myshopify.com',   niche: 'lifestyle', threatLevel: 'HIGH' },
      { merchantId: merchant.id, storeName: 'UrbanNest Co.',   storeUrl: 'urbannest.myshopify.com', niche: 'lifestyle', threatLevel: 'MEDIUM' },
      { merchantId: merchant.id, storeName: 'PureVibe Shop',   storeUrl: 'purevibe.myshopify.com',  niche: 'lifestyle', threatLevel: 'LOW' },
    ],
    skipDuplicates: true,
  });
  console.log(`✅ Competitors seeded`);

  // Create welcome notification
  await db.notification.create({
    data: {
      merchantId: merchant.id,
      type:       'audit_complete',
      title:      'First Audit Complete! 🎉',
      body:       'Found 5 issues costing ₹1,05,000/month. Check your Action Plan to start fixing.',
      data:       { auditId: audit.id },
    },
  });
  console.log(`✅ Notifications seeded`);

  console.log('\n🎉 Seed complete!');
  console.log(`   Merchant ID: ${merchant.id}`);
  console.log(`   Shop: ${merchant.shopDomain}`);
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => db.$disconnect());
