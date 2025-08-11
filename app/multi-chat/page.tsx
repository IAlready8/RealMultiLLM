"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ApiKeyForm from "@/components/api-key-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveGrid } from "@/components/responsive-grid";
import { ConversationManager } from "@/components/conversation-manager";
import { ExportImportDialog } from "@/components/export-import-dialog";
// import { sendChatMessage } from "@/services/api-service"; // Removed direct import
import { exportAllData, importAllData } from "@/services/export-import-service";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast"; // Import useToast
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

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

// LLM providers we'll support (only those implemented in llm-api-client)
const providers = [
  { id: "openai", name: "OpenAI" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
];

export default function MultiChat() {
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [selectedProviders, setSelectedProviders] = useState<Record<string, boolean>>({});
  const [modelSettings, setModelSettings] = useState<Record<string, any>>({});
  const [showSettings, setShowSettings] = useState<Record<string, boolean>>({});
  const { toast } = useToast(); // Initialize toast

  // Initialize messages and loading state for each provider
  useEffect(() => {
    const initialMessages: Record<string, any[]> = {};
    const initialLoading: Record<string, boolean> = {};
    const initialSelected: Record<string, boolean> = {};
    const initialShowSettings: Record<string, boolean> = {};
    
    providers.forEach(provider => {
      initialMessages[provider.id] = [];
      initialLoading[provider.id] = false;
      initialSelected[provider.id] = true; // Select all by default
      initialShowSettings[provider.id] = false;
    });
    
    setMessages(initialMessages);
    setLoading(initialLoading);
    setSelectedProviders(initialSelected);
    setShowSettings(initialShowSettings);
    
    // Load model settings from localStorage
    const savedSettings = localStorage.getItem("modelSettings");
    if (savedSettings) {
      try {
        setModelSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load model settings:", e);
      }
    } else {
      // Initialize with default settings if none exist
      const defaultSettings: Record<string, any> = {};
      providers.forEach(provider => {
        defaultSettings[provider.id] = {
          temperature: 0.7,
          maxTokens: 2048,
          defaultModel: getDefaultModelForProvider(provider.id)
        };
      });
      setModelSettings(defaultSettings);
      localStorage.setItem("modelSettings", JSON.stringify(defaultSettings));
    }
  }, []);

  const handleSendToSelected = async () => {
    if (!prompt.trim()) return;
    
    // Add user message to selected chats
    const updatedMessages = { ...messages };
    Object.entries(selectedProviders).forEach(([providerId, isSelected]) => {
      if (isSelected) {
        updatedMessages[providerId] = [
          ...updatedMessages[providerId],
          { role: "user", content: prompt, timestamp: Date.now() }
        ];
      }
    });
    setMessages(updatedMessages);
    
    // Set loading state for selected providers
    const updatedLoading = { ...loading };
    Object.entries(selectedProviders).forEach(([providerId, isSelected]) => {
      if (isSelected) {
        updatedLoading[providerId] = true;
      }
    });
    setLoading(updatedLoading);

    // Send prompt to each selected provider
    for (const [providerId, isSelected] of Object.entries(selectedProviders)) {
      if (!isSelected) continue;
      
      try {
        // Get model settings for this provider
        const providerSettings = modelSettings[providerId] || {};
        
        // Call the API route
        const response = await fetch("/api/llm/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: providerId,
            messages: messages[providerId],
            options: {
              temperature: providerSettings.temperature || 0.7,
              maxTokens: providerSettings.maxTokens || 2048,
              model: providerSettings.defaultModel || getDefaultModelForProvider(providerId)
            }
          }),
        });

        if (!response.ok) {
          let errorMessage = `API request failed with status ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            // If we can't parse the error response, use the status text
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        let chatResponse;
        try {
          chatResponse = await response.json();
        } catch (e) {
          throw new Error("Failed to parse response from API");
        }

        // Update with response
        setMessages(prev => ({
          ...prev,
          [providerId]: [
            ...prev[providerId],
            {
              ...chatResponse,
              provider: providerId // Add provider info to the response
            }
          ],
        }));
      } catch (error: any) {
        // Handle error and display toast
        const errorMessage = error.message || "Could not get response";
        setMessages(prev => ({
          ...prev,
          [providerId]: [
            ...prev[providerId],
            {
              role: "assistant",
              content: `Error: ${errorMessage}`,
              timestamp: Date.now(),
              metadata: { error: true }
            },
          ],
        }));
        toast({
          title: `Error from ${providers.find(p => p.id === providerId)?.name}`,
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        // Set loading to false
        setLoading(prev => ({
          ...prev,
          [providerId]: false,
        }));
      }
    }
    
    // Clear the prompt input
    setPrompt("");
  };

  const toggleProvider = (providerId: string) => {
    setSelectedProviders(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const toggleSettings = (providerId: string) => {
    setShowSettings(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const updateModelSetting = (providerId: string, setting: string, value: any) => {
    const updatedSettings = {
      ...modelSettings,
      [providerId]: {
        ...modelSettings[providerId],
        [setting]: value
      }
    };
    
    setModelSettings(updatedSettings);
    localStorage.setItem("modelSettings", JSON.stringify(updatedSettings));
  };

  const getProviderModels = (providerId: string) => {
    switch (providerId) {
      case "openai":
        return [
          { value: "gpt-4o", label: "GPT-4o" },
          { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
          { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
        ];
      case "claude":
        return [
          { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
          { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
          { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" }
        ];
      case "google":
        return [
          { value: "gemini-pro", label: "Gemini Pro" },
          { value: "gemini-ultra", label: "Gemini Ultra" }
        ];
      default:
        return [
          { value: "default", label: "Default" }
        ];
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Multi-Chat Panel</h1>
        <div className="flex flex-wrap gap-2">
          <ConversationManager 
            type="multi-chat"
            data={{ messages }}
            onLoad={(data) => setMessages(data.messages)}
          />
          
          <ExportImportDialog
            onExport={exportAllData}
            onImport={importAllData}
          />
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Configure API Keys</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle>API Keys Configuration</DialogTitle>
              </DialogHeader>
              <ApiKeyForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => (
              <Button
                key={provider.id}
                variant={selectedProviders[provider.id] ? "default" : "outline"}
                size="sm"
                onClick={() => toggleProvider(provider.id)}
                className="flex items-center"
              >
                <span className="mr-2">{provider.name}</span>
                <span className={`w-2 h-2 rounded-full ${selectedProviders[provider.id] ? 'bg-green-500' : 'bg-gray-500'}`}></span>
              </Button>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Input
            className="flex-1 bg-gray-800 border-gray-700"
            placeholder="Enter your message to send to selected models..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendToSelected();
              }
            }}
          />
          <Button 
            onClick={handleSendToSelected}
            disabled={!Object.values(selectedProviders).some(selected => selected)}
          >
            Send to Selected
          </Button>
        </div>
      </div>

      <Tabs defaultValue="grid" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="tabs">Tab View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="grid">
          <ResponsiveGrid cols={{ default: 1, md: 2 }}>
            {providers
              .filter(provider => selectedProviders[provider.id])
              .map((provider) => (
                <ChatBox
                  key={provider.id}
                  provider={provider}
                  messages={messages[provider.id] || []}
                  loading={loading[provider.id] || false}
                  modelSettings={modelSettings[provider.id] || {}}
                  showSettings={showSettings[provider.id] || false}
                  onToggleSettings={() => toggleSettings(provider.id)}
                  onUpdateModelSetting={(setting, value) => updateModelSetting(provider.id, setting, value)}
                  getProviderModels={() => getProviderModels(provider.id)}
                />
              ))}
          </ResponsiveGrid>
        </TabsContent>
        
        <TabsContent value="tabs">
          <Tabs defaultValue={providers.find(p => selectedProviders[p.id])?.id || providers[0].id} className="w-full">
            <TabsList className="mb-4 flex overflow-x-auto">
              {providers
                .filter(provider => selectedProviders[provider.id])
                .map((provider) => (
                  <TabsTrigger key={provider.id} value={provider.id}>
                    {provider.name}
                  </TabsTrigger>
                ))}
            </TabsList>
            
            {providers
              .filter(provider => selectedProviders[provider.id])
              .map((provider) => (
                <TabsContent key={provider.id} value={provider.id}>
                  <ChatBox
                    provider={provider}
                    messages={messages[provider.id] || []}
                    loading={loading[provider.id] || false}
                    fullHeight
                    modelSettings={modelSettings[provider.id] || {}}
                    showSettings={showSettings[provider.id] || false}
                    onToggleSettings={() => toggleSettings(provider.id)}
                    onUpdateModelSetting={(setting, value) => updateModelSetting(provider.id, setting, value)}
                    getProviderModels={() => getProviderModels(provider.id)}
                  />
                </TabsContent>
              ))}
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChatBox({ 
  provider, 
  messages, 
  loading,
  fullHeight = false,
  modelSettings = {},
  showSettings = false,
  onToggleSettings,
  onUpdateModelSetting,
  getProviderModels
}: { 
  provider: { id: string; name: string }; 
  messages: any[];
  loading: boolean;
  fullHeight?: boolean;
  modelSettings?: any;
  showSettings?: boolean;
  onToggleSettings?: () => void;
  onUpdateModelSetting?: (setting: string, value: any) => void;
  getProviderModels?: () => { value: string; label: string }[];
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${fullHeight ? 'h-[70vh]' : 'h-[40vh]'}`}>
      <CardHeader className="px-4 py-2 border-b border-gray-800">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center">
            {provider.name}
            {onToggleSettings && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 w-6 p-0"
                onClick={onToggleSettings}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </div>
        
        {showSettings && onToggleSettings && onUpdateModelSetting && getProviderModels && (
          <div className="mt-2 p-2 bg-gray-800 rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Model</Label>
                <Select
                  value={modelSettings.defaultModel || "default"}
                  onValueChange={(value) => onUpdateModelSetting("defaultModel", value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getProviderModels().map((model) => (
                      <SelectItem key={model.value} value={model.value} className="text-xs">
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs">Temperature: {modelSettings.temperature ?? 0.7}</Label>
                <Input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={modelSettings.temperature ?? 0.7}
                  onChange={(e) => onUpdateModelSetting("temperature", parseFloat(e.target.value))}
                  className="h-2"
                />
              </div>
              
              <div>
                <Label className="text-xs">Max Tokens: {modelSettings.maxTokens ?? 2048}</Label>
                <Input
                  type="range"
                  min="256"
                  max="4096"
                  step="256"
                  value={modelSettings.maxTokens ?? 2048}
                  onChange={(e) => onUpdateModelSetting("maxTokens", parseInt(e.target.value))}
                  className="h-2"
                />
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-4 overflow-y-auto h-full">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center mt-10">
            <p>No messages yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-900 ml-6"
                    : message.metadata?.error 
                      ? "bg-red-900/30 border border-red-800 mr-6"
                      : "bg-gray-800 mr-6"
                }`}
              >
                {message.content}
                {message.role === "assistant" && message.provider && (
                  <div className="mt-1 text-xs text-gray-500">
                    Response from: {providers.find(p => p.id === message.provider)?.name || message.provider}
                  </div>
                )}
                {message.metadata && !message.metadata.error && (
                  <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-2">
                    {message.metadata.promptTokens && (
                      <span>Prompt tokens: {message.metadata.promptTokens}</span>
                    )}
                    {message.metadata.completionTokens && (
                      <span>Completion tokens: {message.metadata.completionTokens}</span>
                    )}
                    {message.metadata.totalTokens && (
                      <span>Total tokens: {message.metadata.totalTokens}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="p-3 rounded-lg bg-gray-800 mr-6">
                <div className="flex space-x-2 items-center">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
