// lib/monitoring.ts
// Browser-compatible monitoring utilities

interface MetricData {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
  type: 'counter' | 'gauge' | 'histogram' | 'timer'
}

interface PerformanceMetric {
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

class MonitoringService {
  public metrics: MetricData[] = []
  public performanceMarks = new Map<string, PerformanceMetric>()
  public errorCounts = new Map<string, number>()
  public requestCounts = new Map<string, number>()

  // Performance monitoring
  startTimer(name: string, metadata?: Record<string, any>): void {
    // Only run in browser environment
    if (typeof window === 'undefined' || !window.performance) return;
    
    this.performanceMarks.set(name, {
      startTime: performance.now(),
      metadata
    })
  }

  endTimer(name: string): number {
    // Only run in browser environment
    if (typeof window === 'undefined' || !window.performance) return 0;
    
    const mark = this.performanceMarks.get(name)
    if (!mark) {
      console.warn(`Timer ${name} was not started`)
      return 0
    }

    const endTime = performance.now()
    const duration = endTime - mark.startTime

    mark.endTime = endTime
    mark.duration = duration

    this.recordMetric({
      name: `timer.${name}`,
      value: duration,
      timestamp: Date.now(),
      type: 'timer',
      tags: mark.metadata
    })

    this.performanceMarks.delete(name)
    return duration
  }

  // Memory monitoring (browser version)
  getMemoryUsage(): any {
    // Browser memory info (if available)
    if (typeof window === 'undefined') return {};
    
    // Note: Browser doesn't have direct access to memory like Node.js
    // This is a simplified version
    return {
      // Browser doesn't expose detailed memory info by default
      // Would need performance.memory API which is non-standard
    }
  }

  // API metrics
  recordApiRequest(endpoint: string, method: string, statusCode: number, duration: number): void {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    const key = `${method}:${endpoint}`
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1)

    this.recordMetric({
      name: 'api.request.count',
      value: 1,
      timestamp: Date.now(),
      type: 'counter',
      tags: { endpoint, method, statusCode: statusCode.toString() }
    })

    this.recordMetric({
      name: 'api.request.duration',
      value: duration,
      timestamp: Date.now(),
      type: 'histogram',
      tags: { endpoint, method }
    })

    // Track error rates
    if (statusCode >= 400) {
      const errorKey = `${key}:${statusCode}`
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1)

      this.recordMetric({
        name: 'api.error.count',
        value: 1,
        timestamp: Date.now(),
        type: 'counter',
        tags: { endpoint, method, statusCode: statusCode.toString() }
      })
    }
  }

  // LLM-specific metrics
  recordLLMUsage(provider: string, model: string, tokens: number, duration: number, cost?: number): void {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    this.recordMetric({
      name: 'llm.tokens.total',
      value: tokens,
      timestamp: Date.now(),
      type: 'counter',
      tags: { provider, model }
    })

    this.recordMetric({
      name: 'llm.request.duration',
      value: duration,
      timestamp: Date.now(),
      type: 'histogram',
      tags: { provider, model }
    })

    if (cost !== undefined) {
      this.recordMetric({
        name: 'llm.cost.total',
        value: cost,
        timestamp: Date.now(),
        type: 'counter',
        tags: { provider, model }
      })
    }

    // Calculate tokens per second
    const tokensPerSecond = tokens / (duration / 1000)
    this.recordMetric({
      name: 'llm.tokens.per_second',
      value: tokensPerSecond,
      timestamp: Date.now(),
      type: 'gauge',
      tags: { provider, model }
    })
  }

  // Error tracking
  recordError(error: Error, context?: Record<string, any>): void {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    this.recordMetric({
      name: 'error.count',
      value: 1,
      timestamp: Date.now(),
      type: 'counter',
      tags: {
        error_type: error.constructor.name,
        error_message: error.message.substring(0, 100), // Truncate long messages
        ...context
      }
    })

    // Log error details for debugging
    console.error('Recorded error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context
    })
  }

  // Analytics and aggregations
  getMetricsSummary(timeWindow: number = 300000): any { // Default 5 minutes
    // Only run in browser environment
    if (typeof window === 'undefined') return {};
    
    const cutoff = Date.now() - timeWindow
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff)

    const summary = {
      totalRequests: this.sumMetrics(recentMetrics, 'api.request.count'),
      errorRate: this.calculateErrorRate(recentMetrics),
      avgResponseTime: this.averageMetrics(recentMetrics, 'api.request.duration'),
      totalTokens: this.sumMetrics(recentMetrics, 'llm.tokens.total'),
      totalCost: this.sumMetrics(recentMetrics, 'llm.cost.total'),
      timeWindow: timeWindow,
      timestamp: Date.now()
    }

    return summary
  }

  // Private helper methods
  private recordMetric(metric: MetricData): void {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    this.metrics.push(metric)

    // Keep only recent metrics to prevent memory leaks
    const maxAge = 3600000 // 1 hour
    const cutoff = Date.now() - maxAge
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff)
  }

  private sumMetrics(metrics: MetricData[], name: string): number {
    return metrics
      .filter(m => m.name === name)
      .reduce((sum, m) => sum + m.value, 0)
  }

  private averageMetrics(metrics: MetricData[], name: string): number {
    const values = metrics.filter(m => m.name === name).map(m => m.value)
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
  }

  private getLatestMetric(metrics: MetricData[], name: string): number | undefined {
    const matching = metrics.filter(m => m.name === name)
    if (matching.length === 0) return undefined
    return matching[matching.length - 1].value
  }

  private calculateErrorRate(metrics: MetricData[]): number {
    const totalRequests = this.sumMetrics(metrics, 'api.request.count')
    const totalErrors = this.sumMetrics(metrics, 'api.error.count')
    return totalRequests > 0 ? totalErrors / totalRequests : 0
  }
}

// Global monitoring instance
export const monitoring = new MonitoringService()

// Export the functions that were expected by the API route
export function getAllMetrics(): any {
  // Only run in browser environment
  if (typeof window === 'undefined') return {};
  
  const result: Record<string, { average: number; p50: number; p95: number; p99: number }> = {};
  
  // In a browser context, we don't have access to server-side metrics
  // This is a placeholder implementation
  return result;
}

export function resetMetrics(): void {
  // Only run in browser environment
  if (typeof window === 'undefined') return;
  
  // Reset all metrics
  monitoring.metrics = [];
  monitoring.performanceMarks.clear();
  monitoring.errorCounts.clear();
  monitoring.requestCounts.clear();
}

// Middleware for automatic API monitoring
export function withMonitoring<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  endpoint: string
): T {
  return (async (...args: any[]) => {
    // Only run in browser environment
    if (typeof window === 'undefined' || !window.performance) {
      return handler(...args);
    }
    
    const startTime = performance.now()
    const method = args[0]?.method || 'UNKNOWN'

    monitoring.startTimer(`api.${endpoint}`, { method })

    try {
      const response = await handler(...args)
      const duration = performance.now() - startTime

      monitoring.recordApiRequest(endpoint, method, response.status, duration)
      monitoring.endTimer(`api.${endpoint}`)

      return response
    } catch (error) {
      const duration = performance.now() - startTime
      monitoring.recordApiRequest(endpoint, method, 500, duration)
      monitoring.recordError(error as Error, { endpoint, method })
      monitoring.endTimer(`api.${endpoint}`)

      throw error
    }
  }) as T
}

export default monitoring