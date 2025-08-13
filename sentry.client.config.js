import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Set tracesSampleRate to 1.0 to capture 100%
  // of the transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable error and performance monitoring
  debug: process.env.NODE_ENV === "development",

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",

  // Integration configurations
  integrations: [
    // Enable session replay for better debugging
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    // Browser-specific integrations
    Sentry.browserTracingIntegration(),
  ],

  // Session replay configuration
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,

  // Filter out errors we don't care about
  beforeSend(event, hint) {
    // Filter out network errors for local development
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.type === "ChunkLoadError" || error?.value?.includes("Loading chunk")) {
        return null;
      }
    }
    
    // Filter out cancelled requests
    if (event.exception?.values?.[0]?.value?.includes("AbortError")) {
      return null;
    }
    
    return event;
  },

  // Add user context when available
  beforeSendTransaction(event) {
    // Add custom tags for better filtering
    event.tags = {
      ...event.tags,
      component: "client",
    };
    return event;
  },
});