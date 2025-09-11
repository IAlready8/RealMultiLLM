// Re-export rate limiting functionality from the main rate-limit module
import { checkAndConsume, resetAll } from '@/lib/rate-limit';

export { resetAll as resetApiRateLimit } from '@/lib/rate-limit';

// Enhanced rate limit check with additional properties
export async function checkApiRateLimit(request: Request, endpoint: string, userId: string, config?: RateLimitConfig): Promise<RateLimitResult> {
  // Default config for API rate limiting
  const defaultConfig: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    max: 100
  };
  
  const rateLimitConfig = config || defaultConfig;
  const key = `api:${userId}:${endpoint}`;
  
  const result = await checkAndConsume(key, rateLimitConfig);
  
  // Enhance the result with additional properties expected by the API routes
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfterMs: result.retryAfterMs,
    limit: rateLimitConfig.max,
    resetTime: Date.now() + result.retryAfterMs
  };
}

// Rate limit error class
export class RateLimitError extends Error {
  constructor(
    message: string,
    public code: string = 'RATE_LIMIT_EXCEEDED',
    public details?: any
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Type definitions
export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
  resetTime: number;
}

// Helper function to get rate limit status
export async function getApiRateLimitStatus(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  // This would need to be implemented based on the actual rate limiting logic
  // For now, return a default implementation
  return {
    allowed: true,
    remaining: config.max,
    retryAfterMs: 0,
    limit: config.max,
    resetTime: Date.now() + config.windowMs
  };
}