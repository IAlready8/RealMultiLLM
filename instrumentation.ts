import * as Sentry from "@sentry/nextjs";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Sentry configuration
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      debug: process.env.NODE_ENV === "development",
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",

      // Server-specific integrations
      integrations: [
        Sentry.httpIntegration(),
        Sentry.consoleIntegration(),
        Sentry.prismaIntegration(),
      ],

      // Error filtering for server
      beforeSend(event, hint) {
        // Filter out known non-critical errors
        if (event.exception) {
          const error = event.exception.values?.[0];
          
          // Filter database connection timeouts in development
          if (process.env.NODE_ENV === "development" && 
              error?.value?.includes("database connection")) {
            return null;
          }
          
          // Filter rate limit errors (these are expected)
          if (error?.value?.includes("Rate limit exceeded")) {
            return null;
          }
        }
        
        return event;
      },

      // Add server context
      beforeSendTransaction(event) {
        event.tags = {
          ...event.tags,
          component: "server",
        };
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry configuration
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,
      debug: process.env.NODE_ENV === "development",
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",

      // Edge-specific configurations - minimal integrations for Edge Runtime
      integrations: [],

      // Edge runtime has memory constraints
      beforeSend(event, hint) {
        // Only capture errors in production for Edge
        if (process.env.NODE_ENV === "development") {
          return null;
        }
        
        return event;
      },

      beforeSendTransaction(event) {
        event.tags = {
          ...event.tags,
          component: "edge",
        };
        return event;
      },
    });
  }
}