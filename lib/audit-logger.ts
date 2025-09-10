import { getValidatedEnv, isProduction } from "./env";
import prisma from "./prisma";

/**
 * Enterprise-grade audit logging system for compliance and security monitoring
 * Supports structured logging with contextual information and retention policies
 */

export interface AuditLogEntry {
  id?: string;
  timestamp: Date;
  userId: string | null;
  sessionId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, any>;
  outcome: 'success' | 'failure' | 'warning';
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: AuditCategory;
}

export type AuditCategory = 
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'configuration_change'
  | 'api_key_management'
  | 'user_management'
  | 'llm_interaction'
  | 'security_event'
  | 'system_event';

export interface AuditContext {
  userId?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

class AuditLogger {
  private static instance: AuditLogger;
  private readonly retentionDays: number;
  private readonly maxBatchSize: number;
  private readonly flushInterval: number;
  private pendingLogs: AuditLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.retentionDays = isProduction() ? 2555 : 90; // 7 years in prod, 90 days in dev
    this.maxBatchSize = 100;
    this.flushInterval = 5000; // 5 seconds
    
    // Start automatic flushing
    this.startAutoFlush();
    
    // Cleanup old logs periodically
    this.scheduleCleanup();
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log a security-related event
   */
  public async logSecurityEvent(
    action: string,
    outcome: AuditLogEntry['outcome'],
    details: Record<string, any>,
    context: AuditContext = {},
    severity: AuditLogEntry['severity'] = 'medium'
  ): Promise<void> {
    return this.log({
      action,
      resource: 'security',
      resourceId: null,
      details,
      outcome,
      severity,
      category: 'security_event',
      ...context
    });
  }

  /**
   * Log authentication events (login, logout, MFA, etc.)
   */
  public async logAuthenticationEvent(
    action: string,
    outcome: AuditLogEntry['outcome'],
    details: Record<string, any>,
    context: AuditContext = {}
  ): Promise<void> {
    return this.log({
      action,
      resource: 'authentication',
      resourceId: context.userId || null,
      details: this.sanitizeAuthDetails(details),
      outcome,
      severity: outcome === 'failure' ? 'high' : 'medium',
      category: 'authentication',
      ...context
    });
  }

  /**
   * Log API key management events
   */
  public async logApiKeyEvent(
    action: string,
    provider: string,
    outcome: AuditLogEntry['outcome'],
    details: Record<string, any>,
    context: AuditContext = {}
  ): Promise<void> {
    return this.log({
      action,
      resource: 'api_key',
      resourceId: provider,
      details: this.sanitizeApiKeyDetails(details),
      outcome,
      severity: 'high', // API key events are always high severity
      category: 'api_key_management',
      ...context
    });
  }

  /**
   * Log LLM interaction events
   */
  public async logLlmInteraction(
    action: string,
    provider: string,
    outcome: AuditLogEntry['outcome'],
    details: Record<string, any>,
    context: AuditContext = {}
  ): Promise<void> {
    return this.log({
      action,
      resource: 'llm_service',
      resourceId: provider,
      details: this.sanitizeLlmDetails(details),
      outcome,
      severity: 'low',
      category: 'llm_interaction',
      ...context
    });
  }

  /**
   * Log data access events
   */
  public async logDataAccess(
    resource: string,
    resourceId: string | null,
    action: string,
    outcome: AuditLogEntry['outcome'],
    details: Record<string, any>,
    context: AuditContext = {}
  ): Promise<void> {
    return this.log({
      action,
      resource,
      resourceId,
      details,
      outcome,
      severity: 'medium',
      category: 'data_access',
      ...context
    });
  }

  /**
   * Log data modification events
   */
  public async logDataModification(
    resource: string,
    resourceId: string | null,
    action: string,
    outcome: AuditLogEntry['outcome'],
    details: Record<string, any>,
    context: AuditContext = {}
  ): Promise<void> {
    return this.log({
      action,
      resource,
      resourceId,
      details,
      outcome,
      severity: 'high', // Data modifications are high severity
      category: 'data_modification',
      ...context
    });
  }

  /**
   * Log configuration change events
   */
  public async logConfigurationChange(
    resource: string,
    action: string,
    outcome: AuditLogEntry['outcome'],
    details: Record<string, any>,
    context: AuditContext = {}
  ): Promise<void> {
    return this.log({
      action,
      resource,
      resourceId: null,
      details,
      outcome,
      severity: 'high', // Config changes are high severity
      category: 'configuration_change',
      ...context
    });
  }

  /**
   * Core logging method
   */
  private async log(entry: Partial<AuditLogEntry> & {
    action: string;
    resource: string;
    outcome: AuditLogEntry['outcome'];
    category: AuditCategory;
  }): Promise<void> {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date(),
      userId: entry.userId || null,
      sessionId: entry.sessionId || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || null,
      details: entry.details || {},
      outcome: entry.outcome,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      correlationId: entry.correlationId || this.generateCorrelationId(),
      severity: entry.severity || 'medium',
      category: entry.category
    };

    // Add to pending batch
    this.pendingLogs.push(auditEntry);

    // Flush immediately for critical events or if batch is full
    if (auditEntry.severity === 'critical' || this.pendingLogs.length >= this.maxBatchSize) {
      await this.flush();
    }

    // Send to external monitoring systems in production
    if (isProduction() && auditEntry.severity === 'critical') {
      await this.sendToExternalMonitoring(auditEntry);
    }
  }

  /**
   * Flush pending logs to database
   */
  private async flush(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      // Store in database (we'll need to create the audit_logs table)
      await this.storeLogs(logsToFlush);
      
      // Also log to console in development
      if (!isProduction()) {
        logsToFlush.forEach(log => {
          console.log(`[AUDIT] ${log.category}:${log.action} - ${log.outcome} - ${JSON.stringify(log.details)}`);
        });
      }
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      
      // Re-add logs back to pending if flush failed
      this.pendingLogs.unshift(...logsToFlush);
      
      // Try to flush to console as fallback
      logsToFlush.forEach(log => {
        console.error(`[AUDIT-FAILED] ${JSON.stringify(log)}`);
      });
    }
  }

  /**
   * Store logs in database
   */
  private async storeLogs(logs: AuditLogEntry[]): Promise<void> {
    // Note: This requires a database migration to create audit_logs table
    // For now, we'll log to console and store critical ones only
    
    const criticalLogs = logs.filter(log => log.severity === 'critical');
    
    if (criticalLogs.length > 0) {
      try {
        // Store critical logs in a simple format using existing analytics table
        // This is a temporary solution until proper audit_logs table is created
        await prisma.analytics.createMany({
          data: criticalLogs.map(log => ({
            userId: log.userId || 'system',
            action: `${log.category}:${log.action}`,
            timestamp: log.timestamp,
            metadata: JSON.stringify({
              resource: log.resource,
              resourceId: log.resourceId,
              outcome: log.outcome,
              severity: log.severity,
              details: log.details,
              ipAddress: log.ipAddress,
              correlationId: log.correlationId
            })
          }))
        });
      } catch (error) {
        console.error('Failed to store critical audit logs:', error);
      }
    }
  }

  /**
   * Send critical events to external monitoring
   */
  private async sendToExternalMonitoring(entry: AuditLogEntry): Promise<void> {
    // Integrate with external monitoring systems (Sentry, DataDog, etc.)
    const sentryDsn = getValidatedEnv().SENTRY_DSN;
    
    if (sentryDsn) {
      try {
        // This would integrate with Sentry or similar service
        console.error(`[CRITICAL-AUDIT] ${entry.category}:${entry.action}`, entry);
      } catch (error) {
        console.error('Failed to send to external monitoring:', error);
      }
    }
  }

  /**
   * Start automatic flushing of logs
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval);
  }

  /**
   * Schedule periodic cleanup of old audit logs
   */
  private scheduleCleanup(): void {
    // Run cleanup once per day
    setInterval(() => {
      this.cleanupOldLogs().catch(console.error);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  private async cleanupOldLogs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      // Clean up from analytics table (temporary storage)
      const deleted = await prisma.analytics.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          },
          action: {
            contains: ':'  // Our audit logs contain category:action format
          }
        }
      });

      if (deleted.count > 0) {
        console.log(`Cleaned up ${deleted.count} old audit logs`);
      }
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
    }
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize authentication details to prevent logging sensitive data
   */
  private sanitizeAuthDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    delete sanitized.key;
    
    // Hash email for privacy in production
    if (sanitized.email && isProduction()) {
      sanitized.emailHash = this.hashSensitiveData(sanitized.email);
      delete sanitized.email;
    }
    
    return sanitized;
  }

  /**
   * Sanitize API key details
   */
  private sanitizeApiKeyDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Remove the actual API key value
    delete sanitized.apiKey;
    delete sanitized.key;
    delete sanitized.secret;
    delete sanitized.token;
    
    // Only keep metadata
    return {
      provider: sanitized.provider,
      operation: sanitized.operation,
      keyLength: sanitized.keyLength,
      keyPrefix: sanitized.keyPrefix
    };
  }

  /**
   * Sanitize LLM interaction details
   */
  private sanitizeLlmDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // In production, don't log full prompts/responses for privacy
    if (isProduction()) {
      if (sanitized.prompt) {
        sanitized.promptLength = sanitized.prompt.length;
        sanitized.promptHash = this.hashSensitiveData(sanitized.prompt);
        delete sanitized.prompt;
      }
      
      if (sanitized.response) {
        sanitized.responseLength = sanitized.response.length;
        delete sanitized.response;
      }
    }
    
    return sanitized;
  }

  /**
   * Hash sensitive data for privacy-preserving logging
   */
  private hashSensitiveData(data: string): string {
    // Simple hash for privacy (in production, use more robust hashing)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Graceful shutdown - flush remaining logs
   */
  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    await this.flush();
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Convenience functions
export const logSecurityEvent = auditLogger.logSecurityEvent.bind(auditLogger);
export const logAuthenticationEvent = auditLogger.logAuthenticationEvent.bind(auditLogger);
export const logApiKeyEvent = auditLogger.logApiKeyEvent.bind(auditLogger);
export const logLlmInteraction = auditLogger.logLlmInteraction.bind(auditLogger);
export const logDataAccess = auditLogger.logDataAccess.bind(auditLogger);
export const logDataModification = auditLogger.logDataModification.bind(auditLogger);
export const logConfigurationChange = auditLogger.logConfigurationChange.bind(auditLogger);