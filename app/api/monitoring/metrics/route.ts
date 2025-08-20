import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '1h';
    
    // Calculate start date based on time range
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
    }

    // Fetch performance metrics from analytics events
    const events = await prisma.analyticsEvent.findMany({
      where: {
        timestamp: { gte: startDate },
        event: { in: ['llm_request', 'llm_response', 'api_request'] }
      },
      orderBy: { timestamp: 'desc' }
    });

    // Generate mock metrics for demonstration (would be real metrics in production)
    const metrics = [];
    const intervalMs = timeRange === '7d' ? 60 * 60 * 1000 : // 1 hour intervals for 7d
                     timeRange === '24h' ? 30 * 60 * 1000 : // 30 min intervals for 24h
                     5 * 60 * 1000; // 5 min intervals for 1h/6h

    for (let time = startDate.getTime(); time <= now.getTime(); time += intervalMs) {
      const timestamp = new Date(time);
      
      // Simulate realistic metrics with some variance
      const baseResponse = 200 + Math.random() * 300;
      const spike = Math.random() > 0.95 ? 2000 : 0; // 5% chance of spike
      
      metrics.push({
        timestamp,
        responseTime: baseResponse + spike,
        throughput: 30 + Math.random() * 50,
        errorRate: Math.random() * 2 + (spike > 0 ? 5 : 0),
        cpuUsage: 20 + Math.random() * 30 + (spike > 0 ? 20 : 0),
        memoryUsage: 40 + Math.random() * 20,
        dbLatency: 50 + Math.random() * 100 + (spike > 0 ? 200 : 0),
        activeUsers: 50 + Math.floor(Math.random() * 100),
        revenue: 500 + Math.random() * 1000
      });
    }

    // Latest metrics for current status
    const latest = metrics[metrics.length - 1] || {
      timestamp: now,
      responseTime: 250,
      throughput: 45,
      errorRate: 1.2,
      cpuUsage: 35,
      memoryUsage: 45,
      dbLatency: 75,
      activeUsers: 123,
      revenue: 1250
    };

    return NextResponse.json({
      success: true,
      metrics,
      latest,
      timeRange,
      totalEvents: events.length
    });

  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}