import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../utils/db.js';
import { authenticate } from '../middleware/auth.js';
import { validate, tokenSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/auth/me — Get current merchant
router.get('/me', authenticate, async (req, res) => {
  const merchant = await db.merchant.findUnique({
    where:  { id: req.merchant.id },
    select: {
      id: true, shopDomain: true, shopName: true,
      email: true, plan: true, timezone: true,
      currency: true, installedAt: true, lastSeenAt: true,
    },
  });
  res.json({ success: true, merchant });
});

// POST /api/auth/token — Exchange an existing authenticated cookie session for a frontend JWT
router.post('/token', authenticate, validate(tokenSchema), async (req, res, next) => {
  try {
    const { shopDomain } = req.body;
    if (shopDomain !== req.merchant.shopDomain) {
      return res.status(403).json({ success: false, error: 'Shop domain does not match the active session' });
    }

    const token = jwt.sign(
      { merchantId: req.merchant.id, shopDomain },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, token });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out' });
});

export default router;
