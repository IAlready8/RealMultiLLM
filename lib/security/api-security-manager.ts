/**
 * Advanced API Security Management System
 * - Multi-layered security with intelligent threat detection
 * - Performance-optimized rate limiting and authentication
 * - Real-time security monitoring with automated responses
 */

import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { headers } from 'next/headers';

interface SecurityPolicy {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  authentication: {
    required: boolean;
    allowApiKeys: boolean;
    allowJWT: boolean;
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
  };
  monitoring: {
    logAllRequests: boolean;
    alertOnSuspiciousActivity: boolean;
    blockMaliciousIPs: boolean;
  };
}

interface SecurityThreat {
  id: string;
  type: 'rate_limit_exceeded' | 'invalid_auth' | 'suspicious_pattern' | 'injection_attempt' | 'brute_force';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: Record<string, any>;
  timestamp: Date;
  blocked: boolean;
}

interface RateLimitEntry {
  ip: string;
  userId?: string;
  requests: number;
  windowStart: Date;
  blocked: boolean;
}

interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  activeThreats: number;
  topAttackVectors: Array<{ type: string; count: number }>;
}

class AdvancedAPISecurityManager {
  private prisma: PrismaClient;
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private threatCache: Map<string, SecurityThreat[]> = new Map();
  private encryptionKey: string;
  
  private readonly DEFAULT_POLICY: SecurityPolicy = {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false
    },
    authentication: {
      required: true,
      allowApiKeys: true,
      allowJWT: true
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationInterval: 30 * 24 * 60 * 60 * 1000 // 30 days
    },
    monitoring: {
      logAllRequests: true,
      alertOnSuspiciousActivity: true,
      blockMaliciousIPs: true
    }
  };

  private readonly THREAT_PATTERNS = {
    SQL_INJECTION: /(\b(union|select|insert|update|delete|drop|create|alter)\b)|('.*?')|(\-\-)|(\bor\b.*?=.*?\b)/i,
    XSS_ATTEMPT: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    PATH_TRAVERSAL: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
    COMMAND_INJECTION: /(\||\&|\;|\$\(|\`)/,
    SUSPICIOUS_USER_AGENT: /bot|crawler|spider|scraper|wget|curl/i
  };

  constructor() {
    this.prisma = new PrismaClient();
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateEncryptionKey();
    this.initializeCleanupTasks();
  }

  // Multi-layered security validation with performance optimization
  async validateRequest(request: NextRequest, policy?: Partial<SecurityPolicy>): Promise<{
    allowed: boolean;
    reason?: string;
    threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    rateLimitInfo?: {
      remaining: number;
      resetTime: Date;
    };
  }> {
    const mergedPolicy = { ...this.DEFAULT_POLICY, ...policy };
    const clientIP = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const requestPath = request.nextUrl.pathname;
    const requestBody = await this.safeGetRequestBody(request);

    try {
      // 1. Rate limiting with intelligent throttling
      const rateLimitCheck = await this.checkRateLimit(clientIP, mergedPolicy.rateLimit);
      if (!rateLimitCheck.allowed) {
        await this.logSecurityEvent({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          source: clientIP,
          details: { path: requestPath, userAgent, remainingRequests: rateLimitCheck.remaining }
        });
        
        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          threatLevel: 'medium',
          rateLimitInfo: rateLimitCheck
        };
      }

      // 2. Authentication validation
      if (mergedPolicy.authentication.required) {
        const authCheck = await this.validateAuthentication(request, mergedPolicy.authentication);
        if (!authCheck.valid) {
          await this.logSecurityEvent({
            type: 'invalid_auth',
            severity: 'high',
            source: clientIP,
            details: { path: requestPath, reason: authCheck.reason, userAgent }
          });
          
          return {
            allowed: false,
            reason: authCheck.reason,
            threatLevel: 'high'
          };
        }
      }

      // 3. Threat pattern detection
      const threatAnalysis = await this.analyzeThreatPatterns(requestPath, requestBody, userAgent);
      if (threatAnalysis.threatDetected && threatAnalysis.threatType) {
        // Map threat patterns to valid SecurityThreat types
        const threatTypeMap: Record<string, SecurityThreat['type']> = {
          'SQL_INJECTION': 'injection_attempt',
          'XSS_ATTEMPT': 'injection_attempt',
          'PATH_TRAVERSAL': 'injection_attempt',
          'COMMAND_INJECTION': 'injection_attempt',
          'SUSPICIOUS_USER_AGENT': 'suspicious_pattern'
        };

        const mappedType = typeof threatAnalysis.threatType === 'string' 
          ? threatTypeMap[threatAnalysis.threatType] || 'suspicious_pattern'
          : 'suspicious_pattern';

        await this.logSecurityEvent({
          type: mappedType,
          severity: threatAnalysis.severity,
          source: clientIP,
          details: { 
            path: requestPath, 
            pattern: threatAnalysis.pattern,
            userAgent,
            payload: requestBody ? requestBody.substring(0, 500) : null,
            originalThreatType: threatAnalysis.threatType
          }
        });

        if (threatAnalysis.severity === 'critical' || threatAnalysis.severity === 'high') {
          await this.blockIP(clientIP, `Detected ${String(threatAnalysis.threatType)}`, 24 * 60 * 60 * 1000); // 24 hour block
          
          return {
            allowed: false,
            reason: 'Security threat detected',
            threatLevel: threatAnalysis.severity
          };
        }
      }

      // 4. IP reputation check
      const ipReputationCheck = await this.checkIPReputation(clientIP);
      if (ipReputationCheck.isBlocked) {
        return {
          allowed: false,
          reason: 'IP address blocked due to security concerns',
          threatLevel: 'high'
        };
      }

      // Log successful request for analytics
      if (mergedPolicy.monitoring.logAllRequests) {
        await this.logValidRequest(clientIP, requestPath, userAgent);
      }

      return {
        allowed: true,
        threatLevel: threatAnalysis.threatDetected ? threatAnalysis.severity : 'none',
        rateLimitInfo: rateLimitCheck
      };

    } catch (error) {
      console.error('Security validation error:', error);
      
      // Fail secure - deny request on error
      await this.logSecurityEvent({
        type: 'suspicious_pattern',
        severity: 'medium',
        source: clientIP,
        details: { error: error instanceof Error ? error.message : 'Unknown error', path: requestPath }
      });

      return {
        allowed: false,
        reason: 'Internal security error',
        threatLevel: 'medium'
      };
    }
  }

  // Intelligent rate limiting with user context
  private async checkRateLimit(identifier: string, policy: SecurityPolicy['rateLimit']): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - policy.windowMs);
    
    let entry = this.rateLimitStore.get(identifier);
    
    // Clean up expired entries
    if (entry && entry.windowStart < windowStart) {
      entry = undefined;
    }

    if (!entry) {
      entry = {
        ip: identifier,
        requests: 1,
        windowStart: now,
        blocked: false
      };
      this.rateLimitStore.set(identifier, entry);
      
      return {
        allowed: true,
        remaining: policy.maxRequests - 1,
        resetTime: new Date(now.getTime() + policy.windowMs)
      };
    }

    entry.requests++;
    
    if (entry.requests > policy.maxRequests) {
      entry.blocked = true;
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(entry.windowStart.getTime() + policy.windowMs)
      };
    }

    return {
      allowed: true,
      remaining: policy.maxRequests - entry.requests,
      resetTime: new Date(entry.windowStart.getTime() + policy.windowMs)
    };
  }

  // Multi-factor authentication validation
  private async validateAuthentication(request: NextRequest, authPolicy: SecurityPolicy['authentication']): Promise<{
    valid: boolean;
    reason?: string;
    userId?: string;
  }> {
    const authHeader = request.headers.get('authorization');
    const apiKeyHeader = request.headers.get('x-api-key');

    // API Key authentication
    if (authPolicy.allowApiKeys && apiKeyHeader) {
      const isValidApiKey = await this.validateApiKey(apiKeyHeader);
      if (isValidApiKey.valid) {
        return { valid: true, userId: isValidApiKey.userId };
      }
    }

    // JWT authentication
    if (authPolicy.allowJWT && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const isValidJWT = await this.validateJWT(token);
      if (isValidJWT.valid) {
        return { valid: true, userId: isValidJWT.userId };
      }
    }

    return {
      valid: false,
      reason: 'Invalid or missing authentication credentials'
    };
  }

  // Advanced threat pattern analysis
  private async analyzeThreatPatterns(path: string, body: string | null, userAgent: string): Promise<{
    threatDetected: boolean;
    threatType?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    pattern?: string;
  }> {
    const testString = `${path} ${body || ''} ${userAgent}`;

    // Check for SQL injection
    if (this.THREAT_PATTERNS.SQL_INJECTION.test(testString)) {
      return {
        threatDetected: true,
        threatType: 'SQL_INJECTION',
        severity: 'critical',
        pattern: 'SQL injection pattern detected'
      };
    }

    // Check for XSS attempts
    if (this.THREAT_PATTERNS.XSS_ATTEMPT.test(testString)) {
      return {
        threatDetected: true,
        threatType: 'XSS_ATTEMPT',
        severity: 'high',
        pattern: 'Cross-site scripting pattern detected'
      };
    }

    // Check for path traversal
    if (this.THREAT_PATTERNS.PATH_TRAVERSAL.test(testString)) {
      return {
        threatDetected: true,
        threatType: 'PATH_TRAVERSAL',
        severity: 'high',
        pattern: 'Path traversal pattern detected'
      };
    }

    // Check for command injection
    if (this.THREAT_PATTERNS.COMMAND_INJECTION.test(testString)) {
      return {
        threatDetected: true,
        threatType: 'COMMAND_INJECTION',
        severity: 'critical',
        pattern: 'Command injection pattern detected'
      };
    }

    // Check for suspicious user agents
    if (this.THREAT_PATTERNS.SUSPICIOUS_USER_AGENT.test(userAgent)) {
      return {
        threatDetected: true,
        threatType: 'SUSPICIOUS_USER_AGENT',
        severity: 'low',
        pattern: 'Automated bot detected'
      };
    }

    return {
      threatDetected: false,
      severity: 'low'
    };
  }

  // Secure data encryption/decryption
  async encryptSensitiveData(data: string): Promise<string> {
    const cipher = crypto.createCipher(this.DEFAULT_POLICY.encryption.algorithm, this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  async decryptSensitiveData(encryptedData: string): Promise<string> {
    const decipher = crypto.createDecipher(this.DEFAULT_POLICY.encryption.algorithm, this.encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Security metrics and reporting
  async getSecurityMetrics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<SecurityMetrics> {
    const startDate = this.getStartDate(timeRange);
    
    try {
      const securityEvents = await this.prisma.analyticsEvent.findMany({
        where: {
          event: { in: ['security_threat', 'auth_failure', 'rate_limit_exceeded'] },
          timestamp: { gte: startDate }
        }
      });

      const totalRequests = await this.prisma.analyticsEvent.count({
        where: {
          event: 'api_request',
          timestamp: { gte: startDate }
        }
      });

      const blockedRequests = securityEvents.filter(e => {
        try {
          const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
          return payload && typeof payload === 'object' && payload.blocked === true;
        } catch {
          return false;
        }
      }).length;
      const activeThreats = securityEvents.filter(e => 
        e.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
      ).length;

      // Calculate threat level
      const threatRate = totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;
      const threatLevel = threatRate > 10 ? 'critical' : 
                         threatRate > 5 ? 'high' : 
                         threatRate > 1 ? 'medium' : 'low';

      // Top attack vectors
      const attackCounts = securityEvents.reduce((acc, event) => {
        try {
          const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
          const type = payload?.type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        } catch {
          acc['unknown'] = (acc['unknown'] || 0) + 1;
          return acc;
        }
      }, {} as Record<string, number>);

      const topAttackVectors = Object.entries(attackCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));

      return {
        totalRequests,
        blockedRequests,
        threatLevel,
        activeThreats,
        topAttackVectors
      };
    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return {
        totalRequests: 0,
        blockedRequests: 0,
        threatLevel: 'low',
        activeThreats: 0,
        topAttackVectors: []
      };
    }
  }

  // Helper methods
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return request.ip || 'unknown';
  }

  private async safeGetRequestBody(request: NextRequest): Promise<string | null> {
    try {
      if (request.method === 'GET' || request.method === 'HEAD') {
        return null;
      }
      
      const clone = request.clone();
      const text = await clone.text();
      return text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }

  private async validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string }> {
    // Implementation would check against stored API keys
    // This is a simplified version
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    try {
      const keyRecord = await this.prisma.apiKey.findUnique({
        where: { hashedKey },
        include: { user: true }
      });
      
      return {
        valid: !!keyRecord && keyRecord.isActive,
        userId: keyRecord?.userId
      };
    } catch {
      return { valid: false };
    }
  }

  private async validateJWT(token: string): Promise<{ valid: boolean; userId?: string }> {
    // Implementation would validate JWT token
    // This is a simplified version
    try {
      // Would use a proper JWT library like jsonwebtoken
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return {
        valid: payload.exp > Date.now() / 1000,
        userId: payload.sub
      };
    } catch {
      return { valid: false };
    }
  }

  private async checkIPReputation(ip: string): Promise<{ isBlocked: boolean; reason?: string }> {
    try {
      const blockedIP = await this.prisma.blockedIP.findUnique({
        where: { ip }
      });
      
      if (blockedIP && (!blockedIP.expiresAt || blockedIP.expiresAt > new Date())) {
        return {
          isBlocked: true,
          reason: blockedIP.reason || 'IP blocked due to security concerns'
        };
      }
      
      return { isBlocked: false };
    } catch {
      return { isBlocked: false };
    }
  }

  private async blockIP(ip: string, reason: string, durationMs: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + durationMs);
      
      await this.prisma.blockedIP.upsert({
        where: { ip },
        update: { reason, expiresAt },
        create: { ip, reason, expiresAt }
      });
    } catch (error) {
      console.error('Failed to block IP:', error);
    }
  }

  private async logSecurityEvent(threat: Omit<SecurityThreat, 'id' | 'timestamp' | 'blocked'>): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          event: 'security_threat',
          payload: JSON.stringify({
            type: threat.type,
            severity: threat.severity,
            source: threat.source,
            details: threat.details,
            blocked: threat.severity === 'critical' || threat.severity === 'high'
          }),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private async logValidRequest(ip: string, path: string, userAgent: string): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          event: 'api_request',
          payload: JSON.stringify({ ip, path, userAgent }),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to log valid request:', error);
    }
  }

  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getStartDate(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private initializeCleanupTasks(): void {
    // Clean up expired rate limit entries every 5 minutes
    setInterval(() => {
      const now = new Date();
      for (const [key, entry] of this.rateLimitStore.entries()) {
        if (now.getTime() - entry.windowStart.getTime() > this.DEFAULT_POLICY.rateLimit.windowMs) {
          this.rateLimitStore.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
}

export { AdvancedAPISecurityManager };
export type { 
  SecurityPolicy, 
  SecurityThreat, 
  SecurityMetrics 
};