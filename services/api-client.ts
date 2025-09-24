import { decryptApiKey } from "@/lib/crypto";
import { monitoring } from "@/lib/monitoring.browser";

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
  monitoring.startTimer(`llm_call_${provider}`);
  
  try {
    if (!apiKey) {
      throw new Error(`No API key found for ${provider}. Please set up your API key in the settings.`);
    }

    // Provider-specific implementations
    let response;
    switch (provider) {
      case "openai":
        response = await callOpenAI(prompt, apiKey, options);
        break;
      case "claude":
        response = await callClaude(prompt, apiKey, options);
        break;
      case "google-ai":
      case "gemini":
        response = await callGoogleAI(prompt, apiKey, options);
        break;
      case "huggingface":
        response = await callHuggingFace(prompt, apiKey, options);
        break;
      case "cohere":
        response = await callCohere(prompt, apiKey, options);
        break;
      case "mistral":
        response = await callMistral(prompt, apiKey, options);
        break;
      case "together":
        response = await callTogether(prompt, apiKey, options);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    // Track the performance
    const duration = monitoring.endTimer(`llm_call_${provider}`);
    const tokensUsed = (response.metadata?.totalTokens || 0);
    monitoring.recordLLMUsage(provider, options.model || 'default', tokensUsed, duration);
    
    return response;
  } catch (error: any) {
    monitoring.endTimer(`llm_call_${provider}`); // Still track the duration even on error
    
    if (error.message?.includes('Invalid encrypted data format')) {
      throw new Error(`API key for ${provider} appears to be corrupted. Please re-enter your API key in settings.`);
    }
    if (error.message?.includes('Failed to decrypt data')) {
      throw new Error(`Could not access API key for ${provider}. Please check your settings.`);
    }
    monitoring.recordError(error, { provider, operation: 'callLLM' });
    throw error;
  }
}

// Export alias for backward compatibility
export const callLLMApi = callLLM;

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

async function callGoogleAI(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  const model = options.model || "gemini-1.5-pro";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let contents;
  if (Array.isArray(prompt)) {
    contents = prompt.map((content, i) => ({
      role: i % 2 === 0 ? "user" : "model",
      parts: [{ text: content }]
    }));
  } else {
    contents = [{ role: "user", parts: [{ text: prompt }] }];
  }

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2048,
    }
  };

  if (options.systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: options.systemPrompt }]
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error calling Google AI API");
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from Google AI API");
  }

  const candidate = data.candidates[0];
  const content = candidate.content?.parts?.[0]?.text || "";

  return {
    role: 'assistant',
    content,
    timestamp: Date.now(),
    metadata: {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      finishReason: candidate.finishReason
    }
  };
}

async function callHuggingFace(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  const model = options.model || "microsoft/DialoGPT-large";
  const url = `https://api-inference.huggingface.co/models/${model}`;

  const input = Array.isArray(prompt) ? prompt.join("\n") : prompt;

  const requestBody = {
    inputs: input,
    parameters: {
      temperature: options.temperature ?? 0.7,
      max_new_tokens: options.maxTokens ?? 2048,
      return_full_text: false
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Error calling Hugging Face API: ${response.statusText}`);
  }

  const data = await response.json();

  let content = "";
  if (Array.isArray(data) && data.length > 0) {
    content = data[0].generated_text || "";
  } else if (data.generated_text) {
    content = data.generated_text;
  }

  return {
    role: 'assistant',
    content,
    timestamp: Date.now(),
    metadata: {
      model: model,
      promptTokens: 0, // HF doesn't provide token counts
      completionTokens: 0,
      totalTokens: 0
    }
  };
}

async function callCohere(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  const url = "https://api.cohere.ai/v1/generate";

  const input = Array.isArray(prompt) ? prompt.join("\n") : prompt;
  const fullPrompt = options.systemPrompt ? `${options.systemPrompt}\n\n${input}` : input;

  const requestBody = {
    model: options.model || "command",
    prompt: fullPrompt,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    truncate: "END"
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Cohere-Version": "2022-12-06"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error calling Cohere API");
  }

  const data = await response.json();

  if (!data.generations || data.generations.length === 0) {
    throw new Error("No response from Cohere API");
  }

  return {
    role: 'assistant',
    content: data.generations[0].text,
    timestamp: Date.now(),
    metadata: {
      promptTokens: 0, // Cohere doesn't provide detailed token counts in this endpoint
      completionTokens: 0,
      totalTokens: 0,
      finishReason: data.generations[0].finish_reason
    }
  };
}

async function callMistral(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  const url = "https://api.mistral.ai/v1/chat/completions";

  const messages = Array.isArray(prompt)
    ? prompt.map((content, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content,
      }))
    : [{ role: "user", content: prompt }];

  if (options.systemPrompt) {
    messages.unshift({ role: "system", content: options.systemPrompt });
  }

  const requestBody = {
    model: options.model || "mistral-large-latest",
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    stream: options.stream ?? false
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error calling Mistral API");
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from Mistral API");
  }

  return {
    role: 'assistant',
    content: data.choices[0].message.content,
    timestamp: Date.now(),
    metadata: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    }
  };
}

async function callTogether(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  const url = "https://api.together.xyz/v1/chat/completions";

  const messages = Array.isArray(prompt)
    ? prompt.map((content, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content,
      }))
    : [{ role: "user", content: prompt }];

  if (options.systemPrompt) {
    messages.unshift({ role: "system", content: options.systemPrompt });
  }

  const requestBody = {
    model: options.model || "meta-llama/Llama-2-70b-chat-hf",
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    stream: options.stream ?? false
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error calling Together API");
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from Together API");
  }

  return {
    role: 'assistant',
    content: data.choices[0].message.content,
    timestamp: Date.now(),
    metadata: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    }
  };
}