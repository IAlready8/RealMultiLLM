// Conditional import for Redis to handle environments where it's not available
let createClient: any = null;

// Cache configuration interface
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix?: string; // Key prefix for namespacing
  compress?: boolean; // Enable compression for large values
}

// Cache entry interface
interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
}

// In-memory cache implementation
class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private timers = new Map<string, NodeJS.Timeout>();

  set<T>(key: string, value: T, config: CacheConfig): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store the entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: config.ttl
    };

    this.cache.set(key, entry);

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, config.ttl * 1000);

    this.timers.set(key, timer);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.delete(key);
      return null;
    }

    return entry.value as T;
  }

  delete(key: string): boolean {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Redis cache implementation
class RedisCache {
  private client: any = null;
  private isConnected = false;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    if (!process.env.REDIS_URL) return;

    try {
      // Dynamically import redis to avoid webpack issues
      const redisModule = await import('redis');
      createClient = (redisModule as any).createClient;
      
      this.client = createClient({ url: process.env.REDIS_URL });
      
      this.client.on('error', (err: unknown) => {
        console.error('Redis Cache Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis cache connected successfully');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to initialize Redis cache:', error);
      this.client = null;
      this.isConnected = false;
    }
  }

  async set<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const serializedValue = JSON.stringify({
        value,
        timestamp: Date.now()
      });

      const finalKey = config.prefix ? `${config.prefix}:${key}` : key;
      await this.client.setEx(finalKey, config.ttl, serializedValue);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async get<T>(key: string, prefix?: string): Promise<T | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const finalKey = prefix ? `${prefix}:${key}` : key;
      const data = await this.client.get(finalKey);
      
      if (!data) return null;

      const parsed = JSON.parse(data);
      return parsed.value as T;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async delete(key: string, prefix?: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const finalKey = prefix ? `${prefix}:${key}` : key;
      const result = await this.client.del(finalKey);
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async clear(prefix?: string): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      if (prefix) {
        const keys = await this.client.keys(`${prefix}:*`);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } else {
        await this.client.flushDb();
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client || !this.isConnected) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }
}

// Unified cache interface
export class Cache {
  private memoryCache = new MemoryCache();
  private redisCache = new RedisCache();

  // Set value with fallback to memory cache if Redis fails
  async set<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    // Always set in memory cache for fast local access
    this.memoryCache.set(key, value, config);

    // Try to set in Redis for distributed caching
    try {
      await this.redisCache.set(key, value, config);
    } catch (error) {
      console.warn('Failed to set value in Redis, using memory cache only:', error);
    }
  }

  // Get value with fallback strategy
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    // Try memory cache first (fastest)
    const memoryResult = this.memoryCache.get<T>(key);
    if (memoryResult !== null) {
      return memoryResult;
    }

    // Try Redis cache
    try {
      const redisResult = await this.redisCache.get<T>(key, prefix);
      if (redisResult !== null) {
        // Store in memory cache for future fast access
        this.memoryCache.set(key, redisResult, { ttl: 300 }); // 5 min in memory
        return redisResult;
      }
    } catch (error) {
      console.warn('Failed to get value from Redis:', error);
    }

    return null;
  }

  // Delete from both caches
  async delete(key: string, prefix?: string): Promise<boolean> {
    const memoryResult = this.memoryCache.delete(key);
    
    let redisResult = false;
    try {
      redisResult = await this.redisCache.delete(key, prefix);
    } catch (error) {
      console.warn('Failed to delete from Redis:', error);
    }

    return memoryResult || redisResult;
  }

  // Clear both caches
  async clear(prefix?: string): Promise<void> {
    this.memoryCache.clear();
    
    try {
      await this.redisCache.clear(prefix);
    } catch (error) {
      console.warn('Failed to clear Redis cache:', error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const memoryKeys = this.memoryCache.keys().filter((key) => {
      if (!pattern.includes('*')) {
        return key === pattern;
      }
      const prefix = pattern.slice(0, pattern.indexOf('*'));
      return key.startsWith(prefix);
    });

    try {
      const redisKeys = await this.redisCache.keys(pattern);
      return Array.from(new Set([...memoryKeys, ...redisKeys]));
    } catch (error) {
      console.warn('Failed to retrieve Redis keys:', error);
      return memoryKeys;
    }
  }

  // Get cache statistics
  getStats() {
    return {
      memorySize: this.memoryCache.size(),
      memoryKeys: this.memoryCache.keys().length,
      redisConnected: this.redisCache['isConnected']
    };
  }
}

// Default cache instance
export const cache = new Cache();

// Cache key builders for different use cases
export const CacheKeys = {
  llmResponse: (provider: string, model: string, hash: string) => 
    `llm:${provider}:${model}:${hash}`,
  
  userSession: (userId: string) => 
    `user:${userId}:session`,
  
  analytics: (type: string, period: string) => 
    `analytics:${type}:${period}`,
  
  rateLimit: (identifier: string) => 
    `rate_limit:${identifier}`,

  modelList: (provider: string) => 
    `models:${provider}`,

  apiKeyValidation: (provider: string, keyHash: string) => 
    `api_key:${provider}:${keyHash}`
};

// Predefined cache configurations
export const CacheConfigs = {
  // Short-term cache for frequently accessed data
  short: { ttl: 300, prefix: 'short' }, // 5 minutes
  
  // Medium-term cache for semi-static data
  medium: { ttl: 3600, prefix: 'medium' }, // 1 hour
  
  // Long-term cache for static data
  long: { ttl: 86400, prefix: 'long' }, // 24 hours
  
  // LLM response cache (longer for similar queries)
  llmResponse: { ttl: 1800, prefix: 'llm' }, // 30 minutes
  
  // User session cache
  session: { ttl: 7200, prefix: 'session' }, // 2 hours
  
  // Analytics cache (longer for aggregated data)
  analytics: { ttl: 21600, prefix: 'analytics' } // 6 hours
} as const;
