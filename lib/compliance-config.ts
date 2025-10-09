import { PrismaClient } from '@prisma/client';
import { AppError, ValidationError } from '@/lib/error-system';
import { isProduction } from '@/lib/env';
import { auditLogger } from '@/lib/audit-logger';

/**
 * Compliance configuration service for managing GDPR/CCPA compliance settings
 */

export interface ComplianceConfig {
  id: string;
  userId: string;
  dataRetentionPeriod: number; // Days
  exportFormat: 'json' | 'csv';
  notificationEmail: string | null;
  consentGivenAt: Date | null;
  consentWithdrawnAt: Date | null;
  lastExportedAt: Date | null;
  exportFrequency: 'manual' | 'daily' | 'weekly' | 'monthly';
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceSettings {
  dataRetentionPeriod: number;
  exportFormat: 'json' | 'csv';
  notificationEmail: string | null;
  exportFrequency: 'manual' | 'daily' | 'weekly' | 'monthly';
}

export class ComplianceConfigService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get compliance configuration for a user
   */
  public async getComplianceConfig(userId: string): Promise<ComplianceConfig> {
    if (!userId) {
      throw new ValidationError('Invalid userId for compliance config', 'userId', {
        endpoint: 'compliance.getConfig',
        timestamp: new Date(),
        metadata: { userId },
        requestId: userId
      });
    }

    try {
      let config = await this.prisma.complianceConfig.findUnique({
        where: { userId }
      });

      if (!config) {
        // Create default config if none exists
        config = await this.prisma.complianceConfig.create({
          data: {
            userId,
            dataRetentionPeriod: isProduction() ? 2555 : 90, // 7 years in prod, 90 days in dev
            exportFormat: 'json',
            exportFrequency: 'manual',
            notificationEmail: null,
            consentGivenAt: null,
            consentWithdrawnAt: null,
            lastExportedAt: null
          }
        });

        await auditLogger.logSecurityEvent(
          'compliance_config_created',
          'success',
          {
            userId,
            configId: config.id
          },
          { userId },
          'medium'
        );
      }

      return {
        ...config,
        exportFormat: (config.exportFormat === 'json' || config.exportFormat === 'csv') ? config.exportFormat : 'json',
        exportFrequency: (config.exportFrequency === 'manual' || config.exportFrequency === 'daily' || config.exportFrequency === 'weekly' || config.exportFrequency === 'monthly') ? config.exportFrequency : 'manual',
        consentGivenAt: config.consentGivenAt || null,
        consentWithdrawnAt: config.consentWithdrawnAt || null,
        lastExportedAt: config.lastExportedAt || null,
        notificationEmail: config.notificationEmail || null
      };
    } catch (error) {
      console.error('Failed to get compliance config:', error);
      await auditLogger.logSecurityEvent(
        'compliance_config_get_failed',
        'failure',
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { userId },
        'high'
      );
      throw new AppError('Failed to get compliance configuration', {
        category: 'compliance',
        severity: 'high',
        context: { userId }
      });
    }
  }

  /**
   * Update compliance configuration for a user
   */
  public async updateComplianceConfig(
    userId: string,
    settings: Partial<ComplianceSettings>
  ): Promise<ComplianceConfig> {
    if (!userId) {
      throw new ValidationError('Invalid userId for compliance config update', 'userId', {
        endpoint: 'compliance.updateConfig',
        timestamp: new Date(),
        metadata: { userId },
        requestId: userId
      });
    }

    try {
      const config = await this.prisma.complianceConfig.upsert({
        where: { userId },
        update: {
          dataRetentionPeriod: settings.dataRetentionPeriod,
          exportFormat: settings.exportFormat,
          notificationEmail: settings.notificationEmail,
          exportFrequency: settings.exportFrequency,
          updatedAt: new Date()
        },
        create: {
          userId,
          dataRetentionPeriod: settings.dataRetentionPeriod || (isProduction() ? 2555 : 90),
          exportFormat: settings.exportFormat || 'json',
          notificationEmail: settings.notificationEmail || null,
          exportFrequency: settings.exportFrequency || 'manual',
          consentGivenAt: null,
          consentWithdrawnAt: null,
          lastExportedAt: null
        }
      });

      await auditLogger.logSecurityEvent(
        'compliance_config_updated',
        'success',
        {
          userId,
          configId: config.id,
          changes: Object.keys(settings)
        },
        { userId },
        'medium'
      );

      return {
        ...config,
        exportFormat: (config.exportFormat === 'json' || config.exportFormat === 'csv') ? config.exportFormat : 'json',
        exportFrequency: (config.exportFrequency === 'manual' || config.exportFrequency === 'daily' || config.exportFrequency === 'weekly' || config.exportFrequency === 'monthly') ? config.exportFrequency : 'manual',
        consentGivenAt: config.consentGivenAt || null,
        consentWithdrawnAt: config.consentWithdrawnAt || null,
        lastExportedAt: config.lastExportedAt || null,
        notificationEmail: config.notificationEmail || null
      };
    } catch (error) {
      console.error('Failed to update compliance config:', error);
      await auditLogger.logSecurityEvent(
        'compliance_config_update_failed',
        'failure',
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          settings
        },
        { userId },
        'high'
      );
      throw new AppError('Failed to update compliance configuration', {
        category: 'compliance',
        severity: 'high',
        context: { userId, settings }
      });
    }
  }

  /**
   * Record user consent for data processing
   */
  public async recordConsent(userId: string): Promise<ComplianceConfig> {
    if (!userId) {
      throw new ValidationError('Invalid userId for consent recording', 'userId', {
        endpoint: 'compliance.recordConsent',
        timestamp: new Date(),
        metadata: { userId },
        requestId: userId
      });
    }

    try {
      const config = await this.prisma.complianceConfig.upsert({
        where: { userId },
        update: {
          consentGivenAt: new Date(),
          consentWithdrawnAt: null,
          updatedAt: new Date()
        },
        create: {
          userId,
          dataRetentionPeriod: isProduction() ? 2555 : 90,
          exportFormat: 'json',
          exportFrequency: 'manual',
          notificationEmail: null,
          consentGivenAt: new Date(),
          consentWithdrawnAt: null,
          lastExportedAt: null
        }
      });

      await auditLogger.logSecurityEvent(
        'consent_recorded',
        'success',
        {
          userId,
          configId: config.id
        },
        { userId },
        'high'
      );

      return {
        ...config,
        exportFormat: (config.exportFormat === 'json' || config.exportFormat === 'csv') ? config.exportFormat : 'json',
        exportFrequency: (config.exportFrequency === 'manual' || config.exportFrequency === 'daily' || config.exportFrequency === 'weekly' || config.exportFrequency === 'monthly') ? config.exportFrequency : 'manual',
        consentGivenAt: config.consentGivenAt || null,
        consentWithdrawnAt: config.consentWithdrawnAt || null,
        lastExportedAt: config.lastExportedAt || null,
        notificationEmail: config.notificationEmail || null
      };
    } catch (error) {
      console.error('Failed to record user consent:', error);
      await auditLogger.logSecurityEvent(
        'consent_recording_failed',
        'failure',
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { userId },
        'critical'
      );
      throw new AppError('Failed to record user consent', {
        category: 'compliance',
        severity: 'critical',
        context: { userId }
      });
    }
  }

  /**
   * Withdraw user consent for data processing
   */
  public async withdrawConsent(userId: string): Promise<ComplianceConfig> {
    if (!userId) {
      throw new ValidationError('Invalid userId for consent withdrawal', 'userId', {
        endpoint: 'compliance.withdrawConsent',
        timestamp: new Date(),
        metadata: { userId },
        requestId: userId
      });
    }

    try {
      const config = await this.prisma.complianceConfig.update({
        where: { userId },
        data: {
          consentWithdrawnAt: new Date(),
          updatedAt: new Date()
        }
      });

      await auditLogger.logSecurityEvent(
        'consent_withdrawn',
        'success',
        {
          userId,
          configId: config.id
        },
        { userId },
        'high'
      );

      return {
        ...config,
        exportFormat: (config.exportFormat === 'json' || config.exportFormat === 'csv') ? config.exportFormat : 'json',
        exportFrequency: (config.exportFrequency === 'manual' || config.exportFrequency === 'daily' || config.exportFrequency === 'weekly' || config.exportFrequency === 'monthly') ? config.exportFrequency : 'manual',
        consentGivenAt: config.consentGivenAt || null,
        consentWithdrawnAt: config.consentWithdrawnAt || null,
        lastExportedAt: config.lastExportedAt || null,
        notificationEmail: config.notificationEmail || null
      };
    } catch (error) {
      console.error('Failed to withdraw user consent:', error);
      await auditLogger.logSecurityEvent(
        'consent_withdrawal_failed',
        'failure',
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { userId },
        'critical'
      );
      throw new AppError('Failed to withdraw user consent', {
        category: 'compliance',
        severity: 'critical',
        context: { userId }
      });
    }
  }

  /**
   * Update last export timestamp
   */
  public async updateLastExport(userId: string): Promise<void> {
    if (!userId) {
      throw new ValidationError('Invalid userId for export timestamp update', 'userId', {
        endpoint: 'compliance.updateLastExport',
        timestamp: new Date(),
        metadata: { userId },
        requestId: userId
      });
    }

    try {
      await this.prisma.complianceConfig.update({
        where: { userId },
        data: {
          lastExportedAt: new Date(),
          updatedAt: new Date()
        }
      });

      await auditLogger.logSecurityEvent(
        'export_timestamp_updated',
        'success',
        {
          userId
        },
        { userId },
        'low'
      );
    } catch (error) {
      console.error('Failed to update export timestamp:', error);
      await auditLogger.logSecurityEvent(
        'export_timestamp_update_failed',
        'failure',
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { userId },
        'medium'
      );
      throw new AppError('Failed to update export timestamp', {
        category: 'compliance',
        severity: 'medium',
        context: { userId }
      });
    }
  }

  /**
   * Get all compliance configurations (admin only)
   */
  public async getAllComplianceConfigs(): Promise<ComplianceConfig[]> {
    try {
      const configs = await this.prisma.complianceConfig.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });

      return configs.map(config => ({
        ...config,
        exportFormat: (config.exportFormat === 'json' || config.exportFormat === 'csv') ? config.exportFormat : 'json',
        exportFrequency: (config.exportFrequency === 'manual' || config.exportFrequency === 'daily' || config.exportFrequency === 'weekly' || config.exportFrequency === 'monthly') ? config.exportFrequency : 'manual',
        consentGivenAt: config.consentGivenAt || null,
        consentWithdrawnAt: config.consentWithdrawnAt || null,
        lastExportedAt: config.lastExportedAt || null,
        notificationEmail: config.notificationEmail || null
      }));
    } catch (error) {
      console.error('Failed to get all compliance configs:', error);
      throw new AppError('Failed to get all compliance configurations', {
        category: 'compliance',
        severity: 'high',
        context: {}
      });
    }
  }

  /**
   * Get compliance statistics
   */
  public async getComplianceStats(): Promise<{
    totalUsers: number;
    usersWithConsent: number;
    usersWithExports: number;
    averageRetentionPeriod: number;
  }> {
    try {
      const [totalUsers, consentedUsers, exportedUsers, avgRetention] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.complianceConfig.count({
          where: {
            consentGivenAt: { not: null },
            consentWithdrawnAt: null
          }
        }),
        this.prisma.complianceConfig.count({
          where: {
            lastExportedAt: { not: null }
          }
        }),
        this.prisma.complianceConfig.aggregate({
          _avg: {
            dataRetentionPeriod: true
          }
        })
      ]);

      return {
        totalUsers,
        usersWithConsent: consentedUsers,
        usersWithExports: exportedUsers,
        averageRetentionPeriod: avgRetention._avg.dataRetentionPeriod || 0
      };
    } catch (error) {
      console.error('Failed to get compliance statistics:', error);
      throw new AppError('Failed to get compliance statistics', {
        category: 'compliance',
        severity: 'medium',
        context: {}
      });
    }
  }
}

// Export singleton instance
let complianceConfigService: ComplianceConfigService | null = null;

export function getComplianceConfigService(prisma: PrismaClient): ComplianceConfigService {
  if (!complianceConfigService) {
    complianceConfigService = new ComplianceConfigService(prisma);
  }
  return complianceConfigService;
}

export default ComplianceConfigService;