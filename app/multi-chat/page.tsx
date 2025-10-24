"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { MessageSquare, XCircle } from 'lucide-react'; // Added XCircle
import { streamChat, type StreamEvent } from '@/services/stream-client'
import { ChatMessageSchema, ExtendedChatMessageSchema } from '@/schemas/llm';
import { MultiChatData } from '@/types/app';

// LLM providers we'll support
const providers = [
  { id: "openai", name: "OpenAI" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
  { id: "llama", name: "Llama" },
  { id: "github", name: "GitHub" },
  { id: "grok", name: "Grok" },
];

export default function MultiChat() {
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Record<string, ExtendedChatMessageSchema[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast(); // Initialize toast
  const [streamingEnabled, setStreamingEnabled] = useState(true)
  const streamHandlesRef = useRef<Map<string, { abort: (r?: unknown) => void }>>(new Map())

  const handleExport = useCallback(async (password: string): Promise<string> => {
    if (!session?.user?.id) {
      const error = new Error("You must be logged in to export data.");
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }

    try {
      const exported = await exportAllData(password, session.user.id);
      toast({
        title: "Success",
        description: "Data exported successfully.",
      });
      return exported;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw (error instanceof Error ? error : new Error(message));
    }
  }, [session?.user?.id, toast]);

  const handleImport = useCallback(async (data: string, password: string): Promise<void> => {
    if (!session?.user?.id) {
      const error = new Error("You must be logged in to import data.");
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }

    try {
      await importAllData(data, password, session.user.id, { conflictResolution: 'merge' });
      toast({
        title: "Success",
        description: "Data imported successfully.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw (error instanceof Error ? error : new Error(message));
    }
  }, [session?.user?.id, toast]);

  // Derived state for overall loading status
  const isAnyLoading = Object.values(loading).some(Boolean); // Added this line

  // Initialize messages and loading state for each provider
  useEffect(() => {
    const initialMessages: Record<string, ChatMessageSchema[]> = {};
    const initialLoading: Record<string, boolean> = {};
    
    providers.forEach(provider => {
      initialMessages[provider.id] = [];
      initialLoading[provider.id] = false;
    });
    
    setMessages(initialMessages);
    setLoading(initialLoading);
  }, []);

  // Abort any in-flight streams on unmount
  useEffect(() => {
    const handlesAtMount = streamHandlesRef.current
    return () => {
      for (const handle of handlesAtMount.values()) {
        try { handle.abort('unmount') } catch {}
      }
      handlesAtMount.clear()
    }
  }, [])

  const handleSendToAll = async () => {
    if (!prompt.trim()) return;
    
    // Add user message to all chats
    const updatedMessages = { ...messages };
    providers.forEach(provider => {
      updatedMessages[provider.id] = [
        ...updatedMessages[provider.id],
        { role: "user", content: prompt }
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

        // If streaming is enabled, use the stream endpoint for incremental updates
        if (streamingEnabled) {
          // Abort any existing stream for this provider
          const existing = streamHandlesRef.current.get(provider.id)
          if (existing) {
            try { existing.abort('restart') } catch {}
            streamHandlesRef.current.delete(provider.id)
          }

          // Push placeholder assistant message for live chunks
          setMessages(prev => ({
            ...prev,
            [provider.id]: [
              ...prev[provider.id],
              { role: 'assistant', content: '', timestamp: Date.now(), metadata: {} }
            ]
          }))

          const handle = await streamChat(
            provider.id,
            messagesWithSystemPrompt,
            {
              temperature: modelSettings.temperature || 0.7,
              maxTokens: modelSettings.maxTokens || 2048,
              model: modelSettings.defaultModel,
            },
            (evt: StreamEvent) => {
              if (evt.type === 'chunk') {
                // Append chunk to the last assistant message
                setMessages(prev => {
                  const list = prev[provider.id] || []
                  const updated = list.slice()
                  const lastIdx = updated.length - 1
                  if (lastIdx >= 0) {
                    const last = updated[lastIdx]
                    if (last?.role === 'assistant') {
                      updated[lastIdx] = { ...last, content: (last.content || '') + evt.content }
                    }
                  }
                  return { ...prev, [provider.id]: updated }
                })
              } else if (evt.type === 'done') {
                setLoading(prev => ({ ...prev, [provider.id]: false }))
                streamHandlesRef.current.delete(provider.id)
              } else if (evt.type === 'error') {
                setMessages(prev => ({
                  ...prev,
                  [provider.id]: [
                    ...prev[provider.id],
                    { role: 'assistant', content: `Error: ${evt.error}`, timestamp: Date.now(), metadata: { error: true } }
                  ]
                }))
                setLoading(prev => ({ ...prev, [provider.id]: false }))
                streamHandlesRef.current.delete(provider.id)
              } else if (evt.type === 'aborted') {
                setLoading(prev => ({ ...prev, [provider.id]: false }))
                streamHandlesRef.current.delete(provider.id)
              }
            }
          )
          streamHandlesRef.current.set(provider.id, handle)
        } else {
          // Non-streaming: Call the chat API and append full response
          const response = await fetch("/api/llm", {
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
        }
      } catch (error) {
        // Handle error and display toast
        const errorMessage = error instanceof Error ? error.message : "Could not get response";
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
        <h1 className="heading-underline text-2xl font-bold">Multi-Chat Panel</h1>
        <div className="flex flex-wrap gap-2">
          <ConversationManager 
            type="multi-chat"
            data={{ messages }}
            onLoad={(data: MultiChatData) => setMessages(data.messages as Record<string, ChatMessageSchema[]>)}
          />
          
          <ExportImportDialog
            onExport={handleExport}
            onImport={handleImport}
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
            disabled={isAnyLoading} // Added disabled prop
          />
          <Button onClick={handleSendToAll} disabled={isAnyLoading}>Send to All</Button> {/* Added disabled prop */}
          <Button
            variant="outline"
            onClick={() => {
              for (const [key, handle] of streamHandlesRef.current.entries()) {
                try { handle.abort('user') } catch {}
                streamHandlesRef.current.delete(key)
              }
              // flip all loadings off
              setLoading((prev) => {
                const copy: Record<string, boolean> = { ...prev }
                Object.keys(copy).forEach((k) => (copy[k] = false))
                return copy
              })
            }}
          >
            Stop
          </Button>
          <label className="flex items-center gap-2 text-sm text-gray-300 px-2 select-none">
            <input
              type="checkbox"
              checked={streamingEnabled}
              onChange={(e) => setStreamingEnabled(e.target.checked)}
            />
            Stream
          </label>
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
  messages: ExtendedChatMessageSchema[];
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
          <div className="text-gray-400 text-center mt-6">
            <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
              <div className="flex flex-col items-center gap-2">
                <MessageSquare className="h-6 w-6 text-gray-500" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs text-gray-500">Type a prompt above and click &quot;Send to All&quot;</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              // Type-safe access to metadata
              const extendedMessage = message as ExtendedChatMessageSchema;
              const hasError = extendedMessage.metadata?.error;
              const metadata = extendedMessage.metadata;
              
              return (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-900 ml-6"
                    : hasError 
                      ? "bg-red-900/30 border border-red-800 mr-6 flex items-center gap-2"
                      : "bg-gray-800 mr-6"
                }`}
              >
                {hasError && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                {message.content}
                {metadata && !hasError && (
                  <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-2">
                    {metadata.promptTokens && (
                      <span>Prompt tokens: {metadata.promptTokens}</span>
                    )}
                    {metadata.completionTokens && (
                      <span>Completion tokens: {metadata.completionTokens}</span>
                    )}
                    {metadata.totalTokens && (
                      <span>Total tokens: {metadata.totalTokens}</span>
                    )}
                  </div>
                )}
              </div>
              );
            })}
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

