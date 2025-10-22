import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getEncryptionIntegration } from '@/lib/encryption-integration';

import type { NextRequest } from 'next/server';
import type { EncryptedApiKey } from '@/lib/encryption-integration';

type ApiKeyTestResult = {
  valid: boolean;
  message?: string;
};

type ApiKeyPayload = {
  provider?: string;
  apiKey?: string;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providerConfigs = await prisma.providerConfig.findMany({
      where: {
        userId: session.user.id,
        apiKey: {
          not: null,
        },
      },
      select: {
        id: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
        usageCount: true,
        isActive: true,
      },
    });

    const apiKeys = providerConfigs.map((config) => ({
      id: config.id,
      provider: config.provider,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      lastUsed: config.lastUsedAt,
      usageCount: config.usageCount ?? 0,
      isActive: config.isActive,
      isConfigured: true,
    }));

    const configuredProviders = providerConfigs.map((config) => config.provider);

    return NextResponse.json({ apiKeys, configuredProviders });
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json()) as ApiKeyPayload;
    const provider = typeof payload.provider === 'string' ? payload.provider.trim() : '';
    const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : undefined;

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    if (apiKey === undefined) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    if (apiKey.length === 0) {
      await prisma.providerConfig.deleteMany({
        where: {
          userId: session.user.id,
          provider,
        },
      });

      return NextResponse.json({
        success: true,
        action: 'deleted',
        message: `API key for ${provider} has been removed`,
      });
    }

    const testResult = await testApiKeyDirectly(provider, apiKey);
    if (!testResult.valid) {
      return NextResponse.json(
        {
          error: 'Invalid API key',
          message: testResult.message,
        },
        { status: 400 },
      );
    }

    const encryption = getEncryptionIntegration(prisma);
    const existingConfig = await prisma.providerConfig.findFirst({
      where: {
        userId: session.user.id,
        provider,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    let stored: EncryptedApiKey;
    if (existingConfig) {
      stored = await encryption.updateApiKey(session.user.id, provider, apiKey);
    } else {
      stored = await encryption.storeApiKey(session.user.id, provider, apiKey);
    }

    return NextResponse.json({
      success: true,
      action: existingConfig ? 'updated' : 'created',
      id: stored.id,
      provider: stored.provider,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      message: testResult.message ?? `API key for ${provider} has been saved successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error saving API key';
    console.error('Error saving API key:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const keyId = url.pathname.split('/').pop();

    if (!keyId) {
      return NextResponse.json({ error: 'API key ID is required' }, { status: 400 });
    }

    const deletedConfig = await prisma.providerConfig.deleteMany({
      where: {
        id: keyId,
        userId: session.user.id,
      },
    });

    if (deletedConfig.count === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'API key has been deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function testApiKeyDirectly(provider: string, apiKey: string): Promise<ApiKeyTestResult> {
  try {
    switch (provider.toLowerCase()) {
      case 'openai':
        return testOpenAI(apiKey);
      case 'openrouter':
        return testOpenRouter(apiKey);
      case 'claude':
        return testClaude(apiKey);
      case 'google':
        return testGoogleAI(apiKey);
      case 'grok':
        return testGrok(apiKey);
      default:
        return { valid: false, message: `Unsupported provider: ${provider}` };
    }
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : 'API test failed',
    };
  }
}

async function testOpenAI(apiKey: string): Promise<ApiKeyTestResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, message: error.error?.message || 'Invalid OpenAI API key' };
    }

    return { valid: true, message: 'OpenAI API key is valid' };
  } catch (error) {
    return { valid: false, message: 'Failed to validate OpenAI API key' };
  }
}

async function testOpenRouter(apiKey: string): Promise<ApiKeyTestResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { valid: false, message: error.error?.message || 'Invalid OpenRouter API key' };
    }

    return { valid: true, message: 'OpenRouter API key is valid' };
  } catch (error) {
    return { valid: false, message: 'Failed to validate OpenRouter API key' };
  }
}

async function testClaude(apiKey: string): Promise<ApiKeyTestResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, message: error.error?.message || 'Invalid Claude API key' };
    }

    return { valid: true, message: 'Claude API key is valid' };
  } catch (error) {
    return { valid: false, message: 'Failed to validate Claude API key' };
  }
}

async function testGoogleAI(apiKey: string): Promise<ApiKeyTestResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, message: error.error?.message || 'Invalid Google AI API key' };
    }

    return { valid: true, message: 'Google AI API key is valid' };
  } catch (error) {
    return { valid: false, message: 'Failed to validate Google AI API key' };
  }
}

async function testGrok(apiKey: string): Promise<ApiKeyTestResult> {
  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (!apiKey.startsWith('xai-')) {
        return { valid: false, message: "Grok API key should start with 'xai-'" };
      }
      return { valid: true, message: 'Grok API key format is valid' };
    }

    return { valid: true, message: 'Grok API key is valid' };
  } catch (error) {
    if (!apiKey.startsWith('xai-')) {
      return { valid: false, message: "Grok API key should start with 'xai-'" };
    }
    return { valid: true, message: 'Grok API key format is valid' };
  }
}
