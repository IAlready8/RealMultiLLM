import { z } from 'zod';
import { configManager, type SystemConfig } from '../config-manager';
import { env } from '../env';

// Enterprise Configuration Schema
export const enterpriseConfigSchema = z.object({
  // Feature flags for enterprise capabilities
  features: z.object({
    auditLogging: z.boolean().default(false),
    complianceMonitoring: z.boolean().default(false),
    dataEncryption: z.boolean().default(false),
    userImpersonation: z.boolean().default(false),
    rbac: z.boolean().default(false),
    apiRateLimiting: z.boolean().default(true),
    requestTracing: z.boolean().default(false),
    performanceMonitoring: z.boolean().default(false),
    securityScanning: z.boolean().default(false),
  }),
  
  // Security configurations
  security: z.object({
    // Authentication settings
    authentication: z.object({
      sso: z.object({
        enabled: z.boolean().default(false),
        provider: z.enum(['okta', 'auth0', 'azure-ad', 'custom']).optional(),
        metadataUrl: z.string().url().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      }),
      mfa: z.object({
        required: z.boolean().default(false),
        methods: z.array(z.enum(['totp', 'sms', 'email', 'hardware'])).default(['totp']),
      }),
    }),
    
    // Encryption settings
    encryption: z.object({
      atRest: z.boolean().default(false),
      inTransit: z.boolean().default(true),
      keyRotationDays: z.number().min(1).default(90),
      algorithm: z.enum(['AES-256-GCM', 'ChaCha20-Poly1305']).default('AES-256-GCM'),
    }),
    
    // Network security
    network: z.object({
      ipWhitelist: z.array(z.string()).optional(),
      cors: z.object({
        allowedOrigins: z.array(z.string()).default(['*']),
        allowedMethods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
        allowedHeaders: z.array(z.string()).default(['Content-Type', 'Authorization']),
      }),
      rateLimiting: z.object({
        windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
        max: z.number().default(100),
        message: z.string().default('Too many requests, please try again later.'),
      }),
    }),
  }),
  
  // Compliance configurations
  compliance: z.object({
    logging: z.object({
      retentionDays: z.number().min(1).default(365),
      piiLogging: z.boolean().default(false),
      logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    }),
    gdpr: z.object({
      enabled: z.boolean().default(false),
      dataPortability: z.boolean().default(false),
      rightToErasure: z.boolean().default(false),
    }),
    hipaa: z.object({
      enabled: z.boolean().default(false),
      dataEncryption: z.boolean().default(false),
      accessControls: z.boolean().default(false),
    }),
    sox: z.object({
      enabled: z.boolean().default(false),
      auditTrail: z.boolean().default(false),
      financialControls: z.boolean().default(false),
    }),
    pci: z.object({
      enabled: z.boolean().default(false),
      dataProtection: z.boolean().default(false),
      networkSecurity: z.boolean().default(false),
    }),
  }),
  
  // Performance configurations
  performance: z.object({
    caching: z.object({
      enabled: z.boolean().default(true),
      ttlSeconds: z.number().min(60).default(3600), // 1 hour
      storage: z.enum(['memory', 'redis', 'vercel-kv']).default('memory'),
      maxSize: z.number().min(1024).default(100 * 1024 * 1024), // 100MB in bytes
    }),
    monitoring: z.object({
      enabled: z.boolean().default(false),
      sampleRate: z.number().min(0).max(1).default(1.0), // Percentage of requests to sample
      metricsEndpoint: z.string().optional(),
      tracing: z.object({
        enabled: z.boolean().default(false),
        exporter: z.enum(['console', 'jaeger', 'zipkin', 'otlp']).default('console'),
        endpoint: z.string().optional(),
      }),
    }),
    resourceLimits: z.object({
      maxConcurrentRequests: z.number().min(1).default(100),
      requestTimeoutMs: z.number().min(1000).default(30000),
      memoryLimitMB: z.number().min(128).default(1024),
    }),
  }),
  
  // Integration configurations
  integrations: z.object({
    externalServices: z.object({
      monitoring: z.object({
        provider: z.enum(['datadog', 'newrelic', 'prometheus', 'custom']).optional(),
        apiKey: z.string().optional(),
        endpoint: z.string().url().optional(),
      }),
      logging: z.object({
        provider: z.enum(['splunk', 'elk', 'datadog', 'loki', 'custom']).optional(),
        apiKey: z.string().optional(),
        endpoint: z.string().url().optional(),
      }),
      identity: z.object({
        provider: z.enum(['okta', 'auth0', 'azure-ad', 'aws-cognito', 'custom']).optional(),
        apiKey: z.string().optional(),
        endpoint: z.string().url().optional(),
      }),
    }),
    analytics: z.object({
      enabled: z.boolean().default(false),
      provider: z.enum(['mixpanel', 'amplitude', 'ga4', 'custom']).default('ga4'),
      trackingId: z.string().optional(),
      eventSamplingRate: z.number().min(0).max(1).default(1.0),
    }),
  }),
  
  // Operational configurations
  operations: z.object({
    maintenance: z.object({
      enabled: z.boolean().default(false),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('02:00'), // HH:MM format
      durationMinutes: z.number().min(15).default(30),
      allowedIps: z.array(z.string()).optional(),
    }),
    backup: z.object({
      enabled: z.boolean().default(true),
      schedule: z.string().default('0 2 * * *'), // Every day at 2 AM (cron format)
      retentionDays: z.number().min(1).default(30),
      destination: z.enum(['s3', 'gcs', 'azure-blob', 'local']).default('s3'),
    }),
    disasterRecovery: z.object({
      enabled: z.boolean().default(false),
      backupFrequency: z.string().default('0 */6 * * *'), // Every 6 hours
      failoverStrategy: z.enum(['hot', 'warm', 'cold']).default('warm'),
    }),
  }),
});

export type EnterpriseConfig = z.infer<typeof enterpriseConfigSchema>;

// Default enterprise configuration
export const DEFAULT_ENTERPRISE_CONFIG: EnterpriseConfig = {
  features: {
    auditLogging: false,
    complianceMonitoring: false,
    dataEncryption: false,
    userImpersonation: false,
    rbac: false,
    apiRateLimiting: true,
    requestTracing: false,
    performanceMonitoring: false,
    securityScanning: false,
  },
  security: {
    authentication: {
      sso: {
        enabled: false,
      },
      mfa: {
        required: false,
        methods: ['totp'],
      },
    },
    encryption: {
      atRest: false,
      inTransit: true,
      keyRotationDays: 90,
      algorithm: 'AES-256-GCM',
    },
    network: {
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        message: 'Too many requests, please try again later.',
      },
    },
  },
  compliance: {
    logging: {
      retentionDays: 365,
      piiLogging: false,
      logLevel: 'info',
    },
    gdpr: {
      enabled: false,
      dataPortability: false,
      rightToErasure: false,
    },
    hipaa: {
      enabled: false,
      dataEncryption: false,
      accessControls: false,
    },
    sox: {
      enabled: false,
      auditTrail: false,
      financialControls: false,
    },
    pci: {
      enabled: false,
      dataProtection: false,
      networkSecurity: false,
    },
  },
  performance: {
    caching: {
      enabled: true,
      ttlSeconds: 3600,
      storage: 'memory',
      maxSize: 100 * 1024 * 1024, // 100MB
    },
    monitoring: {
      enabled: false,
      sampleRate: 1.0,
      tracing: {
        enabled: false,
        exporter: 'console',
      },
    },
    resourceLimits: {
      maxConcurrentRequests: 100,
      requestTimeoutMs: 30000,
      memoryLimitMB: 1024,
    },
  },
  integrations: {
    externalServices: {
      monitoring: {},
      logging: {},
      identity: {},
    },
    analytics: {
      enabled: false,
      provider: 'ga4',
      eventSamplingRate: 1.0,
    },
  },
  operations: {
    maintenance: {
      enabled: false,
      startTime: '02:00',
      durationMinutes: 30,
    },
    backup: {
      enabled: true,
      schedule: '0 2 * * *',
      retentionDays: 30,
      destination: 's3',
    },
    disasterRecovery: {
      enabled: false,
      backupFrequency: '0 */6 * * *',
      failoverStrategy: 'warm',
    },
  },
};

// Enterprise Configuration Manager
export class EnterpriseConfigurationManager {
  private static instance: EnterpriseConfigurationManager;
  private config: EnterpriseConfig | null = null;
  private lastFetch: Date | null = null;
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): EnterpriseConfigurationManager {
    if (!EnterpriseConfigurationManager.instance) {
      EnterpriseConfigurationManager.instance = new EnterpriseConfigurationManager();
    }
    return EnterpriseConfigurationManager.instance;
  }

  /**
   * Get the enterprise configuration, optionally forcing a refresh
   */
  public async getEnterpriseConfig(forceRefresh = false): Promise<EnterpriseConfig> {
    if (
      !forceRefresh &&
      this.config &&
      this.lastFetch &&
      Date.now() - this.lastFetch.getTime() < this.cacheTimeout
    ) {
      return this.config;
    }

    try {
      const config = await this.loadEnterpriseConfig();
      this.config = config;
      this.lastFetch = new Date();
      return config;
    } catch (error) {
      console.error('Failed to load enterprise configuration:', error);
      // Return default config as fallback
      return DEFAULT_ENTERPRISE_CONFIG;
    }
  }

  /**
   * Load enterprise configuration from environment variables and database
   */
  private async loadEnterpriseConfig(): Promise<EnterpriseConfig> {
    // Start with default config
    let config: EnterpriseConfig = { ...DEFAULT_ENTERPRISE_CONFIG };

    // Override with environment variables
    config = this.applyEnvironmentOverrides(config);

    // Validate the configuration
    const validation = enterpriseConfigSchema.safeParse(config);
    if (!validation.success) {
      console.error('Enterprise configuration validation error:', validation.error);
      // Return default config as fallback
      return DEFAULT_ENTERPRISE_CONFIG;
    }

    return validation.data;
  }

  /**
   * Apply environment variable overrides to the configuration
   */
  private applyEnvironmentOverrides(config: EnterpriseConfig): EnterpriseConfig {
    // Check if env is available
    if (typeof env === 'undefined') {
      return config;
    }
    
    // Feature flags
    if (env.ENTERPRISE_AUDIT_LOGGING !== undefined) {
      config.features.auditLogging = env.ENTERPRISE_AUDIT_LOGGING;
    }
    if (env.ENTERPRISE_COMPLIANCE_MONITORING !== undefined) {
      config.features.complianceMonitoring = env.ENTERPRISE_COMPLIANCE_MONITORING;
    }
    if (env.ENTERPRISE_DATA_ENCRYPTION !== undefined) {
      config.features.dataEncryption = env.ENTERPRISE_DATA_ENCRYPTION;
    }
    if (env.ENTERPRISE_USER_IMPERSONATION !== undefined) {
      config.features.userImpersonation = env.ENTERPRISE_USER_IMPERSONATION;
    }
    if (env.ENTERPRISE_RBAC !== undefined) {
      config.features.rbac = env.ENTERPRISE_RBAC;
    }
    if (env.ENTERPRISE_REQUEST_TRACING !== undefined) {
      config.features.requestTracing = env.ENTERPRISE_REQUEST_TRACING;
    }
    if (env.ENTERPRISE_PERFORMANCE_MONITORING !== undefined) {
      config.features.performanceMonitoring = env.ENTERPRISE_PERFORMANCE_MONITORING;
    }
    if (env.ENTERPRISE_SECURITY_SCANNING !== undefined) {
      config.features.securityScanning = env.ENTERPRISE_SECURITY_SCANNING;
    }

    // Security settings
    if (env.SSO_ENABLED !== undefined) {
      config.security.authentication.sso.enabled = env.SSO_ENABLED;
    }
    if (env.SSO_PROVIDER) {
      config.security.authentication.sso.provider = env.SSO_PROVIDER as any;
    }
    if (env.SSO_METADATA_URL) {
      config.security.authentication.sso.metadataUrl = env.SSO_METADATA_URL;
    }
    if (env.SSO_CLIENT_ID) {
      config.security.authentication.sso.clientId = env.SSO_CLIENT_ID;
    }
    if (env.SSO_CLIENT_SECRET) {
      config.security.authentication.sso.clientSecret = env.SSO_CLIENT_SECRET;
    }
    if (env.MFA_REQUIRED !== undefined) {
      config.security.authentication.mfa.required = env.MFA_REQUIRED;
    }
    if (env.MFA_METHODS) {
      try {
        const methods = JSON.parse(env.MFA_METHODS) as string[];
        config.security.authentication.mfa.methods = methods.map(m => 
          m.toLowerCase() as any
        ).filter(m => 
          ['totp', 'sms', 'email', 'hardware'].includes(m)
        );
      } catch (e) {
        console.warn('Invalid MFA_METHODS environment variable:', env.MFA_METHODS);
      }
    }

    // Encryption settings
    if (env.ENCRYPTION_AT_REST !== undefined) {
      config.security.encryption.atRest = env.ENCRYPTION_AT_REST;
    }
    if (env.ENCRYPTION_IN_TRANSIT !== undefined) {
      config.security.encryption.inTransit = env.ENCRYPTION_IN_TRANSIT;
    }
    if (env.ENCRYPTION_KEY_ROTATION_DAYS) {
      config.security.encryption.keyRotationDays = parseInt(env.ENCRYPTION_KEY_ROTATION_DAYS, 10);
    }
    if (env.ENCRYPTION_ALGORITHM) {
      config.security.encryption.algorithm = env.ENCRYPTION_ALGORITHM as any;
    }

    // Compliance settings
    if (env.COMPLIANCE_GDPR_ENABLED !== undefined) {
      config.compliance.gdpr.enabled = env.COMPLIANCE_GDPR_ENABLED;
    }
    if (env.COMPLIANCE_HIPAA_ENABLED !== undefined) {
      config.compliance.hipaa.enabled = env.COMPLIANCE_HIPAA_ENABLED;
    }
    if (env.COMPLIANCE_SOX_ENABLED !== undefined) {
      config.compliance.sox.enabled = env.COMPLIANCE_SOX_ENABLED;
    }
    if (env.COMPLIANCE_PCI_ENABLED !== undefined) {
      config.compliance.pci.enabled = env.COMPLIANCE_PCI_ENABLED;
    }

    // Performance settings
    if (env.PERFORMANCE_MONITORING_ENABLED !== undefined) {
      config.performance.monitoring.enabled = env.PERFORMANCE_MONITORING_ENABLED;
    }
    if (env.PERFORMANCE_TRACING_ENABLED !== undefined) {
      config.performance.monitoring.tracing.enabled = env.PERFORMANCE_TRACING_ENABLED;
    }
    if (env.PERFORMANCE_CACHING_ENABLED !== undefined) {
      config.performance.caching.enabled = env.PERFORMANCE_CACHING_ENABLED;
    }

    // Integration settings
    if (env.ANALYTICS_ENABLED !== undefined) {
      config.integrations.analytics.enabled = env.ANALYTICS_ENABLED;
    }
    if (env.ANALYTICS_PROVIDER) {
      config.integrations.analytics.provider = env.ANALYTICS_PROVIDER as any;
    }
    if (env.ANALYTICS_TRACKING_ID) {
      config.integrations.analytics.trackingId = env.ANALYTICS_TRACKING_ID;
    }

    // Operational settings
    if (env.MAINTENANCE_MODE !== undefined) {
      config.operations.maintenance.enabled = env.MAINTENANCE_MODE;
    }
    if (env.BACKUP_ENABLED !== undefined) {
      config.operations.backup.enabled = env.BACKUP_ENABLED;
    }

    return config;
  }

  /**
   * Update the enterprise configuration
   */
  public async updateEnterpriseConfig(config: Partial<EnterpriseConfig>): Promise<EnterpriseConfig> {
    // Validate the config
    const validation = enterpriseConfigSchema.safeParse(config);
    if (!validation.success) {
      throw new Error(`Invalid enterprise configuration: ${validation.error.message}`);
    }

    // Merge with existing config
    const updatedConfig = this.mergeConfig(this.config || DEFAULT_ENTERPRISE_CONFIG, validation.data);

    // Store the updated config (in a real implementation, this would save to a database)
    this.config = updatedConfig;
    this.lastFetch = new Date();

    return updatedConfig;
  }

  /**
   * Merge two configuration objects
   */
  private mergeConfig(base: EnterpriseConfig, updates: Partial<EnterpriseConfig>): EnterpriseConfig {
    // Deep merge the configurations
    const merged: EnterpriseConfig = JSON.parse(JSON.stringify(base));
    
    // Update top-level properties
    if (updates.features) {
      Object.assign(merged.features, updates.features);
    }
    
    if (updates.security) {
      if (updates.security.authentication) {
        if (updates.security.authentication.sso) {
          Object.assign(merged.security.authentication.sso, updates.security.authentication.sso);
        }
        if (updates.security.authentication.mfa) {
          Object.assign(merged.security.authentication.mfa, updates.security.authentication.mfa);
        }
      }
      
      if (updates.security.encryption) {
        Object.assign(merged.security.encryption, updates.security.encryption);
      }
      
      if (updates.security.network) {
        Object.assign(merged.security.network, updates.security.network);
      }
    }
    
    if (updates.compliance) {
      Object.assign(merged.compliance, updates.compliance);
    }
    
    if (updates.performance) {
      Object.assign(merged.performance, updates.performance);
    }
    
    if (updates.integrations) {
      Object.assign(merged.integrations, updates.integrations);
    }
    
    if (updates.operations) {
      Object.assign(merged.operations, updates.operations);
    }

    return merged;
  }

  /**
   * Get a specific configuration value by path
   */
  public async getConfigValue<T>(path: string): Promise<T | undefined> {
    const config = await this.getEnterpriseConfig();
    
    // Navigate the object using the path
    const pathParts = path.split('.');
    let value: any = config;
    
    for (const part of pathParts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }
    
    return value as T;
  }

  /**
   * Check if a feature is enabled
   */
  public async isFeatureEnabled(feature: keyof EnterpriseConfig['features']): Promise<boolean> {
    const config = await this.getEnterpriseConfig();
    return config.features[feature] ?? false;
  }

  /**
   * Validate the entire configuration
   */
  public validateConfig(config: EnterpriseConfig): { valid: boolean; errors?: string[] } {
    const result = enterpriseConfigSchema.safeParse(config);
    
    if (result.success) {
      return { valid: true };
    } else {
      const errors = result.error.errors.map(e => e.message);
      return { valid: false, errors };
    }
  }

  /**
   * Get configuration summary for monitoring/logging
   */
  public async getConfigSummary(): Promise<Record<string, any>> {
    const config = await this.getEnterpriseConfig();
    
    return {
      features: Object.entries(config.features).reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, boolean>),
      security_enabled: Object.values(config.security).some(
        section => typeof section === 'object' && 
        Object.values(section).some(val => 
          typeof val === 'boolean' && val
        )
      ),
      compliance_enabled: Object.values(config.compliance)
        .filter(item => typeof item === 'object' && 'enabled' in item)
        .some(item => (item as any).enabled),
      performance_enabled: config.performance.monitoring.enabled || config.performance.caching.enabled,
      lastUpdated: this.lastFetch?.toISOString(),
    };
  }

  /**
   * Invalidate the configuration cache
   */
  public invalidateCache(): void {
    this.config = null;
    this.lastFetch = null;
  }

  /**
   * Health check for configuration system
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const config = await this.getEnterpriseConfig();
      const validation = this.validateConfig(config);
      
      const details: Record<string, any> = {
        configuration: validation.valid ? 'healthy' : 'unhealthy',
        lastFetch: this.lastFetch?.toISOString(),
        cache: this.config ? 'valid' : 'invalid',
      };

      if (!validation.valid && validation.errors) {
        details.errors = validation.errors;
      }

      const status: 'healthy' | 'degraded' | 'unhealthy' = validation.valid ? 'healthy' : 'unhealthy';

      return { status, details };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          configuration: 'unhealthy',
          error: error.message,
        },
      };
    }
  }
}

// Export singleton instance
export const enterpriseConfigManager = EnterpriseConfigurationManager.getInstance();

// Helper function to check if enterprise features are enabled
export async function isEnterpriseFeatureEnabled(feature: keyof EnterpriseConfig['features']): Promise<boolean> {
  return enterpriseConfigManager.isFeatureEnabled(feature);
}

// Type guard to check if a configuration is an enterprise configuration
export function isEnterpriseConfig(config: any): config is EnterpriseConfig {
  return enterpriseConfigSchema.safeParse(config).success;
}