/**
 * PHASE 2 PERFORMANCE OPTIMIZATION: Database Connection Pool Monitoring
 *
 * Monitors and optimizes database connection usage without breaking existing functionality
 * Provides visibility into connection pool health and performance
 */

import { logger } from '@/lib/observability/logger';
import { metricsRegistry } from '@/lib/observability/metrics';

interface ConnectionMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  queriesExecuted: number;
  queryErrors: number;
  averageQueryTime: number;
  lastHealthCheck: Date;
}

class PrismaPoolMonitor {
  private metrics: ConnectionMetrics = {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
    queriesExecuted: 0,
    queryErrors: 0,
    averageQueryTime: 0,
    lastHealthCheck: new Date()
  };

  private queryTimes: number[] = [];
  private readonly MAX_QUERY_TIME_SAMPLES = 100;

  /**
   * Wrap Prisma queries with monitoring
   */
  async monitorQuery<T>(
    operation: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      // Update active connections metric
      this.metrics.activeConnections++;
      this.recordMetric('db_active_connections', this.metrics.activeConnections);

      const result = await queryFn();

      // Record successful query
      const queryTime = Date.now() - startTime;
      this.recordQueryCompletion(queryTime, true);

      logger.debug('db_query_success', {
        operation,
        duration: queryTime,
        activeConnections: this.metrics.activeConnections
      });

      return result;
    } catch (error) {
      // Record query error
      const queryTime = Date.now() - startTime;
      this.recordQueryCompletion(queryTime, false);

      logger.error('db_query_error', {
        operation,
        duration: queryTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        activeConnections: this.metrics.activeConnections
      });

      throw error;
    } finally {
      // Update active connections metric
      this.metrics.activeConnections--;
      this.recordMetric('db_active_connections', this.metrics.activeConnections);
    }
  }

  /**
   * Record query completion metrics
   */
  private recordQueryCompletion(queryTime: number, success: boolean): void {
    this.metrics.queriesExecuted++;

    if (success) {
      // Update query time statistics
      this.queryTimes.push(queryTime);
      if (this.queryTimes.length > this.MAX_QUERY_TIME_SAMPLES) {
        this.queryTimes.shift(); // Remove oldest sample
      }

      // Recalculate average
      this.metrics.averageQueryTime =
        this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
    } else {
      this.metrics.queryErrors++;
    }

    // Record metrics for monitoring
    this.recordMetric('db_queries_total', this.metrics.queriesExecuted);
    this.recordMetric('db_query_errors_total', this.metrics.queryErrors);
    this.recordMetric('db_avg_query_time_ms', this.metrics.averageQueryTime);

    // Query duration histogram
    const durationMetric = metricsRegistry.registerHistogram(
      'db_query_duration_seconds',
      'Database query duration in seconds',
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      { status: success ? 'success' : 'error' }
    );
    durationMetric.observe(queryTime / 1000);
  }

  /**
   * Record metric value
   */
  private recordMetric(name: string, value: number): void {
    try {
      const metric = metricsRegistry.registerGauge(
        name,
        `Database ${name.replace('db_', '').replace('_', ' ')}`
      );
      metric.set(value);
    } catch (error) {
      // Fail silently - metrics are non-critical
      logger.debug('metric_recording_failed', { name, value, error });
    }
  }

  /**
   * Get current connection pool metrics
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics, lastHealthCheck: new Date() };
  }

  /**
   * Check pool health and detect issues
   */
  async checkPoolHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check query error rate
    const errorRate = this.metrics.queriesExecuted > 0
      ? this.metrics.queryErrors / this.metrics.queriesExecuted
      : 0;

    if (errorRate > 0.05) { // 5% error rate threshold
      issues.push(`High query error rate: ${(errorRate * 100).toFixed(1)}%`);
      recommendations.push('Investigate database connection stability');
    }

    // Check average query time
    if (this.metrics.averageQueryTime > 1000) { // 1 second threshold
      issues.push(`Slow average query time: ${this.metrics.averageQueryTime.toFixed(0)}ms`);
      recommendations.push('Review slow queries and consider adding indexes');
    }

    // Check for connection leaks (high active connection count)
    if (this.metrics.activeConnections > 50) { // Threshold for investigation
      issues.push(`High active connection count: ${this.metrics.activeConnections}`);
      recommendations.push('Check for connection leaks in application code');
    }

    const healthy = issues.length === 0;

    logger.info('db_pool_health_check', {
      healthy,
      errorRate: errorRate * 100,
      averageQueryTime: this.metrics.averageQueryTime,
      activeConnections: this.metrics.activeConnections,
      issuesCount: issues.length
    });

    return { healthy, issues, recommendations };
  }

  /**
   * Get database pool statistics for admin monitoring
   */
  getPoolStats() {
    const now = Date.now();
    const recentQueryTimes = this.queryTimes.slice(-10); // Last 10 queries

    return {
      connections: {
        active: this.metrics.activeConnections,
        total: this.metrics.totalConnections
      },
      queries: {
        total: this.metrics.queriesExecuted,
        errors: this.metrics.queryErrors,
        errorRate: this.metrics.queriesExecuted > 0
          ? (this.metrics.queryErrors / this.metrics.queriesExecuted * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        averageQueryTime: Math.round(this.metrics.averageQueryTime),
        recentQueryTimes: recentQueryTimes.map(t => Math.round(t)),
        slowestRecentQuery: recentQueryTimes.length > 0
          ? Math.max(...recentQueryTimes)
          : 0
      },
      lastUpdated: new Date().toISOString()
    };
  }
}

// Singleton instance for global connection monitoring
export const prismaPoolMonitor = new PrismaPoolMonitor();