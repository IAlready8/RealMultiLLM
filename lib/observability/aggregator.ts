// Browser-compatible Observability Aggregator - Central point for all observability data

import { performanceMonitor } from '@/lib/performance-monitor';
import { globalTracer } from '@/lib/observability/tracing';
import { metricsRegistry } from '@/lib/observability/metrics';
import { logger } from '@/lib/observability/logger';

export interface ObservabilityData {
  timestamp: number;
  metrics: any[];
  spans: any[];
  logs: any[];
  system: any;
}

export class ObservabilityAggregator {
  private collectors: Array<() => any> = [];
  private exporters: Array<(data: ObservabilityData) => Promise<void>> = [];

  constructor() {
    // Register default collectors
    this.collectors.push(this.collectMetrics.bind(this));
    this.collectors.push(this.collectTraces.bind(this));
    this.collectors.push(this.collectSystemMetrics.bind(this));
  }

  // Register a custom collector
  registerCollector(collector: () => any): void {
    this.collectors.push(collector);
  }

  // Register an exporter
  registerExporter(exporter: (data: ObservabilityData) => Promise<void>): void {
    this.exporters.push(exporter);
  }

  // Collect all observability data
  private collectMetrics(): any {
    const metrics = metricsRegistry.getAllMetrics();
    return metrics.map(metric => ({
      name: metric.name,
      type: metric.type,
      description: metric.description,
      attributes: metric.attributes,
      value: (metric as any).getValue 
        ? (metric as any).getValue() 
        : (metric as any).getHistogramData 
          ? (metric as any).getHistogramData()
          : undefined
    }));
  }

  private collectTraces(): any[] {
    const spans = globalTracer.getAllSpans();
    return spans
      .filter(span => span.isEnded())
      .map(span => span.toJSON());
  }

  private async collectSystemMetrics(): Promise<any> {
    return await performanceMonitor.getSystemMetrics();
  }

  // Collect and export all observability data
  async collectAndExport(): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // Collect data from all collectors
      const collectedData: any[] = [];
      for (const collector of this.collectors) {
        try {
          const data = collector();
          collectedData.push(data);
        } catch (error) {
          logger.error('Error in collector', { error: (error as Error).message });
        }
      }

      // Get system metrics
      let systemMetrics: any = {};
      try {
        systemMetrics = await this.collectSystemMetrics();
      } catch (error) {
        logger.error('Error collecting system metrics', { error: (error as Error).message });
      }

      // Create observability data object
      const observabilityData: ObservabilityData = {
        timestamp,
        metrics: collectedData[0] || [],
        spans: collectedData[1] || [],
        logs: [], // Logs are streamed separately
        system: systemMetrics
      };

      // Export data to all exporters
      for (const exporter of this.exporters) {
        try {
          await exporter(observabilityData);
        } catch (error) {
          logger.error('Error in exporter', { error: (error as Error).message });
        }
      }
    } catch (error) {
      logger.error('Error collecting and exporting observability data', { 
        error: (error as Error).message 
      });
    }
  }

  // Start periodic collection
  startPeriodicCollection(intervalMs: number = 30000): void {
    setInterval(() => {
      this.collectAndExport().catch(error => {
        logger.error('Error in periodic observability collection', { 
          error: (error as Error).message 
        });
      });
    }, intervalMs);
  }

  // Export data in Prometheus format
  exportPrometheusFormat(): string {
    const lines: string[] = [];
    
    // Add metrics
    const metrics = this.collectMetrics();
    for (const metric of metrics) {
      lines.push(`# HELP ${metric.name} ${metric.description}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      
      if (metric.type === 'counter' || metric.type === 'gauge') {
        const attrStr = Object.entries(metric.attributes || {})
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labels = attrStr ? `{${attrStr}}` : '';
        lines.push(`${metric.name}${labels} ${metric.value}`);
      } else if (metric.type === 'histogram') {
        // Add histogram buckets
        for (const bucket of metric.value.buckets) {
          const le = isFinite(bucket.le) ? bucket.le : '+Inf';
          const attrStr = Object.entries({ ...metric.attributes, le })
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
          const labels = attrStr ? `{${attrStr}}` : '';
          lines.push(`${metric.name}_bucket${labels} ${bucket.count}`);
        }
        lines.push(`${metric.name}_sum ${metric.value.sum}`);
        lines.push(`${metric.name}_count ${metric.value.count}`);
      }
    }
    
    return lines.join('\n');
  }

  // Export data in JSON format
  exportJsonFormat(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      metrics: this.collectMetrics(),
      traces: this.collectTraces(),
      system: performanceMonitor.getPerformanceSummary()
    }, null, 2);
  }
}

// Global observability aggregator instance
export const observabilityAggregator = new ObservabilityAggregator();

// Default exporters
export async function consoleExporter(data: ObservabilityData): Promise<void> {
  console.log('=== Observability Data ===');
  console.log(JSON.stringify(data, null, 2));
}

export async function fileExporter(data: ObservabilityData): Promise<void> {
  // In a real implementation, this would write to a file
  // For now, we'll just log that it would write to a file
  logger.info('Observability data exported to file', {
    timestamp: data.timestamp,
    metricsCount: data.metrics.length,
    spansCount: data.spans.length
  });
}

// Register default exporters
observabilityAggregator.registerExporter(consoleExporter);
observabilityAggregator.registerExporter(fileExporter);

// Start periodic collection every 30 seconds
observabilityAggregator.startPeriodicCollection(30000);