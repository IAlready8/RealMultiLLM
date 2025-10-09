import { PrismaClient } from '@prisma/client';
import { isProduction } from '@/lib/env';
import { AppError } from '@/lib/error-system';
import { auditLogger } from '@/lib/audit-logger';

/**
 * Enhanced compliance audit logging service for GDPR/CCPA compliance
 * Extends the basic auditLogger with additional features for enterprise compliance
 */

export interface ComplianceAuditEntry {
  id: string;
  timestamp: Date;
  userId: string | null;
  teamId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, any>;
  outcome: 'success' | 'failure';
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

export interface ComplianceAuditFilter {
  userId?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class ComplianceAuditService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Log a compliance-related event
   */
  public async logComplianceEvent(
    userId: string | null,
    action: string,
    resource: string,
    outcome: 'success' | 'failure',
    details: Record<string, any> = {},
    context: {
      sessionId?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      correlationId?: string | null;
    } = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    try {
      // Use the existing audit logger for basic logging
      await auditLogger.logSecurityEvent(
        action,
        outcome,
        {
          resource,
          ...details
        },
        {
          userId,
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          correlationId: context.correlationId
        },
        severity
      );
    } catch (error) {
      console.error('Failed to log compliance event:', error);
      // Don't throw error to avoid disrupting main flow
    }
  }

  /**
   * Retrieve compliance audit logs with filtering
   */
  public async getComplianceLogs(filter: ComplianceAuditFilter = {}): Promise<ComplianceAuditEntry[]> {
    try {
      const whereClause: any = {};

      if (filter.userId) {
        whereClause.userId = filter.userId;
      }

      if (filter.category) {
        whereClause.category = filter.category;
      }

      if (filter.startDate || filter.endDate) {
        whereClause.timestamp = {};
        if (filter.startDate) {
          whereClause.timestamp.gte = filter.startDate;
        }
        if (filter.endDate) {
          whereClause.timestamp.lte = filter.endDate;
        }
      }

      const auditLogs = await this.prisma.auditLog.findMany({
        where: whereClause,
        orderBy: {
          timestamp: 'desc'
        },
        take: filter.limit || 100,
        skip: filter.offset || 0
      });

      return auditLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        userId: log.userId,
        teamId: log.teamId,
        action: log.action,
        resource: log.resource || '',
        resourceId: log.resourceId,
        details: log.details ? JSON.parse(log.details as string) : {},
        outcome: (log.outcome === 'success' || log.outcome === 'failure') ? log.outcome : 'success',
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        correlationId: log.correlationId,
        severity: (log.severity === 'low' || log.severity === 'medium' || log.severity === 'high' || log.severity === 'critical') ? log.severity : 'medium',
        category: log.category || 'general'
      }));
    } catch (error) {
      console.error('Failed to retrieve compliance logs:', error);
      throw new AppError('Failed to retrieve compliance logs', {
        category: 'compliance',
        severity: 'high'
      });
    }
  }

  /**
   * Export compliance logs in various formats
   */
  public async exportComplianceLogs(
    filter: ComplianceAuditFilter = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const logs = await this.getComplianceLogs(filter);

      if (format === 'csv') {
        // Create CSV export
        const headers = [
          'Timestamp',
          'User ID',
          'Action',
          'Resource',
          'Resource ID',
          'Outcome',
          'Severity',
          'Category',
          'IP Address',
          'User Agent',
          'Correlation ID',
          'Details'
        ].join(',');

        const rows = logs.map(log => [
          log.timestamp.toISOString(),
          log.userId || '',
          log.action,
          log.resource,
          log.resourceId || '',
          log.outcome,
          log.severity,
          log.category,
          log.ipAddress || '',
          `"${log.userAgent || ''}"`,
          log.correlationId || '',
          `"${JSON.stringify(log.details).replace(/"/g, '""')}"`
        ].join(','));

        return [headers, ...rows].join('\n');
      } else {
        // JSON export
        return JSON.stringify(logs, null, 2);
      }
    } catch (error) {
      console.error('Failed to export compliance logs:', error);
      throw new AppError('Failed to export compliance logs', {
        category: 'compliance',
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
      categories: Record<string, number>;
    };
    details: ComplianceAuditEntry[];
  }> {
    try {
      const logs = await this.getComplianceLogs({
        startDate,
        endDate
      });

      const uniqueUsers = new Set<string>();
      let securityEvents = 0;
      let dataAccessEvents = 0;
      let highSeverityEvents = 0;
      const categories: Record<string, number> = {};

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
        
        categories[log.category] = (categories[log.category] || 0) + 1;
      });

      return {
        summary: {
          totalEvents: logs.length,
          securityEvents,
          dataAccessEvents,
          highSeverityEvents,
          uniqueUsers: uniqueUsers.size,
          categories
        },
        details: logs
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw new AppError('Failed to generate compliance report', {
        category: 'compliance',
        severity: 'high'
      });
    }
  }

  /**
   * Get audit log statistics
   */
  public async getAuditStats(
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    totalLogs: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byOutcome: Record<string, number>;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      const logs = await this.getComplianceLogs({
        startDate,
        endDate
      });

      const byCategory: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byOutcome: Record<string, number> = {};

      logs.forEach(log => {
        byCategory[log.category] = (byCategory[log.category] || 0) + 1;
        bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
        byOutcome[log.outcome] = (byOutcome[log.outcome] || 0) + 1;
      });

      return {
        totalLogs: logs.length,
        byCategory,
        bySeverity,
        byOutcome
      };
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      throw new AppError('Failed to get audit statistics', {
        category: 'compliance',
        severity: 'medium'
      });
    }
  }
}

// Export singleton instance
let complianceAuditService: ComplianceAuditService | null = null;

export function getComplianceAuditService(prisma: PrismaClient): ComplianceAuditService {
  if (!complianceAuditService) {
    complianceAuditService = new ComplianceAuditService(prisma);
  }
  return complianceAuditService;
}

export default ComplianceAuditService;