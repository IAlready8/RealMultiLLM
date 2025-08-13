import { LLMResponse } from './llm-api-client';

interface CacheEntry {
  response: LLMResponse;
  timestamp: number;
}

/**
 * LLM Response Cache with proper memory management
 * Features:
 * - Size-limited cache (max 100 entries)
 * - TTL-based expiration (10 minutes)
 * - Automatic cleanup every 5 minutes
 * - LRU eviction when size limit is reached
 */
class LLMCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 100;
  private ttl = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup timer if in Node.js environment
    if (typeof global !== 'undefined') {
      this.startCleanupTimer();
    }
  }

  private startCleanupTimer() {
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private evictOldest() {
    // Remove the first (oldest) entry if cache is full
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  set(key: string, response: LLMResponse): void {
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  get(key: string): LLMResponse | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.response;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance
const llmCache = new LLMCache();

export default llmCache;