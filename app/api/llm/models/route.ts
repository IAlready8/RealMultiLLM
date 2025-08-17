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

  // Groq
  providers.push({
    id: "groq",
    name: "Groq",
    models: ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
    enabled: true, // Always show Groq
  });

  // Ollama (Local Llama and others)
  const ollamaModels = await getOllamaModels();
  providers.push({
    id: "ollama",
    name: "Ollama",
    models: ollamaModels.length ? ollamaModels : ["llama3", "llama2", "mistral"],
    enabled: true, // Always show Ollama
  });

  // Return all providers (they'll handle missing API keys at runtime)
  return NextResponse.json(providers);
}


