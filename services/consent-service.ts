/**
 * Consent Management Service
 * Handles user consent for data processing, marketing communications, and third-party sharing
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError, AppError } from '../lib/error-system';
import { UserConsent, ComplianceRegulation } from '../types/compliance';
import { auditLogger } from '../lib/audit-logger';
import { isProduction } from '../lib/utils';

// Define consent categories
export type ConsentCategory = 
  | 'data_processing'
  | 'marketing_communication'
  | 'third_party_sharing'
  | 'analytics'
  | 'personalization';

export type ConsentStatus = 'granted' | 'withdrawn' | 'expired';

export interface ConsentRequest {
  userId: string;
  category: ConsentCategory;
  regulation?: ComplianceRegulation;
  consentText: string;
  version: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  requiresRenewal?: boolean;
}

export interface ConsentFilter {
  userId?: string;
  category?: ConsentCategory;
  status?: ConsentStatus;
  regulation?: ComplianceRegulation;
  requiresRenewal?: boolean;
  limit?: number;
  offset?: number;
}

export interface ConsentResponse {
  id: string;
  userId: string;
  category: ConsentCategory;
  regulation?: ComplianceRegulation;
  consentText: string;
  version: string;
  status: ConsentStatus;
  consentedAt: Date;
  withdrawnAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  requiresRenewal: boolean;
  renewalDate?: Date;
}

export class ConsentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record user consent
   */
  async recordConsent(request: ConsentRequest): Promise<ConsentResponse> {
    const { userId, category, regulation, consentText, version, ipAddress, userAgent, requiresRenewal = false } = request;

    // Validate input
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', {
        endpoint: 'consent/record',
        timestamp: new Date(),
        metadata: { userId, category },
        requestId: userId,
      });
    }

    if (!category) {
      throw new ValidationError('Consent category is required', 'category', {
        endpoint: 'consent/record',
        timestamp: new Date(),
        metadata: { userId, category },
        requestId: userId,
      });
    }

    // Check if user already has consent for this category
    const existingConsent = await this.prisma.userConsent.findFirst({
      where: {
        userId,
        category,
        withdrawnAt: null, // Only consider active consents
      },
    });

    if (existingConsent) {
      // If consent already exists and is active, return the existing one
      if (existingConsent.status === 'granted') {
        return {
          id: existingConsent.id,
          userId: existingConsent.userId,
          category: existingConsent.category as ConsentCategory,
          regulation: existingConsent.regulation as ComplianceRegulation,
          consentText: existingConsent.consentText,
          version: existingConsent.version,
          status: 'granted',
          consentedAt: existingConsent.consentedAt,
          withdrawnAt: existingConsent.withdrawnAt || undefined,
          ipAddress: existingConsent.ipAddress || undefined,
          userAgent: existingConsent.userAgent || undefined,
          requiresRenewal: existingConsent.requiresRenewal,
          renewalDate: existingConsent.renewalDate || undefined,
        };
      }
    }

    // Create new consent record
    const newConsent = await this.prisma.userConsent.create({
      data: {
        userId,
        category,
        regulation: regulation || 'gdpr',
        consentText,
        version,
        ipAddress,
        userAgent,
        requiresRenewal,
        renewalDate: requiresRenewal ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null, // 1 year ahead if requires renewal
      },
    });

    // Log consent event
    await auditLogger.logSecurityEvent(
      'consent_granted',
      'success',
      {
        userId,
        category,
        consentId: newConsent.id,
      },
      {
        userId,
        ipAddress: request.ipAddress || null,
        userAgent: request.userAgent || null,
        correlationId: newConsent.id,
      },
      'low'
    );

    return this.mapConsentToResponse(newConsent);
  }

  /**
   * Withdraw user consent
   */
  async withdrawConsent(userId: string, consentId: string): Promise<ConsentResponse> {
    if (!userId || !consentId) {
      throw new ValidationError('User ID and Consent ID are required', 'consentId', {
        endpoint: 'consent/withdraw',
        timestamp: new Date(),
        metadata: { userId, consentId },
        requestId: userId,
      });
    }

    // Find the consent record
    const consent = await this.prisma.userConsent.findFirst({
      where: {
        id: consentId,
        userId,
        withdrawnAt: null, // Only allow withdrawing active consents
      },
    });

    if (!consent) {
      throw new ValidationError('Consent record not found or already withdrawn', 'consentId', {
        endpoint: 'consent/withdraw',
        timestamp: new Date(),
        metadata: { userId, consentId },
        requestId: userId,
      });
    }

    // Update consent to withdrawn
    const updatedConsent = await this.prisma.userConsent.update({
      where: {
        id: consentId,
      },
      data: {
        withdrawnAt: new Date(),
        status: 'withdrawn',
      },
    });

    // Log consent withdrawal event
    await auditLogger.logSecurityEvent(
      'consent_withdrawn',
      'success',
      {
        userId,
        consentId,
        category: updatedConsent.category,
      },
      {
        userId,
        ipAddress: updatedConsent.ipAddress || null,
        userAgent: updatedConsent.userAgent || null,
        correlationId: consentId,
      },
      'medium'
    );

    return this.mapConsentToResponse(updatedConsent);
  }

  /**
   * Check if user has consented to a specific category
   */
  async hasConsent(userId: string, category: ConsentCategory): Promise<boolean> {
    if (!userId || !category) {
      return false;
    }

    const consent = await this.prisma.userConsent.findFirst({
      where: {
        userId,
        category,
        withdrawnAt: null, // Only active consents
        OR: [
          { requiresRenewal: false },
          { renewalDate: { gte: new Date() } }, // Not expired if renewal is required
        ],
      },
    });

    return !!consent;
  }

  /**
   * Get user's consent status for all categories
   */
  async getUserConsentStatus(userId: string): Promise<Record<ConsentCategory, boolean>> {
    if (!userId) {
      return {
        data_processing: false,
        marketing_communication: false,
        third_party_sharing: false,
        analytics: false,
        personalization: false,
      };
    }

    const consents = await this.prisma.userConsent.findMany({
      where: {
        userId,
        withdrawnAt: null, // Only active consents
        OR: [
          { requiresRenewal: false },
          { renewalDate: { gte: new Date() } }, // Not expired if renewal is required
        ],
      },
    });

    const consentStatus: Record<ConsentCategory, boolean> = {
      data_processing: false,
      marketing_communication: false,
      third_party_sharing: false,
      analytics: false,
      personalization: false,
    };

    consents.forEach(consent => {
      const category = consent.category as ConsentCategory;
      consentStatus[category] = true;
    });

    return consentStatus;
  }

  /**
   * Get consent records with filters
   */
  async getConsents(filter: ConsentFilter): Promise<ConsentResponse[]> {
    const whereClause: any = {};

    if (filter.userId) whereClause.userId = filter.userId;
    if (filter.category) whereClause.category = filter.category;
    if (filter.status) {
      if (filter.status === 'granted') {
        whereClause.withdrawnAt = null;
        if (filter.requiresRenewal) {
          whereClause.OR = [
            { requiresRenewal: false },
            { renewalDate: { gte: new Date() } },
          ];
        }
      } else if (filter.status === 'withdrawn') {
        whereClause.withdrawnAt = { not: null };
      } else if (filter.status === 'expired') {
        whereClause.requiresRenewal = true;
        whereClause.renewalDate = { lt: new Date() };
      }
    }
    if (filter.regulation) whereClause.regulation = filter.regulation;

    const consents = await this.prisma.userConsent.findMany({
      where: whereClause,
      orderBy: { consentedAt: 'desc' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    });

    return consents.map(this.mapConsentToResponse);
  }

  /**
   * Renew consent that has expired or requires renewal
   */
  async renewConsent(userId: string, category: ConsentCategory, newConsentText: string, version: string): Promise<ConsentResponse> {
    if (!userId || !category) {
      throw new ValidationError('User ID and Consent category are required', 'userId', {
        endpoint: 'consent/renew',
        timestamp: new Date(),
        metadata: { userId, category },
        requestId: userId,
      });
    }

    // Find the existing consent that needs renewal
    const existingConsent = await this.prisma.userConsent.findFirst({
      where: {
        userId,
        category,
        OR: [
          { requiresRenewal: true, renewalDate: { lt: new Date() } }, // Expired
          { withdrawnAt: { not: null } }, // Previously withdrawn
        ],
      },
    });

    if (!existingConsent) {
      // If no existing consent that needs renewal, create a new one
      return this.recordConsent({
        userId,
        category,
        consentText: newConsentText,
        version,
        requiresRenewal: true,
      });
    }

    // Update the existing consent
    const renewedConsent = await this.prisma.userConsent.update({
      where: {
        id: existingConsent.id,
      },
      data: {
        consentText: newConsentText,
        version,
        withdrawnAt: null,
        status: 'granted',
        renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      },
    });

    // Log consent renewal event
    await auditLogger.logSecurityEvent(
      'consent_renewed',
      'success',
      {
        userId,
        consentId: renewedConsent.id,
        category,
      },
      {
        userId,
        ipAddress: renewedConsent.ipAddress || null,
        userAgent: renewedConsent.userAgent || null,
        correlationId: renewedConsent.id,
      },
      'low'
    );

    return this.mapConsentToResponse(renewedConsent);
  }

  /**
   * Bulk consent operations
   */
  async bulkConsentAction(userId: string, categories: ConsentCategory[], action: 'grant' | 'withdraw'): Promise<ConsentResponse[]> {
    if (!userId || !categories || categories.length === 0) {
      throw new ValidationError('User ID and at least one category are required', 'userId', {
        endpoint: 'consent/bulk',
        timestamp: new Date(),
        metadata: { userId, categories, action },
        requestId: userId,
      });
    }

    const results: ConsentResponse[] = [];

    for (const category of categories) {
      if (action === 'grant') {
        // For grant, we'll record consent with default values
        const consent = await this.recordConsent({
          userId,
          category,
          consentText: this.getDefaultConsentText(category),
          version: '1.0',
        });
        results.push(consent);
      } else if (action === 'withdraw') {
        // For withdraw, we need to find existing active consent records
        const existingConsent = await this.prisma.userConsent.findFirst({
          where: {
            userId,
            category,
            withdrawnAt: null,
          },
        });

        if (existingConsent) {
          const withdrawnConsent = await this.withdrawConsent(userId, existingConsent.id);
          results.push(withdrawnConsent);
        }
      }
    }

    return results;
  }

  /**
   * Get consent metrics for dashboard
   */
  async getConsentMetrics(): Promise<{
    totalUsers: number;
    totalConsents: number;
    grantedConsents: number;
    withdrawnConsents: number;
    consentRates: Record<ConsentCategory, number>;
    requiresRenewal: number;
  }> {
    const [totalUsers, totalConsents, grantedConsents, withdrawnConsents, consentsByCategory] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.userConsent.count(),
      this.prisma.userConsent.count({
        where: { withdrawnAt: null },
      }),
      this.prisma.userConsent.count({
        where: { withdrawnAt: { not: null } },
      }),
      this.prisma.userConsent.groupBy({
        by: ['category'],
        where: { withdrawnAt: null },
        _count: true,
      }),
    ]);

    // Calculate consent rates by category
    const consentRates: Record<ConsentCategory, number> = {
      data_processing: 0,
      marketing_communication: 0,
      third_party_sharing: 0,
      analytics: 0,
      personalization: 0,
    };

    consentsByCategory.forEach(cat => {
      const category = cat.category as ConsentCategory;
      consentRates[category] = totalUsers > 0 ? Math.round((cat._count / totalUsers) * 100) : 0;
    });

    // Count consents that require renewal
    const requiresRenewal = await this.prisma.userConsent.count({
      where: {
        requiresRenewal: true,
        renewalDate: { lt: new Date() },
      },
    });

    return {
      totalUsers,
      totalConsents,
      grantedConsents,
      withdrawnConsents,
      consentRates,
      requiresRenewal,
    };
  }

  /**
   * Helper function to map database consent to response type
   */
  private mapConsentToResponse(consent: any): ConsentResponse {
    return {
      id: consent.id,
      userId: consent.userId,
      category: consent.category as ConsentCategory,
      regulation: consent.regulation as ComplianceRegulation,
      consentText: consent.consentText,
      version: consent.version,
      status: consent.withdrawnAt ? 'withdrawn' : 'granted',
      consentedAt: consent.consentedAt,
      withdrawnAt: consent.withdrawnAt || undefined,
      ipAddress: consent.ipAddress || undefined,
      userAgent: consent.userAgent || undefined,
      requiresRenewal: consent.requiresRenewal,
      renewalDate: consent.renewalDate || undefined,
    };
  }

  /**
   * Get default consent text for a category
   */
  private getDefaultConsentText(category: ConsentCategory): string {
    switch (category) {
      case 'data_processing':
        return 'I consent to the processing of my personal data in accordance with the terms of the service.';
      case 'marketing_communication':
        return 'I consent to receive marketing communications from the company.';
      case 'third_party_sharing':
        return 'I consent to the sharing of my data with trusted third parties for the purposes described.';
      case 'analytics':
        return 'I consent to the use of analytics tools to improve the service.';
      case 'personalization':
        return 'I consent to the use of my data to personalize my experience.';
      default:
        return 'I consent to the processing of my personal data.';
    }
  }
}

// Export singleton instance
let consentService: ConsentService | null = null;

export function getConsentService(prisma: PrismaClient): ConsentService {
  if (!consentService) {
    consentService = new ConsentService(prisma);
  }
  return consentService;
}

export default ConsentService;