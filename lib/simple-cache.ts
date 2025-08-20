// Simple in-memory cache implementation
class SimpleCache {
  private cache: Map<string, { value: any; expiry: number }>;
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    // Check if item exists and hasn't expired
    if (item && Date.now() < item.expiry) {
      return item.value;
    }
    
    // Remove expired item
    if (item) {
      this.cache.delete(key);
    }
    
    return null;
  }

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  set(key: string, value: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiry });
  }

  /**
   * Delete a value from the cache
   * @param key - Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of items in the cache
   */
  size(): number {
    // Remove expired items before returning size
    for (const [key, item] of this.cache.entries()) {
      if (Date.now() >= item.expiry) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}

// Create a global instance of the cache
const cache = new SimpleCache();

export default cache;