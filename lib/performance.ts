// Performance Monitoring for Vercel Deployment
// This file provides performance monitoring and optimization utilities for RealMultiLLM

// Performance measurement utility
export class PerformanceMonitor {
  private measures: Map<string, { start: number; end?: number; }> = new Map();
  
  start(name: string) {
    this.measures.set(name, { start: performance.now() });
  }
  
  end(name: string) {
    const measure = this.measures.get(name);
    if (!measure) {
      console.warn(`Performance measure "${name}" not started`);
      return null;
    }
    
    measure.end = performance.now();
    const duration = measure.end - measure.start;
    
    // In production, send metrics to analytics service
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ANALYTICS === 'true') {
      this.sendMetrics(name, duration);
    }
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
  
  private sendMetrics(name: string, duration: number) {
    // Send metrics to analytics service
    // This would typically send to a service like Vercel Analytics, Datadog, etc.
    // For now, we'll just console.log which Vercel will capture
    console.log(`[PERFORMANCE] ${name}: ${duration.toFixed(2)}ms`);
  }
  
  // Get all measures for reporting
  getMeasures() {
    return Array.from(this.measures.entries()).map(([name, measure]) => ({
      name,
      duration: measure.end ? measure.end! - measure.start : null,
      completed: !!measure.end
    }));
  }
}

// API Performance Tracker
export class ApiPerformanceTracker {
  private monitor: PerformanceMonitor;
  
  constructor() {
    this.monitor = new PerformanceMonitor();
  }
  
  trackApiCall(endpoint: string, provider?: string) {
    const key = provider ? `${endpoint}-${provider}` : endpoint;
    this.monitor.start(key);
    
    return () => {
      return this.monitor.end(key);
    };
  }
  
  trackDatabaseQuery(queryType: string, entity: string) {
    const key = `db-${queryType}-${entity}`;
    this.monitor.start(key);
    
    return () => {
      return this.monitor.end(key);
    };
  }
  
  trackProviderCall(provider: string, model: string) {
    const key = `provider-${provider}-${model}`;
    this.monitor.start(key);
    
    return () => {
      return this.monitor.end(key);
    };
  }
  
  getMetrics() {
    return this.monitor.getMeasures();
  }
}

// Caching utilities optimized for Vercel
export class VercelCache {
  private static readonly TTL = 60 * 60 * 1000; // 1 hour default TTL
  
  static async get<T>(key: string): Promise<T | null> {
    // In Vercel, we can use edge config, Redis, or in-memory cache
    // For serverless functions, we'll use a simple approach
    const cacheKey = `cache:${key}`;
    
    // Try to get from memory (works within same serverless function execution)
    const memoryCache = globalThis._vercelCache || {};
    if (memoryCache[cacheKey]) {
      const { value, expiry } = memoryCache[cacheKey];
      if (Date.now() < expiry) {
        return value as T;
      } else {
        // Expired, remove from cache
        delete memoryCache[cacheKey];
      }
    }
    
    // For persistent cache, we'd use Vercel KV, Redis, or database
    // This is a simplified version for demonstration
    return null;
  }
  
  static async set<T>(key: string, value: T, ttl: number = VercelCache.TTL): Promise<void> {
    const cacheKey = `cache:${key}`;
    const expiry = Date.now() + ttl;
    
    // In memory cache (for the duration of the serverless function)
    const memoryCache = globalThis._vercelCache || {};
    globalThis._vercelCache = memoryCache;
    memoryCache[cacheKey] = { value, expiry };
    
    // For persistent cache, we'd store to Vercel KV, Redis, or database
  }
  
  static async invalidate(key: string): Promise<void> {
    const cacheKey = `cache:${key}`;
    const memoryCache = globalThis._vercelCache || {};
    delete memoryCache[cacheKey];
  }
}

// Memory optimization utilities
export class MemoryOptimizer {
  // Estimate memory usage of an object
  static estimateSize(obj: any): number {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  }
  
  // Limit the size of stored messages to prevent memory issues
  static limitMessageHistory(messages: any[], maxSize: number = 20): any[] {
    if (messages.length <= maxSize) {
      return messages;
    }
    
    // Keep the system message if it exists, and the most recent messages
    const systemMessage = messages.find(msg => msg.role === 'system');
    const recentMessages = messages.slice(-maxSize);
    
    return systemMessage ? [systemMessage, ...recentMessages] : recentMessages;
  }
  
  // Clean up large objects when no longer needed
  static cleanup(obj: any): void {
    if (obj && typeof obj === 'object') {
      // For objects with cleanup methods
      if (typeof obj.destroy === 'function') {
        obj.destroy();
      } else if (typeof obj.abort === 'function') {
        obj.abort();
      }
    }
  }
}

// Vercel-specific performance utilities
export class VercelPerformanceUtils {
  // Optimize for Vercel's serverless timeout (max 60s for hobby, 900s for pro)
  static readonly VERCEL_SERVERLESS_TIMEOUT = 55000; // 55 seconds, leaving 5s buffer
  
  // Check if we're approaching timeout
  static isTimeoutApproaching(startTime: number, buffer: number = 5000): boolean {
    return (Date.now() - startTime) > (VercelPerformanceUtils.VERCEL_SERVERLESS_TIMEOUT - buffer);
  }
  
  // Measure function execution with timeout safety
  static async executeWithTimeout<T>(
    fn: () => Promise<T>, 
    timeout: number = VercelPerformanceUtils.VERCEL_SERVERLESS_TIMEOUT - 5000
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Function execution timeout')), timeout)
      )
    ]);
  }
  
  // Optimize API response size to reduce bandwidth and improve performance
  static optimizeApiResponse(response: any, maxSize: number = 1024 * 1024): any {
    // Limit response size to prevent exceeding Vercel's limits
    const serialized = JSON.stringify(response);
    if (serialized.length > maxSize) {
      // Truncate or summarize large responses
      console.warn(`API response too large (${serialized.length} bytes), optimizing...`);
      
      // For message responses, limit the message history
      if (response && typeof response === 'object' && response.messages) {
        response.messages = MemoryOptimizer.limitMessageHistory(response.messages, 10);
      }
      
      return response;
    }
    
    return response;
  }
}

// Initialize global performance tracking
export const apiTracker = new ApiPerformanceTracker();

// Performance monitoring middleware
export async function withPerformanceTracking<T>(
  fn: () => Promise<T>,
  name: string
): Promise<T> {
  const endTracking = apiTracker.trackApiCall(name);
  try {
    const result = await fn();
    endTracking();
    return result;
  } catch (error) {
    endTracking();
    throw error;
  }
}

// Performance monitoring for provider calls
export async function withProviderTracking<T>(
  fn: () => Promise<T>,
  provider: string,
  model: string
): Promise<T> {
  const endTracking = apiTracker.trackProviderCall(provider, model);
  try {
    const result = await fn();
    endTracking();
    return result;
  } catch (error) {
    endTracking();
    throw error;
  }
}

// Add global cache object for serverless function memory caching
declare global {
  // eslint-disable-next-line no-var
  var _vercelCache: Record<string, { value: any; expiry: number }> | undefined;
}

if (typeof global._vercelCache === 'undefined') {
  global._vercelCache = {};
}

export default {
  PerformanceMonitor,
  ApiPerformanceTracker,
  VercelCache,
  MemoryOptimizer,
  VercelPerformanceUtils,
  apiTracker,
  withPerformanceTracking,
  withProviderTracking,
};
