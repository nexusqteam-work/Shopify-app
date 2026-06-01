// ═══════════════════════════════════════════════════
//  routes/webhooks.js — Shopify Webhook Handlers
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { verifyWebhookHmac } from '../services/shopify.js';

const router = Router();

// ── HMAC verification middleware for all webhooks ────
function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const shopDomain = req.headers['x-shopify-shop-domain'];

  if (!hmacHeader || !shopDomain) {
    return res.status(401).json({ error: 'Missing webhook headers' });
  }

  // req.body is raw Buffer (see index.js)
  const rawBody = req.body;
  if (!verifyWebhookHmac(rawBody, hmacHeader)) {
    logger.warn(`Invalid webhook HMAC from ${shopDomain}`);
    return res.status(401).json({ error: 'HMAC verification failed' });
  }

  // Parse body for handler use
  try {
    req.webhookBody = JSON.parse(rawBody.toString());
    req.shopDomain  = shopDomain;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  next();
}

router.use(verifyShopifyWebhook);

// ── App Uninstalled ──────────────────────────────────
router.post('/app-uninstalled', async (req, res) => {
  try {
    const { shopDomain } = req;
    logger.info(`App uninstalled: ${shopDomain}`);

    await db.merchant.updateMany({
      where: { shopDomain },
      data:  { isActive: false, accessToken: '' },
    });

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('app/uninstalled webhook error:', err);
    res.status(200).json({ received: true }); // Always 200 to Shopify
  }
});

// ── Order Created ────────────────────────────────────
router.post('/orders-create', async (req, res) => {
  try {
    const { shopDomain, webhookBody: order } = req;

    const merchant = await db.merchant.findUnique({
      where:  { shopDomain },
      select: { id: true },
    });
    if (!merchant) return res.status(200).json({ received: true });

    // Update today's metrics incrementally
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orderValue = parseFloat(order.total_price || 0);

    await db.storeMetric.upsert({
      where:  { merchantId_date: { merchantId: merchant.id, date: today } },
      create: {
        merchantId:     merchant.id,
        date:           today,
        revenue:        orderValue,
        orders:         1,
        avgOrderValue:  orderValue,
        newCustomers:   order.customer?.orders_count === 1 ? 1 : 0,
        visitors:       0,
        conversionRate: 0,
      },
      update: {
        revenue:      { increment: orderValue },
        orders:       { increment: 1 },
        newCustomers: order.customer?.orders_count === 1 ? { increment: 1 } : undefined,
      },
    });

    logger.info(`Order ${order.id} tracked for ${shopDomain}`);
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('orders/create webhook error:', err);
    res.status(200).json({ received: true });
  }
});

// ── Order Updated ────────────────────────────────────
router.post('/orders-updated', async (req, res) => {
  try {
    const { shopDomain, webhookBody: order } = req;

    // Handle refunds
    if (order.refunds?.length > 0 && order.financial_status === 'refunded') {
      const merchant = await db.merchant.findUnique({
        where: { shopDomain }, select: { id: true },
      });
      if (merchant) {
        const orderDate = new Date(order.created_at);
        orderDate.setHours(0, 0, 0, 0);
        await db.storeMetric.updateMany({
          where: { merchantId: merchant.id, date: orderDate },
          data:  { refundRate: { increment: 0.01 } },
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('orders/updated webhook error:', err);
    res.status(200).json({ received: true });
  }
});

// ── Products Created/Updated ─────────────────────────
router.post('/products-create', async (req, res) => {
  res.status(200).json({ received: true });
});

router.post('/products-update', async (req, res) => {
  // Could trigger a partial re-audit of product category
  res.status(200).json({ received: true });
});

// ── Shop Updated ─────────────────────────────────────
router.post('/shop-update', async (req, res) => {
  try {
    const { shopDomain, webhookBody: shop } = req;
    await db.merchant.updateMany({
      where: { shopDomain },
      data:  { shopName: shop.name, email: shop.email },
    });
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('shop/update webhook error:', err);
    res.status(200).json({ received: true });
  }
});

export default router;
