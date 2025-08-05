"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EyeIcon, EyeOffIcon, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { 
  storeApiKey, 
  getStoredApiKey,
  clearAllApiKeys,
  validateApiKeyFormat
} from "@/lib/secure-storage";

// LLM providers
const providers = [
  { id: "openai", name: "OpenAI", placeholder: "sk-..." },
  { id: "claude", name: "Claude", placeholder: "sk-ant-..." },
  { id: "google", name: "Google AI", placeholder: "AIza..." },
  { id: "llama", name: "Llama", placeholder: "Your Llama API key" },
  { id: "github", name: "GitHub", placeholder: "github_pat_..." },
  { id: "grok", name: "Grok", placeholder: "xai-..." },
];

export default function ApiKeyForm() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [keyStatus, setKeyStatus] = useState<Record<string, 'valid' | 'invalid' | 'untested'>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Load saved API keys on mount
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const keys: Record<string, string> = {};
        const statuses: Record<string, 'valid' | 'invalid' | 'untested'> = {};
        const visibilities: Record<string, boolean> = {};
        
        // Initialize loading state for each provider
        const initialLoading: Record<string, boolean> = {};
        providers.forEach(provider => {
          initialLoading[provider.id] = false;
          visibilities[provider.id] = false;
        });
        
        setLoading(initialLoading);
        
        // Load each API key
        for (const provider of providers) {
          const key = await getStoredApiKey(provider.id);
          keys[provider.id] = key || "";
          statuses[provider.id] = key ? 'valid' : 'untested';
        }
        
        setApiKeys(keys);
        setKeyStatus(statuses);
        setShowPassword(visibilities);
      } catch (error) {
        console.error("Error loading API keys:", error);
        toast({
          title: "Error",
          description: "Failed to load saved API keys",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadApiKeys();
  }, [toast]);
  
  // Save an individual API key
  const handleSaveKey = async (providerId: string) => {
    try {
      const apiKey = apiKeys[providerId];
      
      // Validate key format
      if (!validateApiKeyFormat(providerId, apiKey)) {
        toast({
          title: "Error",
          description: `Invalid ${providers.find(p => p.id === providerId)?.name} API key format`,
          variant: "destructive",
        });
        setKeyStatus({...keyStatus, [providerId]: 'invalid'});
        return;
      }
      
      setLoading({...loading, [providerId]: true});
      
      // Store the key
      await storeApiKey(providerId, apiKey);
      
      // Test the key (optional)
      // Note: In a real implementation, you might want to make a lightweight API call
      // to verify the key is valid. This is simplified here.
      
      setKeyStatus({...keyStatus, [providerId]: 'valid'});
      
      toast({
        title: "Success",
        description: `API key for ${providers.find(p => p.id === providerId)?.name} saved successfully`,
      });
    } catch (error) {
      console.error(`Error saving ${providerId} API key:`, error);
      toast({
        title: "Error",
        description: `Failed to save API key for ${providers.find(p => p.id === providerId)?.name}`,
        variant: "destructive",
      });
      setKeyStatus({...keyStatus, [providerId]: 'invalid'});
    } finally {
      setLoading({...loading, [providerId]: false});
    }
  };
  
  // Clear all API keys
  const handleClearAll = async () => {
    try {
      await clearAllApiKeys();
      
      // Reset states
      const emptyKeys: Record<string, string> = {};
      const resetStatus: Record<string, 'valid' | 'invalid' | 'untested'> = {};
      
      providers.forEach(provider => {
        emptyKeys[provider.id] = "";
        resetStatus[provider.id] = 'untested';
      });
      
      setApiKeys(emptyKeys);
      setKeyStatus(resetStatus);
      
      toast({
        title: "Success",
        description: "All API keys cleared",
      });
    } catch (error) {
      console.error("Error clearing API keys:", error);
      toast({
        title: "Error",
        description: "Failed to clear API keys",
        variant: "destructive",
      });
    }
  };
  
  // Toggle password visibility
  const togglePasswordVisibility = (providerId: string) => {
    setShowPassword({
      ...showPassword,
      [providerId]: !showPassword[providerId],
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Tabs defaultValue="keys" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="test">Test Keys</TabsTrigger>
        </TabsList>
        
        <TabsContent value="keys">
          <div className="space-y-4">
            {providers.map((provider) => (
              <Card key={provider.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`key-${provider.id}`}>{provider.name} API Key</Label>
                    <div className="flex">
                      <div className="relative flex-grow">
                        <Input
                          id={`key-${provider.id}`}
                          type={showPassword[provider.id] ? "text" : "password"}
                          placeholder={provider.placeholder}
                          value={apiKeys[provider.id] || ""}
                          onChange={(e) => setApiKeys({...apiKeys, [provider.id]: e.target.value})}
                          className="bg-gray-800 border-gray-700 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                          onClick={() => togglePasswordVisibility(provider.id)}
                          aria-label="Toggle visibility"
                        >
                          {showPassword[provider.id] ? (
                            <EyeOffIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleSaveKey(provider.id)}
                        disabled={loading[provider.id] || !apiKeys[provider.id]}
                        className="ml-2"
                      >
                        {loading[provider.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Status indicators */}
                  <div className="text-sm">
                    {keyStatus[provider.id] === 'valid' ? (
                      <div className="flex items-center text-green-500">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span>API key is configured</span>
                      </div>
                    ) : keyStatus[provider.id] === 'invalid' ? (
                      <div className="flex items-center text-red-500">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <span>Invalid API key</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-500">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <span>No API key configured</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <div className="flex justify-end mt-6">
              <Button variant="destructive" onClick={handleClearAll}>
                Clear All Keys
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="test">
          <Alert className="bg-gray-800 border-gray-700 mb-4">
            <AlertDescription>
              Test your API keys to verify they are working correctly with each provider.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            {providers.map((provider) => (
              <Card key={provider.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>{provider.name}</Label>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Test API key logic would go here
                        toast({
                          title: "API Test",
                          description: `Testing ${provider.name} API key...`,
                        });
                      }}
                      disabled={!apiKeys[provider.id]}
                    >
                      Test Key
                    </Button>
                  </div>
                  
                  <div className="text-sm">
                    {!apiKeys[provider.id] ? (
                      <div className="text-yellow-500">No API key configured</div>
                    ) : (
                      <div className="text-gray-400">Click &quot;Test Key&quot; to verify your API key</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
