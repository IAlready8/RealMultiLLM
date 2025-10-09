import { NextRequest } from 'next/server';
import { hasRole } from '@/lib/auth';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Check authentication and authorization
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin or observer role
    const userHasPermission = hasRole(sessionUser, ['admin', 'observer']);
    if (!userHasPermission) {
      return Response.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get analytics data from database
    const allEvents = await prisma.analytics.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to last 1000 events to prevent memory issues
    });

    type ProviderMetric = {
      provider: string;
      requests: number;
      tokens: number;
      errors: number;
      totalResponseTime: number;
    };

    const providerMetricsRecord = allEvents.reduce<Record<string, ProviderMetric>>((acc, event) => {
      // Extract provider from payload (JSON string) - parse to object
      let eventPayload: any = {};
      if (event.payload) {
        try {
          eventPayload = JSON.parse(event.payload);
        } catch (e) {
          // If payload is not valid JSON, continue with empty object
          eventPayload = {};
        }
      }
      
      const providerKey = eventPayload?.provider || eventPayload?.model || 'unknown';
      if (!acc[providerKey]) {
        acc[providerKey] = {
          provider: providerKey,
          requests: 0,
          tokens: 0,
          errors: 0,
          totalResponseTime: 0,
        };
      }

      const metric = acc[providerKey];
      metric.requests += 1;

      const tokens = Number(eventPayload?.tokens);
      if (!Number.isNaN(tokens)) {
        metric.tokens += tokens;
      }

      if (event.event.includes('error') || Boolean(eventPayload?.error)) {
        metric.errors += 1;
      }

      const responseTime = Number(eventPayload?.responseTime);
      if (!Number.isNaN(responseTime)) {
        metric.totalResponseTime += responseTime;
      }

      return acc;
    }, {});

    const providerMetrics = Object.values(providerMetricsRecord).map(metric => {
      const successCount = metric.requests - metric.errors;
      return {
        provider: metric.provider,
        requests: metric.requests,
        tokens: metric.tokens,
        errors: metric.errors,
        successRate: metric.requests > 0 ? (successCount / metric.requests) * 100 : 0,
        avgResponseTime: metric.requests > 0 ? metric.totalResponseTime / metric.requests : 0,
      };
    });
    
    // User activity data
    const allUserIds = new Set(allEvents.map(event => event.userId));
    const userActivity = Array.from(allUserIds).map(userId => {
      const userEvents = allEvents.filter(event => event.userId === userId);
      const lastEvent = userEvents.reduce((latest, current) => {
        if (!latest) return current;
        return current.createdAt > latest.createdAt ? current : latest;
      }, allEvents[0]);

      return {
        userId: userId || 'unknown',
        userName: `User ${(userId || 'unknown').substring(0, 8)}`,
        requests: userEvents.length,
        lastActive: lastEvent?.createdAt.toISOString() || '',
        role: sessionUser.id === userId ? (sessionUser.role || 'user') : 'user',
      };
    });
    
    // Error logs (events with error-related payload)
    const errorEvents = allEvents.filter(event => {
      let eventPayload: any = {};
      if (event.payload) {
        try {
          eventPayload = JSON.parse(event.payload);
        } catch (e) {
          // If payload is not valid JSON, use empty object
          eventPayload = {};
        }
      }
      return event.event.includes('error') ||
             event.event.includes('failed') ||
             eventPayload?.error === true;
    });
    
    const errorLogs = errorEvents.map(event => {
      let eventPayload: any = {};
      if (event.payload) {
        try {
          eventPayload = JSON.parse(event.payload);
        } catch (e) {
          // If payload is not valid JSON, use empty object
          eventPayload = {};
        }
      }
      return {
        id: `${event.createdAt.toISOString()}-${event.userId || 'unknown'}`,
        timestamp: event.createdAt.toISOString(),
        level: eventPayload?.errorType || 'error',
        message: eventPayload?.errorMessage || event.event,
        provider: eventPayload?.provider
      };
    });

    // System metrics
    const systemMetrics = {
      totalEvents: allEvents.length,
      uniqueUsers: allUserIds.size,
      errorRate: allEvents.length > 0 ? errorEvents.length / allEvents.length : 0,
    };

    // Return comprehensive admin analytics data
    return Response.json({
      systemMetrics,
      providerMetrics: Object.values(providerMetrics),
      userActivity: userActivity.slice(0, 20), // Limit to top 20 users
      errorLogs: errorLogs.slice(0, 50) // Limit to last 50 errors
    });
  } catch (error) {
    console.error('Admin analytics API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
