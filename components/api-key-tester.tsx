'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useProviderConfig } from '@/hooks/use-provider-config';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-v1-...' },
  { id: 'claude', name: 'Claude (Anthropic)', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google AI', placeholder: 'AIza...' },
  { id: 'grok', name: 'Grok (X.AI)', placeholder: 'xai-...' },
  { id: 'llama', name: 'Llama (Ollama)', placeholder: 'llama_...' },
  { id: 'github', name: 'GitHub Copilot', placeholder: 'gho_...' },
] as const;

interface TestResult {
  tested: boolean;
  valid?: boolean;
  message?: string;
}

export default function ApiKeyTester() {
  const { testApiKey } = useProviderConfig();
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>({ tested: false });

  const handleTest = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      return;
    }

    setTesting(true);
    setTestResult({ tested: false });

    try {
      const result = await testApiKey(selectedProvider, apiKey.trim());
      setTestResult({
        tested: true,
        valid: result.valid,
        message: result.message,
      });
    } catch (error) {
      setTestResult({
        tested: true,
        valid: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    setApiKey('');
    setTestResult({ tested: false });
    setShowKey(false);
  };

  const handleClear = () => {
    setSelectedProvider('');
    setApiKey('');
    setTestResult({ tested: false });
    setShowKey(false);
  };

  const selectedProviderDetails = PROVIDERS.find(
    (p) => p.id === selectedProvider
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Key Tester</CardTitle>
        <CardDescription>
          Test your API keys to ensure they are valid before saving them. This helps prevent configuration errors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="provider-select">Provider</Label>
          <Select value={selectedProvider} onValueChange={handleProviderChange}>
            <SelectTrigger id="provider-select">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProvider && (
          <div className="space-y-2">
            <Label htmlFor="api-key-input">API Key</Label>
            <div className="relative">
              <Input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedProviderDetails?.placeholder}
                className="pr-10"
                disabled={testing}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
                disabled={testing}
                tabIndex={-1}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showKey ? 'Hide' : 'Show'} API key
                </span>
              </Button>
            </div>
          </div>
        )}

        {testResult.tested && (
          <Alert
            variant={testResult.valid ? 'default' : 'destructive'}
            className={testResult.valid ? 'border-green-500' : ''}
          >
            {testResult.valid ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {testResult.valid ? 'API Key Valid' : 'API Key Invalid'}
            </AlertTitle>
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleTest}
            disabled={!selectedProvider || !apiKey.trim() || testing}
            className="flex-1"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <AlertCircle className="mr-2 h-4 w-4" />
                Test API Key
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={testing || (!selectedProvider && !apiKey)}
          >
            Clear
          </Button>
        </div>

        <div className="rounded-lg border border-muted bg-muted/50 p-4">
          <h4 className="mb-2 font-medium">About Testing</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Tests make minimal API calls to verify key validity</li>
            <li>• Your API key is not stored during testing</li>
            <li>• Valid keys can be saved in Provider Configuration</li>
            <li>• Some providers may charge for test calls</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
