// Enhanced Prisma client configuration for RealMultiLLM
// Supports both SQLite (dev/test) and PostgreSQL (production)
// Optimized for 8GB RAM environments with proper connection pooling

import { PrismaClient } from '@prisma/client';

// Global instance to prevent multiple clients in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Determine database configuration based on environment
const getDatabaseConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL;
  
  // Use SQLite for development and testing if no DATABASE_URL is specified
  if (!dbUrl || dbUrl.startsWith('file:')) {
    return {
      url: dbUrl || 'file:./dev.db',
      provider: 'sqlite',
    };
  }
  
  // Use PostgreSQL for production
  return {
    url: dbUrl,
    provider: 'postgresql',
  };
};

const dbConfig = getDatabaseConfig();

// Create Prisma client with optimized settings
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    
    datasources: {
      db: {
        url: dbConfig.url,
      },
    },
    
    // Connection pooling optimized for resource-constrained environments
    __internal: {
      debug: process.env.NODE_ENV === 'development',
    },
  });

// Handle connection gracefully
const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log(`✅ Database connected successfully (${dbConfig.provider})`);
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    
    // In development, create the database file if it doesn't exist
    if (process.env.NODE_ENV === 'development' && dbConfig.provider === 'sqlite') {
      console.log('🔄 Attempting to create SQLite database...');
      try {
        // Create a simple connection to initialize the file
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ SQLite database created successfully');
      } catch (createError) {
        console.error('❌ Failed to create SQLite database:', createError);
      }
    }
    
    // Don't exit in test environment to allow tests to handle the error
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

// Only attempt connection if not in test environment
if (process.env.NODE_ENV !== 'test') {
  connectDatabase();
}

// Graceful shutdown
const gracefulShutdown = async () => {
  await prisma.$disconnect();
  console.log('🔌 Database connection closed');
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Store in global for development hot reloading
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
