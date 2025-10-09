/**
 * Compliance system types and interfaces
 * Defines the core data structures for GDPR/CCPA compliance
 */

// Base compliance types
export interface UserDataExport {
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

export interface DataDeletionRequest {
  id: string;
  userId: string;
  status: 'requested' | 'processing' | 'completed' | 'failed' | 'cancelled';
  deletionMethod: 'soft' | 'hard';
  reason?: string;
  deletionSummary?: Record<string, number>;
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  confirmationRequired: boolean;
  confirmedByUserAt?: Date;
  confirmedByAdminAt?: Date;
}

export interface ComplianceAuditLog {
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

// Compliance event types
export type ComplianceEventType = 
  | 'data_export_requested'
  | 'data_export_completed'
  | 'data_export_failed'
  | 'data_deletion_requested'
  | 'data_deletion_confirmed'
  | 'data_deletion_completed'
  | 'data_deletion_failed'
  | 'consent_given'
  | 'consent_withdrawn'
  | 'audit_log_accessed'
  | 'compliance_report_generated';

// Consent categories
export type ConsentCategory = 
  | 'data_processing'
  | 'marketing_communication'
  | 'third_party_sharing'
  | 'analytics'
  | 'personalization';

// Compliance categories
export type ComplianceCategory = 
  | 'data_privacy'
  | 'data_security'
  | 'access_control'
  | 'audit_logging'
  | 'data_retention'
  | 'user_consent'
  | 'regulatory_compliance';

// Compliance regulations
export type ComplianceRegulation = 
  | 'gdpr'    // General Data Protection Regulation (EU)
  | 'ccpa'    // California Consumer Privacy Act
  | 'hipaa'   // Health Insurance Portability and Accountability Act
  | 'sox'     // Sarbanes-Oxley Act
  | 'pci_dss' // Payment Card Industry Data Security Standard
  | 'other';  // Other regulatory requirements

// Data subject rights
export type DataSubjectRight = 
  | 'right_to_access'      // Right to access personal data
  | 'right_to_rectification' // Right to correct inaccurate data
  | 'right_to_erasure'     // Right to be forgotten
  | 'right_to_restrict'    // Right to restrict processing
  | 'right_to_portability' // Right to data portability
  | 'right_to_object'      // Right to object to processing
  | 'right_to_information' // Right to information about processing
  | 'right_to_complaint'   // Right to lodge a complaint;

// Compliance status
export interface ComplianceStatus {
  regulation: ComplianceRegulation;
  status: 'compliant' | 'partially_compliant' | 'non_compliant';
  lastChecked: Date;
  nextCheck: Date;
  issues: string[];
  remediationSteps: string[];
}

// Compliance report
export interface ComplianceReport {
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  summary: {
    totalUsers: number;
    usersWithConsent: number;
    dataExportRequests: number;
    dataDeletionRequests: number;
    successfulExports: number;
    successfulDeletions: number;
    failedExports: number;
    failedDeletions: number;
    auditLogsGenerated: number;
    highRiskEvents: number;
  };
  details: {
    dataSubjectRights: Record<DataSubjectRight, number>;
    complianceStatus: Record<ComplianceRegulation, ComplianceStatus>;
    auditLogs: ComplianceAuditLog[];
  };
  recommendations: string[];
}

// Consent management
export interface UserConsent {
  id: string;
  userId: string;
  category: string; // Consent category (e.g., "data_processing", "marketing", etc.)
  regulation: ComplianceRegulation;
  consentedAt: Date;
  withdrawnAt?: Date;
  consentText: string;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  requiresRenewal: boolean;
  renewalDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Data retention policy
export interface DataRetentionPolicy {
  id: string;
  name: string;
  description: string;
  retentionPeriod: number; // Days
  appliesTo: string[]; // Table names or data categories
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Compliance dashboard metrics
export interface ComplianceMetrics {
  totalUsers: number;
  consentRate: number;
  pendingDeletionRequests: number;
  recentAuditEvents: number;
  highRiskEvents: number;
  complianceScore: number; // 0-100 score
  gdprCompliance: ComplianceStatus;
  ccpaCompliance: ComplianceStatus;
  lastReportGenerated: Date | null;
}

// Compliance configuration options
export interface ComplianceOptions {
  enableAuditLogging: boolean;
  auditLogRetentionDays: number;
  enableDataEncryption: boolean;
  enableConsentManagement: boolean;
  defaultDataRetentionDays: number;
  enableAutomaticExports: boolean;
  exportNotificationEmail: string | null;
  enableDeletionConfirmation: boolean;
  requireAdminApprovalForDeletion: boolean;
  enableComplianceReporting: boolean;
  complianceReportFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  enableRegulatoryComplianceChecks: boolean;
  regulations: ComplianceRegulation[];
}

// Export data format options
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

// Deletion options
export interface DeletionOptions {
  includeAnalytics?: boolean;
  includeAuditLogs?: boolean;
  softDeleteOnly?: boolean;
  createDeletionRecord?: boolean;
  notifyUser?: boolean;
  confirmationRequired?: boolean;
}

// Compliance filters
export interface ComplianceFilters {
  userId?: string;
  category?: ComplianceCategory;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  regulation?: ComplianceRegulation;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}