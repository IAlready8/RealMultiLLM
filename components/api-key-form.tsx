"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";

const providers = [
  { id: "openai", name: "OpenAI", placeholder: "sk-..." },
  { id: "openrouter", name: "OpenRouter", placeholder: "sk-or-v1-..." },
  { id: "claude", name: "Claude", placeholder: "sk-ant-..." },
  { id: "google", name: "Google AI", placeholder: "AIza..." },
  { id: "llama", name: "Llama", placeholder: "llama_..." },
  { id: "github", name: "GitHub", placeholder: "gho_..." },
  { id: "grok", name: "Grok", placeholder: "xai-..." },
];

export default function ApiKeyForm() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = () => {
    const savedKeys: Record<string, string> = {};
    providers.forEach(provider => {
      const encryptedKey = localStorage.getItem(`apiKey_${provider.id}`);
      if (encryptedKey) {
        try {
          savedKeys[provider.id] = decryptApiKey(encryptedKey);
        } catch (error) {
          console.error(`Failed to decrypt API key for ${provider.id}:`, error);
        }
      }
    });
    setApiKeys(savedKeys);
  };

  const handleSaveKey = async (providerId: string) => {
    const apiKey = apiKeys[providerId];
    if (!apiKey) {
      toast({
        title: "No API Key",
        description: "Please enter an API key before saving.",
        variant: "destructive",
      });
      return;
    }

    setLoading(prev => ({ ...prev, [providerId]: true }));
    try {
      // First test the API key
      const testResponse = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: providerId,
          apiKey: apiKey,
        }),
      });

      const testResult = await testResponse.json();
      
      if (!testResult.valid) {
        toast({
          title: "Invalid API Key",
          description: testResult.message || "API key test failed",
          variant: "destructive",
        });
        return;
      }

      // If test passes, encrypt and save to localStorage
      const encryptedKey = encryptApiKey(apiKey);
      localStorage.setItem(`apiKey_${providerId}`, encryptedKey);
      
      toast({
        title: "Success",
        description: `API key for ${providers.find(p => p.id === providerId)?.name} saved and tested successfully ✓`,
      });
    } catch (error) {
      console.error("Error saving/testing API key:", error);
      toast({
        title: "Error",
        description: "Failed to save or test API key",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTestKey = async (providerId: string) => {
    const apiKey = apiKeys[providerId];
    if (!apiKey) {
      toast({
        title: "No API Key",
        description: "Please enter an API key before testing.",
        variant: "destructive",
      });
      return;
    }

    setLoading(prev => ({ ...prev, [providerId]: true }));
    try {
      // Test the API key with real API call
      const testResponse = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: providerId,
          apiKey: apiKey,
        }),
      });

      const testResult = await testResponse.json();
      const provider = providers.find(p => p.id === providerId);
      
      if (testResult.valid) {
        toast({
          title: "API Key Valid ✓",
          description: `${provider?.name} API key is working correctly`,
        });
      } else {
        toast({
          title: "API Key Invalid",
          description: testResult.message || `${provider?.name} API key test failed`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error testing API key:", error);
      toast({
        title: "Error Testing API Key",
        description: "Failed to test API key - check your connection",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const clearApiKey = (providerId: string) => {
    localStorage.removeItem(`apiKey_${providerId}`);
    setApiKeys(prev => ({ ...prev, [providerId]: "" }));
    toast({
      title: "API Key Cleared",
      description: `${providers.find(p => p.id === providerId)?.name} API key has been removed`,
    });
  };

  const toggleShowKey = (providerId: string) => {
    setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const saveAllKeys = async () => {
    setLoading(prev => ({ ...prev, all: true }));
    
    try {
      const keysToSave = providers.filter(provider => apiKeys[provider.id]);
      let validCount = 0;
      let invalidCount = 0;
      
      for (const provider of keysToSave) {
        try {
          // Test each API key
          const testResponse = await fetch('/api/test-api-key', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: provider.id,
              apiKey: apiKeys[provider.id],
            }),
          });

          const testResult = await testResponse.json();
          
          if (testResult.valid) {
            // Save if valid
            const encryptedKey = encryptApiKey(apiKeys[provider.id]);
            localStorage.setItem(`apiKey_${provider.id}`, encryptedKey);
            validCount++;
          } else {
            invalidCount++;
          }
        } catch (error) {
          console.error(`Error testing ${provider.id}:`, error);
          invalidCount++;
        }
      }
      
      if (invalidCount === 0) {
        toast({
          title: "Success",
          description: `All ${validCount} API keys saved and tested successfully ✓`,
        });
      } else {
        toast({
          title: "Partial Success",
          description: `${validCount} keys saved, ${invalidCount} keys failed validation`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save API keys",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, all: false }));
    }
  };

  const clearAllKeys = () => {
    providers.forEach(provider => {
      localStorage.removeItem(`apiKey_${provider.id}`);
    });
    setApiKeys({});
    toast({
      title: "Success",
      description: "All API keys cleared",
    });
  };

  return (
    <div className="space-y-6">
      {providers.map((provider) => (
        <div key={provider.id}>
          <Label htmlFor={`${provider.id}-api-key`}>{provider.name} API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id={`${provider.id}-api-key`}
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
                {showKeys[provider.id] ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="sr-only">
                  {showKeys[provider.id] ? "Hide" : "Show"} API key
                </span>
              </Button>
            </div>
            <Button 
              onClick={() => handleSaveKey(provider.id)} 
              disabled={loading[provider.id] || !apiKeys[provider.id]}
              size="sm"
            >
              {loading[provider.id] ? "Testing..." : "Save"}
            </Button>
            <Button 
              onClick={() => handleTestKey(provider.id)} 
              disabled={loading[provider.id] || !apiKeys[provider.id]}
              variant="outline"
              size="sm"
            >
              Test
            </Button>
            <Button 
              onClick={() => clearApiKey(provider.id)} 
              disabled={loading[provider.id] || !apiKeys[provider.id]}
              variant="destructive"
              size="sm"
            >
              Clear
            </Button>
          </div>
        </div>
      ))}
      
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={saveAllKeys} disabled={loading.all}>
          {loading.all ? "Testing & Saving..." : "Save All API Keys"}
        </Button>
        <Button onClick={clearAllKeys} variant="outline">Clear All</Button>
      </div>
    </div>
  );
}
