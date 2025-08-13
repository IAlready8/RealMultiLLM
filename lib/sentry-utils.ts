import * as Sentry from '@sentry/nextjs';

export interface ErrorContext {
  userId?: string;
  endpoint?: string;
  provider?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface SentryError extends Error {
  code?: string;
  statusCode?: number;
  provider?: string;
}

/**
 * Capture an error to Sentry with enhanced context
 */
export function captureError(error: SentryError, context: ErrorContext = {}) {
  Sentry.withScope((scope) => {
    // Set user context
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    // Set tags for better filtering
    if (context.endpoint) {
      scope.setTag('endpoint', context.endpoint);
    }
    if (context.provider) {
      scope.setTag('provider', context.provider);
    }
    if (error.code) {
      scope.setTag('error_code', error.code);
    }
    if (error.statusCode) {
      scope.setTag('status_code', error.statusCode.toString());
    }

    // Set additional context
    scope.setContext('request', {
      endpoint: context.endpoint,
      requestId: context.requestId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });

    // Set error level based on status code
    if (error.statusCode && error.statusCode >= 500) {
      scope.setLevel('error');
    } else if (error.statusCode && error.statusCode >= 400) {
      scope.setLevel('warning');
    } else {
      scope.setLevel('error');
    }

    // Capture the error
    Sentry.captureException(error);
  });
}

/**
 * Capture a performance metric to Sentry
 */
export function capturePerformanceMetric(
  operation: string,
  duration: number,
  context: ErrorContext = {}
) {
  Sentry.withScope((scope) => {
    // Set user context
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    // Set tags
    scope.setTag('operation', operation);
    if (context.provider) {
      scope.setTag('provider', context.provider);
    }
    if (context.endpoint) {
      scope.setTag('endpoint', context.endpoint);
    }

    // Add measurement
    Sentry.addBreadcrumb({
      message: `${operation} completed`,
      level: 'info',
      data: {
        duration: `${duration}ms`,
        operation,
        ...context,
      },
    });
  });
}

/**
 * Start a Sentry span for performance monitoring
 */
export function startPerformanceSpan(name: string, op: string) {
  return Sentry.startSpan({
    name,
    op,
    attributes: {
      component: 'api',
    },
  }, (span) => span);
}

/**
 * Capture API usage metrics
 */
export function captureApiUsage({
  endpoint,
  method,
  statusCode,
  duration,
  userId,
  provider,
}: {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  userId?: string;
  provider?: string;
}) {
  Sentry.withScope((scope) => {
    if (userId) {
      scope.setUser({ id: userId });
    }

    scope.setTag('endpoint', endpoint);
    scope.setTag('method', method);
    scope.setTag('status_code', statusCode.toString());
    if (provider) {
      scope.setTag('provider', provider);
    }

    // Only log slow requests or errors as events
    if (duration > 5000 || statusCode >= 400) {
      Sentry.addBreadcrumb({
        message: `API ${method} ${endpoint}`,
        level: statusCode >= 400 ? 'error' : 'warning',
        data: {
          method,
          endpoint,
          statusCode,
          duration: `${duration}ms`,
          provider,
        },
        category: 'api',
      });
    }
  });
}

/**
 * Enhanced error boundary configuration for React components
 */
export function createErrorBoundaryConfig(
  errorBoundaryOptions?: Parameters<typeof Sentry.withErrorBoundary>[1]
) {
  return {
    fallback: ({ error, resetError }: { error: Error; resetError: () => void }) => {
      // Return a simple fallback component (JSX would go in a React component file)
      return { error: error.message, resetError };
    },
    beforeCapture: (scope: Sentry.Scope, error: Error, errorInfo: any) => {
      scope.setTag('error_boundary', true);
      scope.setContext('error_info', errorInfo);
    },
    ...errorBoundaryOptions,
  };
}

/**
 * Track user events for analytics
 */
export function trackUserEvent(
  eventName: string,
  properties: Record<string, any> = {},
  userId?: string
) {
  Sentry.withScope((scope) => {
    if (userId) {
      scope.setUser({ id: userId });
    }

    Sentry.addBreadcrumb({
      message: eventName,
      level: 'info',
      data: properties,
      category: 'user_action',
    });
  });
}