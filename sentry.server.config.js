import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Enable detailed logging in development
  debug: process.env.NODE_ENV === "development",

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",

  // Server-specific integrations
  integrations: [
    Sentry.nodeIntegrations.httpIntegration(),
    Sentry.nodeIntegrations.consoleIntegration(),
    // Database integrations if needed
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

  // Custom error fingerprinting for better grouping
  beforeSendError(event, hint) {
    if (event.exception) {
      const error = event.exception.values?.[0];
      
      // Group LLM API errors by provider
      if (error?.value?.includes("API")) {
        event.fingerprint = ["llm-api-error", error.type || "unknown"];
      }
      
      // Group database errors
      if (error?.value?.includes("Prisma") || error?.value?.includes("database")) {
        event.fingerprint = ["database-error", error.type || "unknown"];
      }
    }
    
    return event;
  },
});