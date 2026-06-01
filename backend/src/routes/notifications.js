// ═══════════════════════════════════════════════════
//  routes/notifications.js
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { db } from '../utils/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const notifications = await db.notification.findMany({
      where:   { merchantId: req.merchant.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ success: true, notifications, unreadCount });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res, next) => {
  try {
    await db.notification.updateMany({
      where: { merchantId: req.merchant.id, isRead: false },
      data:  { isRead: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    await db.notification.updateMany({
      where: { id: req.params.id, merchantId: req.merchant.id },
      data:  { isRead: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await db.notification.deleteMany({
      where: { id: req.params.id, merchantId: req.merchant.id },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
