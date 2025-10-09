/**
 * PHASE 3 SCALABILITY ENHANCEMENT: Advanced Request Deduplication
 *
 * Eliminates redundant LLM requests to reduce resource consumption and improve response times
 * Implements intelligent caching with collision-resistant hashing and memory management
 */

import { createHash } from 'node:crypto';
import { logger } from '@/lib/observability/logger';
import { metricsRegistry } from '@/lib/observability/metrics';

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  requestCount: number;
  requestors: string[];
}

interface DeduplicationMetrics {
  totalRequests: number;
  duplicatesDetected: number;
  cacheSavings: number;
  averageDeduplicationTime: number;
}

class AdvancedRequestDeduplicator {
  private activeRequests = new Map<string, PendingRequest<any>>();
  private metrics: DeduplicationMetrics = {
    totalRequests: 0,
    duplicatesDetected: 0,
    cacheSavings: 0,
    averageDeduplicationTime: 0
  };
  private duplicationTimes: number[] = [];
  private readonly MAX_SAMPLES = 100;
  private readonly REQUEST_TIMEOUT = 300000; // 5 minutes
  private readonly MAX_ACTIVE_REQUESTS = 1000; // Memory protection

  constructor() {
    // Periodic cleanup of timed-out requests
    setInterval(() => this.cleanupExpiredRequests(), 60000); // Every minute
  }

  /**
   * Generate collision-resistant cache key for request
   */
  private generateRequestKey(
    userId: string,
    provider: string,
    messages: any[],
    options: any = {}
  ): string {
    // Create deterministic hash of request parameters
    const normalizedMessages = messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content.trim() : msg.content
    }));

    const keyData = {
      provider,
      messages: normalizedMessages,
      // Only include options that affect the response
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty
    };

    const keyString = JSON.stringify(keyData);
    const hash = createHash('sha256').update(keyString).digest('hex').substring(0, 32);

    return `llm_req:${userId}:${provider}:${hash}`;
  }

  /**
   * Deduplicate LLM request with advanced collision handling
   */
  async deduplicate<T>(
    userId: string,
    provider: string,
    messages: any[],
    options: any,
    requestFn: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Generate cache key
    const cacheKey = this.generateRequestKey(userId, provider, messages, options);

    // Check for existing request
    const existingRequest = this.activeRequests.get(cacheKey);

    if (existingRequest) {
      // Duplicate request detected
      this.metrics.duplicatesDetected++;
      existingRequest.requestCount++;
      if (requestId) {
        existingRequest.requestors.push(requestId);
      }

      const deduplicationTime = Date.now() - startTime;
      this.recordDeduplicationTime(deduplicationTime);

      logger.info('request_deduplicated', {
        cacheKey,
        userId,
        provider,
        requestCount: existingRequest.requestCount,
        deduplicationTime,
        requestId
      });

      // Record deduplication metrics
      this.recordMetric('request_duplicates_detected_total', this.metrics.duplicatesDetected);
      this.recordMetric('request_deduplication_time_ms', deduplicationTime);

      return existingRequest.promise;
    }

    // Prevent memory exhaustion
    if (this.activeRequests.size >= this.MAX_ACTIVE_REQUESTS) {
      const oldestKey = this.findOldestRequest();
      if (oldestKey) {
        logger.warn('request_deduplication_memory_limit', {
          activeRequests: this.activeRequests.size,
          evictedKey: oldestKey
        });
        this.activeRequests.delete(oldestKey);
      }
    }

    // Create new request tracking
    const requestPromise = this.executeWithTracking(cacheKey, requestFn);

    const pendingRequest: PendingRequest<T> = {
      promise: requestPromise,
      timestamp: Date.now(),
      requestCount: 1,
      requestors: requestId ? [requestId] : []
    };

    this.activeRequests.set(cacheKey, pendingRequest);

    logger.debug('new_request_registered', {
      cacheKey,
      userId,
      provider,
      activeRequests: this.activeRequests.size,
      requestId
    });

    return requestPromise;
  }

  /**
   * Execute request with comprehensive tracking
   */
  private async executeWithTracking<T>(
    cacheKey: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await requestFn();
      const executionTime = Date.now() - startTime;

      // Calculate savings from deduplication
      const pendingRequest = this.activeRequests.get(cacheKey);
      if (pendingRequest && pendingRequest.requestCount > 1) {
        const savings = executionTime * (pendingRequest.requestCount - 1);
        this.metrics.cacheSavings += savings;
        this.recordMetric('request_deduplication_savings_ms', this.metrics.cacheSavings);

        logger.info('request_deduplication_savings', {
          cacheKey,
          duplicateRequests: pendingRequest.requestCount - 1,
          executionTime,
          savingsMs: savings,
          totalSavingsMs: this.metrics.cacheSavings
        });
      }

      this.metrics.duplicatesDetected = Math.max(
        0,
        (pendingRequest?.requestCount ?? 1) - 1
      );

      // Record successful completion
      this.recordMetric('request_executions_successful_total', 1);

      return result;
    } catch (error) {
      // Record execution error
      this.recordMetric('request_executions_failed_total', 1);

      logger.error('deduplicated_request_error', {
        cacheKey,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      });

      throw error;
    } finally {
      // Clean up completed request
      this.activeRequests.delete(cacheKey);

      // Record final metrics
      this.recordMetric('active_deduplicated_requests', this.activeRequests.size);
    }
  }

  /**
   * Record deduplication timing for performance analysis
   */
  private recordDeduplicationTime(time: number): void {
    this.duplicationTimes.push(time);
    if (this.duplicationTimes.length > this.MAX_SAMPLES) {
      this.duplicationTimes.shift();
    }

    this.metrics.averageDeduplicationTime =
      this.duplicationTimes.reduce((sum, t) => sum + t, 0) / this.duplicationTimes.length;
  }

  /**
   * Find oldest request for memory management
   */
  private findOldestRequest(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, request] of this.activeRequests) {
      if (request.timestamp < oldestTime) {
        oldestTime = request.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Clean up expired requests to prevent memory leaks
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, request] of this.activeRequests) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        this.activeRequests.delete(key);
        cleanedCount++;

        logger.warn('expired_request_cleaned', {
          cacheKey: key,
          age: now - request.timestamp,
          requestCount: request.requestCount
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info('request_deduplication_cleanup', {
        cleanedCount,
        remainingRequests: this.activeRequests.size
      });
    }

    // Record cleanup metrics
    this.recordMetric('active_deduplicated_requests', this.activeRequests.size);
  }

  /**
   * Record metric for monitoring
   */
  private recordMetric(name: string, value: number): void {
    try {
      const metric = metricsRegistry.registerCounter(
        `deduplication_${name}`,
        `Request deduplication ${name.replace(/_/g, ' ')}`
      );
      metric.inc(value);
    } catch (error) {
      // Fail silently - metrics are non-critical
    }
  }

  /**
   * Get comprehensive deduplication statistics
   */
  getStatistics() {
    const now = Date.now();
    const activeRequests = Array.from(this.activeRequests.values());

    return {
      metrics: this.metrics,
      performance: {
        totalRequests: this.metrics.totalRequests,
        duplicateRate: this.metrics.totalRequests > 0
          ? (this.metrics.duplicatesDetected / this.metrics.totalRequests * 100).toFixed(2) + '%'
          : '0%',
        averageDeduplicationTime: Math.round(this.metrics.averageDeduplicationTime),
        totalSavingsMs: this.metrics.cacheSavings,
        estimatedCostSavings: this.calculateCostSavings()
      },
      activeRequests: {
        count: activeRequests.length,
        avgAge: activeRequests.length > 0
          ? Math.round(activeRequests.reduce((sum, req) => sum + (now - req.timestamp), 0) / activeRequests.length)
          : 0,
        totalDuplicateRequests: activeRequests.reduce((sum, req) => sum + req.requestCount, 0)
      },
      memoryManagement: {
        maxActiveRequests: this.MAX_ACTIVE_REQUESTS,
        requestTimeout: this.REQUEST_TIMEOUT,
        memoryUtilization: (activeRequests.length / this.MAX_ACTIVE_REQUESTS * 100).toFixed(1) + '%'
      }
    };
  }

  /**
   * Calculate estimated cost savings from deduplication
   */
  private calculateCostSavings(): number {
    // Rough estimate: 10ms of processing time = $0.0001 in compute cost
    const costPerMs = 0.0001 / 10;
    return this.metrics.cacheSavings * costPerMs;
  }

  /**
   * Health check for deduplication system
   */
  getHealthStatus() {
    const stats = this.getStatistics();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check memory utilization
    if (this.activeRequests.size > this.MAX_ACTIVE_REQUESTS * 0.8) {
      issues.push(`High memory utilization: ${stats.memoryManagement.memoryUtilization}`);
      recommendations.push('Monitor request patterns for optimization opportunities');
    }

    // Check deduplication effectiveness
    const duplicateRate = parseFloat(stats.performance.duplicateRate);
    if (duplicateRate < 5) {
      recommendations.push('Low deduplication rate - consider adjusting cache key generation');
    } else if (duplicateRate > 50) {
      issues.push(`Very high duplicate rate: ${stats.performance.duplicateRate}`);
      recommendations.push('Investigate potential infinite request loops');
    }

    const healthy = issues.length === 0;

    return {
      healthy,
      issues,
      recommendations,
      stats: stats.performance
    };
  }
}

// Singleton instance for global request deduplication
export const requestDeduplicator = new AdvancedRequestDeduplicator();
