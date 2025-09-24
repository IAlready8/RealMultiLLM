import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '@/lib/monitoring'

export async function GET(request: NextRequest) {
  try {
    monitoring.startTimer('health-check')

    // Check system health metrics
    const memoryUsage = process.memoryUsage()
    const uptime = process.uptime()
    const cpuUsage = process.cpuUsage()

    // Get recent metrics summary
    const metricsSummary = monitoring.getMetricsSummary(60000) // Last minute

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    const issues: string[] = []

    // Check memory usage (alert if using more than 80% of 8GB)
    const memoryLimitMB = 8 * 1024 // 8GB in MB
    const memoryUsageMB = memoryUsage.rss / 1024 / 1024
    const memoryPercent = (memoryUsageMB / memoryLimitMB) * 100

    if (memoryPercent > 90) {
      status = 'unhealthy'
      issues.push(`High memory usage: ${memoryPercent.toFixed(1)}%`)
    } else if (memoryPercent > 75) {
      status = 'degraded'
      issues.push(`Elevated memory usage: ${memoryPercent.toFixed(1)}%`)
    }

    // Check error rate
    if (metricsSummary.errorRate > 0.1) { // >10% error rate
      status = 'unhealthy'
      issues.push(`High error rate: ${(metricsSummary.errorRate * 100).toFixed(1)}%`)
    } else if (metricsSummary.errorRate > 0.05) { // >5% error rate
      if (status === 'healthy') status = 'degraded'
      issues.push(`Elevated error rate: ${(metricsSummary.errorRate * 100).toFixed(1)}%`)
    }

    // Check response time
    if (metricsSummary.avgResponseTime > 5000) { // >5s average response time
      status = 'unhealthy'
      issues.push(`Slow response time: ${metricsSummary.avgResponseTime.toFixed(0)}ms`)
    } else if (metricsSummary.avgResponseTime > 2000) { // >2s average response time
      if (status === 'healthy') status = 'degraded'
      issues.push(`Elevated response time: ${metricsSummary.avgResponseTime.toFixed(0)}ms`)
    }

    const healthData = {
      status,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(uptime),
        human: formatUptime(uptime)
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        usage_percent: Math.round(memoryPercent)
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000), // milliseconds
        system: Math.round(cpuUsage.system / 1000) // milliseconds
      },
      metrics: {
        requests_last_minute: metricsSummary.totalRequests,
        error_rate: Math.round(metricsSummary.errorRate * 10000) / 100, // percentage with 2 decimals
        avg_response_time: Math.round(metricsSummary.avgResponseTime),
        total_tokens: metricsSummary.totalTokens,
        total_cost: Math.round((metricsSummary.totalCost || 0) * 100) / 100 // dollars with 2 decimals
      },
      issues,
      version: process.env.npm_package_version || 'unknown',
      node_version: process.version,
      environment: process.env.NODE_ENV || 'unknown'
    }

    const duration = monitoring.endTimer('health-check')
    monitoring.recordApiRequest('/api/health', 'GET', 200, duration)

    // Set appropriate HTTP status based on health
    const httpStatus = status === 'healthy' ? 200 :
                      status === 'degraded' ? 200 : 503

    return NextResponse.json(healthData, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    monitoring.recordError(error as Error, { endpoint: '/api/health' })

    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      issues: ['Unable to perform health check']
    }

    return NextResponse.json(errorResponse, { status: 503 })
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

  return parts.join(' ')
}