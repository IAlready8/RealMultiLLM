import { logger } from './logger';
import { Counter } from './metrics';
import { configManager } from '../config';

// Type definitions for telemetry data
export interface TelemetryEvent {
  id: string;
  name: string;
  timestamp: Date;
  properties: Record<string, any>;
  userId?: string;
  sessionId?: string;
  type: 'user_action' | 'system_event' | 'performance_metric';
}

export interface PerformanceMetric {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

export interface TelemetryConfig {
  enabled: boolean;
  sampleRate: number;
  apiKey: string | null;
  endpoint: string | null;
  bufferSize: number;
  flushInterval: number;
  maxQueueSize: number;
}

// Telemetry manager class
export class TelemetryManager {
  private static instance: TelemetryManager;
  private config: TelemetryConfig;
  private buffer: TelemetryEvent[];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private flushIntervalId: NodeJS.Timeout | null = null;
  private eventQueue: TelemetryEvent[] = [];
  private performanceMetrics: Record<string, number> = {};
  private logger = logger;
  private metrics: Counter;
  private maxQueueSize = 1000;
  private MAX_QUEUE_SIZE = 1000;

  constructor(config?: TelemetryConfig) {
    this.config = config || {
      enabled: false,
      sampleRate: 1.0,
      apiKey: null,
      endpoint: null,
      bufferSize: 100,
      flushInterval: 30000,
      maxQueueSize: 1000
    };
    this.buffer = [];
    this.metrics = new Counter('telemetry-metrics', 'Metrics for telemetry system');
  }

  public static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      // Get config from configManager, fall back to defaults
      const appConfig = configManager.getConfig();
      const telemetryConfig: TelemetryConfig = {
        enabled: appConfig.enableTelemetry || false,
        sampleRate: 1.0,
        apiKey: null, // Should come from secure storage
        endpoint: null, // Should be configured in environment
        bufferSize: 100,
        flushInterval: 30000,
        maxQueueSize: 1000
      };
      TelemetryManager.instance = new TelemetryManager(telemetryConfig);
    }
    return TelemetryManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Telemetry manager already initialized');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Telemetry disabled');
      this.isInitialized = true;
      return;
    }

    // Start periodic flushing
    this.flushIntervalId = setInterval(() => {
      this.flush().catch(error => {
        logger.error('Failed to flush telemetry data', { error: (error as Error).message });
      });
    }, this.config.flushInterval);

    logger.info('Telemetry manager initialized', {
      enabled: this.config.enabled,
      sampleRate: this.config.sampleRate,
      bufferSize: this.config.bufferSize,
      flushInterval: this.config.flushInterval,
    });

    this.isInitialized = true;
  }

  /**
   * Track a custom event
   */
  public trackEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }

    const telemetryEvent: TelemetryEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event
    };

    // Add to queue
    this.eventQueue.push(telemetryEvent);
    
    // Flush if queue is full
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      this.flush().catch(error => {
        this.logger.error('Failed to flush telemetry data', { error: (error as Error).message });
      });
    }

    // Record metric
    this.metrics.inc(1);
  }

  /**
   * Track performance metric
   */
  public trackPerformance(metric: PerformanceMetric): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }

    // Track performance metrics in the buffer for flushing
    const metricKey = `${metric.name}_${Date.now()}`;
    this.performanceMetrics[metricKey] = metric.value;

    // Record through metrics system as well
    this.metrics.inc(metric.value);
  }

  /**
   * Measure execution time of a function
   */
  public async measureExecution<T>(
    name: string,
    fn: () => Promise<T> | T,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const start = performance.now();
    let result: T;
    let error: any;

    try {
      result = await Promise.resolve(fn());
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = performance.now() - start;
      
      // Track performance metric
      this.trackPerformance({
        name: `${name}_duration`,
        value: duration,
        tags: { ...tags, success: !error ? 'true' : 'false' }
      });

      // Track as counter metric instead of histogram
      this.metrics.inc(1);
    }
  }

  /**
   * Add properties to all subsequent events
   */
  public setUserProperties(properties: Record<string, any>): void {
    // In a real implementation, this would set context for all subsequent events
    this.logger.debug('Setting user properties', { properties });
  }

  /**
   * Flush all queued telemetry data
   */
  public async flush(): Promise<void> {
    if (!this.config.enabled || (this.eventQueue.length === 0 && Object.keys(this.performanceMetrics).length === 0)) {
      return;
    }

    const eventsToFlush = [...this.eventQueue];
    const metricsToFlush = { ...this.performanceMetrics };

    // Clear queues
    this.eventQueue = [];
    this.performanceMetrics = {};

    try {
      // In a real implementation, we would send the data to a telemetry backend
      // For now, we'll just log the data if in development
      const appConfig = configManager.getConfig();
      
      if (appConfig.environment === 'development') {
        this.logger.debug('Flushing telemetry data', {
          eventCount: eventsToFlush.length,
          metricCount: Object.keys(metricsToFlush).length,
          events: eventsToFlush.slice(0, 5), // Log only first 5 events to avoid excessive logging
          metrics: Object.entries(metricsToFlush).slice(0, 5)
        });
      }

      // Send to external telemetry service if endpoint is configured
      if (this.config.endpoint && this.config.apiKey) {
        await this.sendToTelemetryService(eventsToFlush, metricsToFlush);
      }

      this.logger.info('Telemetry data flushed', {
        eventsSent: eventsToFlush.length,
        metricsSent: Object.keys(metricsToFlush).length
      });

      this.metrics.inc(1);
    } catch (error) {
      this.logger.error('Failed to flush telemetry data', { error: (error as Error).message });
      
      // Add events back to queue if sending failed (with size limits)
      if (eventsToFlush.length + this.eventQueue.length < this.MAX_QUEUE_SIZE) {
        this.eventQueue.unshift(...eventsToFlush);
      }
      
      // Restore metrics to queue (object merge)
      if (Object.keys(metricsToFlush).length + Object.keys(this.performanceMetrics).length < this.MAX_QUEUE_SIZE) {
        this.performanceMetrics = { ...this.performanceMetrics, ...metricsToFlush };
      }
      
      this.metrics.inc(1); // Track error
      throw error;
    }
  }

  /**
   * Send telemetry data to external service
   */
  private async sendToTelemetryService(
    events: TelemetryEvent[],
    metrics: Record<string, number>
  ): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      return;
    }

    // Prepare payload
    const payload = {
      events,
      metrics,
      timestamp: new Date().toISOString(),
      source: configManager.getConfig().appName,
      version: process.env.npm_package_version || 'unknown'
    };

    try {
      // Using fetch or similar to send data to telemetry service
      // Note: In a Node.js environment, we'd need to use node-fetch or similar
      // This is a placeholder implementation
      this.logger.debug('Sending telemetry data to external service', {
        endpoint: this.config.endpoint,
        payloadSize: JSON.stringify(payload).length
      });

      // In a real implementation:
      // const response = await fetch(this.config.endpoint, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.config.apiKey}`,
      //     'User-Agent': `${configManager.getConfig().appName}/${process.env.npm_package_version || 'unknown'}`
      //   },
      //   body: JSON.stringify(payload)
      // });
      //
      // if (!response.ok) {
      //   throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      // }
    } catch (error) {
      this.logger.error('Failed to send telemetry data to service', { 
        error: (error as Error).message,
        endpoint: this.config.endpoint 
      });
      throw error;
    }
  }

  /**
   * Generate a unique ID for telemetry events
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Shutdown the telemetry system
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    // Clear the flush interval
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }

    // Flush remaining data
    try {
      await this.flush();
    } catch (error) {
      this.logger.error('Failed to flush telemetry during shutdown', { error: (error as Error).message });
    }

    this.logger.info('Telemetry manager shutdown complete');
    this.isInitialized = false;
  }

  /**
   * Get current queue sizes for monitoring
   */
  public getQueueSizes(): { events: number; metrics: number } {
    return {
      events: this.eventQueue.length,
      metrics: Object.keys(this.performanceMetrics).length
    };
  }

  /**
   * Check if telemetry is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Create and initialize singleton instance
const telemetryManager = TelemetryManager.getInstance();

// Initialize telemetry when the module loads (in a non-blocking way)
Promise.resolve().then(async () => {
  try {
    await telemetryManager.initialize();
  } catch (error) {
    console.error('Failed to initialize telemetry manager:', error);
  }
});

// Convenience functions
export const trackEvent = (event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void => {
  telemetryManager.trackEvent(event);
};

export const trackPerformance = (metric: PerformanceMetric): void => {
  telemetryManager.trackPerformance(metric);
};

export const measureExecution = <T>(
  name: string,
  fn: () => Promise<T> | T,
  tags: Record<string, string> = {}
): Promise<T> => {
  return telemetryManager.measureExecution(name, fn, tags);
};

export const flushTelemetry = (): Promise<void> => {
  return telemetryManager.flush();
};

export { telemetryManager };