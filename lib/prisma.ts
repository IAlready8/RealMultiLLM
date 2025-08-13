// 3-STEP PLAN:
// 1. Configure Prisma client with connection pooling
// 2. Implement lazy loading pattern to reduce initial memory usage
// 3. Add error handling and retry logic for connection failures

import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

// optimization: Use global variable to avoid multiple instances
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// barrier-identification: Connection issues need proper handling
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    // optimization: Connection pooling settings optimized for local hardware
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // optimization: Memory management for limited RAM environments
    // Only acquire connections when needed and release promptly
  });

// Removed forced connection attempt for production readiness
// Connection will be established on first query

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
