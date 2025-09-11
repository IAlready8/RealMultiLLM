import { z } from 'zod';

const envSchema = z.object({
  // Core App Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  
  // LLM Provider API Keys (optional but recommended)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  
  // Redis Configuration
  REDIS_URL: z.string().optional(),
  
  // Security Configuration
  ENCRYPTION_MASTER_KEY: z.string().min(64, 'ENCRYPTION_MASTER_KEY must be at least 64 characters for AES-256'),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.string().transform((val) => val === 'true').default(true as unknown as any),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform((val) => parseInt(val, 10)).default(100 as unknown as any),
  RATE_LIMIT_WINDOW_MS: z.string().transform((val) => parseInt(val, 10)).default(900000 as unknown as any), // 15 minutes
  
  // Session Security
  SESSION_MAX_AGE: z.string().transform((val) => parseInt(val, 10)).default(7200 as unknown as any), // 2 hours instead of 30 days
  
  // Development/Demo Mode
  ALLOW_DEMO_MODE: z.string().transform((val) => val === 'true').default(false as unknown as any),
  
  // Monitoring and Logging
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Feature Flags
  ENABLE_ANALYTICS: z.string().transform((val) => val === 'true').default(true as unknown as any),
  ENABLE_TELEMETRY: z.string().transform((val) => val === 'true').default(true as unknown as any),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

export function getValidatedEnv(): Env {
  if (!validatedEnv) {
    try {
      validatedEnv = envSchema.parse(process.env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
        console.error('❌ Environment validation failed:', issues);
        if (process.env.NODE_ENV === 'production') {
          process.exit(1);
        } else {
          console.warn('⚠️  Running in development with incomplete environment configuration');
          console.warn('Please check .env.example for required variables');
        }
      }
      throw error;
    }
  }
  return validatedEnv;
}

// Helper functions for common environment checks
export function isProduction(): boolean {
  return getValidatedEnv().NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return getValidatedEnv().NODE_ENV === 'development';
}

export function isTest(): boolean {
  return getValidatedEnv().NODE_ENV === 'test';
}

export function isDemoModeEnabled(): boolean {
  return getValidatedEnv().ALLOW_DEMO_MODE && isDevelopment();
}

// Security configuration getters
export function getEncryptionKey(): string {
  const env = getValidatedEnv();
  return env.ENCRYPTION_MASTER_KEY;
}

export function getSessionMaxAge(): number {
  return getValidatedEnv().SESSION_MAX_AGE;
}

export function getRateLimitConfig() {
  const env = getValidatedEnv();
  return {
    enabled: env.RATE_LIMIT_ENABLED,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  };
}
