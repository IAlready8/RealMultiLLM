"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, Clock, Play } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface ApiKeySectionProps {
  providers: Array<{ id: string; name: string }>;
  apiKeys: Record<string, string>;
  testingStatus: Record<string, 'idle' | 'testing' | 'success' | 'error'>;
  onSaveApiKey: (providerId: string, key: string) => Promise<void>;
  onTestApiKey: (providerId: string) => Promise<void>;
  onRemoveApiKey: (providerId: string) => Promise<void>;
}

export function ApiKeySection({ 
  providers, 
  apiKeys, 
  testingStatus, 
  onSaveApiKey, 
  onTestApiKey, 
  onRemoveApiKey 
}: ApiKeySectionProps) {
  const { toast } = useToast();
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({});

  const handleKeyChange = (providerId: string, value: string) => {
    setTempKeys(prev => ({ ...prev, [providerId]: value }));
  };

  const handleSave = async (providerId: string) => {
    const key = tempKeys[providerId] || apiKeys[providerId] || '';
    if (!key.trim()) {
      toast({
        title: "Error",
        description: "API key cannot be empty",
        variant: "destructive",
      });
      return;
    }
    await onSaveApiKey(providerId, key);
  };

  const getStatusIcon = (status: 'idle' | 'testing' | 'success' | 'error') => {
    switch (status) {
      case 'testing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {providers.map((provider) => (
        <Card key={provider.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{provider.name} API Key</span>
              <div className="flex items-center space-x-2">
                {getStatusIcon(testingStatus[provider.id] || 'idle')}
                {apiKeys[provider.id] && (
                  <span className="text-sm text-green-600">Configured</span>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor={`${provider.id}-key`}>API Key</Label>
              <Input
                id={`${provider.id}-key`}
                type="password"
                placeholder={`Enter your ${provider.name} API key`}
                value={tempKeys[provider.id] || apiKeys[provider.id] || ''}
                onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={() => handleSave(provider.id)}
                disabled={testingStatus[provider.id] === 'testing'}
              >
                Save Key
              </Button>
              <Button 
                variant="outline"
                onClick={() => onTestApiKey(provider.id)}
                disabled={!apiKeys[provider.id] || testingStatus[provider.id] === 'testing'}
              >
                <Play className="h-4 w-4 mr-2" />
                Test
              </Button>
              {apiKeys[provider.id] && (
                <Button 
                  variant="destructive" 
                  onClick={() => onRemoveApiKey(provider.id)}
                >
                  Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}