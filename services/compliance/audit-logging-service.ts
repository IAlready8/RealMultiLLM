import { auditLogger } from '@/lib/audit-logger';
import prisma from '@/lib/prisma';
import { isProduction } from '@/lib/env';
import { AppError } from '@/lib/error-system';

/**
 * Extended audit logging service for comprehensive compliance tracking
 * Builds upon the existing auditLogger with enhanced features for enterprise compliance
 */

export interface ExtendedAuditLogEntry {
  id: string;
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
  category: string;
}

export interface ComplianceAuditContext {
  userId?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  requestId?: string | null;
}

export class ComplianceAuditService {
  private static instance: ComplianceAuditService;

  private constructor() {}

  public static getInstance(): ComplianceAuditService {
    if (!ComplianceAuditService.instance) {
      ComplianceAuditService.instance = new ComplianceAuditService();
    }
    return ComplianceAuditService.instance;
  }

  /**
   * Log comprehensive audit events for compliance purposes
   */
  public async logComplianceEvent(
    action: string,
    resource: string,
    outcome: 'success' | 'failure' | 'warning',
    context: ComplianceAuditContext,
    details?: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    try {
      await auditLogger.logSecurityEvent(
        action,
        outcome,
        {
          resource,
          ...details
        },
        {
          userId: context.userId || null,
          sessionId: context.sessionId || null,
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
          correlationId: context.correlationId || context.requestId || null
        },
        severity
      );
    } catch (error) {
      console.error('Failed to log compliance event:', error);
      // Don't throw error to avoid disrupting main flow
    }
  }

  /**
   * Retrieve audit logs for compliance reporting
   */
  public async getAuditLogs(
    filters?: {
      userId?: string;
      category?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<ExtendedAuditLogEntry[]> {
    try {
      const whereClause: any = {};

      if (filters?.userId) {
        whereClause.userId = filters.userId;
      }

      if (filters?.category) {
        whereClause.event = {
          startsWith: `${filters.category}:`
        };
      }

      if (filters?.startDate || filters?.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) {
          whereClause.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.createdAt.lte = filters.endDate;
        }
      }

      const logs = await prisma.analytics.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc'
        },
        take: filters?.limit || 100
      });

      return logs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        userId: log.userId !== 'system' ? log.userId : null,
        sessionId: null,
        action: log.event.split(':')[1] || log.event,
        resource: 'analytics',
        resourceId: null,
        details: log.payload || {},
        outcome: 'success', // Default since we're using analytics table as temporary storage
        ipAddress: (log.payload as any)?.ipAddress || null,
        userAgent: (log.payload as any)?.userAgent || null,
        correlationId: (log.payload as any)?.correlationId || null,
        severity: (log.payload as any)?.severity || 'medium',
        category: log.event.split(':')[0] || 'system'
      }));
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      throw new AppError('Failed to retrieve audit logs', {
        category: 'database',
        severity: 'high'
      });
    }
  }

  /**
   * Export audit logs for compliance reporting
   */
  public async exportAuditLogs(
    userId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<string> {
    try {
      const logs = await this.getAuditLogs({
        userId,
        ...filters
      });

      // Create CSV export
      const headers = [
        'Timestamp',
        'Action',
        'Resource',
        'Outcome',
        'Severity',
        'Category',
        'Details'
      ].join(',');

      const rows = logs.map(log => [
        log.timestamp.toISOString(),
        log.action,
        log.resource,
        log.outcome,
        log.severity,
        log.category,
        JSON.stringify(log.details).replace(/,/g, ';')
      ].join(','));

      return [headers, ...rows].join('\n');
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw new AppError('Failed to export audit logs', {
        category: 'export',
        severity: 'high'
      });
    }
  }

  /**
   * Generate compliance report
   */
  public async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: {
      totalEvents: number;
      securityEvents: number;
      dataAccessEvents: number;
      highSeverityEvents: number;
      uniqueUsers: number;
    };
    details: ExtendedAuditLogEntry[];
  }> {
    try {
      const logs = await this.getAuditLogs({
        startDate,
        endDate
      });

      const uniqueUsers = new Set<string>();
      let securityEvents = 0;
      let dataAccessEvents = 0;
      let highSeverityEvents = 0;

      logs.forEach(log => {
        if (log.userId) {
          uniqueUsers.add(log.userId);
        }
        
        if (log.category === 'security_event') {
          securityEvents++;
        }
        
        if (log.category === 'data_access') {
          dataAccessEvents++;
        }
        
        if (log.severity === 'high' || log.severity === 'critical') {
          highSeverityEvents++;
        }
      });

      return {
        summary: {
          totalEvents: logs.length,
          securityEvents,
          dataAccessEvents,
          highSeverityEvents,
          uniqueUsers: uniqueUsers.size
        },
        details: logs
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw new AppError('Failed to generate compliance report', {
        category: 'reporting',
        severity: 'high'
      });
    }
  }
}

// Export singleton instance
export const complianceAuditService = ComplianceAuditService.getInstance();

export default ComplianceAuditService;