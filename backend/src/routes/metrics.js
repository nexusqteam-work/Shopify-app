// ═══════════════════════════════════════════════════
//  routes/metrics.js — Store Performance Metrics
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { db } from '../utils/db.js';
import { authenticate } from '../middleware/auth.js';
import { createShopifyClient, fetchOrders } from '../services/shopify.js';
import { decrypt } from '../utils/encryption.js';

const router = Router();
router.use(authenticate);

// GET /api/metrics/summary — Dashboard summary stats
router.get('/summary', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const metrics = await db.storeMetric.findMany({
      where:   { merchantId: req.merchant.id, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    if (!metrics.length) {
      // Try to pull from Shopify directly if no cached metrics
      await syncMetricsFromShopify(req.merchant);
      return res.json({ success: true, metrics: [], summary: null });
    }

    const summary = {
      totalRevenue:    metrics.reduce((s, m) => s + m.revenue, 0),
      totalOrders:     metrics.reduce((s, m) => s + m.orders, 0),
      totalVisitors:   metrics.reduce((s, m) => s + m.visitors, 0),
      totalNewCustomers: metrics.reduce((s, m) => s + m.newCustomers, 0),
      avgConversionRate: metrics.reduce((s, m) => s + m.conversionRate, 0) / metrics.length,
      avgOrderValue:   metrics.reduce((s, m) => s + m.avgOrderValue, 0) / metrics.length,
      avgRefundRate:   metrics.reduce((s, m) => s + m.refundRate, 0) / metrics.length,
    };

    // Week-over-week comparison
    const midpoint = new Date(since.getTime() + (days / 2) * 24 * 60 * 60 * 1000);
    const firstHalf  = metrics.filter(m => new Date(m.date) < midpoint);
    const secondHalf = metrics.filter(m => new Date(m.date) >= midpoint);

    const revenueChange = firstHalf.length && secondHalf.length
      ? (((secondHalf.reduce((s, m) => s + m.revenue, 0) - firstHalf.reduce((s, m) => s + m.revenue, 0)) /
          firstHalf.reduce((s, m) => s + m.revenue, 0)) * 100).toFixed(1)
      : 0;

    res.json({ success: true, summary: { ...summary, revenueChange }, metrics });
  } catch (err) { next(err); }
});

// GET /api/metrics/daily — Daily breakdown
router.get('/daily', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const metrics = await db.storeMetric.findMany({
      where:   { merchantId: req.merchant.id, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, metrics });
  } catch (err) { next(err); }
});

// POST /api/metrics/sync — Pull fresh data from Shopify
router.post('/sync', async (req, res, next) => {
  try {
    await syncMetricsFromShopify(req.merchant);
    res.json({ success: true, message: 'Metrics synced from Shopify' });
  } catch (err) { next(err); }
});

// ── Sync metrics from Shopify orders data ────────────
export async function syncMetricsFromShopify(merchant) {
  const client = createShopifyClient(merchant.shopDomain, merchant.accessToken);
  const orders = await fetchOrders(client, 30);

  // Group orders by date
  const byDate = {};
  for (const order of orders) {
    const date = order.created_at.split('T')[0]; // YYYY-MM-DD
    if (!byDate[date]) {
      byDate[date] = { revenue: 0, orders: 0, customers: new Set() };
    }
    byDate[date].revenue += parseFloat(order.total_price || 0);
    byDate[date].orders  += 1;
    if (order.customer?.id) byDate[date].customers.add(order.customer.id);
  }

  // Upsert daily metrics
  for (const [dateStr, data] of Object.entries(byDate)) {
    const date = new Date(dateStr);
    const avgOrderValue = data.orders > 0 ? data.revenue / data.orders : 0;

    await db.storeMetric.upsert({
      where:  { merchantId_date: { merchantId: merchant.id, date } },
      create: {
        merchantId:    merchant.id,
        date,
        revenue:       data.revenue,
        orders:        data.orders,
        avgOrderValue,
        newCustomers:  data.customers.size,
        // visitors & CVR would come from Analytics API (requires additional scope)
        visitors:      Math.round(data.orders / 0.02), // estimate
        conversionRate: 2.0, // placeholder
      },
      update: {
        revenue:       data.revenue,
        orders:        data.orders,
        avgOrderValue,
        newCustomers:  data.customers.size,
      },
    });
  }
}

export default router;
