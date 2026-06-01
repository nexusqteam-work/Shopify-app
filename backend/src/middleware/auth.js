// ═══════════════════════════════════════════════════
//  Auth Middleware — JWT Verification
// ═══════════════════════════════════════════════════

import jwt from 'jsonwebtoken';
import { db } from '../utils/db.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.token;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const merchant = await db.merchant.findUnique({
      where: { id: decoded.merchantId, isActive: true },
      select: {
        id: true, shopDomain: true, shopName: true,
        email: true, plan: true, accessToken: true,
      },
    });

    if (!merchant) {
      return res.status(401).json({ success: false, error: 'Merchant not found or inactive' });
    }

    // Update last seen
    await db.merchant.update({
      where: { id: merchant.id },
      data: { lastSeenAt: new Date() },
    });

    req.merchant = merchant;
    next();
  } catch (err) {
    next(err);
  }
}

// Check if merchant has required plan
export function requirePlan(...plans) {
  return (req, res, next) => {
    if (!plans.includes(req.merchant.plan)) {
      return res.status(403).json({
        success: false,
        error: `This feature requires ${plans.join(' or ')} plan`,
        upgradeRequired: true,
      });
    }
    next();
  };
}
