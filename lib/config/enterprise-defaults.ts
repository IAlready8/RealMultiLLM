/**
 * Enterprise Configuration Defaults
 * Provides fallback values for enterprise features when not explicitly configured
 */

export const ENTERPRISE_CONFIG_DEFAULTS = {
  performance: {
    monitoring: {
      enabled: true,
      interval: 60000, // 1 minute
      metrics: ['cpu', 'memory', 'requests'],
      tracing: {
        enabled: false,
        samplingRate: 0.1,
        endpoint: null,
        serviceName: 'realmultillm',
      },
    },
    caching: {
      enabled: true,
      ttl: 3600,
      maxSize: 1000,
      strategy: 'lru',
    },
    optimization: {
      bundleAnalyzer: false,
      imageOptimization: true,
      compressionLevel: 6,
    },
  },
  security: {
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90,
    },
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      maxRequests: 60,
      strategy: 'sliding-window',
    },
    headers: {
      csp: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
      hsts: true,
      frameOptions: 'DENY',
      contentTypeOptions: 'nosniff',
    },
    audit: {
      enabled: true,
      level: 'info',
      retention: 90, // days
    },
  },
  features: {
    analytics: true,
    telemetry: false,
    collaboration: true,
    advancedSearch: false,
    aiAssist: true,
  },
  limits: {
    maxTeamSize: 50,
    maxConversationsPerUser: 1000,
    maxMessagesPerConversation: 10000,
    maxUploadSizeMB: 10,
  },
  compliance: {
    gdpr: {
      enabled: false,
      dataRetentionDays: 365,
      rightToErasure: true,
    },
    hipaa: {
      enabled: false,
      auditLevel: 'full',
    },
    soc2: {
      enabled: false,
      controlsVersion: '2023',
    },
  },
} as const;

export type EnterpriseConfig = typeof ENTERPRISE_CONFIG_DEFAULTS;
