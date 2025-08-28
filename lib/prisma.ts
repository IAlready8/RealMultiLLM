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

// Connect on startup to avoid connection delays
if (!global.prisma) {
  prisma.$connect().catch(console.error);
}

if (process.env.NODE_ENV === "development") global.prisma = prisma;

export default prisma;
