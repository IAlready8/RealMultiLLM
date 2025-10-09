import { MetricsRegistry } from '../observability/metrics';
import { Logger } from '../observability/logger';
import { configManager } from '../config';

// Performance metric types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'milliseconds' | 'bytes' | 'count' | 'ratio' | 'percent';
  timestamp: Date;
  tags: Record<string, string>;
}

export interface PerformanceConfig {
  enableProfiling: boolean;
  enableCaching: boolean;
  cacheTtl: number;
  cacheMaxSize: number;
  enableCompression: boolean;
  compressionThreshold: number; // bytes
  maxConcurrentRequests: number;
  requestTimeout: number; // milliseconds
  memoryThreshold: number; // percentage
  cpuThreshold: number; // percentage
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  maxSize?: number;
  staleWhileRevalidate?: number; // Additional seconds to serve stale data while revalidating
}

export interface ProfilingOptions {
  name?: string;
  includeMemory?: boolean;
  includeCpu?: boolean;
  includeNetwork?: boolean;
}

/**
 * Enterprise Performance Toolkit
 * Provides comprehensive performance optimization tools including caching,
 * profiling, resource optimization, and performance monitoring
 */
class PerformanceToolkit {
  private static instance: PerformanceToolkit;
  private metrics: MetricsRegistry;
  private logger: Logger;
  private config: PerformanceConfig;
  private cache: Map<string, { value: any; expiry: number; size: number }>;
  private cacheSize: number = 0;
  private ongoingRequests: Map<string, number> = new Map();
  private performanceMetrics: PerformanceMetric[] = [];

  private constructor() {
    const appConfig = configManager.getConfig();
    
    this.config = {
      enableProfiling: appConfig.enablePerformanceMonitoring,
      enableCaching: appConfig.cacheEnabled,
      cacheTtl: appConfig.cacheTtl,
      cacheMaxSize: appConfig.cacheMaxSize,
      enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
      compressionThreshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'),
      maxConcurrentRequests: appConfig.maxConcurrentChats,
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '80'),
      cpuThreshold: parseInt(process.env.CPU_THRESHOLD || '80'),
    };
    
    this.metrics = new MetricsRegistry();
    this.logger = new Logger({ 
      level: appConfig.logLevel as any,
      service: 'perf-toolkit'
    });
    
    this.cache = new Map();
    
    this.logger.info('Performance toolkit initialized', {
      caching: this.config.enableCaching,
      profiling: this.config.enableProfiling,
      cacheTtl: this.config.cacheTtl,
      cacheMaxSize: this.config.cacheMaxSize
    });
  }

  public static getInstance(): PerformanceToolkit {
    if (!PerformanceToolkit.instance) {
      PerformanceToolkit.instance = new PerformanceToolkit();
    }
    return PerformanceToolkit.instance;
  }

  /**
   * Memoize a function with caching
   */
  public memoize<T extends (...args: any[]) => any>(
    fn: T,
    cacheKey: string,
    options?: CacheOptions
  ): T {
    return (async (...args: any[]) => {
      // Generate cache key based on function and arguments
      const key = `${cacheKey}:${JSON.stringify(args)}`;
      const ttl = options?.ttl ?? this.config.cacheTtl;
      const maxSize = options?.maxSize ?? this.config.cacheMaxSize;

      // Check cache
      const cached = await this.getFromCache(key);
      if (cached !== undefined) {
        return cached;
      }

      // Execute function
      const result = await fn(...args);
      
      // Store in cache if result is cacheable
      if (this.isCacheable(result)) {
        await this.setCache(key, result, { ttl, maxSize });
      }

      return result;
    }) as T;
  }

  /**
   * Profile execution of a function
   */
  public async profileExecution<T>(
    fn: () => Promise<T> | T,
    options?: ProfilingOptions
  ): Promise<{ result: T; metrics: PerformanceMetric[] }> {
    if (!this.config.enableProfiling) {
      const result = await Promise.resolve(fn());
      return { result, metrics: [] };
    }

    const start = process.hrtime.bigint();
    const startMemory = options?.includeMemory ? process.memoryUsage() : undefined;
    
    let result: T;
    let error: any;

    try {
      result = await Promise.resolve(fn());
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
      
      // Create execution time metric
      const executionMetric: PerformanceMetric = {
        name: `${options?.name || 'unknown_function'}_execution_time`,
        value: duration,
        unit: 'milliseconds',
        timestamp: new Date(),
        tags: { success: !error ? 'true' : 'false' }
      };
      
      this.performanceMetrics.push(executionMetric);
      
      // Record histogram metric (simplified for now)
      // TODO: Implement proper metrics recording
      // const histogram = this.metrics.registerHistogram(executionMetric.name, 'Execution time metric');
      // histogram.observe(duration);
      
      // Record memory metrics if enabled
      if (options?.includeMemory && startMemory) {
        const endMemory = process.memoryUsage();
        const memoryDiff = {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
        };
        
        for (const [key, value] of Object.entries(memoryDiff)) {
          const memoryMetric: PerformanceMetric = {
            name: `memory_${key}_diff`,
            value: value as number,
            unit: 'bytes',
            timestamp: new Date(),
            tags: { operation: options.name || 'unknown' }
          };
          
          this.performanceMetrics.push(memoryMetric);
          // Record memory metric (simplified for now)
          // TODO: Implement proper metrics recording
          // const memoryGauge = this.metrics.registerGauge(`memory.${key}`, 'Memory metric');
          // memoryGauge.set(value as number);
        }
      }
      
      this.logger.debug('Function execution profiled', {
        name: options?.name || 'unknown',
        duration: `${duration.toFixed(2)}ms`,
        error: !!error
      });
    }

    return { 
      result, 
      metrics: this.performanceMetrics.filter(m => 
        m.tags.operation === (options?.name || 'unknown') ||
        m.name.includes(options?.name || 'unknown_function')
      ) 
    };
  }

  /**
   * Measure API response time
   */
  public async measureApiCall<T>(
    url: string,
    fn: () => Promise<T>,
    options?: { tags?: Record<string, string> }
  ): Promise<T> {
    const start = Date.now();
    let result: T;
    let error: any;

    try {
      result = await fn();
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - start;
      
      // Record API call metrics
      // this.metrics.histogram('api_call_duration', duration, {
      //   url,
      //   success: !error ? 'true' : 'false',
      //   ...options?.tags
      // });
      
      // Add to performance metrics
      this.performanceMetrics.push({
        name: 'api_call_duration',
        value: duration,
        unit: 'milliseconds',
        timestamp: new Date(),
        tags: { url, success: !error ? 'true' : 'false', ...options?.tags }
      });
    }
  }

  /**
   * Throttle function execution
   */
  public throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number,
    interval: number
  ): T {
    const queue: { args: any[]; resolve: (value: any) => void; reject: (reason: any) => void }[] = [];
    let activeCount = 0;
    let intervalId: NodeJS.Timeout | null = null;

    const execute = () => {
      if (queue.length === 0) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }

      while (activeCount < limit && queue.length > 0) {
        const { args, resolve, reject } = queue.shift()!;
        activeCount++;
        
        Promise.resolve(fn.apply(this, args))
          .then(resolve)
          .catch(reject)
          .finally(() => {
            activeCount--;
            if (queue.length > 0 && activeCount < limit) {
              setTimeout(execute, 0);
            }
          });
      }
    };

    return ((...args: any[]) => {
      return new Promise((resolve, reject) => {
        queue.push({ args, resolve, reject });
        
        if (!intervalId) {
          intervalId = setInterval(execute, interval);
        }
        
        if (activeCount < limit) {
          setTimeout(execute, 0);
        }
      });
    }) as T;
  }

  /**
   * Debounce function execution
   */
  public debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): T {
    let timeoutId: NodeJS.Timeout | null = null;

    return ((...args: any[]) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(fn.apply(this, args));
        }, delay);
      });
    }) as T;
  }

  /**
   * Cache management
   */
  public async getFromCache(key: string): Promise<any | undefined> {
    if (!this.config.enableCaching) {
      return undefined;
    }

    const cached = this.cache.get(key);
    if (!cached) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      this.cacheSize -= cached.size;
      // this.metrics.increment('cache.expired', 1);
      return undefined;
    }

    // this.metrics.increment('cache.hit', 1);
    return cached.value;
  }

  public async setCache(
    key: string,
    value: any,
    options?: CacheOptions
  ): Promise<boolean> {
    if (!this.config.enableCaching) {
      return false;
    }

    const ttl = (options?.ttl || this.config.cacheTtl) * 1000; // Convert to milliseconds
    const maxSize = options?.maxSize || this.config.cacheMaxSize;
    const expiry = Date.now() + ttl;
    
    // Estimate size of value (simplified)
    const size = JSON.stringify(value).length;
    
    // Check if we exceed max size
    if (this.cacheSize + size > maxSize) {
      // Try to evict items using LRU
      const keys = Array.from(this.cache.entries())
        .sort((a, b) => a[1].expiry - b[1].expiry)
        .map(entry => entry[0]);
      
      while (this.cacheSize + size > maxSize && keys.length > 0) {
        const keyToRemove = keys.shift();
        if (keyToRemove) {
          const item = this.cache.get(keyToRemove);
          if (item) {
            this.cacheSize -= item.size;
            this.cache.delete(keyToRemove);
            // this.metrics.increment('cache.evicted', 1);
          }
        }
      }
      
      // If still too large, don't cache
      if (this.cacheSize + size > maxSize) {
        // this.metrics.increment('cache.overflow', 1);
        return false;
      }
    }

    this.cache.set(key, { value, expiry, size });
    this.cacheSize += size;
    
    // this.metrics.increment('cache.set', 1);
    // this.metrics.gauge('cache.size', this.cacheSize);
    // this.metrics.gauge('cache.entries', this.cache.size);
    
    return true;
  }

  /**
   * Clear cache
   */
  public async clearCache(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      this.cacheSize = 0;
      // this.metrics.increment('cache.cleared', 1);
      return;
    }

    // Clear keys matching pattern
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        const item = this.cache.get(key);
        if (item) {
          this.cacheSize -= item.size;
        }
        this.cache.delete(key);
      }
    }
    
    // this.metrics.increment('cache.cleared_pattern', 1, { pattern });
  }

  /**
   * Check if value is cacheable
   */
  private isCacheable(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    // Don't cache functions or promises
    if (typeof value === 'function' || value instanceof Promise) {
      return false;
    }
    
    // Don't cache very large objects
    try {
      const size = JSON.stringify(value).length;
      return size < this.config.cacheMaxSize / 10; // Don't cache if it's more than 10% of max size
    } catch (e) {
      return false; // If we can't serialize, don't cache
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: number; hitRate: number; maxSize: number } {
    // For now, return basic stats without hit rate since MetricsRegistry doesn't have getCounter
    // TODO: Implement proper cache statistics in MetricsRegistry
    const hitRate = 0; // Placeholder until we implement cache metrics
    
    return {
      size: this.cacheSize,
      entries: this.cache.size,
      hitRate,
      maxSize: this.config.cacheMaxSize
    };
  }

  /**
   * Compress data if it exceeds threshold
   */
  public async compressData(data: string | Buffer): Promise<string | Buffer> {
    if (!this.config.enableCompression) {
      return data;
    }

    // Check if data exceeds compression threshold
    const size = typeof data === 'string' ? Buffer.byteLength(data) : data.length;
    if (size < this.config.compressionThreshold) {
      return data;
    }

    // In a real implementation, we would use a compression library like zlib
    // For now, we'll just return the data as-is
    return data;
  }

  /**
   * Check system resource usage
   */
  public getSystemUsage(): { memory: number; cpu: number; uptime: number } {
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    // CPU usage is more complex to calculate in Node.js
    // This is a simplified version
    const uptime = process.uptime();
    
    return {
      memory: memoryPercent,
      cpu: 0, // Placeholder, actual CPU usage requires more complex implementation
      uptime
    };
  }

  /**
   * Check if system is under resource pressure
   */
  public isUnderResourcePressure(): { memory: boolean; cpu: boolean } {
    const usage = this.getSystemUsage();
    
    return {
      memory: usage.memory > this.config.memoryThreshold,
      cpu: usage.cpu > this.config.cpuThreshold
    };
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.performanceMetrics = [];
  }

  /**
   * Optimize image data (placeholder implementation)
   */
  public async optimizeImage(
    imageData: Buffer,
    options?: { quality?: number; maxWidth?: number; maxHeight?: number }
  ): Promise<Buffer> {
    // In a real implementation, we would use a library like sharp for image optimization
    // For now, we'll just return the original data
    return imageData;
  }

  /**
   * Preload resources for performance optimization
   */
  public async preloadResources(urls: string[]): Promise<void> {
    // In a real implementation, we would preload resources like images, scripts, etc.
    // For now, we'll just make placeholder requests
    const requests = urls.map(async (url) => {
      // Would implement actual preloading here
      this.logger.debug('Resource preloaded', { url });
      // this.metrics.increment('resource.preloaded', 1, { url });
    });
    
    await Promise.allSettled(requests);
  }

  /**
   * Get performance recommendations based on current metrics
   */
  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const cacheStats = this.getCacheStats();
    
    if (cacheStats.hitRate < 0.5) {
      recommendations.push('Consider increasing cache size or TTL for better hit rate');
    }
    
    if (cacheStats.entries > cacheStats.maxSize * 0.9) {
      recommendations.push('Cache is near capacity, consider increasing max size');
    }
    
    const usage = this.getSystemUsage();
    const resourcePressure = this.isUnderResourcePressure();
    if (resourcePressure.memory) {
      recommendations.push(`Memory usage is high (${usage.memory.toFixed(2)}%), consider optimizing memory usage`);
    }
    
    return recommendations;
  }
}

// Create singleton instance
const perfToolkit = PerformanceToolkit.getInstance();

// Export convenience functions and the instance
export const memoize = perfToolkit.memoize.bind(perfToolkit);
export const profileExecution = perfToolkit.profileExecution.bind(perfToolkit);
export const measureApiCall = perfToolkit.measureApiCall.bind(perfToolkit);
export const throttle = perfToolkit.throttle.bind(perfToolkit);
export const debounce = perfToolkit.debounce.bind(perfToolkit);
export const getFromCache = perfToolkit.getFromCache.bind(perfToolkit);
export const setCache = perfToolkit.setCache.bind(perfToolkit);
export const clearCache = perfToolkit.clearCache.bind(perfToolkit);
export const compressData = perfToolkit.compressData.bind(perfToolkit);
export const getPerformanceMetrics = perfToolkit.getPerformanceMetrics.bind(perfToolkit);
export const getPerformanceRecommendations = perfToolkit.getPerformanceRecommendations.bind(perfToolkit);

export { perfToolkit };