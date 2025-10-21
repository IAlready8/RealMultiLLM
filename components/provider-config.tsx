'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProviderConfig } from '@/hooks/use-provider-config';
import { Eye, EyeOff, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    placeholder: 'sk-...',
    description: 'GPT-4, GPT-3.5, and other OpenAI models',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    placeholder: 'sk-or-v1-...',
    description: 'Access to multiple LLM providers',
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    placeholder: 'sk-ant-...',
    description: 'Claude 3 Opus, Sonnet, and Haiku models',
  },
  {
    id: 'google',
    name: 'Google AI',
    placeholder: 'AIza...',
    description: 'Gemini and other Google AI models',
  },
  {
    id: 'grok',
    name: 'Grok (X.AI)',
    placeholder: 'xai-...',
    description: 'Grok models from X.AI',
  },
  {
    id: 'llama',
    name: 'Llama (Ollama)',
    placeholder: 'llama_...',
    description: 'Local Llama models via Ollama',
  },
  {
    id: 'github',
    name: 'GitHub Copilot',
    placeholder: 'gho_...',
    description: 'GitHub Copilot API',
  },
] as const;

export default function ProviderConfig() {
  const {
    configs,
    loading,
    saveConfig,
    deleteConfig,
    isConfigured,
  } = useProviderConfig();

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);

  const handleSave = async (providerId: string) => {
    const apiKey = apiKeys[providerId];
    if (!apiKey || !apiKey.trim()) {
      return;
    }

    setSavingProvider(providerId);
    try {
      await saveConfig({
        provider: providerId,
        apiKey: apiKey.trim(),
      });
      // Clear the input field after successful save
      setApiKeys((prev) => ({ ...prev, [providerId]: '' }));
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDeleteClick = (providerId: string) => {
    setProviderToDelete(providerId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!providerToDelete) return;

    setDeletingProvider(providerToDelete);
    try {
      await deleteConfig(providerToDelete);
      setApiKeys((prev) => ({ ...prev, [providerToDelete]: '' }));
    } finally {
      setDeletingProvider(null);
      setDeleteDialogOpen(false);
      setProviderToDelete(null);
    }
  };

  const toggleShowKey = (providerId: string) => {
    setShowKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Provider Configuration</h2>
          <p className="text-muted-foreground">
            Configure API keys for different LLM providers. Your keys are encrypted and stored securely.
          </p>
        </div>

        <div className="grid gap-6">
          {PROVIDERS.map((provider) => {
            const configured = isConfigured(provider.id);
            const isSaving = savingProvider === provider.id;
            const isDeleting = deletingProvider === provider.id;

            return (
              <Card key={provider.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {provider.name}
                        {configured && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Configured
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{provider.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${provider.id}-api-key`}>API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={`${provider.id}-api-key`}
                          type={showKeys[provider.id] ? 'text' : 'password'}
                          value={apiKeys[provider.id] || ''}
                          onChange={(e) =>
                            setApiKeys((prev) => ({
                              ...prev,
                              [provider.id]: e.target.value,
                            }))
                          }
                          placeholder={
                            configured
                              ? '••••••••••••••••••••••'
                              : provider.placeholder
                          }
                          className="pr-10"
                          disabled={loading || isSaving || isDeleting}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => toggleShowKey(provider.id)}
                          disabled={loading || isSaving || isDeleting}
                          tabIndex={-1}
                        >
                          {showKeys[provider.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          <span className="sr-only">
                            {showKeys[provider.id] ? 'Hide' : 'Show'} API key
                          </span>
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleSave(provider.id)}
                        disabled={
                          loading ||
                          isSaving ||
                          isDeleting ||
                          !apiKeys[provider.id]?.trim()
                        }
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                      {configured && (
                        <Button
                          variant="destructive"
                          onClick={() => handleDeleteClick(provider.id)}
                          disabled={loading || isSaving || isDeleting}
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the API key for{' '}
              {providerToDelete &&
                PROVIDERS.find((p) => p.id === providerToDelete)?.name}
              . You will need to re-enter it to use this provider again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
