import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { badRequest, internalError, unauthorized } from '@/lib/http';
import logger from '@/lib/logger';

const validProviders = [
  'openai',
  'anthropic',
  'claude',
  'google',
  'google-ai',
  'openrouter',
  'github',
  'llama',
  'grok',
] as const;

const testRequestSchema = z.object({
  provider: z.enum(validProviders),
  apiKey: z.string().min(1, 'API key is required'),
});

/**
 * POST /api/provider-configs/test
 * Test an API key for a specific provider in real-time
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { provider, apiKey } = testRequestSchema.parse(body);

    logger.info('Testing API key', {
      userId: session.user.id,
      provider: provider,
    });

    // Test the API key with a simple request
    let isValid = false;
    let errorMessage = '';

    try {
      switch (provider) {
        case 'openai':
          isValid = await testOpenAI(apiKey);
          break;
        case 'openrouter':
          isValid = await testOpenRouter(apiKey);
          break;
        case 'anthropic':
        case 'claude':
          isValid = await testClaude(apiKey);
          break;
        case 'google':
        case 'google-ai':
          isValid = await testGoogleAI(apiKey);
          break;
        case 'llama':
          isValid = await testLlama(apiKey);
          break;
        case 'github':
          isValid = await testGitHub(apiKey);
          break;
        case 'grok':
          isValid = await testGrok(apiKey);
          break;
        default:
          return badRequest(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'API test failed';
      isValid = false;
    }

    logger.info('API key test result', {
      userId: session.user.id,
      provider: provider,
      isValid,
    });

    return NextResponse.json({
      valid: isValid,
      message: isValid
        ? 'API key is valid'
        : errorMessage || 'API key is invalid',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid test request data', { details: error.issues });
    }
    const message =
      error instanceof Error ? error.message : 'Unknown error testing API key';
    logger.error('Failed to test API key', {
      userId: session.user.id,
      error: message,
    });
    return internalError('Failed to test API key');
  }
}

async function testOpenRouter(apiKey: string): Promise<boolean> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Invalid OpenRouter API key');
  }
  return true;
}

async function testOpenAI(apiKey: string): Promise<boolean> {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Invalid OpenAI API key');
  }

  return true;
}

async function testClaude(apiKey: string): Promise<boolean> {
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
    throw new Error(error.error?.message || 'Invalid Claude API key');
  }

  return true;
}

async function testGoogleAI(apiKey: string): Promise<boolean> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Invalid Google AI API key');
  }

  return true;
}

async function testLlama(apiKey: string): Promise<boolean> {
  // For Llama, we'll just check if it's a reasonable format since it's often local
  if (apiKey.length < 5) {
    throw new Error('Llama API key appears too short');
  }

  // You could add actual Ollama endpoint testing here if needed
  return true;
}

async function testGitHub(apiKey: string): Promise<boolean> {
  // GitHub Copilot uses different endpoints, for now just validate format
  if (!apiKey.startsWith('gho_') && !apiKey.startsWith('github_')) {
    throw new Error("GitHub API key should start with 'gho_' or 'github_'");
  }

  return true;
}

async function testGrok(apiKey: string): Promise<boolean> {
  // Grok/X.AI endpoint testing
  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Invalid Grok API key');
    }

    return true;
  } catch (error) {
    // Only fall back to format validation for network errors (TypeError)
    if (error instanceof TypeError) {
      if (!apiKey.startsWith('xai-')) {
        throw new Error("Grok API key should start with 'xai-'");
      }
      return true;
    }
    throw error;
  }
}
