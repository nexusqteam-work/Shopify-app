// ═══════════════════════════════════════════════════
//  routes/issues.js — with validation
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { db } from '../utils/db.js';
import { authenticate } from '../middleware/auth.js';
import { validate, fixIssueSchema } from '../middleware/validation.js';

const router = Router();
router.use(authenticate);

// GET /api/issues
router.get('/', async (req, res, next) => {
  try {
    const { status, category, priority } = req.query;
    const where = { merchantId: req.merchant.id };
    if (status === 'open')  where.isFixed = false;
    if (status === 'fixed') where.isFixed = true;
    if (category) where.category = category.toUpperCase();
    if (priority) where.priority = priority.toUpperCase();

    const issues   = await db.issue.findMany({
      where,
      orderBy: [{ isFixed: 'asc' }, { priority: 'asc' }, { impact: 'desc' }],
    });
    const totalLoss    = issues.filter(i => !i.isFixed).reduce((s, i) => s + i.impact, 0);
    const totalEffort  = issues.filter(i => !i.isFixed).reduce((s, i) => s + i.effortMinutes, 0);

    res.json({ success: true, issues, totalLoss, totalEffortMinutes: totalEffort, count: issues.length });
  } catch (err) { next(err); }
});

// GET /api/issues/:id
router.get('/:id', async (req, res, next) => {
  try {
    const issue = await db.issue.findFirst({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });
    res.json({ success: true, issue });
  } catch (err) { next(err); }
});

// PATCH /api/issues/:id/fix
router.patch('/:id/fix', validate(fixIssueSchema), async (req, res, next) => {
  try {
    const issue = await db.issue.findFirst({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });
    if (issue.isFixed) return res.status(400).json({ success: false, error: 'Issue already marked as fixed' });

    const updated = await db.issue.update({
      where: { id: req.params.id },
      data:  { isFixed: true, fixedAt: new Date(), fixedNote: req.body.note || null },
    });

    await db.notification.create({
      data: {
        merchantId: req.merchant.id,
        type:  'issue_fixed',
        title: 'Issue Fixed! 🎉',
        body:  `You fixed "${issue.title}". Estimated ₹${issue.impact.toLocaleString('en-IN')}/month recovered.`,
        data:  { issueId: issue.id, impact: issue.impact },
      },
    });

    res.json({ success: true, issue: updated });
  } catch (err) { next(err); }
});

// PATCH /api/issues/:id/unfix
router.patch('/:id/unfix', async (req, res, next) => {
  try {
    const issue = await db.issue.findFirst({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });

    await db.issue.update({
      where: { id: req.params.id },
      data:  { isFixed: false, fixedAt: null, fixedNote: null },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/issues/summary — Quick stats
router.get('/summary/stats', async (req, res, next) => {
  try {
    const all    = await db.issue.findMany({ where: { merchantId: req.merchant.id } });
    const open   = all.filter(i => !i.isFixed);
    const fixed  = all.filter(i => i.isFixed);
    const critical = open.filter(i => i.priority === 'CRITICAL').length;

    res.json({
      success: true,
      total:      all.length,
      open:       open.length,
      fixed:      fixed.length,
      critical,
      totalLoss:      open.reduce((s, i) => s + i.impact, 0),
      totalRecovered: fixed.reduce((s, i) => s + i.impact, 0),
    });
  } catch (err) { next(err); }
});

export default router;
