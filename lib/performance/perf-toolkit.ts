import { logger } from '../logger';
import { enterpriseConfigManager } from '../config';
import { env } from '../env';
import { telemetryService, recordCacheMetrics } from '../observability/telemetry';
import { z } from 'zod';

// Performance metric types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  timestamp: number;
  duration: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    network: number;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictionCount: number;
}

// Cache interface
export interface Cache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  keys(): K[];
  values(): V[];
  size: number;
  stats: CacheStats;
  ttl?: number;
}

// Performance monitoring configuration
export interface PerformanceConfig {
  monitoring: {
    enabled: boolean;
    samplingRate: number; // 0-1
    metricsEndpoint?: string;
  };
  caching: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number; // bytes
    storage: 'memory' | 'redis' | 'vercel-kv';
  };
  resourceLimits: {
    maxConcurrentRequests: number;
    requestTimeoutMs: number;
    memoryLimitMB: number;
  };
}

// Default performance configuration
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  monitoring: {
    enabled: false,
    samplingRate: 1.0,
  },
  caching: {
    enabled: true,
    ttl: 3600, // 1 hour
    maxSize: 100 * 1024 * 1024, // 100MB
    storage: 'memory',
  },
  resourceLimits: {
    maxConcurrentRequests: 100,
    requestTimeoutMs: 30000,
    memoryLimitMB: 1024,
  },
};

// Memory-based LRU cache implementation
export class LRUCache<K, V> implements Cache<K, V> {
  private cache: Map<K, { value: V; timestamp: number; size: number }>;
  private ttl: number; // Time-to-live in seconds
  private maxSize: number; // Maximum size in bytes
  private _stats: CacheStats;

  constructor(ttl: number, maxSize: number) {
    this.cache = new Map();
    this.ttl = ttl * 1000; // Convert to milliseconds
    this.maxSize = maxSize;
    this._stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize,
      evictionCount: 0,
    };
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) {
      this._stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      this._stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Move to end to mark as recently used
    this.cache.delete(key);
    this.cache.set(key, item);

    this._stats.hits++;
    this.updateHitRate();
    return item.value;
  }

  set(key: K, value: V): void {
    const serializedValue = JSON.stringify(value);
    const size = new Blob([serializedValue]).size;

    // If adding this item exceeds max size, evict items
    if (size > this.maxSize) {
      // Clear entire cache if single item is too large
      this.cache.clear();
      this._stats.size = 0;
      this._stats.evictionCount++;
      return;
    }

    // Evict items if size limit would be exceeded
    while (this._stats.size + size > this.maxSize && this.cache.size > 0) {
      // Evict the first item (oldest) if it's a Map, or just clear if needed
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        const item = this.cache.get(firstKey)!;
        this.cache.delete(firstKey);
        this._stats.size -= item.size;
        this._stats.evictionCount++;
      }
    }

    // Remove expired entries
    this.cleanupExpired();

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      size,
    });

    this._stats.size += size;
  }

  has(key: K): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    this.cache.delete(key);
    this._stats.size -= item.size;
    return true;
  }

  clear(): void {
    this.cache.clear();
    this._stats.hits = 0;
    this._stats.misses = 0;
    this._stats.hitRate = 0;
    this._stats.size = 0;
    this._stats.evictionCount = 0;
  }

  keys(): K[] {
    this.cleanupExpired();
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    this.cleanupExpired();
    return Array.from(this.cache.values()).map(item => item.value);
  }

  get size(): number {
    return this.cache.size;
  }

  get stats(): CacheStats {
    this.cleanupExpired();
    return { ...this._stats };
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        this._stats.size -= item.size;
      }
    }
  }

  private updateHitRate(): void {
    const total = this._stats.hits + this._stats.misses;
    this._stats.hitRate = total > 0 ? this._stats.hits / total : 0;
  }
}

// Performance monitoring service
export class PerformanceMonitorService {
  private config: PerformanceConfig;
  private cache: Cache<string, any>;
  private metricsBuffer: PerformanceMetric[] = [];
  private readonly maxBufferSize: number = 1000;
  private samplingEnabled: boolean = true;

  constructor() {
    this.config = DEFAULT_PERFORMANCE_CONFIG;
    this.cache = new LRUCache<string, any>(
      this.config.caching.ttl,
      this.config.caching.maxSize
    );
  }

  // Initialize with enterprise configuration
  async initialize(): Promise<void> {
    const enterpriseConfig = await enterpriseConfigManager.getEnterpriseConfig();
    
    // Update config based on enterprise settings
    this.config = {
      monitoring: {
        enabled: enterpriseConfig.performance.monitoring.enabled,
        samplingRate: enterpriseConfig.performance.monitoring.sampleRate,
        metricsEndpoint: enterpriseConfig.performance.monitoring.metricsEndpoint || undefined,
      },
      caching: {
        enabled: enterpriseConfig.performance.caching.enabled,
        ttl: enterpriseConfig.performance.caching.ttlSeconds,
        maxSize: enterpriseConfig.performance.caching.maxSize,
        storage: enterpriseConfig.performance.caching.storage,
      },
      resourceLimits: {
        maxConcurrentRequests: enterpriseConfig.performance.resourceLimits.maxConcurrentRequests,
        requestTimeoutMs: enterpriseConfig.performance.resourceLimits.requestTimeoutMs,
        memoryLimitMB: enterpriseConfig.performance.resourceLimits.memoryLimitMB,
      },
    };

    // Reinitialize cache with new settings
    if (this.config.caching.storage === 'memory') {
      this.cache = new LRUCache<string, any>(
        this.config.caching.ttl,
        this.config.caching.maxSize
      );
    }

    this.samplingEnabled = Math.random() < this.config.monitoring.samplingRate;
  }

  // Record a performance metric
  recordMetric(name: string, value: number, unit: string = 'count', labels?: Record<string, string>): void {
    if (!this.config.monitoring.enabled || !this.samplingEnabled) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      labels,
    };

    this.metricsBuffer.push(metric);

    // Send immediately if buffer is full
    if (this.metricsBuffer.length >= this.maxBufferSize) {
      void this.flushMetrics();
    }
  }

  // Flush metrics to storage
  async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // In a real implementation, you'd send metrics to a monitoring service
      // For now, we'll just use the telemetry service
      for (const metric of metricsToSend) {
        telemetryService.recordMetric(
          metric.name,
          metric.value,
          metric.unit === 'timer' ? 'timer' : 
          metric.unit === 'gauge' ? 'gauge' : 'counter',
          metric.labels
        );
      }

      logger.info('Performance metrics flushed', { count: metricsToSend.length });
    } catch (error) {
      logger.error('Failed to flush performance metrics', { error });
      // Add metrics back to buffer for next flush attempt
      this.metricsBuffer = [...metricsToSend, ...this.metricsBuffer];
    }
  }

  // Get cache instance
  getCache(): Cache<string, any> {
    return this.cache;
  }

  // Get performance report
  async getPerformanceReport(): Promise<PerformanceReport> {
    const startTime = Date.now();
    
    // Collect resource usage metrics
    let memoryUsage = 0;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      memoryUsage = usage.heapUsed / 1024 / 1024; // Convert to MB
    }

    const report: PerformanceReport = {
      metrics: [...this.metricsBuffer],
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      resourceUsage: {
        memory: memoryUsage,
        cpu: 0, // Would require additional libraries to measure
        network: 0, // Would require additional measurement
      },
    };

    return report;
  }

  // Monitor function execution time
  async monitorFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    let result: T;
    let error: any = null;

    try {
      result = await fn();
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = performance.now() - startTime;

      // Record timing metric
      this.recordMetric(`${name}.execution_time`, duration, 'milliseconds');

      // Record error metric if applicable
      if (error) {
        this.recordMetric(`${name}.execution_error`, 1, 'count');
      }

      // Log slow functions (over 1 second)
      if (duration > 1000) {
        logger.warn(`Slow function execution`, {
          name,
          duration: `${duration.toFixed(2)}ms`,
        });
      }
    }

    return result!;
  }

  // Monitor database query performance
  async monitorDatabaseQuery<T>(
    operation: string,
    entity: string,
    query: () => Promise<T>
  ): Promise<T> {
    const name = `db.${operation}.${entity}`;
    return this.monitorFunction(name, query);
  }

  // Monitor API call performance
  async monitorApiCall<T>(
    endpoint: string,
    provider: string | null,
    call: () => Promise<T>
  ): Promise<T> {
    const name = provider ? `api.${endpoint}.${provider}` : `api.${endpoint}`;
    return this.monitorFunction(name, call);
  }

  // Monitor provider call performance
  async monitorProviderCall<T>(
    provider: string,
    model: string,
    call: () => Promise<T>
  ): Promise<T> {
    const name = `provider.${provider}.${model}`;
    return this.monitorFunction(name, call);
  }

  // Get cache statistics
  getCacheStats(): CacheStats {
    return this.cache.stats;
  }

  // Warm up cache with initial data
  async warmCache(items: Array<{ key: string; value: any }>): Promise<void> {
    for (const item of items) {
      this.cache.set(item.key, item.value);
    }
  }

  // Health check for performance monitoring
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const cacheStats = this.getCacheStats();
      const report = await this.getPerformanceReport();

      const details = {
        monitoring: this.config.monitoring.enabled,
        caching: this.config.caching.enabled,
        cacheHitRate: cacheStats.hitRate,
        cacheSize: cacheStats.size,
        metricsBuffered: this.metricsBuffer.length,
        resourceUsage: report.resourceUsage,
      };

      // Consider degraded if cache hit rate is too low or buffer is full
      if (cacheStats.hitRate < 0.5 || this.metricsBuffer.length >= this.maxBufferSize) {
        return { status: 'degraded', details };
      }

      return { status: 'healthy', details };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
        },
      };
    }
  }

  // Shutdown service
  async shutdown(): Promise<void> {
    await this.flushMetrics();
  }
}

// Singleton instance of performance monitor service
export const performanceMonitor = new PerformanceMonitorService();

// Initialize the performance monitor
void performanceMonitor.initialize();

// Performance utilities
export class PerformanceUtils {
  // Memoize function results
  static memoize<T extends (...args: any[]) => any>(fn: T, cacheKeyFn?: (...args: Parameters<T>) => string): T {
    const cache = new Map<string, any>();

    return function (...args: Parameters<T>): any {
      const key = cacheKeyFn ? cacheKeyFn(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = fn.apply(this, args);
      cache.set(key, result);
      return result;
    } as T;
  }

  // Debounce function execution
  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return new Promise((resolve) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(async () => {
          const result = await fn.apply(this, args);
          resolve(result);
        }, delay);
      });
    };
  }

  // Throttle function execution
  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number // executions per interval
  ): T {
    let lastExecTime = 0;
    let queue: Array<() => void> = [];
    let execCount = 0;
    const interval = 1000; // 1 second window

    const execute = () => {
      if (queue.length > 0) {
        const now = Date.now();
        if (now - lastExecTime >= interval) {
          execCount = 0;
          lastExecTime = now;
        }

        if (execCount < limit) {
          execCount++;
          queue.shift()?.();
        }
      }
    };

    return function (...args: Parameters<T>): any {
      return new Promise((resolve) => {
        queue.push(() => {
          const result = fn.apply(this, args);
          resolve(result);
        });
        execute();
      });
    } as T;
  }

  // Run function with timeout
  static async withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Function timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  // Limit concurrent execution
  static async limitConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    limit: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<any>[] = [];

    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
        executing.splice(executing.indexOf(promise), 1);
      });

      executing.push(promise);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  // Get memory usage in MB
  static getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed / 1024 / 1024;
    }
    return 0;
  }

  // Estimate object size in bytes
  static estimateSize(obj: any): number {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  }

  // Check if running under memory pressure
  static isMemoryPressureHigh(): boolean {
    const usage = PerformanceUtils.getMemoryUsage();
    const limit = env.PERFORMANCE_MEMORY_LIMIT_MB || 
                  1024; // Default to 1GB
    return usage > limit * 0.8; // 80% of limit
  }

  // Run garbage collection if available
  static runGarbageCollection(): void {
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    }
  }

  // Optimize array operations
  static optimizedArrayOperations<T>(arr: T[], operations: Array<(item: T) => T>): T[] {
    // Instead of applying each operation to the entire array,
    // apply all operations to each item (more efficient for large arrays with many operations)
    return arr.map(item => {
      let result = item;
      for (const op of operations) {
        result = op(result);
      }
      return result;
    });
  }

  // Batch process items with backpressure
  static async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10,
    delayBetweenBatches: number = 10 // ms
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);

      // Add delay between batches to prevent overwhelming the system
      if (delayBetweenBatches > 0 && i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }

  // Detect performance bottlenecks in async code
  static async detectPerformanceBottlenecks<T>(
    operations: Array<{ name: string; fn: () => Promise<T> }>
  ): Promise<Array<{ name: string; duration: number; result: T }>> {
    const results = await Promise.all(
      operations.map(async ({ name, fn }) => {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        return { name, duration: end - start, result };
      })
    );

    // Log operations that take more than 500ms
    results.forEach(({ name, duration }) => {
      if (duration > 500) {
        logger.warn('Slow operation detected', { name, duration: `${duration.toFixed(2)}ms` });
      }
    });

    return results;
  }
}

// Export performance utilities
export { PerformanceUtils as performanceUtils };

// Cache decorator for class methods
export function cached(ttlSeconds: number = 3600, maxCacheSize: number = 100 * 1024 * 1024) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new LRUCache<string, any>(ttlSeconds, maxCacheSize);

    descriptor.value = async function (...args: any[]) {
      // Create a cache key based on method name and arguments
      const cacheKey = `${target.constructor.name}.${propertyKey}(${JSON.stringify(args)})`;

      // Check if result is in cache
      const cachedResult = cache.get(cacheKey);
      if (cachedResult !== undefined) {
        // Record cache hit metric
        recordCacheMetrics('get', cacheKey, true, 0);
        return cachedResult;
      }

      // Execute the original method
      const result = await originalMethod.apply(this, args);

      // Store result in cache
      cache.set(cacheKey, result);
      
      // Record cache miss metric
      recordCacheMetrics('set', cacheKey, false, 0);

      return result;
    };

    return descriptor;
  };
}

// Performance monitoring decorator
export function monitored(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const metricName = name || `${target.constructor.name}.${propertyKey}`;

      const start = performance.now();
      let result: any;
      let error: any;

      try {
        result = await originalMethod.apply(this, args);
        return result;
      } catch (err) {
        error = err;
        throw err;
      } finally {
        const duration = performance.now() - start;

        // Record performance metrics
        performanceMonitor.recordMetric(`${metricName}.duration`, duration, 'milliseconds');
        performanceMonitor.recordMetric(`${metricName}.calls`, 1, 'count');

        if (error) {
          performanceMonitor.recordMetric(`${metricName}.errors`, 1, 'count');
        }
      }
    };

    return descriptor;
  };
}

// Rate limiting decorator
export function rateLimit(maxRequests: number, windowMs: number) {
  const limiter = new Map<string, { count: number; resetTime: number }>();

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // In a real implementation, we'd identify the caller (e.g., by IP, user ID, etc.)
      // For now, we'll use a simple identifier
      const identifier = `${target.constructor.name}.${propertyKey}`;
      const now = Date.now();
      const record = limiter.get(identifier);

      if (!record || now > record.resetTime) {
        // New window, reset counter
        limiter.set(identifier, {
          count: 1,
          resetTime: now + windowMs,
        });
      } else {
        if (record.count >= maxRequests) {
          throw new Error(`Rate limit exceeded for ${propertyKey}`);
        }
        // Increment count
        limiter.set(identifier, {
          count: record.count + 1,
          resetTime: record.resetTime,
        });
      }

      return await originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Performance configuration schema for validation
export const performanceConfigSchema = z.object({
  monitoring: z.object({
    enabled: z.boolean(),
    samplingRate: z.number().min(0).max(1),
    metricsEndpoint: z.string().url().optional(),
  }),
  caching: z.object({
    enabled: z.boolean(),
    ttl: z.number().min(60), // At least 1 minute
    maxSize: z.number().min(1024 * 1024), // At least 1MB
    storage: z.enum(['memory', 'redis', 'vercel-kv']),
  }),
  resourceLimits: z.object({
    maxConcurrentRequests: z.number().min(1),
    requestTimeoutMs: z.number().min(1000),
    memoryLimitMB: z.number().min(128),
  },
  ),
});

// Validate performance configuration
export function validatePerformanceConfig(config: any): { valid: boolean; errors?: string[] } {
  const result = performanceConfigSchema.safeParse(config);
  
  if (result.success) {
    return { valid: true };
  } else {
    const errors = result.error.errors.map(e => e.message);
    return { valid: false, errors };
  }
}

// Function to get current performance configuration
export async function getCurrentPerformanceConfig(): Promise<PerformanceConfig> {
  return performanceMonitor['config'] || DEFAULT_PERFORMANCE_CONFIG;
}