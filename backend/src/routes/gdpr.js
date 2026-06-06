// ═══════════════════════════════════════════════════
//  routes/gdpr.js — GDPR Compliance Webhooks
//  REQUIRED by Shopify App Store for approval
//  Topics: customers/redact, shop/redact,
//          customers/data_request
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { verifyWebhookHmac } from '../services/shopify.js';

const router = Router();

// ── HMAC verification for all GDPR webhooks ──────────
function verifyGDPR(req, res, next) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const shopDomain = req.headers['x-shopify-shop-domain'];

  if (!hmacHeader) {
    return res.status(401).json({ error: 'Missing HMAC header' });
  }

  const rawBody = req.body; // raw Buffer from express.raw()
  if (!verifyWebhookHmac(rawBody, hmacHeader)) {
    logger.warn(`Invalid GDPR webhook HMAC from ${shopDomain}`);
    return res.status(401).json({ error: 'HMAC verification failed' });
  }

  try {
    req.webhookBody = JSON.parse(rawBody.toString());
    req.shopDomain = shopDomain;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  next();
}

router.use(verifyGDPR);

// ── POST /api/gdpr/customers/data-request ────────────
// Shopify asks: "What data do you have on this customer?"
// Must respond 200 within 5 seconds.
router.post('/customers/data-request', async (req, res) => {
  try {
    const { shop_domain, customer, orders_requested } = req.webhookBody;
    logger.info(`GDPR data request: shop=${shop_domain} customer=${customer?.id}`);

    // Log the request — in production you would email the data to the merchant
    // Flovix stores: chat messages tied to merchantId (not customer-level)
    // We do NOT store personal customer PII — only aggregate order metrics

    // Acknowledge immediately (Shopify requires < 5s response)
    res.status(200).json({ received: true });

    // In production: send email to merchant with any customer data you hold
    logger.info(`Data request acknowledged for customer ${customer?.id} at ${shop_domain}`);
  } catch (err) {
    logger.error('GDPR data request error:', err);
    res.status(200).json({ received: true }); // Always 200 to Shopify
  }
});

// ── POST /api/gdpr/customers/redact ──────────────────
// Shopify says: "Delete all data for this customer"
router.post('/customers/redact', async (req, res) => {
  try {
    const { shop_domain, customer } = req.webhookBody;
    logger.info(`GDPR customer redact: shop=${shop_domain} customer=${customer?.id}`);

    // Find the merchant
    const merchant = await db.merchant.findUnique({
      where: { shopDomain: shop_domain },
      select: { id: true },
    });

    if (merchant) {
      // Flovix does not store individual customer PII.
      // We store: aggregate store metrics (no customer identifiers)
      // We store: chat messages (merchant's own words, not customer data)
      // Nothing to delete at customer level — log for compliance record.
      logger.info(`GDPR redact complete: no customer PII stored for ${customer?.id}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('GDPR customer redact error:', err);
    res.status(200).json({ received: true });
  }
});

// ── POST /api/gdpr/shop/redact ────────────────────────
// Shopify says: "Merchant uninstalled 48+ days ago — delete ALL their data"
router.post('/shop/redact', async (req, res) => {
  try {
    const { shop_domain } = req.webhookBody;
    logger.info(`GDPR shop redact: ${shop_domain}`);

    const merchant = await db.merchant.findUnique({
      where: { shopDomain: shop_domain },
      select: { id: true, isActive: true },
    });

    if (!merchant) {
      logger.info(`GDPR shop redact: ${shop_domain} not found — already removed`);
      return res.status(200).json({ received: true });
    }

    // Only delete if merchant has been inactive (uninstalled)
    if (!merchant.isActive) {
      // Cascade delete removes all related data via Prisma schema relations:
      // audits, issues, competitors, chat_messages, store_metrics,
      // reports, notifications — all cascade on merchant delete
      await db.merchant.delete({ where: { id: merchant.id } });
      logger.info(`GDPR shop redact complete: all data deleted for ${shop_domain}`);
    } else {
      // Still active — should not happen but log it
      logger.warn(`GDPR shop redact received for ACTIVE merchant: ${shop_domain}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('GDPR shop redact error:', err);
    res.status(200).json({ received: true });
  }
});

export default router;
