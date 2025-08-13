import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import { createApiError, ErrorCodes } from './error-handler';
import { logger } from './logger';

// Initialize Redis client (will fallback to memory if no env vars)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Rate limiters for different endpoints and user types
export const rateLimiters = {
  // API rate limits
  apiGeneral: new Ratelimit({
    redis: redis || new Map() as any, // Fallback to memory if no Redis
    limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requests per minute
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  
  apiLLM: new Ratelimit({
    redis: redis || new Map() as any,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 LLM requests per minute
    analytics: true,
    prefix: 'ratelimit:llm',
  }),
  
  apiAuth: new Ratelimit({
    redis: redis || new Map() as any,
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 auth attempts per 15 minutes
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  // Premium tier gets higher limits
  apiLLMPremium: new Ratelimit({
    redis: redis || new Map() as any,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 LLM requests per minute for premium
    analytics: true,
    prefix: 'ratelimit:llm:premium',
  }),
};

// Get client identifier for rate limiting
export function getClientId(request: NextRequest): string {
  // Try to get user ID from session (if authenticated)
  const userAgent = request.headers.get('user-agent') || '';
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  // Use IP address as fallback
  const clientIp = forwardedFor?.split(',')[0] || realIp || 'unknown';
  
  // Create a more stable identifier
  const identifier = `${clientIp}-${userAgent.slice(0, 50)}`;
  
  return identifier;
}

// Rate limit middleware
export async function checkRateLimit(
  request: NextRequest,
  limiterType: keyof typeof rateLimiters,
  userId?: string
): Promise<{ success: boolean; error?: Response }> {
  try {
    const identifier = userId || getClientId(request);
    const limiter = rateLimiters[limiterType];
    
    logger.debug('Rate limit check', { 
      limiterType, 
      identifier: identifier.substring(0, 20) + '...', 
      userId: !!userId 
    });

    const { success, limit, reset, remaining } = await limiter.limit(identifier);

    if (!success) {
      logger.warn('Rate limit exceeded', {
        limiterType,
        identifier: identifier.substring(0, 20) + '...',
        userId: !!userId,
        limit,
        reset,
        remaining
      });

      const resetTime = new Date(reset);
      const apiError = createApiError(
        ErrorCodes.RATE_LIMIT_ERROR,
        'Rate limit exceeded. Please try again later.',
        {
          limit,
          remaining,
          reset: resetTime.toISOString(),
          retryAfter: Math.ceil((reset - Date.now()) / 1000)
        }
      );

      return {
        success: false,
        error: new Response(JSON.stringify(apiError), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        })
      };
    }

    logger.debug('Rate limit passed', { 
      limiterType, 
      remaining, 
      limit,
      userId: !!userId 
    });

    return { success: true };
  } catch (error) {
    logger.error('Rate limiting error', error);
    
    // On rate limiting errors, allow the request but log the issue
    return { success: true };
  }
}

// Rate limit decorator for API routes
export function withRateLimit(
  limiterType: keyof typeof rateLimiters
) {
  return function <T extends any[]>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<Response>>
  ) {
    const method = descriptor.value;
    if (!method) return;

    descriptor.value = async function (...args: T) {
      const request = args[0] as NextRequest;
      
      const rateLimitResult = await checkRateLimit(request, limiterType);
      if (!rateLimitResult.success && rateLimitResult.error) {
        return rateLimitResult.error;
      }

      return method.apply(this, args);
    };
  };
}

// Utility to get rate limit status for monitoring
export async function getRateLimitStatus(identifier: string): Promise<Record<string, any>> {
  const status: Record<string, any> = {};
  
  for (const [name, limiter] of Object.entries(rateLimiters)) {
    try {
      // This is a simplified way to check status - in practice you'd implement
      // a more sophisticated monitoring solution
      status[name] = {
        configured: true,
        redis: !!redis,
      };
    } catch (error) {
      status[name] = {
        configured: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  return status;
}