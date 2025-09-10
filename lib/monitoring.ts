import { getValidatedEnv, isProduction } from './env';
import { auditLogger } from './audit-logger';

/**
 * Enterprise monitoring and observability system
 * Provides metrics collection, health checks, and performance monitoring
 */

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: 'count' | 'bytes' | 'milliseconds' | 'percentage' | 'rate';
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  timestamp: Date;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  uptime: number;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
}

class EnterpriseMonitoring {
  private static instance: EnterpriseMonitoring;
  private metrics: Map<string, MetricData[]> = new Map();
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private startTime = Date.now();
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  
  private constructor() {
    this.initializeDefaultHealthChecks();
    
    // Start periodic metrics collection
    setInterval(() => {
      this.collectSystemMetrics().catch(console.error);
    }, 30000); // Every 30 seconds
    
    // Start periodic cleanup of old metrics
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Every 5 minutes
  }

  public static getInstance(): EnterpriseMonitoring {
    if (!EnterpriseMonitoring.instance) {
      EnterpriseMonitoring.instance = new EnterpriseMonitoring();
    }
    return EnterpriseMonitoring.instance;
  }

  /**
   * Record a metric value
   */
  public recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    unit?: MetricData['unit']
  ): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: new Date(),
      tags,
      unit
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only last 1000 data points per metric
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }

    // Send to external monitoring in production
    if (isProduction()) {
      this.sendToExternalMonitoring(metric).catch(console.error);
    }
  }

  /**
   * Record request metrics
   */
  public recordRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    userId?: string
  ): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    // Count errors
    if (statusCode >= 400) {
      this.errorCount++;
    }

    // Record detailed metrics
    this.recordMetric('http_requests_total', 1, {
      method,
      path: this.sanitizePath(path),
      status_code: statusCode.toString()
    }, 'count');

    this.recordMetric('http_request_duration', responseTime, {
      method,
      path: this.sanitizePath(path)
    }, 'milliseconds');

    // Record user-specific metrics if available
    if (userId) {
      this.recordMetric('user_requests', 1, { user_id: userId }, 'count');
    }
  }

  /**
   * Record LLM-specific metrics
   */
  public recordLlmMetrics(
    provider: string,
    model: string,
    tokenCount: number,
    responseTime: number,
    cost?: number,
    success: boolean = true
  ): void {
    const tags = { provider, model };

    this.recordMetric('llm_requests_total', 1, tags, 'count');
    this.recordMetric('llm_tokens_total', tokenCount, tags, 'count');
    this.recordMetric('llm_response_time', responseTime, tags, 'milliseconds');
    
    if (cost !== undefined) {
      this.recordMetric('llm_cost', cost, tags, 'count');
    }

    if (!success) {
      this.recordMetric('llm_errors_total', 1, tags, 'count');
    }
  }

  /**
   * Record database metrics
   */
  public recordDatabaseMetrics(
    operation: string,
    table: string,
    responseTime: number,
    success: boolean = true
  ): void {
    const tags = { operation, table };

    this.recordMetric('db_queries_total', 1, tags, 'count');
    this.recordMetric('db_query_duration', responseTime, tags, 'milliseconds');

    if (!success) {
      this.recordMetric('db_errors_total', 1, tags, 'count');
    }
  }

  /**
   * Register a health check
   */
  public registerHealthCheck(
    name: string,
    checker: () => Promise<HealthCheckResult>
  ): void {
    this.healthChecks.set(name, checker);
  }

  /**
   * Run all health checks
   */
  public async runHealthChecks(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheckResult[];
    timestamp: Date;
  }> {
    const checks: HealthCheckResult[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, checker] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          checker(),
          new Promise<HealthCheckResult>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        
        result.responseTime = Date.now() - startTime;
        checks.push(result);

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checks.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          responseTime: 5000
        });
        overallStatus = 'unhealthy';
      }
    }

    const result = {
      status: overallStatus,
      checks,
      timestamp: new Date()
    };

    // Log unhealthy status
    if (overallStatus === 'unhealthy') {
      await auditLogger.logSecurityEvent(
        'health_check_failed',
        'failure',
        { checks: checks.filter(c => c.status === 'unhealthy') },
        {},
        'critical'
      );
    }

    return result;
  }

  /**
   * Get current system metrics
   */
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
      : 0;

    return {
      timestamp: new Date(),
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000 // Convert to seconds
      },
      uptime: Date.now() - this.startTime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      avgResponseTime
    };
  }

  /**
   * Get metrics by name
   */
  public getMetrics(name: string, limit: number = 100): MetricData[] {
    const metrics = this.metrics.get(name) || [];
    return metrics.slice(-limit);
  }

  /**
   * Get all metric names
   */
  public getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Create performance monitor for timing operations
   */
  public createPerformanceMonitor(name: string) {
    const startTime = Date.now();
    
    return {
      finish: (tags?: Record<string, string>) => {
        const duration = Date.now() - startTime;
        this.recordMetric(`${name}_duration`, duration, tags, 'milliseconds');
        return duration;
      }
    };
  }

  /**
   * Initialize default health checks
   */
  private initializeDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      try {
        const { default: prisma } = await import('./prisma');
        await prisma.$queryRaw`SELECT 1`;
        
        return {
          name: 'database',
          status: 'healthy',
          message: 'Database connection successful'
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Database connection failed'
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      let status: HealthCheckResult['status'] = 'healthy';
      let message = `Memory usage: ${heapUsedPercent.toFixed(2)}%`;

      if (heapUsedPercent > 90) {
        status = 'unhealthy';
        message += ' - Critical memory usage';
      } else if (heapUsedPercent > 75) {
        status = 'degraded';
        message += ' - High memory usage';
      }

      return {
        name: 'memory',
        status,
        message,
        metadata: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          percentage: heapUsedPercent
        }
      };
    });

    // Error rate health check
    this.registerHealthCheck('error_rate', async () => {
      const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
      
      let status: HealthCheckResult['status'] = 'healthy';
      let message = `Error rate: ${errorRate.toFixed(2)}%`;

      if (errorRate > 10) {
        status = 'unhealthy';
        message += ' - High error rate';
      } else if (errorRate > 5) {
        status = 'degraded';
        message += ' - Elevated error rate';
      }

      return {
        name: 'error_rate',
        status,
        message,
        metadata: {
          errorCount: this.errorCount,
          requestCount: this.requestCount,
          errorRate
        }
      };
    });

    // Redis health check (if available)
    this.registerHealthCheck('redis', async () => {
      try {
        const { enterpriseRateLimiter } = await import('./rate-limiter-enterprise');
        const status = await enterpriseRateLimiter.getStatus();
        
        return {
          name: 'redis',
          status: status.redis ? 'healthy' : 'degraded',
          message: status.redis ? 'Redis connection active' : 'Using memory store (Redis not available)',
          metadata: status
        };
      } catch (error) {
        return {
          name: 'redis',
          status: 'degraded',
          message: 'Redis check failed, using memory store'
        };
      }
    });
  }

  /**
   * Collect system-level metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    const metrics = await this.getSystemMetrics();
    
    this.recordMetric('system_memory_used', metrics.memory.used, {}, 'bytes');
    this.recordMetric('system_memory_total', metrics.memory.total, {}, 'bytes');
    this.recordMetric('system_memory_percentage', metrics.memory.percentage, {}, 'percentage');
    this.recordMetric('system_uptime', metrics.uptime, {}, 'milliseconds');
    this.recordMetric('system_requests_total', metrics.requestCount, {}, 'count');
    this.recordMetric('system_errors_total', metrics.errorCount, {}, 'count');
    this.recordMetric('system_avg_response_time', metrics.avgResponseTime, {}, 'milliseconds');
  }

  /**
   * Clean up old metrics data
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter(metric => metric.timestamp > cutoffTime);
      this.metrics.set(name, filtered);
    }
  }

  /**
   * Sanitize path for metrics to prevent high cardinality
   */
  private sanitizePath(path: string): string {
    // Replace dynamic segments with placeholders
    return path
      .replace(/\/api\/llm\/[^\/]+/g, '/api/llm/:provider')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-fA-F0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-zA-Z0-9-_]{20,}/g, '/:token');
  }

  /**
   * Send metrics to external monitoring service
   */
  private async sendToExternalMonitoring(metric: MetricData): Promise<void> {
    const env = getValidatedEnv();
    
    if (env.SENTRY_DSN) {
      // Would integrate with Sentry or similar service
      // For now, just log critical metrics
      if (metric.value > 1000 && metric.unit === 'milliseconds') {
        console.warn(`High response time detected: ${metric.name} = ${metric.value}ms`);
      }
    }
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(timeRange: number = 3600000): {
    requestsPerMinute: number;
    avgResponseTime: number;
    errorRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  } {
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeRange);
    
    // Get recent response times
    const recentResponseTimes = this.responseTimes.slice(-Math.min(1000, this.responseTimes.length));
    const sortedTimes = [...recentResponseTimes].sort((a, b) => a - b);
    
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    
    return {
      requestsPerMinute: (this.requestCount / (timeRange / 60000)),
      avgResponseTime: recentResponseTimes.length > 0 
        ? recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length 
        : 0,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0
    };
  }
}

// Export singleton instance
export const monitoring = EnterpriseMonitoring.getInstance();

// Convenience functions
export const recordMetric = monitoring.recordMetric.bind(monitoring);
export const recordRequest = monitoring.recordRequest.bind(monitoring);
export const recordLlmMetrics = monitoring.recordLlmMetrics.bind(monitoring);
export const recordDatabaseMetrics = monitoring.recordDatabaseMetrics.bind(monitoring);
export const createPerformanceMonitor = monitoring.createPerformanceMonitor.bind(monitoring);