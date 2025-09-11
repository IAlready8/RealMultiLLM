// Simple Health Check API Endpoint

import { NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/performance-monitor';
import { logger } from '@/lib/observability/logger';
import { getApiSecurityHeaders, getCorsHeaders } from '@/lib/security-headers';

export async function GET(request: Request) {
  try {
    // Get system metrics
    const systemMetrics = await performanceMonitor.getSystemMetrics();
    
    // Get performance summary
    const performanceSummary = performanceMonitor.getPerformanceSummary();
    
    // Check if system is healthy
    const isHealthy = (
      systemMetrics.cpuUsage < 90 &&
      systemMetrics.memoryUsage.percentage < 90 &&
      systemMetrics.eventLoopLag < 100 &&
      performanceSummary.errorRate < 5
    );
    
    // Get active alerts
    const activeAlerts = performanceMonitor.getActiveAlerts();
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      system: {
        cpuUsage: systemMetrics.cpuUsage,
        memoryUsage: systemMetrics.memoryUsage.percentage,
        eventLoopLag: systemMetrics.eventLoopLag,
        activeConnections: systemMetrics.activeConnections,
        cacheHitRate: systemMetrics.cacheHitRate,
      },
      performance: {
        totalRequests: performanceSummary.totalRequests,
        errorRate: performanceSummary.errorRate,
        averageResponseTime: performanceSummary.averageResponseTime,
        requestsPerSecond: performanceSummary.requestsPerSecond,
      },
      alerts: {
        count: activeAlerts.length,
      }
    };
    
    // Log health check
    logger.info('Health check completed', { 
      status: healthData.status,
      errorRate: healthData.performance.errorRate,
      cpuUsage: healthData.system.cpuUsage
    });
    
    const response = NextResponse.json(healthData, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
    // Apply security and CORS headers
    const origin = (typeof request.headers.get === 'function') ? request.headers.get('origin') ?? undefined : undefined;
    const headers = { ...getApiSecurityHeaders(), ...getCorsHeaders(origin) };
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: any) {
    logger.error('Health check failed', { 
      error: error.message,
      stack: error.stack
    });
    
    const response = NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
    const origin = (typeof request.headers.get === 'function') ? request.headers.get('origin') ?? undefined : undefined;
    const headers = { ...getApiSecurityHeaders(), ...getCorsHeaders(origin) };
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }
}
