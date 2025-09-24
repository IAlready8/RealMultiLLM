"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Info, Zap, Clock, DollarSign, CheckCircle } from "lucide-react";
import {
  getAllProviders,
  getProviderModels,
  getProvider,
  calculateCost,
  formatCost,
  getProviderColor,
  ProviderConfig,
  ModelConfig
} from "@/lib/providers";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ProviderSelectorProps {
  selectedProvider?: string;
  selectedModel?: string;
  onProviderChange?: (providerId: string) => void;
  onModelChange?: (modelId: string) => void;
  onSelectionChange?: (providerId: string, modelId: string) => void;
  showModelDetails?: boolean;
  showPricing?: boolean;
  showCapabilities?: boolean;
  compact?: boolean;
  className?: string;
}

export function ProviderSelector({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  onSelectionChange,
  showModelDetails = true,
  showPricing = false,
  showCapabilities = true,
  compact = false,
  className
}: ProviderSelectorProps) {
  const [expandedProvider, setExpandedProvider] = useState<string | null>(selectedProvider || null);
  const providers = getAllProviders();

  const handleProviderSelect = (providerId: string) => {
    if (onProviderChange) {
      onProviderChange(providerId);
    }

    const provider = getProvider(providerId);
    if (provider && onModelChange) {
      onModelChange(provider.defaultModel);
    }

    if (onSelectionChange && provider) {
      onSelectionChange(providerId, provider.defaultModel);
    }

    setExpandedProvider(providerId);
  };

  const handleModelSelect = (modelId: string) => {
    if (onModelChange) {
      onModelChange(modelId);
    }

    if (onSelectionChange && selectedProvider) {
      onSelectionChange(selectedProvider, modelId);
    }
  };

  if (compact) {
    return (
      <div className={cn("flex gap-2", className)}>
        <Select value={selectedProvider} onValueChange={handleProviderSelect}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map(provider => (
              <SelectItem key={provider.id} value={provider.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: provider.color }}
                  />
                  {provider.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedProvider && (
          <Select value={selectedModel} onValueChange={handleModelSelect}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {getProviderModels(selectedProvider).map(model => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <Tabs value="grid" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map(provider => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isSelected={selectedProvider === provider.id}
                selectedModel={selectedProvider === provider.id ? selectedModel : undefined}
                onSelect={() => handleProviderSelect(provider.id)}
                onModelSelect={handleModelSelect}
                showModelDetails={showModelDetails}
                showPricing={showPricing}
                showCapabilities={showCapabilities}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-2">
          {providers.map(provider => (
            <ProviderListItem
              key={provider.id}
              provider={provider}
              isSelected={selectedProvider === provider.id}
              isExpanded={expandedProvider === provider.id}
              selectedModel={selectedProvider === provider.id ? selectedModel : undefined}
              onSelect={() => handleProviderSelect(provider.id)}
              onExpand={() => setExpandedProvider(
                expandedProvider === provider.id ? null : provider.id
              )}
              onModelSelect={handleModelSelect}
              showModelDetails={showModelDetails}
              showPricing={showPricing}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ProviderCardProps {
  provider: ProviderConfig;
  isSelected: boolean;
  selectedModel?: string;
  onSelect: () => void;
  onModelSelect: (modelId: string) => void;
  showModelDetails: boolean;
  showPricing: boolean;
  showCapabilities: boolean;
}

function ProviderCard({
  provider,
  isSelected,
  selectedModel,
  onSelect,
  onModelSelect,
  showModelDetails,
  showPricing,
  showCapabilities
}: ProviderCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: provider.color }}
            />
            <CardTitle className="text-lg">{provider.name}</CardTitle>
          </div>
          {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
        </div>
        <CardDescription>{provider.description}</CardDescription>

        <div className="flex flex-wrap gap-1 mt-2">
          <Badge variant={provider.pricing === 'free' ? 'default' : 'secondary'}>
            {provider.pricing}
          </Badge>
          {showCapabilities && provider.features.slice(0, 2).map(feature => (
            <Badge key={feature} variant="outline" className="text-xs">
              {feature}
            </Badge>
          ))}
        </div>
      </CardHeader>

      {isSelected && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Model</label>
              <Select value={selectedModel} onValueChange={onModelSelect}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {provider.models.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{model.name}</span>
                        {showPricing && model.costPer1KTokens && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ${model.costPer1KTokens.input}/1K
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showModelDetails && selectedModel && (
              <ModelDetails
                model={provider.models.find(m => m.id === selectedModel)}
                showPricing={showPricing}
              />
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface ProviderListItemProps {
  provider: ProviderConfig;
  isSelected: boolean;
  isExpanded: boolean;
  selectedModel?: string;
  onSelect: () => void;
  onExpand: () => void;
  onModelSelect: (modelId: string) => void;
  showModelDetails: boolean;
  showPricing: boolean;
}

function ProviderListItem({
  provider,
  isSelected,
  isExpanded,
  selectedModel,
  onSelect,
  onExpand,
  onModelSelect,
  showModelDetails,
  showPricing
}: ProviderListItemProps) {
  return (
    <Card className={cn("transition-all", isSelected && "ring-2 ring-primary")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={onSelect}
          >
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: provider.color }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{provider.name}</h3>
                {isSelected && <CheckCircle className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-sm text-muted-foreground">{provider.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={provider.pricing === 'free' ? 'default' : 'secondary'}>
              {provider.pricing}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {isSelected && (
              <div>
                <label className="text-sm font-medium">Model</label>
                <Select value={selectedModel} onValueChange={onModelSelect}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {provider.models.map(model => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{model.name}</span>
                          {showPricing && model.costPer1KTokens && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ${model.costPer1KTokens.input}/1K
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Models:</span>
                <div className="text-muted-foreground">{provider.models.length}</div>
              </div>
              <div>
                <span className="font-medium">Features:</span>
                <div className="text-muted-foreground">{provider.features.length}</div>
              </div>
              <div>
                <span className="font-medium">Pricing:</span>
                <div className="text-muted-foreground capitalize">{provider.pricing}</div>
              </div>
              <div>
                <span className="font-medium">Auth:</span>
                <div className="text-muted-foreground">{provider.requiresAuth ? 'Required' : 'Optional'}</div>
              </div>
            </div>

            {showModelDetails && selectedModel && isSelected && (
              <ModelDetails
                model={provider.models.find(m => m.id === selectedModel)}
                showPricing={showPricing}
              />
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface ModelDetailsProps {
  model?: ModelConfig;
  showPricing: boolean;
}

function ModelDetails({ model, showPricing }: ModelDetailsProps) {
  if (!model) return null;

  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
      <h4 className="font-medium text-sm">{model.name}</h4>
      <p className="text-xs text-muted-foreground">{model.description}</p>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="font-medium">Context:</span>
          <div className="text-muted-foreground">
            {model.contextWindow.toLocaleString()} tokens
          </div>
        </div>

        {showPricing && model.costPer1KTokens && (
          <div>
            <span className="font-medium">Cost/1K:</span>
            <div className="text-muted-foreground">
              ${model.costPer1KTokens.input}/${model.costPer1KTokens.output}
            </div>
          </div>
        )}
      </div>

      <div>
        <span className="font-medium text-xs">Capabilities:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {model.capabilities.map(cap => (
            <Badge key={cap} variant="outline" className="text-xs px-1 py-0">
              {cap}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// Cost calculator component
interface CostCalculatorProps {
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
}

export function CostCalculator({ modelId, inputTokens = 1000, outputTokens = 1000 }: CostCalculatorProps) {
  const cost = calculateCost(modelId, inputTokens, outputTokens);

  if (!cost) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            {formatCost(cost)}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Estimated cost for {inputTokens.toLocaleString()} input + {outputTokens.toLocaleString()} output tokens</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}