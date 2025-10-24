import { auditLogger } from './audit-logger';
import { monitoring } from './monitoring';

/**
 * Enterprise-grade resilience and fault tolerance system
 * Implements circuit breaker, retry policies, timeouts, and graceful degradation
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
  minimumRequests: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  jitter: boolean;
}

export interface TimeoutConfig {
  timeout: number;
  abortSignal?: AbortSignal;
}

export interface BulkheadConfig {
  maxConcurrency: number;
  queueSize: number;
  queueTimeout: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private totalRequests = 0;
  private readonly name: string;

  constructor(
    private readonly config: CircuitBreakerConfig,
    name: string = 'default'
  ) {
    this.name = name;
  }

  public async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        monitoring.recordMetric(`circuit_breaker_${this.name}_state_change`, 1, { state: 'half_open' });
      } else {
        // Circuit is open, use fallback or throw
        if (fallback) {
          monitoring.recordMetric(`circuit_breaker_${this.name}_fallback`, 1);
          return fallback();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    this.totalRequests++;
    const startTime = Date.now();

    try {
      const result = await operation();
      this.onSuccess();
      monitoring.recordMetric(`circuit_breaker_${this.name}_success`, 1);
      return result;
    } catch (error) {
      this.onFailure();
      monitoring.recordMetric(`circuit_breaker_${this.name}_failure`, 1);
      
      // If circuit opened and fallback available, use it
      if (this.getState().state === CircuitBreakerState.OPEN && fallback) {
        monitoring.recordMetric(`circuit_breaker_${this.name}_fallback`, 1);
        return fallback();
      }
      
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      monitoring.recordMetric(`circuit_breaker_${this.name}_duration`, duration, {}, 'milliseconds');
    }
  }

  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      monitoring.recordMetric(`circuit_breaker_${this.name}_state_change`, 1, { state: 'closed' });
      
      auditLogger.logSecurityEvent(
        'circuit_breaker_recovered',
        'success',
        { name: this.name, totalRequests: this.totalRequests },
        {},
        'medium'
      );
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.shouldOpenCircuit()) {
      this.state = CircuitBreakerState.OPEN;
      monitoring.recordMetric(`circuit_breaker_${this.name}_state_change`, 1, { state: 'open' });
      
      auditLogger.logSecurityEvent(
        'circuit_breaker_opened',
        'warning',
        { 
          name: this.name, 
          failureCount: this.failureCount,
          totalRequests: this.totalRequests,
          failureRate: this.failureCount / this.totalRequests
        },
        {},
        'high'
      );
    }
  }

  private shouldOpenCircuit(): boolean {
    if (this.totalRequests < this.config.minimumRequests) {
      return false;
    }

    const failureRate = this.failureCount / this.totalRequests;
    return failureRate >= this.config.failureThreshold;
  }

  public getState(): {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    totalRequests: number;
    failureRate: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? this.failureCount / this.totalRequests : 0
    };
  }

  public reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = 0;
  }
}

export class RetryPolicy {
  constructor(private readonly config: RetryConfig) {}

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.config.maxAttempts) {
      attempt++;
      
      try {
        const result = await operation();
        
        if (attempt > 1) {
          monitoring.recordMetric('retry_success', 1, { attempt: attempt.toString() });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        monitoring.recordMetric('retry_attempt', 1, { attempt: attempt.toString() });

        if (attempt === this.config.maxAttempts) {
          monitoring.recordMetric('retry_exhausted', 1);
          break;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    monitoring.recordMetric('retry_failure', 1, { attempts: this.config.maxAttempts.toString() });
    throw lastError || new Error('Retry policy exhausted');
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay;

    if (this.config.exponentialBackoff) {
      delay = Math.min(
        this.config.baseDelay * Math.pow(2, attempt - 1),
        this.config.maxDelay
      );
    }

    if (this.config.jitter) {
      // Add ±25% jitter
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Math.max(0, delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class Timeout {
  public static async execute<T>(
    operation: () => Promise<T>,
    config: TimeoutConfig
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${config.timeout}ms`));
      }, config.timeout);

      // Clear timeout if external abort signal is triggered
      config.abortSignal?.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('Operation aborted'));
      });
    });

    const startTime = Date.now();
    
    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      const duration = Date.now() - startTime;
      monitoring.recordMetric('timeout_success', 1, { duration: duration.toString() }, 'milliseconds');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      monitoring.recordMetric('timeout_failure', 1, { duration: duration.toString() }, 'milliseconds');
      
      if (error instanceof Error && error.message.includes('timed out')) {
        monitoring.recordMetric('timeout_exceeded', 1, { timeout: config.timeout.toString() });
      }
      
      throw error;
    }
  }
}

export class Bulkhead {
  private activeRequests = 0;
  private readonly queue: Array<{
    operation: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];

  constructor(private readonly config: BulkheadConfig) {}

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    // If we're under the concurrency limit, execute immediately
    if (this.activeRequests < this.config.maxConcurrency) {
      return this.executeOperation(operation);
    }

    // If queue is full, reject immediately
    if (this.queue.length >= this.config.queueSize) {
      monitoring.recordMetric('bulkhead_queue_full', 1);
      throw new Error('Bulkhead queue is full');
    }

    // Add to queue
    return new Promise<T>((resolve, reject) => {
      const queueItem = {
        operation: operation as () => Promise<any>,
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.queue.push(queueItem);
      monitoring.recordMetric('bulkhead_queued', 1, { queueSize: this.queue.length.toString() });

      // Set timeout for queued item
      setTimeout(() => {
        const index = this.queue.indexOf(queueItem);
        if (index >= 0) {
          this.queue.splice(index, 1);
          monitoring.recordMetric('bulkhead_queue_timeout', 1);
          reject(new Error('Bulkhead queue timeout'));
        }
      }, this.config.queueTimeout);
    });
  }

  private async executeOperation<T>(operation: () => Promise<T>): Promise<T> {
    this.activeRequests++;
    monitoring.recordMetric('bulkhead_active_requests', this.activeRequests);

    try {
      const result = await operation();
      monitoring.recordMetric('bulkhead_success', 1);
      return result;
    } catch (error) {
      monitoring.recordMetric('bulkhead_failure', 1);
      throw error;
    } finally {
      this.activeRequests--;
      monitoring.recordMetric('bulkhead_active_requests', this.activeRequests);
      
      // Process next item in queue
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.activeRequests >= this.config.maxConcurrency) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    // Check if item has timed out
    if (Date.now() - item.timestamp > this.config.queueTimeout) {
      monitoring.recordMetric('bulkhead_queue_timeout', 1);
      item.reject(new Error('Bulkhead queue timeout'));
      this.processQueue(); // Try next item
      return;
    }

    // Execute the queued operation
    this.executeOperation(item.operation)
      .then(item.resolve)
      .catch(item.reject);
  }

  public getStats(): {
    activeRequests: number;
    queueLength: number;
    utilization: number;
  } {
    return {
      activeRequests: this.activeRequests,
      queueLength: this.queue.length,
      utilization: this.activeRequests / this.config.maxConcurrency
    };
  }
}

// Resilience orchestrator that combines multiple patterns
export class ResilienceOrchestrator {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private bulkheads = new Map<string, Bulkhead>();

  public async execute<T>(
    name: string,
    operation: () => Promise<T>,
    options: {
      circuitBreaker?: CircuitBreakerConfig;
      retry?: RetryConfig;
      timeout?: TimeoutConfig;
      bulkhead?: BulkheadConfig;
      fallback?: () => Promise<T>;
    } = {}
  ): Promise<T> {
    let wrappedOperation = operation;

    // Apply timeout wrapper
    if (options.timeout) {
      const originalOp = wrappedOperation;
      wrappedOperation = () => Timeout.execute(originalOp, options.timeout!);
    }

    // Apply retry wrapper
    if (options.retry) {
      const originalOp = wrappedOperation;
      const retryPolicy = new RetryPolicy(options.retry);
      wrappedOperation = () => retryPolicy.execute(originalOp);
    }

    // Apply bulkhead wrapper
    if (options.bulkhead) {
      let bulkhead = this.bulkheads.get(name);
      if (!bulkhead) {
        bulkhead = new Bulkhead(options.bulkhead);
        this.bulkheads.set(name, bulkhead);
      }
      
      const originalOp = wrappedOperation;
      wrappedOperation = () => bulkhead!.execute(originalOp);
    }

    // Apply circuit breaker wrapper
    if (options.circuitBreaker) {
      let circuitBreaker = this.circuitBreakers.get(name);
      if (!circuitBreaker) {
        circuitBreaker = new CircuitBreaker(options.circuitBreaker, name);
        this.circuitBreakers.set(name, circuitBreaker);
      }

      return circuitBreaker.execute(wrappedOperation, options.fallback);
    }

    return wrappedOperation();
  }

  public getCircuitBreakerState(name: string) {
    return this.circuitBreakers.get(name)?.getState();
  }

  public getBulkheadStats(name: string) {
    return this.bulkheads.get(name)?.getStats();
  }

  public resetCircuitBreaker(name: string): void {
    this.circuitBreakers.get(name)?.reset();
  }

  public getAllStats(): {
    circuitBreakers: Record<string, any>;
    bulkheads: Record<string, any>;
  } {
    const circuitBreakers: Record<string, any> = {};
    const bulkheads: Record<string, any> = {};

    for (const [name, cb] of this.circuitBreakers) {
      circuitBreakers[name] = cb.getState();
    }

    for (const [name, bh] of this.bulkheads) {
      bulkheads[name] = bh.getStats();
    }

    return { circuitBreakers, bulkheads };
  }
}

// Default configurations for common use cases
export const defaultConfigs = {
  api: {
    circuitBreaker: {
      failureThreshold: 0.5, // 50% failure rate
      recoveryTimeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute
      minimumRequests: 10
    },
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBackoff: true,
      jitter: true
    },
    timeout: {
      timeout: 30000 // 30 seconds
    }
  },
  
  database: {
    circuitBreaker: {
      failureThreshold: 0.3, // 30% failure rate - more sensitive for DB
      recoveryTimeout: 60000, // 1 minute
      monitoringWindow: 120000, // 2 minutes
      minimumRequests: 5
    },
    retry: {
      maxAttempts: 2,
      baseDelay: 100,
      maxDelay: 1000,
      exponentialBackoff: true,
      jitter: true
    },
    timeout: {
      timeout: 10000 // 10 seconds
    }
  },
  
  llm: {
    circuitBreaker: {
      failureThreshold: 0.4, // 40% failure rate
      recoveryTimeout: 45000, // 45 seconds
      monitoringWindow: 90000, // 1.5 minutes
      minimumRequests: 5
    },
    retry: {
      maxAttempts: 2, // LLM calls are expensive
      baseDelay: 2000,
      maxDelay: 8000,
      exponentialBackoff: true,
      jitter: true
    },
    timeout: {
      timeout: 60000 // 1 minute for LLM calls
    },
    bulkhead: {
      maxConcurrency: 5, // Limit concurrent LLM calls
      queueSize: 10,
      queueTimeout: 30000
    }
  }
};

// Export singleton orchestrator
export const resilience = new ResilienceOrchestrator();
