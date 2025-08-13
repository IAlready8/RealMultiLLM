const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

type Level = "info" | "error" | "warn" | "debug";

function shouldLog(level: Level): boolean {
  // In test environment, only log errors
  if (isTest) {
    return level === "error";
  }
  
  // In development, log everything
  if (isDev) {
    return true;
  }
  
  // In production, only log warnings and errors
  return level === "warn" || level === "error";
}

function log(level: Level, ctx: Record<string, unknown>, message: string) {
  if (!shouldLog(level)) return;
  
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...ctx,
  };
  
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](JSON.stringify(entry));
}

export function createRequestLogger(route: string, requestId: string) {
  const base = { route, requestId };
  return {
    info(ctx: Record<string, unknown>, msg: string) {
      log("info", { ...base, ...ctx }, msg);
    },
    error(ctx: Record<string, unknown>, msg: string) {
      log("error", { ...base, ...ctx }, msg);
    },
    warn(ctx: Record<string, unknown>, msg: string) {
      log("warn", { ...base, ...ctx }, msg);
    },
    debug(ctx: Record<string, unknown>, msg: string) {
      log("debug", { ...base, ...ctx }, msg);
    },
  };
}

// Simple logger for general use
export const logger = {
  info: (message: string, data?: any) => {
    if (shouldLog("info")) {
      console.log(isDev ? message : JSON.stringify({ level: "info", message, data, ts: new Date().toISOString() }), data || '');
    }
  },
  error: (message: string, error?: any) => {
    // Always log errors
    console.error(isDev ? message : JSON.stringify({ level: "error", message, error: error?.message || error, ts: new Date().toISOString() }), error || '');
  },
  warn: (message: string, data?: any) => {
    if (shouldLog("warn")) {
      console.warn(isDev ? message : JSON.stringify({ level: "warn", message, data, ts: new Date().toISOString() }), data || '');
    }
  },
  debug: (message: string, data?: any) => {
    if (shouldLog("debug")) {
      console.debug(isDev ? message : JSON.stringify({ level: "debug", message, data, ts: new Date().toISOString() }), data || '');
    }
  }
};


