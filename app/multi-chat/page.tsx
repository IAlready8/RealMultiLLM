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

// LLM providers we'll support
const providers = [
  { id: "openai", name: "OpenAI" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
  { id: "llama", name: "Llama" },
  { id: "github", name: "GitHub" },
  { id: "grok", name: "Grok" },
];

export default function MultiChat() {
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast(); // Initialize toast

  // Initialize messages and loading state for each provider
  useEffect(() => {
    const initialMessages: Record<string, any[]> = {};
    const initialLoading: Record<string, boolean> = {};
    
    providers.forEach(provider => {
      initialMessages[provider.id] = [];
      initialLoading[provider.id] = false;
    });
    
    setMessages(initialMessages);
    setLoading(initialLoading);
  }, []);

  const handleSendToAll = async () => {
    if (!prompt.trim()) return;
    
    // Add user message to all chats
    const updatedMessages = { ...messages };
    providers.forEach(provider => {
      updatedMessages[provider.id] = [
        ...updatedMessages[provider.id],
        { role: "user", content: prompt, timestamp: Date.now() }
      ];
    });
    setMessages(updatedMessages);
    
    // Set loading state for all providers
    const updatedLoading = { ...loading };
    providers.forEach(provider => {
      updatedLoading[provider.id] = true;
    });
    setLoading(updatedLoading);

    // Send prompt to each provider
    for (const provider of providers) {
      try {
        // Get model settings from localStorage
        const modelSettingsStr = localStorage.getItem("modelSettings");
        const modelSettings = modelSettingsStr ? 
          JSON.parse(modelSettingsStr)[provider.id] || {} : 
          {};
        
        const messagesWithSystemPrompt = messages[provider.id];

        // Call the API route
        const response = await fetch("/api/llm/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: provider.id,
            messages: messagesWithSystemPrompt,
            options: {
              temperature: modelSettings.temperature || 0.7,
              maxTokens: modelSettings.maxTokens || 2048,
              model: modelSettings.defaultModel
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }

        const chatResponse = await response.json();

        // Update with response
        setMessages(prev => ({
          ...prev,
          [provider.id]: [
            ...prev[provider.id],
            chatResponse
          ],
        }));
      } catch (error: any) {
        // Handle error and display toast
        const errorMessage = error.message || "Could not get response";
        setMessages(prev => ({
          ...prev,
          [provider.id]: [
            ...prev[provider.id],
            {
              role: "assistant",
              content: `Error: ${errorMessage}`,
              timestamp: Date.now(),
              metadata: { error: true }
            },
          ],
        }));
        toast({
          title: `Error from ${provider.name}`,
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        // Set loading to false
        setLoading(prev => ({
          ...prev,
          [provider.id]: false,
        }));
      }
    }
    
    // Clear the prompt input
    setPrompt("");
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
        <div className="flex gap-2">
          <Input
            className="flex-1 bg-gray-800 border-gray-700"
            placeholder="Enter your message to send to all models..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendToAll();
              }
            }}
          />
          <Button onClick={handleSendToAll}>Send to All</Button>
        </div>
      </div>

      <Tabs defaultValue="grid" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="tabs">Tab View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="grid">
          <ResponsiveGrid cols={{ default: 1, md: 2 }}>
            {providers.map((provider) => (
              <ChatBox
                key={provider.id}
                provider={provider}
                messages={messages[provider.id] || []}
                loading={loading[provider.id] || false}
              />
            ))}
          </ResponsiveGrid>
        </TabsContent>
        
        <TabsContent value="tabs">
          <Tabs defaultValue={providers[0].id} className="w-full">
            <TabsList className="mb-4 flex overflow-x-auto">
              {providers.map((provider) => (
                <TabsTrigger key={provider.id} value={provider.id}>
                  {provider.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {providers.map((provider) => (
              <TabsContent key={provider.id} value={provider.id}>
                <ChatBox
                  provider={provider}
                  messages={messages[provider.id] || []}
                  loading={loading[provider.id] || false}
                  fullHeight
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
  fullHeight = false
}: { 
  provider: { id: string; name: string }; 
  messages: any[];
  loading: boolean;
  fullHeight?: boolean;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${fullHeight ? 'h-[70vh]' : 'h-[40vh]'}`}>
      <CardHeader className="px-4 py-2 border-b border-gray-800">
        <CardTitle className="text-lg">{provider.name}</CardTitle>
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
