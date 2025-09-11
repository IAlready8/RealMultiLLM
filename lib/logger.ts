// A simple, centralized, structured logger.

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

function log(level: LogLevel, message: string, metadata?: Record<string, any>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };

  // In a real production environment, this would send the entry to a logging service
  // (e.g., Sentry, Datadog, Logtail, etc.).
  // For now, we log to the console in a structured JSON format.
  const logOutput = JSON.stringify(entry, null, 2);

  switch (level) {
    case 'INFO':
      console.log(logOutput);
      break;
    case 'WARN':
      console.warn(logOutput);
      break;
    case 'ERROR':
      console.error(logOutput);
      break;
  }
}

const logger = {
  info: (message: string, metadata?: Record<string, any>) => {
    log('INFO', message, metadata);
  },
  warn: (message: string, metadata?: Record<string, any>) => {
    log('WARN', message, metadata);
  },
  error: (message: string, metadata?: Record<string, any>) => {
    log('ERROR', message, metadata);
  },
};

export default logger;