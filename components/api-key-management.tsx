// components/api-key-management.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  Key, 
  Plus, 
  TestTube, 
  Trash2, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Shield, 
  Clock,
  TrendingUp
} from 'lucide-react';
import { encryptApiKey } from '@/lib/encryption';
import { testProviderConnection } from '@/lib/provider-tests';
import { ApiKeyUsageChart } from './api-key-usage-chart';

interface ApiKey {
  id: string;
  provider: string;
  encryptedKey: string;
  keyName?: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  monthlyUsage: number;
  costTracking: {
    totalCost: number;
    monthlyCost: number;
    requestCount: number;
  };
}

interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  baseUrl: string;
  testEndpoint: string;
  keyPattern: RegExp;
  documentation: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    color: 'bg-green-500',
    baseUrl: 'https://api.openai.com',
    testEndpoint: '/v1/models',
    keyPattern: /^sk-[A-Za-z0-9]{48}$/,
    documentation: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    color: 'bg-purple-500',
    baseUrl: 'https://api.anthropic.com',
    testEndpoint: '/v1/messages',
    keyPattern: /^sk-ant-api03-[A-Za-z0-9_-]{95}$/,
    documentation: 'https://console.anthropic.com/'
  },
  {
    id: 'google',
    name: 'Google AI',
    icon: '🔍',
    color: 'bg-blue-500',
    baseUrl: 'https://generativelanguage.googleapis.com',
    testEndpoint: '/v1/models',
    keyPattern: /^[A-Za-z0-9_-]{39}$/,
    documentation: 'https://makersuite.google.com/app/apikey'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🔀',
    color: 'bg-orange-500',
    baseUrl: 'https://openrouter.ai/api',
    testEndpoint: '/v1/models',
    keyPattern: /^sk-or-v1-[A-Za-z0-9]{48}$/,
    documentation: 'https://openrouter.ai/keys'
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: '🚀',
    color: 'bg-black',
    baseUrl: 'https://api.x.ai',
    testEndpoint: '/v1/models',
    keyPattern: /^[A-Za-z0-9_-]{48}$/,
    documentation: 'https://console.x.ai/'
  }
];

export function ApiKeyManagement() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState('');
  const [keyName, setKeyName] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [isLoading, setIsLoading] = useState(false);
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('keys');
  const [usageData, setUsageData] = useState<any>(null);

  useEffect(() => {
    fetchApiKeys();
    fetchUsageData();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys');
      if (response.ok) {
        const keys = await response.json();
        setApiKeys(keys);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error('Failed to fetch API keys');
    }
  };

  const fetchUsageData = async () => {
    try {
      const response = await fetch('/api/api-keys/usage');
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    }
  };

  const validateApiKey = (key: string, provider: string): boolean => {
    const providerConfig = PROVIDERS.find(p => p.id === provider);
    return providerConfig ? providerConfig.keyPattern.test(key) : false;
  };

  const handleAddKey = async () => {
    if (!newKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    if (!validateApiKey(newKey, selectedProvider)) {
      toast.error(`Invalid ${selectedProvider} API key format`);
      return;
    }

    setIsLoading(true);
    try {
      // Test the key before saving
      const isValid = await testProviderConnection(selectedProvider, newKey);
      if (!isValid) {
        toast.error('API key validation failed. Please check your key.');
        return;
      }

      // Encrypt the key client-side
      const encryptedKey = await encryptApiKey(newKey);
      
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          encryptedKey,
          keyName: keyName || `${selectedProvider} Key`
        })
      });

      if (response.ok) {
        toast.success('API key added and validated successfully');
        setNewKey('');
        setKeyName('');
        fetchApiKeys();
      } else {
        throw new Error('Failed to save API key');
      }
    } catch (error) {
      toast.error('Failed to add API key');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestKey = async (keyId: string) => {
    setTestingKeys(prev => new Set(prev).add(keyId));
    try {
      const response = await fetch(`/api/api-keys/test/${keyId}`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('API key test successful');
        fetchApiKeys(); // Refresh to update last used
      } else {
        throw new Error('API key test failed');
      }
    } catch (error) {
      toast.error('API key test failed');
      console.error(error);
    } finally {
      setTestingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(keyId);
        return newSet;
      });
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('API key deleted successfully');
        fetchApiKeys();
      } else {
        throw new Error('Failed to delete API key');
      }
    } catch (error) {
      toast.error('Failed to delete API key');
      console.error(error);
    }
  };

  const handleToggleKey = async (keyId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/api-keys/${keyId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (response.ok) {
        toast.success(`API key ${!isActive ? 'activated' : 'deactivated'}`);
        fetchApiKeys();
      } else {
        throw new Error('Failed to toggle API key');
      }
    } catch (error) {
      toast.error('Failed to toggle API key');
      console.error(error);
    }
  };

  const handleRotateKey = async (keyId: string) => {
    const newKeyValue = prompt('Enter the new API key:');
    if (!newKeyValue) return;

    try {
      const encryptedKey = await encryptApiKey(newKeyValue);
      const response = await fetch(`/api/api-keys/${keyId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedKey })
      });

      if (response.ok) {
        toast.success('API key rotated successfully');
        fetchApiKeys();
      } else {
        throw new Error('Failed to rotate API key');
      }
    } catch (error) {
      toast.error('Failed to rotate API key');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">API Key Management</h2>
          <p className="text-muted-foreground">
            Manage your LLM provider API keys with enterprise-grade security
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <Shield className="w-4 h-4 mr-1" />
          AES-256 Encrypted
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-6">
          {/* Add New Key Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add New API Key
              </CardTitle>
              <CardDescription>
                Add a new API key for your LLM provider. Keys are encrypted client-side before storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Provider</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PROVIDERS.map(provider => (
                      <Button
                        key={provider.id}
                        variant={selectedProvider === provider.id ? "default" : "outline"}
                        onClick={() => setSelectedProvider(provider.id)}
                        className="justify-start"
                      >
                        <span className="mr-2">{provider.icon}</span>
                        {provider.name}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Key Name (Optional)</label>
                  <Input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g., Production OpenAI Key"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">API Key</label>
                <Input
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={`Enter your ${PROVIDERS.find(p => p.id === selectedProvider)?.name} API key`}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: {PROVIDERS.find(p => p.id === selectedProvider)?.keyPattern.source}
                </p>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your API key will be encrypted client-side using AES-256-GCM before transmission and storage.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleAddKey} 
                disabled={isLoading || !newKey.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Adding & Validating...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Add API Key
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Keys */}
          <Card>
            <CardHeader>
              <CardTitle>Saved API Keys</CardTitle>
              <CardDescription>
                Manage your existing API keys. Test them to verify connectivity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No API keys saved yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Add your first API key to start using the platform.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeys.map((key) => {
                    const provider = PROVIDERS.find(p => p.id === key.provider);
                    const isShowingKey = showKeys.has(key.id);
                    const isTesting = testingKeys.has(key.id);
                    
                    return (
                      <div key={key.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${provider?.color} flex items-center justify-center text-white font-bold`}>
                              {provider?.icon}
                            </div>
                            <div>
                              <h3 className="font-semibold">{key.keyName}</h3>
                              <p className="text-sm text-muted-foreground">
                                {provider?.name} • Added {new Date(key.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={key.isActive ? "default" : "secondary"}>
                              {key.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {key.lastUsed && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                Used {new Date(key.lastUsed).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Input
                              type={isShowingKey ? "text" : "password"}
                              value={isShowingKey ? "••••••••••••••••••••••••••••••••" : "••••••••••••••••••••••••••••••••"}
                              readOnly
                              className="font-mono text-sm w-64"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowKeys(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(key.id)) {
                                    newSet.delete(key.id);
                                  } else {
                                    newSet.add(key.id);
                                  }
                                  return newSet;
                                });
                              }}
                            >
                              {isShowingKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestKey(key.id)}
                              disabled={isTesting}
                            >
                              {isTesting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <TestTube className="w-4 h-4" />
                              )}
                              Test
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleKey(key.id, key.isActive)}
                            >
                              {key.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Rotate API Key</DialogTitle>
                                  <DialogDescription>
                                    Replace the current API key with a new one. This will update the key used for all requests.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Input
                                    type="password"
                                    placeholder="Enter new API key"
                                    id="new-key-input"
                                  />
                                  <Button
                                    onClick={() => {
                                      const input = document.getElementById('new-key-input') as HTMLInputElement;
                                      if (input.value) {
                                        handleRotateKey(key.id);
                                      }
                                    }}
                                    className="w-full"
                                  >
                                    Rotate Key
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteKey(key.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Usage Stats */}
                        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                          <div className="text-center">
                            <p className="text-2xl font-bold">{key.usageCount}</p>
                            <p className="text-xs text-muted-foreground">Total Requests</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">{key.monthlyUsage}</p>
                            <p className="text-xs text-muted-foreground">Monthly Requests</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">${key.costTracking.monthlyCost.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Monthly Cost</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
              <CardDescription>
                Monitor your API key usage and costs across all providers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageData ? (
                <ApiKeyUsageChart data={usageData} />
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No usage data available yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage security settings for your API keys.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  All API keys are encrypted using AES-256-GCM encryption with a master key that is never stored in plain text.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Automatic Key Rotation</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically rotate API keys every 90 days
                    </p>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Access Logs</h4>
                    <p className="text-sm text-muted-foreground">
                      View detailed access logs for all API keys
                    </p>
                  </div>
                  <Button variant="outline">View Logs</Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">IP Whitelisting</h4>
                    <p className="text-sm text-muted-foreground">
                      Restrict API key usage to specific IP addresses
                    </p>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}