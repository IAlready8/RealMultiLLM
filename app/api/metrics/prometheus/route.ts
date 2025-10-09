import { NextResponse } from 'next/server';
import os from 'os';
import { monitoring, type MetricData } from '@/lib/monitoring';

function serializeMetric(metric: MetricData): string {
  const metricName = `realmultillm_${metric.name.replace(/[^a-zA-Z0-9:_]/g, '_')}`;
  const labels = metric.tags
    ? '{' + Object.entries(metric.tags).map(([key, value]) => `${key}="${value}"`).join(',') + '}'
    : '';
  return `${metricName}${labels} ${metric.value}`;
}

function buildProcessMetrics(): string {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const lines: string[] = [];

  lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${mem.rss}`);

  lines.push('# HELP process_heap_used_bytes Process heap used in bytes');
  lines.push('# TYPE process_heap_used_bytes gauge');
  lines.push(`process_heap_used_bytes ${mem.heapUsed}`);

  lines.push('# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds');
  lines.push('# TYPE process_cpu_user_seconds_total counter');
  lines.push(`process_cpu_user_seconds_total ${(cpu.user / 1_000_000).toFixed(6)}`);

  lines.push('# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds');
  lines.push('# TYPE process_cpu_system_seconds_total counter');
  lines.push(`process_cpu_system_seconds_total ${(cpu.system / 1_000_000).toFixed(6)}`);

  lines.push('# HELP process_uptime_seconds Number of seconds the process has been running');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${process.uptime().toFixed(3)}`);

  return lines.join('\n');
}

function buildSystemMetrics(): string {
  const lines: string[] = [];

  lines.push('# HELP nodejs_version_info Node.js version info');
  lines.push('# TYPE nodejs_version_info gauge');
  lines.push(`nodejs_version_info{version="${process.version}"} 1`);

  const load = os.loadavg();
  lines.push('# HELP nodejs_load_average Load average over 1, 5, 15 minutes');
  lines.push('# TYPE nodejs_load_average gauge');
  lines.push(`nodejs_load_average{interval="1"} ${load[0].toFixed(3)}`);
  lines.push(`nodejs_load_average{interval="5"} ${load[1].toFixed(3)}`);
  lines.push(`nodejs_load_average{interval="15"} ${load[2].toFixed(3)}`);

  lines.push('# HELP nodejs_total_memory_bytes Total system memory in bytes');
  lines.push('# TYPE nodejs_total_memory_bytes gauge');
  lines.push(`nodejs_total_memory_bytes ${os.totalmem()}`);

  lines.push('# HELP nodejs_free_memory_bytes Free system memory in bytes');
  lines.push('# TYPE nodejs_free_memory_bytes gauge');
  lines.push(`nodejs_free_memory_bytes ${os.freemem()}`);

  return lines.join('\n');
}

export async function GET() {
  try {
    const exported = monitoring.exportMetrics('prometheus');
    const baseMetrics = Array.isArray(exported)
      ? exported.map(serializeMetric).join('\n')
      : exported;

    const sections = [baseMetrics, buildProcessMetrics(), buildSystemMetrics()]
      .filter(Boolean)
      .join('\n\n');

    return new NextResponse(sections, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Prometheus metrics error:', error);
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 });
  }
}
