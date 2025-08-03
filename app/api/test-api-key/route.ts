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

    let isValid = false;
    let message = "";

    try {
      switch (provider) {
        case "openai":
          isValid = await testOpenAI(apiKey);
          message = isValid ? "OpenAI API key is valid" : "OpenAI API key is invalid";
          break;
        case "claude":
          isValid = await testClaude(apiKey);
          message = isValid ? "Claude API key is valid" : "Claude API key is invalid";
          break;
        case "google":
          isValid = await testGoogleAI(apiKey);
          message = isValid ? "Google AI API key is valid" : "Google AI API key is invalid";
          break;
        case "grok":
          isValid = await testGrok(apiKey);
          message = isValid ? "Grok API key is valid" : "Grok API key is invalid";
          break;
        case "github":
          // Format validation for GitHub
          isValid = (apiKey.startsWith("gho_") || apiKey.startsWith("github_")) && apiKey.length > 20;
          message = isValid ? "GitHub API key format is valid" : "GitHub API key format is invalid";
          break;
        case "llama":
          // More flexible validation for local setups
          isValid = apiKey.length > 5;
          message = isValid ? "Llama API key format is valid" : "Llama API key format is invalid";
          break;
        default:
          return NextResponse.json(
            { error: "Unsupported provider" },
            { status: 400 }
          );
      }
    } catch (error) {
      isValid = false;
      message = `Error testing ${provider} API key: ${(error as Error).message}`;
    }

    return NextResponse.json({
      valid: isValid,
      message: message,
      provider: provider
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
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function testClaude(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [
          { role: "user", content: "test" }
        ]
      }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function testGoogleAI(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function testGrok(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.x.ai/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}