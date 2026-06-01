// ═══════════════════════════════════════════════════
//  Job Scheduler — Cron Jobs for Background Tasks
// ═══════════════════════════════════════════════════

import cron from 'node-cron';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { runFullAudit } from '../services/auditEngine.js';
import { generateWeeklyReport } from '../services/reportService.js';
import { snapshotCompetitor } from '../routes/competitors.js';

export function startScheduler() {
  // ── Daily Audit at 2:00 AM IST ───────────────────
  // Runs audits for all active merchants on GROWTH+ plan
  cron.schedule('0 2 * * *', async () => {
    logger.info('⏰ Daily audit job started');
    try {
      const merchants = await db.merchant.findMany({
        where: {
          isActive: true,
          plan:     { in: ['GROWTH', 'PRO', 'AGENCY'] },
        },
        select: { id: true, shopDomain: true, shopName: true, accessToken: true, plan: true },
      });

      logger.info(`Running daily audits for ${merchants.length} merchants`);

      // Process in batches of 5 to avoid API rate limits
      for (let i = 0; i < merchants.length; i += 5) {
        const batch = merchants.slice(i, i + 5);
        await Promise.allSettled(
          batch.map(async merchant => {
            try {
              // Check if audit already ran today
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const existingAudit = await db.audit.findFirst({
                where: { merchantId: merchant.id, createdAt: { gte: today } },
              });
              if (existingAudit) return;

              const audit = await db.audit.create({ data: { merchantId: merchant.id } });
              await runFullAudit(audit.id, merchant);
              logger.info(`Daily audit complete: ${merchant.shopDomain}`);
            } catch (err) {
              logger.error(`Daily audit failed for ${merchant.shopDomain}:`, err.message);
            }
          })
        );
        // 10s delay between batches
        if (i + 5 < merchants.length) {
          await new Promise(r => setTimeout(r, 10000));
        }
      }
      logger.info('⏰ Daily audit job complete');
    } catch (err) {
      logger.error('Daily audit job crashed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── Weekly Report — Every Monday at 8:00 AM IST ──
  cron.schedule('0 8 * * 1', async () => {
    logger.info('⏰ Weekly report job started');
    try {
      const merchants = await db.merchant.findMany({
        where: { isActive: true, plan: { in: ['GROWTH', 'PRO', 'AGENCY'] } },
        select: { id: true, shopDomain: true, shopName: true, email: true, plan: true },
      });

      for (const merchant of merchants) {
        try {
          await generateWeeklyReport(merchant.id);
          logger.info(`Weekly report sent: ${merchant.shopDomain}`);
          await new Promise(r => setTimeout(r, 2000)); // 2s between emails
        } catch (err) {
          logger.error(`Weekly report failed for ${merchant.shopDomain}:`, err.message);
        }
      }
      logger.info('⏰ Weekly report job complete');
    } catch (err) {
      logger.error('Weekly report job crashed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── Competitor Scan — Every 24h at 3:00 AM IST ───
  cron.schedule('0 3 * * *', async () => {
    logger.info('⏰ Competitor scan job started');
    try {
      const competitors = await db.competitor.findMany({
        include: { merchant: { select: { id: true, shopDomain: true, plan: true, accessToken: true } } },
        where:   { merchant: { isActive: true, plan: { in: ['PRO', 'AGENCY'] } } },
      });

      for (const competitor of competitors) {
        try {
          await snapshotCompetitor(competitor, competitor.merchant);
          await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
          logger.error(`Competitor scan failed for ${competitor.storeUrl}:`, err.message);
        }
      }
      logger.info(`⏰ Competitor scan complete: ${competitors.length} stores checked`);
    } catch (err) {
      logger.error('Competitor scan job crashed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── Metrics Sync — Every 6 hours ─────────────────
  cron.schedule('0 */6 * * *', async () => {
    logger.info('⏰ Metrics sync job started');
    try {
      const merchants = await db.merchant.findMany({
        where:  { isActive: true },
        select: { id: true, shopDomain: true, accessToken: true },
      });

      for (const merchant of merchants) {
        try {
          const { syncMetricsFromShopify } = await import('../routes/metrics.js');
          await syncMetricsFromShopify(merchant);
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          logger.error(`Metrics sync failed for ${merchant.shopDomain}:`, err.message);
        }
      }
      logger.info('⏰ Metrics sync complete');
    } catch (err) {
      logger.error('Metrics sync job crashed:', err);
    }
  });

  // ── Cleanup old data — Every Sunday at 1 AM IST ──
  cron.schedule('0 1 * * 0', async () => {
    logger.info('⏰ Cleanup job started');
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90); // Keep 90 days

      // Delete old chat messages
      const deletedChats = await db.chatMessage.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      // Delete old notifications (keep last 100 per merchant)
      const merchants = await db.merchant.findMany({ select: { id: true } });
      for (const m of merchants) {
        const notifications = await db.notification.findMany({
          where:   { merchantId: m.id },
          orderBy: { createdAt: 'desc' },
          skip:    100,
          select:  { id: true },
        });
        if (notifications.length > 0) {
          await db.notification.deleteMany({
            where: { id: { in: notifications.map(n => n.id) } },
          });
        }
      }

      logger.info(`⏰ Cleanup done: ${deletedChats.count} chat messages purged`);
    } catch (err) {
      logger.error('Cleanup job failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });

  logger.info('✅ All cron jobs scheduled');
}
