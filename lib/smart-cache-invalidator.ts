/**
 * PHASE 2 PERFORMANCE OPTIMIZATION: Smart Cache Invalidation
 *
 * Dependency-based cache invalidation to prevent stale data issues
 * Zero-breaking-change enhancement to existing cache system
 */

import { logger } from '@/lib/observability/logger';

interface CacheDependency {
  key: string;
  dependencies: string[];
  ttl: number;
  createdAt: number;
}

interface InvalidationRule {
  pattern: RegExp;
  dependencies: string[];
  reason: string;
}

class SmartCacheInvalidator {
  private dependencies = new Map<string, CacheDependency>();
  private invalidationRules: InvalidationRule[] = [];

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Setup default invalidation rules for common patterns
   */
  private setupDefaultRules(): void {
    // Analytics cache rules
    this.addInvalidationRule(
      /analytics:.*$/,
      ['llm_request', 'user_activity', 'conversation_created'],
      'Analytics data updated'
    );

    // Goal cache rules
    this.addInvalidationRule(
      /goals:.*$/,
      ['goal_created', 'goal_updated', 'goal_deleted'],
      'Goal data changed'
    );

    // Persona cache rules
    this.addInvalidationRule(
      /personas:.*$/,
      ['persona_created', 'persona_updated', 'persona_deleted'],
      'Persona data changed'
    );

    // User profile cache rules
    this.addInvalidationRule(
      /user:.*$/,
      ['user_updated', 'user_preferences_changed'],
      'User data changed'
    );

    // Provider config cache rules
    this.addInvalidationRule(
      /provider_config:.*$/,
      ['api_key_updated', 'provider_settings_changed'],
      'Provider configuration changed'
    );
  }

  /**
   * Add a new invalidation rule
   */
  addInvalidationRule(pattern: RegExp, dependencies: string[], reason: string): void {
    this.invalidationRules.push({ pattern, dependencies, reason });
  }

  /**
   * Register cache entry with dependencies
   */
  registerCache(
    key: string,
    dependencies: string[],
    ttl: number = 300000 // 5 minutes default
  ): void {
    this.dependencies.set(key, {
      key,
      dependencies,
      ttl,
      createdAt: Date.now()
    });

    logger.debug('cache_dependency_registered', {
      key,
      dependencies,
      ttl
    });
  }

  /**
   * Invalidate caches based on event trigger
   */
  async invalidateByEvent(
    event: string,
    metadata: Record<string, any> = {}
  ): Promise<string[]> {
    const invalidatedKeys: string[] = [];

    try {
      // Find all cache entries that depend on this event
      for (const [cacheKey, dependency] of this.dependencies) {
        if (dependency.dependencies.includes(event)) {
          await this.invalidateKey(cacheKey);
          invalidatedKeys.push(cacheKey);
        }
      }

      // Check invalidation rules
      for (const rule of this.invalidationRules) {
        if (rule.dependencies.includes(event)) {
          const matchingKeys = Array.from(this.dependencies.keys()).filter(key =>
            rule.pattern.test(key)
          );

          for (const key of matchingKeys) {
            if (!invalidatedKeys.includes(key)) {
              await this.invalidateKey(key);
              invalidatedKeys.push(key);
            }
          }
        }
      }

      if (invalidatedKeys.length > 0) {
        logger.info('smart_cache_invalidation', {
          event,
          invalidatedKeys,
          count: invalidatedKeys.length,
          metadata
        });
      }

      return invalidatedKeys;
    } catch (error) {
      logger.error('cache_invalidation_error', {
        event,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata
      });
      return [];
    }
  }

  /**
   * Invalidate specific cache key
   */
  private async invalidateKey(key: string): Promise<void> {
    try {
      // Remove from dependency tracking
      this.dependencies.delete(key);

      // Attempt to clear from actual cache (if available)
      try {
        const { cache } = await import('@/lib/cache');
        await cache.del(key);
      } catch (error) {
        // Cache module may not be available - that's fine
        logger.debug('cache_clear_unavailable', { key });
      }

      logger.debug('cache_key_invalidated', { key });
    } catch (error) {
      logger.warn('cache_key_invalidation_failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clean up expired dependencies
   */
  cleanupExpiredDependencies(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, dependency] of this.dependencies) {
      if (now - dependency.createdAt > dependency.ttl) {
        this.dependencies.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('cache_dependencies_cleaned', { cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Get current dependency statistics
   */
  getDependencyStats() {
    const now = Date.now();
    const dependencies = Array.from(this.dependencies.values());

    return {
      total: dependencies.length,
      byEvent: dependencies.reduce((acc, dep) => {
        dep.dependencies.forEach(event => {
          acc[event] = (acc[event] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>),
      expired: dependencies.filter(dep => now - dep.createdAt > dep.ttl).length,
      averageAge: dependencies.length > 0
        ? Math.round(dependencies.reduce((sum, dep) => sum + (now - dep.createdAt), 0) / dependencies.length)
        : 0
    };
  }

  /**
   * Enhanced cache setter with automatic dependency registration
   */
  async setWithDependencies(
    key: string,
    value: any,
    ttl: number,
    dependencies: string[]
  ): Promise<void> {
    try {
      // Register dependencies
      this.registerCache(key, dependencies, ttl);

      // Set in actual cache
      try {
        const { cache } = await import('@/lib/cache');
        await cache.set(key, value, ttl);
      } catch (error) {
        // Cache module may not be available - continue anyway
        logger.warn('cache_set_unavailable', { key });
      }

      logger.debug('cache_set_with_dependencies', {
        key,
        dependencies,
        ttl
      });
    } catch (error) {
      logger.error('cache_set_with_dependencies_error', {
        key,
        dependencies,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Singleton instance for global cache invalidation
export const smartCacheInvalidator = new SmartCacheInvalidator();

// Periodic cleanup of expired dependencies
setInterval(() => {
  smartCacheInvalidator.cleanupExpiredDependencies();
}, 5 * 60 * 1000); // Every 5 minutes