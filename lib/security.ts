// Basic security utilities for the application

export interface SecurityContext {
  ip?: string;
  userAgent?: string;
}

export interface SecurityResult {
  success: boolean;
  error?: string;
  headers?: Record<string, string>;
  context?: SecurityContext;
}

/**
 * Process security requirements for incoming requests
 * @param request - The incoming request
 * @returns Security result with success status and any error messages
 */
export async function processSecurityRequest(request: Request): Promise<SecurityResult> {
  // Basic security checks
  const origin = request.headers.get('origin');
  const _host = request.headers.get('host');
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // For now, we'll allow all requests in development
  // In production, you would implement proper CORS and security checks
  return {
    success: true,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    context: {
      ip,
      userAgent
    }
  };
}

/**
 * Validate API key security
 * @param apiKey - The API key to validate
 * @returns Whether the API key is valid
 */
export function validateApiKey(apiKey: string): boolean {
  // In a real implementation, you would check against stored keys
  // For now, we'll just check if it's not empty
  return !!apiKey && apiKey.length > 0;
}

/**
 * Sanitize user input to prevent XSS and other attacks
 * @param input - The input to sanitize
 * @returns Sanitized input
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Strip script tags entirely
  let sanitized = input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove event handler attributes (e.g., onerror, onclick)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');

  // Remove javascript: protocol usages
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove potentially dangerous inline tags like iframe and svg
  sanitized = sanitized.replace(/<\/?(iframe|svg)[^>]*>/gi, '');

  return sanitized;
}
