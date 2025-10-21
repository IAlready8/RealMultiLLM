/**
 * Provider Configuration Component
 * UI for managing LLM provider API keys and settings
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Key, TestTube, CheckCircle, XCircle, Loader2, Settings } from 'lucide-react';
import { useProviderConfig, ProviderConfig as ProviderConfigType, TestResult } from '@/hooks/use-provider-config';

const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5 Turbo, and other OpenAI models',
    icon: '🤖',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude 3 Opus, Sonnet, and Haiku models',
    icon: '🧠',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/',
  },
  'google-ai': {
    name: 'Google AI',
    description: 'Gemini Pro and other Google AI models',
    icon: '🌟',
    placeholder: 'AIza...',
    docsUrl: 'https://makersuite.google.com/app/apikey',
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Access to 100+ AI models through one API',
    icon: '🚀',
    placeholder: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
  },
  grok: {
    name: 'Grok',
    description: 'xAI\'s Grok models',
    icon: '⚡',
    placeholder: 'xai-...',
    docsUrl: 'https://console.x.ai/',
  },
};

export function ProviderConfig() {
  const {
    configs,
    loading,
    error,
    testingProvider,
    saveProviderConfig,
    updateProviderConfig,
    deleteProviderConfig,
    testProviderApiKey,
    getProviderConfig,
  } = useProviderConfig();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const handleSaveConfig = async () => {
    if (!selectedProvider || !apiKey.trim()) return;

    setSaving(true);
    try {
      const success = await saveProviderConfig(selectedProvider, apiKey.trim());
      if (success) {
        setApiKey('');
        setSelectedProvider(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestProvider = async (provider: string) => {
    const result = await testProviderApiKey(provider);
    if (result) {
      setTestResults(prev => ({
        ...prev,
        [provider]: result,
      }));
    }
  };

  const handleDeleteConfig = async (configId: string, provider: string) => {
    if (confirm(`Are you sure you want to delete the ${provider} configuration?`)) {
      await deleteProviderConfig(configId);
      setTestResults(prev => {
        const updated = { ...prev };
        delete updated[provider];
        return updated;
      });
    }
  };

  const handleToggleActive = async (config: ProviderConfigType) => {
    await updateProviderConfig(config.id, { isActive: !config.isActive });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Provider Configuration</h2>
          <p className="text-muted-foreground">
            Configure API keys for different LLM providers to enable chat functionality.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Key className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Provider Configuration</DialogTitle>
              <DialogDescription>
                Configure a new LLM provider by entering your API key.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="provider-select">Provider</Label>
                <select
                  id="provider-select"
                  value={selectedProvider || ''}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-md"
                >
                  <option value="">Select a provider...</option>
                  {Object.entries(PROVIDER_CONFIGS).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.icon} {config.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProvider && (
                <div>
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder={PROVIDER_CONFIGS[selectedProvider as keyof typeof PROVIDER_CONFIGS]?.placeholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Get your API key from{' '}
                    <a
                      href={PROVIDER_CONFIGS[selectedProvider as keyof typeof PROVIDER_CONFIGS]?.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {PROVIDER_CONFIGS[selectedProvider as keyof typeof PROVIDER_CONFIGS]?.name}
                    </a>
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveConfig}
                  disabled={!selectedProvider || !apiKey.trim() || saving}
                  className="flex-1"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Configuration
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="configured" className="w-full">
        <TabsList>
          <TabsTrigger value="configured">Configured ({configs.length})</TabsTrigger>
          <TabsTrigger value="available">Available Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="configured" className="space-y-4">
          {configs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Key className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No providers configured</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first LLM provider to start chatting with AI models.
                </p>
                <Button onClick={() => setSelectedProvider('openai')}>
                  Add OpenAI
                </Button>
              </CardContent>
            </Card>
          ) : (
            configs.map((config) => {
              const providerInfo = PROVIDER_CONFIGS[config.provider as keyof typeof PROVIDER_CONFIGS];
              const testResult = testResults[config.provider];

              return (
                <Card key={config.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{providerInfo?.icon}</span>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {providerInfo?.name}
                            <Badge variant={config.isActive ? 'default' : 'secondary'}>
                              {config.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{providerInfo?.description}</CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestProvider(config.provider)}
                          disabled={testingProvider === config.provider}
                        >
                          {testingProvider === config.provider ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TestTube className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(config)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteConfig(config.id, config.provider)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Usage Count:</span>
                        <span>{config.usageCount}</span>
                      </div>

                      {config.lastUsedAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span>Last Used:</span>
                          <span>{new Date(config.lastUsedAt).toLocaleDateString()}</span>
                        </div>
                      )}

                      {testResult && (
                        <div className="mt-4 p-3 rounded-md border">
                          <div className="flex items-center gap-2 mb-2">
                            {testResult.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">
                              {testResult.success ? 'Test Successful' : 'Test Failed'}
                            </span>
                          </div>

                          <p className="text-sm text-muted-foreground">{testResult.message}</p>

                          {testResult.details?.responseTime && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Response time: {testResult.details.responseTime}ms
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {Object.entries(PROVIDER_CONFIGS).map(([key, config]) => {
            const existingConfig = getProviderConfig(key);

            return (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <CardTitle>{config.name}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>

                    {existingConfig ? (
                      <Badge variant="default">Configured</Badge>
                    ) : (
                      <Button
                        onClick={() => setSelectedProvider(key)}
                        size="sm"
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    API Key required.{' '}
                    <a
                      href={config.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Get your API key here
                    </a>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
