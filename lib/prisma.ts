import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Enhanced Prisma configuration with better logging and optimization
let prisma: any;

try {
  prisma = global.prisma || new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pool optimization via DATABASE_URL parameters:
    // PostgreSQL: postgresql://user:password@localhost:5432/db?connection_limit=20&pool_timeout=20&connect_timeout=60
    // SQLite: file:./dev.db?connection_limit=1 (SQLite only supports 1 connection)
  });
} catch (error) {
  // If Prisma client hasn't been generated (e.g., in test environments or CI without network access)
  // create a minimal mock to prevent import errors
  console.warn('Prisma client not generated, using minimal mock');
  
  const createMockModel = () => ({
    findUnique: async () => null,
    findMany: async () => [],
    create: async (data: any) => data.data || data,
    update: async (data: any) => data.data || data,
    upsert: async (data: any) => data.create || data.update || data,
    delete: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
    count: async () => 0,
    aggregate: async () => ({}),
    updateMany: async () => ({ count: 0 }),
  });
  
  prisma = {
    user: createMockModel(),
    conversation: createMockModel(),
    providerConfig: createMockModel(),
    persona: createMockModel(),
    analytics: createMockModel(),
    account: createMockModel(),
    session: createMockModel(),
    verificationToken: createMockModel(),
    goal: createMockModel(),
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
    $transaction: async (fn: any) => typeof fn === 'function' ? fn(prisma) : Promise.all(fn),
    $connect: async () => {},
    $disconnect: async () => {},
  };
}

// Add query monitoring for performance optimization (non-breaking)
if (process.env.NODE_ENV !== "test") {
  import('./prisma-pool-monitor').then(({ prismaPoolMonitor }) => {
    // Wrap critical query methods with monitoring
    const originalFindMany = prisma.$queryRaw.bind(prisma);
    const originalFindUnique = prisma.$executeRaw.bind(prisma);

    // Monitor raw queries for performance insights
    prisma.$queryRaw = new Proxy(originalFindMany, {
      apply: (target, thisArg, argArray) => {
        return prismaPoolMonitor.monitorQuery('$queryRaw', () =>
          target.apply(thisArg, argArray)
        );
      }
    });

    prisma.$executeRaw = new Proxy(originalFindUnique, {
      apply: (target, thisArg, argArray) => {
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
if (!global.prisma && typeof window === "undefined") {
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
if (typeof window === "undefined") {
  const gracefulShutdown = async () => {
    console.log("🔄 Gracefully shutting down database connection...");
    await prisma.$disconnect();
    console.log("✅ Database disconnected successfully");
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
  process.on("beforeExit", gracefulShutdown);
}

if (process.env.NODE_ENV === "development") global.prisma = prisma;

export default prisma;
