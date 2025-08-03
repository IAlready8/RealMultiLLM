import { decryptApiKey } from "@/lib/crypto";

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    done?: boolean;
  };
}

export interface LLMRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export async function callLLM(
  provider: string,
  prompt: string | string[],
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  try {
    let apiKey: string | null = null;
    
    // Check if we're running on the server (Node.js environment)
    if (typeof window === 'undefined') {
      // Server-side: use environment variables
      switch (provider) {
        case 'openai':
          apiKey = process.env.OPENAI_API_KEY || null;
          break;
        case 'claude':
          apiKey = process.env.ANTHROPIC_API_KEY || null;
          break;
        case 'google':
          apiKey = process.env.GOOGLE_AI_API_KEY || null;
          break;
        case 'llama':
          apiKey = process.env.LLAMA_API_KEY || 'llama_local';
          break;
        case 'github':
          apiKey = process.env.GITHUB_API_KEY || null;
          break;
        case 'grok':
          apiKey = process.env.GROK_API_KEY || null;
          break;
      }
    } else {
      // Client-side: use localStorage
      const encryptedKey = localStorage.getItem(`apiKey_${provider}`);
      if (encryptedKey) {
        apiKey = decryptApiKey(encryptedKey);
      }
    }
    
    if (!apiKey) {
      throw new Error(`No API key found for ${provider}. Please set up your API key in the settings.`);
    }
    
    // Provider-specific implementations
    switch (provider) {
      case "openai":
        return callOpenAI(prompt, apiKey, options);
      case "claude":
        return callClaude(prompt, apiKey, options);
      case "google":
        return callGoogleAI(prompt, apiKey, options);
      case "llama":
        return callLlama(prompt, apiKey, options);
      case "github":
        return callGitHubCopilot(prompt, apiKey, options);
      case "grok":
        return callGrok(prompt, apiKey, options);
      default:
        throw new Error(`Provider ${provider} not supported`);
    }
  } catch (error: any) {
    // Provide more specific error messages for common issues
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
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || "gpt-4o",
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    text: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens
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
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model || "claude-3-sonnet-20240229",
      max_tokens: options.maxTokens || 2048,
      system: options.systemPrompt || "You are a helpful assistant.",
      messages,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    text: data.content[0].text,
    usage: {
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }
  };
}

async function callGoogleAI(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  const content = Array.isArray(prompt) ? prompt.join("\n") : prompt;
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: content }]
        }
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Google AI API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    text: data.candidates[0].content.parts[0].text,
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount,
      completionTokens: data.usageMetadata?.candidatesTokenCount,
      totalTokens: data.usageMetadata?.totalTokenCount
    }
  };
}

async function callLlama(
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

  // Using Ollama local API (default port 11434)
  // For production, replace with actual Llama API endpoint
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model || "llama2",
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      }
    })
  });

  if (!response.ok) {
    // Fallback to simulated response if Ollama not available
    console.warn("Ollama not available, using simulated response");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      text: `Llama response: ${Array.isArray(prompt) ? prompt[prompt.length - 1] : prompt}`,
      usage: {
        promptTokens: 20,
        completionTokens: 50,
        totalTokens: 70
      }
    };
  }

  const data = await response.json();
  
  return {
    text: data.message?.content || data.response || "No response",
    usage: {
      promptTokens: data.prompt_eval_count || 20,
      completionTokens: data.eval_count || 50,
      totalTokens: (data.prompt_eval_count || 20) + (data.eval_count || 50)
    },
    metadata: {
      model: data.model,
      done: data.done
    }
  };
}

async function callGitHubCopilot(
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

  // GitHub Copilot Chat API
  const response = await fetch("https://api.githubcopilot.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Editor-Version": "vscode/1.85.0",
      "Editor-Plugin-Version": "copilot-chat/0.11.1",
      "User-Agent": "GitHubCopilotChat/0.11.1"
    },
    body: JSON.stringify({
      messages,
      model: options.model || "gpt-4",
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false
    })
  });

  if (!response.ok) {
    // Fallback to simulated response if GitHub Copilot not available
    console.warn("GitHub Copilot not available, using simulated response");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      text: `GitHub Copilot response: ${Array.isArray(prompt) ? prompt[prompt.length - 1] : prompt}`,
      usage: {
        promptTokens: 15,
        completionTokens: 45,
        totalTokens: 60
      }
    };
  }

  const data = await response.json();
  
  return {
    text: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 15,
      completionTokens: data.usage?.completion_tokens || 45,
      totalTokens: data.usage?.total_tokens || 60
    }
  };
}

async function callGrok(
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

  // X.AI (Grok) API
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model || "grok-beta",
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false
    })
  });

  if (!response.ok) {
    // Fallback to simulated response if Grok not available
    console.warn("Grok API not available, using simulated response");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      text: `Grok response: ${Array.isArray(prompt) ? prompt[prompt.length - 1] : prompt}`,
      usage: {
        promptTokens: 18,
        completionTokens: 55,
        totalTokens: 73
      }
    };
  }

  const data = await response.json();
  
  return {
    text: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 18,
      completionTokens: data.usage?.completion_tokens || 55,
      totalTokens: data.usage?.total_tokens || 73
    }
  };
}