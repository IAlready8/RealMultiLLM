// Browser-compatible Metrics Collection System for Observability

// Import only browser-compatible modules
import { performanceMonitor } from '@/lib/performance-monitor';

export interface MetricAttributes {
  [key: string]: string | number | boolean;
}

export interface HistogramBucket {
  le: number; // less than or equal to
  count: number;
}

export interface HistogramData {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export class Metric {
  constructor(
    public name: string,
    public type: MetricType,
    public description: string,
    public attributes: MetricAttributes = {}
  ) {}
}

export class Counter extends Metric {
  private value: number = 0;

  constructor(
    name: string,
    description: string,
    attributes: MetricAttributes = {}
  ) {
    super(name, 'counter', description, attributes);
  }

  inc(value: number = 1): void {
    this.value += value;
    // In a real implementation, we would send metrics to a backend service
    // For now, we'll just record with performanceMonitor
    performanceMonitor.recordMetric(this.name, this.value, this.attributes);
  }

  getValue(): number {
    return this.value;
  }
}

export class Gauge extends Metric {
  private value: number = 0;

  constructor(
    name: string,
    description: string,
    attributes: MetricAttributes = {}
  ) {
    super(name, 'gauge', description, attributes);
  }

  set(value: number): void {
    this.value = value;
    // In a real implementation, we would send metrics to a backend service
    performanceMonitor.recordMetric(this.name, this.value, this.attributes);
  }

  inc(value: number = 1): void {
    this.value += value;
    performanceMonitor.recordMetric(this.name, this.value, this.attributes);
  }

  dec(value: number = 1): void {
    this.value -= value;
    performanceMonitor.recordMetric(this.name, this.value, this.attributes);
  }

  getValue(): number {
    return this.value;
  }
}

export class Histogram extends Metric {
  private buckets: HistogramBucket[];
  private sum: number = 0;
  private count: number = 0;
  private readonly defaultBuckets: number[] = [
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10
  ];

  constructor(
    name: string,
    description: string,
    buckets?: number[],
    attributes: MetricAttributes = {}
  ) {
    super(name, 'histogram', description, attributes);
    this.buckets = (buckets || this.defaultBuckets).map(le => ({ le, count: 0 }));
    this.buckets.push({ le: Infinity, count: 0 }); // +Inf bucket
  }

  observe(value: number): void {
    this.sum += value;
    this.count++;

    // Find the appropriate bucket and increment its count
    for (const bucket of this.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
        break;
      }
    }

    // Record metrics for observability
    performanceMonitor.recordMetric(`${this.name}_sum`, this.sum, this.attributes);
    performanceMonitor.recordMetric(`${this.name}_count`, this.count, this.attributes);
    
    // Record individual bucket counts
    for (const bucket of this.buckets) {
      if (isFinite(bucket.le)) {
        performanceMonitor.recordMetric(
          `${this.name}_bucket_le_${bucket.le}`, 
          bucket.count, 
          this.attributes
        );
      } else {
        performanceMonitor.recordMetric(
          `${this.name}_bucket_le_inf`, 
          bucket.count, 
          this.attributes
        );
      }
    }
  }

  getHistogramData(): HistogramData {
    return {
      buckets: [...this.buckets],
      sum: this.sum,
      count: this.count
    };
  }
}

export class MetricsRegistry {
  private metrics: Map<string, Metric> = new Map();

  registerCounter(
    name: string,
    description: string,
    attributes: MetricAttributes = {}
  ): Counter {
    const key = this.getMetricKey(name, attributes);
    if (!this.metrics.has(key)) {
      const counter = new Counter(name, description, attributes);
      this.metrics.set(key, counter);
      return counter;
    }
    return this.metrics.get(key) as Counter;
  }

  registerGauge(
    name: string,
    description: string,
    attributes: MetricAttributes = {}
  ): Gauge {
    const key = this.getMetricKey(name, attributes);
    if (!this.metrics.has(key)) {
      const gauge = new Gauge(name, description, attributes);
      this.metrics.set(key, gauge);
      return gauge;
    }
    return this.metrics.get(key) as Gauge;
  }

  registerHistogram(
    name: string,
    description: string,
    buckets?: number[],
    attributes: MetricAttributes = {}
  ): Histogram {
    const key = this.getMetricKey(name, attributes);
    if (!this.metrics.has(key)) {
      const histogram = new Histogram(name, description, buckets, attributes);
      this.metrics.set(key, histogram);
      return histogram;
    }
    return this.metrics.get(key) as Histogram;
  }

  getMetric(name: string, attributes: MetricAttributes = {}): Metric | undefined {
    const key = this.getMetricKey(name, attributes);
    return this.metrics.get(key);
  }

  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  private getMetricKey(name: string, attributes: MetricAttributes): string {
    const attrString = Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${attrString}}`;
  }
}

// Global metrics registry
export const metricsRegistry = new MetricsRegistry();

// Predefined common metrics
export const httpRequestsTotal = metricsRegistry.registerCounter(
  'http_requests_total',
  'Total number of HTTP requests',
  { method: 'unknown', status: 'unknown' }
);

export const httpRequestDuration = metricsRegistry.registerHistogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  { method: 'unknown', status: 'unknown' }
);

export const llmRequestsTotal = metricsRegistry.registerCounter(
  'llm_requests_total',
  'Total number of LLM requests',
  { provider: 'unknown', model: 'unknown' }
);

export const llmRequestDuration = metricsRegistry.registerHistogram(
  'llm_request_duration_seconds',
  'LLM request duration in seconds',
  [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  { provider: 'unknown', model: 'unknown' }
);

export const llmTokensTotal = metricsRegistry.registerCounter(
  'llm_tokens_total',
  'Total number of tokens used',
  { provider: 'unknown', model: 'unknown', type: 'unknown' }
);

export const activeConnections = metricsRegistry.registerGauge(
  'active_connections',
  'Number of active connections'
);

export const memoryUsage = metricsRegistry.registerGauge(
  'memory_usage_bytes',
  'Memory usage in bytes',
  { type: 'unknown' }
);

// Utility function to create HTTP middleware for metrics collection
export function metricsMiddleware(req: any, res: any, next: any): void {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    
    // Record request count
    httpRequestsTotal.inc(1);
    
    // Record request duration
    httpRequestDuration.observe(duration);
    
    // Update attributes with actual values
    (httpRequestsTotal as any).attributes = {
      method: req.method,
      status: res.statusCode.toString()
    };
    
    (httpRequestDuration as any).attributes = {
      method: req.method,
      status: res.statusCode.toString()
    };
  });
  
  next();
}