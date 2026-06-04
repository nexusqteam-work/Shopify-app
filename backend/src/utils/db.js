// ═══════════════════════════════════════════════════
//  Prisma Database Client — Singleton
// ═══════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const globalForPrisma = globalThis;

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

if (process.env.NODE_ENV === 'development') {
  db.$on('query', (e) => {
    logger.debug(`Query: ${e.query} | Duration: ${e.duration}ms`);
  });
}

db.$on('error', (e) => {
  logger.error(`Prisma error: ${e.message || JSON.stringify(e) || e}`);
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await db.$disconnect();
});
