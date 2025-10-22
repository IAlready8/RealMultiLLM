import { getSessionUser, hasRole, UserRole } from '@/lib/auth';
import prisma from '@/lib/prisma';

import type { NextRequest } from 'next/server';

type AnalyticsPayload = {
  provider?: string;
  model?: string;
  tokens?: number;
  error?: boolean;
  responseTime?: number;
  errorType?: string;
  errorMessage?: string;
};

type ProviderMetric = {
  provider: string;
  requests: number;
  tokens: number;
  errors: number;
  totalResponseTime: number;
};

function parsePayload(payload: string | null): AnalyticsPayload {
  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(payload) as AnalyticsPayload;
  } catch (error) {
    console.warn('Failed to parse analytics payload', error);
    return {};
  }
}

export async function GET(_request: NextRequest) {
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return Response.json({
        systemMetrics: {
          totalEvents: 0,
          uniqueUsers: 0,
          errorRate: 0,
        },
        providerMetrics: [],
        userActivity: [],
        errorLogs: [],
      });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userHasPermission = hasRole(sessionUser, UserRole.ADMIN) || hasRole(sessionUser, UserRole.OBSERVER);
    if (!userHasPermission) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const allEvents = await prisma.analytics.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const providerMetricsMap = allEvents.reduce<Record<string, ProviderMetric>>((acc, event) => {
      const payload = parsePayload(event.payload);
      const providerKey = payload.provider || payload.model || 'unknown';

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

      const tokens = Number(payload.tokens);
      if (!Number.isNaN(tokens)) {
        metric.tokens += tokens;
      }

      if (event.event.includes('error') || payload.error) {
        metric.errors += 1;
      }

      const responseTime = Number(payload.responseTime);
      if (!Number.isNaN(responseTime)) {
        metric.totalResponseTime += responseTime;
      }

      return acc;
    }, {});

    const providerMetrics = Object.values(providerMetricsMap).map((metric) => {
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

    const allUserIds = new Set(allEvents.map((event) => event.userId));
    const userActivity = Array.from(allUserIds).map((userId) => {
      const userEvents = allEvents.filter((event) => event.userId === userId);
      const lastEvent = userEvents.reduce((latest, current) => {
        if (!latest) return current;
        return current.createdAt > latest.createdAt ? current : latest;
      }, userEvents[0]);

      return {
        userId: userId || 'unknown',
        userName: `User ${(userId || 'unknown').substring(0, 8)}`,
        requests: userEvents.length,
        lastActive: lastEvent?.createdAt.toISOString() ?? '',
        role: sessionUser.id === userId ? sessionUser.role ?? 'user' : 'user',
      };
    });

    const errorEvents = allEvents.filter((event) => {
      const payload = parsePayload(event.payload);
      return event.event.includes('error') || event.event.includes('failed') || payload.error;
    });

    const errorLogs = errorEvents.map((event) => {
      const payload = parsePayload(event.payload);
      return {
        id: `${event.createdAt.toISOString()}-${event.userId || 'unknown'}`,
        timestamp: event.createdAt.toISOString(),
        level: payload.errorType || 'error',
        message: payload.errorMessage || event.event,
        provider: payload.provider,
      };
    });

    const systemMetrics = {
      totalEvents: allEvents.length,
      uniqueUsers: allUserIds.size,
      errorRate: allEvents.length > 0 ? errorEvents.length / allEvents.length : 0,
    };

    return Response.json({
      systemMetrics,
      providerMetrics,
      userActivity: userActivity.slice(0, 20),
      errorLogs: errorLogs.slice(0, 50),
    });
  } catch (error) {
    console.error('Admin analytics API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
