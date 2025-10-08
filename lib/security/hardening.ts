import { NextApiRequest } from 'next';
import { logger } from '../logger';
import { enterpriseConfigManager, isEnterpriseFeatureEnabled } from '../config';
import { env } from '../env';
import { validateApiKey } from '../security';
import { z } from 'zod';

// Security headers configuration
export interface SecurityHeaders {
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Strict-Transport-Security'?: string;
  'Content-Security-Policy'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
}

// Rate limiting interface
export interface RateLimiter {
  isAllowed(identifier: string): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }>;
  consume(identifier: string): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }>;
}

// Threat detection result
export interface ThreatDetectionResult {
  isThreat: boolean;
  threatType: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  confidence: number; // 0-1
}

// Security policy configuration
export interface SecurityPolicy {
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  ipWhitelist: string[];
  cors: {
    enabled: boolean;
    allowedOrigins: string[];
  };
  inputValidation: {
    enabled: boolean;
    maxRequestSize: number; // in bytes
    allowedContentTypes: string[];
  };
  authentication: {
    required: boolean;
    enforceMFA: boolean;
  };
  encryption: {
    atRest: boolean;
    inTransit: boolean;
  };
}

// Default security policies
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  rateLimiting: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  ipWhitelist: [],
  cors: {
    enabled: true,
    allowedOrigins: ['*'],
  },
  inputValidation: {
    enabled: true,
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    allowedContentTypes: [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
    ],
  },
  authentication: {
    required: false,
    enforceMFA: false,
  },
  encryption: {
    atRest: false,
    inTransit: true,
  },
};

// Advanced rate limiter implementation
export class AdvancedRateLimiter implements RateLimiter {
  private storage: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly bypassKey: string;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.bypassKey = (typeof env !== 'undefined' && env.RATE_LIMIT_BYPASS_KEY) ? env.RATE_LIMIT_BYPASS_KEY : '';
  }

  async isAllowed(identifier: string): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }> {
    // Allow requests with bypass key
    if (this.bypassKey && identifier === `bypass:${this.bypassKey}`) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const record = this.storage.get(identifier);

    if (!record || now > record.resetTime) {
      // New window, reset counter
      this.storage.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        allowed: true,
        resetTime: now + this.windowMs,
        remaining: this.maxRequests - 1,
      };
    }

    const remaining = this.maxRequests - record.count;
    if (remaining > 0) {
      return {
        allowed: true,
        resetTime: record.resetTime,
        remaining: remaining - 1,
      };
    }

    return {
      allowed: false,
      resetTime: record.resetTime,
      remaining: 0,
    };
  }

  async consume(identifier: string): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }> {
    // Allow requests with bypass key
    if (this.bypassKey && identifier === `bypass:${this.bypassKey}`) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const record = this.storage.get(identifier);

    if (!record || now > record.resetTime) {
      // New window, reset counter
      this.storage.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        allowed: true,
        resetTime: now + this.windowMs,
        remaining: this.maxRequests - 1,
      };
    }

    if (record.count < this.maxRequests) {
      // Increment count
      this.storage.set(identifier, {
        count: record.count + 1,
        resetTime: record.resetTime,
      });

      const remaining = this.maxRequests - record.count - 1;
      return {
        allowed: true,
        resetTime: record.resetTime,
        remaining,
      };
    }

    return {
      allowed: false,
      resetTime: record.resetTime,
      remaining: 0,
    };
  }

  // Cleanup expired records to prevent memory leaks
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      if (now > record.resetTime) {
        this.storage.delete(key);
      }
    }
  }
}

// Threat detection service
export class ThreatDetectionService {
  private readonly patterns: Record<string, RegExp> = {
    sqlInjection: /('|--|;|\b(OR|AND)\b\s+\d+=\d+)/gi,
    xss: /(<script|javascript:|on\w+\s*=)/gi,
    pathTraversal: /(\.\.\/|\.\.\\)/g,
    commandInjection: /(;|\||&|`|\$\(.*\)|%.*%)/g,
    ldapInjection: /\*/g, // Simplified pattern
  };

  async detectThreats(input: string): Promise<ThreatDetectionResult> {
    const detectedTypes: string[] = [];
    let maxConfidence = 0;

    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = input.match(pattern);
      if (matches && matches.length > 0) {
        detectedTypes.push(type);
        // Confidence increases with more matches
        const confidence = Math.min(0.8, 0.2 + (matches.length * 0.1));
        if (confidence > maxConfidence) maxConfidence = confidence;
      }
    }

    if (detectedTypes.length === 0) {
      return {
        isThreat: false,
        threatType: [],
        severity: 'low',
        details: 'No threats detected',
        confidence: 0,
      };
    }

    // Determine severity based on threat types and confidence
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (maxConfidence > 0.7) severity = 'high';
    if (maxConfidence > 0.9) severity = 'critical';
    if (detectedTypes.includes('sqlInjection') || detectedTypes.includes('xss')) {
      severity = 'high';
    }

    return {
      isThreat: true,
      threatType: detectedTypes,
      severity,
      details: `Detected potential ${detectedTypes.join(', ')} attack`,
      confidence: maxConfidence,
    };
  }

  // Validate request headers for common attack vectors
  validateHeaders(headers: Headers): ThreatDetectionResult {
    const headerString = Array.from(headers.entries())
      .map(([key, value]) => `${key}:${value}`)
      .join('\n');

    return this.detectThreats(headerString);
  }
}

// Security hardening middleware
export class SecurityHardener {
  private rateLimiter: AdvancedRateLimiter;
  private threatDetector: ThreatDetectionService;
  private securityPolicy: SecurityPolicy;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.threatDetector = new ThreatDetectionService();
    this.securityPolicy = DEFAULT_SECURITY_POLICY;
    this.rateLimiter = new AdvancedRateLimiter(
      this.securityPolicy.rateLimiting.windowMs,
      this.securityPolicy.rateLimiting.maxRequests
    );

    // Start cleanup interval to prevent memory leaks in rate limiter
    this.cleanupInterval = setInterval(() => {
      this.rateLimiter.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Apply security hardening to a request
  async applySecurityHardening(req: NextApiRequest): Promise<{ allowed: boolean; headers?: SecurityHeaders; reason?: string }> {
    // Get updated security policy
    this.securityPolicy = await this.getCurrentSecurityPolicy();

    // Check IP whitelist if configured
    if (this.securityPolicy.ipWhitelist.length > 0) {
      const ip = this.getClientIP(req);
      if (!this.securityPolicy.ipWhitelist.includes(ip)) {
        logger.warn('Blocked request from non-whitelisted IP', { ip, url: req.url });
        return { allowed: false, reason: 'IP not whitelisted' };
      }
    }

    // Rate limiting
    if (this.securityPolicy.rateLimiting.enabled) {
      const identifier = this.getRequestIdentifier(req);
      const rateLimitResult = await this.rateLimiter.consume(identifier);

      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded', { identifier, url: req.url });
        return { 
          allowed: false, 
          reason: 'Rate limit exceeded', 
          headers: {
            'Retry-After': Math.floor((rateLimitResult.resetTime! - Date.now()) / 1000).toString(),
          }
        };
      }
    }

    // Input validation
    if (this.securityPolicy.inputValidation.enabled) {
      const validationError = this.validateInput(req);
      if (validationError) {
        logger.warn('Input validation failed', { url: req.url, error: validationError });
        return { allowed: false, reason: validationError };
      }
    }

    // Threat detection
    const threatResult = await this.threatDetector.detectThreats(JSON.stringify(req.body || {}));
    if (threatResult.isThreat) {
      logger.error('Threat detected in request', { 
        threat: threatResult.threatType, 
        severity: threatResult.severity,
        confidence: threatResult.confidence,
        url: req.url 
      });
      
      if (threatResult.severity === 'high' || threatResult.severity === 'critical') {
        return { allowed: false, reason: 'Security threat detected' };
      }
    }

    // Add security headers
    const securityHeaders = this.getSecurityHeaders();
    return { allowed: true, headers: securityHeaders };
  }

  // Get security headers based on current policy
  private getSecurityHeaders(): SecurityHeaders {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  }

  // Validate request input based on policy
  private validateInput(req: NextApiRequest): string | null {
    // Check content type
    const contentType = req.headers['content-type'];
    if (contentType && this.securityPolicy.inputValidation.allowedContentTypes.length > 0) {
      const validType = this.securityPolicy.inputValidation.allowedContentTypes.some(
        allowed => contentType.includes(allowed)
      );
      if (!validType) {
        return `Invalid content type: ${contentType}`;
      }
    }

    // Check request size (simplified - in real implementation, you'd check the actual body size)
    // For now, we'll just return null as we can't accurately measure body size without parsing it first
    return null;
  }

  // Get request identifier for rate limiting
  private getRequestIdentifier(req: NextApiRequest): string {
    const ip = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Use API key if available, otherwise use IP + User Agent combination
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    if (apiKey && validateApiKey(apiKey)) {
      return `api:${apiKey}`;
    }
    
    return `ip:${ip}:ua:${userAgent.substring(0, 50)}`;
  }

  // Get client IP from request
  private getClientIP(req: NextApiRequest): string {
    return (
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any).remoteAddress ||
      'unknown'
    ).toString();
  }

  // Get current security policy from enterprise configuration
  private async getCurrentSecurityPolicy(): Promise<SecurityPolicy> {
    try {
      const enterpriseConfig = await enterpriseConfigManager.getEnterpriseConfig();
      
      // Construct a new policy based on enterprise settings
      const policy: SecurityPolicy = {
        rateLimiting: {
          enabled: enterpriseConfig.features.apiRateLimiting,
          windowMs: enterpriseConfig.security.network.rateLimiting.windowMs,
          maxRequests: enterpriseConfig.security.network.rateLimiting.max,
        },
        ipWhitelist: enterpriseConfig.security.network.ipWhitelist || [],
        cors: {
          enabled: true,
          allowedOrigins: enterpriseConfig.security.network.cors.allowedOrigins,
        },
        inputValidation: {
          enabled: true,
          maxRequestSize: 10 * 1024 * 1024, // 10MB - could be configurable
          allowedContentTypes: [
            'application/json',
            'application/x-www-form-urlencoded',
            'multipart/form-data',
          ],
        },
        authentication: {
          required: enterpriseConfig.security.authentication.mfa.required,
          enforceMFA: enterpriseConfig.security.authentication.mfa.required,
        },
        encryption: {
          atRest: enterpriseConfig.security.encryption.atRest,
          inTransit: enterpriseConfig.security.encryption.inTransit,
        },
      };

      return policy;
    } catch (error) {
      logger.error('Failed to get enterprise security policy, using defaults', { error });
      return DEFAULT_SECURITY_POLICY;
    }
  }

  // Enable/disable security features
  async setSecurityFeature(feature: keyof SecurityPolicy, value: any): Promise<void> {
    // This would typically update the policy and persist it somewhere
    // For now, we'll just log the change
    logger.info(`Security feature ${feature} updated`, { value });
  }

  // Shutdown cleanup
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rateLimiter.cleanup();
  }

  // Health check for security hardening
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const policy = await this.getCurrentSecurityPolicy();
      const details = {
        rateLimiting: policy.rateLimiting.enabled,
        threatDetection: true,
        ipWhitelist: policy.ipWhitelist.length > 0,
        inputValidation: policy.inputValidation.enabled,
      };

      // Check if critical security features are enabled
      if (!policy.rateLimiting.enabled && policy.ipWhitelist.length === 0) {
        return { status: 'degraded', details };
      }

      return { status: 'healthy', details };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
        },
      };
    }
  }
}

// Singleton instance of security hardener
export const securityHardener = new SecurityHardener();

// Utility function to validate request against security policies
export async function validateRequestSecurity(req: NextApiRequest): Promise<{ valid: boolean; headers?: SecurityHeaders; reason?: string }> {
  const result = await securityHardener.applySecurityHardening(req);
  return {
    valid: result.allowed,
    headers: result.headers,
    reason: result.reason,
  };
}

// Middleware for Next.js API routes
export async function securityMiddleware(req: NextApiRequest, res: any, next: () => void) {
  try {
    const result = await validateRequestSecurity(req);
    
    if (!result.valid) {
      // Apply security headers even for blocked requests
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          if (value) res.setHeader(key, value);
        });
      }
      
      res.status(429).json({ 
        error: 'Request blocked', 
        message: result.reason || 'Security policy violation',
        ...(result.headers?.['Retry-After'] && { retryAfter: result.headers['Retry-After'] })
      });
      return;
    }

    // Apply security headers to allowed requests
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        if (value) res.setHeader(key, value);
      });
    }

    next();
  } catch (error: any) {
    logger.error('Security middleware error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create a security audit log
export function logSecurityEvent(eventType: string, details: Record<string, any>, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
  const auditLog = {
    timestamp: new Date().toISOString(),
    eventType,
    severity,
    details,
    ...details, // Include details in the root for easier querying
  };

  // Log to the appropriate level based on severity
  switch (severity) {
    case 'critical':
    case 'high':
      logger.error(`Security Event: ${eventType}`, auditLog);
      break;
    case 'medium':
      logger.warn(`Security Event: ${eventType}`, auditLog);
      break;
    case 'low':
    default:
      logger.info(`Security Event: ${eventType}`, auditLog);
      break;
  }

  // In a full implementation, you might also send this to an audit log service
  // or store it in a dedicated security events table
}

// Input sanitization utility
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove potentially dangerous characters/sequences
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .replace(/\(/g, '&#x28;')
    .replace(/\)/g, '&#x29;');
}

// Validate and sanitize request body
export async function validateAndSanitizeBody(body: any): Promise<{ valid: boolean; sanitized?: any; error?: string }> {
  try {
    // In a real implementation, you'd have specific schemas for different endpoints
    // For now, we'll do a basic check and sanitization
    
    if (!body || typeof body !== 'object') {
      return { valid: false, error: 'Invalid request body' };
    }

    // Sanitize string values recursively
    const sanitized = JSON.parse(JSON.stringify(body, (key, value) => {
      if (typeof value === 'string') {
        return sanitizeInput(value);
      }
      return value;
    }));

    // Run threat detection on the sanitized body
    const threatResult = await securityHardener.threatDetector.detectThreats(JSON.stringify(sanitized));
    if (threatResult.isThreat) {
      logSecurityEvent('threat_detected', {
        threatType: threatResult.threatType,
        severity: threatResult.severity,
        confidence: threatResult.confidence,
      }, threatResult.severity);
      
      return { valid: false, error: 'Request contains potential security threats' };
    }

    return { valid: true, sanitized };
  } catch (error: any) {
    logger.error('Error validating and sanitizing body', { error: error.message });
    return { valid: false, error: 'Error processing request body' };
  }
}

// Generate secure random tokens
export function generateSecureToken(length: number = 32): string {
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js environment
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }
}

// Validate JWT token (simplified)
export async function validateJWT(token: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
    // In a real implementation, you'd use a proper JWT library like jsonwebtoken
    // This is a simplified version for demonstration purposes
    
    try {
      // Check if token has the right format (header.payload.signature)
      if (!token.includes('.')) {
        return { valid: false, error: 'Invalid token format' };
      }

      const [header, payload, signature] = token.split('.');
      
      // Decode and parse payload
      const decodedPayload = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf-8')
      );
      
      // Check expiration
      if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
        return { valid: false, error: 'Token expired' };
      }

      return { valid: true, payload: decodedPayload };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

// Security policy schema for validation
export const securityPolicySchema = z.object({
  rateLimiting: z.object({
    enabled: z.boolean(),
    windowMs: z.number().min(1000),
    maxRequests: z.number().min(1),
  }),
  ipWhitelist: z.array(z.string()),
  cors: z.object({
    enabled: z.boolean(),
    allowedOrigins: z.array(z.string()),
  }),
  inputValidation: z.object({
    enabled: z.boolean(),
    maxRequestSize: z.number().min(1024),
    allowedContentTypes: z.array(z.string()),
  }),
  authentication: z.object({
    required: z.boolean(),
    enforceMFA: z.boolean(),
  }),
  encryption: z.object({
    atRest: z.boolean(),
    inTransit: z.boolean(),
  }),
});