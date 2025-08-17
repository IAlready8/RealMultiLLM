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
import { logger } from "@/lib/logger";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Settings, Plus, X } from "lucide-react";

// Helper function to get default model for each provider
function getDefaultModelForProvider(providerId: string): string {
  switch (providerId) {
    case "openai":
      return "gpt-4o";
    case "claude":
      return "claude-3-opus-20240229";
    case "google":
      return "gemini-pro";
    case "groq":
      return "llama3-8b-8192";
    case "ollama":
      return "llama3";
    default:
      return "default";
  }
}

interface Provider {
  id: string;
  name: string;
  models: string[];
  enabled: boolean;
}

interface ChatBox {
  id: string;
  providerId: string;
  provider: Provider;
}

export default function MultiChat() {
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([]);
  const [chatBoxes, setChatBoxes] = useState<ChatBox[]>([]);
  const [messages, setMessages] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [modelSettings, setModelSettings] = useState<Record<string, any>>({});
  const [showSettings, setShowSettings] = useState<Record<string, boolean>>({});
  const { toast } = useToast(); // Initialize toast

  // Fetch available providers and initialize chat boxes
  useEffect(() => {
    async function loadProviders() {
      try {
        const response = await fetch('/api/llm/models');
        if (response.ok) {
          const providers = await response.json();
          setAvailableProviders(providers);
          
          // Initialize with first two providers by default
          const initialBoxes: ChatBox[] = providers.slice(0, 2).map((provider: Provider, index: number) => ({
            id: `box-${Date.now()}-${index}`,
            providerId: provider.id,
            provider
          }));
          setChatBoxes(initialBoxes);
          
          // Initialize states for all available providers
          const initialMessages: Record<string, any[]> = {};
          const initialLoading: Record<string, boolean> = {};
          const initialShowSettings: Record<string, boolean> = {};
          
          providers.forEach((provider: Provider) => {
            initialMessages[provider.id] = [];
            initialLoading[provider.id] = false;
            initialShowSettings[provider.id] = false;
          });
          
          setMessages(initialMessages);
          setLoading(initialLoading);
          setShowSettings(initialShowSettings);
        }
      } catch (error) {
        logger.error("Failed to load providers", error);
        toast({
          title: "Error loading providers",
          description: "Could not load available LLM providers",
          variant: "destructive",
        });
      }
    }
    
    loadProviders();
    
    // Load model settings from localStorage
    const savedSettings = localStorage.getItem("modelSettings");
    if (savedSettings) {
      try {
        setModelSettings(JSON.parse(savedSettings));
      } catch (e) {
        logger.error("Failed to load model settings", e);
      }
    }
  }, [toast]);

  // Add a new chat box
  const addChatBox = (providerId: string) => {
    const provider = availableProviders.find(p => p.id === providerId);
    if (!provider) return;
    
    const newBox: ChatBox = {
      id: `box-${Date.now()}`,
      providerId,
      provider
    };
    
    setChatBoxes(prev => [...prev, newBox]);
    
    // Initialize settings for this provider if not exists
    if (!modelSettings[providerId]) {
      const updatedSettings = {
        ...modelSettings,
        [providerId]: {
          temperature: 0.7,
          maxTokens: 2048,
          defaultModel: getDefaultModelForProvider(providerId)
        }
      };
      setModelSettings(updatedSettings);
      localStorage.setItem("modelSettings", JSON.stringify(updatedSettings));
    }
  };

  // Remove a chat box
  const removeChatBox = (boxId: string) => {
    setChatBoxes(prev => prev.filter(box => box.id !== boxId));
  };

  const handleSendToAll = async () => {
    if (!prompt.trim()) return;
    
    // Add user message to all chat boxes
    const updatedMessages = { ...messages };
    chatBoxes.forEach(box => {
      updatedMessages[box.providerId] = [
        ...updatedMessages[box.providerId],
        { role: "user", content: prompt, timestamp: Date.now() }
      ];
    });
    setMessages(updatedMessages);
    
    // Set loading state for all providers
    const updatedLoading = { ...loading };
    chatBoxes.forEach(box => {
      updatedLoading[box.providerId] = true;
    });
    setLoading(updatedLoading);

    // Send prompt to each provider
    for (const box of chatBoxes) {
      try {
        // Get model settings for this provider
        const providerSettings = modelSettings[box.providerId] || {};
        
        // Call the API route
        const response = await fetch("/api/llm/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: box.providerId,
            messages: messages[box.providerId],
            options: {
              temperature: providerSettings.temperature || 0.7,
              maxTokens: providerSettings.maxTokens || 2048,
              model: providerSettings.defaultModel || getDefaultModelForProvider(box.providerId)
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
          [box.providerId]: [
            ...prev[box.providerId],
            {
              ...chatResponse,
              provider: box.providerId // Add provider info to the response
            }
          ],
        }));
      } catch (error: any) {
        // Handle error and display toast
        const errorMessage = error.message || "Could not get response";
        setMessages(prev => ({
          ...prev,
          [box.providerId]: [
            ...prev[box.providerId],
            {
              role: "assistant",
              content: `Error: ${errorMessage}`,
              timestamp: Date.now(),
              metadata: { error: true }
            },
          ],
        }));
        toast({
          title: `Error from ${box.provider.name}`,
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        // Set loading to false
        setLoading(prev => ({
          ...prev,
          [box.providerId]: false,
        }));
      }
    }
    
    // Clear the prompt input
    setPrompt("");
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
    const provider = availableProviders.find(p => p.id === providerId);
    if (!provider) return [{ value: "default", label: "Default" }];
    
    return provider.models.map(model => ({
      value: model,
      label: formatModelName(model)
    }));
  };

  const formatModelName = (model: string) => {
    // Convert model IDs to readable names
    const nameMap: Record<string, string> = {
      "gpt-4o": "GPT-4o",
      "gpt-4-turbo": "GPT-4 Turbo", 
      "gpt-3.5-turbo": "GPT-3.5 Turbo",
      "claude-3-opus-20240229": "Claude 3 Opus",
      "claude-3-sonnet-20240229": "Claude 3 Sonnet", 
      "claude-3-haiku-20240307": "Claude 3 Haiku",
      "gemini-pro": "Gemini Pro",
      "gemini-ultra": "Gemini Ultra",
      "llama3-8b-8192": "Llama 3 8B",
      "llama3-70b-8192": "Llama 3 70B",
      "mixtral-8x7b-32768": "Mixtral 8x7B",
      "gemma-7b-it": "Gemma 7B",
      "llama3": "Llama 3",
      "llama2": "Llama 2",
      "mistral": "Mistral"
    };
    
    return nameMap[model] || model.charAt(0).toUpperCase() + model.slice(1);
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
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-400 mr-2">Active Providers:</span>
            {chatBoxes.map((box) => (
              <div key={box.id} className="flex items-center bg-gray-800 rounded-md px-2 py-1">
                <span className="text-sm mr-2">{box.provider.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 text-red-400 hover:text-red-300"
                  onClick={() => removeChatBox(box.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            
            <Select value="" onValueChange={addChatBox}>
              <SelectTrigger className="w-32 h-8">
                <div className="flex items-center">
                  <Plus className="h-3 w-3 mr-1" />
                  <span className="text-xs">Add</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                handleSendToAll();
              }
            }}
          />
          <Button 
            onClick={handleSendToAll}
            disabled={chatBoxes.length === 0}
          >
            Send to All ({chatBoxes.length})
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
            {chatBoxes.map((box) => (
              <ChatBox
                key={box.id}
                boxId={box.id}
                provider={box.provider}
                messages={messages[box.providerId] || []}
                loading={loading[box.providerId] || false}
                modelSettings={modelSettings[box.providerId] || {}}
                showSettings={showSettings[box.providerId] || false}
                onToggleSettings={() => toggleSettings(box.providerId)}
                onUpdateModelSetting={(setting, value) => updateModelSetting(box.providerId, setting, value)}
                onRemoveBox={() => removeChatBox(box.id)}
                getProviderModels={() => getProviderModels(box.providerId)}
              />
            ))}
          </ResponsiveGrid>
        </TabsContent>
        
        <TabsContent value="tabs">
          <Tabs defaultValue={chatBoxes[0]?.id} className="w-full">
            <TabsList className="mb-4 flex overflow-x-auto">
              {chatBoxes.map((box) => (
                <TabsTrigger key={box.id} value={box.id}>
                  {box.provider.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {chatBoxes.map((box) => (
              <TabsContent key={box.id} value={box.id}>
                <ChatBox
                  boxId={box.id}
                  provider={box.provider}
                  messages={messages[box.providerId] || []}
                  loading={loading[box.providerId] || false}
                  fullHeight
                  modelSettings={modelSettings[box.providerId] || {}}
                  showSettings={showSettings[box.providerId] || false}
                  onToggleSettings={() => toggleSettings(box.providerId)}
                  onUpdateModelSetting={(setting, value) => updateModelSetting(box.providerId, setting, value)}
                  onRemoveBox={() => removeChatBox(box.id)}
                  getProviderModels={() => getProviderModels(box.providerId)}
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
  boxId,
  provider, 
  messages, 
  loading,
  fullHeight = false,
  modelSettings = {},
  showSettings = false,
  onToggleSettings,
  onUpdateModelSetting,
  onRemoveBox,
  getProviderModels
}: { 
  boxId?: string;
  provider: Provider; 
  messages: any[];
  loading: boolean;
  fullHeight?: boolean;
  modelSettings?: any;
  showSettings?: boolean;
  onToggleSettings?: () => void;
  onUpdateModelSetting?: (setting: string, value: any) => void;
  onRemoveBox?: () => void;
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
          {onRemoveBox && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
              onClick={onRemoveBox}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
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
                    Response from: {provider.name}
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
