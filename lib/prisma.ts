import { PrismaClient, Prisma } from "@prisma/client";

declare global {
  /* eslint-disable-next-line no-var */
  var prisma: PrismaClient | undefined;
}

// Guard: Skip Prisma initialization during Next.js build phase
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.npm_lifecycle_event === 'build';

// Enhanced Prisma configuration with better logging and optimization
const prisma = isBuildPhase 
  ? (null as unknown as PrismaClient) 
  : (global.prisma || new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Connection pool optimization via DATABASE_URL parameters:
      // PostgreSQL: postgresql://user:password@localhost:5432/db?connection_limit=20&pool_timeout=20&connect_timeout=60
      // SQLite: file:./dev.db?connection_limit=1 (SQLite only supports 1 connection)
    }));

// Add query monitoring for performance optimization (non-breaking)
if (!isBuildPhase && process.env.NODE_ENV !== "test" && typeof window === "undefined") {
  import('./prisma-pool-monitor').then(({ prismaPoolMonitor }) => {
    // Wrap critical query methods with monitoring
    const originalFindMany = prisma.$queryRaw.bind(prisma);
    const originalFindUnique = prisma.$executeRaw.bind(prisma);

    // Monitor raw queries for performance insights
    prisma.$queryRaw = new Proxy(originalFindMany, {
      apply: (target, thisArg, argArray: [Prisma.Sql, ...any[]]) => {
        return prismaPoolMonitor.monitorQuery('$queryRaw', () =>
          target.apply(thisArg, argArray)
        );
      }
    });

    prisma.$executeRaw = new Proxy(originalFindUnique, {
      apply: (target, thisArg, argArray: [Prisma.Sql, ...any[]]) => {
        return prismaPoolMonitor.monitorQuery('$executeRaw', () =>
          target.apply(thisArg, argArray)
        );
      }
    });
  }).catch(() => {
    // Fail silently - monitoring is optional
  });
}

// Enhanced connection management
if (!isBuildPhase && !global.prisma && typeof window === "undefined") {
  const connectWithRetry = async (maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await prisma.$connect();
        console.log("✅ Database connected successfully");
        return;
      } catch (error) {
        console.error(`❌ Database connection attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  };

  // Connect with retry logic (skip in production build to avoid build failures)
  if (process.env.NODE_ENV !== "production" || process.env.DATABASE_URL) {
    connectWithRetry().catch(console.error);
  }
}

// Graceful shutdown handling
if (!isBuildPhase && typeof window === "undefined") {
  const gracefulShutdown = async () => {
    console.log("🔄 Gracefully shutting down database connection...");
    await prisma.$disconnect();
    console.log("✅ Database disconnected successfully");
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
  process.on("beforeExit", gracefulShutdown);
}

if (!isBuildPhase && process.env.NODE_ENV === "development") global.prisma = prisma;

export { prisma };
export default prisma;
