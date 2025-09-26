/**
 * PHASE 2 PERFORMANCE OPTIMIZATION: Stream Connection Memory Management
 *
 * Prevents memory leaks from abandoned streaming connections
 * Zero-impact tracking system with automatic cleanup
 */

import { logger } from '@/lib/observability/logger';

interface StreamConnection {
  id: string;
  userId: string;
  provider: string;
  startTime: number;
  controller?: ReadableStreamDefaultController;
  cleanup?: () => void;
  timeout?: NodeJS.Timeout;
}

class StreamConnectionManager {
  private connections = new Map<string, StreamConnection>();
  private readonly MAX_CONNECTIONS = 1000; // Prevent memory exhaustion
  private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 30 * 1000; // 30 seconds

  constructor() {
    // Periodic cleanup of stale connections
    setInterval(() => this.cleanupStaleConnections(), this.CLEANUP_INTERVAL);
  }

  /**
   * Register a new streaming connection with automatic cleanup
   */
  registerConnection(
    userId: string,
    provider: string,
    controller: ReadableStreamDefaultController,
    customTimeout?: number
  ): string {
    const connectionId = `${userId}_${provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timeout = customTimeout || this.DEFAULT_TIMEOUT;

    // Prevent memory exhaustion - remove oldest connection if at limit
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      const oldestId = this.connections.keys().next().value;
      if (oldestId) {
        logger.warn('stream_connection_limit_reached', {
          totalConnections: this.connections.size,
          removingConnection: oldestId
        });
        this.removeConnection(oldestId);
      }
    }

    // Create cleanup function
    const cleanup = () => {
      try {
        if (controller.desiredSize !== null) {
          controller.close();
        }
      } catch (error) {
        // Controller already closed - this is fine
        logger.debug('stream_controller_already_closed', { connectionId });
      }
      this.connections.delete(connectionId);
    };

    // Set timeout for automatic cleanup
    const timeoutId = setTimeout(() => {
      logger.info('stream_connection_timeout', {
        connectionId,
        userId,
        provider,
        timeoutMs: timeout
      });

      try {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({
          type: 'timeout',
          message: 'Stream timeout - connection closed'
        }) + '\n'));
      } catch (error) {
        // Controller may already be closed
      }

      cleanup();
    }, timeout);

    // Store connection with cleanup info
    const connection: StreamConnection = {
      id: connectionId,
      userId,
      provider,
      startTime: Date.now(),
      controller,
      cleanup,
      timeout: timeoutId
    };

    this.connections.set(connectionId, connection);

    logger.info('stream_connection_registered', {
      connectionId,
      userId,
      provider,
      totalConnections: this.connections.size,
      timeoutMs: timeout
    });

    return connectionId;
  }

  /**
   * Remove a connection and clean up resources
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Clear timeout
    if (connection.timeout) {
      clearTimeout(connection.timeout);
    }

    // Run cleanup
    if (connection.cleanup) {
      connection.cleanup();
    }

    // Remove from tracking
    this.connections.delete(connectionId);

    const duration = Date.now() - connection.startTime;
    logger.info('stream_connection_removed', {
      connectionId,
      userId: connection.userId,
      provider: connection.provider,
      durationMs: duration,
      totalConnections: this.connections.size
    });
  }

  /**
   * Create enhanced abort handler with connection tracking
   */
  createAbortHandler(
    connectionId: string,
    writeJson: (obj: any) => void
  ): () => void {
    return () => {
      logger.info('stream_connection_aborted', { connectionId });

      try {
        writeJson({ type: 'aborted', connectionId });
      } catch (error) {
        // Controller may already be closed
      }

      this.removeConnection(connectionId);
    };
  }

  /**
   * Get connection statistics for monitoring
   */
  getConnectionStats() {
    const now = Date.now();
    const connections = Array.from(this.connections.values());

    return {
      total: connections.length,
      byProvider: connections.reduce((acc, conn) => {
        acc[conn.provider] = (acc[conn.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageDuration: connections.length > 0
        ? Math.round(connections.reduce((sum, conn) => sum + (now - conn.startTime), 0) / connections.length)
        : 0,
      oldestConnection: connections.length > 0
        ? Math.max(...connections.map(conn => now - conn.startTime))
        : 0
    };
  }

  /**
   * Clean up stale connections that may have been orphaned
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    let cleanedCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.startTime > staleThreshold) {
        logger.warn('cleaning_stale_connection', {
          connectionId,
          ageMs: now - connection.startTime,
          userId: connection.userId,
          provider: connection.provider
        });
        this.removeConnection(connectionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('stale_connections_cleaned', {
        cleanedCount,
        remainingConnections: this.connections.size
      });
    }
  }
}

// Singleton instance for global connection management
export const streamConnectionManager = new StreamConnectionManager();
