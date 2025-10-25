"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle, Check, Clock, Terminal, Trash2, RefreshCw, Palette, Shield, Bell, Zap, Loader2, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UsageChart } from "@/components/analytics/usage-chart";
import { ModelComparisonChart } from "@/components/analytics/model-comparison-chart";
import { ExportImportDialog } from "@/components/export-import-dialog";
import { exportAllData, importAllData } from "@/services/export-import-service";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";

// Enhanced error type for better feedback
interface DetailedError {
  message: string;
  code?: string;
  suggestion?: string;
}

interface EnhancedTestResult {
  success: boolean;
  message: string;
  details?: {
    responseTime?: number;
    model?: string;
    error?: DetailedError;
  };
}

// Enhanced API key validation function
function validateApiKey(provider: string, key: string): { isValid: boolean; error?: DetailedError } {
  if (!key || key.trim().length === 0) {
    return {
      isValid: false,
      error: {
        message: "API key cannot be empty",
        code: "EMPTY_KEY",
        suggestion: "Please enter a valid API key"
      }
    };
  }

  // Format validation based on provider
  switch (provider.toLowerCase()) {
    case 'openai':
      if (!key.startsWith('sk-')) {
        return {
          isValid: false,
          error: {
            message: "OpenAI key must start with 'sk-'",
            code: "INVALID_FORMAT",
            suggestion: "Get your API key from OpenAI dashboard"
          }
        };
      }
      if (key.length < 40) {
        return {
          isValid: false,
          error: {
            message: "OpenAI key appears to be too short",
            code: "INVALID_LENGTH",
            suggestion: "Verify you copied the full API key"
          }
        };
      }
      break;
    case 'anthropic':
      if (!key.startsWith('sk-ant-')) {
        return {
          isValid: false,
          error: {
            message: "Anthropic key must start with 'sk-ant-'",
            code: "INVALID_FORMAT",
            suggestion: "Get your API key from Anthropic console"
          }
        };
      }
      break;
    case 'google':
      if (!key.startsWith('AIza')) {
        return {
          isValid: false,
          error: {
            message: "Google AI key must start with 'AIza'",
            code: "INVALID_FORMAT",
            suggestion: "Get your API key from Google Cloud Console"
          }
        };
      }
      break;
    case 'openrouter':
      if (!key.startsWith('sk-or-')) {
        return {
          isValid: false,
          error: {
            message: "OpenRouter key must start with 'sk-or-'",
            code: "INVALID_FORMAT",
            suggestion: "Get your API key from OpenRouter dashboard"
          }
        };
      }
      break;
    case 'grok':
      if (!key.startsWith('xai-')) {
        return {
          isValid: false,
          error: {
            message: "Grok key must start with 'xai-'",
            code: "INVALID_FORMAT",
            suggestion: "Get your API key from xAI platform"
          }
        };
      }
      break;
    default:
      if (key.length < 5) {
        return {
          isValid: false,
          error: {
            message: "API key appears to be too short",
            code: "INVALID_LENGTH",
            suggestion: "Verify you copied the full API key"
          }
        };
      }
  }

  return { isValid: true };
}

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

const toApiUrl = (path: string) => {
  const base =
    typeof window !== "undefined" && typeof window.location !== "undefined" && window.location.origin &&
    window.location.origin !== "null" &&
    window.location.origin !== "about:blank"
      ? window.location.origin
      : DEFAULT_BASE_URL;

  return new URL(path, base).toString();
};

// LLM providers we'll support
const providers = [
  { id: "openai", name: "OpenAI", description: "GPT models by OpenAI", icon: "🤖" },
  { id: "openrouter", name: "OpenRouter", description: "Access to 100+ models", icon: "🌐" },
  { id: "claude", name: "Claude", description: "Anthropic's Claude models", icon: "🧠" },
  { id: "google", name: "Google AI", description: "Gemini models by Google", icon: "🔍" },
  { id: "llama", name: "Llama", description: "Meta's open-source models", icon: "🦙" },
  { id: "github", name: "GitHub", description: "GitHub Copilot integration", icon: "🐙" },
  { id: "grok", name: "Grok", description: "xAI's Grok models", icon: "⚡" },
];

interface LogEntry {
  id: string;
  timestamp: number;
  provider: string;
  type: "success" | "error";
  message: string;
  details?: string;
}

export default function EnhancedSettings() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [modelSettings, setModelSettings] = useState<Record<string, Record<string, any>>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; name: string; pricing?: { prompt?: number; completion?: number } }>>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, EnhancedTestResult>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, DetailedError>>({});

  // Initialize with sample logs
  useEffect(() => {
    const sampleLogs: LogEntry[] = [];
    const now = Date.now();
    
    // Add some success logs
    for (let i = 0; i < 15; i++) {
      const provider = providers[Math.floor(Math.random() * providers.length)];
      sampleLogs.push({
        id: `log_${i}`,
        timestamp: now - (i * 600000) - Math.floor(Math.random() * 300000),
        provider: provider.id,
        type: Math.random() > 0.3 ? "success" : "error",
        message: Math.random() > 0.3 
          ? `Successfully queried ${provider.name} API` 
          : `Failed to connect to ${provider.name} API`,
        details: Math.random() > 0.3 
          ? `Received response in ${Math.floor(Math.random() * 2000)}ms with ${Math.floor(Math.random() * 1000)} tokens` 
          : `Error: ${Math.random() > 0.5 ? "API key invalid" : "Request timed out"}`
      });
    }
    
    setLogs(sampleLogs.sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  // Fetch configured providers and settings
  useEffect(() => {
    const loadConfiguredProviders = async () => {
      try {
        const response = await fetch(toApiUrl('/api/config'));
        if (response.ok) {
          const data = await response.json();
          setConfiguredProviders(data.configuredProviders || []);
        }
      } catch (error) {
        console.error("Failed to load configured providers:", error);
      }
    };
    
    loadConfiguredProviders();
    
    // Load model settings from localStorage
    const savedSettings = localStorage.getItem("modelSettings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setModelSettings(parsed);
      } catch (e) {
        console.error("Failed to load model settings:", e);
      }
    } else {
      // Default settings
      const defaults: Record<string, Record<string, unknown>> = {};
      providers.forEach(provider => {
        defaults[provider.id] = {
          temperature: 0.7,
          maxTokens: 2048,
          defaultModel: provider.id === 'openai' ? 'gpt-4' : provider.id === 'claude' ? 'claude-3-sonnet' : 'default'
        };
      });
      setModelSettings(defaults);
      localStorage.setItem("modelSettings", JSON.stringify(defaults));
    }
  }, []);

  // Load OpenRouter models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch(toApiUrl("/api/openrouter/models"));
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data?.data) ? data.data : [];
        setOpenRouterModels(list);
      } catch {
        // ignore
      }
    };
    fetchModels();
  }, []);

  // Save API key via backend API
  const saveApiKey = async (providerId: string, key: string) => {
    // First validate the API key format
    const validation = validateApiKey(providerId, key);
    if (!validation.isValid) {
      setValidationErrors(prev => ({
        ...prev,
        [providerId]: validation.error!
      }));
      return;
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[providerId];
        return newErrors;
      });
    }

    setSaving(prev => ({ ...prev, [providerId]: true }));
    
    try {
      // Save to backend securely
      const response = await fetch(toApiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey: key }),
      });

      if (!response.ok) {
        throw new Error('Failed to save API key.');
      }

      // Update state - clear the input and mark as configured
      setApiKeys(prev => ({ ...prev, [providerId]: "" }));
      setConfiguredProviders(prev => [...new Set([...prev, providerId])]);
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[providerId];
        return newErrors;
      });
      
      // Add log entry
      addLogEntry({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        provider: providerId,
        type: "success",
        message: `Updated API key for ${providers.find(p => p.id === providerId)?.name}`
      });

      toast({
        title: "Success",
        description: `API key for ${providers.find(p => p.id === providerId)?.name} saved successfully`,
      });
    } catch (error) {
      console.error("Error saving API key:", error);
      addLogEntry({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        provider: providerId,
        type: "error",
        message: `Failed to save API key for ${providers.find(p => p.id === providerId)?.name}`
      });

      toast({
        title: "Error",
        description: `Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(prev => ({ ...prev, [providerId]: false }));
    }
  };

  // Test API key
  const testApiKey = async (providerId: string) => {
    const apiKey = apiKeys[providerId];
    if (!apiKey) {
      toast({
        title: "Error",
        description: "Please enter an API key to test",
        variant: "destructive",
      });
      return;
    }

    setTesting(prev => ({ ...prev, [providerId]: true }));
    
    try {
      const response = await fetch(toApiUrl('/api/test-api-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Test failed');
      }

      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: result.valid,
          message: result.message,
          details: {
            responseTime: result.details?.responseTime,
            model: result.details?.model,
            error: result.details?.error ? {
              message: result.details.error,
              code: 'TEST_FAILED'
            } : undefined
          }
        }
      }));

      // Add log entry
      addLogEntry({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        provider: providerId,
        type: result.valid ? "success" : "error",
        message: `API key test ${result.valid ? 'passed' : 'failed'} for ${providers.find(p => p.id === providerId)?.name}`,
        details: result.message
      });

      toast({
        title: result.valid ? "Success" : "Test Failed",
        description: result.message,
        variant: result.valid ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Error testing API key:", error);
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          message: error instanceof Error ? error.message : 'Test failed due to unknown error',
          details: {
            error: {
              message: error instanceof Error ? error.message : 'Test failed due to unknown error',
              code: 'NETWORK_ERROR'
            }
          }
        }
      }));

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Test failed due to unknown error',
        variant: "destructive",
      });
    } finally {
      setTesting(prev => ({ ...prev, [providerId]: false }));
    }
  };

  // Clear API key via backend API
  const clearApiKey = async (providerId: string) => {
    setSaving(prev => ({ ...prev, [providerId]: true }));
    
    try {
      const response = await fetch(toApiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey: "" }), // Empty key clears it
      });

      if (!response.ok) {
        throw new Error('Failed to clear API key.');
      }

      setConfiguredProviders(prev => prev.filter(p => p !== providerId));
      setApiKeys(prev => ({ ...prev, [providerId]: "" }));
      setTestResults(prev => {
        const newResults = { ...prev };
        delete newResults[providerId];
        return newResults;
      });
      
      addLogEntry({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        provider: providerId,
        type: "success",
        message: `Cleared API key for ${providers.find(p => p.id === providerId)?.name}`
      });

      toast({
        title: "Success",
        description: `API key for ${providers.find(p => p.id === providerId)?.name} cleared successfully`,
      });
    } catch (error) {
      console.error("Error clearing API key:", error);
      addLogEntry({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        provider: providerId,
        type: "error",
        message: `Failed to clear API key for ${providers.find(p => p.id === providerId)?.name}`
      });

      toast({
        title: "Error",
        description: `Failed to clear API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(prev => ({ ...prev, [providerId]: false }));
    }
  };
  
  // Save model settings to localStorage
  const saveModelSettings = (providerId: string, settings: Record<string, unknown>) => {
    const updatedSettings = {
      ...modelSettings,
      [providerId]: {
        ...modelSettings[providerId],
        ...settings
      }
    };
    
    setModelSettings(updatedSettings);
    localStorage.setItem("modelSettings", JSON.stringify(updatedSettings));
    
    // Add log entry
    addLogEntry({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      provider: providerId,
      type: "success",
      message: `Updated settings for ${providers.find(p => p.id === providerId)?.name}`
    });

    toast({
      title: "Success",
      description: `Settings for ${providers.find(p => p.id === providerId)?.name} saved successfully`,
    });
  };
  
  // Add a log entry
  const addLogEntry = (entry: LogEntry) => {
    setLogs(prev => [entry, ...prev].slice(0, 100)); // Keep only the latest 100 logs
  };
  
  // Calculate usage statistics
  const usageStats = useMemo(() => {
    const stats: Record<string, { success: number; error: number; avgTime: number }> = {};
    
    providers.forEach(provider => {
      const providerLogs = logs.filter(log => log.provider === provider.id);
      const successLogs = providerLogs.filter(log => log.type === "success");
      
      // Extract response times from logs (this is just for demo purposes)
      const times: number[] = [];
      successLogs.forEach(log => {
        if (log.details) {
          const match = log.details.match(/(\d+)ms/);
          if (match && match[1]) {
            times.push(parseInt(match[1]));
          }
        }
      });
      
      stats[provider.id] = {
        success: successLogs.length,
        error: providerLogs.length - successLogs.length,
        avgTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
      };
    });
    
    return stats;
  }, [logs]);

  // Sample data for analytics charts
  const usageData = useMemo(() => {
    return providers.map(provider => {
      const stats = usageStats[provider.id] || { success: 0, error: 0, avgTime: 0 };
      return {
        provider: provider.name,
        requests: stats.success + stats.error,
        tokens: Math.floor(Math.random() * 10000) + 1000,
        errors: stats.error,
        avgResponseTime: stats.avgTime
      };
    });
  }, [usageStats]);

  // Sample data for model comparison
  const modelComparisonData = useMemo(() => {
    return providers.map(provider => ({
      provider: provider.name,
      factualAccuracy: Math.floor(Math.random() * 3) + 3,
      creativity: Math.floor(Math.random() * 3) + 3,
      helpfulness: Math.floor(Math.random() * 3) + 3,
      coherence: Math.floor(Math.random() * 3) + 3,
      conciseness: Math.floor(Math.random() * 3) + 3
    }));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="heading-underline text-2xl font-bold">Configuration & Analytics</h1>
        <p className="text-gray-400">Manage your API keys, model settings, and view usage statistics</p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="model-settings">Model Settings</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="export-import">Export/Import</TabsTrigger>
          <TabsTrigger value="advanced-settings">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="api-keys">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map(provider => {
              const validationError = validationErrors[provider.id];
              const testResult = testResults[provider.id];
              
              return (
                <Card
                  key={provider.id}
                  className="bg-gray-900 border-gray-800 relative"
                  data-testid={`api-card-${provider.id}`}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{provider.icon}</span>
                      <div>
                        <CardTitle>{provider.name}</CardTitle>
                        <CardDescription>{provider.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`apiKey-${provider.id}`}>API Key</Label>
                        <div className="flex flex-col space-y-2">
                          <div className="flex space-x-2">
                            <Input
                              id={`apiKey-${provider.id}`}
                              type="password"
                              placeholder={configuredProviders.includes(provider.id) ? "••••••••••••••••••••••" : `Enter your ${provider.name} API key`}
                              value={apiKeys[provider.id] || ""}
                              onChange={(e) => {
                                setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }));
                                // Clear test results when user types
                                if (testResults[provider.id]) {
                                  setTestResults(prev => {
                                    const newResults = { ...prev };
                                    delete newResults[provider.id];
                                    return newResults;
                                  });
                                }
                              }}
                              className={`bg-gray-800 border-gray-700 ${validationError ? 'border-red-500' : ''}`}
                            />
                            <Button 
                              onClick={() => saveApiKey(provider.id, apiKeys[provider.id] || "")}
                              disabled={!apiKeys[provider.id] || saving[provider.id]}
                              size="sm"
                            >
                              {saving[provider.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                            </Button>
                            {configuredProviders.includes(provider.id) && (
                              <Button 
                                onClick={() => clearApiKey(provider.id)}
                                disabled={saving[provider.id]}
                                variant="destructive"
                                size="sm"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button 
                              onClick={() => testApiKey(provider.id)}
                              disabled={!apiKeys[provider.id] || testing[provider.id]}
                              size="sm"
                              variant="outline"
                              className="flex-1"
                            >
                              {testing[provider.id] ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                              Test Key
                            </Button>
                          </div>
                        </div>
                        
                        {validationError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {validationError.message}
                              {validationError.suggestion && (
                                <div className="mt-1 text-sm opacity-75">
                                  <strong>Suggestion:</strong> {validationError.suggestion}
                                </div>
                              )}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      
                      {testResult && (
                        <div className={`p-3 rounded-md border ${testResult.success ? 'border-green-800 bg-green-900/20' : 'border-red-800 bg-red-900/20'}`}>
                          <div className="flex items-center gap-2">
                            {testResult.success ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">{testResult.success ? 'Success' : 'Error'}</span>
                          </div>
                          <div className="mt-1 text-sm">{testResult.message}</div>
                          {testResult.details?.responseTime && (
                            <div className="mt-1 text-xs text-gray-400 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Response time: {testResult.details.responseTime}ms
                            </div>
                          )}
                          {testResult.details?.model && (
                            <div className="mt-1 text-xs text-gray-400">
                              Model: {testResult.details.model}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="text-sm">
                        <div className="flex items-center space-x-2">
                          {configuredProviders.includes(provider.id) ? (
                            <>
                              <Check className="h-4 w-4 text-green-500" />
                              <span className="text-green-500">API key is configured</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              <span className="text-yellow-500">No API key configured</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="model-settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {providers.map(provider => {
              const settings = modelSettings[provider.id] || {};
              
              return (
                <Card key={provider.id} className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle>{provider.name} Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor={`model-${provider.id}`}>Default Model</Label>
                        <Select
                          defaultValue={String(settings.defaultModel || "default")}
                          onValueChange={(value) => 
                            saveModelSettings(provider.id, { defaultModel: value })
                          }
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-700">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800">
                            {provider.id === "openrouter" && (
                              <>
                                {/* Dynamic list from OpenRouter; enable free only, show pricing on paid */}
                                {openRouterModels.length === 0 && (
                                  <div className="px-3 py-2 text-sm text-gray-400">Loading models...</div>
                                )}
                                {openRouterModels.map((m) => {
                                  const id = m.id as string;
                                  const name = m.name || id;
                                  const p = m.pricing || {};
                                  const prompt = p.prompt ?? 0;
                                  const completion = p.completion ?? 0;
                                  const isFree = (!prompt && !completion) || (prompt === 0 && completion === 0);
                                  const label = isFree
                                    ? `${name} (Free)`
                                    : `${name} (${prompt ?? 0} / ${completion ?? 0})`;
                                  return (
                                    <SelectItem key={id} value={id} disabled={!isFree}>
                                      {label}
                                    </SelectItem>
                                  );
                                })}
                                <SelectItem value="openrouter/auto">OpenRouter - Auto (routing)</SelectItem>
                              </>
                            )}
                            {provider.id === "openai" && (
                              <>
                                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                              </>
                            )}
                            {provider.id === "claude" && (
                              <>
                                <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                                <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                                <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                              </>
                            )}
                            {provider.id === "google" && (
                              <>
                                <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                                <SelectItem value="gemini-ultra">Gemini Ultra</SelectItem>
                              </>
                            )}
                            {provider.id === "llama" && (
                              <>
                                <SelectItem value="llama-3">Llama 3</SelectItem>
                                <SelectItem value="llama-2-70b">Llama 2 70B</SelectItem>
                              </>
                            )}
                            {provider.id === "github" && (
                              <>
                                <SelectItem value="github-copilot">GitHub Copilot</SelectItem>
                              </>
                            )}
                            {provider.id === "grok" && (
                              <>
                                <SelectItem value="grok-1">Grok-1</SelectItem>
                              </>
                            )}
                            <SelectItem value="default">Default</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Default Temperature: {Number(settings.temperature) || 0.7}</Label>
                        </div>
                        <Slider
                          value={[Number(settings.temperature) || 0.7]}
                          min={0}
                          max={1}
                          step={0.1}
                          onValueChange={(values) => 
                            saveModelSettings(provider.id, { temperature: values[0] })
                          }
                        />
                        <p className="text-xs text-gray-500">
                          Lower values produce more predictable outputs, higher values more creative ones
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Default Max Tokens: {Number(settings.maxTokens) || 2048}</Label>
                        </div>
                        <Slider
                          value={[Number(settings.maxTokens) || 2048]}
                          min={256}
                          max={4096}
                          step={256}
                          onValueChange={(values) => 
                            saveModelSettings(provider.id, { maxTokens: values[0] })
                          }
                        />
                        <p className="text-xs text-gray-500">
                          Maximum number of tokens to generate in responses
                        </p>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => saveModelSettings(provider.id, {
                          temperature: 0.7,
                          maxTokens: 2048,
                          defaultModel: provider.id === 'openai' ? 'gpt-4' : provider.id === 'claude' ? 'claude-3-sonnet' : 'default'
                        })}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reset to Defaults
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="analytics">
          <div className="space-y-6">
            <UsageChart data={usageData} title="Usage Statistics" />
            
            <ModelComparisonChart data={modelComparisonData} title="Model Performance Comparison" />
            
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Last {logs.length} log entries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map(log => {
                    const provider = providers.find(p => p.id === log.provider);
                    return (
                      <div 
                        key={log.id} 
                        className={`p-3 rounded-md border ${
                          log.type === "success" 
                            ? "border-green-800 bg-green-900/20" 
                            : "border-red-800 bg-red-900/20"
                        }`}
                      >
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <span className={`h-2 w-2 rounded-full mr-2 ${
                              log.type === "success" ? "bg-green-500" : "bg-red-500"
                            }`}></span>
                            <span className="font-medium">{provider?.name || log.provider}</span>
                          </div>
                          <div className="text-xs text-gray-400 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-1">{log.message}</div>
                        {log.details && (
                          <div className="mt-1 text-sm text-gray-400">{log.details}</div>
                        )}
                      </div>
                    );
                  })}
                  
                  {logs.length === 0 && (
                    <div className="text-gray-400 text-center mt-2">
                      <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
                        <p className="text-sm">No activity logs yet</p>
                        <p className="text-xs text-gray-500">Activity appears here as you use the app.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="export-import">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Export/Import Data</CardTitle>
                <CardDescription>
                  Export all your data to use on another device or import previously exported data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Export all your conversations, API keys, and settings to a file that you can import later.
                  </p>
                  
                  <ExportImportDialog
                    onExport={async (password) => {
                      if (!session?.user?.id) {
                        throw new Error("You must be logged in to export data.");
                      }
                      return await exportAllData(password, session.user.id);
                    }}
                    onImport={async (data, password) => {
                      if (!session?.user?.id) {
                        throw new Error("You must be logged in to import data.");
                      }
                      await importAllData(data, password, session.user.id, { conflictResolution: 'merge' });
                    }}
                    buttonVariant="default"
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
                <CardDescription>
                  Operations that will permanently remove data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert className="border-red-800 bg-red-900/20">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <AlertDescription>
                      The following actions are irreversible and will permanently delete your configuration data.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear All Data
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-900 border-gray-800">
                        <DialogHeader>
                          <DialogTitle>Clear All Data</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                          <p>This will delete all your API keys and model settings. This action cannot be undone.</p>
                        </div>
                        <DialogFooter>
                          <Button 
                            variant="outline" 
                            onClick={() => {}}
                          >
                            Cancel
                          </Button>
                          <Button 
                            variant="destructive"
                          >
                            Delete Everything
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <Button variant="outline" className="w-full">
                      <Terminal className="h-4 w-4 mr-2" />
                      Export Activity Logs
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="advanced-settings">
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Customize your experience with advanced configuration options
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Appearance</h3>
                    <p className="text-sm text-gray-400">
                      Customize colors, fonts, and display options
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.location.href = "/advanced-settings"}
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Appearance Settings
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Security</h3>
                    <p className="text-sm text-gray-400">
                      Configure security and privacy settings
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.location.href = "/advanced-settings#security"}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Security Settings
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Notifications</h3>
                    <p className="text-sm text-gray-400">
                      Manage notification preferences
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.location.href = "/advanced-settings#notifications"}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      Notification Settings
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Performance</h3>
                    <p className="text-sm text-gray-400">
                      Optimize application performance
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.location.href = "/advanced-settings#advanced"}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Performance Settings
                    </Button>
                  </div>
                </div>
                
                <div className="mt-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-2">Quick Customization</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Adjust common settings without navigating to the full settings page
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Compact Mode</span>
                      <Switch 
                        checked={false}
                        onCheckedChange={() => {}}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Dark Theme</span>
                      <Switch 
                        checked={true}
                        onCheckedChange={() => {}}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Animations</span>
                      <Switch 
                        checked={true}
                        onCheckedChange={() => {}}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}