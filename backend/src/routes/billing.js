// ═══════════════════════════════════════════════════
//  routes/billing.js — Shopify Billing Webhooks
//  Handles charge accepted / declined / cancelled
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { verifyWebhookHmac } from '../services/shopify.js';
import { authenticate } from '../middleware/auth.js';
import { validate, billingSchema } from '../middleware/validation.js';
import { createShopifyClient, createBillingCharge } from '../services/shopify.js';

const router = Router();

// ── Verify Shopify billing webhooks ──────────────────
function verifyBillingWebhook(req, res, next) {
  const hmac      = req.headers['x-shopify-hmac-sha256'];
  const shopDomain = req.headers['x-shopify-shop-domain'];

  if (!hmac) return res.status(401).json({ error: 'Missing HMAC' });
  if (!verifyWebhookHmac(req.body, hmac)) {
    logger.warn(`Invalid billing webhook HMAC from ${shopDomain}`);
    return res.status(401).json({ error: 'HMAC invalid' });
  }

  try {
    req.webhookBody = JSON.parse(req.body.toString());
    req.shopDomain  = shopDomain;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next();
}

// ── POST /api/billing/webhook ─────────────────────────
// Shopify sends this when charge status changes
router.post('/webhook', verifyBillingWebhook, async (req, res) => {
  try {
    const { shopDomain, webhookBody } = req;
    const chargeId = webhookBody.id;
    const status   = webhookBody.status; // active | declined | cancelled | expired

    logger.info(`Billing webhook: shop=${shopDomain} status=${status} chargeId=${chargeId}`);

    const merchant = await db.merchant.findUnique({
      where: { shopDomain },
    });

    if (!merchant) {
      return res.status(200).json({ received: true });
    }

    if (status === 'active') {
      // Charge confirmed — determine plan from charge name
      const chargeName = webhookBody.name || '';
      let plan = 'GROWTH';
      if (chargeName.includes('Pro'))    plan = 'PRO';
      if (chargeName.includes('Agency')) plan = 'AGENCY';

      await db.merchant.update({
        where: { id: merchant.id },
        data:  {
          plan,
          billingId:    String(chargeId),
          planExpiresAt: null, // Active subscription, no expiry
        },
      });

      await db.notification.create({
        data: {
          merchantId: merchant.id,
          type:  'billing_activated',
          title: `${plan} Plan Activated! 🎉`,
          body:  `Your ${plan} plan is now active. All premium features unlocked.`,
        },
      });

      logger.info(`Plan activated: ${plan} for ${shopDomain}`);

    } else if (status === 'declined' || status === 'cancelled') {
      await db.merchant.update({
        where: { id: merchant.id },
        data:  { plan: 'FREE', billingId: null },
      });

      await db.notification.create({
        data: {
          merchantId: merchant.id,
          type:  'billing_cancelled',
          title: 'Subscription Cancelled',
          body:  'Your paid plan has been cancelled. You are now on the Free plan.',
        },
      });

      logger.info(`Plan cancelled for ${shopDomain}`);

    } else if (status === 'expired') {
      // Trial expired without payment
      await db.merchant.update({
        where: { id: merchant.id },
        data:  { plan: 'FREE', billingId: null },
      });
      logger.info(`Trial expired for ${shopDomain}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('Billing webhook error:', err);
    res.status(200).json({ received: true }); // Always 200 to Shopify
  }
});

// ── POST /api/billing/activate — Start billing (authenticated) ──
router.post('/activate', authenticate, validate(billingSchema), async (req, res, next) => {
  try {
    const { plan } = req.body;

    if (req.merchant.plan === plan) {
      return res.status(400).json({ success: false, error: `Already on ${plan} plan` });
    }

    const client = createShopifyClient(req.merchant.shopDomain, req.merchant.accessToken);
    const charge = await createBillingCharge(client, plan);

    res.json({
      success:         true,
      confirmationUrl: charge.confirmation_url,
      chargeId:        charge.id,
      plan,
    });
  } catch (err) { next(err); }
});

// ── GET /api/billing/status — Current plan info ──────
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const merchant = await db.merchant.findUnique({
      where:  { id: req.merchant.id },
      select: { plan: true, billingId: true, planExpiresAt: true },
    });

    const planPrices = {
      FREE:   0,
      GROWTH: 1999,
      PRO:    4999,
      AGENCY: 14999,
    };

    res.json({
      success: true,
      plan:          merchant.plan,
      priceInr:      planPrices[merchant.plan],
      billingId:     merchant.billingId,
      planExpiresAt: merchant.planExpiresAt,
      isActive:      !!merchant.billingId || merchant.plan === 'FREE',
    });
  } catch (err) { next(err); }
});

// ── POST /api/billing/cancel — Downgrade to free ─────
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    if (req.merchant.plan === 'FREE') {
      return res.status(400).json({ success: false, error: 'Already on Free plan' });
    }

    // In production: call Shopify API to cancel recurring charge
    // For now: update local record and let webhook handle the rest
    await db.merchant.update({
      where: { id: req.merchant.id },
      data:  { plan: 'FREE', billingId: null },
    });

    await db.notification.create({
      data: {
        merchantId: req.merchant.id,
        type:  'billing_cancelled',
        title: 'Plan Downgraded to Free',
        body:  'Your subscription has been cancelled. Upgrade anytime to restore premium features.',
      },
    });

    res.json({ success: true, message: 'Plan downgraded to Free' });
  } catch (err) { next(err); }
});

export default router;
