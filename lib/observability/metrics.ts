// Browser-compatible Metrics Collection System for Observability

import { monitoring } from '@/lib/monitoring';

/**
 * @deprecated This module is deprecated. Use the `monitoring` singleton from '@/lib/monitoring' instead.
 */

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
    monitoring.recordMetric(this.name, this.value, this.attributes as any, 'count');
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
    monitoring.recordMetric(this.name, this.value, this.attributes as any, 'gauge');
  }

  inc(value: number = 1): void {
    this.value += value;
    monitoring.recordMetric(this.name, this.value, this.attributes as any, 'gauge');
  }

  dec(value: number = 1): void {
    this.value -= value;
    monitoring.recordMetric(this.name, this.value, this.attributes as any, 'gauge');
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

    monitoring.recordMetric(this.name, value, this.attributes as any, 'histogram');
  }

  getHistogramData(): HistogramData {
    return {
      buckets: [...this.buckets],
      sum: this.sum,
      count: this.count
    };
  }
}

/**
 * @deprecated This class is deprecated. Use the `monitoring` singleton from '@/lib/monitoring' instead.
 */
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

/**
 * @deprecated This registry is deprecated. Use the `monitoring` singleton from '@/lib/monitoring' instead.
 */
export const metricsRegistry = new MetricsRegistry();

// Predefined common metrics
/** @deprecated */
export const httpRequestsTotal = metricsRegistry.registerCounter(
  'http_requests_total',
  'Total number of HTTP requests',
  { method: 'unknown', status: 'unknown' }
);

/** @deprecated */
export const httpRequestDuration = metricsRegistry.registerHistogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  { method: 'unknown', status: 'unknown' }
);

/** @deprecated */
export const llmRequestsTotal = metricsRegistry.registerCounter(
  'llm_requests_total',
  'Total number of LLM requests',
  { provider: 'unknown', model: 'unknown' }
);

/** @deprecated */
export const llmRequestDuration = metricsRegistry.registerHistogram(
  'llm_request_duration_seconds',
  'LLM request duration in seconds',
  [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  { provider: 'unknown', model: 'unknown' }
);

/** @deprecated */
export const llmTokensTotal = metricsRegistry.registerCounter(
  'llm_tokens_total',
  'Total number of tokens used',
  { provider: 'unknown', model: 'unknown', type: 'unknown' }
);

/** @deprecated */
export const activeConnections = metricsRegistry.registerGauge(
  'active_connections',
  'Number of active connections'
);

/** @deprecated */
export const memoryUsage = metricsRegistry.registerGauge(
  'memory_usage_bytes',
  'Memory usage in bytes',
  { type: 'unknown' }
);

// Utility function to create HTTP middleware for metrics collection
/** @deprecated */
export function metricsMiddleware(req: any, res: any, next: any): void {
  console.warn('metricsMiddleware is deprecated. Use observabilityMiddleware instead.');
  next();
}
