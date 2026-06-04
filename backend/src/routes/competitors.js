// ═══════════════════════════════════════════════════
//  routes/competitors.js — with validation + plan limits
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import axios from 'axios';
import { db } from '../utils/db.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { validate, addCompetitorSchema } from '../middleware/validation.js';
import { GoogleGenAI } from '@google/genai';

const router = Router();
router.use(authenticate);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Max competitors by plan
const COMPETITOR_LIMITS = { FREE: 1, GROWTH: 3, PRO: 10, AGENCY: 25 };

// GET /api/competitors
router.get('/', async (req, res, next) => {
  try {
    const competitors = await db.competitor.findMany({
      where:   { merchantId: req.merchant.id },
      include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });
    const limit = COMPETITOR_LIMITS[req.merchant.plan] || 1;
    res.json({ success: true, competitors, limit, used: competitors.length });
  } catch (err) { next(err); }
});

// POST /api/competitors
router.post('/', validate(addCompetitorSchema), async (req, res, next) => {
  try {
    const { storeUrl, storeName, niche } = req.body;

    const limit = COMPETITOR_LIMITS[req.merchant.plan] || 1;
    const count = await db.competitor.count({ where: { merchantId: req.merchant.id } });

    if (count >= limit) {
      return res.status(403).json({
        success: false,
        error:   `Your ${req.merchant.plan} plan allows max ${limit} competitor${limit > 1 ? 's' : ''}. Upgrade to add more.`,
        upgradeRequired: true,
      });
    }

    // Prevent tracking own store
    if (storeUrl === req.merchant.shopDomain) {
      return res.status(400).json({ success: false, error: 'Cannot track your own store' });
    }

    const competitor = await db.competitor.create({
      data: { merchantId: req.merchant.id, storeUrl, storeName: storeName || storeUrl, niche },
    });

    // Trigger initial snapshot in background
    snapshotCompetitor(competitor, req.merchant).catch(e =>
      logger.error(`Initial competitor snapshot failed: ${e.message}`)
    );

    res.status(201).json({ success: true, competitor });
  } catch (err) { next(err); }
});

// DELETE /api/competitors/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await db.competitor.deleteMany({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    if (deleted.count === 0) {
      return res.status(404).json({ success: false, error: 'Competitor not found' });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/competitors/:id/refresh
router.post('/:id/refresh', async (req, res, next) => {
  try {
    const competitor = await db.competitor.findFirst({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    if (!competitor) return res.status(404).json({ success: false, error: 'Competitor not found' });

    snapshotCompetitor(competitor, req.merchant).catch(e =>
      logger.error(`Competitor refresh failed: ${e.message}`)
    );
    res.json({ success: true, message: 'Refresh started — check back in 30 seconds' });
  } catch (err) { next(err); }
});

// GET /api/competitors/:id/history — Snapshot history
router.get('/:id/history', async (req, res, next) => {
  try {
    const competitor = await db.competitor.findFirst({
      where:   { id: req.params.id, merchantId: req.merchant.id },
      include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 30 } },
    });
    if (!competitor) return res.status(404).json({ success: false, error: 'Competitor not found' });
    res.json({ success: true, competitor });
  } catch (err) { next(err); }
});

// ── Snapshot a competitor store ───────────────────────
export async function snapshotCompetitor(competitor, merchant) {
  let speedScore = null;

  // PageSpeed check
  try {
    if (process.env.PAGESPEED_API_KEY) {
      const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent('https://' + competitor.storeUrl)}&strategy=mobile&key=${process.env.PAGESPEED_API_KEY}`;
      const { data } = await axios.get(psUrl, { timeout: 15000 });
      const loadTime = data.lighthouseResult?.audits?.interactive?.numericValue;
      speedScore = loadTime ? parseFloat((loadTime / 1000).toFixed(1)) : null;
    }
  } catch (e) {
    logger.warn(`PageSpeed failed for ${competitor.storeUrl}: ${e.message}`);
  }

  // AI insight
  let aiInsight = null;
  try {
    const merchantAudit = await db.audit.findFirst({
      where:   { merchantId: merchant.id, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select:  { overallScore: true, speedScore: true },
    });

    const mySpeed = merchantAudit?.speedScore
      ? `Your store speed score: ${merchantAudit.speedScore}/100.`
      : '';

    const prompt = `Competitor: ${competitor.storeUrl} | Load time: ${speedScore ? speedScore + 's' : 'unknown'} | Niche: ${competitor.niche || 'ecommerce'} | ${mySpeed}
Write ONE sharp competitive insight for the merchant. Max 20 words. Be specific and actionable.`;

    const response = await ai.models.generateContent({
      model:      'gemini-3.5-flash',
      contents:   prompt,
      config:     { maxOutputTokens: 60 },
    });
    aiInsight = response.text?.trim();
  } catch (e) {
    logger.warn('AI competitor insight failed:', e.message);
  }

  // Threat level
  let threatLevel = 'LOW';
  if (speedScore !== null) {
    if (speedScore < 3)      threatLevel = 'HIGH';
    else if (speedScore < 5) threatLevel = 'MEDIUM';
  }

  await db.competitorSnapshot.create({
    data: { competitorId: competitor.id, speedScore, aiInsight },
  });

  await db.competitor.update({
    where: { id: competitor.id },
    data:  { threatLevel, lastCheckedAt: new Date() },
  });

  logger.info(`Competitor snapshot complete: ${competitor.storeUrl} (${speedScore}s, ${threatLevel})`);
}

export default router;
