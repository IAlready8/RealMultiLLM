import { PrismaClient } from '@prisma/client';
import { ComplianceConfigService, getComplianceConfigService } from '@/lib/compliance-config';
import { ComplianceAuditService, getComplianceAuditService } from '@/lib/compliance-audit';
import { DataExportService, dataExportService } from '@/services/compliance/data-export-service';
import { DataDeletionService, dataDeletionService } from '@/services/compliance/data-deletion-service';
import { AppError, ValidationError } from '@/lib/error-system';
import { auditLogger } from '@/lib/audit-logger';
import { hasPermission } from '@/lib/rbac';

/**
 * Unified compliance service that combines all compliance-related functionality
 * This service acts as a facade for all GDPR/CCPA compliance operations
 */

export interface ComplianceServiceInterface {
  // Configuration methods
  getComplianceConfig(userId: string): Promise<any>;
  updateComplianceConfig(userId: string, settings: any): Promise<any>;
  recordConsent(userId: string): Promise<any>;
  withdrawConsent(userId: string): Promise<any>;
  
  // Audit logging methods
  logComplianceEvent(userId: string | null, action: string, resource: string, outcome: 'success' | 'failure', details?: Record<string, any>): Promise<void>;
  getComplianceLogs(filters?: any): Promise<any[]>;
  exportComplianceLogs(filters?: any, format?: 'json' | 'csv'): Promise<string>;
  generateComplianceReport(startDate: Date, endDate: Date): Promise<any>;
  
  // Data export methods
  exportUserData(userId: string, options?: any): Promise<any>;
  exportUserDataAsCSV(userId: string, options?: any): Promise<string>;
  
  // Data deletion methods
  requestDataDeletion(userId: string, options?: any, reason?: string): Promise<any>;
  executeDataDeletion(userId: string, deletionRecordId: string, options?: any): Promise<void>;
  getDeletionRecords(userId: string): Promise<any[]>;
  cancelDeletionRequest(userId: string, deletionRecordId: string): Promise<any>;
  
  // Statistics methods
  getComplianceStats(): Promise<any>;
  getAuditStats(period?: 'day' | 'week' | 'month'): Promise<any>;
}

export class ComplianceService implements ComplianceServiceInterface {
  private readonly prisma: PrismaClient;
  private readonly configService: ComplianceConfigService;
  private readonly auditService: ComplianceAuditService;
  private readonly exportService: DataExportService;
  private readonly deletionService: DataDeletionService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.configService = getComplianceConfigService(prisma);
    this.auditService = getComplianceAuditService(prisma);
    this.exportService = dataExportService;
    this.deletionService = dataDeletionService;
  }

  // Configuration methods
  async getComplianceConfig(userId: string) {
    return this.configService.getComplianceConfig(userId);
  }

  async updateComplianceConfig(userId: string, settings: any) {
    return this.configService.updateComplianceConfig(userId, settings);
  }

  async recordConsent(userId: string) {
    return this.configService.recordConsent(userId);
  }

  async withdrawConsent(userId: string) {
    return this.configService.withdrawConsent(userId);
  }

  // Audit logging methods
  async logComplianceEvent(
    userId: string | null,
    action: string,
    resource: string,
    outcome: 'success' | 'failure',
    details?: Record<string, any>
  ) {
    return this.auditService.logComplianceEvent(userId, action, resource, outcome, details);
  }

  async getComplianceLogs(filters?: any) {
    return this.auditService.getComplianceLogs(filters);
  }

  async exportComplianceLogs(filters?: any, format: 'json' | 'csv' = 'json') {
    return this.auditService.exportComplianceLogs(filters, format);
  }

  async generateComplianceReport(startDate: Date, endDate: Date) {
    return this.auditService.generateComplianceReport(startDate, endDate);
  }

  // Data export methods
  async exportUserData(userId: string, options?: any) {
    return this.exportService.exportUserData(userId, options);
  }

  async exportUserDataAsCSV(userId: string, options?: any) {
    return this.exportService.exportUserDataAsCSV(userId, options);
  }

  // Data deletion methods
  async requestDataDeletion(userId: string, options?: any, reason?: string) {
    return this.deletionService.requestDataDeletion(userId, options, reason);
  }

  async executeDataDeletion(userId: string, deletionRecordId: string, options?: any) {
    return this.deletionService.executeDataDeletion(userId, deletionRecordId, options);
  }

  async getDeletionRecords(userId: string) {
    return this.deletionService.getDeletionRecords(userId);
  }

  async cancelDeletionRequest(userId: string, deletionRecordId: string) {
    return this.deletionService.cancelDeletionRequest(userId, deletionRecordId);
  }

  // Statistics methods
  async getComplianceStats() {
    return this.configService.getComplianceStats();
  }

  async getAuditStats(period?: 'day' | 'week' | 'month') {
    return this.auditService.getAuditStats(period);
  }
}

// Export singleton instance
let complianceService: ComplianceService | null = null;

export function getComplianceService(prisma: PrismaClient): ComplianceService {
  if (!complianceService) {
    complianceService = new ComplianceService(prisma);
  }
  return complianceService;
}

export default ComplianceService;