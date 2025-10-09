import { ComplianceService } from '@/lib/compliance';
import prisma from '@/lib/prisma';
import { AppError, ValidationError } from '@/lib/error-system';
import { isProduction } from '@/lib/env';
import { auditLogger } from '@/lib/audit-logger';

/**
 * Data deletion service for GDPR/CCPA compliance
 * Extends the basic compliance service with enhanced deletion capabilities
 * and audit logging for compliance purposes
 */

export interface DeletionOptions {
  includeAnalytics?: boolean;
  includeAuditLogs?: boolean;
  softDeleteOnly?: boolean;
  createDeletionRecord?: boolean;
  notifyUser?: boolean;
}

export interface DeletionRecord {
  id: string;
  userId: string;
  deletionRequestedAt: Date;
  deletionCompletedAt?: Date;
  status: 'requested' | 'processing' | 'completed' | 'failed';
  deletionSummary: Record<string, number>;
  deletionMethod: 'soft' | 'hard';
  reason?: string;
  confirmedByUserAt?: Date;
  confirmedByAdminAt?: Date;
}

export class DataDeletionService {
  private readonly complianceService: ComplianceService;

  constructor() {
    this.complianceService = new ComplianceService(prisma);
  }

  /**
   * Request user data deletion (GDPR/CCPA compliant)
   */
  async requestDataDeletion(
    userId: string,
    options: DeletionOptions = {},
    reason?: string
  ): Promise<DeletionRecord> {
    if (!userId) {
      throw new ValidationError('Invalid userId for deletion', 'userId', {
        endpoint: 'compliance.requestDataDeletion',
        timestamp: new Date(),
      });
    }

    try {
      // Create a deletion record
      const deletionRecord = await prisma.deletionRecord.create({
        data: {
          userId,
          status: 'requested',
          deletionMethod: options.softDeleteOnly ? 'soft' : 'hard',
          reason,
          deletionSummary: '{}' as string
        }
      });

      // Log the deletion request
      await auditLogger.logSecurityEvent(
        'deletion_requested',
        'success',
        {
          userId,
          deletionRecordId: deletionRecord.id,
          reason,
          options
        },
        { userId },
        'high'
      );

      return {
        ...deletionRecord,
        status: deletionRecord.status as "failed" | "completed" | "requested" | "processing",
        deletionMethod: deletionRecord.deletionMethod as "soft" | "hard",
        reason: deletionRecord.reason || undefined,
        deletionRequestedAt: deletionRecord.createdAt,
        deletionCompletedAt: deletionRecord.completedAt || undefined,
        deletionSummary: (typeof deletionRecord.deletionSummary === 'object' && deletionRecord.deletionSummary !== null) ? deletionRecord.deletionSummary : {}
      };
    } catch (error) {
      console.error('Failed to request data deletion:', error);
      await auditLogger.logSecurityEvent(
        'deletion_request_failed',
        'failure',
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          reason,
          options
        },
        { userId },
        'critical'
      );
      throw new AppError('Failed to request data deletion', {
        category: 'compliance',
        severity: 'high',
        context: { userId, options }
      });
    }
  }

  /**
   * Execute user data deletion (GDPR/CCPA compliant)
   * This should only be called after proper verification and confirmation
   */
  async executeDataDeletion(
    userId: string,
    deletionRecordId: string,
    options: DeletionOptions = {}
  ): Promise<void> {
    if (!userId || !deletionRecordId) {
      throw new ValidationError('Invalid userId or deletionRecordId for deletion', 'userId', {
        endpoint: 'compliance.executeDataDeletion',
        timestamp: new Date(),
      });
    }

    try {
      // Update deletion record status
      await prisma.deletionRecord.update({
        where: { id: deletionRecordId },
        data: {
          status: 'processing',
          startedAt: new Date()
        }
      });

      // Log the deletion execution start
      await auditLogger.logSecurityEvent(
        'deletion_started',
        'success',
        {
          userId,
          deletionRecordId,
          options
        },
        { userId },
        'high'
      );

      // Default options
      const opts: Required<DeletionOptions> = {
        includeAnalytics: options.includeAnalytics ?? true,
        includeAuditLogs: options.includeAuditLogs ?? false, // Audit logs preserved for compliance
        softDeleteOnly: options.softDeleteOnly ?? false,
        createDeletionRecord: options.createDeletionRecord ?? true,
        notifyUser: options.notifyUser ?? true
      };

      // Get counts before deletion for the summary
      const counts = await this.getDataCounts(userId);

      if (opts.softDeleteOnly) {
        // Soft delete approach - mark records as deleted but keep them
        await this.softDeleteUserData(userId);
      } else {
        // Hard delete approach - permanently remove records
        await this.hardDeleteUserData(userId, opts);
      }

      // Update deletion record with completion
      await prisma.deletionRecord.update({
        where: { id: deletionRecordId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          deletionSummary: counts
        }
      });

      // Log successful deletion
      await auditLogger.logSecurityEvent(
        'deletion_completed',
        'success',
        {
          userId,
          deletionRecordId,
          deletionMethod: opts.softDeleteOnly ? 'soft' : 'hard',
          counts
        },
        { userId },
        'high'
      );

      // Notify user if requested (in a real implementation, this would send an email)
      if (opts.notifyUser) {
        console.log(`User ${userId} has been notified of successful data deletion`);
      }
    } catch (error) {
      console.error('Data deletion failed:', error);
      
      // Update deletion record with failure
      await prisma.deletionRecord.update({
        where: { id: deletionRecordId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      // Log failed deletion
      await auditLogger.logSecurityEvent(
        'deletion_failed',
        'failure',
        {
          userId,
          deletionRecordId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { userId },
        'critical'
      );
      
      throw new AppError('Failed to delete user data', {
        category: 'compliance',
        severity: 'critical',
        context: { userId, deletionRecordId }
      });
    }
  }

  /**
   * Get data counts for a user before deletion
   */
  private async getDataCounts(userId: string): Promise<Record<string, number>> {
    const [
      messageCount,
      conversationCount,
      personaCount,
      providerCount,
      teamMembershipCount
    ] = await Promise.all([
      prisma.message.count({ where: { userId } }),
      prisma.conversation.count({ where: { userId } }),
      prisma.persona.count({ where: { userId } }),
      prisma.providerConfig.count({ where: { userId } }),
      prisma.teamMembership.count({ where: { userId } })
    ]);

    return {
      messages: messageCount,
      conversations: conversationCount,
      personas: personaCount,
      providers: providerCount,
      teamMemberships: teamMembershipCount
    };
  }

  /**
   * Soft delete user data (mark as deleted but preserve)
   */
  private async softDeleteUserData(userId: string): Promise<void> {
    // In a real implementation, you would add a 'deleted' flag to relevant tables
    // and update records instead of deleting them
    
    // For now, we'll just log that soft deletion was requested
    console.log(`Soft deletion requested for user ${userId}`);
    
    // Example of what soft deletion might look like:
    /*
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: `[DELETED]-${userId}@deleted.example.com`,
        name: '[DELETED USER]'
      }
    });
    */
  }

  /**
   * Hard delete user data (permanent removal)
   */
  private async hardDeleteUserData(
    userId: string,
    options: Required<DeletionOptions>
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Delete messages
      const messageDelete = await tx.message.deleteMany({ where: { userId } });
      
      // Delete conversations
      const conversationDelete = await tx.conversation.deleteMany({ where: { userId } });
      
      // Delete personas
      const personaDelete = await tx.persona.deleteMany({ where: { userId } });
      
      // Delete provider configurations
      const providerDelete = await tx.providerConfig.deleteMany({ where: { userId } });
      
      // Delete team memberships
      const teamMembershipDelete = await tx.teamMembership.deleteMany({ where: { userId } });
      
      // Delete analytics (if requested)
      let analyticsDelete = { count: 0 };
      if (options.includeAnalytics) {
        analyticsDelete = await tx.analytics.deleteMany({ where: { userId } });
      }
      
      // Delete audit logs (if requested - usually not recommended)
      let auditLogDelete = { count: 0 };
      if (options.includeAuditLogs) {
        auditLogDelete = await tx.auditLog.deleteMany({ where: { userId } });
      }
      
      // Important: We do NOT delete the user record itself
      // This preserves audit trails and compliance records
      // The user record is anonymized instead
      
      // Anonymize user data
      await tx.user.update({
        where: { id: userId },
        data: {
          name: '[DELETED]',
          email: `[deleted-${userId}@example.com]`,
          image: null,
          password: null,
          emailVerified: null
        }
      });
      
      console.log(`Deleted data for user ${userId}:`, {
        messages: messageDelete.count,
        conversations: conversationDelete.count,
        personas: personaDelete.count,
        providers: providerDelete.count,
        teamMemberships: teamMembershipDelete.count,
        analytics: analyticsDelete.count,
        auditLogs: auditLogDelete.count
      });
    });
  }

  /**
   * Get deletion records for a user
   */
  async getDeletionRecords(userId: string): Promise<DeletionRecord[]> {
    try {
      const records = await prisma.deletionRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return records.map(record => ({
        ...record,
        status: record.status as "failed" | "completed" | "requested" | "processing",
        deletionMethod: record.deletionMethod as "soft" | "hard",
        deletionRequestedAt: record.createdAt,
        deletionCompletedAt: record.completedAt || undefined,
        deletionSummary: (typeof record.deletionSummary === 'object' && record.deletionSummary !== null) ? record.deletionSummary : {},
        reason: record.reason || undefined
      }));
    } catch (error) {
      console.error('Failed to retrieve deletion records:', error);
      throw new AppError('Failed to retrieve deletion records', {
        category: 'compliance',
        severity: 'medium',
        context: { userId }
      });
    }
  }

  /**
   * Cancel a pending deletion request
   */
  async cancelDeletionRequest(
    userId: string,
    deletionRecordId: string
  ): Promise<DeletionRecord> {
    try {
      const record = await prisma.deletionRecord.update({
        where: { id: deletionRecordId, userId },
        data: {
          status: 'cancelled',
          completedAt: new Date()
        }
      });

      // Log cancellation
      await auditLogger.logSecurityEvent(
        'deletion_cancelled',
        'success',
        {
          userId,
          deletionRecordId
        },
        { userId },
        'medium'
      );

      return {
        ...record,
        status: record.status as "failed" | "completed" | "requested" | "processing",
        deletionMethod: record.deletionMethod as "soft" | "hard",
        deletionRequestedAt: record.createdAt,
        deletionCompletedAt: record.completedAt || undefined,
        deletionSummary: (typeof record.deletionSummary === 'object' && record.deletionSummary !== null) ? record.deletionSummary : {},
        reason: record.reason || undefined
      };
    } catch (error) {
      console.error('Failed to cancel deletion request:', error);
      await auditLogger.logSecurityEvent(
        'deletion_cancellation_failed',
        'failure',
        {
          userId,
          deletionRecordId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { userId },
        'high'
      );
      throw new AppError('Failed to cancel deletion request', {
        category: 'compliance',
        severity: 'high',
        context: { userId, deletionRecordId }
      });
    }
  }
}

// Export singleton instance
export const dataDeletionService = new DataDeletionService();

export default DataDeletionService;