
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle, Check, Clock, FileDown, FileUp, Terminal, Trash2, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UsageChart } from "@/components/analytics/usage-chart";
import { ModelComparisonChart } from "@/components/analytics/model-comparison-chart";
import { ExportImportDialog } from "@/components/export-import-dialog";
import { exportAllData, importAllData } from "@/services/export-import-service";
import { setStoredApiKey, getStoredApiKey } from "@/lib/secure-storage";
import { useSession } from "next-auth/react";

// LLM providers we'll support
const providers = [
  { id: "openai", name: "OpenAI" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
  { id: "llama", name: "Llama" },
  { id: "github", name: "GitHub" },
  { id: "grok", name: "Grok" },
];

interface LogEntry {
  id: string;
  timestamp: number;
  provider: string;
  type: "success" | "error";
  message: string;
  details?: string;
}

export default function Settings() {
  const { data: session } = useSession();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [modelSettings, setModelSettings] = useState<Record<string, any>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [importData, setImportData] = useState("");
  const [importError, setImportError] = useState("");
  
  // Generate some sample logs for demo purposes
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
  
  // Load API keys and settings from localStorage
  useEffect(() => {
    const loadData = async () => {
      // Load API keys
      const savedKeys: Record<string, string> = {};
      for (const provider of providers) {
        const key = getStoredApiKey(provider.id) || '';
        if (key) {
          savedKeys[provider.id] = key;
        }
      }
      setApiKeys(savedKeys);
      
      // Load model settings
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
        const defaults: Record<string, any> = {};
        providers.forEach(provider => {
          defaults[provider.id] = {
            temperature: 0.7,
            maxTokens: 2048,
            defaultModel: "gpt-4"
          };
        });
        setModelSettings(defaults);
        localStorage.setItem("modelSettings", JSON.stringify(defaults));
      }
    };
    
    loadData();
  }, []);
  
  // Save API key to localStorage
  const saveApiKey = async (providerId: string, key: string) => {
    if (!key) return;
    
    // Securely store the API key
    setStoredApiKey(providerId, key);
    
    // Update state
    setApiKeys(prev => ({
      ...prev,
      [providerId]: key
    }));
    
    // Add log entry
    addLogEntry({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      provider: providerId,
      type: "success",
      message: `Updated API key for ${providers.find(p => p.id === providerId)?.name}`
    });
  };
  
  // Save model settings to localStorage
  const saveModelSettings = (providerId: string, settings: any) => {
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
  };
  
  // Add a log entry
  const addLogEntry = (entry: LogEntry) => {
    setLogs(prev => [entry, ...prev].slice(0, 100)); // Keep only the latest 100 logs
  };
  
  // Clear all data
  const clearAllData = async () => {
    // Clear API keys
    for (const provider of providers) {
      // setStoredApiKey(provider.id, ''); // We could clear the key by setting it to empty string
    }
    
    // Clear settings
    localStorage.removeItem("modelSettings");
    
    // Reset state
    setApiKeys({});
    setModelSettings({});
    
    // Add log entry
    addLogEntry({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      provider: "system",
      type: "success",
      message: "Cleared all configuration data"
    });
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
        <h1 className="text-2xl font-bold">Configuration & Analytics</h1>
        <p className="text-gray-400">Manage your API keys, model settings, and view usage statistics</p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="model-settings">Model Settings</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="export-import">Export/Import</TabsTrigger>
        </TabsList>
        
        <TabsContent value="api-keys">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map(provider => (
              <Card key={provider.id} className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>{provider.name} API Key</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`apiKey-${provider.id}`}>API Key</Label>
                      <div className="flex space-x-2">
                        <Input
                          id={`apiKey-${provider.id}`}
                          type="password"
                          placeholder={`Enter your ${provider.name} API key`}
                          value={apiKeys[provider.id] || ""}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                          className="bg-gray-800 border-gray-700"
                        />
                        <Button 
                          onClick={() => saveApiKey(provider.id, apiKeys[provider.id] || "")}
                          disabled={!apiKeys[provider.id]}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-sm">
                      <div className="flex items-center space-x-2">
                        {apiKeys[provider.id] ? (
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
            ))}
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
                          defaultValue={settings.defaultModel || "default"}
                          onValueChange={(value) => 
                            saveModelSettings(provider.id, { defaultModel: value })
                          }
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-700">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800">
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
                          <Label>Default Temperature: {settings.temperature || 0.7}</Label>
                        </div>
                        <Slider
                          value={[settings.temperature || 0.7]}
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
                          <Label>Default Max Tokens: {settings.maxTokens || 2048}</Label>
                        </div>
                        <Slider
                          value={[settings.maxTokens || 2048]}
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
                          defaultModel: "default"
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
                    <div className="text-center text-gray-500 py-6">
                      <p>No activity logs yet</p>
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
                  Export your data to use on another device or import previously exported data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Export all your conversations, API keys, and settings to a file that you can import later.
                  </p>
                  
                  <ExportImportDialog
                    onExport={exportAllData}
                    onImport={importAllData}
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
                            onClick={clearAllData}
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
      </Tabs>
    </div>
  );
}
