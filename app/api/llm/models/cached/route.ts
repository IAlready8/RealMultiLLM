import { NextResponse } from "next/server";
import cache from "@/lib/simple-cache";
import { safeHandleApiError } from "@/lib/error-handler";
import { getStoredApiKey } from "@/lib/secure-storage-server";
import { logger } from "@/lib/logger";

// Mock data for cached responses
const CACHED_MODELS = {
  openai: [
    { id: "gpt-4o", name: "GPT-4 Omni" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
  claude: [
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
  ],
  google: [
    { id: "gemini-pro", name: "Gemini Pro" },
    { id: "gemini-pro-vision", name: "Gemini Pro Vision" },
  ],
  groq: [
    { id: "llama3-70b-8192", name: "LLaMA 3 70B" },
    { id: "llama3-8b-8192", name: "LLaMA 3 8B" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  ],
  ollama: [
    { id: "llama3", name: "LLaMA 3" },
    { id: "mistral", name: "Mistral" },
    { id: "codellama", name: "Code Llama" },
  ],
};

/**
 * Fetch models from provider API with caching
 * @param provider - LLM provider
 * @returns List of available models
 */
async function fetchModelsWithCache(provider: string) {
  const cacheKey = `models:${provider}`;
  
  // Try to get from cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info(`Returning cached models for ${provider}`);
    return cached;
  }
  
  try {
    // If not in cache, fetch from API
    const models = await fetchModelsFromAPI(provider);
    
    // Cache the result for 5 minutes
    cache.set(cacheKey, models, 5 * 60 * 1000);
    
    return models;
  } catch (error) {
    logger.error(`Error fetching models for ${provider}, using cached fallback:`, error);
    
    // If API fails, return cached models or default models
    return CACHED_MODELS[provider as keyof typeof CACHED_MODELS] || [];
  }
}

/**
 * Fetch models directly from provider API
 * @param provider - LLM provider
 * @returns List of available models
 */
async function fetchModelsFromAPI(provider: string) {
  const apiKey = await getStoredApiKey(provider);
  
  switch (provider) {
    case "openai":
      const openaiRes = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!openaiRes.ok) throw new Error("OpenAI API error");
      const openaiData = await openaiRes.json();
      return openaiData.data.map((model: any) => ({
        id: model.id,
        name: model.id,
      }));
      
    case "claude":
      // Anthropic doesn't have a models endpoint, return static list
      return CACHED_MODELS.claude;
      
    case "google":
      // Google doesn't have a models endpoint, return static list
      return CACHED_MODELS.google;
      
    case "groq":
      const groqRes = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!groqRes.ok) throw new Error("Groq API error");
      const groqData = await groqRes.json();
      return groqData.data.map((model: any) => ({
        id: model.id,
        name: model.id,
      }));
      
    case "ollama":
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const ollamaRes = await fetch(`${ollamaBaseUrl}/api/tags`);
      if (!ollamaRes.ok) throw new Error("Ollama API error");
      const ollamaData = await ollamaRes.json();
      return ollamaData.models.map((model: any) => ({
        id: model.name,
        name: model.name,
      }));
      
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    
    if (!provider) {
      return NextResponse.json(
        { error: "Provider parameter is required" },
        { status: 400 }
      );
    }
    
    const models = await fetchModelsWithCache(provider);
    
    return NextResponse.json({ provider, models });
  } catch (error: any) {
    return safeHandleApiError(error, "/api/llm/models/cached");
  }
}