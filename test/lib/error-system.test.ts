import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      analytics: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import prisma from '@/lib/prisma'
import {
  errorManager,
  createErrorContext,
  ValidationError,
  DatabaseError,
  RateLimitError,
  ErrorCategory,
  ErrorSeverity,
} from '@/lib/error-system'

describe('error-system', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates error context with defaults and requestId', () => {
    const ctx = createErrorContext('/api/demo', undefined, { a: 1 })
    expect(ctx.endpoint).toBe('/api/demo')
    expect(typeof ctx.timestamp).toBe('object')
    expect(ctx.metadata).toMatchObject({ a: 1 })
    expect(typeof ctx.requestId).toBe('string')
  })

  it('logs critical database error to analytics with fallback userId', async () => {
    const ctx = createErrorContext('/api/x')
    const err = new DatabaseError('db down', ctx)
    // @ts-ignore mocked
    prisma.analytics.create.mockResolvedValue({})
    await errorManager.logError(err)
    // @ts-ignore mocked
    expect(prisma.analytics.create).toHaveBeenCalledTimes(1)
    // @ts-ignore mocked
    const arg = prisma.analytics.create.mock.calls[0][0]
    expect(arg.data.event).toBe('error')
    expect(arg.data.userId).toBe('system')
  })

  it('does not persist non-critical errors', async () => {
    const ctx = createErrorContext('/api/y', 'user-1')
    const err = new ValidationError('bad field', 'name', ctx)
    // @ts-ignore mocked
    prisma.analytics.create.mockResolvedValue({})
    await errorManager.logError(err as unknown as Error)
    // @ts-ignore mocked
    expect(prisma.analytics.create).not.toHaveBeenCalled()
  })

  it('attempts recovery with category-specific actions', async () => {
    const ctx = createErrorContext('/api/z', 'u', { retryAfter: 1500 })
    const rate = new RateLimitError('Too many', 1500, ctx)
    const res = await errorManager.attemptRecovery(rate)
    expect(res.success).toBe(true)
    expect(res.action).toMatchObject({ type: 'retry', payload: { delay: 1500 } })
  })

  it('aggregates error stats from analytics rows', async () => {
    // @ts-ignore mocked
    prisma.analytics.findMany.mockResolvedValue([
      { payload: JSON.stringify({ code: 'VAL_001', category: ErrorCategory.VALIDATION, severity: ErrorSeverity.MEDIUM }) },
      { payload: JSON.stringify({ code: 'NET_001', category: ErrorCategory.NETWORK, severity: ErrorSeverity.HIGH }) },
      { payload: 'not json' },
    ])
    const stats = await errorManager.getErrorStats({ from: new Date(0), to: new Date() })
    expect(stats.total).toBe(2)
    expect(stats.byCategory.validation).toBe(1)
    expect(stats.byCategory.network).toBe(1)
    expect(stats.bySeverity.high).toBe(1)
    expect(stats.topErrors.find(e => e.code === 'VAL_001')?.count).toBe(1)
  })

  it('returns zeroed records on stats failure', async () => {
    // @ts-ignore mocked
    prisma.analytics.findMany.mockRejectedValue(new Error('db'))
    const stats = await errorManager.getErrorStats({ from: new Date(0), to: new Date() })
    expect(stats.total).toBe(0)
    // ensure all enum keys exist and are zero
    expect(Object.values(ErrorCategory).every(k => typeof (stats.byCategory as any)[k] === 'number' && (stats.byCategory as any)[k] === 0)).toBe(true)
    expect(Object.values(ErrorSeverity).every(k => typeof (stats.bySeverity as any)[k] === 'number' && (stats.bySeverity as any)[k] === 0)).toBe(true)
  })
})
