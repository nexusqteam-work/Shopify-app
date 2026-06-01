// ═══════════════════════════════════════════════════
//  Shopify Service — OAuth + API Client
// ═══════════════════════════════════════════════════

import crypto from 'crypto';
import axios from 'axios';
import { encrypt, decrypt } from '../utils/encryption.js';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';

const SHOPIFY_API_KEY    = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES             = process.env.SHOPIFY_SCOPES;
const APP_URL            = process.env.APP_URL;

// ── Generate OAuth install URL ───────────────────────
export function getInstallUrl(shop, state) {
  const redirectUri = `${APP_URL}/api/shopify/callback`;
  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    'grant_options[]': 'per-user',
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

// ── Verify HMAC from Shopify ─────────────────────────
export function verifyHmac(query) {
  const { hmac, ...rest } = query;
  const message = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&');
  const digest = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

// ── Verify Shopify webhook HMAC ──────────────────────
export function verifyWebhookHmac(rawBody, hmacHeader) {
  const digest = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBody)
    .digest('base64');
  return digest === hmacHeader;
}

// ── Exchange auth code for access token ─────────────
export async function exchangeToken(shop, code) {
  const res = await axios.post(`https://${shop}/admin/oauth/access_token`, {
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    code,
  });
  return res.data.access_token;
}

// ── Create authenticated Shopify API client ──────────
export function createShopifyClient(shopDomain, encryptedToken) {
  const accessToken = decrypt(encryptedToken);
  const baseURL = `https://${shopDomain}/admin/api/2024-01`;

  const client = axios.create({
    baseURL,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  // Handle Shopify rate limits
  client.interceptors.response.use(
    res => res,
    async err => {
      if (err.response?.status === 429) {
        const retryAfter = parseFloat(err.response.headers['retry-after'] || '2');
        logger.warn(`Shopify rate limit hit. Retrying after ${retryAfter}s`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return client.request(err.config);
      }
      throw err;
    }
  );

  return client;
}

// ── Fetch shop info ──────────────────────────────────
export async function fetchShopInfo(client) {
  const { data } = await client.get('/shop.json');
  return data.shop;
}

// ── Fetch all products ───────────────────────────────
export async function fetchProducts(client) {
  const products = [];
  let url = '/products.json?limit=250&fields=id,title,handle,status,variants,images,metafields';

  while (url) {
    const { data, headers } = await client.get(url);
    products.push(...data.products);
    // Handle pagination via Link header
    const linkHeader = headers.link;
    const nextMatch = linkHeader?.match(/<([^>]+)>; rel="next"/);
    url = nextMatch ? nextMatch[1].replace(`https://${client.defaults.baseURL}`, '') : null;
  }
  return products;
}

// ── Fetch recent orders ──────────────────────────────
export async function fetchOrders(client, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await client.get(`/orders.json?status=any&limit=250&created_at_min=${since.toISOString()}&fields=id,created_at,total_price,line_items,customer,financial_status,fulfillment_status`);
  return data.orders;
}

// ── Fetch installed script tags (app detection) ──────
export async function fetchScriptTags(client) {
  const { data } = await client.get('/script_tags.json');
  return data.script_tags;
}

// ── Fetch pages (for SEO audit) ──────────────────────
export async function fetchPages(client) {
  const { data } = await client.get('/pages.json?fields=id,title,handle,body_html,metafield');
  return data.pages;
}

// ── Fetch themes ─────────────────────────────────────
export async function fetchThemes(client) {
  const { data } = await client.get('/themes.json');
  return data.themes;
}

// ── Fetch inventory levels ───────────────────────────
export async function fetchInventory(client) {
  const { data } = await client.get('/inventory_levels.json?limit=250');
  return data.inventory_levels;
}

// ── Register webhooks with Shopify ───────────────────
export async function registerWebhooks(client, appUrl) {
  const webhooks = [
    { topic: 'app/uninstalled',       address: `${appUrl}/api/webhooks/app-uninstalled` },
    { topic: 'orders/create',         address: `${appUrl}/api/webhooks/orders-create` },
    { topic: 'orders/updated',        address: `${appUrl}/api/webhooks/orders-updated` },
    { topic: 'products/create',       address: `${appUrl}/api/webhooks/products-create` },
    { topic: 'products/update',       address: `${appUrl}/api/webhooks/products-update` },
    { topic: 'shop/update',           address: `${appUrl}/api/webhooks/shop-update` },
  ];

  const results = [];
  for (const webhook of webhooks) {
    try {
      const { data } = await client.post('/webhooks.json', { webhook: { ...webhook, format: 'json' } });
      results.push({ success: true, topic: webhook.topic, id: data.webhook.id });
      logger.info(`Webhook registered: ${webhook.topic}`);
    } catch (err) {
      // Webhook may already exist
      logger.warn(`Webhook ${webhook.topic}: ${err.response?.data?.errors || err.message}`);
      results.push({ success: false, topic: webhook.topic });
    }
  }
  return results;
}

// ── Create Shopify billing subscription ─────────────
export async function createBillingCharge(client, plan) {
  const plans = {
    GROWTH:  { name: 'Growth Plan',  price: 24.99, trialDays: 7 },
    PRO:     { name: 'Pro Plan',     price: 59.99, trialDays: 7 },
    AGENCY:  { name: 'Agency Plan',  price: 179.99, trialDays: 7 },
  };

  const planConfig = plans[plan];
  if (!planConfig) throw new Error(`Unknown plan: ${plan}`);

  const { data } = await client.post('/recurring_application_charges.json', {
    recurring_application_charge: {
      name: planConfig.name,
      price: planConfig.price,
      trial_days: planConfig.trialDays,
      return_url: `${APP_URL}/api/shopify/billing/callback`,
      test: process.env.NODE_ENV !== 'production',
    }
  });

  return data.recurring_application_charge;
}
