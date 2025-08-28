import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Connect on startup to avoid connection delays (only in runtime, not build)
if (!global.prisma && typeof window === "undefined" && process.env.NODE_ENV !== "production") {
  prisma.$connect().catch(() => {
    // Silently fail during build time if DB not available
  });
}

if (process.env.NODE_ENV === "development") global.prisma = prisma;

export default prisma;
