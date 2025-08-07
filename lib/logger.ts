// NEW FILE: lib/logger.ts
// Simple structured logger with request-id support

type Level = "info" | "error" | "warn" | "debug";

function log(level: Level, ctx: Record<string, unknown>, message: string) {
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


