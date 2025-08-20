import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    
    // Calculate start date
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Fetch security events
    const securityEvents = await prisma.analyticsEvent.findMany({
      where: {
        event: { in: ['security_threat', 'auth_failure', 'rate_limit_exceeded'] },
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'desc' }
    });

    // Calculate security metrics
    const totalRequests = await prisma.analyticsEvent.count({
      where: {
        event: 'api_request',
        timestamp: { gte: startDate }
      }
    });

    const blockedRequests = securityEvents.filter(e => {
      try {
        const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
        return payload && typeof payload === 'object' && payload.blocked === true;
      } catch {
        return false;
      }
    }).length;

    const activeThreats = securityEvents.filter(e => 
      e.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
    ).length;

    // Calculate threat level
    const threatRate = totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;
    const threatLevel = threatRate > 10 ? 'critical' : 
                       threatRate > 5 ? 'high' : 
                       threatRate > 1 ? 'medium' : 'low';

    // Top attack vectors
    const attackCounts = securityEvents.reduce((acc, event) => {
      try {
        const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
        const type = payload?.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      } catch {
        acc['unknown'] = (acc['unknown'] || 0) + 1;
        return acc;
      }
    }, {} as Record<string, number>);

    const topAttackVectors = Object.entries(attackCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Recent threats for display
    const recentThreats = securityEvents.slice(0, 10).map(event => {
      try {
        const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
        return {
          id: event.id,
          type: payload?.type || 'unknown',
          severity: payload?.severity || 'low',
          source: payload?.source || 'unknown',
          timestamp: event.timestamp,
          blocked: payload?.blocked || false,
          details: payload?.details || {}
        };
      } catch {
        return {
          id: event.id,
          type: 'unknown',
          severity: 'low' as const,
          source: 'unknown',
          timestamp: event.timestamp,
          blocked: false,
          details: {}
        };
      }
    });

    return NextResponse.json({
      success: true,
      metrics: {
        totalRequests,
        blockedRequests,
        threatLevel,
        activeThreats,
        topAttackVectors
      },
      recentThreats,
      timeRange
    });

  } catch (error) {
    console.error('Security threats API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch security data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}