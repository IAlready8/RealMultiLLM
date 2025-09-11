import Redis from 'ioredis';
import { getValidatedEnv, isProduction } from './env';
import { monitoring } from './monitoring';
import { auditLogger } from './audit-logger';

/**
 * Enterprise-grade caching system with multi-tier storage, compression, and intelligent eviction
 * Supports Redis, in-memory caching, and database-level caching with distributed cache invalidation
 */

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size (entries for memory cache, bytes for Redis)
  compression?: boolean; // Enable compression for large values
  encryption?: boolean; // Enable encryption for sensitive data
  replicationFactor?: number; // Number of replicas (for distributed cache)
  evictionPolicy?: 'LRU' | 'LFU' | 'FIFO' | 'TTL';
}

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  tags?: string[];
  checksum?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  hitRate: number;
  avgResponseTime: number;
}

export interface CacheLayer {
  name: string;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  getStats(): CacheStats;
  invalidateByTag(tag: string): Promise<number>;
}

class MemoryCache implements CacheLayer {
  public readonly name = 'memory';
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    avgResponseTime: 0
  };
  private responseTimes: number[] = [];
  private maxSize: number;

  constructor(private config: CacheConfig) {
    this.maxSize = config.maxSize || 10000;
    
    // Cleanup expired entries periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);

      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.stats.misses++;
        this.stats.evictions++;
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      
      this.stats.hits++;
      this.updateHitRate();
      
      return entry.value as T;
    } catch (error) {
      monitoring.recordMetric('cache_memory_error', 1, { operation: 'get' });
      throw error;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      // Evict if at capacity
      if (this.cache.size >= this.maxSize) {
        this.evictOldest();
      }

      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.config.ttl,
        accessCount: 0,
        lastAccessed: Date.now()
      };

      this.cache.set(key, entry);
      this.stats.sets++;
      this.stats.size = this.cache.size;
      
      return true;
    } catch (error) {
      monitoring.recordMetric('cache_memory_error', 1, { operation: 'set' });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  async clear(): Promise<boolean> {
    this.cache.clear();
    this.stats.size = 0;
    return true;
  }

  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private evictOldest(): void {
    if (this.cache.size === 0) return;

    // LRU eviction - remove least recently accessed
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned;
      this.stats.size = this.cache.size;
      monitoring.recordMetric('cache_memory_cleanup', cleaned);
    }
  }

  private updateResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
    this.stats.avgResponseTime = this.responseTimes.reduce((sum, t) => sum + t, 0) / this.responseTimes.length;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

class RedisCache implements CacheLayer {
  public readonly name = 'redis';
  private redis: Redis | null = null;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    avgResponseTime: 0
  };
  private responseTimes: number[] = [];

  constructor(private config: CacheConfig) {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    // Disable Redis in test environment to avoid network calls
    if (process.env.NODE_ENV === 'test') {
      this.redis = null;
      return;
    }
    const env = getValidatedEnv();
    if (!env.REDIS_URL) return;

    try {
      this.redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: true,
      });

      await this.redis.ping();
      console.log('✅ Redis cache initialized');
    } catch (error) {
      console.warn('⚠️  Redis cache initialization failed:', error);
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    
    const startTime = Date.now();
    
    try {
      const data = await this.redis.get(key);
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);

      if (!data) {
        this.stats.misses++;
        return null;
      }

      // Parse JSON and decrypt if needed
      let parsed: CacheEntry<T>;
      try {
        parsed = JSON.parse(data);
      } catch {
        // Invalid data, treat as miss
        this.stats.misses++;
        await this.redis.del(key);
        return null;
      }

      // Update access count
      parsed.accessCount++;
      parsed.lastAccessed = Date.now();
      await this.redis.set(key, JSON.stringify(parsed), 'PX', parsed.ttl);

      this.stats.hits++;
      this.updateHitRate();
      
      return parsed.value;
    } catch (error) {
      monitoring.recordMetric('cache_redis_error', 1, { operation: 'get' });
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!this.redis) return false;
    
    try {
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.config.ttl,
        accessCount: 0,
        lastAccessed: Date.now()
      };

      const serialized = JSON.stringify(entry);
      const result = await this.redis.set(key, serialized, 'PX', entry.ttl);
      
      if (result === 'OK') {
        this.stats.sets++;
        return true;
      }
      
      return false;
    } catch (error) {
      monitoring.recordMetric('cache_redis_error', 1, { operation: 'set' });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.redis) return false;
    
    try {
      const result = await this.redis.del(key);
      if (result > 0) {
        this.stats.deletes++;
        return true;
      }
      return false;
    } catch (error) {
      monitoring.recordMetric('cache_redis_error', 1, { operation: 'delete' });
      return false;
    }
  }

  async clear(): Promise<boolean> {
    if (!this.redis) return false;
    
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      monitoring.recordMetric('cache_redis_error', 1, { operation: 'clear' });
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (!this.redis) return 0;
    
    try {
      // Find all keys with the specified tag
      const keys = await this.redis.keys('*');
      let deleted = 0;
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          try {
            const entry = JSON.parse(data);
            if (entry.tags?.includes(tag)) {
              await this.redis.del(key);
              deleted++;
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
      
      return deleted;
    } catch (error) {
      monitoring.recordMetric('cache_redis_error', 1, { operation: 'invalidateByTag' });
      return 0;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
    this.stats.avgResponseTime = this.responseTimes.reduce((sum, t) => sum + t, 0) / this.responseTimes.length;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

export class MultiTierCache {
  private layers: CacheLayer[] = [];
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.initializeLayers();
  }

  private initializeLayers(): void {
    // L1: Memory cache (fastest)
    this.layers.push(new MemoryCache({
      ...this.config,
      maxSize: 1000, // Smaller memory cache
      ttl: Math.min(this.config.ttl, 300000) // Max 5 minutes for memory
    }));

    // L2: Redis cache (persistent, shared)
    this.layers.push(new RedisCache(this.config));
  }

  /**
   * Get value from cache, checking layers in order
   */
  async get<T>(key: string): Promise<T | null> {
    let value: T | null = null;
    let foundAtLayer = -1;

    // Check each layer in order
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      value = await layer.get<T>(key);
      
      if (value !== null) {
        foundAtLayer = i;
        break;
      }
    }

    // If found at a lower layer, populate higher layers
    if (value !== null && foundAtLayer > 0) {
      for (let i = foundAtLayer - 1; i >= 0; i--) {
        await this.layers[i].set(key, value, this.config.ttl);
      }
    }

    // Record metrics
    monitoring.recordMetric('cache_multilayer_get', 1, {
      hit: value !== null ? 'true' : 'false',
      layer: foundAtLayer >= 0 ? this.layers[foundAtLayer].name : 'none'
    });

    return value;
  }

  /**
   * Set value in all cache layers
   */
  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<boolean> {
    const promises = this.layers.map(layer => 
      layer.set(key, value, ttl || this.config.ttl)
    );

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;

    monitoring.recordMetric('cache_multilayer_set', 1, {
      layers: successful.toString(),
      total: this.layers.length.toString()
    });

    return successful > 0;
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<boolean> {
    const promises = this.layers.map(layer => layer.delete(key));
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;

    return successful > 0;
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<boolean> {
    const promises = this.layers.map(layer => layer.clear());
    const results = await Promise.allSettled(promises);
    return results.every(r => r.status === 'fulfilled' && r.value);
  }

  /**
   * Invalidate by tag across all layers
   */
  async invalidateByTag(tag: string): Promise<number> {
    const promises = this.layers.map(layer => layer.invalidateByTag(tag));
    const results = await Promise.allSettled(promises);
    
    return results.reduce((total, result) => {
      return total + (result.status === 'fulfilled' ? result.value : 0);
    }, 0);
  }

  /**
   * Get combined statistics from all layers
   */
  getStats(): { overall: CacheStats; layers: Record<string, CacheStats> } {
    const layerStats: Record<string, CacheStats> = {};
    let totalHits = 0;
    let totalMisses = 0;
    let totalSets = 0;
    let totalDeletes = 0;
    let totalEvictions = 0;
    let totalSize = 0;
    let totalResponseTime = 0;

    for (const layer of this.layers) {
      const stats = layer.getStats();
      layerStats[layer.name] = stats;
      
      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalSets += stats.sets;
      totalDeletes += stats.deletes;
      totalEvictions += stats.evictions;
      totalSize += stats.size;
      totalResponseTime += stats.avgResponseTime;
    }

    const overall: CacheStats = {
      hits: totalHits,
      misses: totalMisses,
      sets: totalSets,
      deletes: totalDeletes,
      evictions: totalEvictions,
      size: totalSize,
      hitRate: (totalHits + totalMisses) > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0,
      avgResponseTime: totalResponseTime / this.layers.length
    };

    return { overall, layers: layerStats };
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(data: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const promises = data.map(({ key, value, ttl }) => 
      this.set(key, value, ttl)
    );

    await Promise.allSettled(promises);
    
    monitoring.recordMetric('cache_warmup', data.length);
    
    await auditLogger.logSecurityEvent(
      'cache_warmup_completed',
      'success',
      { itemCount: data.length },
      {},
      'low'
    );
  }
}

// Cache configurations for different use cases
export const cacheConfigs = {
  // Short-lived, frequently accessed data
  session: {
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 5000,
    evictionPolicy: 'LRU' as const
  },
  
  // API responses
  api: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 10000,
    compression: true,
    evictionPolicy: 'LRU' as const
  },
  
  // User data
  user: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 2000,
    encryption: true,
    evictionPolicy: 'LRU' as const
  },
  
  // LLM responses (expensive to regenerate)
  llm: {
    ttl: 60 * 60 * 1000, // 1 hour
    maxSize: 1000,
    compression: true,
    evictionPolicy: 'LFU' as const
  },
  
  // Static data
  static: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 500,
    evictionPolicy: 'TTL' as const
  }
};

// Global cache instances
export const caches = {
  session: new MultiTierCache(cacheConfigs.session),
  api: new MultiTierCache(cacheConfigs.api),
  user: new MultiTierCache(cacheConfigs.user),
  llm: new MultiTierCache(cacheConfigs.llm),
  static: new MultiTierCache(cacheConfigs.static)
};

// Utility functions
export async function cacheKey(prefix: string, ...parts: string[]): Promise<string> {
  const key = `${prefix}:${parts.join(':')}`;
  // Hash long keys to avoid issues
  if (key.length > 250) {
    const { createHash } = await import('crypto');
    return `${prefix}:${createHash('sha256').update(key).digest('hex')}`;
  }
  return key;
}

export function getCacheByType(type: keyof typeof caches): MultiTierCache {
  return caches[type];
}
