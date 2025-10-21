/**
 * API Key Tester Component
 * Real-time testing interface for LLM provider API keys
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, TestTube, Zap, Clock, Server } from 'lucide-react';
import { TestResult } from '@/hooks/use-provider-config';

const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    color: 'bg-blue-500',
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🧠',
    color: 'bg-orange-500',
  },
  'google-ai': {
    name: 'Google AI',
    icon: '🌟',
    color: 'bg-green-500',
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🚀',
    color: 'bg-purple-500',
  },
  grok: {
    name: 'Grok',
    icon: '⚡',
    color: 'bg-yellow-500',
  },
};

interface TestProgress {
  provider: string;
  status: 'idle' | 'testing' | 'success' | 'error';
  progress: number;
  message: string;
  details?: any;
}

export function ApiKeyTester() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [testProgress, setTestProgress] = useState<Record<string, TestProgress>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [testingAll, setTestingAll] = useState(false);

  const updateTestProgress = (provider: string, updates: Partial<TestProgress>) => {
    setTestProgress(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        ...updates,
      },
    }));
  };

  const testSingleProvider = async (provider: string) => {
    const apiKey = apiKeys[provider];
    if (!apiKey?.trim()) {
      updateTestProgress(provider, {
        status: 'error',
        progress: 100,
        message: 'API key is required',
      });
      return;
    }

    updateTestProgress(provider, {
      status: 'testing',
      progress: 25,
      message: 'Initializing test...',
    });

    try {
      // Simulate progress updates
      setTimeout(() => updateTestProgress(provider, {
        progress: 50,
        message: 'Connecting to provider...',
      }), 500);

      const response = await fetch('/api/provider-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
        }),
      });

      updateTestProgress(provider, {
        progress: 75,
        message: 'Processing response...',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Test failed');
      }

      updateTestProgress(provider, {
        status: 'success',
        progress: 100,
        message: data.message,
        details: data.details,
      });

      setResults(prev => ({
        ...prev,
        [provider]: data,
      }));

    } catch (error) {
      updateTestProgress(provider, {
        status: 'error',
        progress: 100,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const testAllProviders = async () => {
    setTestingAll(true);

    const providers = Object.keys(PROVIDER_CONFIGS);
    const results: Record<string, TestResult> = {};

    for (const provider of providers) {
      if (apiKeys[provider]?.trim()) {
        await testSingleProvider(provider);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setTestingAll(false);
  };

  const resetTests = () => {
    setTestProgress({});
    setResults({});
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <TestTube className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'testing':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TestTube className="h-6 w-6" />
            API Key Tester
          </h2>
          <p className="text-muted-foreground">
            Test your LLM provider API keys in real-time to ensure they work correctly.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetTests}
            disabled={testingAll}
          >
            Reset
          </Button>
          <Button
            onClick={testAllProviders}
            disabled={testingAll || Object.values(apiKeys).every(key => !key?.trim())}
          >
            {testingAll && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Test All
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(PROVIDER_CONFIGS).map(([key, config]) => {
          const progress = testProgress[key];
          const result = results[key];

          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{config.icon}</span>
                  {config.name}
                </CardTitle>
                <CardDescription>
                  Test your {config.name} API key
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor={`${key}-key`}>API Key</Label>
                  <Input
                    id={`${key}-key`}
                    type="password"
                    placeholder={`Enter ${config.name} API key`}
                    value={apiKeys[key] || ''}
                    onChange={(e) => setApiKeys(prev => ({
                      ...prev,
                      [key]: e.target.value,
                    }))}
                    disabled={progress?.status === 'testing'}
                  />
                </div>

                {progress && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(progress.status)}
                      <span className={`text-sm font-medium ${getStatusColor(progress.status)}`}>
                        {progress.message}
                      </span>
                    </div>

                    <Progress value={progress.progress} className="h-2" />

                    {progress.details?.responseTime && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {progress.details.responseTime}ms
                      </div>
                    )}
                  </div>
                )}

                {result && (
                  <Alert variant={result.success ? 'default' : 'destructive'}>
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <AlertDescription className="flex-1">
                        {result.message}
                      </AlertDescription>
                    </div>

                    {result.details && (
                      <div className="mt-2 space-y-1 text-xs">
                        {result.details.model && (
                          <div className="flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            Model: {result.details.model}
                          </div>
                        )}
                        {result.details.rateLimit && (
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Rate limit: {result.details.rateLimit.remaining || 0} remaining
                          </div>
                        )}
                      </div>
                    )}
                  </Alert>
                )}

                <Button
                  onClick={() => testSingleProvider(key)}
                  disabled={!apiKeys[key]?.trim() || progress?.status === 'testing' || testingAll}
                  className="w-full"
                  variant="outline"
                >
                  {progress?.status === 'testing' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test {config.name}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {Object.keys(results).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Summary</CardTitle>
            <CardDescription>
              Results of API key tests
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(results).map(([provider, result]) => {
                const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS];

                return (
                  <div
                    key={provider}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config?.icon}</span>
                      <span className="font-medium">{config?.name}</span>
                    </div>

                    <Badge variant={result.success ? 'default' : 'destructive'}>
                      {result.success ? '✓' : '✗'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
