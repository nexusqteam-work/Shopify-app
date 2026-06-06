// ═══════════════════════════════════════════════════
//  Flovix Backend — Main Server Entry Point
// ═══════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { generalLimiter } from './middleware/rateLimiter.js';

// Routes
import authRoutes from './routes/auth.js';
import shopifyRoutes from './routes/shopify.js';
import auditRoutes from './routes/audit.js';
import issueRoutes from './routes/issues.js';
import chatRoutes from './routes/chat.js';
import competitorRoutes from './routes/competitors.js';
import metricsRoutes from './routes/metrics.js';
import reportRoutes from './routes/reports.js';
import webhookRoutes from './routes/webhooks.js';
import notificationRoutes from './routes/notifications.js';
import gdprRoutes from './routes/gdpr.js';
import billingRoutes from './routes/billing.js';
import visualAuditRoutes from './routes/visualAudit.js';

// Jobs scheduler
import { startScheduler } from './jobs/scheduler.js';
import { db } from './utils/db.js';

const app = express();
const PORT = process.env.PORT || 8080;

// ── Trust proxy (for Railway/Render deployment) ──────
app.set('trust proxy', 1);

// ── Security Middleware ──────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for Shopify iframe
  crossOriginEmbedderPolicy: false,
  xFrameOptions: false,
}));

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    'frame-ancestors https://admin.shopify.com https://*.myshopify.com;'
  );
  next();
});

// ── CORS ─────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'https://admin.shopify.com',
    /\.myshopify\.com$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Shopify-Hmac-Sha256', 'X-Shopify-Shop-Domain'],
}));

// ── Body Parsing ─────────────────────────────────────
// Raw body needed for Shopify webhook HMAC verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// ── Logging ──────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));
}

// ── Rate Limiting ─────────────────────────────────────
app.use('/api/', generalLimiter);

// ── Health Check ──────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Flovix API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.get('/', (req, res) => {
  const frontendUrl = new URL(process.env.FRONTEND_URL);

  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      frontendUrl.searchParams.set(key, value);
    }
  }

  res.redirect(frontendUrl.toString());
});

// ── API Routes ────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/competitors', competitorRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use('/api/billing', billingRoutes);
app.use('/api/visual-audit', visualAuditRoutes);

// ── 404 & Error Handling ──────────────────────────────
app.use(notFound);
app.use(errorHandler);

/* ------------------ CRASH PROTECTION ------------------ */
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

process.on('exit', (code) => {
  console.log('Process exited with code:', code);
});

// ── Start Server ──────────────────────────────────────
console.log("🚀 BEFORE LISTEN");

// Clean up any stuck RUNNING audits on startup
db.audit.updateMany({
  where: { status: 'RUNNING' },
  data: { status: 'FAILED' }
}).then(res => {
  if (res.count > 0) {
    logger.info(`Cleaned up ${res.count} stuck RUNNING audits on startup`);
  }
}).catch(err => {
  logger.error('Failed to clean up stuck audits on startup:', err);
});

db.visualAudit.updateMany({
  where: { status: 'RUNNING' },
  data: { status: 'FAILED' }
}).then(res => {
  if (res.count > 0) {
    logger.info(`Cleaned up ${res.count} stuck RUNNING visual audits on startup`);
  }
}).catch(err => {
  logger.error('Failed to clean up stuck visual audits on startup:', err);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log("🚀 AFTER LISTEN");

export default app;
