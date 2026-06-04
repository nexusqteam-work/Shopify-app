// ═══════════════════════════════════════════════════
//  Email Service — Nodemailer
// ═══════════════════════════════════════════════════

import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from:    process.env.EMAIL_FROM || 'no-reply@storecoach.ai',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.warn(`Failed to send email to ${to} (SMTP connection error): ${error.message}`);
    // Return a mock result to prevent caller crashes
    return { messageId: 'mock-id-smtp-skipped', error: error.message };
  }
}

// ── Welcome email on install ─────────────────────────
export async function sendWelcomeEmail(merchant) {
  await sendEmail({
    to:      merchant.email,
    subject: `Welcome to StoreCoach, ${merchant.shopName}! 🚀`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: #0D1320; padding: 32px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: #00C896; margin: 0 0 8px; font-size: 28px;">Welcome to StoreCoach! 🎉</h1>
          <p style="color: #8A9BBF; margin: 0; font-size: 16px;">Your AI store advisor is ready</p>
        </div>
        <p style="color: #5A6A8A; font-size: 15px; line-height: 1.6;">
          Hi there! StoreCoach is now connected to <strong>${merchant.shopName}</strong>.
        </p>
        <p style="color: #5A6A8A; font-size: 15px; line-height: 1.6;">
          Your first AI audit is running in the background. You'll get a full report with:
        </p>
        <ul style="color: #5A6A8A; font-size: 15px; line-height: 2;">
          <li>📊 Your store health score across 6 categories</li>
          <li>💰 Exact revenue you're losing and why</li>
          <li>⚡ Step-by-step fix instructions for every issue</li>
          <li>🤖 24/7 AI advisor that knows your store data</li>
        </ul>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.FRONTEND_URL}" style="background: #00C896; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px;">
            View Your Dashboard →
          </a>
        </div>
        <p style="color: #9AA5BE; font-size: 12px; text-align: center;">
          StoreCoach · ${merchant.shopDomain}
        </p>
      </div>
    `,
  });
}

// ── New issue alert ──────────────────────────────────
export async function sendIssueAlertEmail(merchant, issues) {
  const topIssue = issues[0];
  await sendEmail({
    to:      merchant.email,
    subject: `⚠️ ${issues.length} Issues Found — ₹${issues.reduce((s, i) => s + i.impact, 0).toLocaleString('en-IN')}/mo at risk`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #EF4444;">⚠️ Action Required: ${issues.length} Issues Found</h2>
        <p style="color: #5A6A8A;">Your latest StoreCoach audit found issues costing your store money every month.</p>
        <div style="background: #FFF5F5; border-left: 4px solid #EF4444; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <strong style="color: #EF4444;">#1 Priority: ${topIssue.title}</strong>
          <p style="color: #5A6A8A; margin: 8px 0 0; font-size: 14px;">Estimated loss: ₹${topIssue.impact.toLocaleString('en-IN')}/month · Fix time: ${topIssue.effortMinutes} minutes</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/issues" style="background: #EF4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 8px;">
          Fix Issues Now →
        </a>
      </div>
    `,
  });
}
