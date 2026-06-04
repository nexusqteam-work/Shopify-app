import { Router } from 'express';
import { db } from '../utils/db.js';
import { authenticate } from '../middleware/auth.js';
import { auditLimiter } from '../middleware/rateLimiter.js';
import { runFullAudit } from '../services/auditEngine.js';

const router = Router();
router.use(authenticate);

// POST /api/audits/run — Trigger a new audit
router.post('/run', auditLimiter, async (req, res, next) => {
  try {
    // Check if audit already running
    const running = await db.audit.findFirst({
      where: { merchantId: req.merchant.id, status: 'RUNNING' },
    });
    if (running) {
      return res.status(409).json({ success: false, error: 'Audit already in progress', auditId: running.id });
    }

    const audit = await db.audit.create({
      data: { merchantId: req.merchant.id },
    });

    // Run audit in background (non-blocking)
    runFullAudit(audit.id, req.merchant).catch(e =>
      console.error(`Audit ${audit.id} failed:`, e)
    );

    res.status(202).json({
      success: true,
      message: 'Audit started',
      auditId: audit.id,
    });
  } catch (err) { next(err); }
});

// GET /api/audits — List all audits
router.get('/', async (req, res, next) => {
  try {
    const audits = await db.audit.findMany({
      where:   { merchantId: req.merchant.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select: {
        id: true, status: true, overallScore: true,
        totalRevenueLoss: true, speedScore: true, seoScore: true,
        conversionScore: true, productScore: true, checkoutScore: true,
        mobileScore: true, aiSummary: true, startedAt: true, completedAt: true,
      },
    });
    res.json({ success: true, audits });
  } catch (err) { next(err); }
});

// GET /api/audits/latest — Get most recent completed audit
router.get('/latest', async (req, res, next) => {
  try {
    const audit = await db.audit.findFirst({
      where:   { merchantId: req.merchant.id, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });
    res.json({
      success: true,
      audit: audit || null,
      hasAudit: !!audit,
      message: audit ? undefined : 'No completed audit found yet',
    });
  } catch (err) { next(err); }
});

// GET /api/audits/:id — Get specific audit
router.get('/:id', async (req, res, next) => {
  try {
    const audit = await db.audit.findFirst({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
    res.json({ success: true, audit });
  } catch (err) { next(err); }
});

// GET /api/audits/:id/status — Poll audit progress
router.get('/:id/status', async (req, res, next) => {
  try {
    const audit = await db.audit.findFirst({
      where:  { id: req.params.id, merchantId: req.merchant.id },
      select: { id: true, status: true, overallScore: true, completedAt: true },
    });
    if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
    res.json({ success: true, ...audit });
  } catch (err) { next(err); }
});

export default router;
