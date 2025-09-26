import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { monitoring } from '@/lib/monitoring';
import { getApiSecurityHeaders } from '@/lib/security-headers';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: getApiSecurityHeaders() });
  }

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const windowMs = parseInt(url.searchParams.get('window') || '300000', 10);

    if (format === 'prometheus') {
      const payload = monitoring.exportMetrics('prometheus') as string;
      return new NextResponse(payload, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          ...getApiSecurityHeaders(),
        },
      });
    }

    const metrics = monitoring.exportMetrics('json');
    const summary = monitoring.getMetricsSummary(windowMs);
    const performance = monitoring.getPerformanceSummary(windowMs);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        windowMs,
        summary,
        performance,
        metrics,
      },
      { headers: getApiSecurityHeaders() },
    );
  } catch (error) {
    monitoring.recordError(error as Error, { endpoint: '/api/monitoring' });
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: getApiSecurityHeaders() },
    );
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: getApiSecurityHeaders() });
  }

  monitoring.resetMetrics();
  return NextResponse.json({ message: 'Metrics reset successfully' }, { headers: getApiSecurityHeaders() });
}
