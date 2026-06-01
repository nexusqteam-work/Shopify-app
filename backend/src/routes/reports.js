// ═══════════════════════════════════════════════════
//  routes/reports.js
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { db } from '../utils/db.js';
import { authenticate } from '../middleware/auth.js';
import { generateWeeklyReport } from '../services/reportService.js';

const router = Router();
router.use(authenticate);

// GET /api/reports — List all reports
router.get('/', async (req, res, next) => {
  try {
    const reports = await db.report.findMany({
      where:   { merchantId: req.merchant.id },
      orderBy: { createdAt: 'desc' },
      take:    24,
      select:  { id: true, type: true, period: true, aiSummary: true, emailSentAt: true, createdAt: true },
    });
    res.json({ success: true, reports });
  } catch (err) { next(err); }
});

// GET /api/reports/:id — Get full report data
router.get('/:id', async (req, res, next) => {
  try {
    const report = await db.report.findFirst({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, report });
  } catch (err) { next(err); }
});

// POST /api/reports/generate — Manually trigger report
router.post('/generate', async (req, res, next) => {
  try {
    const { type = 'WEEKLY' } = req.body;
    if (type !== 'WEEKLY') {
      return res.status(400).json({ success: false, error: 'Only WEEKLY reports supported currently' });
    }
    const report = await generateWeeklyReport(req.merchant.id);
    res.json({ success: true, report });
  } catch (err) { next(err); }
});

// POST /api/reports/:id/email — Re-send report email
router.post('/:id/email', async (req, res, next) => {
  try {
    const report = await db.report.findFirst({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

    const { sendWeeklyReportEmail } = await import('../services/reportService.js');
    await sendWeeklyReportEmail(req.merchant, report.data);
    await db.report.update({ where: { id: report.id }, data: { emailSentAt: new Date() } });

    res.json({ success: true, message: 'Report emailed' });
  } catch (err) { next(err); }
});

export default router;
