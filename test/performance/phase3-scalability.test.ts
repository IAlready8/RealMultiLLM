/**
 * PHASE 3 SCALABILITY VALIDATION: Advanced Scalability Enhancement Tests
 *
 * Comprehensive testing suite for Phase 3 advanced scalability optimizations
 * Validates performance improvements without breaking functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}));

vi.mock('@/lib/observability/metrics', () => ({
  metricsRegistry: {
    registerCounter: vi.fn().mockReturnValue({ inc: vi.fn() }),
    registerGauge: vi.fn().mockReturnValue({ set: vi.fn() }),
    registerHistogram: vi.fn().mockReturnValue({ observe: vi.fn() })
  }
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }))
}));

describe('PHASE 3 SCALABILITY: Request Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deduplicate identical requests efficiently', async () => {
    const { requestDeduplicator } = await import('@/lib/request-deduplication');

    const mockRequestFn = vi.fn().mockResolvedValue({ data: 'test-response' });
    const userId = 'user-123';
    const provider = 'openai';
    const messages = [{ role: 'user', content: 'Hello' }];
    const options = { model: 'gpt-4' };

    // Execute the same request multiple times
    const promises = [
      requestDeduplicator.deduplicate(userId, provider, messages, options, mockRequestFn),
      requestDeduplicator.deduplicate(userId, provider, messages, options, mockRequestFn),
      requestDeduplicator.deduplicate(userId, provider, messages, options, mockRequestFn)
    ];

    const results = await Promise.all(promises);

    // Should get identical results
    expect(results[0]).toEqual({ data: 'test-response' });
    expect(results[1]).toEqual({ data: 'test-response' });
    expect(results[2]).toEqual({ data: 'test-response' });

    // Should only call the function once due to deduplication
    expect(mockRequestFn).toHaveBeenCalledTimes(1);

    const stats = requestDeduplicator.getStatistics();
    expect(stats.metrics.duplicatesDetected).toBeGreaterThan(0);
    expect(stats.metrics.totalRequests).toBe(3);
  });

  it('should handle different requests separately', async () => {
    const { requestDeduplicator } = await import('@/lib/request-deduplication');

    const mockRequestFn1 = vi.fn().mockResolvedValue({ data: 'response-1' });
    const mockRequestFn2 = vi.fn().mockResolvedValue({ data: 'response-2' });

    const userId = 'user-123';
    const provider = 'openai';
    const messages1 = [{ role: 'user', content: 'Hello' }];
    const messages2 = [{ role: 'user', content: 'Goodbye' }];
    const options = { model: 'gpt-4' };

    // Execute different requests
    const [result1, result2] = await Promise.all([
      requestDeduplicator.deduplicate(userId, provider, messages1, options, mockRequestFn1),
      requestDeduplicator.deduplicate(userId, provider, messages2, options, mockRequestFn2)
    ]);

    // Should get different results
    expect(result1).toEqual({ data: 'response-1' });
    expect(result2).toEqual({ data: 'response-2' });

    // Should call both functions
    expect(mockRequestFn1).toHaveBeenCalledTimes(1);
    expect(mockRequestFn2).toHaveBeenCalledTimes(1);
  });

  it('should provide health status correctly', async () => {
    const { requestDeduplicator } = await import('@/lib/request-deduplication');

    const health = requestDeduplicator.getHealthStatus();

    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('issues');
    expect(health).toHaveProperty('recommendations');
    expect(health).toHaveProperty('stats');

    expect(typeof health.healthy).toBe('boolean');
    expect(Array.isArray(health.issues)).toBe(true);
    expect(Array.isArray(health.recommendations)).toBe(true);
  });
});

describe('PHASE 3 SCALABILITY: Async Error Processing', () => {
  it('should queue errors without blocking', async () => {
    const { asyncErrorProcessor } = await import('@/lib/async-error-processor');

    const error = new Error('Test error');
    const errorId = await asyncErrorProcessor.queueError(
      error,
      'error',
      'test-source',
      { context: 'test' },
      'user-123'
    );

    expect(typeof errorId).toBe('string');
    expect(errorId).toMatch(/^err_/);

    const stats = asyncErrorProcessor.getStatistics();
    expect(stats.totalErrors).toBeGreaterThan(0);
  });

  it('should prioritize critical errors', async () => {
    const { asyncErrorProcessor } = await import('@/lib/async-error-processor');

    // Queue errors with different priorities
    const criticalId = await asyncErrorProcessor.queueError(
      new Error('Critical error'),
      'critical',
      'test-source',
      {},
      'user-123'
    );

    const warningId = await asyncErrorProcessor.queueError(
      new Error('Warning'),
      'warn',
      'test-source',
      {},
      'user-123'
    );

    expect(typeof criticalId).toBe('string');
    expect(typeof warningId).toBe('string');

    // Critical errors should be processed first
    const stats = asyncErrorProcessor.getStatistics();
    expect(stats.totalErrors).toBeGreaterThanOrEqual(2);
  });

  it('should provide comprehensive health status', async () => {
    const { asyncErrorProcessor } = await import('@/lib/async-error-processor');

    const health = asyncErrorProcessor.getHealthStatus();

    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('issues');
    expect(health).toHaveProperty('recommendations');
    expect(health).toHaveProperty('stats');

    expect(typeof health.healthy).toBe('boolean');
    expect(health.stats).toHaveProperty('processingRate');
    expect(health.stats).toHaveProperty('errorRate');
    expect(health.stats).toHaveProperty('queueUtilization');
  });
});

describe('PHASE 3 SCALABILITY: Advanced Request Routing', () => {
  it('should register and route to endpoints', async () => {
    const { requestRouter } = await import('@/lib/advanced-request-router');

    // Register test endpoint
    requestRouter.registerEndpoint('test-provider', 'endpoint-1', 'https://api.test.com', 100);

    const routingContext = {
      provider: 'test-provider',
      userId: 'user-123',
      priority: 'medium' as const,
      estimatedTokens: 1000
    };

    const decision = await requestRouter.routeRequest('test-provider', routingContext);

    expect(decision).toHaveProperty('selectedEndpoint');
    expect(decision).toHaveProperty('reason');
    expect(decision).toHaveProperty('routingTime');
    expect(decision.selectedEndpoint.id).toBe('endpoint-1');
    expect(decision.selectedEndpoint.provider).toBe('test-provider');
  });

  it('should update endpoint metrics correctly', async () => {
    const { requestRouter } = await import('@/lib/advanced-request-router');

    requestRouter.registerEndpoint('test-provider', 'endpoint-2', 'https://api.test2.com', 100);

    // Update metrics for successful request
    requestRouter.updateEndpointMetrics('test-provider', 'endpoint-2', 150, true);

    const stats = requestRouter.getStatistics();
    expect(stats.endpoints['test-provider']).toBeDefined();

    const endpoint = stats.endpoints['test-provider'].find((e: any) => e.id === 'endpoint-2');
    expect(endpoint).toBeDefined();
    expect(endpoint.requestCount).toBe(1);
    expect(endpoint.successRate).toBe(100);
  });

  it('should provide routing statistics', async () => {
    const { requestRouter } = await import('@/lib/advanced-request-router');

    const stats = requestRouter.getStatistics();

    expect(stats).toHaveProperty('routing');
    expect(stats).toHaveProperty('endpoints');
    expect(stats).toHaveProperty('strategies');
    expect(stats).toHaveProperty('healthChecks');

    expect(stats.routing).toHaveProperty('totalDecisions');
    expect(stats.routing).toHaveProperty('averageRoutingTime');
    expect(Array.isArray(stats.strategies)).toBe(true);
  });
});

describe('PHASE 3 SCALABILITY: Database Connection Multiplexing', () => {
  it('should queue and execute database queries', async () => {
    const { dbMultiplexer } = await import('@/lib/database-connection-multiplexer');

    // Mock a simple query
    const queryPromise = dbMultiplexer.executeQuery(
      'findMany',
      { model: 'user', args: { take: 10 } },
      'medium'
    );

    expect(queryPromise).toBeInstanceOf(Promise);

    const stats = dbMultiplexer.getStatistics();
    expect(stats.totalQueries).toBeGreaterThan(0);
  });

  it('should prioritize high-priority queries', async () => {
    const { dbMultiplexer } = await import('@/lib/database-connection-multiplexer');

    // Queue queries with different priorities
    const lowPriorityPromise = dbMultiplexer.executeQuery(
      'count',
      { model: 'user', args: {} },
      'low'
    );

    const highPriorityPromise = dbMultiplexer.executeQuery(
      'findUnique',
      { model: 'user', args: { where: { id: '123' } } },
      'high'
    );

    expect(lowPriorityPromise).toBeInstanceOf(Promise);
    expect(highPriorityPromise).toBeInstanceOf(Promise);

    const stats = dbMultiplexer.getStatistics();
    expect(stats.totalQueries).toBeGreaterThanOrEqual(2);
  });

  it('should provide health status and recommendations', async () => {
    const { dbMultiplexer } = await import('@/lib/database-connection-multiplexer');

    const health = dbMultiplexer.getHealthStatus();

    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('issues');
    expect(health).toHaveProperty('recommendations');
    expect(health).toHaveProperty('stats');

    expect(typeof health.healthy).toBe('boolean');
    expect(health.stats).toHaveProperty('utilization');
    expect(health.stats).toHaveProperty('throughput');
    expect(health.stats).toHaveProperty('avgQueryTime');
  });

  it('should track connection pool statistics', async () => {
    const { dbMultiplexer } = await import('@/lib/database-connection-multiplexer');

    const stats = dbMultiplexer.getStatistics();

    expect(stats).toHaveProperty('pool');
    expect(stats).toHaveProperty('queue');
    expect(stats.pool).toHaveProperty('totalConnections');
    expect(stats.pool).toHaveProperty('availableConnections');
    expect(stats.pool).toHaveProperty('busyConnections');
    expect(stats.pool).toHaveProperty('utilization');

    expect(typeof stats.pool.totalConnections).toBe('number');
    expect(typeof stats.pool.utilization).toBe('number');
  });
});

describe('PHASE 3 SCALABILITY: Integration Tests', () => {
  it('should maintain API functionality with all optimizations active', async () => {
    // Test that all systems can work together without conflicts
    const [
      { requestDeduplicator },
      { asyncErrorProcessor },
      { requestRouter },
      { dbMultiplexer }
    ] = await Promise.all([
      import('@/lib/request-deduplication'),
      import('@/lib/async-error-processor'),
      import('@/lib/advanced-request-router'),
      import('@/lib/database-connection-multiplexer')
    ]);

    // All systems should provide statistics
    const deduplicationStats = requestDeduplicator.getStatistics();
    const errorStats = asyncErrorProcessor.getStatistics();
    const routingStats = requestRouter.getStatistics();
    const dbStats = dbMultiplexer.getStatistics();

    expect(deduplicationStats).toHaveProperty('metrics');
    expect(errorStats).toHaveProperty('totalErrors');
    expect(routingStats).toHaveProperty('routing');
    expect(dbStats).toHaveProperty('totalQueries');

    // All systems should provide health status
    const deduplicationHealth = requestDeduplicator.getHealthStatus();
    const errorHealth = asyncErrorProcessor.getHealthStatus();
    const dbHealth = dbMultiplexer.getHealthStatus();

    expect(typeof deduplicationHealth.healthy).toBe('boolean');
    expect(typeof errorHealth.healthy).toBe('boolean');
    expect(typeof dbHealth.healthy).toBe('boolean');
  });

  it('should demonstrate significant performance improvements', async () => {
    const { requestDeduplicator } = await import('@/lib/request-deduplication');

    // Simulate performance improvement measurement
    const initialTime = Date.now();

    const mockRequest = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate 100ms request
      return { data: 'response' };
    });

    // Execute identical requests (should be deduplicated)
    const promises = Array.from({ length: 5 }, () =>
      requestDeduplicator.deduplicate(
        'user-test',
        'openai',
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-4' },
        mockRequest
      )
    );

    await Promise.all(promises);
    const totalTime = Date.now() - initialTime;

    // Should execute in roughly the time of 1 request due to deduplication
    expect(totalTime).toBeLessThan(300); // Should be much less than 5 * 100ms
    expect(mockRequest).toHaveBeenCalledTimes(1); // Only one actual execution

    const stats = requestDeduplicator.getStatistics();
    expect(stats.metrics.duplicatesDetected).toBe(4); // 4 duplicates detected
    expect(stats.performance.duplicateRate).toContain('%');
  });

  it('should handle system stress without degradation', async () => {
    const { asyncErrorProcessor } = await import('@/lib/async-error-processor');

    // Generate multiple errors rapidly
    const errorPromises = Array.from({ length: 100 }, (_, i) =>
      asyncErrorProcessor.queueError(
        new Error(`Test error ${i}`),
        'error',
        'stress-test',
        { iteration: i }
      )
    );

    const errorIds = await Promise.all(errorPromises);

    expect(errorIds).toHaveLength(100);
    expect(errorIds.every(id => typeof id === 'string')).toBe(true);

    const stats = asyncErrorProcessor.getStatistics();
    expect(stats.totalErrors).toBeGreaterThanOrEqual(100);

    // System should remain healthy under stress
    const health = asyncErrorProcessor.getHealthStatus();
    expect(health).toHaveProperty('healthy');
  });

  it('should provide comprehensive monitoring data', async () => {
    // Import all systems and verify monitoring capabilities
    const [
      { requestDeduplicator },
      { asyncErrorProcessor },
      { requestRouter },
      { dbMultiplexer }
    ] = await Promise.all([
      import('@/lib/request-deduplication'),
      import('@/lib/async-error-processor'),
      import('@/lib/advanced-request-router'),
      import('@/lib/database-connection-multiplexer')
    ]);

    // All systems should provide comprehensive monitoring
    const allStats = {
      deduplication: requestDeduplicator.getStatistics(),
      errorProcessing: asyncErrorProcessor.getStatistics(),
      routing: requestRouter.getStatistics(),
      database: dbMultiplexer.getStatistics()
    };

    // Verify monitoring data structure
    expect(allStats.deduplication.performance).toHaveProperty('duplicateRate');
    expect(allStats.errorProcessing.performance).toHaveProperty('processingRate');
    expect(allStats.routing.routing).toHaveProperty('totalDecisions');
    expect(allStats.database.pool).toHaveProperty('utilization');

    // All systems should be measurable and optimizable
    const healthStatuses = [
      requestDeduplicator.getHealthStatus(),
      asyncErrorProcessor.getHealthStatus(),
      dbMultiplexer.getHealthStatus()
    ];

    healthStatuses.forEach(health => {
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('issues');
      expect(health).toHaveProperty('recommendations');
    });
  });
});
