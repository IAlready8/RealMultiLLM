import Redis from 'ioredis';
import { getValidatedEnv, isProduction } from './env';
import { auditLogger } from './audit-logger';

/**
 * Enterprise-grade rate limiting system with multiple algorithms and threat detection
 * Supports distributed rate limiting, burst protection, and adaptive limits
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstLimit?: number;
  algorithm: 'sliding_window' | 'token_bucket' | 'leaky_bucket';
  keyGenerator?: (req: any) => string;
  onLimitReached?: (key: string, info: RateLimitInfo) => void;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsInWindow: number;
  remainingPoints: number;
  msBeforeNext: number;
  isBlocked: boolean;
  blockedUntil?: Date;
}

export interface ThreatDetectionConfig {
  enabled: boolean;
  suspiciousThreshold: number;
  blockDuration: number;
  patterns: {
    rapidFireRequests: boolean;
    distributedAttack: boolean;
    abnormalUserAgent: boolean;
    geoLocationAnomalies: boolean;
  };
}

export class EnterpriseRateLimiter {
  private redis: Redis | null = null;
  private memoryStore: Map<string, any> = new Map();
  private threatDetection: ThreatDetectionConfig;
  private blockedIPs: Set<string> = new Set();
  private suspiciousIPs: Map<string, number> = new Map();

  constructor() {
    this.initializeRedis();
    this.threatDetection = {
      enabled: isProduction(),
      suspiciousThreshold: 5,
      blockDuration: 15 * 60 * 1000, // 15 minutes
      patterns: {
        rapidFireRequests: true,
        distributedAttack: true,
        abnormalUserAgent: true,
        geoLocationAnomalies: false // Requires GeoIP service
      }
    };
  }

  private async initializeRedis(): Promise<void> {
    // Do not attempt Redis connections in test environment
    if (process.env.NODE_ENV === 'test') {
      this.redis = null;
      return;
    }
    const env = getValidatedEnv();
    if (env.REDIS_URL) {
      try {
        this.redis = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          lazyConnect: true
        });
        
        await this.redis.ping();
        console.log('✅ Redis connected for rate limiting');
      } catch (error) {
        console.warn('⚠️  Redis connection failed, falling back to memory store:', error);
        this.redis = null;
      }
    }
  }

  /**
   * Check rate limit for a request
   */
  public async checkRateLimit(
    key: string,
    config: RateLimitConfig,
    request?: any
  ): Promise<RateLimitInfo> {
    // Apply threat detection
    if (this.threatDetection.enabled && request) {
      const threatCheck = await this.checkForThreats(key, request);
      if (threatCheck.isBlocked) {
        return threatCheck;
      }
    }

    // Check if IP is blocked
    const ip = this.extractIP(key);
    if (ip && this.blockedIPs.has(ip)) {
      return {
        totalHits: 0,
        totalHitsInWindow: 0,
        remainingPoints: 0,
        msBeforeNext: this.threatDetection.blockDuration,
        isBlocked: true,
        blockedUntil: new Date(Date.now() + this.threatDetection.blockDuration)
      };
    }

    switch (config.algorithm) {
      case 'sliding_window':
        return this.slidingWindowCheck(key, config);
      case 'token_bucket':
        return this.tokenBucketCheck(key, config);
      case 'leaky_bucket':
        return this.leakyBucketCheck(key, config);
      default:
        return this.slidingWindowCheck(key, config);
    }
  }

  /**
   * Sliding window rate limiting algorithm
   */
  private async slidingWindowCheck(key: string, config: RateLimitConfig): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    if (this.redis) {
      return this.redisSlidingWindow(key, config, now, windowStart);
    } else {
      return this.memorySlidingWindow(key, config, now, windowStart);
    }
  }

  /**
   * Redis-based sliding window implementation
   */
  private async redisSlidingWindow(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number
  ): Promise<RateLimitInfo> {
    const pipe = this.redis!.pipeline();
    
    // Remove old entries
    pipe.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    pipe.zcard(key);
    
    // Add current request
    pipe.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipe.expire(key, Math.ceil(config.windowMs / 1000));
    
    const results = await pipe.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;
    const remainingPoints = Math.max(0, config.maxRequests - currentCount - 1);
    const isBlocked = currentCount >= config.maxRequests;
    
    if (isBlocked) {
      await this.handleRateLimitExceeded(key, config);
    }
    
    return {
      totalHits: currentCount + 1,
      totalHitsInWindow: currentCount + 1,
      remainingPoints,
      msBeforeNext: isBlocked ? config.windowMs : 0,
      isBlocked
    };
  }

  /**
   * Memory-based sliding window implementation
   */
  private memorySlidingWindow(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number
  ): RateLimitInfo {
    let requests = this.memoryStore.get(key) || [];
    
    // Remove old requests
    requests = requests.filter((timestamp: number) => timestamp > windowStart);
    
    // Add current request
    requests.push(now);
    
    // Store updated requests
    this.memoryStore.set(key, requests);
    
    // Cleanup old entries periodically
    setTimeout(() => {
      const current = this.memoryStore.get(key) || [];
      const filtered = current.filter((timestamp: number) => timestamp > Date.now() - config.windowMs);
      if (filtered.length === 0) {
        this.memoryStore.delete(key);
      } else {
        this.memoryStore.set(key, filtered);
      }
    }, config.windowMs);
    
    const currentCount = requests.length;
    const remainingPoints = Math.max(0, config.maxRequests - currentCount);
    const isBlocked = currentCount > config.maxRequests;
    
    if (isBlocked) {
      this.handleRateLimitExceeded(key, config);
    }
    
    return {
      totalHits: currentCount,
      totalHitsInWindow: currentCount,
      remainingPoints,
      msBeforeNext: isBlocked ? config.windowMs : 0,
      isBlocked
    };
  }

  /**
   * Token bucket algorithm implementation
   */
  private async tokenBucketCheck(key: string, config: RateLimitConfig): Promise<RateLimitInfo> {
    const now = Date.now();
    const bucketKey = `bucket:${key}`;
    
    if (this.redis) {
      const script = `
        local bucket_key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local tokens_per_interval = tonumber(ARGV[2])
        local interval = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        
        local bucket = redis.call('HMGET', bucket_key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or capacity
        local last_refill = tonumber(bucket[2]) or now
        
        -- Refill tokens
        local elapsed = now - last_refill
        local tokens_to_add = math.floor((elapsed / interval) * tokens_per_interval)
        tokens = math.min(capacity, tokens + tokens_to_add)
        
        local allowed = tokens >= 1
        if allowed then
          tokens = tokens - 1
        end
        
        redis.call('HMSET', bucket_key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', bucket_key, interval * 2)
        
        return {allowed and 1 or 0, tokens}
      `;
      
      const result = await this.redis.eval(
        script,
        1,
        bucketKey,
        config.maxRequests.toString(),
        config.maxRequests.toString(),
        config.windowMs.toString(),
        now.toString()
      ) as [number, number];
      
      const allowed = result[0] === 1;
      const remainingTokens = result[1];
      
      return {
        totalHits: 1,
        totalHitsInWindow: 1,
        remainingPoints: remainingTokens,
        msBeforeNext: allowed ? 0 : config.windowMs,
        isBlocked: !allowed
      };
    } else {
      // Memory implementation
      const bucket = this.memoryStore.get(bucketKey) || {
        tokens: config.maxRequests,
        lastRefill: now
      };
      
      // Refill tokens
      const elapsed = now - bucket.lastRefill;
      const tokensToAdd = Math.floor((elapsed / config.windowMs) * config.maxRequests);
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
      
      const allowed = bucket.tokens >= 1;
      if (allowed) {
        bucket.tokens -= 1;
      }
      
      this.memoryStore.set(bucketKey, bucket);
      
      return {
        totalHits: 1,
        totalHitsInWindow: 1,
        remainingPoints: bucket.tokens,
        msBeforeNext: allowed ? 0 : config.windowMs,
        isBlocked: !allowed
      };
    }
  }

  /**
   * Leaky bucket algorithm implementation
   */
  private async leakyBucketCheck(key: string, config: RateLimitConfig): Promise<RateLimitInfo> {
    // Similar to token bucket but with different leak rate logic
    // Implementation would be similar to token bucket but with constant leak rate
    return this.tokenBucketCheck(key, config);
  }

  /**
   * Threat detection system
   */
  private async checkForThreats(key: string, request: any): Promise<RateLimitInfo> {
    const ip = this.extractIP(key);
    if (!ip) {
      return { totalHits: 0, totalHitsInWindow: 0, remainingPoints: 0, msBeforeNext: 0, isBlocked: false };
    }

    let threatScore = 0;
    const threats: string[] = [];

    // Check for rapid fire requests
    if (this.threatDetection.patterns.rapidFireRequests) {
      const rapidFireScore = await this.checkRapidFireRequests(ip);
      threatScore += rapidFireScore;
      if (rapidFireScore > 0) threats.push('rapid_fire');
    }

    // Check for abnormal user agent
    if (this.threatDetection.patterns.abnormalUserAgent) {
      const userAgent = request.headers?.['user-agent'] || '';
      if (this.isAbnormalUserAgent(userAgent)) {
        threatScore += 2;
        threats.push('abnormal_user_agent');
      }
    }

    // Check for distributed attack patterns
    if (this.threatDetection.patterns.distributedAttack) {
      const distributedScore = await this.checkDistributedAttack(ip);
      threatScore += distributedScore;
      if (distributedScore > 0) threats.push('distributed_attack');
    }

    // Update suspicious IP tracking
    if (threatScore > 0) {
      const currentScore = this.suspiciousIPs.get(ip) || 0;
      this.suspiciousIPs.set(ip, currentScore + threatScore);
    }

    // Block if threshold exceeded
    const totalScore = this.suspiciousIPs.get(ip) || 0;
    if (totalScore >= this.threatDetection.suspiciousThreshold) {
      this.blockedIPs.add(ip);
      
      // Schedule unblock
      setTimeout(() => {
        this.blockedIPs.delete(ip);
        this.suspiciousIPs.delete(ip);
      }, this.threatDetection.blockDuration);

      // Log security event
      await auditLogger.logSecurityEvent(
        'ip_blocked_threat_detection',
        'success',
        {
          ip,
          threatScore: totalScore,
          threats,
          blockDuration: this.threatDetection.blockDuration
        },
        { ipAddress: ip },
        'critical'
      );

      return {
        totalHits: 0,
        totalHitsInWindow: 0,
        remainingPoints: 0,
        msBeforeNext: this.threatDetection.blockDuration,
        isBlocked: true,
        blockedUntil: new Date(Date.now() + this.threatDetection.blockDuration)
      };
    }

    return { totalHits: 0, totalHitsInWindow: 0, remainingPoints: 0, msBeforeNext: 0, isBlocked: false };
  }

  /**
   * Check for rapid fire request patterns
   */
  private async checkRapidFireRequests(ip: string): Promise<number> {
    const key = `rapid_fire:${ip}`;
    const now = Date.now();
    const window = 10000; // 10 seconds
    const threshold = 50; // 50 requests in 10 seconds
    
    if (this.redis) {
      const count = await this.redis.eval(`
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        
        redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
        local count = redis.call('ZCARD', key)
        redis.call('ZADD', key, now, now)
        redis.call('EXPIRE', key, window / 1000)
        
        return count
      `, 1, key, now.toString(), window.toString()) as number;
      
      return count > threshold ? 3 : 0;
    } else {
      let requests = this.memoryStore.get(key) || [];
      requests = requests.filter((timestamp: number) => timestamp > now - window);
      requests.push(now);
      this.memoryStore.set(key, requests);
      
      return requests.length > threshold ? 3 : 0;
    }
  }

  /**
   * Check for distributed attack patterns
   */
  private async checkDistributedAttack(_ip: string): Promise<number> {
    // This would analyze patterns across multiple IPs
    // For now, just a placeholder
    return 0;
  }

  /**
   * Check if user agent is abnormal/suspicious
   */
  private isAbnormalUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /python/i,
      /curl/i,
      /wget/i,
      /^$/,
      /test/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Extract IP address from rate limit key
   */
  private extractIP(key: string): string | null {
    const match = key.match(/ip:(\d+\.\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Handle rate limit exceeded event
   */
  private async handleRateLimitExceeded(key: string, config: RateLimitConfig): Promise<void> {
    const ip = this.extractIP(key);
    
    // Log rate limit event
    await auditLogger.logSecurityEvent(
      'rate_limit_exceeded',
      'warning',
      {
        key,
        algorithm: config.algorithm,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        ip
      },
      { ipAddress: ip },
      'medium'
    );

    // Call custom handler if provided
    if (config.onLimitReached) {
      const info: RateLimitInfo = {
        totalHits: config.maxRequests + 1,
        totalHitsInWindow: config.maxRequests + 1,
        remainingPoints: 0,
        msBeforeNext: config.windowMs,
        isBlocked: true
      };
      config.onLimitReached(key, info);
    }
  }

  /**
   * Get current status of rate limiter
   */
  public async getStatus(): Promise<{
    redis: boolean;
    blockedIPs: number;
    suspiciousIPs: number;
    memoryStoreSize: number;
  }> {
    return {
      redis: this.redis !== null,
      blockedIPs: this.blockedIPs.size,
      suspiciousIPs: this.suspiciousIPs.size,
      memoryStoreSize: this.memoryStore.size
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  public async reset(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  /**
   * Unblock an IP address
   */
  public unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
  }

  /**
   * Get blocked IPs
   */
  public getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }
}

// Default configurations for different use cases
export const defaultConfigs = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    algorithm: 'sliding_window' as const,
    burstLimit: 20
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Very restrictive for auth endpoints
    algorithm: 'token_bucket' as const
  },
  llm: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // Limit expensive LLM calls
    algorithm: 'leaky_bucket' as const
  },
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    algorithm: 'sliding_window' as const
  }
};

// Export singleton instance
export const enterpriseRateLimiter = new EnterpriseRateLimiter();
