"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveGrid } from "@/components/responsive-grid";
// import { sendChatMessage } from "@/services/api-service"; // Removed direct import
import { PlusCircle, XCircle, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast"; // Import useToast

// LLM providers (should ideally come from a centralized config or API)
const providers = [
  { id: "openai", name: "OpenAI" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
  { id: "llama", name: "Llama" },
  { id: "github", name: "GitHub" },
  { id: "grok", name: "Grok" },
];

interface LLMResponse {
  id: string;
  providerId: string;
  modelId: string;
  content: string;
  loading: boolean;
  error?: string;
}

export default function Comparison() {
  const [prompt, setPrompt] = useState("");
  const [comparisonPanels, setComparisonPanels] = useState<LLMResponse[]>([]);
  const [nextPanelId, setNextPanelId] = useState(0);
  const { toast } = useToast(); // Initialize toast

  const addComparisonPanel = useCallback(() => {
    setComparisonPanels((prev) => [
      ...prev,
      {
        id: `panel-${nextPanelId}`,
        providerId: "",
        modelId: "",
        content: "",
        loading: false,
      },
    ]);
    setNextPanelId((prev) => prev + 1);
  }, [nextPanelId]);

  useEffect(() => {
    // Initialize with two comparison panels by default
    if (comparisonPanels.length === 0) {
      addComparisonPanel();
      addComparisonPanel();
    }
  }, [addComparisonPanel, comparisonPanels.length]);

  const removeComparisonPanel = (id: string) => {
    setComparisonPanels((prev) => prev.filter((panel) => panel.id !== id));
  };

  const handleModelChange = (panelId: string, providerId: string, modelId: string) => {
    setComparisonPanels((prev) =>
      prev.map((panel) =>
        panel.id === panelId ? { ...panel, providerId, modelId, content: "", error: undefined } : panel
      )
    );
  };

  const handleCompare = async () => {
    if (!prompt.trim()) {
      toast({
        title: "No Prompt",
        description: "Please enter a prompt to compare models.",
        variant: "destructive",
      });
      return;
    }

    setComparisonPanels((prev) =>
      prev.map((panel) => ({ ...panel, loading: true, content: "", error: undefined }))
    );

    for (const [index, panel] of comparisonPanels.entries()) {
      if (!panel.providerId || !panel.modelId) {
        const errorMessage = "Please select a model for this panel.";
        setComparisonPanels((prev) =>
          prev.map((p, i) =>
            i === index ? { ...p, loading: false, error: errorMessage } : p
          )
        );
        toast({
          title: `Comparison Error (Panel ${index + 1})`,
          description: errorMessage,
          variant: "destructive",
        });
        continue;
      }

      try {
        const response = await fetch("/api/llm/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: panel.providerId,
            messages: [{ role: "user", content: prompt }],
            options: {
              temperature: 0.7, // Default temperature for comparison
              maxTokens: 1024, // Default max tokens for comparison
              model: panel.modelId,
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }

        const chatResponse = await response.json();

        setComparisonPanels((prev) =>
          prev.map((p, i) =>
            i === index
              ? {
                  ...p,
                  content: chatResponse.content,
                  loading: false,
                  error: undefined,
                }
              : p
          )
        );
      } catch (error: any) {
        const errorMessage = error.message || "Failed to get response.";
        setComparisonPanels((prev) =>
          prev.map((p, i) =>
            i === index
              ? {
                  ...p,
                  content: `Error: ${errorMessage}`,
                  loading: false,
                  error: errorMessage,
                }
              : p
          )
        );
        toast({
          title: `Error from ${panel.providerId} (Panel ${index + 1})`,
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const clearAll = () => {
    setPrompt("");
    setComparisonPanels((prev) =>
      prev.map((panel) => ({ ...panel, content: "", loading: false, error: undefined }))
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="heading-underline text-2xl font-bold">LLM Comparison</h1>
        <p className="text-gray-400">Compare outputs from different LLMs side-by-side.</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <Input
          className="flex-1 bg-gray-800 border-gray-700"
          placeholder="Enter your prompt for comparison..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleCompare();
            }
          }}
        />
        <Button onClick={handleCompare} disabled={!prompt.trim()}>
          Compare
        </Button>
        <Button variant="outline" onClick={clearAll}>
          Clear All
        </Button>
      </div>

      <div className="mb-6 flex gap-2">
        <Button variant="outline" onClick={addComparisonPanel}>
          <PlusCircle className="h-4 w-4 mr-2" /> Add Model
        </Button>
      </div>

      <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }}>
        {comparisonPanels.map((panel) => (
          <Card key={panel.id} className="bg-gray-900 border-gray-800 flex flex-col h-full">
            <CardHeader className="px-4 py-2 border-b border-gray-800 flex flex-row items-center justify-between">
              <Select
                value={panel.providerId}
                onValueChange={(value) => {
                  const [providerId, modelId] = value.split(":");
                  handleModelChange(panel.id, providerId, modelId);
                }}
              >
                <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Select LLM" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  {/* OpenAI Models */}
                  <SelectItem value="openai:gpt-4o">OpenAI - GPT-4o</SelectItem>
                  <SelectItem value="openai:gpt-4-turbo">OpenAI - GPT-4 Turbo</SelectItem>
                  <SelectItem value="openai:gpt-3.5-turbo">OpenAI - GPT-3.5 Turbo</SelectItem>
                  
                  {/* Claude Models */}
                  <SelectItem value="claude:claude-3-opus">Claude - Claude 3 Opus</SelectItem>
                  <SelectItem value="claude:claude-3-sonnet">Claude - Claude 3 Sonnet</SelectItem>
                  <SelectItem value="claude:claude-3-haiku">Claude - Claude 3 Haiku</SelectItem>
                  
                  {/* Google AI Models */}
                  <SelectItem value="google:gemini-pro">Google AI - Gemini Pro</SelectItem>
                  <SelectItem value="google:gemini-ultra">Google AI - Gemini Ultra</SelectItem>
                  
                  {/* Llama Models */}
                  <SelectItem value="llama:llama-3">Llama - Llama 3</SelectItem>
                  <SelectItem value="llama:llama-2-70b">Llama - Llama 2 70B</SelectItem>
                  
                  {/* GitHub Models */}
                  <SelectItem value="github:github-copilot">GitHub - Copilot</SelectItem>
                  
                  {/* Grok Models */}
                  <SelectItem value="grok:grok-1">Grok - Grok-1</SelectItem>
                  {/* OpenRouter */}
                  <SelectItem value="openrouter:openrouter/auto">OpenRouter - Auto (Free routing)</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeComparisonPanel(panel.id)}>
                <XCircle className="h-4 w-4 text-red-500" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 flex-grow overflow-y-auto">
              {panel.loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : panel.error ? (
                <div className="text-red-500 text-center h-full flex items-center justify-center">
                  {panel.error}
                </div>
              ) : !panel.providerId || !panel.modelId ? (
                <div className="text-gray-400 text-center mt-2">
                  <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquare className="h-6 w-6 text-gray-500" />
                      <p className="text-sm">No model selected</p>
                      <p className="text-xs text-gray-500">Use the dropdown above to choose a provider and model.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Textarea
                  readOnly
                  value={panel.content}
                  placeholder="LLM response will appear here..."
                  className="w-full h-full min-h-[200px] bg-gray-800 border-gray-700 text-gray-200 resize-none"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </ResponsiveGrid>
    </div>
  );
}
