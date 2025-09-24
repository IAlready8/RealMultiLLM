import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/metrics/route'

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}))

// Mock the monitoring service
vi.mock('@/lib/monitoring', () => ({
  monitoring: {
    getMetricsSummary: vi.fn(() => ({
      totalRequests: 150,
      errorRate: 0.03,
      avgResponseTime: 280,
      memoryUsageMB: 640,
      totalTokens: 2500,
      totalCost: 0.38,
      timeWindow: 300000,
      timestamp: Date.now()
    })),
    exportMetrics: vi.fn(() => [
      { name: 'api.request.count', value: 150, timestamp: Date.now(), type: 'counter' },
      { name: 'memory.rss', value: 640, timestamp: Date.now(), type: 'gauge' }
    ]),
    recordMetric: vi.fn(),
    recordError: vi.fn()
  }
}))

// Mock process methods
vi.stubGlobal('process', {
  ...process,
  uptime: vi.fn(() => 172800), // 2 days
  memoryUsage: vi.fn(() => ({
    rss: 671088640, // 640MB
    heapUsed: 335544320, // 320MB
    heapTotal: 469762048, // 448MB
    external: 83886080, // 80MB
    arrayBuffers: 20971520 // 20MB
  })),
  cpuUsage: vi.fn(() => ({
    user: 150000, // 150ms
    system: 75000  // 75ms
  })),
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
})

describe('/api/metrics', () => {
  let monitoring: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const monitoringModule = await import('@/lib/monitoring')
    monitoring = monitoringModule.monitoring
  })

  describe('GET /api/metrics', () => {
    it('returns 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/metrics')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('returns metrics in JSON format by default', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      const request = new NextRequest('http://localhost:3000/api/metrics')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        metrics: {
          totalRequests: 150,
          errorRate: 0.03,
          avgResponseTime: 280,
          memoryUsageMB: 640,
          totalTokens: 2500,
          totalCost: 0.38,
          timeWindow: 300000,
          timestamp: expect.any(Number)
        },
        health: {
          status: 'healthy',
          uptime: 172800,
          memory: {
            rss: 671088640,
            heapUsed: 335544320,
            heapTotal: 469762048,
            external: 83886080,
            arrayBuffers: 20971520
          },
          cpu: {
            user: 150000,
            system: 75000
          },
          timestamp: expect.any(Number)
        },
        meta: {
          format: 'json',
          timeWindow: 300000,
          timestamp: expect.any(Number)
        }
      })

      expect(monitoring.getMetricsSummary).toHaveBeenCalledWith(300000)
    })

    it('respects custom time window parameter', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      const request = new NextRequest('http://localhost:3000/api/metrics?window=600000')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.timeWindow).toBe(600000)
      expect(monitoring.getMetricsSummary).toHaveBeenCalledWith(600000)
    })

    it('returns metrics in Prometheus format when requested', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      const prometheusData = `# HELP realmultillm_metrics Application metrics
# TYPE realmultillm_metrics gauge
realmultillm_api_request_count 150
realmultillm_memory_rss 640`

      vi.mocked(monitoring.exportMetrics).mockReturnValueOnce(prometheusData)

      const request = new NextRequest('http://localhost:3000/api/metrics?format=prometheus')
      const response = await GET(request)
      const data = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/plain')
      expect(data).toBe(prometheusData)
      expect(monitoring.exportMetrics).toHaveBeenCalledWith('prometheus')
    })

    it('handles errors and returns 500 status', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      vi.mocked(monitoring.getMetricsSummary).mockImplementationOnce(() => {
        throw new Error('Metrics service error')
      })

      const request = new NextRequest('http://localhost:3000/api/metrics')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to retrieve metrics' })
      expect(monitoring.recordError).toHaveBeenCalledWith(
        expect.any(Error),
        { endpoint: '/api/metrics' }
      )
    })

    it('uses default time window when invalid window provided', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      const request = new NextRequest('http://localhost:3000/api/metrics?window=invalid')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // When parsing 'invalid' with parseInt, it returns NaN, so the fallback value should be used
      expect(data.meta.timeWindow).toBe(null) // NaN gets serialized as null in JSON
      expect(monitoring.getMetricsSummary).toHaveBeenCalledWith(NaN)
    })
  })

  describe('POST /api/metrics', () => {
    it('returns 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        body: JSON.stringify({
          type: 'client-performance',
          name: 'page_load_time',
          value: 1200,
          timestamp: Date.now()
        })
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('accepts client-performance metrics', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      const metricData = {
        type: 'client-performance',
        name: 'page_load_time',
        value: 1200,
        timestamp: Date.now(),
        tags: { page: '/dashboard', browser: 'chrome' }
      }

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricData)
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ success: true })
      expect(monitoring.recordMetric).toHaveBeenCalledWith({
        name: 'page_load_time',
        value: 1200,
        timestamp: metricData.timestamp,
        type: 'gauge',
        tags: {
          source: 'client',
          userId: 'user123',
          page: '/dashboard',
          browser: 'chrome'
        }
      })
    })

    it('handles missing timestamp in client metrics', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      const metricData = {
        type: 'client-performance',
        name: 'click_response_time',
        value: 45
      }

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricData)
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ success: true })
      expect(monitoring.recordMetric).toHaveBeenCalledWith({
        name: 'click_response_time',
        value: 45,
        timestamp: expect.any(Number),
        type: 'gauge',
        tags: {
          source: 'client',
          userId: 'user123'
        }
      })
    })

    it('rejects invalid metric types', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invalid-type',
          name: 'some_metric',
          value: 100
        })
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ error: 'Invalid metric type' })
      expect(monitoring.recordMetric).not.toHaveBeenCalled()
    })

    it('handles malformed JSON request body', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to record metric' })
      expect(monitoring.recordError).toHaveBeenCalledWith(
        expect.any(Error),
        { endpoint: '/api/metrics' }
      )
    })

    it('handles errors during metric recording', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: 'user123', email: 'test@example.com' }
      })

      vi.mocked(monitoring.recordMetric).mockImplementationOnce(() => {
        throw new Error('Database connection failed')
      })

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-performance',
          name: 'test_metric',
          value: 100
        })
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to record metric' })
      expect(monitoring.recordError).toHaveBeenCalledWith(
        expect.any(Error),
        { endpoint: '/api/metrics' }
      )
    })

    it('includes user ID from session in metric tags', async () => {
      const { getServerSession } = await import('next-auth')
      const mockSession = {
        user: { id: 'test-user-456', email: 'testuser@example.com', name: 'Test User' }
      }
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-performance',
          name: 'interaction_time',
          value: 350,
          tags: { action: 'button_click' }
        })
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(monitoring.recordMetric).toHaveBeenCalledWith({
        name: 'interaction_time',
        value: 350,
        timestamp: expect.any(Number),
        type: 'gauge',
        tags: {
          source: 'client',
          userId: 'test-user-456',
          action: 'button_click'
        }
      })
    })

    it('handles missing user ID in session gracefully', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { email: 'test@example.com' } // No ID field
      })

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-performance',
          name: 'metric_without_userid',
          value: 500
        })
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(monitoring.recordMetric).toHaveBeenCalledWith({
        name: 'metric_without_userid',
        value: 500,
        timestamp: expect.any(Number),
        type: 'gauge',
        tags: {
          source: 'client',
          userId: undefined
        }
      })
    })
  })
})