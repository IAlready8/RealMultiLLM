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
  type?: 'counter' | 'gauge' | 'histogram' | 'timer';
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
  private static readonly HISTORY_RETENTION_MS = 60 * 60 * 1000; // 1 hour

  private metrics: Map<string, MetricData[]> = new Map();
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private startTime = Date.now();
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private timers = new Map<string, { startedAt: bigint; metadata?: Record<string, any> }>();
  private requestHistory: Array<{
    timestamp: number;
    duration: number;
    statusCode: number;
    method: string;
    endpoint: string;
  }> = [];
  private llmHistory: Array<{ timestamp: number; tokens: number; cost: number }> = [];
  
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
    metricOrName: MetricData | string,
    value?: number,
    tags?: Record<string, string>,
    unit?: MetricData['unit']
  ): void {
    let metric: MetricData;

    if (typeof metricOrName === 'string') {
      metric = {
        name: metricOrName,
        value: value ?? 0,
        timestamp: new Date(),
        tags,
        unit
      };
    } else {
      const incoming = metricOrName;
      metric = {
        name: incoming.name,
        value: incoming.value,
        timestamp: incoming.timestamp instanceof Date ? incoming.timestamp : new Date(incoming.timestamp),
        tags: incoming.tags,
        unit: incoming.unit,
        type: incoming.type
      };
    }

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricHistory = this.metrics.get(metric.name)!;
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
    const sanitizedPath = this.sanitizePath(path);
    this.requestHistory.push({
      timestamp: Date.now(),
      duration: responseTime,
      statusCode,
      method,
      endpoint: sanitizedPath,
    });
    this.trimHistory(this.requestHistory);
    
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
      path: sanitizedPath,
      status_code: statusCode.toString()
    }, 'count');

    this.recordMetric('http_request_duration', responseTime, {
      method,
      path: sanitizedPath
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

    this.llmHistory.push({
      timestamp: Date.now(),
      tokens: tokenCount,
      cost: cost ?? 0,
    });
    this.trimHistory(this.llmHistory);
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

  public startTimer(name: string, metadata?: Record<string, any>): void {
    this.timers.set(name, {
      startedAt: process.hrtime.bigint(),
      metadata,
    });
  }

  public endTimer(name: string): number {
    const timer = this.timers.get(name);
    if (!timer) {
      return 0;
    }

    const durationMs = Number(process.hrtime.bigint() - timer.startedAt) / 1_000_000;
    this.timers.delete(name);

    const tags = timer.metadata
      ? Object.fromEntries(
          Object.entries(timer.metadata).map(([key, value]) => [key, String(value)])
        )
      : undefined;

    this.recordMetric({
      name: `timer.${name}`,
      value: durationMs,
      timestamp: new Date(),
      type: 'timer',
      tags,
      unit: 'milliseconds',
    });

    return durationMs;
  }

  public recordApiRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): void {
    this.recordRequest(method, endpoint, statusCode, duration, userId);
  }

  public recordError(error: Error, context?: Record<string, any>): void {
    this.errorCount++;
    const tags: Record<string, string> = {
      error_type: error.name,
    };

    if (context) {
      for (const [key, value] of Object.entries(context)) {
        tags[key] = String(value);
      }
    }

    this.recordMetric({
      name: 'application.error.count',
      value: 1,
      timestamp: new Date(),
      type: 'counter',
      tags,
      unit: 'count',
    });

    auditLogger.logSecurityEvent(
      'application_error',
      'failure',
      {
        error: error.message,
        stack: error.stack,
        context,
      },
      {},
      'high'
    ).catch(() => {
      // Swallow audit logger errors to avoid breaking primary flow
    });
  }

  public getMetricsSummary(timeWindow: number = 300000): {
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    memoryUsageMB: number;
    totalTokens: number;
    totalCost: number;
    timeWindow: number;
    timestamp: number;
  } {
    const now = Date.now();
    const hasFiniteWindow = Number.isFinite(timeWindow);
    const effectiveWindow = hasFiniteWindow ? Number(timeWindow) : EnterpriseMonitoring.HISTORY_RETENTION_MS;
    const cutoff = now - effectiveWindow;

    const requests = hasFiniteWindow
      ? this.requestHistory.filter(entry => entry.timestamp >= cutoff)
      : [...this.requestHistory];
    const totalRequests = requests.length;
    const totalErrors = requests.filter(entry => entry.statusCode >= 400).length;
    const totalDuration = requests.reduce((sum, entry) => sum + entry.duration, 0);

    const llmMetrics = hasFiniteWindow
      ? this.llmHistory.filter(entry => entry.timestamp >= cutoff)
      : [...this.llmHistory];

    const totalTokens = llmMetrics.reduce((sum, entry) => sum + entry.tokens, 0);
    const totalCost = llmMetrics.reduce((sum, entry) => sum + entry.cost, 0);

    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = memoryUsage.rss / (1024 * 1024);

    return {
      totalRequests,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      avgResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
      memoryUsageMB,
      totalTokens,
      totalCost,
      timeWindow,
      timestamp: now,
    };
  }

  public exportMetrics(format: 'json' | 'prometheus' = 'json'): MetricData[] | string {
    const allMetrics = Array.from(this.metrics.values()).flat();

    if (format === 'prometheus') {
      const lines = [
        '# HELP realmultillm_metrics Application metrics',
        '# TYPE realmultillm_metrics gauge',
      ];

      for (const metric of allMetrics) {
        const metricName = `realmultillm_${metric.name.replace(/\./g, '_')}`;
        const labels = metric.tags
          ? '{' + Object.entries(metric.tags)
              .map(([key, value]) => `${key}="${value}"`)
              .join(',') + '}'
          : '';
        lines.push(`${metricName}${labels} ${metric.value}`);
      }

      return lines.join('\n');
    }

    return allMetrics.map(metric => ({
      name: metric.name,
      value: metric.value,
      timestamp: metric.timestamp.getTime(),
      tags: metric.tags,
      unit: metric.unit,
      type: metric.type,
    }));
  }

  public resetMetrics(): void {
    this.metrics.clear();
    this.requestHistory = [];
    this.llmHistory = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
    this.timers.clear();
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

  private trimHistory<T extends { timestamp: number }>(
    history: T[],
    retentionMs: number = EnterpriseMonitoring.HISTORY_RETENTION_MS
  ): void {
    const cutoff = Date.now() - retentionMs;
    while (history.length && history[0].timestamp < cutoff) {
      history.shift();
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
export const startTimer = monitoring.startTimer.bind(monitoring);
export const endTimer = monitoring.endTimer.bind(monitoring);
export const recordApiRequest = monitoring.recordApiRequest.bind(monitoring);
export const recordError = monitoring.recordError.bind(monitoring);
export const getMetricsSummary = monitoring.getMetricsSummary.bind(monitoring);
export const exportMetrics = monitoring.exportMetrics.bind(monitoring);
export const resetMetrics = monitoring.resetMetrics.bind(monitoring);
