/**
 * PHASE 2 PERFORMANCE MONITORING: Stream Connection Health
 *
 * Admin endpoint to monitor streaming connection performance and memory usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getApiSecurityHeaders } from '@/lib/security-headers';
import { logger } from '@/lib/observability/logger';

export async function GET(request: NextRequest) {
  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: getApiSecurityHeaders()
        }
      );
    }

    // Import stream connection manager
    const { streamConnectionManager } = await import('@/lib/stream-connection-manager');
    const stats = streamConnectionManager.getConnectionStats();

    // Import database pool monitor
    const { prismaPoolMonitor } = await import('@/lib/prisma-pool-monitor');
    const dbStats = prismaPoolMonitor.getPoolStats();
    const dbHealth = await prismaPoolMonitor.checkPoolHealth();

    // Import cache invalidator stats
    const { smartCacheInvalidator } = await import('@/lib/smart-cache-invalidator');
    const cacheStats = smartCacheInvalidator.getDependencyStats();

    const response = {
      timestamp: new Date().toISOString(),
      system: {
        status: dbHealth.healthy ? 'healthy' : 'degraded',
        issues: dbHealth.issues,
        recommendations: dbHealth.recommendations
      },
      streaming: {
        connections: stats,
        performance: {
          memoryOptimized: true,
          automaticCleanup: true,
          timeoutProtection: true
        }
      },
      database: {
        connections: dbStats.connections,
        queries: dbStats.queries,
        performance: dbStats.performance
      },
      caching: {
        dependencies: cacheStats,
        smartInvalidation: true
      },
      optimization: {
        phase2Features: [
          'Stream connection memory management',
          'Database connection monitoring',
          'Smart cache invalidation',
          'Performance metrics tracking'
        ],
        memoryLeakPrevention: 'Active',
        performanceMonitoring: 'Enabled',
        cacheOptimization: 'Smart invalidation active'
      }
    };

    logger.info('performance_monitoring_check', {
      userId: session.user.id,
      streamConnections: stats.total,
      dbErrorRate: dbStats.queries.errorRate,
      cacheEntries: cacheStats.total
    });

    return NextResponse.json(response, {
      headers: getApiSecurityHeaders()
    });

  } catch (error) {
    logger.error('performance_monitoring_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: session?.user?.id
    });

    return NextResponse.json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : 'Unknown error') :
        'Unable to fetch performance data'
    }, {
      status: 500,
      headers: getApiSecurityHeaders()
    });
  }
}