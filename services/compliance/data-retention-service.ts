import { PrismaClient } from '@prisma/client';
import { AppError, ValidationError } from '@/lib/error-system';
import { auditLogger } from '@/lib/audit-logger';
import { isProduction } from '@/lib/env';

/**
 * Data retention policy service for automated compliance-driven data cleanup
 * Implements configurable retention periods and automated cleanup schedules
 */

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  retentionPeriodDays: number;
  appliesTo: string[]; // Table names or data categories
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetentionPolicyExecution {
  id: string;
  policyId: string;
  executedAt: Date;
  recordsDeleted: number;
  executionTimeMs: number;
  status: 'success' | 'failure' | 'partial';
  error?: string;
  details?: Record<string, any>;
}

export class DataRetentionService {
  private readonly prisma: PrismaClient;
  private readonly cleanupInterval: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    // Start automatic cleanup schedule
    this.scheduleCleanup();
  }

  /**
   * Get all retention policies
   */
  async getRetentionPolicies(): Promise<RetentionPolicy[]> {
    try {
      const policies = await this.prisma.retentionPolicy.findMany({
        orderBy: { createdAt: 'asc' }
      });
      
      return policies.map(policy => ({
        ...policy,
        appliesTo: Array.isArray(policy.appliesTo) ? policy.appliesTo : [policy.appliesTo],
        lastRunAt: policy.lastRunAt || undefined,
        nextRunAt: policy.nextRunAt || undefined,
        description: policy.description || ''
      }));
    } catch (error) {
      console.error('Failed to retrieve retention policies:', error);
      throw new AppError('Failed to retrieve retention policies', {
        category: 'compliance',
        severity: 'high'
      });
    }
  }

  /**
   * Create a new retention policy
   */
  async createRetentionPolicy(
    policy: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt'>
  ): Promise<RetentionPolicy> {
    try {
      const newPolicy = await this.prisma.retentionPolicy.create({
        data: {
          name: policy.name,
          description: policy.description,
          retentionPeriodDays: policy.retentionPeriodDays,
          appliesTo: Array.isArray(policy.appliesTo) ? policy.appliesTo.join(',') : policy.appliesTo,
          isActive: policy.isActive
        }
      });

      await auditLogger.logSecurityEvent(
        'retention_policy_created',
        'success',
        {
          policyId: newPolicy.id,
          policyName: newPolicy.name,
          retentionPeriod: newPolicy.retentionPeriodDays,
          appliesTo: newPolicy.appliesTo
        },
        { userId: 'system' },
        'high'
      );

      return {
        ...newPolicy,
        appliesTo: Array.isArray(newPolicy.appliesTo) ? newPolicy.appliesTo : [newPolicy.appliesTo],
        lastRunAt: newPolicy.lastRunAt || undefined,
        nextRunAt: newPolicy.nextRunAt || undefined,
        description: newPolicy.description || ''
      };
    } catch (error) {
      console.error('Failed to create retention policy:', error);
      await auditLogger.logSecurityEvent(
        'retention_policy_creation_failed',
        'failure',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          policyName: policy.name
        },
        { userId: 'system' },
        'high'
      );
      throw new AppError('Failed to create retention policy', {
        category: 'compliance',
        severity: 'high'
      });
    }
  }

  /**
   * Update an existing retention policy
   */
  async updateRetentionPolicy(
    policyId: string,
    updates: Partial<Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt'>>
  ): Promise<RetentionPolicy> {
    try {
      // Convert appliesTo array to string if needed
      const processedUpdates = {
        ...updates,
        appliesTo: Array.isArray(updates.appliesTo) ? updates.appliesTo.join(',') : updates.appliesTo
      };
      
      const updatedPolicy = await this.prisma.retentionPolicy.update({
        where: { id: policyId },
        data: processedUpdates
      });

      await auditLogger.logSecurityEvent(
        'retention_policy_updated',
        'success',
        {
          policyId,
          updates
        },
        { userId: 'system' },
        'medium'
      );

      return {
        ...updatedPolicy,
        appliesTo: Array.isArray(updatedPolicy.appliesTo) ? updatedPolicy.appliesTo : [updatedPolicy.appliesTo],
        description: updatedPolicy.description || '',
        lastRunAt: updatedPolicy.lastRunAt || undefined,
        nextRunAt: updatedPolicy.nextRunAt || undefined
      };
    } catch (error) {
      console.error('Failed to update retention policy:', error);
      await auditLogger.logSecurityEvent(
        'retention_policy_update_failed',
        'failure',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          policyId
        },
        { userId: 'system' },
        'high'
      );
      throw new AppError('Failed to update retention policy', {
        category: 'compliance',
        severity: 'high'
      });
    }
  }

  /**
   * Delete a retention policy
   */
  async deleteRetentionPolicy(policyId: string): Promise<void> {
    try {
      await this.prisma.retentionPolicy.delete({
        where: { id: policyId }
      });

      await auditLogger.logSecurityEvent(
        'retention_policy_deleted',
        'success',
        {
          policyId
        },
        { userId: 'system' },
        'high'
      );
    } catch (error) {
      console.error('Failed to delete retention policy:', error);
      await auditLogger.logSecurityEvent(
        'retention_policy_deletion_failed',
        'failure',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          policyId
        },
        { userId: 'system' },
        'high'
      );
      throw new AppError('Failed to delete retention policy', {
        category: 'compliance',
        severity: 'high'
      });
    }
  }

  /**
   * Execute data retention policies
   */
  async executeRetentionPolicies(dryRun: boolean = false): Promise<RetentionPolicyExecution[]> {
    try {
      const policies = await this.getRetentionPolicies();
      const executions: RetentionPolicyExecution[] = [];

      for (const policy of policies) {
        if (!policy.isActive) continue;

        const execution = await this.executePolicy(policy, dryRun);
        executions.push(execution);

        // Update policy last run time
        if (!dryRun) {
          await this.prisma.retentionPolicy.update({
            where: { id: policy.id },
            data: {
              lastRunAt: new Date(),
              nextRunAt: new Date(Date.now() + this.cleanupInterval)
            }
          });
        }
      }

      return executions;
    } catch (error) {
      console.error('Failed to execute retention policies:', error);
      await auditLogger.logSecurityEvent(
        'retention_policies_execution_failed',
        'failure',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          dryRun
        },
        { userId: 'system' },
        'critical'
      );
      throw new AppError('Failed to execute retention policies', {
        category: 'compliance',
        severity: 'critical'
      });
    }
  }

  /**
   * Execute a specific retention policy
   */
  private async executePolicy(
    policy: RetentionPolicy,
    dryRun: boolean = false
  ): Promise<RetentionPolicyExecution> {
    const startTime = Date.now();
    let recordsDeleted = 0;
    let status: 'success' | 'failure' | 'partial' = 'success';
    let error: string | undefined;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriodDays);

      const details: Record<string, any> = {};

      // Execute cleanup for each data category in the policy
      for (const category of policy.appliesTo) {
        const count = await this.cleanupDataCategory(category, cutoffDate, dryRun);
        details[category] = { count, dryRun };
        recordsDeleted += count;
      }

      const executionTimeMs = Date.now() - startTime;

      await auditLogger.logSecurityEvent(
        'retention_policy_executed',
        'success',
        {
          policyId: policy.id,
          policyName: policy.name,
          recordsDeleted,
          executionTimeMs,
          dryRun,
          details
        },
        { userId: 'system' },
        'medium'
      );

      return {
        id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        policyId: policy.id,
        executedAt: new Date(startTime),
        recordsDeleted,
        executionTimeMs,
        status,
        details
      };
    } catch (err) {
      status = 'failure';
      error = err instanceof Error ? err.message : 'Unknown error';
      const executionTimeMs = Date.now() - startTime;

      await auditLogger.logSecurityEvent(
        'retention_policy_execution_failed',
        'failure',
        {
          policyId: policy.id,
          policyName: policy.name,
          error,
          executionTimeMs,
          dryRun
        },
        { userId: 'system' },
        'high'
      );

      return {
        id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        policyId: policy.id,
        executedAt: new Date(startTime),
        recordsDeleted,
        executionTimeMs,
        status,
        error,
        details: {}
      };
    }
  }

  /**
   * Cleanup data for a specific category
   */
  private async cleanupDataCategory(
    category: string,
    cutoffDate: Date,
    dryRun: boolean
  ): Promise<number> {
    // This is a simplified implementation - in a real system, you would have
    // specific cleanup logic for each data category
    switch (category) {
      case 'messages':
        if (dryRun) {
          const count = await this.prisma.message.count({
            where: { createdAt: { lt: cutoffDate } }
          });
          return count;
        } else {
          const deleted = await this.prisma.message.deleteMany({
            where: { createdAt: { lt: cutoffDate } }
          });
          return deleted.count;
        }

      case 'conversations':
        if (dryRun) {
          const count = await this.prisma.conversation.count({
            where: { createdAt: { lt: cutoffDate } }
          });
          return count;
        } else {
          const deleted = await this.prisma.conversation.deleteMany({
            where: { createdAt: { lt: cutoffDate } }
          });
          return deleted.count;
        }

      case 'analytics':
        if (dryRun) {
          const count = await this.prisma.analytics.count({
            where: { createdAt: { lt: cutoffDate } }
          });
          return count;
        } else {
          const deleted = await this.prisma.analytics.deleteMany({
            where: { createdAt: { lt: cutoffDate } }
          });
          return deleted.count;
        }

      case 'audit_logs':
        if (dryRun) {
          // Note: This assumes audit logs are stored in the analytics table temporarily
          // A proper implementation would have a dedicated audit_logs table
          const count = await this.prisma.analytics.count({
            where: { 
              createdAt: { lt: cutoffDate },
              event: { contains: ':' } // Audit logs have category:action format
            }
          });
          return count;
        } else {
          const deleted = await this.prisma.analytics.deleteMany({
            where: { 
              createdAt: { lt: cutoffDate },
              event: { contains: ':' }
            }
          });
          return deleted.count;
        }

      default:
        // Unknown category - log warning but don't delete anything
        console.warn(`Unknown data category for retention: ${category}`);
        await auditLogger.logSecurityEvent(
          'unknown_retention_category',
          'warning',
          {
            category,
            cutoffDate: cutoffDate.toISOString()
          },
          { userId: 'system' },
          'low'
        );
        return 0;
    }
  }

  /**
   * Schedule periodic cleanup
   */
  private scheduleCleanup(): void {
    if (isProduction()) {
      // Run cleanup once per day in production
      this.cleanupTimer = setInterval(() => {
        this.executeRetentionPolicies().catch(console.error);
      }, this.cleanupInterval);
    } else {
      // Run cleanup every hour in development
      this.cleanupTimer = setInterval(() => {
        this.executeRetentionPolicies().catch(console.error);
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Get retention policy statistics
   */
  async getRetentionStats(): Promise<{
    totalPolicies: number;
    activePolicies: number;
    totalRecordsDeleted: number;
    lastExecution?: Date;
  }> {
    try {
      const [policies, executions] = await Promise.all([
        this.prisma.retentionPolicy.count(),
        this.prisma.retentionPolicyExecution.aggregate({
          _sum: { recordsDeleted: true },
          _max: { executedAt: true }
        })
      ]);

      const activePolicies = await this.prisma.retentionPolicy.count({
        where: { isActive: true }
      });

      return {
        totalPolicies: policies,
        activePolicies,
        totalRecordsDeleted: executions._sum.recordsDeleted || 0,
        lastExecution: executions._max.executedAt || undefined
      };
    } catch (error) {
      console.error('Failed to get retention statistics:', error);
      throw new AppError('Failed to get retention statistics', {
        category: 'compliance',
        severity: 'medium'
      });
    }
  }

  /**
   * Graceful shutdown - clear timers
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// Export singleton instance
let dataRetentionService: DataRetentionService | null = null;

export function getDataRetentionService(prisma: PrismaClient): DataRetentionService {
  if (!dataRetentionService) {
    dataRetentionService = new DataRetentionService(prisma);
  }
  return dataRetentionService;
}

export default DataRetentionService;