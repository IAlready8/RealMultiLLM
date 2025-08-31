import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ErrorManager,
  BaseAppError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  LLMProviderError,
  RateLimitError,
  ErrorCategory,
  ErrorSeverity,
  isAppError,
  createErrorContext,
} from '@/lib/error-system'
import { createMockPrisma } from '../test-utils'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: createMockPrisma(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

const mockPrisma = createMockPrisma()
const mockLogger = { error: vi.fn() }

describe('Error System', () => {
  let errorManager: ErrorManager

  beforeEach(() => {
    errorManager = ErrorManager.getInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('ErrorManager', () => {
    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = ErrorManager.getInstance()
        const instance2 = ErrorManager.getInstance()
        expect(instance1).toBe(instance2)
      })
    })

    describe('logError', () => {
      it('should log AppError with structured format', async () => {
        const context = createErrorContext('/api/test', 'user-1')
        const error = new AuthenticationError('User not authenticated', context)

        await errorManager.logError(error)

        expect(mockLogger.error).toHaveBeenCalledWith('app_error', {
          id: error.id,
          code: error.code,
          category: error.category,
          severity: error.severity,
          message: error.message,
          userMessage: error.userMessage,
          context: error.context,
          stack: error.stack,
          retryCount: error.retryCount,
          isRetryable: error.isRetryable,
        })
      })

      it('should normalize regular Error to AppError', async () => {
        const regularError = new Error('Regular error message')
        const context = { endpoint: '/api/test' }

        await errorManager.logError(regularError, context)

        expect(mockLogger.error).toHaveBeenCalledWith('app_error', 
          expect.objectContaining({
            code: 'UNKNOWN_001',
            category: ErrorCategory.UNKNOWN,
            severity: ErrorSeverity.MEDIUM,
            message: 'Regular error message',
            userMessage: 'An unexpected error occurred. Please try again.',
          })
        )
      })

      it('should store critical errors in database', async () => {
        const context = createErrorContext('/api/critical', 'user-1')
        const error = new BaseAppError(
          'CRIT_001',
          ErrorCategory.SYSTEM,
          ErrorSeverity.CRITICAL,
          'Critical system error',
          'System is temporarily unavailable',
          context
        )

        mockPrisma.analytics.create.mockResolvedValue({} as any)

        await errorManager.logError(error)

        expect(mockPrisma.analytics.create).toHaveBeenCalledWith({
          data: {
            id: expect.any(String),
            event: 'error',
            payload: expect.stringContaining('"severity":"critical"'),
            userId: 'user-1',
          },
        })
      })

      it('should handle logging failures gracefully', async () => {
        const context = createErrorContext('/api/test')
        const error = new AuthenticationError('Auth error', context)
        
        mockLogger.error.mockImplementation(() => {
          throw new Error('Logger failed')
        })
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        await errorManager.logError(error)

        expect(consoleSpy).toHaveBeenCalledWith('Failed to log error:', expect.any(Error))
        expect(consoleSpy).toHaveBeenCalledWith('Original error:', error)
        
        consoleSpy.mockRestore()
      })
    })

    describe('attemptRecovery', () => {
      it('should not attempt recovery for non-retryable errors', async () => {
        const context = createErrorContext('/api/test')
        const error = new AuthenticationError('Auth failed', context)

        const result = await errorManager.attemptRecovery(error)

        expect(result.success).toBe(false)
        expect(result.message).toBe('Error cannot be recovered automatically.')
      })

      it('should not attempt recovery when max retries exceeded', async () => {
        const context = createErrorContext('/api/test')
        const error = new NetworkError('Network failed', context)
        error.retryCount = 5 // Exceed max retries

        const result = await errorManager.attemptRecovery(error)

        expect(result.success).toBe(false)
      })

      it('should suggest retry for network errors', async () => {
        const context = createErrorContext('/api/test')
        const error = new NetworkError('Network failed', context)

        const result = await errorManager.attemptRecovery(error)

        expect(result.success).toBe(true)
        expect(result.action?.type).toBe('retry')
        expect(error.retryCount).toBe(1)
      })

      it('should suggest rate limit retry with delay', async () => {
        const context = createErrorContext('/api/test')
        const error = new RateLimitError(5000, context)

        const result = await errorManager.attemptRecovery(error)

        expect(result.success).toBe(true)
        expect(result.action?.type).toBe('retry')
        expect(result.action?.payload?.delay).toBe(5000)
      })

      it('should suggest provider switch for LLM errors', async () => {
        const context = createErrorContext('/api/llm')
        const error = new LLMProviderError('openai', 'Service unavailable', context)

        const result = await errorManager.attemptRecovery(error)

        expect(result.success).toBe(true)
        expect(result.action?.type).toBe('switch_provider')
      })

      it('should suggest token refresh for auth errors', async () => {
        const context = createErrorContext('/api/protected')
        const error = new AuthenticationError('Token expired', context)
        // Make it retryable for this test
        error.isRetryable = true
        error.maxRetries = 1

        const result = await errorManager.attemptRecovery(error)

        expect(result.success).toBe(true)
        expect(result.action?.type).toBe('refresh_token')
      })
    })

    describe('getErrorStats', () => {
      it('should return error statistics', async () => {
        const timeframe = {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-02'),
        }

        mockPrisma.analytics.findMany.mockResolvedValue([
          {
            id: '1',
            event: 'error',
            payload: JSON.stringify({
              code: 'AUTH_001',
              category: ErrorCategory.AUTHENTICATION,
              severity: ErrorSeverity.HIGH,
            }),
            userId: 'user-1',
            createdAt: new Date(),
          },
          {
            id: '2',
            event: 'error',
            payload: JSON.stringify({
              code: 'NET_001',
              category: ErrorCategory.NETWORK,
              severity: ErrorSeverity.MEDIUM,
            }),
            userId: 'user-2',
            createdAt: new Date(),
          },
          {
            id: '3',
            event: 'error',
            payload: JSON.stringify({
              code: 'AUTH_001',
              category: ErrorCategory.AUTHENTICATION,
              severity: ErrorSeverity.HIGH,
            }),
            userId: 'user-3',
            createdAt: new Date(),
          },
        ])

        const stats = await errorManager.getErrorStats(timeframe)

        expect(stats.total).toBe(3)
        expect(stats.byCategory[ErrorCategory.AUTHENTICATION]).toBe(2)
        expect(stats.byCategory[ErrorCategory.NETWORK]).toBe(1)
        expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(2)
        expect(stats.bySeverity[ErrorSeverity.MEDIUM]).toBe(1)
        expect(stats.topErrors).toContainEqual({ code: 'AUTH_001', count: 2 })
        expect(stats.topErrors).toContainEqual({ code: 'NET_001', count: 1 })
      })

      it('should handle invalid error entries gracefully', async () => {
        mockPrisma.analytics.findMany.mockResolvedValue([
          {
            id: '1',
            event: 'error',
            payload: 'invalid-json',
            userId: 'user-1',
            createdAt: new Date(),
          },
          {
            id: '2',
            event: 'error',
            payload: JSON.stringify({}), // Missing required fields
            userId: 'user-2',
            createdAt: new Date(),
          },
        ])

        const stats = await errorManager.getErrorStats({
          from: new Date(),
          to: new Date(),
        })

        expect(stats.total).toBe(2)
        expect(Object.keys(stats.byCategory)).toHaveLength(0)
        expect(Object.keys(stats.bySeverity)).toHaveLength(0)
      })

      it('should handle database errors gracefully', async () => {
        mockPrisma.analytics.findMany.mockRejectedValue(new Error('DB error'))

        const stats = await errorManager.getErrorStats({
          from: new Date(),
          to: new Date(),
        })

        expect(stats.total).toBe(0)
        expect(stats.byCategory).toEqual({})
        expect(stats.bySeverity).toEqual({})
        expect(stats.topErrors).toEqual([])
      })
    })
  })

  describe('Error Classes', () => {
    describe('BaseAppError', () => {
      it('should create error with all properties', () => {
        const context = createErrorContext('/api/test', 'user-1')
        const error = new BaseAppError(
          'TEST_001',
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM,
          'Test error',
          'User friendly message',
          context,
          true,
          3
        )

        expect(error.id).toBeDefined()
        expect(error.code).toBe('TEST_001')
        expect(error.category).toBe(ErrorCategory.VALIDATION)
        expect(error.severity).toBe(ErrorSeverity.MEDIUM)
        expect(error.message).toBe('Test error')
        expect(error.userMessage).toBe('User friendly message')
        expect(error.context).toBe(context)
        expect(error.isRetryable).toBe(true)
        expect(error.maxRetries).toBe(3)
        expect(error.retryCount).toBe(0)
      })

      it('should have proper error name and stack', () => {
        const context = createErrorContext('/api/test')
        const error = new BaseAppError(
          'TEST_001',
          ErrorCategory.SYSTEM,
          ErrorSeverity.HIGH,
          'Test error',
          'User message',
          context
        )

        expect(error.name).toBe('BaseAppError')
        expect(error.stack).toContain('BaseAppError')
      })
    })

    describe('AuthenticationError', () => {
      it('should create authentication error with correct properties', () => {
        const context = createErrorContext('/api/protected')
        const error = new AuthenticationError('Not authenticated', context)

        expect(error.code).toBe('AUTH_001')
        expect(error.category).toBe(ErrorCategory.AUTHENTICATION)
        expect(error.severity).toBe(ErrorSeverity.HIGH)
        expect(error.userMessage).toBe('Authentication required. Please sign in to continue.')
        expect(error.isRetryable).toBe(false)
      })
    })

    describe('ValidationError', () => {
      it('should create validation error with field information', () => {
        const context = createErrorContext('/api/validate')
        const error = new ValidationError('Invalid email format', 'email', context)

        expect(error.code).toBe('VAL_001')
        expect(error.category).toBe(ErrorCategory.VALIDATION)
        expect(error.severity).toBe(ErrorSeverity.MEDIUM)
        expect(error.userMessage).toContain('email')
        expect(error.context.metadata.field).toBe('email')
      })
    })

    describe('NetworkError', () => {
      it('should create retryable network error', () => {
        const context = createErrorContext('/api/external')
        const error = new NetworkError('Connection timeout', context)

        expect(error.code).toBe('NET_001')
        expect(error.category).toBe(ErrorCategory.NETWORK)
        expect(error.isRetryable).toBe(true)
        expect(error.maxRetries).toBe(3)
      })
    })

    describe('LLMProviderError', () => {
      it('should create provider error with provider info', () => {
        const context = createErrorContext('/api/llm')
        const error = new LLMProviderError('openai', 'Rate limited', context)

        expect(error.code).toBe('LLM_001')
        expect(error.category).toBe(ErrorCategory.LLM_PROVIDER)
        expect(error.userMessage).toContain('openai')
        expect(error.context.metadata.provider).toBe('openai')
        expect(error.isRetryable).toBe(true)
      })
    })

    describe('RateLimitError', () => {
      it('should create rate limit error with retry info', () => {
        const context = createErrorContext('/api/limited')
        const error = new RateLimitError(5000, context)

        expect(error.code).toBe('RATE_001')
        expect(error.category).toBe(ErrorCategory.RATE_LIMIT)
        expect(error.context.metadata.retryAfter).toBe(5000)
        expect(error.userMessage).toContain('5 seconds')
        expect(error.isRetryable).toBe(true)
      })
    })
  })

  describe('Utility Functions', () => {
    describe('isAppError', () => {
      it('should identify AppError instances', () => {
        const context = createErrorContext('/api/test')
        const appError = new BaseAppError(
          'TEST_001',
          ErrorCategory.SYSTEM,
          ErrorSeverity.MEDIUM,
          'Test',
          'Test message',
          context
        )
        const regularError = new Error('Regular error')

        expect(isAppError(appError)).toBe(true)
        expect(isAppError(regularError)).toBe(false)
        expect(isAppError(null)).toBe(false)
        expect(isAppError('string')).toBe(false)
      })
    })

    describe('createErrorContext', () => {
      it('should create error context with required fields', () => {
        const context = createErrorContext('/api/test', 'user-1', { extra: 'data' })

        expect(context.endpoint).toBe('/api/test')
        expect(context.userId).toBe('user-1')
        expect(context.timestamp).toBeInstanceOf(Date)
        expect(context.requestId).toBeDefined()
        expect(context.metadata.extra).toBe('data')
      })

      it('should create context with minimal parameters', () => {
        const context = createErrorContext('/api/minimal')

        expect(context.endpoint).toBe('/api/minimal')
        expect(context.userId).toBeUndefined()
        expect(context.timestamp).toBeInstanceOf(Date)
        expect(context.requestId).toBeDefined()
        expect(context.metadata).toEqual({})
      })
    })
  })

  describe('Error Recovery Actions', () => {
    it('should determine retry action for network errors', async () => {
      const context = createErrorContext('/api/test')
      const error = new NetworkError('Connection failed', context)

      const result = await errorManager.attemptRecovery(error)

      expect(result.action?.type).toBe('retry')
    })

    it('should determine switch provider action for LLM errors', async () => {
      const context = createErrorContext('/api/llm')
      const error = new LLMProviderError('openai', 'Service down', context)

      const result = await errorManager.attemptRecovery(error)

      expect(result.action?.type).toBe('switch_provider')
    })

    it('should determine refresh token action for auth errors', async () => {
      const context = createErrorContext('/api/protected')
      const error = new AuthenticationError('Token expired', context)
      // Make it retryable
      error.isRetryable = true
      error.maxRetries = 1

      const result = await errorManager.attemptRecovery(error)

      expect(result.action?.type).toBe('refresh_token')
    })
  })
})