import { ComplianceService } from '@/lib/compliance';
import prisma from '@/lib/prisma';
import { AppError, ValidationError } from '@/lib/error-system';
import { isProduction } from '@/lib/env';

/**
 * Data export service for GDPR/CCPA compliance
 * Extends the basic compliance service with enhanced export capabilities
 */

export interface ExportData {
  exportedAt: string;
  userId: string;
  version: string;
  user?: any;
  personas?: any[];
  conversations?: Array<{
    id: string;
    title: string;
    messages: Array<{
      role: string;
      content: string;
      createdAt: string;
    }>;
  }>;
  providers?: any[];
  teams?: any[];
  auditLogs?: any[];
  analytics?: any[];
  settings?: any;
}

export interface ExportOptions {
  includePersonas?: boolean;
  includeConversations?: boolean;
  includeProviders?: boolean;
  includeTeams?: boolean;
  includeAuditLogs?: boolean;
  includeAnalytics?: boolean;
  includeSettings?: boolean;
  format?: 'json' | 'csv';
  anonymize?: boolean;
}

export class DataExportService {
  private readonly complianceService: ComplianceService;

  constructor() {
    this.complianceService = new ComplianceService(prisma);
  }

  /**
   * Export all user data in compliance with GDPR/CCPA
   */
  async exportUserData(
    userId: string,
    options: ExportOptions = {}
  ): Promise<ExportData> {
    if (!userId) {
      throw new ValidationError('Invalid userId for export', 'userId', {
        endpoint: 'compliance.exportUserData',
        timestamp: new Date(),
      });
    }

    try {
      // Default options
      const opts: Required<ExportOptions> = {
        includePersonas: options.includePersonas ?? true,
        includeConversations: options.includeConversations ?? true,
        includeProviders: options.includeProviders ?? true,
        includeTeams: options.includeTeams ?? true,
        includeAuditLogs: options.includeAuditLogs ?? true,
        includeAnalytics: options.includeAnalytics ?? true,
        includeSettings: options.includeSettings ?? true,
        format: options.format ?? 'json',
        anonymize: options.anonymize ?? false
      };

      const exportData: ExportData = {
        exportedAt: new Date().toISOString(),
        userId: opts.anonymize ? this.anonymizeUserId(userId) : userId,
        version: '1.0'
      };

      // Export user profile
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (user) {
        exportData.user = opts.anonymize ? this.anonymizeUser(user) : {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          emailVerified: user.emailVerified?.toISOString() || null,
          image: user.image,
          role: user.role
        };
      }

      // Export personas
      if (opts.includePersonas) {
        const personas = await prisma.persona.findMany({
          where: { userId },
          select: {
            id: true,
            title: true,
            description: true,
            prompt: true,
            createdAt: true,
            updatedAt: true
          }
        });
        
        exportData.personas = personas.map(persona => ({
          ...persona,
          createdAt: persona.createdAt.toISOString(),
          updatedAt: persona.updatedAt.toISOString()
        }));
      }

      // Export conversations and messages
      if (opts.includeConversations) {
        const conversations = await prisma.conversation.findMany({
          where: { userId },
          include: {
            messages: {
              select: {
                role: true,
                content: true,
                createdAt: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        });

        exportData.conversations = conversations.map(conv => ({
          id: conv.id,
          title: conv.title ?? '',
          messages: conv.messages.map(msg => ({
            role: msg.role,
            content: opts.anonymize ? this.anonymizeContent(msg.content) : msg.content,
            createdAt: msg.createdAt.toISOString()
          }))
        }));
      }

      // Export provider configurations (without secrets)
      if (opts.includeProviders) {
        const providers = await prisma.providerConfig.findMany({
          where: { userId },
          select: {
            id: true,
            provider: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            lastUsedAt: true,
            usageCount: true
          }
        });

        exportData.providers = providers.map(provider => ({
          ...provider,
          createdAt: provider.createdAt.toISOString(),
          updatedAt: provider.updatedAt.toISOString(),
          lastUsedAt: provider.lastUsedAt?.toISOString() || null
        }));
      }

      // Export team memberships
      if (opts.includeTeams) {
        const teams = await prisma.teamMembership.findMany({
          where: { userId },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                updatedAt: true
              }
            }
          }
        });

        exportData.teams = teams.map(tm => ({
          role: tm.role,
          joinedAt: tm.joinedAt.toISOString(),
          team: {
            ...tm.team,
            createdAt: tm.team.createdAt.toISOString(),
            updatedAt: tm.team.updatedAt.toISOString()
          }
        }));
      }

      // Export audit logs
      if (opts.includeAuditLogs) {
        const auditLogs = await prisma.auditLog.findMany({
          where: { userId },
          orderBy: {
            timestamp: 'desc'
          }
        });

        exportData.auditLogs = auditLogs.map(log => ({
          ...log,
          timestamp: log.timestamp.toISOString()
        }));
      }

      // Export analytics
      if (opts.includeAnalytics) {
        const analytics = await prisma.analytics.findMany({
          where: { userId },
          orderBy: {
            createdAt: 'desc'
          }
        });

        exportData.analytics = analytics.map(analytic => ({
          ...analytic,
          createdAt: analytic.createdAt.toISOString()
        }));
      }

      // Export settings (without secrets)
      if (opts.includeSettings) {
        // Get user settings from database or wherever they're stored
        // For now, we'll just export basic user information as settings
        const settings = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            role: true,
            twoFactorEnabled: true,
            createdAt: true,
            updatedAt: true
          }
        });

        if (settings) {
          exportData.settings = {
            ...settings,
            createdAt: settings.createdAt.toISOString(),
            updatedAt: settings.updatedAt.toISOString()
          };
        }
      }

      return exportData;
    } catch (error) {
      console.error('Data export failed:', error);
      throw new AppError('Failed to export user data', {
        category: 'compliance',
        severity: 'high',
        context: { userId, options }
      });
    }
  }

  /**
   * Export data in CSV format
   */
  async exportUserDataAsCSV(
    userId: string,
    options: Omit<ExportOptions, 'format'> = {}
  ): Promise<string> {
    const data = await this.exportUserData(userId, {
      ...options,
      format: 'json'
    });

    // Convert to CSV format
    let csv = 'Data Type,Data\n';
    
    // Add user data
    if (data.user) {
      csv += `User,${JSON.stringify(data.user)}\n`;
    }
    
    // Add personas
    if (data.personas && data.personas.length > 0) {
      data.personas.forEach(persona => {
        csv += `Persona,${JSON.stringify(persona)}\n`;
      });
    }
    
    // Add conversations
    if (data.conversations && data.conversations.length > 0) {
      data.conversations.forEach(conv => {
        csv += `Conversation,${JSON.stringify({
          id: conv.id,
          title: conv.title,
          messageCount: conv.messages.length
        })}\n`;
        
        conv.messages.forEach(msg => {
          csv += `Message,${JSON.stringify(msg)}\n`;
        });
      });
    }
    
    // Add providers
    if (data.providers && data.providers.length > 0) {
      data.providers.forEach(provider => {
        csv += `Provider,${JSON.stringify(provider)}\n`;
      });
    }
    
    // Add teams
    if (data.teams && data.teams.length > 0) {
      data.teams.forEach(team => {
        csv += `Team,${JSON.stringify(team)}\n`;
      });
    }
    
    // Add audit logs
    if (data.auditLogs && data.auditLogs.length > 0) {
      data.auditLogs.forEach(log => {
        csv += `Audit Log,${JSON.stringify(log)}\n`;
      });
    }
    
    // Add analytics
    if (data.analytics && data.analytics.length > 0) {
      data.analytics.forEach(analytic => {
        csv += `Analytic,${JSON.stringify(analytic)}\n`;
      });
    }
    
    // Add settings
    if (data.settings) {
      csv += `Settings,${JSON.stringify(data.settings)}\n`;
    }
    
    return csv;
  }

  /**
   * Anonymize user ID for privacy-preserving exports
   */
  private anonymizeUserId(userId: string): string {
    // Simple hash-based anonymization
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `anon-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Anonymize user data
   */
  private anonymizeUser(user: any): any {
    return {
      id: this.anonymizeUserId(user.id),
      name: user.name ? 'Anonymous User' : null,
      email: user.email ? `anon-${this.anonymizeUserId(user.id)}@example.com` : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
      image: user.image ? 'https://example.com/anon-avatar.png' : null,
      role: user.role
    };
  }

  /**
   * Anonymize content for privacy-preserving exports
   */
  private anonymizeContent(content: string): string {
    // Simple redaction - in production, use more sophisticated NLP techniques
    return content.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REDACTED]')
                  .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]')
                  .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CREDIT CARD REDACTED]')
                  .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REDACTED]');
  }
}

// Export singleton instance
export const dataExportService = new DataExportService();

export default DataExportService;
