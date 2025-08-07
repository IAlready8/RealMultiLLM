import { NextResponse } from "next/server";

// OVERWRITTEN FILE: app/api/llm/models/route.ts (complete rewrite)
// Implements provider gating and dynamic Ollama model discovery.

async function getOllamaModels(): Promise<string[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  try {
    const resp = await fetch(`${baseUrl}/api/tags`, { method: "GET" });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.models || []).map((m: any) => m?.name).filter(Boolean);
  } catch {
    return [];
  }
}

export async function GET() {
  const providers: Array<{ id: string; name: string; models: string[]; enabled: boolean }> = [];

  // OpenAI
  providers.push({
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    enabled: !!process.env.OPENAI_API_KEY,
  });

  // Anthropic (Claude)
  providers.push({
    id: "claude",
    name: "Claude",
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    enabled: !!process.env.ANTHROPIC_API_KEY,
  });

  // Google (Gemini)
  providers.push({
    id: "google",
    name: "Google AI",
    models: ["gemini-pro", "gemini-ultra"],
    enabled: !!process.env.GOOGLE_AI_API_KEY,
  });

  // Ollama (Local Llama and others)
  const ollamaModels = await getOllamaModels();
  providers.push({
    id: "llama",
    name: "Llama (Ollama)",
    models: ollamaModels.length ? ollamaModels : ["llama3"],
    enabled: ollamaModels.length > 0,
  });

  // Hide unimplemented providers (GitHub Copilot, Grok) by marking disabled
  providers.push({ id: "github", name: "GitHub", models: ["github-copilot"], enabled: false });
  providers.push({ id: "grok", name: "Grok", models: ["grok-1"], enabled: false });

  // Only return enabled providers to the client
  const enabled = providers.filter((p) => p.enabled);
  return NextResponse.json(enabled);
}


