import { decryptApiKey } from "@/lib/crypto";

export interface LLMResponse {
  role: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface LLMRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

export async function callLLM(
  provider: string,
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  try {
    if (!apiKey) {
      throw new Error(`No API key found for ${provider}. Please set up your API key in the settings.`);
    }

    // Provider-specific implementations
    switch (provider) {
      case "openai":
        return callOpenAI(prompt, apiKey, options);
      case "claude":
        return callClaude(prompt, apiKey, options);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error: any) {
    if (error.message?.includes('Invalid encrypted data format')) {
      throw new Error(`API key for ${provider} appears to be corrupted. Please re-enter your API key in settings.`);
    }
    if (error.message?.includes('Failed to decrypt data')) {
      throw new Error(`Could not access API key for ${provider}. Please check your settings.`);
    }
    throw error;
  }
}

async function callOpenAI(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  const messages = Array.isArray(prompt)
    ? prompt.map((content, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content,
      }))
    : [{ role: "user", content: prompt }];

  if (options.systemPrompt) {
    messages.unshift({ role: "system", content: options.systemPrompt });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model || "gpt-4o",
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error calling OpenAI API");
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from OpenAI API");
  }

  return {
    role: 'assistant',
    content: data.choices[0].message.content,
    timestamp: Date.now(),
    metadata: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens
    }
  };
}

async function callClaude(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  const messages = Array.isArray(prompt)
    ? prompt.map((content, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content,
      }))
    : [{ role: "user", content: prompt }];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: options.model || "claude-3-opus-20240229",
      messages,
      system: options.systemPrompt,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error calling Claude API");
  }

  const data = await response.json();

  return {
    role: 'assistant',
    content: data.content[0].text,
    timestamp: Date.now(),
    metadata: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }
  };
}

// Alias for backwards compatibility
export const callLLMApi = callLLM;