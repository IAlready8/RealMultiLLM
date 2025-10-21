import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAnalytics, getDailyUsage } from '@/services/analytics-service';
import {
  getGlobalAnalyticsEngine,
  getAnalyticsDashboardData,
  generateAnalyticsPredictions,
  detectAnalyticsAnomalies
} from '@/lib/analytics';
import { 
  checkApiRateLimit, 
  createErrorResponse
} from '@/lib/api';
import { processSecurityRequest } from '@/lib/security';
import { logger } from '@/lib/observability/logger';
import { cache, CacheKeys, CacheConfigs } from '@/lib/cache';

interface AnalyticsPredictions {
  eventType: string;
  timeframe: string;
  predictions: unknown[];
  confidence: number;
}

interface AnalyticsAnomalies {
  eventType: string;
  timeRange: { start: number; end: number };
  anomalies: unknown[];
  detectedAt: number;
}

export async function GET(request: Request) {
  // Apply security middleware
  const securityResult = await processSecurityRequest(request);
  if (!securityResult.success) {
    return NextResponse.json(
      { error: { message: securityResult.error } },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const userId = session.user.id!;
  const endpoint = 'analytics';
  
  try {
    // Check rate limit
    const rateLimitResult = await checkApiRateLimit(request, endpoint, userId);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: { 
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.` 
          } 
        },
        { status: 429 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '7d';
    const days = parseInt(timeRange.replace('d', ''));
    const includePredictions = searchParams.get('predictions') === 'true';
    const includeAnomalies = searchParams.get('anomalies') === 'true';

    // Check cache first
    const cacheKey = CacheKeys.analytics(`${userId}-${timeRange}-${includePredictions}-${includeAnomalies}`, timeRange);
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      logger.info('analytics.cache.hit', { userId, timeRange });
      return NextResponse.json(cachedResult, {
        headers: {
          ...securityResult.headers,
          'X-Cache': 'HIT',
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      });
    }

    // Get overall analytics
    const analytics = await getAnalytics(userId);
    
    // Get daily usage data
    const dailyUsage = await getDailyUsage(userId, days);
    
    // Calculate summary statistics
    const totalRequests = analytics.reduce((sum, item) => sum + item.requests, 0);
    const totalTokens = analytics.reduce((sum, item) => sum + item.tokens, 0);
    
    // Calculate provider stats
    const providerStats: Record<string, { requests: number; tokens: number }> = {};
    analytics.forEach(item => {
      if (!providerStats[item.provider]) {
        providerStats[item.provider] = { requests: 0, tokens: 0 };
      }
      providerStats[item.provider].requests += item.requests;
      providerStats[item.provider].tokens += item.tokens;
    });
    
    // Calculate model comparison
    const modelComparison: Record<string, { requests: number; avgTokens: number }> = {};
    analytics.forEach(item => {
      if (!modelComparison[item.provider]) {
        modelComparison[item.provider] = { requests: 0, avgTokens: 0 };
      }
      modelComparison[item.provider].requests += item.requests;
      modelComparison[item.provider].avgTokens = 
        (modelComparison[item.provider].avgTokens * (modelComparison[item.provider].requests - item.requests) + item.tokens) / 
        modelComparison[item.provider].requests;
    });
    
    // Generate mock quality metrics
    const qualityMetrics = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      accuracy: Math.min(4.2 + Math.random() * 0.8, 5.0),
      relevance: Math.min(4.0 + Math.random() * 1.0, 5.0),
      conciseness: Math.min(3.8 + Math.random() * 1.2, 5.0),
    }));

    // Get real-time dashboard data
    const dashboardData = await getAnalyticsDashboardData([
      'llm_request',
      'llm_error',
      'user_activity'
    ]);

    // Generate predictions if requested
    let predictions: AnalyticsPredictions | null = null;
    if (includePredictions) {
      getGlobalAnalyticsEngine();
      predictions = await generateAnalyticsPredictions('llm_request', 'day');
    }

    // Detect anomalies if requested
    let anomalies: AnalyticsAnomalies | null = null;
    if (includeAnomalies) {
      getGlobalAnalyticsEngine();
      const now = Date.now();
      anomalies = await detectAnalyticsAnomalies('llm_request', {
        start: now - 86400000, // Last 24 hours
        end: now
      });
    }

    const response = {
      totalRequests,
      totalTokens,
      dailyUsage,
      qualityMetrics,
      providerStats,
      modelComparison,
      dashboard: dashboardData,
      predictions,
      anomalies
    };

    // Cache the response with smart dependency tracking
    const { smartCacheInvalidator } = await import('@/lib/smart-cache-invalidator');
    await smartCacheInvalidator.setWithDependencies(
      cacheKey,
      response,
      CacheConfigs.analytics.ttl || 300000,
      ['llm_request', 'user_activity', 'conversation_created']
    );
    logger.info('analytics.cache.set', { userId, timeRange });

    return NextResponse.json(response, {
      headers: {
        ...securityResult.headers,
        'X-Cache': 'MISS',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error getting analytics';
    logger.error('Error getting analytics:', { error: message });
    
    const errorForResponse = error instanceof Error ? error : new Error(message);
    const errorResponse = createErrorResponse(errorForResponse);
    
    return NextResponse.json(errorResponse, { 
      status: (errorResponse.error as { statusCode?: number }).statusCode || 500,
      headers: securityResult.headers
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check first to get userId
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401
        }
      );
    }

    // Process security request
    const securityResult = await processSecurityRequest(request);
    
    // Rate limiting with userId
    const rateLimitResult = await checkApiRateLimit(request, 'analytics-post', session.user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            ...securityResult.headers,
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }

    const body = await request.json();
    const { eventType, metadata } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { 
          status: 400,
          headers: securityResult.headers
        }
      );
    }

    // Track the analytics event
    await getAnalytics(eventType, metadata || {});
    
    logger.info('analytics.event.tracked', { 
      userId: session.user.id, 
      eventType,
      metadata 
    });

    return NextResponse.json(
      { success: true, message: 'Event tracked successfully' },
      {
        headers: {
          ...securityResult.headers,
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error tracking analytics event';
    logger.error('Error tracking analytics event:', { error: message });
    
    return NextResponse.json(
      { error: 'Failed to track event' },
      { 
        status: 500
      }
    );
  }
}