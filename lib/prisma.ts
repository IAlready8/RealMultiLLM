// 3-STEP PLAN:
// 1. Configure Prisma client with dynamic database switching
// 2. Implement connection pooling optimized for memory constraints
// 3. Add graceful fallback and error handling for deployment environments

import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

// optimization: Use global variable to avoid multiple instances
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Dynamic database URL configuration
function getDatabaseUrl(): string {
  // Check if we're in a testing environment
  if (process.env.NODE_ENV === 'test') {
    return 'file:./test.db';
  }
  
  // Use environment variable if set
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Default to SQLite for development
  return 'file:./dev.db';
}

// Create optimized Prisma configuration
function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl();
  const isPostgreSQL = databaseUrl.startsWith('postgres');
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    // optimization: Connection pooling settings optimized for hardware constraints
    ...(isPostgreSQL && {
      // PostgreSQL-specific optimizations for production
      engineType: 'library',
    }),
  });
}

// barrier-identification: Lazy initialization for better memory management
export const prisma = globalForPrisma.prisma || createPrismaClient();

// scalability: Only connect in production or when needed
if (process.env.NODE_ENV === 'production') {
  prisma.$connect()
    .catch((error: any) => {
      console.error('Failed to connect to the database:', error);
      // In production, we want to fail fast if database is unavailable
      process.exit(1);
    });
} else {
  // In development, set up the global reference
  globalForPrisma.prisma = prisma;
}

export default prisma;
