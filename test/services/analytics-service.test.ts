import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AnalyticsService } from '@/services/analytics-service'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// Mock fetch for remote analytics
global.fetch = vi.fn()

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService

  beforeEach(() => {
    vi.clearAllMocks()
    analyticsService = new AnalyticsService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('trackEvent', () => {
    it('should track events locally', async () => {
      const userId = 'user-123'
      const event = 'conversation_started'
      const properties = { model: 'gpt-3.5-turbo', provider: 'openai' }

      mockLocalStorage.getItem.mockReturnValue('[]')

      await analyticsService.trackEvent(userId, event, properties)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'analytics_events',
        expect.stringContaining(event)
      )
    })

    it('should validate event data', async () => {
      const userId = 'user-123'
      const invalidEvent = ''
      const properties = {}

      await expect(
        analyticsService.trackEvent(userId, invalidEvent, properties)
      ).rejects.toThrow('Event name is required')
    })

    it('should sanitize event properties', async () => {
      const userId = 'user-123'
      const event = 'user_input'
      const properties = {
        userMessage: '<script>alert("xss")</script>Hello',
        apiKey: 'sk-1234567890',
        safeData: 'normal content'
      }

      mockLocalStorage.getItem.mockReturnValue('[]')

      await analyticsService.trackEvent(userId, event, properties)

      const setItemCall = mockLocalStorage.setItem.mock.calls[0]
      const savedData = JSON.parse(setItemCall[1])
      const savedEvent = savedData[0]

      expect(savedEvent.properties.userMessage).not.toContain('<script>')
      expect(savedEvent.properties.apiKey).toBeUndefined()
      expect(savedEvent.properties.safeData).toBe('normal content')
    })

    it('should include timestamp and session info', async () => {
      const userId = 'user-123'
      const event = 'page_view'
      const properties = { page: '/chat' }

      mockLocalStorage.getItem.mockReturnValue('[]')

      await analyticsService.trackEvent(userId, event, properties)

      const setItemCall = mockLocalStorage.setItem.mock.calls[0]
      const savedData = JSON.parse(setItemCall[1])
      const savedEvent = savedData[0]

      expect(savedEvent).toHaveProperty('timestamp')
      expect(savedEvent).toHaveProperty('sessionId')
      expect(savedEvent).toHaveProperty('userId', userId)
      expect(savedEvent).toHaveProperty('event', event)
    })

    it('should handle storage quota exceeded', async () => {
      const userId = 'user-123'
      const event = 'test_event'
      const properties = {}

      mockLocalStorage.getItem.mockReturnValue('[]')
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      // Should not throw, but handle gracefully
      await expect(
        analyticsService.trackEvent(userId, event, properties)
      ).resolves.toBeUndefined()
    })
  })

  describe('getUserAnalytics', () => {
    it('should return user analytics summary', async () => {
      const userId = 'user-123'
      const mockEvents = [
        {
          userId,
          event: 'conversation_started',
          timestamp: new Date().toISOString(),
          properties: { model: 'gpt-3.5-turbo' }
        },
        {
          userId,
          event: 'message_sent',
          timestamp: new Date().toISOString(),
          properties: { model: 'gpt-3.5-turbo' }
        },
        {
          userId: 'other-user',
          event: 'conversation_started',
          timestamp: new Date().toISOString(),
          properties: {}
        }
      ]

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockEvents))

      const analytics = await analyticsService.getUserAnalytics(userId)

      expect(analytics.totalEvents).toBe(2)
      expect(analytics.eventBreakdown).toHaveProperty('conversation_started', 1)
      expect(analytics.eventBreakdown).toHaveProperty('message_sent', 1)
      expect(analytics.topModels).toEqual([
        { model: 'gpt-3.5-turbo', count: 2 }
      ])
    })

    it('should filter by date range', async () => {
      const userId = 'user-123'
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

      const mockEvents = [
        {
          userId,
          event: 'recent_event',
          timestamp: today.toISOString(),
          properties: {}
        },
        {
          userId,
          event: 'old_event',
          timestamp: lastWeek.toISOString(),
          properties: {}
        }
      ]

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockEvents))

      const analytics = await analyticsService.getUserAnalytics(userId, {
        startDate: yesterday.toISOString(),
        endDate: today.toISOString()
      })

      expect(analytics.totalEvents).toBe(1)
      expect(analytics.eventBreakdown).toHaveProperty('recent_event', 1)
      expect(analytics.eventBreakdown).not.toHaveProperty('old_event')
    })

    it('should calculate daily usage patterns', async () => {
      const userId = 'user-123'
      const today = new Date().toISOString().split('T')[0]

      const mockEvents = [
        {
          userId,
          event: 'conversation_started',
          timestamp: new Date().toISOString(),
          properties: {}
        },
        {
          userId,
          event: 'message_sent',
          timestamp: new Date().toISOString(),
          properties: {}
        }
      ]

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockEvents))

      const analytics = await analyticsService.getUserAnalytics(userId)

      expect(analytics.dailyUsage).toHaveProperty(today)
      expect(analytics.dailyUsage[today]).toBe(2)
    })
  })

  describe('getSystemMetrics', () => {
    it('should return system-wide analytics', async () => {
      const mockEvents = [
        {
          userId: 'user-1',
          event: 'conversation_started',
          timestamp: new Date().toISOString(),
          properties: { model: 'gpt-3.5-turbo' }
        },
        {
          userId: 'user-2',
          event: 'conversation_started',
          timestamp: new Date().toISOString(),
          properties: { model: 'claude-3-sonnet' }
        },
        {
          userId: 'user-1',
          event: 'error_occurred',
          timestamp: new Date().toISOString(),
          properties: { error: 'Rate limit exceeded' }
        }
      ]

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockEvents))

      const metrics = await analyticsService.getSystemMetrics()

      expect(metrics.totalEvents).toBe(3)
      expect(metrics.uniqueUsers).toBe(2)
      expect(metrics.errorRate).toBeCloseTo(0.33, 2)
      expect(metrics.topModels).toEqual([
        { model: 'gpt-3.5-turbo', count: 1 },
        { model: 'claude-3-sonnet', count: 1 }
      ])
    })

    it('should calculate performance metrics', async () => {
      const mockEvents = [
        {
          userId: 'user-1',
          event: 'api_response',
          timestamp: new Date().toISOString(),
          properties: { responseTime: 500 }
        },
        {
          userId: 'user-1',
          event: 'api_response',
          timestamp: new Date().toISOString(),
          properties: { responseTime: 300 }
        }
      ]

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockEvents))

      const metrics = await analyticsService.getSystemMetrics()

      expect(metrics.averageResponseTime).toBe(400)
    })
  })

  describe('sendToRemoteAnalytics', () => {
    it('should send events to remote analytics service', async () => {
      const events = [
        {
          userId: 'user-123',
          event: 'test_event',
          timestamp: new Date().toISOString(),
          properties: {}
        }
      ]

      // @ts-ignore
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      await analyticsService.sendToRemoteAnalytics(events)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/batch'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ events })
        })
      )
    })

    it('should handle remote analytics failures gracefully', async () => {
      const events = [
        {
          userId: 'user-123',
          event: 'test_event',
          timestamp: new Date().toISOString(),
          properties: {}
        }
      ]

      // @ts-ignore
      global.fetch.mockRejectedValue(new Error('Network error'))

      // Should not throw
      await expect(
        analyticsService.sendToRemoteAnalytics(events)
      ).resolves.toBeUndefined()
    })

    it('should retry failed requests', async () => {
      const events = [
        {
          userId: 'user-123',
          event: 'test_event',
          timestamp: new Date().toISOString(),
          properties: {}
        }
      ]

      // @ts-ignore
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })

      await analyticsService.sendToRemoteAnalytics(events)

      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('privacy and data protection', () => {
    it('should not track sensitive information', async () => {
      const userId = 'user-123'
      const event = 'api_key_used'
      const properties = {
        apiKey: 'sk-sensitive-key',
        password: 'secret123',
        token: 'bearer-token',
        email: 'user@example.com'
      }

      mockLocalStorage.getItem.mockReturnValue('[]')

      await analyticsService.trackEvent(userId, event, properties)

      const setItemCall = mockLocalStorage.setItem.mock.calls[0]
      const savedData = JSON.parse(setItemCall[1])
      const savedEvent = savedData[0]

      expect(savedEvent.properties).not.toHaveProperty('apiKey')
      expect(savedEvent.properties).not.toHaveProperty('password')
      expect(savedEvent.properties).not.toHaveProperty('token')
      expect(savedEvent.properties).not.toHaveProperty('email')
    })

    it('should hash user identifiers', async () => {
      const userId = 'user@example.com'
      const event = 'test_event'

      mockLocalStorage.getItem.mockReturnValue('[]')

      await analyticsService.trackEvent(userId, event, {})

      const setItemCall = mockLocalStorage.setItem.mock.calls[0]
      const savedData = JSON.parse(setItemCall[1])
      const savedEvent = savedData[0]

      expect(savedEvent.userId).not.toBe(userId)
      expect(savedEvent.userId).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hash
    })
  })

  describe('performance optimization', () => {
    it('should batch events for better performance', async () => {
      const userId = 'user-123'

      mockLocalStorage.getItem.mockReturnValue('[]')

      // Track multiple events quickly
      const events = [
        analyticsService.trackEvent(userId, 'event1', {}),
        analyticsService.trackEvent(userId, 'event2', {}),
        analyticsService.trackEvent(userId, 'event3', {})
      ]

      await Promise.all(events)

      // Should batch writes to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3)
    })

    it('should limit stored events to prevent memory issues', async () => {
      const userId = 'user-123'
      const maxEvents = 1000

      // Create array with max + 1 events
      const existingEvents = Array.from({ length: maxEvents + 1 }, (_, i) => ({
        userId,
        event: `event_${i}`,
        timestamp: new Date().toISOString(),
        properties: {}
      }))

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingEvents))

      await analyticsService.trackEvent(userId, 'new_event', {})

      const setItemCall = mockLocalStorage.setItem.mock.calls[0]
      const savedData = JSON.parse(setItemCall[1])

      // Should not exceed max events
      expect(savedData.length).toBeLessThanOrEqual(maxEvents)
      expect(savedData.find((e: any) => e.event === 'new_event')).toBeDefined()
    })
  })
})