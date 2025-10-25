"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, Eye, EyeOff,  Loader2 } from "lucide-react";

interface ApiKeyStatus {
  id: string;
  provider: string;
  isConfigured: boolean;
  lastTested?: Date;
  isValid?: boolean;
  createdAt?: Date;
}

const providers = [
  { id: "openai", name: "OpenAI", placeholder: "sk-...", description: "GPT models" },
  { id: "openrouter", name: "OpenRouter", placeholder: "sk-or-v1-...", description: "Multi-provider gateway" },
  { id: "claude", name: "Claude", placeholder: "sk-ant-...", description: "Anthropic models" },
  { id: "google", name: "Google AI", placeholder: "AIza...", description: "Gemini models" },
  { id: "grok", name: "Grok", placeholder: "xai-...", description: "xAI models" },
];

export function ApiKeyManager() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Fetch configured providers and their status
  useEffect(() => {
    fetchKeyStatus();
  }, []);

  const fetchKeyStatus = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        const configuredProviders = data.configuredProviders || [];
        
        const status: ApiKeyStatus[] = providers.map(provider => ({
          id: provider.id,
          provider: provider.id,
          isConfigured: configuredProviders.includes(provider.id),
        }));
        
        setKeyStatus(status);
      }
    } catch (error) {
      console.error("Failed to fetch key status:", error);
      toast({
        title: "Error",
        description: "Could not load API key status.",
        variant: "destructive",
      });
    }
  };

  const handleSaveKey = async (providerId: string) => {
    const apiKey = apiKeys[providerId];
    if (!apiKey?.trim()) {
      toast({
        title: "No API Key",
        description: "Please enter an API key before saving.",
        variant: "destructive",
      });
      return;
    }

    setLoading(prev => ({ ...prev, [providerId]: true }));
    
    try {
      // Test the key first
      const testResponse = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey }),
      });

      const testResult = await testResponse.json();
      if (!testResult.valid) {
        toast({
          title: "Invalid API Key",
          description: testResult.message || "This API key is not valid.",
          variant: "destructive",
        });
        return;
      }

      // Save the key
      const saveResponse = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save API key.');
      }

      toast({
        title: "Success",
        description: `API key for ${providers.find(p => p.id === providerId)?.name} saved successfully.`,
      });
      
      // Clear input and refresh status
      setApiKeys(prev => ({ ...prev, [providerId]: "" }));
      fetchKeyStatus();

    } catch (error) {
      console.error("Error saving API key:", error);
      toast({
        title: "Error",
        description: "Failed to save API key.",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTestKey = async (providerId: string) => {
    setTesting(prev => ({ ...prev, [providerId]: true }));
    
    try {
      const response = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey: 'existing' }),
      });

      const result = await response.json();
      
      if (result.valid) {
        toast({
          title: "API Key Valid",
          description: `${providers.find(p => p.id === providerId)?.name} API key is working correctly.`,
        });
        
        // Update status
        setKeyStatus(prev => prev.map(status => 
          status.provider === providerId 
            ? { ...status, isValid: true, lastTested: new Date() }
            : status
        ));
      } else {
        toast({
          title: "API Key Invalid",
          description: result.message || "The API key is not working correctly.",
          variant: "destructive",
        });
        
        setKeyStatus(prev => prev.map(status => 
          status.provider === providerId 
            ? { ...status, isValid: false, lastTested: new Date() }
            : status
        ));
      }
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Could not test the API key.",
        variant: "destructive",
      });
    } finally {
      setTesting(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleRemoveKey = async (providerId: string) => {
    setLoading(prev => ({ ...prev, [providerId]: true }));
    
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey: "" }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove API key.');
      }

      toast({
        title: "API Key Removed",
        description: `${providers.find(p => p.id === providerId)?.name} API key has been removed.`,
      });
      
      fetchKeyStatus();
    } catch (error) {
      console.error("Error removing API key:", error);
      toast({
        title: "Error",
        description: "Failed to remove API key.",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const toggleShowKey = (providerId: string) => {
    setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const getStatusForProvider = (providerId: string) => {
    return keyStatus.find(status => status.provider === providerId);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
          <CardDescription>
            Manage your LLM provider API keys. Keys are encrypted and stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {providers.map((provider) => {
            const status = getStatusForProvider(provider.id);
            const isLoading = loading[provider.id];
            const isTesting = testing[provider.id];
            
            return (
              <div key={provider.id} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-medium">{provider.name}</Label>
                      {status?.isConfigured && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Configured
                        </Badge>
                      )}
                      {status?.isValid !== undefined && (
                        <Badge variant={status.isValid ? "default" : "destructive"}>
                          {status.isValid ? "Valid" : "Invalid"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{provider.description}</p>
                  </div>
                  
                  {status?.isConfigured && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestKey(provider.id)}
                        disabled={isTesting || isLoading}
                      >
                        {isTesting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            Testing...
                          </>
                        ) : (
                          "Test"
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveKey(provider.id)}
                        disabled={isLoading || isTesting}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>

                {!status?.isConfigured && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKeys[provider.id] ? "text" : "password"}
                          value={apiKeys[provider.id] || ""}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                          placeholder={provider.placeholder}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => toggleShowKey(provider.id)}
                          tabIndex={-1}
                        >
                          {showKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleSaveKey(provider.id)}
                        disabled={isLoading || !apiKeys[provider.id]?.trim()}
                        size="sm"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            Saving...
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {status?.lastTested && (
                  <p className="text-xs text-muted-foreground">
                    Last tested: {status.lastTested.toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}