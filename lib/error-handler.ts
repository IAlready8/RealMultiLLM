import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "./logger";
import { captureError, type ErrorContext, type SentryError } from "./sentry-utils";

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  path?: string;
}

export enum ErrorCodes {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR", 
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  LLM_API_ERROR = "LLM_API_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

export function createApiError(
  code: ErrorCodes, 
  message: string, 
  details?: any,
  path?: string
): ApiError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    path
  };
}

export function handleApiError(
  error: unknown, 
  path?: string,
  userId?: string,
  provider?: string
): Response {
  let apiError: ApiError;
  let statusCode = 500;

  // Log the error for debugging
  logger.error("API Error occurred", { error, path, userId, provider });

  // Prepare Sentry context
  const sentryContext: ErrorContext = {
    userId,
    endpoint: path,
    provider
  };

  if (error instanceof ZodError) {
    // Validation errors
    apiError = createApiError(
      ErrorCodes.VALIDATION_ERROR,
      "Request validation failed",
      {
        issues: error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }))
      },
      path
    );
    statusCode = 400;
    
    // Capture validation errors to Sentry with lower severity
    const sentryError: SentryError = error;
    sentryError.code = ErrorCodes.VALIDATION_ERROR;
    sentryError.statusCode = statusCode;
    captureError(sentryError, sentryContext);

  } else if (error instanceof Error) {
    // Categorize known error types
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      apiError = createApiError(
        ErrorCodes.AUTHENTICATION_ERROR,
        "Authentication required",
        { originalMessage: error.message },
        path
      );
      statusCode = 401;

    } else if (error.message.includes('forbidden') || error.message.includes('403')) {
      apiError = createApiError(
        ErrorCodes.AUTHORIZATION_ERROR,
        "Insufficient permissions",
        { originalMessage: error.message },
        path
      );
      statusCode = 403;

    } else if (error.message.includes('not found') || error.message.includes('404')) {
      apiError = createApiError(
        ErrorCodes.NOT_FOUND,
        "Resource not found",
        { originalMessage: error.message },
        path
      );
      statusCode = 404;

    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      apiError = createApiError(
        ErrorCodes.RATE_LIMIT_ERROR,
        "Rate limit exceeded",
        { originalMessage: error.message },
        path
      );
      statusCode = 429;

    } else if (error.message.includes('API') || error.message.includes('LLM')) {
      apiError = createApiError(
        ErrorCodes.LLM_API_ERROR,
        "External API service error",
        { originalMessage: error.message },
        path
      );
      statusCode = 502;

    } else if (error.message.includes('database') || error.message.includes('prisma')) {
      apiError = createApiError(
        ErrorCodes.DATABASE_ERROR,
        "Database operation failed",
        { originalMessage: error.message },
        path
      );
      statusCode = 500;

    } else {
      apiError = createApiError(
        ErrorCodes.INTERNAL_ERROR,
        error.message || "Internal server error",
        { originalMessage: error.message },
        path
      );
      statusCode = 500;
    }

    // Capture known errors to Sentry
    const sentryError: SentryError = error;
    sentryError.statusCode = statusCode;
    captureError(sentryError, sentryContext);

  } else {
    // Unknown error type
    apiError = createApiError(
      ErrorCodes.UNKNOWN_ERROR,
      "An unknown error occurred",
      { error: String(error) },
      path
    );
    statusCode = 500;

    // Capture unknown errors to Sentry
    const sentryError = new Error(`Unknown error: ${String(error)}`) as SentryError;
    sentryError.code = ErrorCodes.UNKNOWN_ERROR;
    sentryError.statusCode = statusCode;
    captureError(sentryError, sentryContext);
  }

  return NextResponse.json(apiError, { status: statusCode });
}

/**
 * Safe error handler that never throws - for use in catch blocks
 */
export function safeHandleApiError(
  error: unknown, 
  path?: string,
  userId?: string,
  provider?: string
): Response {
  try {
    return handleApiError(error, path, userId, provider);
  } catch (handlerError) {
    logger.error("Error in error handler", { handlerError, originalError: error });
    
    // Ultimate fallback
    return NextResponse.json(
      createApiError(
        ErrorCodes.INTERNAL_ERROR,
        "Critical error in error handling",
        undefined,
        path
      ),
      { status: 500 }
    );
  }
}

/**
 * Utility to check if an error is a specific type
 */
export function isErrorOfType(error: ApiError, code: ErrorCodes): boolean {
  return error.code === code;
}

/**
 * Create user-friendly error messages
 */
export function getUserFriendlyMessage(error: ApiError): string {
  switch (error.code) {
    case ErrorCodes.VALIDATION_ERROR:
      return "Please check your input and try again.";
    case ErrorCodes.AUTHENTICATION_ERROR:
      return "Please sign in to continue.";
    case ErrorCodes.AUTHORIZATION_ERROR:
      return "You don't have permission to perform this action.";
    case ErrorCodes.NOT_FOUND:
      return "The requested resource could not be found.";
    case ErrorCodes.RATE_LIMIT_ERROR:
      return "Too many requests. Please try again in a few minutes.";
    case ErrorCodes.LLM_API_ERROR:
      return "AI service is temporarily unavailable. Please try again.";
    case ErrorCodes.DATABASE_ERROR:
      return "A database error occurred. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}