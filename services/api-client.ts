// OVERWRITTEN FILE: services/api-client.ts (complete rewrite)
// Implements: Unified callLLMApi with streaming support and Offline Ollama integration.

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  text: string;
  usage?: LLMUsage;
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

type PromptLike = string | string[];

function ensureArrayMessages(prompt: PromptLike, systemPrompt?: string) {
  const messages = Array.isArray(prompt)
    ? prompt.map((content, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content }))
    : [{ role: "user", content: prompt }];
  if (systemPrompt) messages.unshift({ role: "system", content: systemPrompt });
  return messages as Array<{ role: string; content: string }>;
}

function getApiKeyForProvider(provider: string): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "claude":
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "google":
    case "gemini":
      return process.env.GOOGLE_AI_API_KEY;
    default:
      return undefined;
  }
}

export async function callLLMApi(
  provider: string,
  prompt: PromptLike,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const id = provider.toLowerCase();
  if (id === "openai") return callOpenAI(prompt, options);
  if (id === "claude" || id === "anthropic") return callClaude(prompt, options);
  if (id === "google" || id === "gemini") return callGoogle(prompt, options);
  if (id === "llama" || id === "ollama") return callOllama(prompt, options);
  throw new Error(`Unsupported provider: ${provider}`);
}

async function callOpenAI(prompt: PromptLike, options: LLMRequestOptions): Promise<LLMResponse> {
  const apiKey = getApiKeyForProvider("openai");
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const messages = ensureArrayMessages(prompt, options.systemPrompt);
  const body = {
    model: options.model || "gpt-4o",
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    stream: !!options.stream,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(error?.error?.message || `OpenAI API error: ${response.status}`);
  }

  if (options.stream && options.onChunk) {
    await streamOpenAI(response, options.onChunk);
    return { text: "", metadata: { streamed: true } };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const usage: LLMUsage | undefined = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;
  return { text, usage };
}

async function streamOpenAI(resp: Response, onChunk: (chunk: string) => void): Promise<void> {
  const reader = (resp.body as any).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const token = json.choices?.[0]?.delta?.content || "";
        if (token) onChunk(token);
      } catch {}
    }
  }
}

async function callClaude(prompt: PromptLike, options: LLMRequestOptions): Promise<LLMResponse> {
  const apiKey = getApiKeyForProvider("anthropic");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const model = options.model || "claude-3-opus-20240229";
  const messages = ensureArrayMessages(prompt);

  const body: any = {
    model,
    messages,
    system: options.systemPrompt,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    stream: !!options.stream,
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const error = await safeJson(resp);
    throw new Error(error?.error?.message || `Anthropic API error: ${resp.status}`);
  }

  if (options.stream && options.onChunk) {
    await streamAnthropic(resp, options.onChunk);
    return { text: "", metadata: { streamed: true } };
  }

  const data = await resp.json();
  const content = data?.content?.[0]?.text ?? "";
  const usage: LLMUsage | undefined = data.usage
    ? {
        promptTokens: data.usage.input_tokens ?? 0,
        completionTokens: data.usage.output_tokens ?? 0,
        totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
      }
    : undefined;
  return { text: content, usage };
}

async function streamAnthropic(resp: Response, onChunk: (chunk: string) => void): Promise<void> {
  const reader = (resp.body as any).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.delta ?? json?.content_block?.text ?? json?.content_block_delta?.delta?.text ?? "";
        if (delta) onChunk(delta);
      } catch {}
    }
  }
}

async function callGoogle(prompt: PromptLike, options: LLMRequestOptions): Promise<LLMResponse> {
  const apiKey = getApiKeyForProvider("google");
  if (!apiKey) throw new Error("Missing GOOGLE_AI_API_KEY");

  const model = options.model || "gemini-pro";
  const contents = Array.isArray(prompt)
    ? prompt.map((text) => ({ role: "user", parts: [{ text }] }))
    : [{ role: "user", parts: [{ text: prompt }] }];
  if (options.systemPrompt) contents.unshift({ role: "system", parts: [{ text: options.systemPrompt }] } as any);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: options.temperature ?? 0.7, maxOutputTokens: options.maxTokens ?? 2048 } }),
  });
  if (!resp.ok) {
    const error = await safeJson(resp);
    throw new Error(error?.error?.message || `Google API error: ${resp.status}`);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  return { text, usage: undefined };
}

async function callOllama(prompt: PromptLike, options: LLMRequestOptions): Promise<LLMResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = options.model || "llama3";

  const messages = ensureArrayMessages(prompt, options.systemPrompt).map((m) => ({ role: m.role, content: m.content }));
  const body: any = {
    model,
    messages,
    stream: !!options.stream,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 2048,
    },
  };

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const error = await safeJson(resp);
    throw new Error(error?.error || `Ollama API error: ${resp.status}`);
  }

  if (options.stream && options.onChunk) {
    await streamOllama(resp, options.onChunk);
    return { text: "", metadata: { streamed: true } };
  }

  const data = await resp.json();
  const text = data?.message?.content ?? "";
  const usage: LLMUsage | undefined = data?.prompt_eval_count
    ? {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      }
    : undefined;
  return { text, usage, metadata: { model } };
}

async function streamOllama(resp: Response, onChunk: (chunk: string) => void): Promise<void> {
  const reader = (resp.body as any).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const json = JSON.parse(trimmed);
        if (json.message?.content) onChunk(json.message.content);
        if (json.done) return;
      } catch {}
    }
  }
}

async function safeJson(resp: Response): Promise<any | null> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

import { decryptApiKey } from "@/lib/crypto";

// OVERWRITTEN FILE: services/api-client.ts (complete rewrite)
// Implements: Unified callLLMApi with streaming support and Offline Ollama integration.

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  text: string;
  usage?: LLMUsage;
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

type PromptLike = string | string[];

function ensureArrayMessages(prompt: PromptLike, systemPrompt?: string) {
  const messages = Array.isArray(prompt)
    ? prompt.map((content, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content }))
    : [{ role: "user", content: prompt }];
  if (systemPrompt) messages.unshift({ role: "system", content: systemPrompt });
  return messages as Array<{ role: string; content: string }>;
}

function getApiKeyForProvider(provider: string): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "claude":
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "google":
    case "gemini":
      return process.env.GOOGLE_AI_API_KEY;
    default:
      return undefined;
  }
}

export async function callLLMApi(
  provider: string,
  prompt: PromptLike,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  // Route to specific provider handler
  const id = provider.toLowerCase();
  if (id === "openai") return callOpenAI(prompt, options);
  if (id === "claude" || id === "anthropic") return callClaude(prompt, options);
  if (id === "google" || id === "gemini") return callGoogle(prompt, options);
  if (id === "llama" || id === "ollama") return callOllama(prompt, options);
  throw new Error(`Unsupported provider: ${provider}`);
}

async function callOpenAI(prompt: PromptLike, options: LLMRequestOptions): Promise<LLMResponse> {
  const apiKey = getApiKeyForProvider("openai");
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const messages = ensureArrayMessages(prompt, options.systemPrompt);
  const body = {
    model: options.model || "gpt-4o",
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    stream: !!options.stream,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(error?.error?.message || `OpenAI API error: ${response.status}`);
  }

  if (options.stream && options.onChunk) {
    await streamOpenAI(response, options.onChunk);
    return { text: "", metadata: { streamed: true } };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const usage: LLMUsage | undefined = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;
  return { text, usage };
}

async function streamOpenAI(resp: Response, onChunk: (chunk: string) => void): Promise<void> {
  // SSE stream: lines prefixed with "data: {json}"
  const reader = (resp.body as any).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const token = json.choices?.[0]?.delta?.content || "";
        if (token) onChunk(token);
      } catch {
        // ignore parse errors for keep-alives
      }
    }
  }
}

async function callClaude(prompt: PromptLike, options: LLMRequestOptions): Promise<LLMResponse> {
  const apiKey = getApiKeyForProvider("anthropic");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const model = options.model || "claude-3-opus-20240229";
  const messages = ensureArrayMessages(prompt);

  // Anthropic expects [{role, content}] with separate system
  const body: any = {
    model,
    messages,
    system: options.systemPrompt,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    stream: !!options.stream,
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const error = await safeJson(resp);
    throw new Error(error?.error?.message || `Anthropic API error: ${resp.status}`);
  }

  if (options.stream && options.onChunk) {
    await streamAnthropic(resp, options.onChunk);
    return { text: "", metadata: { streamed: true } };
  }

  const data = await resp.json();
  const content = data?.content?.[0]?.text ?? "";
  const usage: LLMUsage | undefined = data.usage
    ? {
        promptTokens: data.usage.input_tokens ?? 0,
        completionTokens: data.usage.output_tokens ?? 0,
        totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
      }
    : undefined;
  return { text: content, usage };
}

async function streamAnthropic(resp: Response, onChunk: (chunk: string) => void): Promise<void> {
  // Anthropic also streams as SSE-like JSON event lines
  const reader = (resp.body as any).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.delta ?? json?.content_block?.text ?? json?.content_block_delta?.delta?.text ?? "";
        if (delta) onChunk(delta);
      } catch {
        // ignore
      }
    }
  }
}

async function callGoogle(prompt: PromptLike, options: LLMRequestOptions): Promise<LLMResponse> {
  const apiKey = getApiKeyForProvider("google");
  if (!apiKey) throw new Error("Missing GOOGLE_AI_API_KEY");

  const model = options.model || "gemini-pro";
  const contents = Array.isArray(prompt)
    ? prompt.map((text) => ({ role: "user", parts: [{ text }] }))
    : [{ role: "user", parts: [{ text: prompt }] }];
  if (options.systemPrompt) {
    contents.unshift({ role: "system", parts: [{ text: options.systemPrompt }] } as any);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: options.temperature ?? 0.7, maxOutputTokens: options.maxTokens ?? 2048 } }),
  });
  if (!resp.ok) {
    const error = await safeJson(resp);
    throw new Error(error?.error?.message || `Google API error: ${resp.status}`);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  return { text, usage: undefined };
}

async function callOllama(prompt: PromptLike, options: LLMRequestOptions): Promise<LLMResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = options.model || "llama3"; // sensible default if installed

  // Prefer chat endpoint to preserve roles
  const messages = ensureArrayMessages(prompt, options.systemPrompt).map((m) => ({ role: m.role, content: m.content }));
  const body: any = {
    model,
    messages,
    stream: !!options.stream,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 2048,
    },
  };

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const error = await safeJson(resp);
    throw new Error(error?.error || `Ollama API error: ${resp.status}`);
  }

  if (options.stream && options.onChunk) {
    await streamOllama(resp, options.onChunk);
    return { text: "", metadata: { streamed: true } };
  }

  const data = await resp.json();
  const text = data?.message?.content ?? "";
  const usage: LLMUsage | undefined = data?.prompt_eval_count
    ? {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      }
    : undefined;
  return { text, usage, metadata: { model } };
}

async function streamOllama(resp: Response, onChunk: (chunk: string) => void): Promise<void> {
  // Ollama streams JSON lines until done: true
  const reader = (resp.body as any).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const json = JSON.parse(trimmed);
        if (json.message?.content) onChunk(json.message.content);
        if (json.done) return;
      } catch {
        // ignore non-JSON lines
      }
    }
  }
}

async function safeJson(resp: Response): Promise<any | null> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

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