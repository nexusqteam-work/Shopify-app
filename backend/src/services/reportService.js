// ═══════════════════════════════════════════════════
//  Report Service — Weekly & Monthly AI Reports
// ═══════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from './emailService.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Generate weekly report for a merchant ────────────
export async function generateWeeklyReport(merchantId) {
  const merchant = await db.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new Error('Merchant not found');

  const now     = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get this week's metrics
  const metrics = await db.storeMetric.findMany({
    where:   { merchantId, date: { gte: weekAgo } },
    orderBy: { date: 'asc' },
  });

  const prevWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevMetrics = await db.storeMetric.findMany({
    where:   { merchantId, date: { gte: prevWeekStart, lt: weekAgo } },
    orderBy: { date: 'asc' },
  });

  // Aggregate this week
  const thisWeek = aggregateMetrics(metrics);
  const lastWeek = aggregateMetrics(prevMetrics);

  // Get issues status
  const openIssues  = await db.issue.count({ where: { merchantId, isFixed: false } });
  const fixedIssues = await db.issue.count({ where: { merchantId, isFixed: true } });

  // Get latest audit score
  const latestAudit = await db.audit.findFirst({
    where:   { merchantId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select:  { overallScore: true, totalRevenueLoss: true },
  });

  const reportData = {
    period:       getWeekPeriod(now),
    merchant:     { name: merchant.shopName, domain: merchant.shopDomain },
    thisWeek,
    lastWeek,
    changes:      calculateChanges(thisWeek, lastWeek),
    issues:       { open: openIssues, fixed: fixedIssues },
    auditScore:   latestAudit?.overallScore,
    revenueLoss:  latestAudit?.totalRevenueLoss,
  };

  // Generate AI summary
  reportData.aiSummary = await generateReportSummary(reportData);

  // Determine period string
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  const periodStr = `${year}-W${String(week).padStart(2, '0')}`;

  // Save report (upsert in case already exists)
  const report = await db.report.upsert({
    where:  { merchantId_type_period: { merchantId, type: 'WEEKLY', period: periodStr } },
    create: { merchantId, type: 'WEEKLY', period: periodStr, data: reportData, aiSummary: reportData.aiSummary },
    update: { data: reportData, aiSummary: reportData.aiSummary },
  });

  // Send email report in background (non-blocking)
  sendWeeklyReportEmail(merchant, reportData)
    .then(async () => {
      await db.report.update({
        where: { id: report.id },
        data:  { emailSentAt: new Date() },
      }).catch(() => {});
    })
    .catch((err) => {
      logger.error(`Failed to send weekly email to ${merchant.email}:`, err);
    });

  logger.info(`Weekly report generated for ${merchant.shopDomain}`);
  return report;
}

// ── Aggregate metric array ───────────────────────────
function aggregateMetrics(metrics) {
  if (!metrics.length) return { revenue: 0, orders: 0, visitors: 0, newCustomers: 0, avgCVR: 0, avgAOV: 0 };
  return {
    revenue:      metrics.reduce((s, m) => s + m.revenue, 0),
    orders:       metrics.reduce((s, m) => s + m.orders, 0),
    visitors:     metrics.reduce((s, m) => s + m.visitors, 0),
    newCustomers: metrics.reduce((s, m) => s + m.newCustomers, 0),
    avgCVR:       metrics.reduce((s, m) => s + m.conversionRate, 0) / metrics.length,
    avgAOV:       metrics.reduce((s, m) => s + m.avgOrderValue, 0) / metrics.length,
  };
}

// ── Calculate week-over-week changes ─────────────────
function calculateChanges(current, previous) {
  const pct = (curr, prev) => prev === 0 ? 0 : ((curr - prev) / prev * 100).toFixed(1);
  return {
    revenue:  pct(current.revenue, previous.revenue),
    orders:   pct(current.orders, previous.orders),
    visitors: pct(current.visitors, previous.visitors),
    cvr:      pct(current.avgCVR, previous.avgCVR),
  };
}

// ── AI-generated report summary ──────────────────────
async function generateReportSummary(data) {
  const prompt = `Write a 3-sentence weekly performance summary for a Shopify store.

Store: ${data.merchant.name}
This week revenue: ₹${data.thisWeek.revenue.toLocaleString('en-IN')} (${data.changes.revenue > 0 ? '+' : ''}${data.changes.revenue}% vs last week)
Orders: ${data.thisWeek.orders} (${data.changes.orders > 0 ? '+' : ''}${data.changes.orders}%)
Visitors: ${data.thisWeek.visitors} (${data.changes.visitors > 0 ? '+' : ''}${data.changes.visitors}%)
Conversion Rate: ${data.thisWeek.avgCVR?.toFixed(2)}%
Issues fixed this week: ${data.issues.fixed}
Issues still open: ${data.issues.open}
Store health score: ${data.auditScore}/100

Write in a direct, helpful tone. Mention one specific win and one key priority for next week.`;

  try {
    const res = await ai.models.generateContent({
      model:      'gemini-3.5-flash',
      contents:   prompt,
      config:     { maxOutputTokens: 200 },
    });
    return res.text || '';
  } catch (err) {
    logger.error('Report AI summary failed:', err);
    return `This week ${data.merchant.name} generated ₹${data.thisWeek.revenue.toLocaleString('en-IN')} in revenue with ${data.thisWeek.orders} orders. Focus on fixing the ${data.issues.open} open store issues to improve performance next week.`;
  }
}

// ── Weekly email template ────────────────────────────
export async function sendWeeklyReportEmail(merchant, data) {
  const subject = `📊 Your Weekly Store Report — ${merchant.shopName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f7f8fc; padding: 24px;">
      <div style="background: #0D1320; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
        <h1 style="color: #00C896; margin: 0; font-size: 22px;">StoreCoach Weekly Report</h1>
        <p style="color: #8A9BBF; margin: 8px 0 0;">${merchant.shopName} · ${new Date().toLocaleDateString('en-IN')}</p>
      </div>

      <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 16px;">
        <h2 style="color: #0D1320; font-size: 16px; margin-top: 0;">📈 This Week's Performance</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8EDF5; color: #5A6A8A; font-size: 14px;">Revenue</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8EDF5; font-weight: bold; font-size: 14px; text-align: right;">
              ₹${data.thisWeek.revenue.toLocaleString('en-IN')}
              <span style="color: ${data.changes.revenue >= 0 ? '#00C896' : '#EF4444'}; font-size: 12px; margin-left: 8px;">
                ${data.changes.revenue >= 0 ? '↑' : '↓'} ${Math.abs(data.changes.revenue)}%
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8EDF5; color: #5A6A8A; font-size: 14px;">Orders</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8EDF5; font-weight: bold; font-size: 14px; text-align: right;">${data.thisWeek.orders}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #5A6A8A; font-size: 14px;">Conversion Rate</td>
            <td style="padding: 10px 0; font-weight: bold; font-size: 14px; text-align: right;">${data.thisWeek.avgCVR?.toFixed(2)}%</td>
          </tr>
        </table>
      </div>

      <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 16px;">
        <h2 style="color: #0D1320; font-size: 16px; margin-top: 0;">🤖 AI Summary</h2>
        <p style="color: #5A6A8A; line-height: 1.6; font-size: 14px; margin: 0;">${data.aiSummary}</p>
      </div>

      <div style="background: ${data.issues.open > 0 ? '#FFF5F5' : '#F0FFF8'}; border: 1px solid ${data.issues.open > 0 ? '#FED7D7' : '#C6F6D5'}; padding: 20px; border-radius: 12px; margin-bottom: 16px;">
        <h2 style="color: #0D1320; font-size: 16px; margin-top: 0;">⚡ Action Items</h2>
        <p style="color: #5A6A8A; font-size: 14px; margin: 0;">
          ${data.issues.open} issues open · ${data.issues.fixed} issues fixed this week.
          ${data.issues.open > 0 ? `These are costing you an estimated ₹${data.revenueLoss?.toLocaleString('en-IN') || '0'}/month.` : 'Great job keeping your store healthy!'}
        </p>
      </div>

      <div style="text-align: center; padding: 16px;">
        <a href="${process.env.FRONTEND_URL}" style="background: #00C896; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
          View Full Dashboard →
        </a>
      </div>

      <p style="color: #9AA5BE; font-size: 12px; text-align: center; margin-top: 16px;">
        StoreCoach AI · Unsubscribe · ${merchant.shopDomain}
      </p>
    </div>
  `;

  await sendEmail({ to: merchant.email, subject, html });
}

// ── Helpers ──────────────────────────────────────────
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekPeriod(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - 6);
  return `${start.toLocaleDateString('en-IN')} – ${date.toLocaleDateString('en-IN')}`;
}
