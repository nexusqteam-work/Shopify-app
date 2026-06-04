// ═══════════════════════════════════════════════════
//  AI Chat Service — Claude with full store context
// ═══════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import { db } from '../utils/db.js';
import { logger } from '../utils/logger.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function buildFallbackReply(merchant, latestAudit, issues, metrics, userMessage) {
  const topIssue = issues[0];
  const latestRevenue = metrics.reduce((sum, metric) => sum + (metric.revenue || 0), 0);
  const latestOrders = metrics.reduce((sum, metric) => sum + (metric.orders || 0), 0);

  const genericAdvice = topIssue
    ? `Your highest-priority issue right now is "${topIssue.title}", worth about Rs ${Math.round(topIssue.impact).toLocaleString('en-IN')} per month. Start there, then run a fresh scan to confirm the improvement.`
    : `I can see your store is connected, but there is no completed audit yet. Run a new store scan first so I can give store-specific recommendations.`;

  const question = userMessage.toLowerCase();

  if (question.includes('sales') || question.includes('revenue')) {
    return `In the last available data window, ${merchant.shopName} shows about Rs ${Math.round(latestRevenue).toLocaleString('en-IN')} in revenue from ${latestOrders} orders. ${genericAdvice}`;
  }

  if (question.includes('speed')) {
    return latestAudit
      ? `Your latest speed score is ${latestAudit.speedScore ?? 'not available'}/100. ${genericAdvice}`
      : `I do not have a completed audit yet, so I cannot confirm the store speed score. Run a new scan first, then I can point to the exact speed blockers.`;
  }

  if (question.includes('fix') || question.includes('first') || question.includes('priority')) {
    return genericAdvice;
  }

  return `I could not reach the AI provider just now, so here is the safest store-based answer I can give. ${genericAdvice}`;
}

// ── Build system prompt with live store data ─────────
async function buildSystemPrompt(merchant) {
  // Fetch latest audit
  const latestAudit = await db.audit.findFirst({
    where: { merchantId: merchant.id, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });

  // Fetch open issues
  const issues = await db.issue.findMany({
    where: { merchantId: merchant.id, isFixed: false },
    orderBy: { impact: 'desc' },
    take: 10,
  });

  // Fetch last 30 days metrics
  const metrics = await db.storeMetric.findMany({
    where: { merchantId: merchant.id },
    orderBy: { date: 'desc' },
    take: 30,
  });

  const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0);
  const totalOrders  = metrics.reduce((s, m) => s + m.orders, 0);
  const avgCVR       = metrics.length > 0
    ? (metrics.reduce((s, m) => s + m.conversionRate, 0) / metrics.length).toFixed(2)
    : 'unknown';

  const issuesList = issues.map((i, idx) =>
    `${idx + 1}. [${i.priority}] ${i.title} — ₹${i.impact.toLocaleString('en-IN')}/month loss | ${i.effortMinutes} min fix`
  ).join('\n');

  return `You are the AI Store Coach for "${merchant.shopName}" (${merchant.shopDomain}), a Shopify store. You are a world-class ecommerce consultant with deep Shopify expertise.

LIVE STORE DATA (last 30 days):
- Revenue: ₹${totalRevenue.toLocaleString('en-IN')}
- Orders: ${totalOrders}
- Avg Conversion Rate: ${avgCVR}%
- Plan: ${merchant.plan}

LATEST AUDIT RESULTS:
- Overall Score: ${latestAudit?.overallScore ?? 'Not audited yet'}/100
- Page Speed Score: ${latestAudit?.speedScore ?? 'N/A'}/100
- SEO Score: ${latestAudit?.seoScore ?? 'N/A'}/100
- Conversion Score: ${latestAudit?.conversionScore ?? 'N/A'}/100
- Product Score: ${latestAudit?.productScore ?? 'N/A'}/100
- Checkout Score: ${latestAudit?.checkoutScore ?? 'N/A'}/100
- Mobile Score: ${latestAudit?.mobileScore ?? 'N/A'}/100
- AI Summary: ${latestAudit?.aiSummary ?? 'Run an audit to get insights'}

OPEN ISSUES (ranked by revenue impact):
${issuesList || 'No issues found yet — run an audit first'}

YOUR ROLE:
- Give specific, data-driven advice based on THIS store's actual numbers
- Always reference the actual scores and issues above
- Be direct and actionable — no generic advice
- Use Indian Rupees (₹) for all money amounts
- Keep responses concise: answer in 3-5 sentences max unless the question needs detail
- If asked to fix something, give the exact Shopify Admin path
- If asked about something outside your data, say so clearly
- Prioritize by revenue impact always`;
}

async function getStoreContext(merchant) {
  const [latestAudit, issues, metrics] = await Promise.all([
    db.audit.findFirst({
      where: { merchantId: merchant.id, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    }),
    db.issue.findMany({
      where: { merchantId: merchant.id, isFixed: false },
      orderBy: { impact: 'desc' },
      take: 10,
    }),
    db.storeMetric.findMany({
      where: { merchantId: merchant.id },
      orderBy: { date: 'desc' },
      take: 30,
    }),
  ]);

  return { latestAudit, issues, metrics };
}

// ── Send message and get AI response ────────────────
export async function sendChatMessage(merchant, sessionId, userMessage) {
  // Fetch conversation history
  const history = await db.chatMessage.findMany({
    where: { merchantId: merchant.id, sessionId },
    orderBy: { createdAt: 'asc' },
    take: 20, // Last 20 messages for context window
  });

  // Save user message
  await db.chatMessage.create({
    data: {
      merchantId: merchant.id,
      sessionId,
      role:       'user',
      content:    userMessage,
    },
  });

  // Build message history for Claude
  const messages = history.map(m => ({
    role:    m.role === 'assistant' ? 'model' : 'user',
    parts:   [{ text: m.content }],
  }));
  messages.push({ role: 'user', parts: [{ text: userMessage }] });

  const { latestAudit, issues, metrics } = await getStoreContext(merchant);
  const systemPrompt = await buildSystemPrompt(merchant);

  let assistantMessage = '';
  let tokensUsed = 0;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const response = await ai.models.generateContent({
      model:      'gemini-3.5-flash',
      contents:   messages,
      config: {
        maxOutputTokens: 1000,
        systemInstruction: systemPrompt,
      }
    });

    assistantMessage = response.text || '';
    tokensUsed = response.usageMetadata?.totalTokenCount || 0;
  } catch (err) {
    logger.error('AI chat generation failed:', err);
    assistantMessage = buildFallbackReply(merchant, latestAudit, issues, metrics, userMessage);
  }

  if (!assistantMessage) {
    assistantMessage = 'I could not generate a response right now. Please try again after running a fresh store scan.';
  }

  // Save assistant response
  await db.chatMessage.create({
    data: {
      merchantId: merchant.id,
      sessionId,
      role:       'assistant',
      content:    assistantMessage,
      tokensUsed,
    },
  });

  return { message: assistantMessage, tokensUsed };
}

// ── Get chat history for a session ──────────────────
export async function getChatHistory(merchantId, sessionId) {
  return db.chatMessage.findMany({
    where:   { merchantId, sessionId },
    orderBy: { createdAt: 'asc' },
    select:  { role: true, content: true, createdAt: true },
  });
}

// ── List all chat sessions for a merchant ────────────
export async function getChatSessions(merchantId) {
  const sessions = await db.chatMessage.groupBy({
    by:      ['sessionId'],
    where:   { merchantId },
    _max:    { createdAt: true },
    _count:  { id: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take:    20,
  });

  return sessions.map(s => ({
    sessionId:    s.sessionId,
    messageCount: s._count.id,
    lastMessage:  s._max.createdAt,
  }));
}
