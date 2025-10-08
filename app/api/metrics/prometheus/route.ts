import { NextResponse } from 'next/server';
import { metricsRegistry } from '@/lib/observability/metrics';

/**
 * Prometheus Metrics Endpoint
 * Exposes application metrics in Prometheus text format
 *
 * Scrape configuration:
 * ```yaml
 * scrape_configs:
 *   - job_name: 'realmultillm'
 *     static_configs:
 *       - targets: ['localhost:3000']
 *     metrics_path: '/api/metrics/prometheus'
 *     scrape_interval: 15s
 * ```
 */
export async function GET() {
  try {
    const metrics = metricsRegistry.getAll();

    // Format metrics in Prometheus exposition format
    let output = '';

    for (const [name, metric] of Object.entries(metrics)) {
      // Add HELP line
      output += `# HELP ${name} ${metric.description || 'No description'}\n`;

      // Add TYPE line
      output += `# TYPE ${name} ${metric.type}\n`;

      // Add metric values
      if (metric.type === 'counter') {
        for (const [labels, value] of Object.entries(metric.values || {})) {
          const labelStr = formatLabels(labels);
          output += `${name}${labelStr} ${value}\n`;
        }
      } else if (metric.type === 'gauge') {
        for (const [labels, value] of Object.entries(metric.values || {})) {
          const labelStr = formatLabels(labels);
          output += `${name}${labelStr} ${value}\n`;
        }
      } else if (metric.type === 'histogram') {
        for (const [labels, histogram] of Object.entries(metric.values || {})) {
          const baseLabels = parseLabels(labels);

          // Histogram buckets
          for (const bucket of histogram.buckets || []) {
            const bucketLabels = { ...baseLabels, le: bucket.le.toString() };
            const labelStr = formatLabels(JSON.stringify(bucketLabels));
            output += `${name}_bucket${labelStr} ${bucket.count}\n`;
          }

          // Count
          const countLabels = formatLabels(labels);
          output += `${name}_count${countLabels} ${histogram.count || 0}\n`;

          // Sum
          output += `${name}_sum${countLabels} ${histogram.sum || 0}\n`;
        }
      } else if (metric.type === 'summary') {
        for (const [labels, summary] of Object.entries(metric.values || {})) {
          const baseLabels = parseLabels(labels);

          // Quantiles
          for (const quantile of summary.quantiles || []) {
            const quantileLabels = { ...baseLabels, quantile: quantile.quantile.toString() };
            const labelStr = formatLabels(JSON.stringify(quantileLabels));
            output += `${name}${labelStr} ${quantile.value}\n`;
          }

          // Count
          const countLabels = formatLabels(labels);
          output += `${name}_count${countLabels} ${summary.count || 0}\n`;

          // Sum
          output += `${name}_sum${countLabels} ${summary.sum || 0}\n`;
        }
      }

      output += '\n';
    }

    // Add process metrics
    output += addProcessMetrics();

    // Add system metrics
    output += addSystemMetrics();

    return new NextResponse(output, {
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

/**
 * Format labels object to Prometheus label syntax
 */
function formatLabels(labelsStr: string): string {
  try {
    const labels = typeof labelsStr === 'string' ? JSON.parse(labelsStr) : labelsStr;

    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }

    const pairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');

    return `{${pairs}}`;
  } catch {
    return '';
  }
}

/**
 * Parse label string to object
 */
function parseLabels(labelsStr: string): Record<string, any> {
  try {
    return typeof labelsStr === 'string' ? JSON.parse(labelsStr) : labelsStr;
  } catch {
    return {};
  }
}

/**
 * Add Node.js process metrics
 */
function addProcessMetrics(): string {
  let output = '';

  // Memory usage
  const mem = process.memoryUsage();
  output += `# HELP process_resident_memory_bytes Resident memory size in bytes\n`;
  output += `# TYPE process_resident_memory_bytes gauge\n`;
  output += `process_resident_memory_bytes ${mem.rss}\n\n`;

  output += `# HELP process_heap_bytes Process heap size in bytes\n`;
  output += `# TYPE process_heap_bytes gauge\n`;
  output += `process_heap_bytes ${mem.heapUsed}\n\n`;

  // CPU usage
  const cpuUsage = process.cpuUsage();
  output += `# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds\n`;
  output += `# TYPE process_cpu_user_seconds_total counter\n`;
  output += `process_cpu_user_seconds_total ${cpuUsage.user / 1000000}\n\n`;

  output += `# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds\n`;
  output += `# TYPE process_cpu_system_seconds_total counter\n`;
  output += `process_cpu_system_seconds_total ${cpuUsage.system / 1000000}\n\n`;

  // Uptime
  output += `# HELP process_uptime_seconds Number of seconds the process has been running\n`;
  output += `# TYPE process_uptime_seconds gauge\n`;
  output += `process_uptime_seconds ${process.uptime()}\n\n`;

  return output;
}

/**
 * Add system metrics
 */
function addSystemMetrics(): string {
  let output = '';

  // Node.js version
  output += `# HELP nodejs_version_info Node.js version info\n`;
  output += `# TYPE nodejs_version_info gauge\n`;
  output += `nodejs_version_info{version="${process.version}"} 1\n\n`;

  // Event loop lag (approximation)
  const start = Date.now();
  setImmediate(() => {
    const lag = Date.now() - start;
    output += `# HELP nodejs_eventloop_lag_seconds Event loop lag in seconds\n`;
    output += `# TYPE nodejs_eventloop_lag_seconds gauge\n`;
    output += `nodejs_eventloop_lag_seconds ${lag / 1000}\n\n`;
  });

  return output;
}
