import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  successLabel?: string;
}

export function CopyButton({
  text,
  className,
  variant = 'ghost',
  size = 'sm',
  label,
  successLabel = 'Copied!',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn(
        'transition-all duration-200',
        copied && 'text-green-500',
        className
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1" />
          {label && successLabel}
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-1" />
          {label}
        </>
      )}
    </Button>
  );
}

// Specialized version for API keys (shows masked text)
interface CopyApiKeyButtonProps {
  apiKey: string;
  maskedKey?: string;
  className?: string;
}

export function CopyApiKeyButton({
  apiKey,
  maskedKey = '••••••••',
  className,
}: CopyApiKeyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={cn('flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 border border-gray-700', className)}>
      <code className="flex-1 text-sm font-mono px-2 py-1 bg-gray-900 rounded">
        {showFull ? apiKey : maskedKey}
      </code>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowFull(!showFull)}
        className="h-8 w-8 p-0"
      >
        {showFull ? '🙈' : '👁️'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className={cn(
          'h-8 w-8 p-0 transition-all duration-200',
          copied && 'text-green-500'
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// Inline copy button for code snippets
interface CopyCodeButtonProps {
  code: string;
  className?: string;
}

export function CopyCodeButton({ code, className }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'absolute top-2 right-2 p-2 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all duration-200',
        copied && 'bg-green-900/50 border-green-700',
        className
      )}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-400" />
      ) : (
        <Copy className="h-4 w-4 text-gray-400" />
      )}
    </button>
  );
}
