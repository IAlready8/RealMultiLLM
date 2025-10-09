import { z } from 'zod';
import type { SystemConfig } from '../config-manager';
import { getValidatedEnv, type Env } from '../env';
import { Metric } from '../observability/metrics';
import { Logger } from '../observability/logger';
import { monitoring } from '../monitoring';

// Define configuration schema using Zod for validation
const ConfigSchema = z.object({
  // Application settings
  appName: z.string().default('Multi-LLM Platform'),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.number().min(1).max(65535).default(3000),
  host: z.string().default('localhost'),
  
  // Database settings
  databaseUrl: z.string().url().optional(),
  databasePoolSize: z.number().min(1).max(50).default(10),
  databaseTimeout: z.number().min(1000).max(30000).default(5000),
  
  // Authentication settings
  jwtSecret: z.string().min(32),
  jwtExpiration: z.string().default('24h'),
  sessionTimeout: z.number().min(300).max(86400).default(3600), // 1 hour default
  
  // Rate limiting
  rateLimitWindow: z.number().min(60).max(3600).default(60), // 1 minute window
  rateLimitMax: z.number().min(1).max(10000).default(100), // 100 requests per window
  
  // External API settings
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
  groqApiKey: z.string().optional(),
  githubToken: z.string().optional(),
  
  // Feature flags
  enableAnalytics: z.boolean().default(true),
  enableTelemetry: z.boolean().default(false),
  enableAuditLogging: z.boolean().default(false),
  enablePerformanceMonitoring: z.boolean().default(true),
  
  // Security settings
  corsOrigin: z.union([z.string(), z.array(z.string())]).default('*'),
  allowedOrigins: z.array(z.string()).default(['*']),
  helmetEnabled: z.boolean().default(true),
  hstsEnabled: z.boolean().default(true),
  csrfEnabled: z.boolean().default(true),
  
  // Observability settings
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFormat: z.enum(['json', 'text']).default('json'),
  metricsEnabled: z.boolean().default(true),
  tracingEnabled: z.boolean().default(false),
  
  // Performance settings
  cacheEnabled: z.boolean().default(true),
  cacheTtl: z.number().min(60).max(86400).default(3600), // 1 hour default
  cacheMaxSize: z.number().min(1).max(1000000).default(10000),
  
  // File upload settings
  maxFileSize: z.number().min(1024).max(104857600).default(10485760), // 10MB default
  allowedFileTypes: z.array(z.string()).default(['text/*', 'application/json', 'image/*']),
  
  // Email settings
  emailProvider: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp').optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  
  // Monitoring settings
  sentryDsn: z.string().url().optional(),
  datadogApiKey: z.string().optional(),
  prometheusEnabled: z.boolean().default(false),
  
  // Feature-specific settings
  maxConcurrentChats: z.number().min(1).max(1000).default(100),
  maxMessageLength: z.number().min(100).max(100000).default(4000),
  maxTokensPerRequest: z.number().min(100).max(100000).default(4000),
  
  // Queue settings
  queueConcurrency: z.number().min(1).max(50).default(5),
  queueMaxRetries: z.number().min(1).max(10).default(3),
  
  // API Gateway settings
  apiGatewayTimeout: z.number().min(1000).max(30000).default(10000),
  apiGatewayRetryCount: z.number().min(1).max(5).default(3),
  
  // Third-party integrations
  stripeApiKey: z.string().optional(),
  openaiOrganization: z.string().optional(),
  anthropicVersion: z.string().default('2023-06-01'),
});

// Type inference from Zod schema
export type Config = z.infer<typeof ConfigSchema>;

// Default configuration values
const defaultConfig: Partial<Config> = {
  appName: process.env.APP_NAME || 'Multi-LLM Platform',
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production',
  logLevel: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
};

/**
 * Configuration Manager Class
 * Provides a centralized way to manage application configuration
 * with validation, environment variable support, and runtime updates
 */
class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private logger: Logger;
  private listeners: Array<(config: Config) => void> = [];

  private constructor() {
    this.logger = new Logger({ service: 'config-manager', level: 'info' });
    this.config = this.loadConfiguration();
    this.logConfigStatus();
  }

  /**
   * Singleton pattern to ensure single config instance
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from environment variables and validate
   */
  private loadConfiguration(): Config {
    try {
      // Collect environment variables for config
      const envConfig: Partial<Config> = {
        // Application settings
        appName: process.env.APP_NAME,
        environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
        host: process.env.HOST,
        
        // Database settings
        databaseUrl: process.env.DATABASE_URL,
        databasePoolSize: process.env.DATABASE_POOL_SIZE ? parseInt(process.env.DATABASE_POOL_SIZE, 10) : undefined,
        databaseTimeout: process.env.DATABASE_TIMEOUT ? parseInt(process.env.DATABASE_TIMEOUT, 10) : undefined,
        
        // Authentication settings
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiration: process.env.JWT_EXPIRATION,
        sessionTimeout: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT, 10) : undefined,
        
        // Rate limiting
        rateLimitWindow: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW, 10) : undefined,
        rateLimitMax: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : undefined,
        
        // External API settings
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        googleApiKey: process.env.GOOGLE_API_KEY,
        groqApiKey: process.env.GROQ_API_KEY,
        githubToken: process.env.GITHUB_TOKEN,
        
        // Feature flags
        enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
        enableTelemetry: process.env.ENABLE_TELEMETRY === 'true',
        enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING === 'true',
        enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
        
        // Security settings
        corsOrigin: process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS,
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || undefined,
        helmetEnabled: process.env.HELMET_ENABLED !== 'false',
        hstsEnabled: process.env.HSTS_ENABLED !== 'false',
        csrfEnabled: process.env.CSRF_ENABLED !== 'false',
        
        // Observability settings
        logLevel: process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug',
        logFormat: process.env.LOG_FORMAT as 'json' | 'text',
        metricsEnabled: process.env.METRICS_ENABLED !== 'false',
        tracingEnabled: process.env.TRACING_ENABLED === 'true',
        
        // Performance settings
        cacheEnabled: process.env.CACHE_ENABLED !== 'false',
        cacheTtl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL, 10) : undefined,
        cacheMaxSize: process.env.CACHE_MAX_SIZE ? parseInt(process.env.CACHE_MAX_SIZE, 10) : undefined,
        
        // File upload settings
        maxFileSize: process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE, 10) : undefined,
        allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',').map(s => s.trim()) || undefined,
        
        // Email settings
        emailProvider: process.env.EMAIL_PROVIDER as 'smtp' | 'sendgrid' | 'ses',
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
        smtpUser: process.env.SMTP_USER,
        smtpPassword: process.env.SMTP_PASSWORD,
        
        // Monitoring settings
        sentryDsn: process.env.SENTRY_DSN,
        datadogApiKey: process.env.DATADOG_API_KEY,
        prometheusEnabled: process.env.PROMETHEUS_ENABLED === 'true',
        
        // Feature-specific settings
        maxConcurrentChats: process.env.MAX_CONCURRENT_CHATS ? parseInt(process.env.MAX_CONCURRENT_CHATS, 10) : undefined,
        maxMessageLength: process.env.MAX_MESSAGE_LENGTH ? parseInt(process.env.MAX_MESSAGE_LENGTH, 10) : undefined,
        maxTokensPerRequest: process.env.MAX_TOKENS_PER_REQUEST ? parseInt(process.env.MAX_TOKENS_PER_REQUEST, 10) : undefined,
        
        // Queue settings
        queueConcurrency: process.env.QUEUE_CONCURRENCY ? parseInt(process.env.QUEUE_CONCURRENCY, 10) : undefined,
        queueMaxRetries: process.env.QUEUE_MAX_RETRIES ? parseInt(process.env.QUEUE_MAX_RETRIES, 10) : undefined,
        
        // API Gateway settings
        apiGatewayTimeout: process.env.API_GATEWAY_TIMEOUT ? parseInt(process.env.API_GATEWAY_TIMEOUT, 10) : undefined,
        apiGatewayRetryCount: process.env.API_GATEWAY_RETRY_COUNT ? parseInt(process.env.API_GATEWAY_RETRY_COUNT, 10) : undefined,
        
        // Third-party integrations
        stripeApiKey: process.env.STRIPE_API_KEY,
        openaiOrganization: process.env.OPENAI_ORGANIZATION,
        anthropicVersion: process.env.ANTHROPIC_VERSION,
      };

      // Merge with defaults
      const mergedConfig = { ...defaultConfig, ...envConfig };
      
      // Validate configuration
      const validatedConfig = ConfigSchema.safeParse(mergedConfig);
      
      if (!validatedConfig.success) {
        // Log validation errors
        const errors = validatedConfig.error.issues.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        this.logger.error('Configuration validation failed', { errors });
        
        // If we're in production, we must fail on validation errors
        if (mergedConfig.environment === 'production') {
          throw new Error(`Configuration validation failed: ${errors}`);
        }
        
        // For non-production environments, we can proceed with defaults
        this.logger.warn('Using default configuration values due to validation errors');
        return ConfigSchema.parse(defaultConfig);
      }
      
      return validatedConfig.data;
    } catch (error) {
      this.logger.error('Failed to load configuration', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get the current configuration
   */
  public getConfig(): Config {
    return this.config;
  }

  /**
   * Get a specific configuration value
   */
  public get<T extends keyof Config>(key: T): Config[T] {
    return this.config[key];
  }

  /**
   * Update configuration at runtime
   * Note: This should be used carefully in production
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      // Validate updates
      const updatedConfig = { ...this.config, ...updates };
      const validatedConfig = ConfigSchema.safeParse(updatedConfig);
      
      if (!validatedConfig.success) {
        const errors = validatedConfig.error.issues.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        this.logger.error('Configuration update validation failed', { errors });
        throw new Error(`Configuration update validation failed: ${errors}`);
      }
      
      this.config = validatedConfig.data;
      this.logger.info('Configuration updated successfully');
      
      // Notify listeners
      this.notifyListeners(this.config);
      
      // Record metrics
      monitoring.recordMetric('config_update_count', 1, { action: 'update' }, 'count');
      
      return this.config;
    } catch (error) {
      this.logger.error('Failed to update configuration', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Add listener for configuration changes
   */
  public onConfigChange(listener: (config: Config) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(config: Config): void {
    for (const listener of this.listeners) {
      try {
        listener(config);
      } catch (error) {
        this.logger.error('Error in config change listener', { error: (error as Error).message });
      }
    }
  }

  /**
   * Log configuration status for debugging
   */
  private logConfigStatus(): void {
    this.logger.info('Configuration loaded', {
      environment: this.config.environment,
      appName: this.config.appName,
      port: this.config.port,
      databaseConfigured: !!this.config.databaseUrl,
      features: {
        analytics: this.config.enableAnalytics,
        telemetry: this.config.enableTelemetry,
        auditLogging: this.config.enableAuditLogging,
        performanceMonitoring: this.config.enablePerformanceMonitoring
      }
    });
  }

  /**
   * Get sensitive configuration keys that should be masked
   */
  public getSensitiveKeys(): string[] {
    return [
      'jwtSecret',
      'openaiApiKey',
      'anthropicApiKey',
      'googleApiKey',
      'groqApiKey',
      'githubToken',
      'smtpPassword',
      'stripeApiKey',
      'sentryDsn',
      'datadogApiKey'
    ];
  }

  /**
   * Get a safe representation of the config with sensitive keys masked
   */
  public getSafeConfig(): Record<string, any> {
    const safeConfig: Record<string, any> = {};
    const sensitiveKeys = new Set(this.getSensitiveKeys());
    
    for (const [key, value] of Object.entries(this.config)) {
      if (sensitiveKeys.has(key)) {
        safeConfig[key] = value ? '[REDACTED]' : value;
      } else {
        safeConfig[key] = value;
      }
    }
    
    return safeConfig;
  }
}

// Create singleton instance
const configManager = ConfigManager.getInstance();

// Export the singleton instance and type
export { configManager, ConfigManager };

// Export convenience functions
export const getConfig = (): Config => configManager.getConfig();
export const getEnv = <T extends keyof Config>(key: T): Config[T] => configManager.get(key);

// Initialize metrics for config module
if (getConfig().metricsEnabled) {
  monitoring.recordMetric('app_start_count', 1, { module: 'config', action: 'start' }, 'count');
}