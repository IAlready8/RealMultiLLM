/**
 * PHASE 1 SECURITY ENHANCEMENT: API Key Health Monitoring
 *
 * Admin endpoint to monitor API key usage and identify stale keys
 * This supports the foundation for automated key lifecycle management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStaleApiKeys, getApiKeyUsageStats } from '@/lib/api-key-tracker';
import { getApiSecurityHeaders } from '@/lib/security-headers';
import { logger } from '@/lib/observability/logger';

export async function GET(request: NextRequest) {
  let session: Session | null = null
  try {
    session = await getServerSession(authOptions);

    // Only allow authenticated users to view their own API key health
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: getApiSecurityHeaders()
        }
      );
    }

    const userId = session.user.id

    const { searchParams } = new URL(request.url);
    const includeStale = searchParams.get('includeStale') === 'true';
    const staleDays = parseInt(searchParams.get('staleDays') || '30');

    // Get user's API key usage statistics
    const usageStats = await getApiKeyUsageStats(userId);

    let staleKeys: Awaited<ReturnType<typeof getStaleApiKeys>> = [];
    if (includeStale) {
      // Only return stale keys for the current user (security)
      const allStaleKeys = await getStaleApiKeys(staleDays);
      staleKeys = allStaleKeys.filter(key => key.userId === userId);
    }

    const response = {
      timestamp: new Date().toISOString(),
      userId,
      summary: {
        totalKeys: usageStats.length,
        activeKeys: usageStats.filter(key => !key.isStale).length,
        staleKeys: usageStats.filter(key => key.isStale).length,
        neverUsedKeys: usageStats.filter(key => !key.lastUsedAt).length
      },
      keys: usageStats.map(key => ({
        provider: key.provider,
        usageCount: key.usageCount,
        lastUsedAt: key.lastUsedAt,
        daysSinceLastUse: key.daysSinceLastUse,
        isStale: key.isStale,
        createdAt: key.createdAt
      })),
      ...(includeStale && {
        staleKeyDetails: staleKeys.map(key => ({
          provider: key.provider,
          daysSinceLastUse: key.daysSinceLastUse,
          usageCount: key.usageCount,
          createdAt: key.createdAt
        }))
      })
    };

    logger.info('api_key_health_check', {
      userId,
      totalKeys: response.summary.totalKeys,
      staleKeys: response.summary.staleKeys
    });

    return NextResponse.json(response, {
      headers: getApiSecurityHeaders()
    });

  } catch (error) {
    logger.error('api_key_health_check_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : 'Unknown error') :
        'Unable to fetch API key health data'
    }, {
      status: 500,
      headers: getApiSecurityHeaders()
    });
  }
}

/**
 * POST endpoint for manual API key health actions
 * Currently supports marking keys for rotation review
 */
export async function POST(request: NextRequest) {
  let session: Session | null = null
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: getApiSecurityHeaders()
        }
      );
    }

    const userId = session.user.id

    const body = await request.json();
    const { action, provider } = body;

    if (action === 'mark_for_review' && provider) {
      // Log the review request for manual follow-up
      logger.info('api_key_review_requested', {
        userId,
        provider,
        requestedAt: new Date().toISOString(),
        action: 'manual_review'
      });

      return NextResponse.json({
        success: true,
        message: `API key for ${provider} marked for security review`,
        action: 'logged_for_review'
      }, {
        headers: getApiSecurityHeaders()
      });
    }

    return NextResponse.json({
      error: 'Invalid action',
      supportedActions: ['mark_for_review']
    }, {
      status: 400,
      headers: getApiSecurityHeaders()
    });

  } catch (error) {
    logger.error('api_key_health_action_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json({
      error: 'Internal server error'
    }, {
      status: 500,
      headers: getApiSecurityHeaders()
    });
  }
}
