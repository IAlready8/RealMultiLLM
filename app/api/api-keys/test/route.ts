import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { deriveKey, aesGcmDecrypt } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, keyId } = await request.json();

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Get the stored encrypted API key
    const providerConfig = await prisma.providerConfig.findFirst({
      where: {
        userId: session.user.id,
        provider: provider,
        ...(keyId && { id: keyId }),
      },
      select: {
        id: true,
        provider: true,
        apiKey: true,
      },
    });

    if (!providerConfig || !providerConfig.apiKey) {
      return NextResponse.json(
        { 
          valid: false, 
          message: `No API key found for ${provider}` 
        },
        { status: 404 }
      );
    }

    // Decrypt the API key
    const secret = process.env.SECURE_STORAGE_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
      const encryptionKey = await deriveKey(`${secret}:${session.user.id}`);
      const decryptedApiKey = await aesGcmDecrypt(encryptionKey, providerConfig.apiKey);

      // Test the API key
      const testResult = await testApiKeyDirectly(provider, decryptedApiKey);

      // Update last used timestamp if test was successful
      if (testResult.valid) {
        await prisma.providerConfig.update({
          where: { id: providerConfig.id },
          data: { 
            lastUsedAt: new Date(),
            usageCount: { increment: 1 }
          },
        });
      }

      return NextResponse.json({
        valid: testResult.valid,
        message: testResult.message,
        provider: provider,
        testedAt: new Date().toISOString(),
      });

    } catch (decryptError) {
      console.error('Failed to decrypt API key:', decryptError);
      return NextResponse.json(
        { 
          valid: false, 
          message: 'Failed to decrypt stored API key' 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error testing API key:', error);
    return NextResponse.json(
      { 
        valid: false, 
        message: 'Internal server error during API key test' 
      },
      { status: 500 }
    );
  }
}

// Test API key function with provider-specific endpoints
async function testApiKeyDirectly(provider: string, apiKey: string): Promise<{ valid: boolean; message?: string }> {
  try {
    switch (provider) {
      case "openai":
        return await testOpenAI(apiKey);
      case "openrouter":
        return await testOpenRouter(apiKey);
      case "claude":
        return await testClaude(apiKey);
      case "google":
        return await testGoogleAI(apiKey);
      case "grok":
        return await testGrok(apiKey);
      default:
        return { valid: false, message: `Unsupported provider: ${provider}` };
    }
  } catch (error) {
    return { 
      valid: false, 
      message: error instanceof Error ? error.message : "API test failed" 
    };
  }
}

async function testOpenAI(apiKey: string): Promise<{ valid: boolean; message?: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, message: error.error?.message || "Invalid OpenAI API key" };
    }

    return { valid: true, message: "OpenAI API key is valid and working" };
  } catch (error) {
    return { valid: false, message: "Failed to connect to OpenAI API" };
  }
}

async function testOpenRouter(apiKey: string): Promise<{ valid: boolean; message?: string }> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { valid: false, message: error.error?.message || "Invalid OpenRouter API key" };
    }

    return { valid: true, message: "OpenRouter API key is valid and working" };
  } catch (error) {
    return { valid: false, message: "Failed to connect to OpenRouter API" };
  }
}

async function testClaude(apiKey: string): Promise<{ valid: boolean; message?: string }> {
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
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, message: error.error?.message || "Invalid Claude API key" };
    }

    return { valid: true, message: "Claude API key is valid and working" };
  } catch (error) {
    return { valid: false, message: "Failed to connect to Claude API" };
  }
}

async function testGoogleAI(apiKey: string): Promise<{ valid: boolean; message?: string }> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, message: error.error?.message || "Invalid Google AI API key" };
    }

    return { valid: true, message: "Google AI API key is valid and working" };
  } catch (error) {
    return { valid: false, message: "Failed to connect to Google AI API" };
  }
}

async function testGrok(apiKey: string): Promise<{ valid: boolean; message?: string }> {
  try {
    const response = await fetch("https://api.x.ai/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // If endpoint is not available, validate format
      if (!apiKey.startsWith("xai-")) {
        return { valid: false, message: "Grok API key should start with 'xai-'" };
      }
      return { valid: true, message: "Grok API key format is valid (endpoint unavailable)" };
    }

    return { valid: true, message: "Grok API key is valid and working" };
  } catch (error) {
    // Fallback to format validation
    if (!apiKey.startsWith("xai-")) {
      return { valid: false, message: "Grok API key should start with 'xai-'" };
    }
    return { valid: true, message: "Grok API key format is valid (endpoint unavailable)" };
  }
}