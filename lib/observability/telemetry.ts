import { Span, Tracer, globalTracer, trace, tracingMiddleware } from './tracing';
import { logger } from '../logger';
import { enterpriseConfigManager, isEnterpriseFeatureEnabled } from '../config';
import { env } from '../env';
import { type SystemConfig } from '../config-manager';

// Telemetry data types
export interface Metric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  labels?: Record<string, string>;
  timestamp?: number;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  context?: Record<string, any>;
  traceId?: string;
  spanId?: string;
}

export interface Event {
  name: string;
  properties: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface TelemetryData {
  metrics: Metric[];
  logs: LogEntry[];
  events: Event[];
  traces: Span[];
}

// Telemetry collector interface
export interface TelemetryCollector {
  recordMetric(metric: Metric): void;
  recordLog(log: LogEntry): void;
  recordEvent(event: Event): void;
  getTelemetryData(): Promise<TelemetryData>;
  flush(): Promise<void>;
}

// Console-based telemetry collector for development
class ConsoleTelemetryCollector implements TelemetryCollector {
  private metrics: Metric[] = [];
  private logs: LogEntry[] = [];
  private events: Event[] = [];
  private traces: Span[] = [];

  recordMetric(metric: Metric): void {
    this.metrics.push(metric);
    if (env.NODE_ENV === 'development') {
      console.log(`[METRIC] ${metric.name}: ${metric.value}`, metric.labels);
    }
  }

  recordLog(log: LogEntry): void {
    this.logs.push(log);
    const consoleLevel = log.level === 'error' ? 'error' : 
                        log.level === 'warn' ? 'warn' : 
                        log.level === 'debug' ? 'debug' : 'log';
    console[consoleLevel](`[LOG ${log.level.toUpperCase()}]`, log.message, log.context);
  }

  recordEvent(event: Event): void {
    this.events.push(event);
    if (env.NODE_ENV === 'development') {
      console.log(`[EVENT] ${event.name}`, event.properties);
    }
  }

  async getTelemetryData(): Promise<TelemetryData> {
    return {
      metrics: [...this.metrics],
      logs: [...this.logs],
      events: [...this.events],
      traces: [...globalTracer.getAllSpans()],
    };
  }

  async flush(): Promise<void> {
    // In console collector, just clear the data
    this.metrics = [];
    this.logs = [];
    this.events = [];
  }
}

// Enterprise telemetry collector for production
class EnterpriseTelemetryCollector implements TelemetryCollector {
  private metrics: Metric[] = [];
  private logs: LogEntry[] = [];
  private events: Event[] = [];
  private traceBuffer: Span[] = [];
  private readonly flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly maxBufferSize: number;
  private readonly endpoint: string | null;
  private readonly apiKey: string | null;

  constructor(
    flushIntervalMs: number = 30000, // 30 seconds
    maxBufferSize: number = 1000,
    endpoint: string | null = null,
    apiKey: string | null = null
  ) {
    this.flushInterval = flushIntervalMs;
    this.maxBufferSize = maxBufferSize;
    this.endpoint = endpoint || env.TELEMETRY_ENDPOINT || null;
    this.apiKey = apiKey || env.TELEMETRY_API_KEY || null;
  }

  recordMetric(metric: Metric): void {
    this.metrics.push(metric);
    this.checkBufferSize();
  }

  recordLog(log: LogEntry): void {
    this.logs.push(log);
    this.checkBufferSize();
  }

  recordEvent(event: Event): void {
    this.events.push(event);
    this.checkBufferSize();
  }

  private checkBufferSize(): void {
    if (
      this.metrics.length + this.logs.length + this.events.length > this.maxBufferSize ||
      this.traceBuffer.length > this.maxBufferSize
    ) {
      void this.flush(); // Trigger flush if buffer is full
    }
  }

  async getTelemetryData(): Promise<TelemetryData> {
    return {
      metrics: [...this.metrics],
      logs: [...this.logs],
      events: [...this.events],
      traces: [...this.traceBuffer],
    };
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Don't flush if we don't have an endpoint
    if (!this.endpoint) {
      // Still clear the buffers if no endpoint is configured
      this.metrics = [];
      this.logs = [];
      this.events = [];
      this.traceBuffer = [];
      return;
    }

    // Collect data to send
    const data = await this.getTelemetryData();

    // Prepare payload
    const payload = {
      metrics: data.metrics,
      logs: data.logs,
      events: data.events,
      traces: data.traces.map(span => span.toJSON()),
      timestamp: Date.now(),
      service: 'realllm',
      version: env.npm_package_version || 'unknown',
    };

    try {
      // Send data to telemetry endpoint
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Telemetry-Source': 'realllm-enterprise',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Telemetry API returned status ${response.status}`);
      }

      // Clear buffers after successful send
      this.metrics = [];
      this.logs = [];
      this.events = [];
      this.traceBuffer = [];

      logger.info('Telemetry data successfully sent', {
        metrics: data.metrics.length,
        logs: data.logs.length,
        events: data.events.length,
        traces: data.traces.length,
      });
    } catch (error: any) {
      logger.error('Failed to send telemetry data', {
        error: error.message,
        endpoint: this.endpoint,
      });

      // In case of failure, we keep the data for the next flush attempt
    }

    // Schedule next flush
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, this.flushInterval);
  }

  // Start the automatic flush interval
  start(): void {
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        void this.flush();
      }, this.flushInterval);
    }
  }

  // Stop the automatic flush interval
  stop(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// Telemetry service singleton
export class TelemetryService {
  private static instance: TelemetryService;
  private collector: TelemetryCollector;
  private tracer: Tracer;
  private isEnabled: boolean = false;
  private sampleRate: number = 1.0; // Default to 100% sampling

  private constructor() {
    // Initialize based on environment and configuration
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Check if env is available
    const hasEnv = typeof env !== 'undefined';
    
    // Check if telemetry is enabled either via env or enterprise config
    const isTelemetryEnabled = 
      (hasEnv && (env.ENABLE_TELEMETRY === true || env.ENABLE_TELEMETRY === 'true')) ||
      await isEnterpriseFeatureEnabled('performanceMonitoring');

    if (isTelemetryEnabled) {
      this.isEnabled = true;
      
      // Get sample rate from enterprise config
      const config = await enterpriseConfigManager.getEnterpriseConfig();
      this.sampleRate = config.performance.monitoring.sampleRate;
      
      // Initialize appropriate collector based on environment
      if ((hasEnv && env.NODE_ENV === 'development') || (hasEnv && env.TELEMETRY_MODE === 'console')) {
        this.collector = new ConsoleTelemetryCollector();
      } else {
        const collector = new EnterpriseTelemetryCollector(
          hasEnv ? parseInt(env.TELEMETRY_FLUSH_INTERVAL || '30000', 10) : 30000,
          hasEnv ? parseInt(env.TELEMETRY_MAX_BUFFER_SIZE || '1000', 10) : 1000,
          hasEnv ? env.TELEMETRY_ENDPOINT || null : null,
          hasEnv ? env.TELEMETRY_API_KEY || null : null
        );
        
        this.collector = collector;
        collector.start();
      }
    } else {
      // Use console collector as fallback even when disabled
      // This allows logs to still appear in console
      this.collector = new ConsoleTelemetryCollector();
    }

    this.tracer = globalTracer;
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Check if a request should be sampled based on the sample rate
   */
  private shouldSample(): boolean {
    if (this.sampleRate >= 1.0) return true;
    if (this.sampleRate <= 0) return false;
    return Math.random() < this.sampleRate;
  }

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, type: Metric['type'], labels?: Record<string, string>): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    const metric: Metric = {
      name,
      value,
      type,
      labels,
      timestamp: Date.now(),
    };

    this.collector.recordMetric(metric);
  }

  /**
   * Record a log entry
   */
  recordLog(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    if (!this.shouldSample()) return;

    // Always record logs regardless of enabled state for visibility
    const log: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
    };

    this.collector.recordLog(log);
  }

  /**
   * Record an event
   */
  recordEvent(name: string, properties: Record<string, any>, userId?: string, sessionId?: string): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    const event: Event = {
      name,
      properties,
      timestamp: Date.now(),
      userId,
      sessionId,
    };

    this.collector.recordEvent(event);
  }

  /**
   * Start a new trace span
   */
  startSpan(name: string, parentSpan?: Span): Span {
    if (!this.isEnabled) {
      // Even if disabled, we might want to return a no-op span for API compatibility
      return {
        getContext: () => ({ traceId: '', spanId: '' }),
        setAttribute: () => this as any,
        setAttributes: () => this as any,
        addEvent: () => this as any,
        setStatus: () => this as any,
        end: () => {},
        isEnded: () => true,
        duration: () => 0,
        toJSON: () => ({}),
      } as Span;
    }

    return this.tracer.startSpan(name, parentSpan);
  }

  /**
   * Get the global tracer
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Get current telemetry data
   */
  async getTelemetryData(): Promise<TelemetryData> {
    return await this.collector.getTelemetryData();
  }

  /**
   * Force flush all telemetry data
   */
  async flush(): Promise<void> {
    await this.collector.flush();
  }

  /**
   * Shutdown the telemetry service
   */
  async shutdown(): Promise<void> {
    if (this.collector instanceof EnterpriseTelemetryCollector) {
      this.collector.stop();
    }
    await this.flush();
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isEnabled || !this.shouldSample()) {
      return await fn();
    }

    const span = this.startSpan(name);
    try {
      const result = await fn();
      span.setStatus({ code: 'OK' });
      return result;
    } catch (error: any) {
      span.setStatus({ code: 'ERROR', message: error.message });
      span.setAttribute('error', true);
      span.setAttribute('error.message', error.message);
      throw error;
    } finally {
      span.end();
      // Record duration as a metric
      this.recordMetric(`${name}.duration`, span.duration(), 'timer');
    }
  }

  /**
   * Record API performance metrics
   */
  recordApiMetrics(
    endpoint: string, 
    provider: string | null, 
    duration: number, 
    success: boolean,
    context?: Record<string, any>
  ): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    const baseName = provider ? `api.${endpoint}.${provider}` : `api.${endpoint}`;
    
    this.recordMetric(`${baseName}.duration`, duration, 'timer', {
      ...context,
      success: success.toString(),
      provider: provider || 'unknown',
    });

    if (success) {
      this.recordMetric(`${baseName}.success`, 1, 'counter', context);
    } else {
      this.recordMetric(`${baseName}.error`, 1, 'counter', context);
    }
  }

  /**
   * Record database performance metrics
   */
  recordDatabaseMetrics(
    operation: string,
    entity: string,
    duration: number,
    success: boolean,
    context?: Record<string, any>
  ): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    const baseName = `db.${operation}.${entity}`;
    
    this.recordMetric(`${baseName}.duration`, duration, 'timer', {
      ...context,
      success: success.toString(),
    });

    if (success) {
      this.recordMetric(`${baseName}.success`, 1, 'counter', context);
    } else {
      this.recordMetric(`${baseName}.error`, 1, 'counter', context);
    }
  }

  /**
   * Record provider performance metrics
   */
  recordProviderMetrics(
    provider: string,
    model: string,
    duration: number,
    success: boolean,
    context?: Record<string, any>
  ): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    const baseName = `provider.${provider}.${model}`;
    
    this.recordMetric(`${baseName}.duration`, duration, 'timer', {
      ...context,
      success: success.toString(),
    });

    if (success) {
      this.recordMetric(`${baseName}.success`, 1, 'counter', context);
    } else {
      this.recordMetric(`${baseName}.error`, 1, 'counter', context);
    }
  }

  /**
   * Record cache performance metrics
   */
  recordCacheMetrics(
    operation: string,
    key: string,
    hit: boolean,
    duration: number,
    context?: Record<string, any>
  ): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    const baseName = `cache.${operation}`;
    
    this.recordMetric(`${baseName}.duration`, duration, 'timer', {
      ...context,
      hit: hit.toString(),
      key,
    });

    if (hit) {
      this.recordMetric(`${baseName}.hit`, 1, 'counter', context);
    } else {
      this.recordMetric(`${baseName}.miss`, 1, 'counter', context);
    }
  }

  /**
   * Record system resource metrics
   */
  recordResourceMetrics(memoryUsed: number, cpuUsage: number, context?: Record<string, any>): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    this.recordMetric('system.memory.used', memoryUsed, 'gauge', context);
    this.recordMetric('system.cpu.usage', cpuUsage, 'gauge', context);
  }

  /**
   * Enable/disable telemetry
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    
    if (!enabled && this.collector instanceof EnterpriseTelemetryCollector) {
      this.collector.stop();
    } else if (enabled && this.collector instanceof EnterpriseTelemetryCollector) {
      this.collector.start();
    }
  }

  /**
   * Get telemetry status
   */
  getStatus(): { enabled: boolean; sampleRate: number; collectorType: string } {
    return {
      enabled: this.isEnabled,
      sampleRate: this.sampleRate,
      collectorType: this.collector.constructor.name,
    };
  }
}

// Export the singleton instance
export const telemetryService = TelemetryService.getInstance();

// Convenience functions for common telemetry operations
export const recordApiCall = (
  endpoint: string,
  provider: string | null,
  duration: number,
  success: boolean,
  context?: Record<string, any>
) => {
  telemetryService.recordApiMetrics(endpoint, provider, duration, success, context);
};

export const recordDatabaseQuery = (
  operation: string,
  entity: string,
  duration: number,
  success: boolean,
  context?: Record<string, any>
) => {
  telemetryService.recordDatabaseMetrics(operation, entity, duration, success, context);
};

export const recordProviderCall = (
  provider: string,
  model: string,
  duration: number,
  success: boolean,
  context?: Record<string, any>
) => {
  telemetryService.recordProviderMetrics(provider, model, duration, success, context);
};

export const measureFunction = <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  return telemetryService.measure(name, fn);
};

// Export the tracing middleware for use in API routes
export { tracingMiddleware };

// Export the trace decorator
export { trace };

// Export Span and Tracer for advanced usage
export { Span, Tracer };

// Performance monitoring utilities
export class PerformanceMonitor {
  private static readonly LONG_TASK_THRESHOLD = 50; // 50ms threshold for long tasks

  /**
   * Monitor function execution with performance tracking
   */
  static async monitor<T>(
    name: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    let result: T;
    let error: any = null;

    try {
      result = await telemetryService.measure(name, fn);
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = performance.now() - startTime;

      // Record performance metrics
      telemetryService.recordMetric(
        `${name}.execution.time`,
        duration,
        'timer',
        context
      );

      // Record long task if applicable
      if (duration > PerformanceMonitor.LONG_TASK_THRESHOLD) {
        telemetryService.recordMetric(
          `${name}.execution.long_task`,
          1,
          'counter',
          { ...context, duration: duration.toFixed(2) }
        );
      }

      // Record error metrics if applicable
      if (error) {
        telemetryService.recordMetric(
          `${name}.execution.error`,
          1,
          'counter',
          { ...context, error: error.message }
        );
      }
    }

    return result!;
  }

  /**
   * Monitor a database query
   */
  static async monitorDatabaseQuery<T>(
    operation: string,
    entity: string,
    query: () => Promise<T>
  ): Promise<T> {
    return PerformanceMonitor.monitor(`db.${operation}.${entity}`, query, {
      operation,
      entity,
    });
  }

  /**
   * Monitor an API call
   */
  static async monitorApiCall<T>(
    endpoint: string,
    provider: string | null,
    call: () => Promise<T>
  ): Promise<T> {
    const name = provider ? `api.${endpoint}.${provider}` : `api.${endpoint}`;
    return PerformanceMonitor.monitor(name, call, {
      endpoint,
      provider: provider || 'none',
    });
  }

  /**
   * Monitor a provider call
   */
  static async monitorProviderCall<T>(
    provider: string,
    model: string,
    call: () => Promise<T>
  ): Promise<T> {
    return PerformanceMonitor.monitor(
      `provider.${provider}.${model}`,
      call,
      { provider, model }
    );
  }
}

// Export performance monitor
export { PerformanceMonitor as performanceMonitor };

// Telemetry health check
export async function telemetryHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}> {
  try {
    const status = telemetryService.getStatus();
    const data = await telemetryService.getTelemetryData();

    const details = {
      enabled: status.enabled,
      sampleRate: status.sampleRate,
      collectorType: status.collectorType,
      metricsCount: data.metrics.length,
      logsCount: data.logs.length,
      eventsCount: data.events.length,
      spansCount: data.traces.length,
    };

    // Consider unhealthy if metrics are enabled but there's an issue with the collector
    if (status.enabled && status.collectorType === 'EnterpriseTelemetryCollector') {
      // Additional checks for enterprise collector
      return { status: 'healthy', details };
    }

    return { status: 'healthy', details };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      details: {
        error: error.message,
      },
    };
  }
}