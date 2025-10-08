/**
 * Data Retention Policy Enforcement
 * Automated cleanup of old data per GDPR/CCPA compliance requirements
 */

import prisma from '@/lib/prisma';
import { auditLogger } from '@/lib/audit-logger';

export interface RetentionPolicy {
  /**
   * Maximum age in days before data is deleted
   */
  maxAgeDays: number;

  /**
   * Whether to respect user "pin" flags
   */
  respectPins: boolean;

  /**
   * Dry run mode - log what would be deleted without actually deleting
   */
  dryRun: boolean;

  /**
   * Batch size for deletion operations
   */
  batchSize: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  maxAgeDays: 90,
  respectPins: true,
  dryRun: false,
  batchSize: 1000,
};

export interface RetentionResult {
  conversationsDeleted: number;
  messagesDeleted: number;
  analyticsDeleted: number;
  auditLogsDeleted: number;
  totalRecordsDeleted: number;
  durationMs: number;
}

/**
 * Execute data retention policy
 */
export async function enforceRetentionPolicy(
  policy: Partial<RetentionPolicy> = {}
): Promise<RetentionResult> {
  const config = { ...DEFAULT_RETENTION_POLICY, ...policy };
  const startTime = Date.now();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.maxAgeDays);

  console.log(`🗑️  Enforcing retention policy: deleting data older than ${cutoffDate.toISOString()}`);

  if (config.dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be actually deleted');
  }

  const result: RetentionResult = {
    conversationsDeleted: 0,
    messagesDeleted: 0,
    analyticsDeleted: 0,
    auditLogsDeleted: 0,
    totalRecordsDeleted: 0,
    durationMs: 0,
  };

  try {
    // 1. Delete old messages
    result.messagesDeleted = await deleteOldMessages(cutoffDate, config);

    // 2. Delete empty conversations
    result.conversationsDeleted = await deleteEmptyConversations(cutoffDate, config);

    // 3. Delete old analytics events
    result.analyticsDeleted = await deleteOldAnalytics(cutoffDate, config);

    // 4. Delete old audit logs (keep for longer - default 365 days)
    const auditCutoff = new Date();
    auditCutoff.setDate(auditCutoff.getDate() - 365);
    result.auditLogsDeleted = await deleteOldAuditLogs(auditCutoff, config);

    result.totalRecordsDeleted =
      result.conversationsDeleted +
      result.messagesDeleted +
      result.analyticsDeleted +
      result.auditLogsDeleted;

    result.durationMs = Date.now() - startTime;

    // Log retention execution
    await auditLogger.logSecurityEvent(
      'data_retention_executed',
      'success',
      {
        cutoffDate: cutoffDate.toISOString(),
        policy: config,
        result,
      },
      { userId: 'system' },
      'info'
    );

    console.log(`✅ Retention policy complete:`, result);

    return result;
  } catch (error) {
    console.error('❌ Retention policy failed:', error);

    await auditLogger.logSecurityEvent(
      'data_retention_failed',
      'failure',
      {
        cutoffDate: cutoffDate.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { userId: 'system' },
      'high'
    );

    throw error;
  }
}

/**
 * Delete old messages
 */
async function deleteOldMessages(
  cutoffDate: Date,
  config: RetentionPolicy
): Promise<number> {
  const where: any = {
    createdAt: { lt: cutoffDate },
  };

  // Respect pins if configured
  if (config.respectPins) {
    where.conversation = {
      pinned: { not: true },
    };
  }

  if (config.dryRun) {
    const count = await prisma.message.count({ where });
    console.log(`   Would delete ${count} messages`);
    return count;
  }

  const result = await prisma.message.deleteMany({ where });
  return result.count;
}

/**
 * Delete conversations with no messages
 */
async function deleteEmptyConversations(
  cutoffDate: Date,
  config: RetentionPolicy
): Promise<number> {
  const where: any = {
    createdAt: { lt: cutoffDate },
    messages: { none: {} },
  };

  if (config.respectPins) {
    where.pinned = { not: true };
  }

  if (config.dryRun) {
    const count = await prisma.conversation.count({ where });
    console.log(`   Would delete ${count} empty conversations`);
    return count;
  }

  const result = await prisma.conversation.deleteMany({ where });
  return result.count;
}

/**
 * Delete old analytics events
 */
async function deleteOldAnalytics(
  cutoffDate: Date,
  config: RetentionPolicy
): Promise<number> {
  const where = {
    createdAt: { lt: cutoffDate },
  };

  if (config.dryRun) {
    const count = await prisma.analytics.count({ where });
    console.log(`   Would delete ${count} analytics records`);
    return count;
  }

  const result = await prisma.analytics.deleteMany({ where });
  return result.count;
}

/**
 * Delete old audit logs (keep longer than other data)
 */
async function deleteOldAuditLogs(
  cutoffDate: Date,
  config: RetentionPolicy
): Promise<number> {
  const where = {
    timestamp: { lt: cutoffDate },
    severity: { not: 'critical' }, // Keep critical logs indefinitely
  };

  if (config.dryRun) {
    const count = await prisma.auditLog.count({ where });
    console.log(`   Would delete ${count} audit logs`);
    return count;
  }

  const result = await prisma.auditLog.deleteMany({ where });
  return result.count;
}

/**
 * Get retention statistics (what would be deleted)
 */
export async function getRetentionStats(maxAgeDays: number = 90): Promise<{
  messages: number;
  conversations: number;
  analytics: number;
  auditLogs: number;
  oldestRecord: Date | null;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const [messages, conversations, analytics, auditLogs, oldestMessage] = await Promise.all([
    prisma.message.count({
      where: { createdAt: { lt: cutoffDate } },
    }),
    prisma.conversation.count({
      where: {
        createdAt: { lt: cutoffDate },
        messages: { none: {} },
      },
    }),
    prisma.analytics.count({
      where: { createdAt: { lt: cutoffDate } },
    }),
    prisma.auditLog.count({
      where: {
        timestamp: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.message.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    messages,
    conversations,
    analytics,
    auditLogs,
    oldestRecord: oldestMessage?.createdAt || null,
  };
}
