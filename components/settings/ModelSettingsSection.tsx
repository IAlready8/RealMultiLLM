"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from 'lucide-react';

interface ModelSettingsSectionProps {
  providers: Array<{ id: string; name: string }>;
  modelSettings: Record<string, any>;
  onUpdateModelSetting: (providerId: string, setting: string, value: any) => void;
  onResetToDefaults: () => void;
}

const modelOptions: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  claude: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  google: ["gemini-pro", "gemini-1.5-pro", "gemini-1.5-flash"],
};

export function ModelSettingsSection({ 
  providers, 
  modelSettings, 
  onUpdateModelSetting, 
  onResetToDefaults 
}: ModelSettingsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Model Configuration</h3>
        <Button variant="outline" onClick={onResetToDefaults}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>

      {providers.map((provider) => {
        const settings = modelSettings[provider.id] || {};
        
        return (
          <Card key={provider.id}>
            <CardHeader>
              <CardTitle>{provider.name} Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor={`${provider.id}-model`}>Default Model</Label>
                <Select
                  value={settings.defaultModel || ''}
                  onValueChange={(value) => onUpdateModelSetting(provider.id, 'defaultModel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelOptions[provider.id] || []).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor={`${provider.id}-temperature`}>
                  Temperature: {settings.temperature?.toFixed(2) || '0.70'}
                </Label>
                <Slider
                  id={`${provider.id}-temperature`}
                  min={0}
                  max={2}
                  step={0.01}
                  value={[settings.temperature || 0.7]}
                  onValueChange={([value]) => onUpdateModelSetting(provider.id, 'temperature', value)}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>More focused</span>
                  <span>More creative</span>
                </div>
              </div>

              <div>
                <Label htmlFor={`${provider.id}-tokens`}>
                  Max Tokens: {settings.maxTokens || 2048}
                </Label>
                <Slider
                  id={`${provider.id}-tokens`}
                  min={100}
                  max={8192}
                  step={100}
                  value={[settings.maxTokens || 2048]}
                  onValueChange={([value]) => onUpdateModelSetting(provider.id, 'maxTokens', value)}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>100</span>
                  <span>8192</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}