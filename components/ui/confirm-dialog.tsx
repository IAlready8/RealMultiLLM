import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  variant?: 'default' | 'destructive';
  requiresTypedConfirmation?: string; // e.g., "DELETE" or resource name
  children?: React.ReactNode;
}

export function ConfirmDialog({
  title,
  description,
  confirmText = 'Continue',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  requiresTypedConfirmation,
  children,
}: ConfirmDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [typedText, setTypedText] = useState('');

  const handleConfirm = async () => {
    if (requiresTypedConfirmation && typedText !== requiresTypedConfirmation) {
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm();
      setIsOpen(false);
      setTypedText('');
    } catch (error) {
      console.error('Confirmation action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setTypedText('');
    onCancel?.();
  };

  const isConfirmDisabled =
    isLoading || (requiresTypedConfirmation && typedText !== requiresTypedConfirmation);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {variant === 'destructive' && (
              <AlertTriangle className="h-5 w-5 text-red-400" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requiresTypedConfirmation && (
          <div className="space-y-2 py-4">
            <p className="text-sm text-gray-400">
              Type <code className="px-2 py-1 bg-gray-800 rounded text-red-400 font-mono text-xs">{requiresTypedConfirmation}</code> to confirm:
            </p>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
              placeholder={`Type "${requiresTypedConfirmation}" to confirm`}
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            variant={variant === 'destructive' ? 'destructive' : 'default'}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Quick shortcuts for common confirmation types
export function DeleteConfirmDialog({
  resourceName,
  onConfirm,
  children,
}: {
  resourceName: string;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <ConfirmDialog
      title={`Delete ${resourceName}?`}
      description={`This action cannot be undone. This will permanently delete the ${resourceName.toLowerCase()}.`}
      confirmText="Delete"
      variant="destructive"
      onConfirm={onConfirm}
    >
      {children}
    </ConfirmDialog>
  );
}

export function ClearConfirmDialog({
  onConfirm,
  children,
}: {
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <ConfirmDialog
      title="Clear all data?"
      description="This will remove all items. This action cannot be undone."
      confirmText="Clear All"
      variant="destructive"
      requiresTypedConfirmation="CLEAR"
      onConfirm={onConfirm}
    >
      {children}
    </ConfirmDialog>
  );
}

export function ResetConfirmDialog({
  onConfirm,
  children,
}: {
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <ConfirmDialog
      title="Reset to defaults?"
      description="This will reset all settings to their default values. Your current configuration will be lost."
      confirmText="Reset"
      variant="destructive"
      onConfirm={onConfirm}
    >
      {children}
    </ConfirmDialog>
  );
}

export function SaveConfirmDialog({
  hasUnsavedChanges,
  onConfirm,
  onCancel,
  children,
}: {
  hasUnsavedChanges: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  children?: React.ReactNode;
}) {
  if (!hasUnsavedChanges) {
    return <>{children}</>;
  }

  return (
    <ConfirmDialog
      title="Unsaved changes"
      description="You have unsaved changes. Do you want to save them before leaving?"
      confirmText="Save and Continue"
      cancelText="Discard Changes"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {children}
    </ConfirmDialog>
  );
}
