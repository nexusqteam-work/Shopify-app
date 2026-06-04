// ═══════════════════════════════════════════════════
//  routes/shopify.js — OAuth Install & Callback
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { encrypt } from '../utils/encryption.js';
import { authenticate } from '../middleware/auth.js';
import {
  getInstallUrl, verifyHmac, exchangeToken,
  createShopifyClient, fetchShopInfo,
  registerWebhooks, createBillingCharge,
} from '../services/shopify.js';
import { runFullAudit } from '../services/auditEngine.js';
import { sendWelcomeEmail } from '../services/emailService.js';

const router = Router();

// GET /api/shopify/install?shop=store.myshopify.com
router.get('/install', (req, res) => {
  const { shop } = req.query;
  if (!shop || !shop.endsWith('.myshopify.com')) {
    return res.status(400).json({ success: false, error: 'Invalid shop domain' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('shopify_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300000,
  });
  const installUrl = getInstallUrl(shop, state);
  res.redirect(installUrl);
});

// GET /api/shopify/callback (Shopify redirects here after merchant approves)
router.get('/callback', async (req, res) => {
  try {
    const { shop, code, state, hmac } = req.query;

    // Verify state matches cookie (CSRF protection)
    const storedState = req.cookies?.shopify_state;
    if (!storedState || storedState !== state) {
      return res.status(403).json({ success: false, error: 'Invalid state parameter' });
    }

    res.clearCookie('shopify_state');

    // Verify HMAC from Shopify
    if (!verifyHmac(req.query)) {
      return res.status(403).json({ success: false, error: 'HMAC verification failed' });
    }

    // Exchange code for access token
    const accessToken = await exchangeToken(shop, code);
    const encryptedToken = encrypt(accessToken);

    // Fetch shop details
    const tempClient = createShopifyClient(shop, encryptedToken);
    const shopInfo = await fetchShopInfo(tempClient);

    // Upsert merchant record
    const merchant = await db.merchant.upsert({
      where:  { shopDomain: shop },
      create: {
        shopDomain:  shop,
        shopName:    shopInfo.name,
        email:       shopInfo.email,
        accessToken: encryptedToken,
        currency:    shopInfo.currency,
        timezone:    shopInfo.iana_timezone || 'Asia/Kolkata',
      },
      update: {
        accessToken: encryptedToken,
        shopName:    shopInfo.name,
        email:       shopInfo.email,
        isActive:    true,
        lastSeenAt:  new Date(),
      },
    });

    // Register Shopify webhooks (async, don't block)
    registerWebhooks(tempClient, process.env.APP_URL).catch(e =>
      logger.error('Webhook registration failed:', e)
    );

    // Send welcome email (async)
    sendWelcomeEmail(merchant).catch(e => logger.error('Welcome email failed:', e));

    // Trigger first audit in background
    const audit = await db.audit.create({ data: { merchantId: merchant.id } });
    runFullAudit(audit.id, merchant).catch(e =>
      logger.error(`Initial audit failed for ${shop}:`, e)
    );

    // Issue JWT token
    const token = jwt.sign(
      { merchantId: merchant.id, shopDomain: shop },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      sameSite: 'none',
    });

    const callbackUrl = new URL('/auth/callback', process.env.FRONTEND_URL);
    callbackUrl.searchParams.set('token', token);
    callbackUrl.searchParams.set('shop', shop);

    if (typeof req.query.host === 'string') {
      callbackUrl.searchParams.set('host', req.query.host);
    }

    res.redirect(callbackUrl.toString());

  } catch (err) {
    logger.error('OAuth callback failed:', err);
    const errorUrl = new URL('/connect', process.env.FRONTEND_URL);
    errorUrl.searchParams.set('error', 'install_failed');

    if (typeof req.query.shop === 'string') {
      errorUrl.searchParams.set('shop', req.query.shop);
    }

    res.redirect(errorUrl.toString());
  }
});

// POST /api/shopify/billing/activate — Activate paid plan
router.post('/billing/activate', authenticate, async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!['GROWTH', 'PRO', 'AGENCY'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    const client = createShopifyClient(req.merchant.shopDomain, req.merchant.accessToken);
    const charge  = await createBillingCharge(client, plan);
    res.json({ success: true, confirmationUrl: charge.confirmation_url });
  } catch (err) { next(err); }
});

// GET /api/shopify/billing/callback — After merchant confirms billing
router.get('/billing/callback', authenticate, async (req, res, next) => {
  try {
    const { charge_id, plan } = req.query;
    await db.merchant.update({
      where: { id: req.merchant.id },
      data:  { plan: plan || 'GROWTH', billingId: charge_id, planExpiresAt: null },
    });
    res.redirect(`${process.env.FRONTEND_URL}?billing=success`);
  } catch (err) { next(err); }
});

export default router;
