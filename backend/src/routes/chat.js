// ═══════════════════════════════════════════════════
//  routes/chat.js — with validation + plan enforcement
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authenticate, requirePlan } from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimiter.js';
import { validate, chatMessageSchema } from '../middleware/validation.js';
import { sendChatMessage, getChatHistory, getChatSessions } from '../services/chatService.js';
import { db } from '../utils/db.js';

const router = Router();
router.use(authenticate);

// Daily chat message limits by plan
const CHAT_LIMITS = { FREE: 9999, GROWTH: 9999, PRO: 9999, AGENCY: 9999 };

async function enforceChatLimit(req, res, next) {
  const limit = CHAT_LIMITS[req.merchant.plan] || 10;
  if (limit >= 9999) return next(); // Unlimited

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await db.chatMessage.count({
    where: {
      merchantId: req.merchant.id,
      role:       'user',
      createdAt:  { gte: today },
    },
  });

  if (count >= limit) {
    return res.status(429).json({
      success: false,
      error:   `Daily chat limit of ${limit} messages reached. Upgrade your plan for more.`,
      upgradeRequired: true,
    });
  }
  next();
}

// POST /api/chat/message
router.post('/message',
  chatLimiter,
  enforceChatLimit,
  validate(chatMessageSchema),
  async (req, res, next) => {
    try {
      const { message, sessionId } = req.body;
      const session = sessionId || uuid();
      const result  = await sendChatMessage(req.merchant, session, message.trim());
      res.json({ success: true, sessionId: session, ...result });
    } catch (err) { next(err); }
  }
);

// GET /api/chat/sessions
router.get('/sessions', async (req, res, next) => {
  try {
    const sessions = await getChatSessions(req.merchant.id);
    res.json({ success: true, sessions });
  } catch (err) { next(err); }
});

// GET /api/chat/history/:sessionId
router.get('/history/:sessionId', async (req, res, next) => {
  try {
    const messages = await getChatHistory(req.merchant.id, req.params.sessionId);
    res.json({ success: true, messages });
  } catch (err) { next(err); }
});

// DELETE /api/chat/history/:sessionId
router.delete('/history/:sessionId', async (req, res, next) => {
  try {
    await db.chatMessage.deleteMany({
      where: { merchantId: req.merchant.id, sessionId: req.params.sessionId },
    });
    res.json({ success: true, message: 'Session cleared' });
  } catch (err) { next(err); }
});

// GET /api/chat/usage — How many messages used today
router.get('/usage', async (req, res, next) => {
  try {
    const limit = CHAT_LIMITS[req.merchant.plan] || 10;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const used  = await db.chatMessage.count({
      where: { merchantId: req.merchant.id, role: 'user', createdAt: { gte: today } },
    });
    res.json({ success: true, used, limit, remaining: Math.max(0, limit - used) });
  } catch (err) { next(err); }
});

export default router;
