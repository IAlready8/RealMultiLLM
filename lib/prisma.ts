import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Enhanced Prisma configuration with better logging and optimization
const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Note: Advanced connection pool settings would be configured via DATABASE_URL parameters
  // For PostgreSQL: postgresql://user:password@localhost:5432/db?connection_limit=10&pool_timeout=5000
});

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
