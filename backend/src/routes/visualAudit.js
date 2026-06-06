// ═══════════════════════════════════════════════════
//  routes/visualAudit.js
//  Visual DOM analysis + Code generation + Auto-fix
//  Enforces plan limits strictly
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { authenticate, requirePlan } from '../middleware/auth.js';
import { auditLimiter } from '../middleware/rateLimiter.js';
import {
  runVisualAudit,
  VISUAL_FEATURES,
} from '../services/visualAuditEngine.js';
import {
  generateFixCode,
  applyFixCode,
  revertFixCode,
  revertAllFixes,
} from '../services/codeGenService.js';
import { fetchProducts, createShopifyClient } from '../services/shopify.js';

const router = Router();
router.use(authenticate);

// ── Plan feature check middleware ─────────────────────
function requireVisualAccess(req, res, next) {
  const config = VISUAL_FEATURES[req.merchant.plan];
  if (!config?.enabled) {
    return res.status(403).json({
      success: false,
      error: 'Visual analysis requires Advanced plan (₹1,999/month) or higher',
      upgradeRequired: true,
      currentPlan: req.merchant.plan,
      requiredPlan: 'GROWTH',
    });
  }
  req.visualConfig = config;
  next();
}

function requireCodeGen(req, res, next) {
  const config = VISUAL_FEATURES[req.merchant.plan];
  if (!config?.codeGen) {
    return res.status(403).json({
      success: false,
      error: 'Code generation requires Pro plan (₹2,999/month) or higher',
      upgradeRequired: true,
      currentPlan: req.merchant.plan,
      requiredPlan: 'PRO',
    });
  }
  next();
}

function requireAutoFix(req, res, next) {
  const config = VISUAL_FEATURES[req.merchant.plan];
  if (!config?.autoFix) {
    return res.status(403).json({
      success: false,
      error: 'Auto-fix requires Agent plan (₹29,999/month)',
      upgradeRequired: true,
      currentPlan: req.merchant.plan,
      requiredPlan: 'AGENCY',
    });
  }
  next();
}

// ═══════════════════════════════════════════════════
//  POST /api/visual-audit/run
//  Trigger a new visual audit
//  Plans: GROWTH(Advanced), PRO, AGENCY
// ═══════════════════════════════════════════════════
router.post('/run', auditLimiter, requireVisualAccess, async (req, res, next) => {
  try {
    // Check if visual audit already running
    const running = await db.visualAudit.findFirst({
      where: { merchantId: req.merchant.id, status: 'RUNNING' },
    });
    if (running) {
      const isStale = Date.now() - new Date(running.startedAt || running.createdAt).getTime() > 10 * 60 * 1000;
      if (isStale) {
        await db.visualAudit.update({
          where: { id: running.id },
          data: { status: 'FAILED' },
        });
      } else {
        return res.status(409).json({
          success: false,
          error: 'Visual audit already in progress',
          visualAuditId: running.id,
        });
      }
    }

    // Create audit record
    const visualAudit = await db.visualAudit.create({
      data: {
        merchantId: req.merchant.id,
        status: 'RUNNING',
        plan: req.merchant.plan,
      },
    });

    // Run audit in background — non-blocking
    runVisualAuditJob(visualAudit.id, req.merchant, req.visualConfig)
      .catch(err => logger.error(`Visual audit job failed: ${err.message}`));

    res.status(202).json({
      success: true,
      message: 'Visual audit started',
      visualAuditId: visualAudit.id,
      pagesPlanned: req.visualConfig.pages,
      checksPlanned: req.visualConfig.checks,
    });
  } catch (err) { next(err); }
});

// ── Background job runner ─────────────────────────────
async function runVisualAuditJob(visualAuditId, merchant, config) {
  try {
    // Fetch products for product page scanning
    const client = createShopifyClient(merchant.shopDomain, merchant.accessToken);
    const products = await fetchProducts(client);

    // Run the visual audit
    const result = await runVisualAudit(
      merchant.shopDomain,
      merchant.plan,
      products.slice(0, 5)
    );

    if (!result.enabled) {
      await db.visualAudit.update({
        where: { id: visualAuditId },
        data: { status: 'FAILED' },
      });
      return;
    }

    // Save visual issues to issues table
    if (result.issues.length > 0) {
      await db.issue.createMany({
        data: result.issues.map(issue => ({
          merchantId: merchant.id,
          priority: issue.priority,
          category: issue.category,
          title: issue.title,
          description: issue.description,
          impact: issue.impact,
          effortMinutes: issue.effortMinutes,
          fixInstructions: issue.fixDescription,
          shopifyAdminUrl: issue.shopifyAdminUrl || null,
        })),
        skipDuplicates: false,
      });
    }

    // Update visual audit record as completed
    await db.visualAudit.update({
      where: { id: visualAuditId },
      data: {
        status: 'COMPLETED',
        score: result.score,
        pagesScanned: result.pagesScanned,
        pageResults: result.pageResults,
        aiAnalysis: result.aiAnalysis,
        completedAt: new Date(),
      },
    });

    // Create notification
    await db.notification.create({
      data: {
        merchantId: merchant.id,
        type: 'visual_audit_complete',
        title: 'Visual Audit Complete 🎨',
        body: `Found ${result.issues.length} visual conversion issues. Visual score: ${result.score}/100`,
        data: { visualAuditId, issueCount: result.issues.length, score: result.score },
      },
    });

    // Agent plan: auto-generate and apply LOW risk fixes automatically
    if (config.autoFix && result.issues.length > 0) {
      await autoApplyLowRiskFixes(result.issues, merchant, visualAuditId);
    }

    logger.info(`Visual audit job complete: ${merchant.shopDomain} — score: ${result.score}`);

  } catch (err) {
    logger.error(`Visual audit job error: ${err.message}`);
    await db.visualAudit.update({
      where: { id: visualAuditId },
      data: { status: 'FAILED' },
    }).catch(() => { });
  }
}

// ── Agent plan: auto-apply safe fixes ────────────────
async function autoApplyLowRiskFixes(issues, merchant, visualAuditId) {
  // Only auto-apply fixes that have a CSS target and are LOW risk candidates
  const autoFixCandidates = issues.filter(i =>
    i.cssFixTarget &&
    ['MOBILE', 'SPEED'].includes(i.category) &&
    i.priority !== 'CRITICAL' // Never auto-fix critical issues without review
  ).slice(0, 3); // Max 3 auto-fixes per audit

  for (const issue of autoFixCandidates) {
    try {
      logger.info(`Auto-generating fix for: ${issue.title}`);

      // Find the saved issue record
      const savedIssue = await db.issue.findFirst({
        where: {
          merchantId: merchant.id,
          title: issue.title,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!savedIssue) continue;

      // Generate code
      const fixData = await generateFixCode(savedIssue, merchant);
      if (!fixData.success || fixData.riskLevel === 'HIGH') continue;

      // Save code fix record
      const codeFix = await db.codeFix.create({
        data: {
          merchantId: merchant.id,
          issueId: savedIssue.id,
          visualAuditId,
          cssCode: fixData.cssCode,
          liquidNote: fixData.liquidNote,
          explanation: fixData.explanation,
          riskLevel: fixData.riskLevel,
          status: 'GENERATED',
          themeId: fixData.themeId,
          tokensUsed: fixData.tokensUsed,
        },
      });

      // Apply the fix
      const applyResult = await applyFixCode({ ...fixData, issueId: savedIssue.id }, merchant, db);

      if (applyResult.success) {
        await db.codeFix.update({
          where: { id: codeFix.id },
          data: { status: 'APPLIED', appliedAt: new Date() },
        });

        await db.notification.create({
          data: {
            merchantId: merchant.id,
            type: 'auto_fix_applied',
            title: 'Auto-Fix Applied ⚡',
            body: `Automatically fixed: ${issue.title}`,
            data: { issueId: savedIssue.id, codeFixId: codeFix.id },
          },
        });

        logger.info(`Auto-fix applied: ${issue.title}`);
      }

      // Small delay between fixes
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      logger.error(`Auto-fix failed for ${issue.title}: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════
//  GET /api/visual-audit
//  List all visual audits
// ═══════════════════════════════════════════════════
router.get('/', requireVisualAccess, async (req, res, next) => {
  try {
    const audits = await db.visualAudit.findMany({
      where: { merchantId: req.merchant.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, status: true, score: true,
        pagesScanned: true, aiAnalysis: true,
        plan: true, startedAt: true, completedAt: true,
      },
    });
    res.json({ success: true, audits });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  GET /api/visual-audit/latest
//  Get most recent completed visual audit
// ═══════════════════════════════════════════════════
router.get('/latest', requireVisualAccess, async (req, res, next) => {
  try {
    const audit = await db.visualAudit.findFirst({
      where: { merchantId: req.merchant.id, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });
    res.json({
      success: true,
      audit: audit || null,
      hasAudit: !!audit,
      message: audit ? undefined : 'No completed visual audit found yet',
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  GET /api/visual-audit/:id/status
//  Poll audit progress
// ═══════════════════════════════════════════════════
router.get('/:id/status', requireVisualAccess, async (req, res, next) => {
  try {
    const audit = await db.visualAudit.findFirst({
      where: { id: req.params.id, merchantId: req.merchant.id },
      select: { id: true, status: true, score: true, pagesScanned: true, completedAt: true },
    });
    if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
    res.json({ success: true, ...audit });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  GET /api/visual-audit/issues
//  Get visual-specific issues
// ═══════════════════════════════════════════════════
router.get('/issues/list', requireVisualAccess, async (req, res, next) => {
  try {
    const issues = await db.issue.findMany({
      where: { merchantId: req.merchant.id, isFixed: false },
      orderBy: [{ priority: 'asc' }, { impact: 'desc' }],
      include: {
        codeFixes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, riskLevel: true, appliedAt: true },
        },
      },
    });

    const total = issues.reduce((s, i) => s + i.impact, 0);
    res.json({ success: true, issues, totalImpact: total, count: issues.length });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  POST /api/visual-audit/generate-fix/:issueId
//  Generate CSS fix code for an issue
//  Plans: PRO, AGENCY only
// ═══════════════════════════════════════════════════
router.post('/generate-fix/:issueId', requireCodeGen, async (req, res, next) => {
  try {
    const issue = await db.issue.findFirst({
      where: { id: req.params.issueId, merchantId: req.merchant.id },
    });
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    // Check if fix already generated
    const existing = await db.codeFix.findFirst({
      where: { issueId: issue.id, status: { in: ['GENERATED', 'APPLIED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return res.json({
        success: true,
        cached: true,
        codeFix: existing,
        codeFixId: existing.id,
        code: existing.cssCode,
        cssCode: existing.cssCode,
        riskLevel: existing.riskLevel,
        explanation: existing.explanation,
      });
    }

    // Generate new fix
    const fixData = await generateFixCode(issue, req.merchant);

    if (!fixData.success) {
      return res.status(500).json({ success: false, error: fixData.error });
    }

    // Save to database
    const codeFix = await db.codeFix.create({
      data: {
        merchantId: req.merchant.id,
        issueId: issue.id,
        cssCode: fixData.cssCode,
        liquidNote: fixData.liquidNote,
        explanation: fixData.explanation,
        riskLevel: fixData.riskLevel,
        status: 'GENERATED',
        themeId: fixData.themeId?.toString(),
        tokensUsed: fixData.tokensUsed,
      },
    });

    res.json({
      success: true,
      codeFix,
      codeFixId: codeFix.id,
      code: codeFix.cssCode,
      cssCode: codeFix.cssCode,
      riskLevel: codeFix.riskLevel,
      explanation: codeFix.explanation,
      message: req.merchant.plan === 'AGENCY'
        ? 'Fix generated. Use /apply-fix to auto-apply, or review and apply manually.'
        : 'Fix generated. Copy the CSS code and add it to your theme.',
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  POST /api/visual-audit/apply-fix/:codeFixId
//  Auto-apply a generated fix to Shopify theme
//  Plan: AGENCY only
// ═══════════════════════════════════════════════════
router.post('/apply-fix/:codeFixId', requireAutoFix, async (req, res, next) => {
  try {
    const codeFix = await db.codeFix.findFirst({
      where: { id: req.params.codeFixId, merchantId: req.merchant.id },
      include: { issue: true },
    });
    if (!codeFix) {
      return res.status(404).json({ success: false, error: 'Code fix not found' });
    }
    if (codeFix.status === 'APPLIED') {
      return res.status(400).json({ success: false, error: 'Fix already applied' });
    }
    if (codeFix.riskLevel === 'HIGH') {
      return res.status(400).json({
        success: false,
        error: 'HIGH risk fixes cannot be auto-applied. Apply manually after reviewing the code.',
      });
    }

    // Apply to theme
    const result = await applyFixCode(
      {
        cssCode: codeFix.cssCode,
        themeId: codeFix.themeId,
        issueId: codeFix.issueId,
        riskLevel: codeFix.riskLevel,
      },
      req.merchant,
      db
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Update status
    const updated = await db.codeFix.update({
      where: { id: codeFix.id },
      data: { status: 'APPLIED', appliedAt: new Date() },
    });

    // Create notification
    await db.notification.create({
      data: {
        merchantId: req.merchant.id,
        type: 'fix_applied',
        title: 'Fix Applied to Store ✅',
        body: `Applied: ${codeFix.issue?.title}. Changes are live on your store.`,
        data: { codeFixId: codeFix.id, issueId: codeFix.issueId },
      },
    });

    res.json({
      success: true,
      codeFix: updated,
      appliedAt: result.appliedAt,
      message: 'Fix applied successfully. Check your store to verify the change.',
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  POST /api/visual-audit/revert-fix/:codeFixId
//  Revert a specific applied fix
//  Plans: PRO, AGENCY
// ═══════════════════════════════════════════════════
router.post('/revert-fix/:codeFixId', requireCodeGen, async (req, res, next) => {
  try {
    const codeFix = await db.codeFix.findFirst({
      where: { id: req.params.codeFixId, merchantId: req.merchant.id },
    });
    if (!codeFix) {
      return res.status(404).json({ success: false, error: 'Code fix not found' });
    }
    if (codeFix.status !== 'APPLIED') {
      return res.status(400).json({ success: false, error: 'Fix is not currently applied' });
    }

    const result = await revertFixCode(codeFix.issueId, req.merchant);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    await db.codeFix.update({
      where: { id: codeFix.id },
      data: { status: 'REVERTED', revertedAt: new Date() },
    });

    res.json({ success: true, message: 'Fix reverted. Your theme is restored.' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  POST /api/visual-audit/revert-all
//  Revert ALL applied fixes — restore original theme
//  Plans: PRO, AGENCY
// ═══════════════════════════════════════════════════
router.post('/revert-all', requireCodeGen, async (req, res, next) => {
  try {
    const result = await revertAllFixes(req.merchant);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Mark all applied fixes as reverted
    await db.codeFix.updateMany({
      where: { merchantId: req.merchant.id, status: 'APPLIED' },
      data: { status: 'REVERTED', revertedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'All Flovix fixes reverted. Your theme is fully restored to its original state.',
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  GET /api/visual-audit/code-fixes
//  List all code fixes for this merchant
// ═══════════════════════════════════════════════════
router.get('/code-fixes', requireCodeGen, async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { merchantId: req.merchant.id };
    if (status) where.status = status.toUpperCase();

    const fixes = await db.codeFix.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        issue: {
          select: { title: true, category: true, priority: true, impact: true },
        },
      },
    });

    const normalizedFixes = fixes.map(fix => ({
      ...fix,
      title: fix.issue?.title || 'Untitled fix',
      category: fix.issue?.category || null,
      priority: fix.issue?.priority || null,
      impact: fix.issue?.impact || null,
    }));

    res.json({
      success: true,
      fixes: normalizedFixes,
      summary: {
        total: normalizedFixes.length,
        applied: normalizedFixes.filter(f => f.status === 'APPLIED').length,
        reverted: normalizedFixes.filter(f => f.status === 'REVERTED').length,
        pending: normalizedFixes.filter(f => f.status === 'GENERATED').length,
      },
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════
//  GET /api/visual-audit/plan-info
//  What visual features are available on this plan
// ═══════════════════════════════════════════════════
router.get('/plan-info', async (req, res) => {
  const config = VISUAL_FEATURES[req.merchant.plan] || VISUAL_FEATURES.FREE;
  res.json({
    success: true,
    plan: req.merchant.plan,
    features: {
      visualAnalysis: config.enabled,
      pagesPerScan: config.pages,
      checksPerScan: config.checks,
      codeGeneration: config.codeGen,
      autoFix: config.autoFix,
    },
    upgradeInfo: !config.enabled ? {
      message: 'Upgrade to Advanced plan for visual DOM analysis',
      requiredPlan: 'GROWTH',
      price: '₹1,999/month',
    } : !config.codeGen ? {
      message: 'Upgrade to Pro plan for AI code generation',
      requiredPlan: 'PRO',
      price: '₹2,999/month',
    } : !config.autoFix ? {
      message: 'Upgrade to Agent plan for auto-fix',
      requiredPlan: 'AGENCY',
      price: '₹29,999/month',
    } : null,
  });
});

export default router;
