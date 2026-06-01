// ═══════════════════════════════════════════════════
//  Validation Schemas — Zod
//  Used across all POST/PATCH routes
// ═══════════════════════════════════════════════════

import { z } from 'zod';

// ── Middleware helper ────────────────────────────────
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error:   'Validation failed',
        details: result.error.errors.map(e => ({
          field:   e.path.join('.'),
          message: e.message,
        })),
      });
    }
    req.body = result.data; // Use parsed + sanitized data
    next();
  };
}

// ── Auth schemas ─────────────────────────────────────
export const tokenSchema = z.object({
  shopDomain: z.string()
    .min(1, 'shopDomain is required')
    .regex(/\.myshopify\.com$/, 'Must be a valid myshopify.com domain'),
});

// ── Chat schemas ─────────────────────────────────────
export const chatMessageSchema = z.object({
  message:   z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  sessionId: z.string().uuid('Invalid session ID').optional(),
});

// ── Issue schemas ─────────────────────────────────────
export const fixIssueSchema = z.object({
  note: z.string().max(500, 'Note too long').optional(),
});

// ── Competitor schemas ────────────────────────────────
export const addCompetitorSchema = z.object({
  storeUrl:  z.string()
    .min(1, 'Store URL is required')
    .regex(/^[a-z0-9-]+\.myshopify\.com$/, 'Must be a valid myshopify.com URL'),
  storeName: z.string().max(100).optional(),
  niche:     z.string().max(100).optional(),
});

// ── Billing schemas ───────────────────────────────────
export const billingSchema = z.object({
  plan: z.enum(['GROWTH', 'PRO', 'AGENCY'], {
    errorMap: () => ({ message: 'Plan must be GROWTH, PRO, or AGENCY' }),
  }),
});

// ── Report schemas ────────────────────────────────────
export const generateReportSchema = z.object({
  type: z.enum(['WEEKLY', 'MONTHLY']).default('WEEKLY'),
});

// ── Metrics schemas ───────────────────────────────────
export const metricsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
