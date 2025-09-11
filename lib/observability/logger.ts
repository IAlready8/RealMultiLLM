// Browser-compatible logger for observability

// Logger levels
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  traceId?: string;
  spanId?: string;
  parentId?: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metrics?: Record<string, number>;
  tags?: string[];
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  service: string;
  enableMetrics: boolean;
  enableTracing: boolean;
  prettyPrint: boolean;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  service: process.env.SERVICE_NAME || 'personal-llm-tool',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  enableTracing: process.env.ENABLE_TRACING === 'true',
  prettyPrint: process.env.NODE_ENV === 'development',
};

// Simple UUID generator for browsers
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export class Logger {
  private config: LoggerConfig;
  private levels: Record<LogLevel, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // Generate trace context
  private generateTraceContext(): { traceId: string; spanId: string } {
    const traceId = generateUUID();
    const spanId = generateUUID().substring(0, 16);
    return { traceId, spanId };
  }

  // Check if log level should be processed
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level];
  }

  // Format log entry for output
  private formatLogEntry(entry: LogEntry): string {
    if (this.config.prettyPrint) {
      return this.formatPretty(entry);
    }
    return JSON.stringify(entry);
  }

  // Pretty print format for development
  private formatPretty(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(7);
    const service = `[${entry.service}]`;
    const trace = entry.traceId ? `[${entry.traceId.substring(0, 8)}]` : '';
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const error = entry.error ? `
  Error: ${entry.error.name}: ${entry.error.message}
  Stack: ${entry.error.stack}` : '';
    
    return `${timestamp} ${level} ${service}${trace} ${entry.message}${context}${error}`;
  }

  // Create and log entry
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    // Generate trace context if enabled
    let traceContext: { traceId: string; spanId: string } | undefined;
    if (this.config.enableTracing) {
      traceContext = this.generateTraceContext();
    }

    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      traceId: traceContext?.traceId,
      spanId: traceContext?.spanId,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : undefined,
    };

    // Output log entry
    console.log(this.formatLogEntry(entry));

    // In a real implementation, we would send logs to a backend service
    // For now, we'll just log to the console
  }

  // Log methods
  trace(message: string, context?: Record<string, any>): void {
    this.log('trace', message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    this.log('warn', message, context, error);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log('error', message, context, error);
  }

  fatal(message: string, context?: Record<string, any>, error?: Error): void {
    this.log('fatal', message, context, error);
  }

  // Create a child logger with additional context
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.config);
    // We'll handle context merging at log time in a real implementation
    return childLogger;
  }
}

// Create default logger instance
export const logger = new Logger();

// Export types for convenience
export type { LoggerConfig };
