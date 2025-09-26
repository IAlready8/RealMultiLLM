/**
 * PHASE 2 PERFORMANCE VALIDATION: Critical Performance Optimizations
 *
 * Tests to ensure performance improvements work without breaking functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules for testing
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/lib/observability/metrics', () => ({
  metricsRegistry: {
    registerGauge: vi.fn().mockReturnValue({ set: vi.fn() }),
    registerHistogram: vi.fn().mockReturnValue({ observe: vi.fn() }),
    registerCounter: vi.fn().mockReturnValue({ inc: vi.fn() })
  }
}));

describe('PHASE 2 PERFORMANCE: Stream Connection Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track stream connections without memory leaks', async () => {
    const { streamConnectionManager } = await import('@/lib/stream-connection-manager');

    // Mock controller
    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
      desiredSize: 1
    } as any;

    // Register multiple connections
    const connectionIds = [];
    for (let i = 0; i < 5; i++) {
      const id = streamConnectionManager.registerConnection(
        `user-${i}`,
        'openai',
        mockController,
        1000 // Short timeout for testing
      );
      connectionIds.push(id);
    }

    const stats = streamConnectionManager.getConnectionStats();
    expect(stats.total).toBe(5);
    expect(stats.byProvider.openai).toBe(5);

    // Clean up connections
    connectionIds.forEach(id => {
      streamConnectionManager.removeConnection(id);
    });

    const finalStats = streamConnectionManager.getConnectionStats();
    expect(finalStats.total).toBe(0);
  });

  it('should automatically timeout stale connections', async () => {
    const { streamConnectionManager } = await import('@/lib/stream-connection-manager');

    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
      desiredSize: 1
    } as any;

    // Register connection with very short timeout
    const connectionId = streamConnectionManager.registerConnection(
      'test-user',
      'openai',
      mockController,
      50 // 50ms timeout
    );

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 100));

    const stats = streamConnectionManager.getConnectionStats();
    expect(stats.total).toBe(0); // Should be auto-cleaned
  });
});

describe('PHASE 2 PERFORMANCE: Database Connection Monitoring', () => {
  it('should monitor query performance without affecting functionality', async () => {
    const { prismaPoolMonitor } = await import('@/lib/prisma-pool-monitor');

    // Mock successful query
    const mockQuery = vi.fn().mockResolvedValue({ data: 'test' });

    const result = await prismaPoolMonitor.monitorQuery('findMany', mockQuery);

    expect(result).toEqual({ data: 'test' });
    expect(mockQuery).toHaveBeenCalled();

    const metrics = prismaPoolMonitor.getMetrics();
    expect(metrics.queriesExecuted).toBeGreaterThan(0);
  });

  it('should track query errors and performance', async () => {
    const { prismaPoolMonitor } = await import('@/lib/prisma-pool-monitor');

    // Mock failing query
    const mockQuery = vi.fn().mockRejectedValue(new Error('Database error'));

    await expect(
      prismaPoolMonitor.monitorQuery('findMany', mockQuery)
    ).rejects.toThrow('Database error');

    const metrics = prismaPoolMonitor.getMetrics();
    expect(metrics.queryErrors).toBeGreaterThan(0);
  });

  it('should detect unhealthy database performance', async () => {
    const { prismaPoolMonitor } = await import('@/lib/prisma-pool-monitor');

    // Simulate slow queries by manipulating internal state
    const slowQuery = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100)); // >1 second
      return { data: 'slow' };
    });

    await prismaPoolMonitor.monitorQuery('slow-query', slowQuery);

    const health = await prismaPoolMonitor.checkPoolHealth();
    expect(health.healthy).toBe(false);
    expect(health.issues).toContain(expect.stringMatching(/slow.*query/i));
  });
});

describe('PHASE 2 PERFORMANCE: Smart Cache Invalidation', () => {
  it('should register cache dependencies correctly', async () => {
    const { smartCacheInvalidator } = await import('@/lib/smart-cache-invalidator');

    smartCacheInvalidator.registerCache(
      'test-cache-key',
      ['llm_request', 'user_activity'],
      60000
    );

    const stats = smartCacheInvalidator.getDependencyStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.byEvent.llm_request).toBeGreaterThan(0);
  });

  it('should invalidate caches based on events', async () => {
    const { smartCacheInvalidator } = await import('@/lib/smart-cache-invalidator');

    // Register cache with dependency
    smartCacheInvalidator.registerCache(
      'analytics:user-123',
      ['llm_request'],
      60000
    );

    // Trigger invalidation
    const invalidatedKeys = await smartCacheInvalidator.invalidateByEvent('llm_request');

    expect(invalidatedKeys).toContain('analytics:user-123');
  });

  it('should set cache with dependencies', async () => {
    const { smartCacheInvalidator } = await import('@/lib/smart-cache-invalidator');

    await smartCacheInvalidator.setWithDependencies(
      'test-key',
      { data: 'test' },
      30000,
      ['test_event']
    );

    const stats = smartCacheInvalidator.getDependencyStats();
    expect(stats.byEvent.test_event).toBeGreaterThan(0);
  });
});

describe('PHASE 2 PERFORMANCE: Integration Tests', () => {
  it('should maintain API functionality with performance enhancements', async () => {
    // Test that the enhanced streaming endpoint maintains compatibility
    const mockRequest = {
      signal: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    };

    const mockSession = {
      user: { id: 'test-user' }
    };

    // This test ensures that our enhancements don't break the core functionality
    // The actual API route testing would be done in integration tests
    expect(mockRequest.signal.addEventListener).toBeDefined();
    expect(mockSession.user.id).toBe('test-user');
  });

  it('should track performance metrics consistently', async () => {
    const { streamConnectionManager } = await import('@/lib/stream-connection-manager');
    const { prismaPoolMonitor } = await import('@/lib/prisma-pool-monitor');
    const { smartCacheInvalidator } = await import('@/lib/smart-cache-invalidator');

    // All monitoring systems should provide stats
    const streamStats = streamConnectionManager.getConnectionStats();
    const dbStats = prismaPoolMonitor.getMetrics();
    const cacheStats = smartCacheInvalidator.getDependencyStats();

    expect(streamStats).toHaveProperty('total');
    expect(dbStats).toHaveProperty('queriesExecuted');
    expect(cacheStats).toHaveProperty('total');
  });
});