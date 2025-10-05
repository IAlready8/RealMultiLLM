import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  key: string;
  action: string;
  category?: string;
}

interface KeyboardShortcutsDialogProps {
  shortcuts?: Shortcut[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const defaultShortcuts: Shortcut[] = [
  { key: 'Ctrl/Cmd + K', action: 'Open command palette', category: 'Global' },
  { key: '?', action: 'Show keyboard shortcuts', category: 'Global' },
  { key: 'Esc', action: 'Close dialog', category: 'Global' },
  { key: 'G then H', action: 'Go to Home', category: 'Navigation' },
  { key: 'G then C', action: 'Go to Chat', category: 'Navigation' },
  { key: 'G then P', action: 'Go to Personas', category: 'Navigation' },
  { key: 'G then G', action: 'Go to Goals', category: 'Navigation' },
  { key: 'G then S', action: 'Go to Settings', category: 'Navigation' },
  { key: 'Ctrl/Cmd + Enter', action: 'Send message', category: 'Chat' },
  { key: 'Ctrl/Cmd + S', action: 'Save', category: 'Editing' },
  { key: 'N', action: 'Create new', category: 'Actions' },
  { key: 'E', action: 'Edit selected', category: 'Actions' },
  { key: 'Delete', action: 'Delete selected', category: 'Actions' },
];

export function KeyboardShortcutsDialog({
  shortcuts = defaultShortcuts,
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const [isOpen, setIsOpen] = useState(open || false);

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only trigger if not in an input field
        const target = e.target as HTMLElement;
        if (
          target.tagName !== 'INPUT' &&
          target.tagName !== 'TEXTAREA' &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          setIsOpen(true);
          onOpenChange?.(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onOpenChange]);

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleOpenChange(true)}
        className="gap-2"
      >
        <Keyboard className="h-4 w-4" />
        Shortcuts
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Speed up your workflow with these keyboard shortcuts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-sm text-gray-300">{shortcut.action}</span>
                      <kbd className="px-3 py-1 text-xs font-semibold text-gray-100 bg-gray-700 border border-gray-600 rounded-md shadow-sm">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              Press <kbd className="px-2 py-0.5 text-xs bg-gray-700 rounded">?</kbd> to show
              this dialog anytime
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Specialized component for specific page shortcuts
interface PageShortcutsProps {
  page: 'chat' | 'personas' | 'goals' | 'pipeline' | 'analytics' | 'settings';
}

export function PageShortcuts({ page }: PageShortcutsProps) {
  const pageShortcuts: Record<string, Shortcut[]> = {
    chat: [
      { key: 'Ctrl/Cmd + Enter', action: 'Send message', category: 'Chat' },
      { key: 'Ctrl/Cmd + Shift + C', action: 'Clear conversation', category: 'Chat' },
      { key: 'Ctrl/Cmd + E', action: 'Export conversation', category: 'Chat' },
      { key: 'Ctrl/Cmd + N', action: 'New conversation', category: 'Chat' },
      { key: '↑', action: 'Edit last message', category: 'Chat' },
    ],
    personas: [
      { key: 'N', action: 'Create new persona', category: 'Personas' },
      { key: 'E', action: 'Edit selected persona', category: 'Personas' },
      { key: 'Delete', action: 'Delete selected persona', category: 'Personas' },
      { key: 'Enter', action: 'Apply persona', category: 'Personas' },
      { key: '/', action: 'Search personas', category: 'Personas' },
    ],
    goals: [
      { key: 'N', action: 'Create new goal', category: 'Goals' },
      { key: 'E', action: 'Edit selected goal', category: 'Goals' },
      { key: 'Space', action: 'Toggle goal completion', category: 'Goals' },
      { key: 'Delete', action: 'Delete selected goal', category: 'Goals' },
      { key: '/', action: 'Search goals', category: 'Goals' },
    ],
    pipeline: [
      { key: 'N', action: 'Create new pipeline', category: 'Pipeline' },
      { key: 'R', action: 'Run pipeline', category: 'Pipeline' },
      { key: 'E', action: 'Edit pipeline', category: 'Pipeline' },
      { key: 'Delete', action: 'Delete pipeline', category: 'Pipeline' },
    ],
    analytics: [
      { key: 'R', action: 'Refresh data', category: 'Analytics' },
      { key: 'E', action: 'Export analytics', category: 'Analytics' },
      { key: '1-4', action: 'Switch between tabs', category: 'Analytics' },
    ],
    settings: [
      { key: 'Ctrl/Cmd + S', action: 'Save settings', category: 'Settings' },
      { key: '1-5', action: 'Switch between tabs', category: 'Settings' },
      { key: 'I', action: 'Import data', category: 'Settings' },
      { key: 'E', action: 'Export data', category: 'Settings' },
    ],
  };

  const allShortcuts = [...defaultShortcuts, ...(pageShortcuts[page] || [])];

  return <KeyboardShortcutsDialog shortcuts={allShortcuts} />;
}
