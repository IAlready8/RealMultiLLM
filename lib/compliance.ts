import { PrismaClient } from '@prisma/client';
import { AppError, ValidationError } from '@/lib/error-system';

/**
 * Compliance helpers for GDPR/CCPA data export and deletion.  These
 * functions centralise the logic for exporting a user's personal data and
 * permanently removing it from the database.  Ensure that these operations
 * are only exposed via authenticated and authorised endpoints.
 */
export class ComplianceService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Exports all user‑associated data.  The returned object includes the
   * user's profile, provider configurations (minus secret values),
   * conversations and messages, and audit logs.  Secrets are stripped to
   * avoid accidental disclosure.
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    if (!userId) {
      throw new ValidationError('Invalid userId for export', 'userId', {
        endpoint: 'compliance.exportUserData',
        timestamp: new Date(),
        metadata: { userId },
        requestId: userId
      });
    }
    const [user, providers, teams, conversations, messages, auditLogs] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.providerConfig.findMany({ where: { userId }, select: { id: true, provider: true, createdAt: true, updatedAt: true } }),
      this.prisma.teamMembership.findMany({ where: { userId }, include: { team: true } }),
      this.prisma.conversation.findMany({ where: { userId }, include: { messages: true } }),
      this.prisma.message.findMany({ where: { userId } }),
      this.prisma.auditLog.findMany({ where: { userId } }),
    ]);
    return {
      user,
      providers,
      teams,
      conversations,
      messages,
      auditLogs,
    };
  }

  /**
   * Permanently deletes all data associated with a user.  This includes
   * messages, conversations, team memberships and provider configs.  Use
   * caution when calling this function as it cannot be undone.  Invoking
   * delete operations in a transaction ensures atomicity.
   */
  async deleteUserData(userId: string): Promise<void> {
    if (!userId) {
      throw new ValidationError('Invalid userId for deletion', 'userId', {
        endpoint: 'compliance.deleteUserData',
        timestamp: new Date(),
        metadata: { userId },
        requestId: userId
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { userId } });
      await tx.conversation.deleteMany({ where: { userId } });
      await tx.teamMembership.deleteMany({ where: { userId } });
      await tx.providerConfig.deleteMany({ where: { userId } });
      // We do not delete audit logs as they may be required for compliance
      await tx.user.delete({ where: { id: userId } });
    });
  }
}

/**
 * Log data access events for compliance purposes
 * @param userId - The user ID
 * @param resource - The resource being accessed
 * @param action - The action being performed
 * @param ip - The IP address
 * @param userAgent - The user agent
 * @param metadata - Additional metadata
 */
export async function logDataAccessEvent(
  userId: string,
  resource: string,
  action: string,
  ip?: string,
  userAgent?: string,
  metadata?: Record<string, any>
): Promise<void> {
  // In a real implementation, this would log to a secure audit trail
  // For now, we'll just log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('DATA_ACCESS_EVENT', {
      timestamp: new Date().toISOString(),
      userId,
      resource,
      action,
      ip,
      userAgent,
      metadata
    });
  }
  
  // In production, you would save this to a secure audit log database
  // This might include:
  // - Encrypted storage
  // - Immutable logs
  // - External audit trail integration
  // - Compliance reporting
}

export default ComplianceService;