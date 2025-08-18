import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and API key are required" },
        { status: 400 }
      );
    }

    // Test the API key with a simple request
    let isValid = false;
    let errorMessage = "";

    try {
      switch (provider) {
        case "openai":
          isValid = await testOpenAI(apiKey);
          break;
        case "claude":
          isValid = await testClaude(apiKey);
          break;
        case "google":
          isValid = await testGoogleAI(apiKey);
          break;
        case "groq":
          isValid = await testGroq(apiKey);
          break;
        case "ollama":
          isValid = await testOllama(apiKey);
          break;
        default:
          return NextResponse.json(
            { error: `Unsupported provider: ${provider}` },
            { status: 400 }
          );
      }
    } catch (error: any) {
      errorMessage = error.message || "API test failed";
      isValid = false;
    }

    return NextResponse.json({
      valid: isValid,
      message: isValid ? "API key is valid" : errorMessage || "API key is invalid"
    });

  } catch (error) {
    console.error("Error testing API key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function testOpenAI(apiKey: string): Promise<boolean> {
  if (!apiKey.startsWith('sk-')) {
    throw new Error("OpenAI API key must start with 'sk-'");
  }
  
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid OpenAI API key - authentication failed");
    } else if (response.status === 429) {
      throw new Error("OpenAI API rate limit exceeded - key is valid but temporarily blocked");
    } else if (response.status === 403) {
      throw new Error("OpenAI API key lacks necessary permissions");
    }
    
    try {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenAI API error (${response.status})`);
    } catch {
      throw new Error(`OpenAI API request failed with status ${response.status}`);
    }
  }

  const data = await response.json();
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error("OpenAI API returned unexpected response format");
  }

  return true;
}

async function testClaude(apiKey: string): Promise<boolean> {
  if (!apiKey.startsWith('sk-ant-')) {
    throw new Error("Claude API key must start with 'sk-ant-'");
  }
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "Hi" }],
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid Claude API key - authentication failed");
    } else if (response.status === 429) {
      throw new Error("Claude API rate limit exceeded - key is valid but temporarily blocked");
    } else if (response.status === 403) {
      throw new Error("Claude API key lacks necessary permissions");
    }
    
    try {
      const error = await response.json();
      throw new Error(error.error?.message || `Claude API error (${response.status})`);
    } catch {
      throw new Error(`Claude API request failed with status ${response.status}`);
    }
  }

  const data = await response.json();
  if (!data.content || !Array.isArray(data.content)) {
    throw new Error("Claude API returned unexpected response format");
  }

  return true;
}

async function testGoogleAI(apiKey: string): Promise<boolean> {
  if (!apiKey.startsWith('AIza')) {
    throw new Error("Google AI API key must start with 'AIza'");
  }
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    method: "GET",
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid Google AI API key - authentication failed or API not enabled");
    } else if (response.status === 429) {
      throw new Error("Google AI API quota exceeded - key is valid but temporarily blocked");
    }
    
    try {
      const error = await response.json();
      throw new Error(error.error?.message || `Google AI API error (${response.status})`);
    } catch {
      throw new Error(`Google AI API request failed with status ${response.status}`);
    }
  }

  const data = await response.json();
  if (!data.models || !Array.isArray(data.models)) {
    throw new Error("Google AI API returned unexpected response format");
  }

  return true;
}


async function testGroq(apiKey: string): Promise<boolean> {
  if (!apiKey.startsWith('gsk_')) {
    throw new Error("Groq API key must start with 'gsk_'");
  }
  
  const response = await fetch("https://api.groq.com/openai/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid Groq API key - authentication failed");
    } else if (response.status === 429) {
      throw new Error("Groq API rate limit exceeded - key is valid but temporarily blocked");
    } else if (response.status === 403) {
      throw new Error("Groq API key lacks necessary permissions");
    }
    
    try {
      const error = await response.json();
      throw new Error(error.error?.message || `Groq API error (${response.status})`);
    } catch {
      throw new Error(`Groq API request failed with status ${response.status}`);
    }
  }

  const data = await response.json();
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error("Groq API returned unexpected response format");
  }

  return true;
}

async function testOllama(apiKey: string): Promise<boolean> {
  // Ollama is typically local and doesn't require API keys
  // Test connection to local Ollama instance
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Ollama server not accessible at ${baseUrl}. Make sure Ollama is running.`);
    }

    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) {
      throw new Error("Ollama returned unexpected response format");
    }

    if (data.models.length === 0) {
      throw new Error("No models found in Ollama. Please install at least one model (e.g., 'ollama pull llama3')");
    }

    return true;
  } catch (error: any) {
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      throw new Error(`Cannot connect to Ollama at ${baseUrl}. Make sure Ollama is installed and running.`);
    }
    throw error;
  }
}