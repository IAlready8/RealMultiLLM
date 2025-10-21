import { vi } from 'vitest'

// Mock implementation of the monitoring service for tests
export const mockMonitoring = {
  metrics: [],
  performanceMarks: new Map(),
  errorCounts: new Map(),
  requestCounts: new Map(),

  startTimer: vi.fn((name: string, metadata?: Record<string, any>) => {
    mockMonitoring.performanceMarks.set(name, {
      startTime: Date.now(),
      metadata
    })
  }),

  endTimer: vi.fn((name: string) => {
    const mark = mockMonitoring.performanceMarks.get(name)
    if (mark) {
      const duration = 150 // Mock duration
      mockMonitoring.performanceMarks.delete(name)
      return duration
    }
    return 0
  }),

  getMemoryUsage: vi.fn(() => ({
    rss: 536870912, // 512MB
    heapUsed: 268435456, // 256MB
    heapTotal: 402653184, // 384MB
    external: 67108864, // 64MB
    arrayBuffers: 16777216 // 16MB
  })),

  recordApiRequest: vi.fn((endpoint: string, method: string, statusCode: number, duration: number) => {
    const key = `${method}:${endpoint}`
    mockMonitoring.requestCounts.set(key, (mockMonitoring.requestCounts.get(key) || 0) + 1)
  }),

  recordLLMUsage: vi.fn((provider: string, model: string, tokens: number, duration: number, cost?: number) => {
    // Mock implementation - records the usage
  }),

  recordError: vi.fn((error: Error, context?: Record<string, any>) => {
    console.error('Mock recorded error:', error.message, context)
  }),

  getMetricsSummary: vi.fn((timeWindow: number = 300000) => ({
    totalRequests: 100,
    errorRate: 0.02,
    avgResponseTime: 250,
    memoryUsageMB: 512,
    totalTokens: 1000,
    totalCost: 0.15,
    timeWindow,
    timestamp: Date.now()
  })),

  exportMetrics: vi.fn((format: 'prometheus' | 'json' = 'json') => {
    if (format === 'prometheus') {
      return `# HELP realmultillm_metrics Application metrics
# TYPE realmultillm_metrics gauge
realmultillm_api_request_count 100
realmultillm_memory_rss 512`
    }
    return [
      { name: 'api.request.count', value: 100, timestamp: Date.now(), type: 'counter' },
      { name: 'memory.rss', value: 512, timestamp: Date.now(), type: 'gauge' }
    ]
  }),

  recordMetric: vi.fn((metric: any) => {
    mockMonitoring.metrics.push(metric as never)
  }),

  // Helper methods for tests
  reset: () => {
    mockMonitoring.metrics = []
    mockMonitoring.performanceMarks.clear()
    mockMonitoring.errorCounts.clear()
    mockMonitoring.requestCounts.clear()
    vi.clearAllMocks()
  },

  // Simulate different health states
  simulateHealthyState: () => {
    mockMonitoring.getMetricsSummary.mockReturnValue({
      totalRequests: 100,
      errorRate: 0.01, // 1% error rate
      avgResponseTime: 200, // 200ms average
      memoryUsageMB: 400, // 400MB memory
      totalTokens: 1000,
      totalCost: 0.15,
      timeWindow: 300000,
      timestamp: Date.now()
    })
  },

  simulateDegradedState: () => {
    mockMonitoring.getMetricsSummary.mockReturnValue({
      totalRequests: 100,
      errorRate: 0.07, // 7% error rate (degraded)
      avgResponseTime: 2500, // 2.5s average (degraded)
      memoryUsageMB: 6000, // 6GB memory (degraded on 8GB system)
      totalTokens: 1000,
      totalCost: 0.15,
      timeWindow: 300000,
      timestamp: Date.now()
    })
  },

  simulateUnhealthyState: () => {
    mockMonitoring.getMetricsSummary.mockReturnValue({
      totalRequests: 50, // Lower requests due to issues
      errorRate: 0.15, // 15% error rate (unhealthy)
      avgResponseTime: 6000, // 6s average (unhealthy)
      memoryUsageMB: 7500, // 7.5GB memory (unhealthy on 8GB system)
      totalTokens: 500,
      totalCost: 0.08,
      timeWindow: 300000,
      timestamp: Date.now()
    })
  }
}

// Default export for ES module compatibility
export const monitoring = mockMonitoring
export default mockMonitoring

// Helper functions that match the real monitoring service API
export function getAllMetrics(): any {
  return mockMonitoring.metrics
}

export function resetMetrics(): void {
  mockMonitoring.reset()
}

export function withMonitoring<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  endpoint: string
): T {
  return (async (...args: any[]) => {
    mockMonitoring.startTimer(`api.${endpoint}`)

    try {
      const response = await handler(...args)
      const duration = mockMonitoring.endTimer(`api.${endpoint}`)
      mockMonitoring.recordApiRequest(endpoint, 'GET', response.status, duration)
      return response
    } catch (error) {
      const duration = mockMonitoring.endTimer(`api.${endpoint}`)
      mockMonitoring.recordApiRequest(endpoint, 'GET', 500, duration)
      mockMonitoring.recordError(error as Error, { endpoint })
      throw error
    }
  }) as T
}