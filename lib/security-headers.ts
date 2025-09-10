import { isProduction, isDevelopment } from './env';

/**
 * Enterprise-grade security headers configuration
 * Implements defense-in-depth with comprehensive security policies
 */

export interface SecurityHeaders {
  [key: string]: string;
}

/**
 * Get Content Security Policy for the application
 */
export function getContentSecurityPolicy(): string {
  const csp = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      // Allow inline scripts in development only
      ...(isDevelopment() ? ["'unsafe-inline'"] : []),
      // Allow eval in development for hot reloading
      ...(isDevelopment() ? ["'unsafe-eval'"] : []),
      // External script sources (be very selective)
      'https://unpkg.com', // For CDN libraries if needed
      'https://cdn.jsdelivr.net', // For CDN libraries if needed
      // Analytics domains (uncomment if using)
      // 'https://www.google-analytics.com',
      // 'https://www.googletagmanager.com'
    ],
    'style-src': [
      "'self'",
      // Allow inline styles (required for styled-components/emotion)
      "'unsafe-inline'",
      // External style sources
      'https://fonts.googleapis.com',
      'https://unpkg.com'
    ],
    'img-src': [
      "'self'",
      'data:', // For base64 encoded images
      'blob:', // For dynamically generated images
      'https:', // Allow HTTPS images
      // Specific domains for user avatars, etc.
      'https://avatars.githubusercontent.com',
      'https://lh3.googleusercontent.com'
    ],
    'font-src': [
      "'self'",
      'data:', // For base64 encoded fonts
      'https://fonts.gstatic.com'
    ],
    'connect-src': [
      "'self'",
      // API endpoints
      'https://api.openai.com',
      'https://api.anthropic.com',
      'https://generativelanguage.googleapis.com',
      'https://openrouter.ai',
      // Development hot reload
      ...(isDevelopment() ? ['ws:', 'wss:', 'http://localhost:*', 'https://localhost:*'] : []),
      // Monitoring services (uncomment if using)
      // 'https://sentry.io',
      // 'https://api.datadoghq.com'
    ],
    'media-src': [
      "'self'",
      'data:',
      'blob:'
    ],
    'object-src': ["'none'"], // Prevent plugin execution
    'base-uri': ["'self'"], // Restrict base tag URLs
    'form-action': ["'self'"], // Restrict form submission targets
    'frame-ancestors': ["'none'"], // Prevent framing (clickjacking protection)
    'frame-src': ["'none'"], // Prevent frames
    'manifest-src': ["'self'"], // PWA manifest
    'worker-src': [
      "'self'",
      'blob:' // For Web Workers
    ],
    'child-src': ["'none'"], // Legacy directive
    'upgrade-insecure-requests': [] // Force HTTPS in production
  };

  // Remove upgrade-insecure-requests in development
  if (isDevelopment()) {
    delete csp['upgrade-insecure-requests'];
  }

  // Build CSP string
  return Object.entries(csp)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
}

/**
 * Get Permissions Policy (formerly Feature Policy)
 */
export function getPermissionsPolicy(): string {
  const permissions = {
    // Disable dangerous features
    'microphone': '()',
    'camera': '()',
    'geolocation': '()',
    'payment': '()',
    'usb': '()',
    'bluetooth': '()',
    'magnetometer': '()',
    'gyroscope': '()',
    'accelerometer': '()',
    'ambient-light-sensor': '()',
    
    // Limit other features to self
    'clipboard-read': '(self)',
    'clipboard-write': '(self)',
    'fullscreen': '(self)',
    'notifications': '(self)',
    'push': '(self)',
    
    // Allow specific features we might need
    'web-share': '(self)',
    'document-domain': '()',
    'execution-while-not-rendered': '()',
    'execution-while-out-of-viewport': '()',
    
    // Disable interest-cohort for privacy
    'interest-cohort': '()'
  };

  return Object.entries(permissions)
    .map(([feature, allowlist]) => `${feature}=${allowlist}`)
    .join(', ');
}

/**
 * Get all security headers for the application
 */
export function getSecurityHeaders(): SecurityHeaders {
  const headers: SecurityHeaders = {
    // Content Security Policy
    'Content-Security-Policy': getContentSecurityPolicy(),
    
    // Permissions Policy (Feature Policy)
    'Permissions-Policy': getPermissionsPolicy(),
    
    // Prevent MIME sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent framing (clickjacking protection)
    'X-Frame-Options': 'DENY',
    
    // XSS Protection (legacy, but still good to have)
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Force HTTPS in production
    ...(isProduction() && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    }),
    
    // Cross-Origin policies
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    
    // Server information hiding
    'Server': 'RealMultiLLM',
    
    // Cache control for security-sensitive responses
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    
    // Additional security headers
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-DNS-Prefetch-Control': 'off'
  };

  // Development-specific headers
  if (isDevelopment()) {
    // Less restrictive cache control in development
    headers['Cache-Control'] = 'no-cache';
    
    // Add development indicators
    headers['X-Development-Mode'] = 'true';
  }

  return headers;
}

/**
 * Get security headers for API routes
 */
export function getApiSecurityHeaders(): SecurityHeaders {
  const headers: SecurityHeaders = {
    // Content Security Policy for APIs
    'Content-Security-Policy': "default-src 'none'",
    
    // Prevent MIME sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent framing
    'X-Frame-Options': 'DENY',
    
    // Referrer Policy
    'Referrer-Policy': 'no-referrer',
    
    // Force HTTPS in production
    ...(isProduction() && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    }),
    
    // Cross-Origin policies - more restrictive for APIs
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
    
    // Server information hiding
    'Server': 'RealMultiLLM-API',
    
    // Cache control for API responses
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    
    // Additional API security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-XSS-Protection': '1; mode=block'
  };

  return headers;
}

/**
 * Get CORS headers for API routes
 */
export function getCorsHeaders(origin?: string): SecurityHeaders {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001'
  ];

  // In production, add your actual domain
  if (isProduction()) {
    // allowedOrigins.push('https://yourdomain.com');
  }

  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400' // 24 hours
  };
}

/**
 * Apply security headers to a Response object
 */
export function applySecurityHeaders(
  response: Response,
  customHeaders?: SecurityHeaders,
  apiMode: boolean = false
): Response {
  const securityHeaders = apiMode ? getApiSecurityHeaders() : getSecurityHeaders();
  const allHeaders = { ...securityHeaders, ...customHeaders };

  Object.entries(allHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Security middleware for Next.js API routes
 */
export function securityMiddleware(request: Request): {
  headers: SecurityHeaders;
  isBlocked: boolean;
  reason?: string;
} {
  const userAgent = request.headers.get('user-agent') || '';
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Basic bot detection and blocking
  const suspiciousBots = [
    'bot', 'crawler', 'spider', 'scraper',
    'python-requests', 'curl', 'wget',
    'postman', 'insomnia'
  ];

  const isSuspiciousBot = suspiciousBots.some(bot =>
    userAgent.toLowerCase().includes(bot)
  );

  // In production, be more strict about bots
  if (isProduction() && isSuspiciousBot && !userAgent.includes('Googlebot')) {
    return {
      headers: getApiSecurityHeaders(),
      isBlocked: true,
      reason: 'Suspicious user agent detected'
    };
  }

  // Get appropriate headers
  const headers = {
    ...getApiSecurityHeaders(),
    ...getCorsHeaders(origin || undefined)
  };

  return {
    headers,
    isBlocked: false
  };
}

/**
 * Create a security report endpoint response
 */
export function createSecurityReportResponse(): SecurityHeaders {
  return {
    'Content-Type': 'application/json',
    ...getApiSecurityHeaders(),
    // Additional reporting headers
    'Report-To': JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{ url: '/api/security/csp-report' }]
    }),
    'NEL': JSON.stringify({
      report_to: 'csp-endpoint',
      max_age: 2592000,
      include_subdomains: true,
      failure_fraction: 1.0
    })
  };
}