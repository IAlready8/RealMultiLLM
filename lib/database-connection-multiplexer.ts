/**
 * PHASE 3 SCALABILITY ENHANCEMENT: Database Connection Multiplexing
 *
 * Advanced database connection management with intelligent query batching
 * Optimizes connection utilization and reduces database load
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/observability/logger';
import { metricsRegistry } from '@/lib/observability/metrics';

interface QueryBatch {
  id: string;
  queries: PendingQuery[];
  createdAt: number;
  priority: 'low' | 'medium' | 'high';
  estimatedExecutionTime: number;
}

interface PendingQuery {
  id: string;
  operation: string;
  params: any;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  priority: 'low' | 'medium' | 'high';
  timeout: number;
  createdAt: number;
}

interface ConnectionPool {
  connections: PrismaClient[];
  available: PrismaClient[];
  busy: Map<PrismaClient, string>; // connection -> query id
  totalConnections: number;
  maxConnections: number;
}

interface MultiplexerStats {
  totalQueries: number;
  batchedQueries: number;
  averageBatchSize: number;
  connectionUtilization: number;
  queryThroughput: number;
  averageQueryTime: number;
}

class DatabaseConnectionMultiplexer {
  private pool!: ConnectionPool;
  private queryQueue: PendingQuery[] = [];
  private batchQueue: QueryBatch[] = [];
  private processing = false;
  private stats: MultiplexerStats = {
    totalQueries: 0,
    batchedQueries: 0,
    averageBatchSize: 0,
    connectionUtilization: 0,
    queryThroughput: 0,
    averageQueryTime: 0
  };

  private readonly MAX_CONNECTIONS = parseInt(process.env.DB_POOL_SIZE || '10');
  private readonly MIN_CONNECTIONS = 2;
  private readonly BATCH_SIZE = 20;
  private readonly BATCH_TIMEOUT = 100; // 100ms
  private readonly QUERY_TIMEOUT = 30000; // 30 seconds
  private readonly PROCESSING_INTERVAL = 50; // 50ms

  private queryTimes: number[] = [];
  private batchSizes: number[] = [];

  constructor() {
    this.initializePool();
    this.startBackgroundProcessing();
    this.startMetricsReporting();
  }

  /**
   * Initialize connection pool
   */
  private initializePool(): void {
    this.pool = {
      connections: [],
      available: [],
      busy: new Map(),
      totalConnections: 0,
      maxConnections: this.MAX_CONNECTIONS
    };

    // Create initial connections
    for (let i = 0; i < this.MIN_CONNECTIONS; i++) {
      this.createConnection();
    }

    logger.info('database_pool_initialized', {
      initialConnections: this.MIN_CONNECTIONS,
      maxConnections: this.MAX_CONNECTIONS
    });
  }

  /**
   * Create new database connection
   */
  private createConnection(): PrismaClient {
    const connection = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error'] : [],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    this.pool.connections.push(connection);
    this.pool.available.push(connection);
    this.pool.totalConnections++;

    logger.debug('database_connection_created', {
      totalConnections: this.pool.totalConnections,
      availableConnections: this.pool.available.length
    });

    return connection;
  }

  /**
   * Get available connection from pool
   */
  private async getConnection(): Promise<PrismaClient> {
    // Check for available connection
    if (this.pool.available.length > 0) {
      const connection = this.pool.available.pop()!;
      return connection;
    }

    // Create new connection if under limit
    if (this.pool.totalConnections < this.pool.maxConnections) {
      return this.createConnection();
    }

    // Wait for connection to become available
    return new Promise((resolve) => {
      const checkAvailable = () => {
        if (this.pool.available.length > 0) {
          const connection = this.pool.available.pop()!;
          resolve(connection);
        } else {
          setTimeout(checkAvailable, 10);
        }
      };
      checkAvailable();
    });
  }

  /**
   * Return connection to pool
   */
  private releaseConnection(connection: PrismaClient, queryId?: string): void {
    if (queryId) {
      this.pool.busy.delete(connection);
    }

    if (!this.pool.available.includes(connection)) {
      this.pool.available.push(connection);
    }

    // Update connection utilization metrics
    this.updateConnectionMetrics();
  }

  /**
   * Execute query with connection multiplexing
   */
  async executeQuery<T>(
    operation: string,
    params: any,
    priority: 'low' | 'medium' | 'high' = 'medium',
    timeout: number = this.QUERY_TIMEOUT
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queryId = this.generateQueryId();
      const query: PendingQuery = {
        id: queryId,
        operation,
        params,
        resolve,
        reject,
        priority,
        timeout,
        createdAt: Date.now()
      };

      // Add to queue with priority insertion
      this.insertQueryWithPriority(query);
      this.stats.totalQueries++;

      logger.debug('query_queued', {
        queryId,
        operation,
        priority,
        queueLength: this.queryQueue.length
      });

      // Set timeout for query
      setTimeout(() => {
        const index = this.queryQueue.findIndex(q => q.id === queryId);
        if (index >= 0) {
          this.queryQueue.splice(index, 1);
          reject(new Error(`Query timeout after ${timeout}ms`));
        }
      }, timeout);

      // Record queuing metrics
      this.recordMetric('queries_queued_total', 1);
      this.recordMetric('query_queue_depth', this.queryQueue.length);
    });
  }

  /**
   * Insert query with priority-based positioning
   */
  private insertQueryWithPriority(query: PendingQuery): void {
    const priority = this.getPriorityValue(query.priority);
    let insertIndex = this.queryQueue.length;

    for (let i = 0; i < this.queryQueue.length; i++) {
      if (this.getPriorityValue(this.queryQueue[i].priority) < priority) {
        insertIndex = i;
        break;
      }
    }

    this.queryQueue.splice(insertIndex, 0, query);
  }

  /**
   * Get numeric priority value for sorting
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  /**
   * Start background query processing
   */
  private startBackgroundProcessing(): void {
    setInterval(() => {
      if (!this.processing && this.queryQueue.length > 0) {
        this.processBatch();
      }
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * Process batch of queries
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queryQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Create batch from queued queries
      const batchSize = Math.min(this.BATCH_SIZE, this.queryQueue.length, this.pool.available.length || 1);
      const queries = this.queryQueue.splice(0, batchSize);

      if (queries.length === 0) {
        return;
      }

      const batch: QueryBatch = {
        id: this.generateBatchId(),
        queries,
        createdAt: Date.now(),
        priority: this.determineBatchPriority(queries),
        estimatedExecutionTime: this.estimateBatchExecutionTime(queries)
      };

      this.batchQueue.push(batch);
      this.recordBatchSize(queries.length);

      logger.debug('query_batch_created', {
        batchId: batch.id,
        queryCount: queries.length,
        priority: batch.priority,
        estimatedTime: batch.estimatedExecutionTime
      });

      // Execute batch
      await this.executeBatch(batch);

    } catch (error) {
      logger.error('batch_processing_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        queueLength: this.queryQueue.length
      });
    } finally {
      this.processing = false;
    }
  }

  /**
   * Execute batch of queries
   */
  private async executeBatch(batch: QueryBatch): Promise<void> {
    const startTime = Date.now();

    // Execute queries in parallel with available connections
    const executionPromises = batch.queries.map(async (query) => {
      const connection = await this.getConnection();
      this.pool.busy.set(connection, query.id);

      try {
        const queryStartTime = Date.now();
        const result = await this.executeQueryOnConnection(connection, query);

        const queryTime = Date.now() - queryStartTime;
        this.recordQueryTime(queryTime);

        query.resolve(result);

        logger.debug('query_executed', {
          queryId: query.id,
          operation: query.operation,
          executionTime: queryTime
        });

        return { success: true, queryTime };
      } catch (error) {
        query.reject(error as Error);

        logger.error('query_execution_error', {
          queryId: query.id,
          operation: query.operation,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return { success: false, error };
      } finally {
        this.releaseConnection(connection, query.id);
      }
    });

    // Wait for all queries to complete
    const results = await Promise.allSettled(executionPromises);
    const executionTime = Date.now() - startTime;

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errorCount = results.length - successCount;

    this.stats.batchedQueries += batch.queries.length;
    this.recordMetric('batch_execution_time_ms', executionTime);
    this.recordMetric('batch_success_queries', successCount);
    this.recordMetric('batch_error_queries', errorCount);

    logger.info('batch_executed', {
      batchId: batch.id,
      queryCount: batch.queries.length,
      successCount,
      errorCount,
      executionTime,
      priority: batch.priority
    });
  }

  /**
   * Execute individual query on connection
   */
  private async executeQueryOnConnection(
    connection: PrismaClient,
    query: PendingQuery
  ): Promise<any> {
    const { operation, params } = query;

    // Route to appropriate Prisma method based on operation
    switch (operation) {
      case 'findMany':
        return await this.executeFindMany(connection, params);
      case 'findUnique':
        return await this.executeFindUnique(connection, params);
      case 'create':
        return await this.executeCreate(connection, params);
      case 'update':
        return await this.executeUpdate(connection, params);
      case 'delete':
        return await this.executeDelete(connection, params);
      case 'upsert':
        return await this.executeUpsert(connection, params);
      case 'aggregate':
        return await this.executeAggregate(connection, params);
      case 'count':
        return await this.executeCount(connection, params);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Execute findMany operation
   */
  private async executeFindMany(connection: PrismaClient, params: any): Promise<any> {
    const { model, args } = params;
    const repository = this.resolveModel(connection, model);
    return await repository.findMany(args);
  }

  /**
   * Execute findUnique operation
   */
  private async executeFindUnique(connection: PrismaClient, params: any): Promise<any> {
    const { model, args } = params;
    const repository = this.resolveModel(connection, model);
    return await repository.findUnique(args);
  }

  /**
   * Execute create operation
   */
  private async executeCreate(connection: PrismaClient, params: any): Promise<any> {
    const { model, args } = params;
    const repository = this.resolveModel(connection, model);
    return await repository.create(args);
  }

  /**
   * Execute update operation
   */
  private async executeUpdate(connection: PrismaClient, params: any): Promise<any> {
    const { model, args } = params;
    const repository = this.resolveModel(connection, model);
    return await repository.update(args);
  }

  /**
   * Execute delete operation
   */
  private async executeDelete(connection: PrismaClient, params: any): Promise<any> {
    const { model, args } = params;
    const repository = this.resolveModel(connection, model);
    return await repository.delete(args);
  }

  /**
   * Execute upsert operation
   */
  private async executeUpsert(connection: PrismaClient, params: any): Promise<any> {
    const { model, args } = params;
    const repository = this.resolveModel(connection, model);
    return await repository.upsert(args);
  }

  /**
   * Execute aggregate operation
   */
  private async executeAggregate(connection: PrismaClient, params: any): Promise<any> {
    const { model, args } = params;
    const repository = this.resolveModel(connection, model);
    return await repository.aggregate(args);
  }

  /**
   * Execute count operation
   */
  private async executeCount(connection: PrismaClient, params: any): Promise<any> {
    const { model, args } = params;
    const repository = this.resolveModel(connection, model);
    if (typeof repository.count !== 'function') {
      throw new Error(`Model ${model} does not support count operation`);
    }
    return await repository.count(args);
  }

  private resolveModel(connection: PrismaClient, model: string) {
    const repo = (connection as any)[model];
    if (repo) return repo;
    const normalized = model.charAt(0).toLowerCase() + model.slice(1);
    if ((connection as any)[normalized]) {
      return (connection as any)[normalized];
    }
    throw new Error(`Model ${model} not available on Prisma connection`);
  }

  /**
   * Determine batch priority based on query priorities
   */
  private determineBatchPriority(queries: PendingQuery[]): 'low' | 'medium' | 'high' {
    const hasHigh = queries.some(q => q.priority === 'high');
    const hasMedium = queries.some(q => q.priority === 'medium');

    if (hasHigh) return 'high';
    if (hasMedium) return 'medium';
    return 'low';
  }

  /**
   * Estimate batch execution time
   */
  private estimateBatchExecutionTime(queries: PendingQuery[]): number {
    // Simple estimation based on operation types and query count
    const baseTime = 10; // 10ms base time per query
    const complexOperations = ['aggregate', 'count'];

    const complexQueryCount = queries.filter(q =>
      complexOperations.includes(q.operation)
    ).length;

    return (queries.length * baseTime) + (complexQueryCount * 50);
  }

  /**
   * Record query execution time
   */
  private recordQueryTime(time: number): void {
    this.queryTimes.push(time);
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }

    this.stats.averageQueryTime =
      this.queryTimes.reduce((sum, t) => sum + t, 0) / this.queryTimes.length;
  }

  /**
   * Record batch size for statistics
   */
  private recordBatchSize(size: number): void {
    this.batchSizes.push(size);
    if (this.batchSizes.length > 100) {
      this.batchSizes.shift();
    }

    this.stats.averageBatchSize =
      this.batchSizes.reduce((sum, s) => sum + s, 0) / this.batchSizes.length;
  }

  /**
   * Update connection utilization metrics
   */
  private updateConnectionMetrics(): void {
    const busyConnections = this.pool.busy.size;
    this.stats.connectionUtilization =
      (busyConnections / this.pool.totalConnections) * 100;

    this.recordMetric('connection_utilization_percent', this.stats.connectionUtilization);
    this.recordMetric('available_connections', this.pool.available.length);
    this.recordMetric('busy_connections', busyConnections);
  }

  /**
   * Start metrics reporting
   */
  private startMetricsReporting(): void {
    setInterval(() => {
      this.calculateThroughput();
      this.reportMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Calculate query throughput
   */
  private calculateThroughput(): void {
    // Simple throughput calculation over the last 30 seconds
    const queriesPerSecond = this.stats.totalQueries / 30;
    this.stats.queryThroughput = queriesPerSecond;
    this.recordMetric('query_throughput_per_second', queriesPerSecond);
  }

  /**
   * Report comprehensive metrics
   */
  private reportMetrics(): void {
    this.recordMetric('total_queries_processed', this.stats.totalQueries);
    this.recordMetric('batched_queries_total', this.stats.batchedQueries);
    this.recordMetric('average_batch_size', this.stats.averageBatchSize);
    this.recordMetric('average_query_time_ms', this.stats.averageQueryTime);

    logger.info('database_multiplexer_metrics', {
      ...this.stats,
      poolStats: {
        totalConnections: this.pool.totalConnections,
        availableConnections: this.pool.available.length,
        busyConnections: this.pool.busy.size
      }
    });
  }

  /**
   * Record metric for monitoring
   */
  private recordMetric(name: string, value: number): void {
    try {
      const metric = metricsRegistry.registerGauge(
        `db_multiplexer_${name}`,
        `Database multiplexer ${name.replace(/_/g, ' ')}`
      );
      metric.set(value);
    } catch (error) {
      // Fail silently - metrics are non-critical
    }
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `b_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Get multiplexer statistics
   */
  getStatistics(): MultiplexerStats & {
    pool: {
      totalConnections: number;
      availableConnections: number;
      busyConnections: number;
      utilization: number;
    };
    queue: {
      pendingQueries: number;
      batchesInProgress: number;
    };
  } {
    return {
      ...this.stats,
      pool: {
        totalConnections: this.pool.totalConnections,
        availableConnections: this.pool.available.length,
        busyConnections: this.pool.busy.size,
        utilization: this.stats.connectionUtilization
      },
      queue: {
        pendingQueries: this.queryQueue.length,
        batchesInProgress: this.batchQueue.length
      }
    };
  }

  /**
   * Health check for multiplexer system
   */
  getHealthStatus() {
    const stats = this.getStatistics();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check connection utilization
    if (stats.pool.utilization > 90) {
      issues.push(`Very high connection utilization: ${stats.pool.utilization.toFixed(1)}%`);
      recommendations.push('Consider increasing database connection pool size');
    } else if (stats.pool.utilization > 75) {
      recommendations.push('Monitor connection pool usage for potential scaling needs');
    }

    // Check query queue depth
    if (stats.queue.pendingQueries > 100) {
      issues.push(`High query queue depth: ${stats.queue.pendingQueries}`);
      recommendations.push('Investigate slow queries or increase processing capacity');
    }

    // Check query performance
    if (stats.averageQueryTime > 1000) {
      issues.push(`Slow average query time: ${stats.averageQueryTime.toFixed(0)}ms`);
      recommendations.push('Optimize slow queries and consider database indexing');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
      stats: {
        utilization: stats.pool.utilization,
        throughput: stats.queryThroughput,
        avgQueryTime: stats.averageQueryTime,
        queueDepth: stats.queue.pendingQueries
      }
    };
  }
}

// Singleton instance for global database connection multiplexing
export const dbMultiplexer = new DatabaseConnectionMultiplexer();
