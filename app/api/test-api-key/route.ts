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
        case "openrouter":
          isValid = await testOpenRouter(apiKey);
          break;
        case "claude":
          isValid = await testClaude(apiKey);
          break;
        case "google":
          isValid = await testGoogleAI(apiKey);
          break;
        case "llama":
          isValid = await testLlama(apiKey);
          break;
        case "github":
          isValid = await testGitHub(apiKey);
          break;
        case "grok":
          isValid = await testGrok(apiKey);
          break;
        default:
          return NextResponse.json(
            { error: `Unsupported provider: ${provider}` },
            { status: 400 }
          );
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "API test failed";
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

async function testOpenRouter(apiKey: string): Promise<boolean> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Invalid OpenRouter API key");
  }
  return true;
}

async function testOpenAI(apiKey: string): Promise<boolean> {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid OpenAI API key");
  }

  return true;
}

async function testClaude(apiKey: string): Promise<boolean> {
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
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid Claude API key");
  }

  return true;
}

async function testGoogleAI(apiKey: string): Promise<boolean> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid Google AI API key");
  }

  return true;
}

async function testLlama(apiKey: string): Promise<boolean> {
  // For Llama, we'll just check if it's a reasonable format since it's often local
  if (apiKey.length < 5) {
    throw new Error("Llama API key appears too short");
  }
  
  // You could add actual Ollama endpoint testing here if needed
  return true;
}

async function testGitHub(apiKey: string): Promise<boolean> {
  // GitHub Copilot uses different endpoints, for now just validate format
  if (!apiKey.startsWith("gho_") && !apiKey.startsWith("github_")) {
    throw new Error("GitHub API key should start with 'gho_' or 'github_'");
  }
  
  return true;
}

async function testGrok(apiKey: string): Promise<boolean> {
  // Grok/X.AI endpoint testing
  try {
    const response = await fetch("https://api.x.ai/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Invalid Grok API key");
    }

    return true;
  } catch (error) {
    // If the endpoint is not available, just validate format
    if (!apiKey.startsWith("xai-")) {
      throw new Error("Grok API key should start with 'xai-'");
    }
    return true;
  }
}