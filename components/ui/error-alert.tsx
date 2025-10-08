import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AlertType = 'error' | 'warning' | 'info' | 'success';

interface ErrorAlertProps {
  type?: AlertType;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  onDismiss?: () => void;
}

const alertConfig = {
  error: {
    icon: XCircle,
    className: 'border-red-800 bg-red-950/30 text-red-400',
    titleClass: 'text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-yellow-800 bg-yellow-950/30 text-yellow-400',
    titleClass: 'text-yellow-300',
  },
  info: {
    icon: Info,
    className: 'border-blue-800 bg-blue-950/30 text-blue-400',
    titleClass: 'text-blue-300',
  },
  success: {
    icon: CheckCircle,
    className: 'border-green-800 bg-green-950/30 text-green-400',
    titleClass: 'text-green-300',
  },
};

export function ErrorAlert({
  type = 'error',
  title,
  message,
  action,
  className,
  onDismiss,
}: ErrorAlertProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <Alert className={cn(config.className, 'relative', className)}>
      <Icon className="h-4 w-4" />
      {title && <AlertTitle className={config.titleClass}>{title}</AlertTitle>}
      <AlertDescription className="mt-2 text-sm">
        {message}
        {action && (
          <Button
            variant="outline"
            size="sm"
            onClick={action.onClick}
            className="mt-3 ml-0"
          >
            {action.label}
          </Button>
        )}
      </AlertDescription>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Dismiss"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </Alert>
  );
}

// Common error scenarios with helpful messages
export const errorMessages = {
  apiKeyMissing: (provider: string) => ({
    title: 'API Key Required',
    message: `Please configure your ${provider} API key in Settings to use this feature.`,
    action: {
      label: 'Go to Settings',
      onClick: () => (window.location.href = '/settings'),
    },
  }),
  
  networkError: {
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
    action: {
      label: 'Retry',
      onClick: () => window.location.reload(),
    },
  },
  
  rateLimitExceeded: {
    title: 'Rate Limit Exceeded',
    message: 'You have made too many requests. Please wait a moment and try again.',
  },
  
  unauthorized: {
    title: 'Authentication Required',
    message: 'Please sign in to access this feature.',
    action: {
      label: 'Sign In',
      onClick: () => (window.location.href = '/auth/signin'),
    },
  },
  
  serverError: {
    title: 'Server Error',
    message: 'Something went wrong on our end. Our team has been notified and is working on it.',
  },
  
  validationError: (field: string) => ({
    title: 'Validation Error',
    message: `Please check the ${field} field and ensure it contains valid data.`,
  }),
  
  notFound: (resource: string) => ({
    title: 'Not Found',
    message: `The ${resource} you're looking for could not be found. It may have been deleted or moved.`,
    action: {
      label: 'Go Back',
      onClick: () => window.history.back(),
    },
  }),
  
  permissionDenied: {
    title: 'Permission Denied',
    message: 'You do not have permission to perform this action. Contact an administrator if you believe this is an error.',
  },
};

// Hook for managing error state
export function useErrorAlert() {
  const [error, setError] = React.useState<ErrorAlertProps | null>(null);

  const showError = React.useCallback((errorProps: ErrorAlertProps) => {
    setError(errorProps);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const ErrorComponent = React.useMemo(() => {
    if (!error) return null;
    return <ErrorAlert {...error} onDismiss={clearError} />;
  }, [error, clearError]);

  return {
    error,
    showError,
    clearError,
    ErrorComponent,
  };
}

// Utility to convert HTTP status to error message
export function httpStatusToError(status: number, customMessage?: string): ErrorAlertProps {
  switch (status) {
    case 400:
      return {
        type: 'error',
        title: 'Bad Request',
        message: customMessage || 'The request contains invalid data. Please check your input.',
      };
    case 401:
      return {
        type: 'error',
        ...errorMessages.unauthorized,
      };
    case 403:
      return {
        type: 'error',
        ...errorMessages.permissionDenied,
      };
    case 404:
      return {
        type: 'error',
        title: 'Not Found',
        message: customMessage || 'The requested resource could not be found.',
      };
    case 429:
      return {
        type: 'warning',
        ...errorMessages.rateLimitExceeded,
      };
    case 500:
    case 502:
    case 503:
      return {
        type: 'error',
        ...errorMessages.serverError,
      };
    default:
      return {
        type: 'error',
        title: 'Error',
        message: customMessage || 'An unexpected error occurred. Please try again.',
      };
  }
}
