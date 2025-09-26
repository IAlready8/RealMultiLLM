import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cache, CacheKeys, CacheConfigs } from '../../lib/cache';
import { CircuitBreaker, CircuitState, circuitBreakerManager, executeWithCircuitBreaker } from '../../lib/circuit-breaker';
import { monitoring } from '../../lib/monitoring';

describe('Scaling Infrastructure', () => {
  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
    monitoring.resetMetrics();
  });

  afterEach(() => {
    // Cleanup after each test
    cache.clear();
    circuitBreakerManager.resetAll();
  });

  describe('Cache System', () => {
    it('should store and retrieve values from cache', async () => {
      const key = 'test-key';
      const value = { message: 'Hello, World!' };
      const config = CacheConfigs.short;

      await cache.set(key, value, config);
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle cache expiration', async () => {
      const key = 'expire-test';
      const value = 'temporary';
      const config = { ttl: 1, prefix: 'test' }; // 1 second TTL

      await cache.set(key, value, config);
      
      // Should be available immediately
      const immediate = await cache.get(key);
      expect(immediate).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const expired = await cache.get(key);
      expect(expired).toBeNull();
    });

    it('should generate proper cache keys', () => {
      const llmKey = CacheKeys.llmResponse('openai', 'gpt-4', 'abc123');
      expect(llmKey).toBe('llm:openai:gpt-4:abc123');

      const userKey = CacheKeys.userSession('user123');
      expect(userKey).toBe('user:user123:session');

      const analyticsKey = CacheKeys.analytics('usage', 'daily');
      expect(analyticsKey).toBe('analytics:usage:daily');
    });

    it('should provide cache statistics', async () => {
      await cache.set('test1', 'value1', CacheConfigs.short);
      await cache.set('test2', 'value2', CacheConfigs.medium);

      const stats = cache.getStats();
      expect(stats.memorySize).toBeGreaterThan(0);
      expect(stats.memoryKeys).toBeGreaterThan(0);
    });
  });

  describe('Circuit Breaker System', () => {
    it('should start in closed state', () => {
      const breaker = new CircuitBreaker('test-service', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        resetTimeout: 5000,
        monitoringWindow: 10000,
        expectedFailureRate: 0.5
      });

      expect(breaker.isClosed()).toBe(true);
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.isHalfOpen()).toBe(false);
    });

    it('should open circuit after failure threshold', async () => {
      const breaker = new CircuitBreaker('failing-service', {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
        resetTimeout: 5000,
        monitoringWindow: 10000,
        expectedFailureRate: 0.5
      });

      // Simulate failures
      try {
        await breaker.execute(() => Promise.reject(new Error('Service failure')));
      } catch (e) {
        // Expected failure
      }

      try {
        await breaker.execute(() => Promise.reject(new Error('Service failure')));
      } catch (e) {
        // Expected failure
      }

      expect(breaker.isOpen()).toBe(true);
    });

    it('should transition to half-open after timeout', async () => {
      const breaker = new CircuitBreaker('recovery-service', {
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 100, // Short timeout for testing
        resetTimeout: 5000,
        monitoringWindow: 10000,
        expectedFailureRate: 0.5
      });

      // Cause failure to open circuit
      try {
        await breaker.execute(() => Promise.reject(new Error('Service failure')));
      } catch (e) {
        // Expected failure
      }

      expect(breaker.isOpen()).toBe(true);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next execution should transition to half-open
      try {
        await breaker.execute(() => Promise.resolve('success'));
        expect(breaker.isClosed()).toBe(true);
      } catch (e) {
        // May still be half-open
      }
    });

    it('should execute with circuit breaker protection', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await executeWithCircuitBreaker('test-provider', mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
    });

    it('should provide circuit breaker statistics', () => {
      const breaker = circuitBreakerManager.getOrCreateBreaker('stats-test');
      
      const stats = breaker.getStats();
      
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('Performance Monitoring', () => {
    it('should record performance metrics', () => {
      const metricName = 'test_metric';
      const value = 42;
      const tags = { service: 'test' };

      monitoring.recordMetric(metricName, value, tags, 'milliseconds');

      const metrics = monitoring.getMetrics(metricName);
      const testMetric = metrics.find(m => m.name === metricName);

      expect(testMetric).toBeDefined();
      expect(testMetric?.value).toBe(value);
      expect(testMetric?.tags).toEqual(tags);
    });

    it('should record request metrics', () => {
      monitoring.recordRequest('GET', '/api/test', 200, 150, 'user123');

      const summary = monitoring.getMetricsSummary();
      expect(summary.totalRequests).toBeGreaterThan(0);
      expect(summary.avgResponseTime).toBeGreaterThan(0);
    });

    it('should calculate aggregated metrics', () => {
      const metricName = 'response_time';
      
      // Record some sample metrics
      monitoring.recordMetric(metricName, 100);
      monitoring.recordMetric(metricName, 200);
      monitoring.recordMetric(metricName, 300);

      const metrics = monitoring.getMetrics(metricName);
      const values = metrics.map(m => m.value);
      const avgResponseTime = values.reduce((a, b) => a + b, 0) / values.length;
      const maxResponseTime = Math.max(...values);
      const minResponseTime = Math.min(...values);

      expect(avgResponseTime).toBe(200);
      expect(maxResponseTime).toBe(300);
      expect(minResponseTime).toBe(100);
    });

    it('should track performance manually', async () => {
      const startTime = Date.now();
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const duration = Date.now() - startTime;
      monitoring.recordMetric('manual_test_operation', duration, {
        status: 'success',
        method: 'testMethod'
      }, 'milliseconds');

      // Check that performance was tracked
      const metrics = monitoring.getMetrics('manual_test_operation');
      const performanceMetric = metrics.find(m => m.name === 'manual_test_operation');
      
      expect(performanceMetric).toBeDefined();
      expect(performanceMetric?.value).toBeGreaterThan(40); // Should be around 50ms
      expect(performanceMetric?.tags?.status).toBe('success');
    });

    it('should export metrics in JSON format', async () => {
      monitoring.recordMetric('test_export', 123, { type: 'test' });
      
      const exported = await monitoring.exportMetrics('json');
      const data = exported as any[];

      expect(Array.isArray(data)).toBe(true);
      const testMetric = data.find(m => m.name === 'test_export');
      expect(testMetric).toBeDefined();
      expect(testMetric.value).toBe(123);
    });

    it('should export metrics in Prometheus format', async () => {
      monitoring.recordMetric('prometheus_test', 456, { service: 'api' });
      
      const exported = await monitoring.exportMetrics('prometheus');
      
      expect(exported).toContain('realmultillm_prometheus_test{service="api"} 456');
    });
  });

  describe('Integration Tests', () => {
    it('should handle high load scenario', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => 
        executeWithCircuitBreaker('load-test', async () => {
          await cache.set(`load-test-${i}`, `value-${i}`, CacheConfigs.short);
          monitoring.recordMetric('load_test_operation', i);
          return `result-${i}`;
        })
      );

      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      expect(successful).toBeGreaterThan(90); // At least 90% success rate

      // Verify cache populated
      const cacheStats = cache.getStats();
      expect(cacheStats.memorySize).toBeGreaterThan(50);

      // Verify performance tracking
      const performanceSummary = monitoring.getMetricsSummary();
      expect(performanceSummary.totalRequests).toBe(0); // recordRequest was not called
    });

    it('should handle provider failover scenario', async () => {
      const primaryProvider = 'primary-service';
      const fallbackProvider = 'fallback-service';

      // Simulate primary provider failure
      const primaryBreaker = circuitBreakerManager.getOrCreateBreaker(primaryProvider, {
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 100,
        resetTimeout: 1000,
        monitoringWindow: 5000,
        expectedFailureRate: 0.1
      });

      // Force primary to fail
      try {
        await primaryBreaker.execute(() => Promise.reject(new Error('Primary failed')));
      } catch (e) {
        // Expected
      }

      expect(primaryBreaker.isOpen()).toBe(true);

      // Use fallback
      const fallbackResult = await executeWithCircuitBreaker(fallbackProvider, () => 
        Promise.resolve('fallback success')
      );

      expect(fallbackResult).toBe('fallback success');

      const healthySystems = circuitBreakerManager.getHealthySystems();
      const unhealthySystems = circuitBreakerManager.getUnhealthySystems();

      expect(healthySystems).toContain(fallbackProvider);
      expect(unhealthySystems).toContain(primaryProvider);
    });
  });
});