import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { monitoring } from '@/lib/monitoring';
import { getApiSecurityHeaders } from '@/lib/security-headers';

export async function GET(request: NextRequest) {
  try {
    // Only allow authenticated admin users to view metrics
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401,
          headers: getApiSecurityHeaders()
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const metricName = searchParams.get('metric');
    const limit = parseInt(searchParams.get('limit') || '100');
    const format = searchParams.get('format') || 'json';

    if (metricName) {
      // Get specific metric
      const metrics = monitoring.getMetrics(metricName, limit);
      
      if (format === 'prometheus') {
        // Return in Prometheus format
        const prometheusData = metrics.map(metric => {
          const labels = metric.tags 
            ? Object.entries(metric.tags).map(([key, value]) => `${key}="${value}"`).join(',')
            : '';
          return `${metric.name}{${labels}} ${metric.value} ${metric.timestamp.getTime()}`;
        }).join('\n');

        return new Response(prometheusData, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            ...getApiSecurityHeaders()
          }
        });
      }

      return NextResponse.json(metrics, {
        headers: getApiSecurityHeaders()
      });
    } else {
      // Get all available metrics
      const metricNames = monitoring.getMetricNames();
      const systemMetrics = await monitoring.getSystemMetrics();
      const performanceSummary = monitoring.getPerformanceSummary();

      const response = {
        timestamp: new Date().toISOString(),
        availableMetrics: metricNames,
        system: systemMetrics,
        performance: performanceSummary,
        summary: {
          totalMetrics: metricNames.length,
          uptime: systemMetrics.uptime,
          requestCount: systemMetrics.requestCount,
          errorCount: systemMetrics.errorCount,
          memoryUsage: `${(systemMetrics.memory.percentage).toFixed(2)}%`
        }
      };

      return NextResponse.json(response, {
        headers: getApiSecurityHeaders()
      });
    }
  } catch (error) {
    console.error('Metrics API error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: getApiSecurityHeaders()
    });
  }
}