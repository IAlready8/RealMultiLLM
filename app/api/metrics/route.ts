import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { monitoring } from '@/lib/monitoring'
import { getApiSecurityHeaders } from '@/lib/security-headers'

const toNumberOrNull = (value: number) => (Number.isFinite(value) ? value : null)

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: getApiSecurityHeaders() }
    )
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url)
  const format = url.searchParams.get('format') ?? 'json'
  const windowParam = url.searchParams.get('window')
  const parsedWindow = windowParam !== null ? parseInt(windowParam, 10) : 300000

  if (format === 'prometheus') {
    const payload = monitoring.exportMetrics('prometheus') as string
    return new NextResponse(payload, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        ...getApiSecurityHeaders(),
      },
    })
  }

  try {
    const summary = monitoring.getMetricsSummary(parsedWindow)
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    const uptimeSeconds = Math.floor(process.uptime())
    const now = Date.now()

    const response = NextResponse.json(
      {
        metrics: summary,
        health: {
          status: summary.errorRate >= 0.1 ? 'degraded' : 'healthy',
          uptime: uptimeSeconds,
          memory: memoryUsage,
          cpu: cpuUsage,
          timestamp: now,
        },
        meta: {
          format: 'json',
          timeWindow: toNumberOrNull(parsedWindow),
          timestamp: now,
        },
      },
      { headers: getApiSecurityHeaders() }
    )

    return response
  } catch (error) {
    monitoring.recordError(error as Error, { endpoint: '/api/metrics' })
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500, headers: getApiSecurityHeaders() }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: getApiSecurityHeaders() }
    )
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let payload: any
  try {
    payload = await request.json()
  } catch (error) {
    monitoring.recordError(error as Error, { endpoint: '/api/metrics' })
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500, headers: getApiSecurityHeaders() }
    )
  }

  if (payload?.type !== 'client-performance') {
    return NextResponse.json(
      { error: 'Invalid metric type' },
      { status: 400, headers: getApiSecurityHeaders() }
    )
  }

  const metricTimestamp = typeof payload.timestamp === 'number' ? payload.timestamp : Date.now()
  const metricTags: Record<string, any> = {
    source: 'client',
    ...(payload.tags ?? {}),
  }

  if (session.user?.id) {
    metricTags.userId = session.user.id
  }

  try {
    monitoring.recordMetric({
      name: payload.name,
      value: payload.value,
      timestamp: metricTimestamp,
      type: 'gauge',
      tags: metricTags,
    })
  } catch (error) {
    monitoring.recordError(error as Error, { endpoint: '/api/metrics' })
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500, headers: getApiSecurityHeaders() }
    )
  }

  return NextResponse.json(
    { success: true },
    { status: 200, headers: getApiSecurityHeaders() }
  )
}
