import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Performance monitoring for Edge Runtime
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,
  
  // Enable detailed logging in development
  debug: process.env.NODE_ENV === "development",

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",

  // Edge-specific configurations
  integrations: [
    // Minimal integrations for Edge Runtime
    Sentry.captureConsoleIntegration(),
  ],

  // Edge runtime has memory constraints, so be more aggressive with filtering
  beforeSend(event, hint) {
    // Only capture errors in production for Edge
    if (process.env.NODE_ENV === "development") {
      return null;
    }
    
    return event;
  },

  // Add edge context
  beforeSendTransaction(event) {
    event.tags = {
      ...event.tags,
      component: "edge",
    };
    return event;
  },
});