"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { ModelSettingsSection } from "@/components/settings/ModelSettingsSection";
import { AnalyticsSection } from "@/components/settings/AnalyticsSection";
import { ExportImportSection } from "@/components/settings/ExportImportSection";
import { exportAllData, importAllData } from "@/services/export-import-service";
import { storeApiKey, getStoredApiKey, removeApiKey } from "@/lib/secure-storage";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger";

// Helper function to get default model for each provider
function getDefaultModelForProvider(providerId: string): string {
  switch (providerId) {
    case "openai":
      return "gpt-4o";
    case "claude":
      return "claude-3-opus-20240229";
    case "google":
      return "gemini-pro";
    default:
      return "default";
  }
}

// LLM providers we'll support (only those implemented)
const providers = [
  { id: "openai", name: "OpenAI" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
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
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [modelSettings, setModelSettings] = useState<Record<string, any>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [importData, setImportData] = useState("");
  const [importError, setImportError] = useState("");
  const [testingStatus, setTestingStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});
  
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
      logger.debug("Loading settings data...");
      // Load API keys
      const savedKeys: Record<string, string> = {};
      for (const provider of providers) {
        logger.debug(`Loading API key for provider: ${provider.id}`);
        const key = await getStoredApiKey(provider.id);
        logger.debug(`Loaded API key for ${provider.id}`, { hasKey: !!key });
        if (key) {
          savedKeys[provider.id] = key;
        }
      }
      logger.debug("Loaded API keys", { keyCount: Object.keys(savedKeys).length });
      setApiKeys(savedKeys);
      
      // Load model settings
      const savedSettings = localStorage.getItem("modelSettings");
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setModelSettings(parsed);
        } catch (e) {
          logger.error("Failed to load model settings", e);
        }
      } else {
        // Default settings
        const defaults: Record<string, any> = {};
        providers.forEach(provider => {
          defaults[provider.id] = {
            temperature: 0.7,
            maxTokens: 2048,
            defaultModel: getDefaultModelForProvider(provider.id)
          };
        });
        setModelSettings(defaults);
        localStorage.setItem("modelSettings", JSON.stringify(defaults));
      }
      logger.debug("Finished loading settings data");
    };
    
    loadData();
  }, []);
  
  // Save API key to localStorage
  const saveApiKey = async (providerId: string, key: string) => {
    if (!key?.trim()) {
      toast({
        title: "Error",
        description: "API key cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setTestingStatus(prev => ({ ...prev, [providerId]: 'testing' }));
      
      // Securely store the API key
      await storeApiKey(providerId, key.trim());
      
      // Update state
      setApiKeys(prev => ({
        ...prev,
        [providerId]: key.trim()
      }));
      
      // Add log entry for saving
      addLogEntry({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        provider: providerId,
        type: "success",
        message: `Saved API key for ${providers.find(p => p.id === providerId)?.name}`
      });
      
      toast({
        title: "API Key Saved",
        description: `Successfully saved API key for ${providers.find(p => p.id === providerId)?.name}`,
      });
      
      // Automatically test the API key after saving
      await testApiKey(providerId);
      
    } catch (error: any) {
      setTestingStatus(prev => ({ ...prev, [providerId]: 'error' }));
      
      addLogEntry({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        provider: providerId,
        type: "error",
        message: `Failed to save API key for ${providers.find(p => p.id === providerId)?.name}: ${error.message}`
      });
      
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save API key",
        variant: "destructive",
      });
      
      logger.error(`Error saving API key for ${providerId}`, error);
    }
  };
  
  // Test API key
  const testApiKey = async (providerId: string) => {
    const apiKey = apiKeys[providerId];
    
    if (!apiKey?.trim()) {
      toast({
        title: "Error",
        description: "No API key found to test. Please save an API key first.",
        variant: "destructive",
      });
      return;
    }
    
    setTestingStatus(prev => ({ ...prev, [providerId]: 'testing' }));
    
    const startTime = Date.now();
    
    try {
      const response = await fetch("/api/test-api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: providerId,
          apiKey: apiKey.trim()
        }),
      });
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      if (response.ok && data.valid) {
        setTestingStatus(prev => ({ ...prev, [providerId]: 'success' }));
        
        // Add success log entry with response time
        addLogEntry({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          provider: providerId,
          type: "success",
          message: `API key test passed for ${providers.find(p => p.id === providerId)?.name}`,
          details: `Response time: ${responseTime}ms`
        });
        
        toast({
          title: "✅ API Key Valid",
          description: `${providers.find(p => p.id === providerId)?.name} API key is working correctly (${responseTime}ms)`,
        });
        
      } else {
        setTestingStatus(prev => ({ ...prev, [providerId]: 'error' }));
        
        // Add error log entry
        addLogEntry({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          provider: providerId,
          type: "error",
          message: `API key test failed for ${providers.find(p => p.id === providerId)?.name}`,
          details: data.message || "Invalid API key"
        });
        
        toast({
          title: "❌ API Key Invalid",
          description: data.message || "The API key is not valid or has insufficient permissions",
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      setTestingStatus(prev => ({ ...prev, [providerId]: 'error' }));
      
      // Add error log entry
      addLogEntry({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        provider: providerId,
        type: "error",
        message: `API key test failed for ${providers.find(p => p.id === providerId)?.name}`,
        details: `Network error: ${error.message} (${responseTime}ms)`
      });
      
      toast({
        title: "🔌 Connection Error",
        description: `Failed to test API key: ${error.message}`,
        variant: "destructive",
      });
      
      logger.error(`Error testing API key for ${providerId}`, error);
    }
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

  // Remove API key handler
  const removeApiKeyHandler = async (providerId: string) => {
    try {
      await removeApiKey(providerId);
      setApiKeys(prev => {
        const updated = { ...prev };
        delete updated[providerId];
        return updated;
      });
      setTestingStatus(prev => ({ ...prev, [providerId]: 'idle' }));
      toast({
        title: "API Key Removed",
        description: `Successfully removed API key for ${providers.find(p => p.id === providerId)?.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Remove Failed",
        description: error.message || "Failed to remove API key",
        variant: "destructive",
      });
    }
  };

  // Update model setting helper
  const updateModelSetting = (providerId: string, setting: string, value: any) => {
    saveModelSettings(providerId, { [setting]: value });
  };

  // Reset model defaults helper
  const resetModelDefaults = () => {
    const defaults: Record<string, any> = {};
    providers.forEach(provider => {
      defaults[provider.id] = {
        temperature: 0.7,
        maxTokens: 2048,
        defaultModel: getDefaultModelForProvider(provider.id)
      };
    });
    setModelSettings(defaults);
    localStorage.setItem("modelSettings", JSON.stringify(defaults));
    toast({
      title: "Settings Reset",
      description: "All model settings have been reset to defaults",
    });
  };
  
  // Clear all data
  const clearAllData = async () => {
    // Clear API keys
    for (const provider of providers) {
      await removeApiKey(provider.id);
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
          <ApiKeySection 
            providers={providers}
            apiKeys={apiKeys}
            testingStatus={testingStatus}
            onSaveApiKey={saveApiKey}
            onTestApiKey={testApiKey}
            onRemoveApiKey={removeApiKeyHandler}
          />
        </TabsContent>
        
        <TabsContent value="model-settings">
          <ModelSettingsSection 
            providers={providers}
            modelSettings={modelSettings}
            onUpdateModelSetting={updateModelSetting}
            onResetToDefaults={resetModelDefaults}
          />
        </TabsContent>
        
        <TabsContent value="analytics">
          <AnalyticsSection logs={logs} providers={providers} />
        </TabsContent>
        
        <TabsContent value="export-import">
          <ExportImportSection 
            onExportData={exportAllData}
            onImportData={importAllData}
            onClearAllData={clearAllData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}