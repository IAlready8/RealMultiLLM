/**
 * PHASE 1 SECURITY ENHANCEMENT: API Key Usage Tracking
 *
 * Minimal, non-breaking addition to track API key usage for future lifecycle management
 * This module provides the foundation for API key rotation and monitoring
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/observability/logger';

interface ApiKeyUsageData {
  userId: string;
  provider: string;
  success: boolean;
  timestamp: Date;
}

/**
 * Track API key usage (non-blocking, fire-and-forget)
 * This is called after API requests to update usage statistics
 */
export async function trackApiKeyUsage(data: ApiKeyUsageData): Promise<void> {
  try {
    // Non-blocking update - don't await to avoid impacting API performance
    prisma.providerConfig.updateMany({
      where: {
        userId: data.userId,
        provider: data.provider,
        isActive: true
      },
      data: {
        lastUsedAt: data.timestamp,
        usageCount: {
          increment: 1
        }
      }
    }).catch((error) => {
      // Silent failure - tracking is non-critical for API functionality
      logger.warn('api_key_usage_tracking_failed', {
        userId: data.userId,
        provider: data.provider,
        error: error.message
      });
    });
  } catch (error) {
    // Fail silently - usage tracking should never break API functionality
    logger.warn('api_key_tracking_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: data.userId,
      provider: data.provider
    });
  }
}

/**
 * Get API key usage statistics for monitoring
 * Used by admin interfaces and monitoring dashboards
 */
export async function getApiKeyUsageStats(userId: string, provider?: string) {
  try {
    const where = {
      userId,
      ...(provider && { provider }),
      isActive: true
    };

    const configs = await prisma.providerConfig.findMany({
      where,
      select: {
        id: true,
        provider: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return configs.map(config => ({
      ...config,
      daysSinceLastUse: config.lastUsedAt
        ? Math.floor((Date.now() - config.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      isStale: config.lastUsedAt
        ? Date.now() - config.lastUsedAt.getTime() > (30 * 24 * 60 * 60 * 1000) // 30 days
        : false
    }));
  } catch (error) {
    logger.error('get_api_key_stats_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      provider
    });
    return [];
  }
}

/**
 * Identify stale API keys that haven't been used in specified days
 * Used for automated cleanup and rotation notifications
 */
export async function getStaleApiKeys(daysSinceLastUse: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastUse);

    const staleKeys = await prisma.providerConfig.findMany({
      where: {
        isActive: true,
        OR: [
          { lastUsedAt: null }, // Never used
          { lastUsedAt: { lt: cutoffDate } } // Not used recently
        ]
      },
      select: {
        id: true,
        userId: true,
        provider: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    return staleKeys.map(key => ({
      ...key,
      daysSinceLastUse: key.lastUsedAt
        ? Math.floor((Date.now() - key.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((Date.now() - key.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    }));
  } catch (error) {
    logger.error('get_stale_keys_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      daysSinceLastUse
    });
    return [];
  }
}

/**
 * Update API key last used timestamp
 * Lightweight version for immediate implementation
 */
export async function updateApiKeyLastUsed(userId: string, provider: string): Promise<void> {
  try {
    await prisma.providerConfig.updateMany({
      where: {
        userId,
        provider,
        isActive: true
      },
      data: {
        lastUsedAt: new Date(),
        usageCount: {
          increment: 1
        }
      }
    });
  } catch (error) {
    // Non-critical failure - log but don't throw
    logger.warn('update_last_used_failed', {
      userId,
      provider,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}