import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  error,
  success,
  hint,
  required,
  children,
  className,
}: FormFieldProps) {
  const hasError = !!error;
  const hasSuccess = !!success;

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-gray-200">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      
      <div className="relative">
        {children}
        
        {hasError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
        )}
        
        {hasSuccess && !hasError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>
        )}
      </div>
      
      {hint && !error && !success && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      
      {success && !error && (
        <p className="text-xs text-green-400 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {success}
        </p>
      )}
    </div>
  );
}

// Input with validation states
interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  success?: boolean;
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ className, error, success, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border bg-gray-900 px-3 py-2 text-sm',
          'ring-offset-gray-950 file:border-0 file:bg-transparent',
          'file:text-sm file:font-medium placeholder:text-gray-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-700 focus-visible:ring-red-500 pr-10',
          success && !error && 'border-green-700 focus-visible:ring-green-500 pr-10',
          !error && !success && 'border-gray-700 focus-visible:ring-purple-500',
          className
        )}
        {...props}
      />
    );
  }
);
ValidatedInput.displayName = 'ValidatedInput';

// Textarea with validation states
interface ValidatedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  success?: boolean;
}

export const ValidatedTextarea = React.forwardRef<HTMLTextAreaElement, ValidatedTextareaProps>(
  ({ className, error, success, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border bg-gray-900 px-3 py-2 text-sm',
          'ring-offset-gray-950 placeholder:text-gray-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-700 focus-visible:ring-red-500',
          success && !error && 'border-green-700 focus-visible:ring-green-500',
          !error && !success && 'border-gray-700 focus-visible:ring-purple-500',
          className
        )}
        {...props}
      />
    );
  }
);
ValidatedTextarea.displayName = 'ValidatedTextarea';

// Password strength indicator
interface PasswordStrengthProps {
  password: string;
  showStrength?: boolean;
}

export function PasswordStrength({ password, showStrength = true }: PasswordStrengthProps) {
  const getStrength = (pwd: string): { level: number; label: string; color: string } => {
    let level = 0;
    
    if (pwd.length >= 8) level++;
    if (pwd.length >= 12) level++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) level++;
    if (/\d/.test(pwd)) level++;
    if (/[^a-zA-Z0-9]/.test(pwd)) level++;
    
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
    
    return {
      level,
      label: labels[level] || labels[0],
      color: colors[level] || colors[0],
    };
  };

  if (!showStrength || !password) return null;

  const strength = getStrength(password);
  const percentage = (strength.level / 5) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Password strength</span>
        <span className={cn(
          'font-medium',
          strength.level <= 1 && 'text-red-400',
          strength.level === 2 && 'text-yellow-400',
          strength.level === 3 && 'text-blue-400',
          strength.level >= 4 && 'text-green-400'
        )}>
          {strength.label}
        </span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', strength.color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <ul className="text-xs text-gray-500 space-y-1">
        <li className={password.length >= 8 ? 'text-green-400' : ''}>
          ✓ At least 8 characters
        </li>
        <li className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? 'text-green-400' : ''}>
          ✓ Upper and lowercase letters
        </li>
        <li className={/\d/.test(password) ? 'text-green-400' : ''}>
          ✓ At least one number
        </li>
        <li className={/[^a-zA-Z0-9]/.test(password) ? 'text-green-400' : ''}>
          ✓ At least one special character
        </li>
      </ul>
    </div>
  );
}

// Character count indicator
interface CharCountProps {
  current: number;
  max: number;
  className?: string;
}

export function CharCount({ current, max, className }: CharCountProps) {
  const percentage = (current / max) * 100;
  const isWarning = percentage > 80;
  const isError = percentage > 100;

  return (
    <div className={cn('text-xs text-right', className)}>
      <span
        className={cn(
          isError && 'text-red-400',
          isWarning && !isError && 'text-yellow-400',
          !isWarning && 'text-gray-500'
        )}
      >
        {current} / {max}
      </span>
    </div>
  );
}
