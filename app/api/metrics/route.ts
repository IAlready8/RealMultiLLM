import { NextRequest, NextResponse } from 'next/server'
import { monitoring } from '@/lib/monitoring'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()

    // Require authentication for metrics endpoint
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'
    const timeWindow = parseInt(url.searchParams.get('window') || '300000') // 5 minutes default

    // Get metrics summary
    const summary = monitoring.getMetricsSummary(timeWindow)

    // Add system health status
    const systemHealth = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: Date.now()
    }

    const response = {
      metrics: summary,
      health: systemHealth,
      meta: {
        format,
        timeWindow,
        timestamp: Date.now()
      }
    }

    // Return metrics in requested format
    if (format === 'prometheus') {
      const prometheusText = monitoring.exportMetrics('prometheus')
      return new NextResponse(prometheusText, {
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    monitoring.recordError(error as Error, { endpoint: '/api/metrics' })
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Allow clients to submit custom metrics
    if (body.type === 'client-performance') {
      monitoring.recordMetric({
        name: body.name,
        value: body.value,
        timestamp: body.timestamp || Date.now(),
        type: 'gauge',
        tags: { source: 'client', userId: session.user?.id, ...body.tags }
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid metric type' }, { status: 400 })
  } catch (error) {
    monitoring.recordError(error as Error, { endpoint: '/api/metrics' })
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500 }
    )
  }
}