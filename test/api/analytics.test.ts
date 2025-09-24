import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GET, POST } from '@/api/analytics/route'
import { NextRequest } from 'next/server'

// Mock analytics service
const mockAnalyticsService = {
  trackEvent: vi.fn(),
  getAnalytics: vi.fn(),
  getUserAnalytics: vi.fn(),
  getSystemMetrics: vi.fn(),
}

vi.mock('@/services/analytics-service', () => ({
  AnalyticsService: vi.fn().mockImplementation(() => mockAnalyticsService),
}))

// Mock authentication
const mockAuth = {
  getServerSession: vi.fn(),
}

vi.mock('next-auth', () => ({
  getServerSession: mockAuth.getServerSession,
}))

describe('/api/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/analytics', () => {
    it('should return analytics data for authenticated user', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      }

      const mockAnalyticsData = {
        totalConversations: 45,
        totalMessages: 1250,
        averageResponseTime: 850,
        topModels: [
          { model: 'gpt-3.5-turbo', count: 30 },
          { model: 'claude-3-sonnet', count: 15 }
        ],
        dailyUsage: [
          { date: '2024-01-01', conversations: 5, messages: 25 },
          { date: '2024-01-02', conversations: 8, messages: 40 }
        ]
      }

      mockAuth.getServerSession.mockResolvedValue(mockSession)
      mockAnalyticsService.getUserAnalytics.mockResolvedValue(mockAnalyticsData)

      const request = new NextRequest('http://localhost:3000/api/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual(mockAnalyticsData)
      expect(mockAnalyticsService.getUserAnalytics).toHaveBeenCalledWith('user-123')
    })

    it('should return system analytics for admin users', async () => {
      const mockAdminSession = {
        user: { id: 'admin-123', email: 'admin@example.com', role: 'admin' }
      }

      const mockSystemAnalytics = {
        totalUsers: 1000,
        activeUsers: 150,
        totalConversations: 50000,
        systemLoad: 0.65,
        errorRate: 0.02,
        topModels: [
          { model: 'gpt-3.5-turbo', count: 30000 },
          { model: 'claude-3-sonnet', count: 20000 }
        ]
      }

      const url = new URL('http://localhost:3000/api/analytics?type=system')
      const request = new NextRequest(url)

      mockAuth.getServerSession.mockResolvedValue(mockAdminSession)
      mockAnalyticsService.getSystemMetrics.mockResolvedValue(mockSystemAnalytics)

      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual(mockSystemAnalytics)
      expect(mockAnalyticsService.getSystemMetrics).toHaveBeenCalled()
    })

    it('should filter analytics by date range', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      }

      const url = new URL('http://localhost:3000/api/analytics?startDate=2024-01-01&endDate=2024-01-31')
      const request = new NextRequest(url)

      const mockFilteredData = {
        totalConversations: 25,
        totalMessages: 500,
        dateRange: { start: '2024-01-01', end: '2024-01-31' }
      }

      mockAuth.getServerSession.mockResolvedValue(mockSession)
      mockAnalyticsService.getUserAnalytics.mockResolvedValue(mockFilteredData)

      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual(mockFilteredData)
      expect(mockAnalyticsService.getUserAnalytics).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      )
    })

    it('should return 401 for unauthenticated requests', async () => {
      mockAuth.getServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/analytics')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data).toHaveProperty('error', 'Unauthorized')
    })

    it('should return 403 for non-admin system analytics request', async () => {
      const mockUserSession = {
        user: { id: 'user-123', email: 'user@example.com' }
      }

      const url = new URL('http://localhost:3000/api/analytics?type=system')
      const request = new NextRequest(url)

      mockAuth.getServerSession.mockResolvedValue(mockUserSession)

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data).toHaveProperty('error', 'Forbidden')
    })
  })

  describe('POST /api/analytics', () => {
    it('should track analytics event successfully', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      }

      const analyticsEvent = {
        event: 'conversation_started',
        properties: {
          model: 'gpt-3.5-turbo',
          provider: 'openai',
          timestamp: new Date().toISOString()
        }
      }

      mockAuth.getServerSession.mockResolvedValue(mockSession)
      mockAnalyticsService.trackEvent.mockResolvedValue({ success: true })

      const request = new NextRequest('http://localhost:3000/api/analytics', {
        method: 'POST',
        body: JSON.stringify(analyticsEvent),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('success', true)
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        'user-123',
        analyticsEvent.event,
        analyticsEvent.properties
      )
    })

    it('should validate event data', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      }

      const invalidEvents = [
        {}, // Missing event
        { event: '' }, // Empty event
        { event: 'test', properties: 'invalid' }, // Invalid properties type
      ]

      mockAuth.getServerSession.mockResolvedValue(mockSession)

      for (const invalidEvent of invalidEvents) {
        const request = new NextRequest('http://localhost:3000/api/analytics', {
          method: 'POST',
          body: JSON.stringify(invalidEvent),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await POST(request)

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle analytics service errors', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      }

      const analyticsEvent = {
        event: 'test_event',
        properties: { test: 'data' }
      }

      mockAuth.getServerSession.mockResolvedValue(mockSession)
      mockAnalyticsService.trackEvent.mockRejectedValue(new Error('Analytics service error'))

      const request = new NextRequest('http://localhost:3000/api/analytics', {
        method: 'POST',
        body: JSON.stringify(analyticsEvent),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data).toHaveProperty('error', 'Failed to track event')
    })

    it('should sanitize event properties', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      }

      const analyticsEvent = {
        event: 'user_interaction',
        properties: {
          userInput: '<script>alert("xss")</script>',
          model: 'gpt-3.5-turbo',
          sensitiveData: 'api_key_12345'
        }
      }

      mockAuth.getServerSession.mockResolvedValue(mockSession)
      mockAnalyticsService.trackEvent.mockResolvedValue({ success: true })

      const request = new NextRequest('http://localhost:3000/api/analytics', {
        method: 'POST',
        body: JSON.stringify(analyticsEvent),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        'user-123',
        'user_interaction',
        expect.objectContaining({
          userInput: expect.not.stringContaining('<script>'),
          model: 'gpt-3.5-turbo'
        })
      )
    })

    it('should rate limit analytics events', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      }

      const analyticsEvent = {
        event: 'rapid_fire_event',
        properties: { timestamp: Date.now() }
      }

      mockAuth.getServerSession.mockResolvedValue(mockSession)

      // Simulate multiple rapid requests
      const requests = Array.from({ length: 10 }, () =>
        new NextRequest('http://localhost:3000/api/analytics', {
          method: 'POST',
          body: JSON.stringify(analyticsEvent),
          headers: { 'Content-Type': 'application/json' }
        })
      )

      const responses = await Promise.all(requests.map(req => POST(req)))

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })
})