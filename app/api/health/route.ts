import { NextResponse } from 'next/server'
import { monitoring } from '@/lib/monitoring'
import { logger } from '@/lib/observability/logger'
import { getApiSecurityHeaders, getCorsHeaders } from '@/lib/security-headers'

const DEFAULT_MEMORY_LIMIT_BYTES = Number(process.env.SYSTEM_MEMORY_LIMIT_BYTES ?? 8 * 1024 * 1024 * 1024)

const bytesToMb = (value: number): number => Math.round(value / (1024 * 1024))

const formatUptime = (totalSeconds: number): string => {
  const units: Array<[string, number]> = [
    ['d', 24 * 60 * 60],
    ['h', 60 * 60],
    ['m', 60],
    ['s', 1],
  ]

  let remaining = Math.floor(totalSeconds)
  const parts: string[] = []

  for (const [label, size] of units) {
    if (remaining >= size) {
      const value = Math.floor(remaining / size)
      remaining -= value * size
      parts.push(`${value}${label}`)
    }
  }

  if (parts.length === 0) {
    return '0s'
  }

  return parts.join(' ')
}

export async function GET(request: Request) {
  const timerName = 'health-check'
  monitoring.startTimer(timerName)

  const addStandardHeaders = (response: NextResponse) => {
    const origin = typeof request.headers.get === 'function' ? request.headers.get('origin') ?? undefined : undefined
    const headers = { ...getApiSecurityHeaders(), ...getCorsHeaders(origin) }
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }

    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  try {
    const metricsSummary = monitoring.getMetricsSummary(60000)
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    const uptimeSeconds = Math.floor(process.uptime())
    const uptimeHuman = formatUptime(uptimeSeconds)

    const memoryLimitBytes = DEFAULT_MEMORY_LIMIT_BYTES
    const memoryUsagePercent = (memoryUsage.rss / memoryLimitBytes) * 100
    const memoryUsagePercentRounded = Math.round(memoryUsagePercent)

    const errorRatePercent = metricsSummary.errorRate * 100
    const averageResponseTime = metricsSummary.avgResponseTime

    const issues: string[] = []
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let statusCode = 200

    const markDegraded = () => {
      if (status === 'healthy') {
        status = 'degraded'
      }
    }

    const markUnhealthy = () => {
      status = 'unhealthy'
      statusCode = 503
    }

    if (memoryUsagePercent >= 90) {
      issues.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`)
      markUnhealthy()
    } else if (memoryUsagePercent >= 75) {
      issues.push(`Elevated memory usage: ${memoryUsagePercent.toFixed(1)}%`)
      markDegraded()
    }

    if (errorRatePercent >= 10) {
      issues.push(`High error rate: ${errorRatePercent.toFixed(1)}%`)
      markUnhealthy()
    } else if (errorRatePercent >= 5) {
      issues.push(`Elevated error rate: ${errorRatePercent.toFixed(1)}%`)
      markDegraded()
    }

    if (averageResponseTime >= 5000) {
      issues.push(`Slow response time: ${Math.round(averageResponseTime)}ms`)
      markUnhealthy()
    } else if (averageResponseTime >= 3000) {
      issues.push(`Elevated response time: ${Math.round(averageResponseTime)}ms`)
      markDegraded()
    }

    const responseBody = {
      status,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptimeSeconds,
        human: uptimeHuman,
      },
      memory: {
        rss: bytesToMb(memoryUsage.rss),
        heapUsed: bytesToMb(memoryUsage.heapUsed),
        heapTotal: bytesToMb(memoryUsage.heapTotal),
        external: bytesToMb(memoryUsage.external),
        arrayBuffers: bytesToMb(memoryUsage.arrayBuffers ?? 0),
        usage_percent: memoryUsagePercentRounded,
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000),
      },
      metrics: {
        requests_last_minute: metricsSummary.totalRequests,
        error_rate: Number(errorRatePercent.toFixed(1)),
        avg_response_time: Math.round(averageResponseTime),
        total_tokens: metricsSummary.totalTokens,
        total_cost: metricsSummary.totalCost,
      },
      issues,
      version: process.env.npm_package_version ?? '0.0.0',
      node_version: process.version,
      environment: process.env.NODE_ENV ?? 'development',
    }

    const response = NextResponse.json(responseBody, { status: statusCode })
    addStandardHeaders(response)

    const duration = monitoring.endTimer(timerName) || 0
    monitoring.recordApiRequest('/api/health', 'GET', statusCode, duration)

    logger.info('Health check completed', {
      status,
      issues,
      errorRate: errorRatePercent,
      duration,
    })

    return response
  } catch (error) {
    const duration = monitoring.endTimer(timerName) || 0
    monitoring.recordError(error as Error, { endpoint: '/api/health' })
    monitoring.recordApiRequest('/api/health', 'GET', 503, duration)

    logger.error('Health check failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration,
    })

    const response = NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        issues: ['Unable to perform health check'],
      },
      { status: 503 }
    )

    addStandardHeaders(response)
    return response
  }
}
