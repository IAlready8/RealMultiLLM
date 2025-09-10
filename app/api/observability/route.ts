// Observability Dashboard API

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { observabilityAggregator } from '@/lib/observability/aggregator';
import { performanceMonitor } from '@/lib/performance-monitor';
import { globalTracer } from '@/lib/observability/tracing';
import { metricsRegistry } from '@/lib/observability/metrics';
import { logger } from '@/lib/observability/logger';

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const include = searchParams.get('include') || 'all';
    
    // Get performance summary
    const performanceSummary = performanceMonitor.getPerformanceSummary();
    
    // Get system metrics
    const systemMetrics = await performanceMonitor.getSystemMetrics();
    
    // Get metrics based on include parameter
    let metricsData: any = {};
    if (include === 'all' || include.includes('metrics')) {
      metricsData = {
        metrics: metricsRegistry.getAllMetrics().map(metric => ({
          name: metric.name,
          type: metric.type,
          description: metric.description,
          attributes: metric.attributes,
          value: (metric as any).getValue 
            ? (metric as any).getValue() 
            : (metric as any).getHistogramData 
              ? (metric as any).getHistogramData()
              : undefined
        }))
      };
    }
    
    // Get traces based on include parameter
    let tracesData: any = {};
    if (include === 'all' || include.includes('traces')) {
      const spans = globalTracer.getAllSpans();
      tracesData = {
        traces: spans
          .filter(span => span.isEnded())
          .map(span => span.toJSON())
      };
    }
    
    // Get alerts based on include parameter
    let alertsData: any = {};
    if (include === 'all' || include.includes('alerts')) {
      alertsData = {
        alerts: performanceMonitor.getActiveAlerts()
      };
    }
    
    // Prepare response data
    const responseData = {
      timestamp: Date.now(),
      performance: performanceSummary,
      system: systemMetrics,
      ...metricsData,
      ...tracesData,
      ...alertsData
    };
    
    // Return data in requested format
    if (format === 'prometheus') {
      const prometheusData = observabilityAggregator.exportPrometheusFormat();
      return new NextResponse(prometheusData, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
        },
      });
    } else {
      return NextResponse.json(responseData);
    }
  } catch (error: any) {
    logger.error('Error in observability dashboard API', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { 
        error: { 
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        } 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action } = body;
    
    // Handle different actions
    switch (action) {
      case 'acknowledge-alert':
        const { alertId } = body;
        if (!alertId) {
          return NextResponse.json(
            { error: { message: 'Missing alertId' } },
            { status: 400 }
          );
        }
        
        const success = performanceMonitor.acknowledgeAlert(alertId);
        if (success) {
          logger.info('Alert acknowledged', { alertId });
          return NextResponse.json({ success: true });
        } else {
          return NextResponse.json(
            { error: { message: 'Alert not found' } },
            { status: 404 }
          );
        }
        
      case 'trigger-collection':
        await observabilityAggregator.collectAndExport();
        logger.info('Manual observability collection triggered');
        return NextResponse.json({ success: true });
        
      default:
        return NextResponse.json(
          { error: { message: 'Unknown action' } },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('Error in observability dashboard API POST', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { 
        error: { 
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        } 
      },
      { status: 500 }
    );
  }
}