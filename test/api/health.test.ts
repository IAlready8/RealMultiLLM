import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/health/route'

// Mock the monitoring service
vi.mock('@/lib/monitoring', () => ({
  monitoring: {
    startTimer: vi.fn(),
    endTimer: vi.fn(() => 150),
    recordApiRequest: vi.fn(),
    recordError: vi.fn(),
    getMetricsSummary: vi.fn(() => ({
      totalRequests: 100,
      errorRate: 0.02,
      avgResponseTime: 250,
      memoryUsageMB: 512,
      totalTokens: 1000,
      totalCost: 0.15,
      timeWindow: 60000,
      timestamp: Date.now()
    }))
  }
}))

// Mock process methods
const mockMemoryUsage = vi.fn(() => ({
  rss: 536870912, // 512MB
  heapUsed: 268435456, // 256MB
  heapTotal: 402653184, // 384MB
  external: 67108864, // 64MB
  arrayBuffers: 16777216 // 16MB
}))

const mockCpuUsage = vi.fn(() => ({
  user: 100000, // 100ms
  system: 50000  // 50ms
}))

vi.stubGlobal('process', {
  ...process,
  memoryUsage: mockMemoryUsage,
  uptime: vi.fn(() => 86400), // 1 day
  cpuUsage: mockCpuUsage,
  env: {
    ...process.env,
    npm_package_version: '1.0.0',
    NODE_ENV: 'test'
  },
  version: 'v18.0.0'
})

describe('/api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns healthy status with proper metrics', async () => {
    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
      uptime: {
        seconds: 86400,
        human: '1d'
      },
      memory: {
        rss: 512,
        heapUsed: 256,
        heapTotal: 384,
        external: 64,
        usage_percent: expect.any(Number)
      },
      cpu: {
        user: 100,
        system: 50
      },
      metrics: {
        requests_last_minute: 100,
        error_rate: 2,
        avg_response_time: 250,
        total_tokens: 1000,
        total_cost: 0.15
      },
      issues: [],
      version: '1.0.0',
      node_version: 'v18.0.0',
      environment: 'test'
    })
  })

  it('returns degraded status with elevated memory usage', async () => {
    mockMemoryUsage.mockReturnValueOnce({
      rss: 6509621248, // 6208MB (≈76% of 8GB limit)
      heapUsed: 268435456,
      heapTotal: 402653184,
      external: 67108864,
      arrayBuffers: 16777216
    })

    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
    expect(data.issues).toContain('Elevated memory usage: 75.8%')
    expect(data.memory.usage_percent).toBe(76)
  })

  it('returns unhealthy status with critical memory usage', async () => {
    mockMemoryUsage.mockReturnValueOnce({
      rss: 7816840479, // ~91% of 8GB limit
      heapUsed: 268435456,
      heapTotal: 402653184,
      external: 67108864,
      arrayBuffers: 16777216
    })

    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.issues).toContain('High memory usage: 91.0%')
    expect(data.memory.usage_percent).toBe(91)
  })

  it('returns degraded status with elevated error rate', async () => {
    const { monitoring } = await import('@/lib/monitoring')
    vi.mocked(monitoring.getMetricsSummary).mockReturnValueOnce({
      totalRequests: 100,
      errorRate: 0.07, // 7% error rate
      avgResponseTime: 250,
      memoryUsageMB: 512,
      totalTokens: 1000,
      totalCost: 0.15,
      timeWindow: 60000,
      timestamp: Date.now()
    })

    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
    expect(data.issues).toContain('Elevated error rate: 7.0%')
  })

  it('returns unhealthy status with high error rate', async () => {
    const { monitoring } = await import('@/lib/monitoring')
    vi.mocked(monitoring.getMetricsSummary).mockReturnValueOnce({
      totalRequests: 100,
      errorRate: 0.15, // 15% error rate
      avgResponseTime: 250,
      memoryUsageMB: 512,
      totalTokens: 1000,
      totalCost: 0.15,
      timeWindow: 60000,
      timestamp: Date.now()
    })

    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.issues).toContain('High error rate: 15.0%')
  })

  it('returns degraded status with slow response time', async () => {
    const { monitoring } = await import('@/lib/monitoring')
    vi.mocked(monitoring.getMetricsSummary).mockReturnValueOnce({
      totalRequests: 100,
      errorRate: 0.02,
      avgResponseTime: 3000, // 3 second average
      memoryUsageMB: 512,
      totalTokens: 1000,
      totalCost: 0.15,
      timeWindow: 60000,
      timestamp: Date.now()
    })

    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
    expect(data.issues).toContain('Elevated response time: 3000ms')
  })

  it('returns unhealthy status with very slow response time', async () => {
    const { monitoring } = await import('@/lib/monitoring')
    vi.mocked(monitoring.getMetricsSummary).mockReturnValueOnce({
      totalRequests: 100,
      errorRate: 0.02,
      avgResponseTime: 6000, // 6 second average
      memoryUsageMB: 512,
      totalTokens: 1000,
      totalCost: 0.15,
      timeWindow: 60000,
      timestamp: Date.now()
    })

    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.issues).toContain('Slow response time: 6000ms')
  })

  it('handles multiple health issues correctly', async () => {
    mockMemoryUsage.mockReturnValueOnce({
      rss: 6509621248, // 6208MB (≈76% of 8GB limit)
      heapUsed: 268435456,
      heapTotal: 402653184,
      external: 67108864,
      arrayBuffers: 16777216
    })

    const { monitoring } = await import('@/lib/monitoring')
    vi.mocked(monitoring.getMetricsSummary).mockReturnValueOnce({
      totalRequests: 100,
      errorRate: 0.07, // 7% error rate
      avgResponseTime: 3000, // 3 second average
      memoryUsageMB: 512,
      totalTokens: 1000,
      totalCost: 0.15,
      timeWindow: 60000,
      timestamp: Date.now()
    })

    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
    expect(data.issues).toHaveLength(3)
    expect(data.issues).toEqual(
      expect.arrayContaining([
        'Elevated memory usage: 75.8%',
        'Elevated error rate: 7.0%',
        'Elevated response time: 3000ms'
      ])
    )
  })

  it('returns 503 status when health check fails', async () => {
    const { monitoring } = await import('@/lib/monitoring')
    vi.mocked(monitoring.getMetricsSummary).mockImplementationOnce(() => {
      throw new Error('Metrics service unavailable')
    })

    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toMatchObject({
      status: 'unhealthy',
      timestamp: expect.any(String),
      error: 'Health check failed',
      issues: ['Unable to perform health check']
    })

    expect(monitoring.recordError).toHaveBeenCalledWith(
      expect.any(Error),
      { endpoint: '/api/health' }
    )
  })

  it('includes correct cache headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(request)

    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(response.headers.get('Expires')).toBe('0')
  })

  it('formats uptime correctly for different durations', async () => {
    // Test various uptime durations
    const testCases = [
      { uptime: 30, expected: '30s' },
      { uptime: 90, expected: '1m 30s' },
      { uptime: 3661, expected: '1h 1m 1s' },
      { uptime: 90061, expected: '1d 1h 1m 1s' },
      { uptime: 0, expected: '0s' }
    ]

    for (const testCase of testCases) {
      vi.stubGlobal('process', {
        ...process,
        memoryUsage: mockMemoryUsage,
        uptime: vi.fn(() => testCase.uptime),
        cpuUsage: mockCpuUsage,
        env: process.env,
        version: 'v18.0.0'
      })

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await GET(request)
      const data = await response.json()

      expect(data.uptime.human).toBe(testCase.expected)
      expect(data.uptime.seconds).toBe(Math.floor(testCase.uptime))
    }
  })

  it('calls monitoring service methods correctly', async () => {
    const { monitoring } = await import('@/lib/monitoring')
    const request = new NextRequest('http://localhost:3000/api/health')

    await GET(request)

    expect(monitoring.startTimer).toHaveBeenCalledWith('health-check')
    expect(monitoring.endTimer).toHaveBeenCalledWith('health-check')
    expect(monitoring.recordApiRequest).toHaveBeenCalledWith('/api/health', 'GET', 200, 150)
    expect(monitoring.getMetricsSummary).toHaveBeenCalledWith(60000)
  })
})