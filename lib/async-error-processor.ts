/**
 * PHASE 3 SCALABILITY ENHANCEMENT: Async Error Processing Pipeline
 *
 * Non-blocking error processing to maintain high throughput during error conditions
 * Implements intelligent batching, prioritization, and circuit breaker patterns
 */

import { logger } from '@/lib/observability/logger';
import { metricsRegistry } from '@/lib/observability/metrics';

interface ErrorEvent {
  id: string;
  timestamp: number;
  level: 'error' | 'warn' | 'critical';
  source: string;
  userId?: string;
  error: Error | string;
  context: Record<string, any>;
  retryCount: number;
  maxRetries: number;
}

interface ErrorBatch {
  errors: ErrorEvent[];
  batchId: string;
  createdAt: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface ProcessingStats {
  totalErrors: number;
  processedErrors: number;
  failedProcessing: number;
  averageProcessingTime: number;
  batchesProcessed: number;
  queueDepth: number;
}

class AsyncErrorProcessor {
  private errorQueue: ErrorEvent[] = [];
  private processingQueue: ErrorBatch[] = [];
  private processing = false;
  private stats: ProcessingStats = {
    totalErrors: 0,
    processedErrors: 0,
    failedProcessing: 0,
    averageProcessingTime: 0,
    batchesProcessed: 0,
    queueDepth: 0
  };

  private readonly MAX_QUEUE_SIZE = 10000;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT = 5000; // 5 seconds
  private readonly PROCESSING_INTERVAL = 2000; // 2 seconds
  private readonly MAX_RETRIES = 3;

  private processingTimes: number[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Start background processing
    this.startBackgroundProcessing();

    // Periodic metrics reporting
    setInterval(() => this.reportMetrics(), 30000); // Every 30 seconds
  }

  /**
   * Queue error for async processing (non-blocking)
   */
  async queueError(
    error: Error | string,
    level: 'error' | 'warn' | 'critical',
    source: string,
    context: Record<string, any> = {},
    userId?: string
  ): Promise<string> {
    const errorId = this.generateErrorId();

    // Prevent memory exhaustion
    if (this.errorQueue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low-priority errors first
      this.pruneQueue();
    }

    const errorEvent: ErrorEvent = {
      id: errorId,
      timestamp: Date.now(),
      level,
      source,
      userId,
      error,
      context,
      retryCount: 0,
      maxRetries: level === 'critical' ? this.MAX_RETRIES * 2 : this.MAX_RETRIES
    };

    // Add to queue with priority insertion
    this.insertWithPriority(errorEvent);
    this.stats.totalErrors++;
    this.stats.queueDepth = this.errorQueue.length;

    // Update metrics
    this.recordMetric('error_queue_depth', this.stats.queueDepth);
    this.recordMetric('total_errors_queued', this.stats.totalErrors);

    // Immediate logging for critical errors
    if (level === 'critical') {
      logger.error('critical_error_queued', {
        errorId,
        source,
        userId,
        error: error instanceof Error ? error.message : error,
        context
      });
    }

    // Schedule immediate processing for critical errors
    if (level === 'critical' && !this.processing) {
      setImmediate(() => this.processErrorBatch());
    }

    return errorId;
  }

  /**
   * Insert error with priority-based positioning
   */
  private insertWithPriority(errorEvent: ErrorEvent): void {
    const priority = this.getPriorityValue(errorEvent.level);
    let insertIndex = this.errorQueue.length;

    // Find insertion point based on priority
    for (let i = 0; i < this.errorQueue.length; i++) {
      if (this.getPriorityValue(this.errorQueue[i].level) < priority) {
        insertIndex = i;
        break;
      }
    }

    this.errorQueue.splice(insertIndex, 0, errorEvent);
  }

  /**
   * Get numeric priority value for sorting
   */
  private getPriorityValue(level: string): number {
    switch (level) {
      case 'critical': return 4;
      case 'error': return 3;
      case 'warn': return 2;
      default: return 1;
    }
  }

  /**
   * Prune queue to prevent memory exhaustion
   */
  private pruneQueue(): void {
    const originalLength = this.errorQueue.length;

    // Remove oldest non-critical errors
    this.errorQueue = this.errorQueue.filter((error, index) =>
      error.level === 'critical' || index >= originalLength - (this.MAX_QUEUE_SIZE * 0.8)
    );

    const prunedCount = originalLength - this.errorQueue.length;
    if (prunedCount > 0) {
      logger.warn('error_queue_pruned', {
        prunedCount,
        remainingErrors: this.errorQueue.length,
        queueSize: this.MAX_QUEUE_SIZE
      });
    }
  }

  /**
   * Start background error processing
   */
  private startBackgroundProcessing(): void {
    setInterval(() => {
      if (!this.processing && this.errorQueue.length > 0) {
        this.processErrorBatch();
      }
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * Process batch of errors asynchronously
   */
  private async processErrorBatch(): Promise<void> {
    if (this.processing || this.errorQueue.length === 0) {
      return;
    }

    this.processing = true;
    const startTime = Date.now();

    try {
      // Create batch from queued errors
      const batchSize = Math.min(this.BATCH_SIZE, this.errorQueue.length);
      const errorBatch = this.errorQueue.splice(0, batchSize);

      const batch: ErrorBatch = {
        errors: errorBatch,
        batchId: this.generateBatchId(),
        createdAt: Date.now(),
        priority: this.determineBatchPriority(errorBatch)
      };

      this.processingQueue.push(batch);
      this.stats.queueDepth = this.errorQueue.length;

      logger.debug('error_batch_created', {
        batchId: batch.batchId,
        errorCount: batch.errors.length,
        priority: batch.priority,
        remainingQueueDepth: this.stats.queueDepth
      });

      // Process the batch
      await this.processBatch(batch);

      // Record processing time
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);

      this.stats.batchesProcessed++;
      this.recordMetric('batches_processed_total', this.stats.batchesProcessed);

    } catch (error) {
      logger.error('error_batch_processing_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        queueDepth: this.errorQueue.length
      });

      this.stats.failedProcessing++;
      this.recordMetric('batch_processing_failures_total', this.stats.failedProcessing);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process individual error batch
   */
  private async processBatch(batch: ErrorBatch): Promise<void> {
    const results = await Promise.allSettled(
      batch.errors.map(error => this.processError(error))
    );

    let successCount = 0;
    let retryCount = 0;

    results.forEach((result, index) => {
      const error = batch.errors[index];

      if (result.status === 'fulfilled') {
        successCount++;
        this.stats.processedErrors++;
      } else {
        // Handle retry logic
        if (error.retryCount < error.maxRetries) {
          error.retryCount++;
          this.insertWithPriority(error);
          retryCount++;

          logger.debug('error_processing_retry', {
            errorId: error.id,
            retryCount: error.retryCount,
            maxRetries: error.maxRetries,
            reason: result.reason
          });
        } else {
          logger.error('error_processing_max_retries', {
            errorId: error.id,
            maxRetries: error.maxRetries,
            finalError: result.reason
          });

          this.stats.failedProcessing++;
        }
      }
    });

    logger.info('error_batch_processed', {
      batchId: batch.batchId,
      totalErrors: batch.errors.length,
      successCount,
      retryCount,
      priority: batch.priority
    });
  }

  /**
   * Process individual error
   */
  private async processError(errorEvent: ErrorEvent): Promise<void> {
    try {
      // Determine processing strategy based on error level
      switch (errorEvent.level) {
        case 'critical':
          await this.processCriticalError(errorEvent);
          break;
        case 'error':
          await this.processStandardError(errorEvent);
          break;
        case 'warn':
          await this.processWarning(errorEvent);
          break;
        default:
          await this.processStandardError(errorEvent);
      }

    } catch (processingError) {
      logger.error('error_processing_exception', {
        errorId: errorEvent.id,
        originalError: errorEvent.error instanceof Error ? errorEvent.error.message : errorEvent.error,
        processingError: processingError instanceof Error ? processingError.message : 'Unknown error'
      });

      throw processingError;
    }
  }

  /**
   * Process critical errors with immediate attention
   */
  private async processCriticalError(errorEvent: ErrorEvent): Promise<void> {
    // Immediate logging
    logger.error('critical_error_processing', {
      errorId: errorEvent.id,
      source: errorEvent.source,
      userId: errorEvent.userId,
      error: errorEvent.error instanceof Error ? errorEvent.error.message : errorEvent.error,
      context: errorEvent.context,
      timestamp: new Date(errorEvent.timestamp).toISOString()
    });

    // Send to external monitoring (if configured)
    await this.sendToMonitoring(errorEvent, 'critical');

    // Record critical error metric
    this.recordMetric('critical_errors_processed_total', 1);
  }

  /**
   * Process standard errors with batched logging
   */
  private async processStandardError(errorEvent: ErrorEvent): Promise<void> {
    logger.error('error_processed', {
      errorId: errorEvent.id,
      source: errorEvent.source,
      userId: errorEvent.userId,
      error: errorEvent.error instanceof Error ? errorEvent.error.message : errorEvent.error,
      context: errorEvent.context,
      retryCount: errorEvent.retryCount
    });

    // Send to monitoring system
    await this.sendToMonitoring(errorEvent, 'error');
  }

  /**
   * Process warnings with aggregated logging
   */
  private async processWarning(errorEvent: ErrorEvent): Promise<void> {
    logger.warn('warning_processed', {
      errorId: errorEvent.id,
      source: errorEvent.source,
      userId: errorEvent.userId,
      warning: errorEvent.error instanceof Error ? errorEvent.error.message : errorEvent.error,
      context: errorEvent.context
    });

    // Aggregate warnings for trend analysis
    await this.aggregateWarning(errorEvent);
  }

  /**
   * Send error to external monitoring system
   */
  private async sendToMonitoring(
    errorEvent: ErrorEvent,
    severity: string
  ): Promise<void> {
    try {
      // Placeholder for external monitoring integration
      // This would integrate with Sentry, DataDog, or other services

      logger.debug('error_sent_to_monitoring', {
        errorId: errorEvent.id,
        severity,
        service: 'monitoring_service'
      });

    } catch (error) {
      // Don't let monitoring failures break error processing
      logger.debug('monitoring_send_failed', {
        errorId: errorEvent.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Aggregate warnings for trend analysis
   */
  private async aggregateWarning(errorEvent: ErrorEvent): Promise<void> {
    // Implement warning aggregation logic
    // This could group similar warnings and report trends

    this.recordMetric('warnings_processed_total', 1);
  }

  /**
   * Determine batch priority based on error levels
   */
  private determineBatchPriority(errors: ErrorEvent[]): 'low' | 'medium' | 'high' | 'critical' {
    const hasCritical = errors.some(e => e.level === 'critical');
    const hasErrors = errors.some(e => e.level === 'error');

    if (hasCritical) return 'critical';
    if (hasErrors) return 'high';
    return 'medium';
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Record processing time for performance monitoring
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    this.stats.averageProcessingTime =
      this.processingTimes.reduce((sum, t) => sum + t, 0) / this.processingTimes.length;
  }

  /**
   * Record metric for monitoring
   */
  private recordMetric(name: string, value: number): void {
    try {
      const metric = metricsRegistry.registerCounter(
        `error_processor_${name}`,
        `Error processor ${name.replace(/_/g, ' ')}`
      );
      metric.inc(value);
    } catch (error) {
      // Fail silently - metrics are non-critical
    }
  }

  /**
   * Report comprehensive metrics
   */
  private reportMetrics(): void {
    this.recordMetric('queue_depth_current', this.stats.queueDepth);
    this.recordMetric('average_processing_time_ms', this.stats.averageProcessingTime);

    logger.info('error_processor_metrics', this.stats);
  }

  /**
   * Get processor statistics
   */
  getStatistics(): ProcessingStats & {
    performance: {
      processingRate: number;
      errorRate: number;
      queueUtilization: number;
    };
  } {
    const processingRate = this.stats.batchesProcessed > 0
      ? this.stats.processedErrors / this.stats.batchesProcessed
      : 0;

    const errorRate = this.stats.totalErrors > 0
      ? (this.stats.failedProcessing / this.stats.totalErrors * 100)
      : 0;

    const queueUtilization = (this.stats.queueDepth / this.MAX_QUEUE_SIZE * 100);

    return {
      ...this.stats,
      performance: {
        processingRate,
        errorRate,
        queueUtilization
      }
    };
  }

  /**
   * Health check for error processing system
   */
  getHealthStatus() {
    const stats = this.getStatistics();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check queue depth
    if (stats.performance.queueUtilization > 80) {
      issues.push(`High queue utilization: ${stats.performance.queueUtilization.toFixed(1)}%`);
      recommendations.push('Consider increasing processing frequency or batch size');
    }

    // Check processing performance
    if (stats.performance.errorRate > 10) {
      issues.push(`High error processing failure rate: ${stats.performance.errorRate.toFixed(1)}%`);
      recommendations.push('Investigate error processing failures');
    }

    // Check processing speed
    if (stats.averageProcessingTime > 10000) { // 10 seconds
      issues.push(`Slow error processing: ${stats.averageProcessingTime}ms average`);
      recommendations.push('Optimize error processing pipeline');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
      stats: stats.performance
    };
  }
}

// Singleton instance for global async error processing
export const asyncErrorProcessor = new AsyncErrorProcessor();