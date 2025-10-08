/**
 * Next.js Middleware for Security Headers
 * Implements enterprise-grade security headers for production deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Security Headers Configuration
 * Based on OWASP recommendations and enterprise security standards
 */
const SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',

  // Enable XSS protection in older browsers
  'X-XSS-Protection': '1; mode=block',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Referrer policy for privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy (former Feature-Policy)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',

  // Strict Transport Security (HTTPS only)
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',

  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval for dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://openrouter.ai",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

/**
 * Rate limiting storage (in-memory for demo, use Redis in production)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limit configuration
 */
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  apiWindowMs: 60 * 1000, // 1 minute for API routes
  apiMaxRequests: 30, // 30 API requests per minute
};

/**
 * Check rate limit for a given identifier
 */
function checkRateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // Reset or initialize
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Clean up expired rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Get client identifier for rate limiting (IP or session)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';

  // Check if this is an API route
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');

  // Apply rate limiting
  const maxRequests = isApiRoute ? RATE_LIMIT_CONFIG.apiMaxRequests : RATE_LIMIT_CONFIG.maxRequests;
  const windowMs = isApiRoute ? RATE_LIMIT_CONFIG.apiWindowMs : RATE_LIMIT_CONFIG.windowMs;

  const identifier = `${ip}-${request.nextUrl.pathname}`;
  const allowed = checkRateLimit(identifier, maxRequests, windowMs);

  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Content-Type': 'text/plain',
        'Retry-After': String(Math.ceil(windowMs / 1000)),
        ...Object.fromEntries(
          Object.entries(SECURITY_HEADERS).map(([k, v]) => [k, v])
        ),
      },
    });
  }

  // Protected routes authentication check
  const protectedPaths = ['/admin', '/settings', '/multi-chat'];
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const url = new URL('/api/auth/signin', request.url);
      url.searchParams.set('callbackUrl', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Add user context to response headers (for logging/monitoring)
    response.headers.set('X-User-Id', token.sub || '');
    response.headers.set('X-User-Role', String(token.role || 'USER'));
  }

  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);

  return response;
}

/**
 * Middleware configuration
 * Apply to all routes except static files
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
