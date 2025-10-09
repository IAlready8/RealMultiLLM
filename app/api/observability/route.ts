import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { monitoring, HealthCheckResult, SystemMetrics } from '@/lib/monitoring';
import { globalTracer } from '@/lib/observability/tracing';
import { metricsRegistry, Counter, Gauge, Histogram, MetricType, HistogramData } from '@/lib/observability/metrics';
import { logger } from '@/lib/observability/logger';

interface MetricOutput {
  name: string;
  type: MetricType;
  description: string;
  attributes: Record<string, string | number | boolean>;
  value?: number | HistogramData;
}

interface SpanOutput {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean | Array<string | number | boolean>>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, string | number | boolean> }>;
  status: { code: 'UNSET' | 'OK' | 'ERROR'; message?: string };
}

interface HealthCheckOutput {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: Date;
}

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
    const performanceSummary = monitoring.getMetricsSummary();
    
    // Get system metrics
    const systemMetrics: SystemMetrics = await monitoring.getSystemMetrics();
    
    // Get metrics based on include parameter
    let metricsData: { metrics?: MetricOutput[] } = {};
    if (include === 'all' || include.includes('metrics')) {
      metricsData = {
        metrics: metricsRegistry.getAllMetrics().map(metric => {
          let value: number | HistogramData | undefined;
          if (metric instanceof Counter || metric instanceof Gauge) {
            value = metric.getValue();
          } else if (metric instanceof Histogram) {
            value = metric.getHistogramData();
          }
          return {
            name: metric.name,
            type: metric.type,
            description: metric.description,
            attributes: metric.attributes,
            value: value
          };
        })
      };
    }
    
    // Get traces based on include parameter
    let tracesData: { traces?: SpanOutput[] } = {};
    if (include === 'all' || include.includes('traces')) {
      const spans = globalTracer.getAllSpans();
      tracesData = {
        traces: spans
          .filter(span => span.isEnded())
          .map(span => span.toJSON())
      };
    }
    
    // Get health checks based on include parameter
    let healthData: { health?: HealthCheckOutput } = {};
    if (include === 'all' || include.includes('health')) {
      healthData = {
        health: await monitoring.runHealthChecks()
      };
    }
    
    // Prepare response data
    const responseData = {
      timestamp: Date.now(),
      performance: performanceSummary,
      system: systemMetrics,
      ...metricsData,
      ...tracesData,
      ...healthData
    };
    
    // Return data in requested format
    if (format === 'prometheus') {
      const prometheusData = await monitoring.exportMetrics('prometheus');
      const body = Array.isArray(prometheusData) ? JSON.stringify(prometheusData) : prometheusData;
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
        },
      });
    } else {
      return NextResponse.json(responseData);
    }
  } catch (error) {
    logger.error('Error in observability dashboard API', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        error: { 
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
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
        return NextResponse.json(
          { error: { message: 'Alerting system has been deprecated. Please use the new health check system.' } },
          { status: 400 }
        );
        
      case 'trigger-collection':
        return NextResponse.json(
          { error: { message: 'Manual collection is no longer supported. Metrics are collected automatically.' } },
          { status: 400 }
        );
        
      default:
        return NextResponse.json(
          { error: { message: 'Unknown action' } },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error in observability dashboard API POST', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        error: { 
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
        } 
      },
      { status: 500 }
    );
  }
}
