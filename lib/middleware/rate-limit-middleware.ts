/**
 * Global Rate Limit Middleware
 * Applies rate limiting to all API routes based on endpoint patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiRateLimit } from '@/lib/api';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Endpoints that require rate limiting
 */
const RATE_LIMITED_ENDPOINTS = [
  { pattern: /^\/api\/llm\//, endpoint: 'llm' },
  { pattern: /^\/api\/teams\//, endpoint: 'teams' },
  { pattern: /^\/api\/personas\//, endpoint: 'personas' },
  { pattern: /^\/api\/shared-conversations\//, endpoint: 'shared-conversations' },
  { pattern: /^\/api\/goals\//, endpoint: 'goals' },
  { pattern: /^\/api\/analytics\//, endpoint: 'analytics' },
  { pattern: /^\/api\/auth\/register/, endpoint: 'auth.register' },
];

/**
 * Check if path should be rate limited
 */
function shouldRateLimit(pathname: string): { should: boolean; endpoint?: string } {
  for (const { pattern, endpoint } of RATE_LIMITED_ENDPOINTS) {
    if (pattern.test(pathname)) {
      return { should: true, endpoint };
    }
  }
  return { should: false };
}

/**
 * Rate limit middleware for API routes
 */
export async function rateLimitMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  const rateCheck = shouldRateLimit(pathname);

  if (!rateCheck.should || !rateCheck.endpoint) {
    return null; // Pass through
  }

  try {
    // Get user ID from session for user-specific limits
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';

    const rateLimitResult = await checkApiRateLimit(request, rateCheck.endpoint, userId);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to successful requests (will be merged in route)
    request.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    request.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    request.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    return null; // Continue to route handler
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    return null; // Fail open - don't block requests on rate limiter errors
  }
}
