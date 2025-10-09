"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Play, Edit } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { useToast } from "@/components/ui/use-toast";


interface PipelineStep {
  id: string;
  providerId: string;
  modelId: string;
  prompt: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
}

interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: "info" | "success" | "error";
}

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

export default function Pipeline() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isAddEditPipelineDialogOpen, setIsAddEditPipelineDialogOpen] = useState(false);
  const [currentPipeline, setCurrentPipeline] = useState<Pipeline | null>(null);
  const [executionLogs, setExecutionLogs] = useState<LogEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast(); // Initialize toast

  // Load pipelines from localStorage on mount
  useEffect(() => {
    const savedPipelines = localStorage.getItem("pipelines");
    if (savedPipelines) {
      setPipelines(JSON.parse(savedPipelines));
    }
  }, []);

  // Save pipelines to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("pipelines", JSON.stringify(pipelines));
  }, [pipelines]);

  const addLogEntry = (message: string, type: "info" | "success" | "error" = "info") => {
    setExecutionLogs((prev) => [
      { id: uuidv4(), timestamp: Date.now(), message, type },
      ...prev,
    ].slice(0, 100)); // Keep last 100 logs
  };

  const handleAddPipeline = () => {
    setCurrentPipeline({
      id: uuidv4(),
      name: "",
      description: "",
      steps: [],
    });
    setIsAddEditPipelineDialogOpen(true);
  };

  const handleEditPipeline = (pipeline: Pipeline) => {
    setCurrentPipeline({ ...pipeline }); // Create a copy to avoid direct mutation
    setIsAddEditPipelineDialogOpen(true);
  };

  const handleDeletePipeline = (id: string) => {
    setPipelines((prev) => prev.filter((p) => p.id !== id));
    toast({
      title: "Pipeline Deleted",
      description: "The pipeline has been successfully deleted.",
    });
  };

  const handleAddStep = () => {
    if (currentPipeline) {
      setCurrentPipeline((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          steps: [
            ...prev.steps,
            {
              id: uuidv4(),
              providerId: "",
              modelId: "",
              prompt: "",
            },
          ],
        };
      });
    }
  };

  const handleRemoveStep = (stepId: string) => {
    if (currentPipeline) {
      setCurrentPipeline((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          steps: prev.steps.filter((step) => step.id !== stepId),
        };
      });
    }
  };

  const handleStepChange = (stepId: string, field: keyof PipelineStep, value: string) => {
    if (currentPipeline) {
      setCurrentPipeline((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          steps: prev.steps.map((step) =>
            step.id === stepId ? { ...step, [field]: value } : step
          ),
        };
      });
    }
  };

  const handleSavePipeline = () => {
    if (currentPipeline) {
      if (currentPipeline.name.trim() === "") {
        toast({
          title: "Validation Error",
          description: "Pipeline name cannot be empty.",
          variant: "destructive",
        });
        return;
      }

      setPipelines((prev) => {
        const existingIndex = prev.findIndex((p) => p.id === currentPipeline.id);
        if (existingIndex > -1) {
          // Update existing
          const updated = [...prev];
          updated[existingIndex] = currentPipeline;
          toast({
            title: "Pipeline Updated",
            description: `Pipeline "${currentPipeline.name}" has been updated.`, 
          });
          return updated;
        } else {
          // Add new
          toast({
            title: "Pipeline Added",
            description: `Pipeline "${currentPipeline.name}" has been added.`, 
          });
          return [...prev, currentPipeline];
        }
      });
      setIsAddEditPipelineDialogOpen(false);
      setCurrentPipeline(null);
    }
  };

  const executePipeline = async (pipeline: Pipeline) => {
    setIsExecuting(true);
    setExecutionLogs([]); // Clear previous logs
    addLogEntry(`Starting pipeline: ${pipeline.name}`, "info");

    let currentOutput = "";

    for (const step of pipeline.steps) {
      addLogEntry(`Executing step: ${step.prompt.substring(0, 50)}...`, "info");
      try {
        if (!step.providerId || !step.modelId) {
          const errorMessage = "Provider or model not selected for this step.";
          addLogEntry(`Step failed: ${errorMessage}`, "error");
          toast({
            title: "Pipeline Execution Error",
            description: errorMessage,
            variant: "destructive",
          });
          setIsExecuting(false);
          return; // Stop execution on first error
        }

        const finalPrompt = step.prompt.replace("{{previous_output}}", currentOutput);

        const response = await fetch("/api/llm/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: step.providerId,
            messages: [{ role: "user", content: finalPrompt }],
            options: {
              model: step.modelId,
              temperature: 0.7,
              maxTokens: 1024,
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }

        const chatResponse = await response.json();
        currentOutput = chatResponse.content;
        addLogEntry(`Step completed. Output: ${currentOutput.substring(0, 100)}...`, "success");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        addLogEntry(`Step failed: ${errorMessage}`, "error");
        toast({
          title: "Pipeline Execution Error",
          description: errorMessage,
          variant: "destructive",
        });
        setIsExecuting(false);
        return; // Stop execution on first error
      }
    }
    addLogEntry(`Pipeline "${pipeline.name}" completed successfully!`, "success");
    toast({
      title: "Pipeline Completed",
      description: `Pipeline "${pipeline.name}" finished successfully.`, 
      variant: "success",
    });
    setIsExecuting(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="heading-underline text-2xl font-bold">LLM Pipeline Hub</h1>
          <p className="text-gray-400">Create and execute multi-step LLM workflows.</p>
        </div>
        <Button onClick={handleAddPipeline}>
          <PlusCircle className="h-4 w-4 mr-2" /> Add New Pipeline
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {pipelines.length === 0 ? (
          <div className="col-span-full">
            <div className="border border-dashed border-gray-700 bg-gray-900/40 rounded-md p-6 text-center text-gray-400">
              <div className="mx-auto max-w-xl flex flex-col items-center gap-3">
                <PlusCircle className="h-6 w-6 text-gray-500" />
                <div className="text-sm">No pipelines created yet</div>
                <div className="text-xs text-gray-500">Create your first pipeline to orchestrate multi-step LLM workflows.</div>
                <div>
                  <Button size="sm" className="mt-2" onClick={handleAddPipeline}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Add New Pipeline
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          pipelines.map((pipeline) => (
            <Card key={pipeline.id} className="bg-gray-900 border-gray-800 flex flex-col">
              <CardHeader>
                <CardTitle>{pipeline.name}</CardTitle>
                <CardDescription>{pipeline.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between">
                <div className="text-sm text-gray-400 mb-4">
                  Steps: {pipeline.steps.length}
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button onClick={() => executePipeline(pipeline)} size="sm" disabled={isExecuting}>
                    <Play className="h-4 w-4 mr-2" /> Run
                  </Button>
                  <Button variant="outline" onClick={() => handleEditPipeline(pipeline)} size="sm">
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" onClick={() => handleDeletePipeline(pipeline.id)} size="sm">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isAddEditPipelineDialogOpen} onOpenChange={setIsAddEditPipelineDialogOpen}>
        <DialogContent className="sm:max-w-[800px] bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle>{currentPipeline?.id ? "Edit Pipeline" : "Add New Pipeline"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pipeline-name">Pipeline Name</Label>
              <Input
                id="pipeline-name"
                value={currentPipeline?.name || ""}
                onChange={(e) => setCurrentPipeline(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pipeline-description">Description</Label>
              <Textarea
                id="pipeline-description"
                value={currentPipeline?.description || ""}
                onChange={(e) => setCurrentPipeline(prev => prev ? { ...prev, description: e.target.value } : null)}
                className="bg-gray-800 border-gray-700"
              />
            </div>

            <h3 className="text-lg font-semibold mt-4">Pipeline Steps</h3>
            {currentPipeline?.steps.length === 0 && (
              <div className="border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-4 text-center text-gray-400">
                <div className="mx-auto max-w-lg flex flex-col items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-gray-500" />
                  <div className="text-sm">No steps added yet</div>
                  <div className="text-xs text-gray-500">Add steps to chain models together. Use {'{previous_output}'} to pass data.</div>
                  <Button variant="outline" size="sm" className="mt-1" onClick={handleAddStep}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Add Step
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {currentPipeline?.steps.map((step, index) => (
                <Card key={step.id} className="bg-gray-800 border-gray-700 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-base">Step {index + 1}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveStep(step.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid gap-2 mb-2">
                    <Label htmlFor={`step-provider-${step.id}`}>LLM Provider</Label>
                    <Select
                      value={step.providerId}
                      onValueChange={(value) => {
                        const [providerId, modelId] = value.split(":");
                        handleStepChange(step.id, "providerId", providerId);
                        handleStepChange(step.id, "modelId", modelId);
                      }}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600">
                        <SelectValue placeholder="Select LLM" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {providers.map((provider) => (
                          <optgroup key={provider.id} label={provider.name}>
                            {/* This is a simplified example. In a real app, models would be fetched dynamically */}
                            {provider.id === "openai" && (
                              <>
                                <SelectItem value="openai:gpt-4o">GPT-4o</SelectItem>
                                <SelectItem value="openai:gpt-4-turbo">GPT-4 Turbo</SelectItem>
                                <SelectItem value="openai:gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                              </>
                            )}
                            {provider.id === "claude" && (
                              <>
                                <SelectItem value="claude:claude-3-opus">Claude 3 Opus</SelectItem>
                                <SelectItem value="claude:claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                                <SelectItem value="claude:claude-3-haiku">Claude 3 Haiku</SelectItem>
                              </>
                            )}
                            {provider.id === "google" && (
                              <>
                                <SelectItem value="google:gemini-pro">Gemini Pro</SelectItem>
                                <SelectItem value="google:gemini-ultra">Gemini Ultra</SelectItem>
                              </>
                            )}
                            {provider.id === "llama" && (
                              <>
                                <SelectItem value="llama:llama-3">Llama 3</SelectItem>
                                <SelectItem value="llama:llama-2-70b">Llama 2 70B</SelectItem>
                              </>
                            )}
                            {provider.id === "github" && (
                              <>
                                <SelectItem value="github:github-copilot">GitHub Copilot</SelectItem>
                              </>
                            )}
                            {provider.id === "grok" && (
                              <>
                                <SelectItem value="grok:grok-1">Grok-1</SelectItem>
                              </>
                            )}
                            {provider.id === "openrouter" && (
                              <>
                                <SelectItem value="openrouter:openrouter/auto">OpenRouter Auto (Free routing)</SelectItem>
                              </>
                            )}
                          </optgroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`step-prompt-${step.id}`}>Prompt (use &#123;&#123;previous_output&#125;&#125; for chaining)</Label>
                    <Textarea
                      id={`step-prompt-${step.id}`}
                      value={step.prompt}
                      onChange={(e) => handleStepChange(step.id, "prompt", e.target.value)}
                      placeholder="Enter prompt for this step..."
                      className="bg-gray-700 border-gray-600 min-h-[80px]"
                    />
                  </div>
                </Card>
              ))}
            </div>
            <Button variant="outline" onClick={handleAddStep} className="mt-4">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Step
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEditPipelineDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePipeline}>Save Pipeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <h2 className="text-xl font-bold mt-8 mb-4">Execution Logs</h2>
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4 max-h-96 overflow-y-auto">
          {executionLogs.length === 0 ? (
            <div className="text-gray-400 text-center mt-2">
              <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
                <p className="text-sm">No execution logs yet</p>
                <p className="text-xs text-gray-500">Run a pipeline to see output here.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {executionLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded-md text-sm ${
                    log.type === "info" ? "bg-gray-800 text-gray-300" :
                    log.type === "success" ? "bg-green-900/20 text-green-400 border border-green-800" :
                    "bg-red-900/20 text-red-400 border border-red-800"
                  }`}
                >
                  <span className="font-mono text-xs mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  {log.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
