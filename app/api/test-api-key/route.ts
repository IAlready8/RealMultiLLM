
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const testApiKeySchema = z.object({
  provider: z.string(),
  apiKey: z.string(),
});

async function testOpenAI(apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API error: ${errorData.error.message}`);
  }
  return response.json();
}

async function testClaude(apiKey: string) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            "model": "claude-3-haiku-20240307",
            "max_tokens": 1,
            "messages": [
                {"role": "user", "content": "test"}
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${errorData.error.message}`);
    }
    return response.json();
}

async function testGoogle(apiKey: string) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: {
      'x-goog-api-key': apiKey,
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Google AI API error: ${errorData.error.message}`);
  }
  return response.json();
}

async function testGroq(apiKey: string) {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Groq API error: ${errorData.error.message}`);
    }
    return response.json();
}

async function testOllama() {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/tags');
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}. Is Ollama running?`);
        }
        return response.json();
    } catch (e: any) {
        if (e.cause?.code === 'ECONNREFUSED') {
            throw new Error('Ollama connection refused. Is Ollama running at http://127.0.0.1:11434?');
        }
        throw e;
    }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedBody = testApiKeySchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ valid: false, message: 'Invalid request body' }, { status: 400 });
    }

    const { provider, apiKey } = parsedBody.data;

    switch (provider) {
      case 'openai':
        await testOpenAI(apiKey);
        break;
      case 'claude':
        await testClaude(apiKey);
        break;
      case 'google':
        await testGoogle(apiKey);
        break;
      case 'groq':
        await testGroq(apiKey);
        break;
      case 'ollama':
        await testOllama(); // Ollama doesn't require a key by default
        break;
      default:
        return NextResponse.json({ valid: false, message: 'Unsupported provider' }, { status: 400 });
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    return NextResponse.json({ valid: false, message: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
