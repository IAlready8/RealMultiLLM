#!/usr/bin/env node

export {};

/**
 * Quick connectivity check for all supported LLM providers.
 *
 * Usage:
 *   npx tsx scripts/test-providers.ts
 *
 * Provide API keys via environment variables:
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY,
 *   OPENROUTER_API_KEY, GROK_API_KEY
 */

type ProviderCheck = {
  id: string;
  name: string;
  env: string;
  tester: (apiKey: string) => Promise<string>;
};

const PROVIDERS: ProviderCheck[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    env: 'OPENAI_API_KEY',
    tester: testOpenAI,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    env: 'ANTHROPIC_API_KEY',
    tester: testAnthropic,
  },
  {
    id: 'google-ai',
    name: 'Google Gemini',
    env: 'GOOGLE_AI_API_KEY',
    tester: testGoogle,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    env: 'OPENROUTER_API_KEY',
    tester: testOpenRouter,
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    env: 'GROK_API_KEY',
    tester: testGrok,
  },
];

async function main(): Promise<void> {
  let failures = 0;

  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.env];

    if (!apiKey) {
      console.log(`⏭️  ${provider.name}: skipped (missing ${provider.env})`);
      continue;
    }

    process.stdout.write(`🔍 ${provider.name}: testing connection... `);

    try {
      const summary = await provider.tester(apiKey.trim());
      console.log(`✅ OK${summary ? ` — ${summary}` : ''}`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`❌ FAILED (${message})`);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

async function testOpenAI(apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await safeJson(response);
    const errorMessage = typeof body?.error?.message === 'string' ? body.error.message : response.statusText;
    throw new Error(errorMessage || 'OpenAI request failed');
  }

  const data = await response.json();
  const count = Array.isArray(data?.data) ? data.data.length : 0;
  return count > 0 ? `${count} models` : '';
}

async function testAnthropic(apiKey: string): Promise<string> {
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
      messages: [{ role: 'user', content: 'ping' }],
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await safeJson(response);
    const errorMessage = typeof body?.error?.message === 'string' ? body.error.message : response.statusText;
    throw new Error(errorMessage || 'Anthropic request failed');
  }

  await response.json();
  return 'message accepted';
}

async function testGoogle(apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!response.ok) {
    const body = await safeJson(response);
    const errorMessage = typeof body?.error?.message === 'string' ? body.error.message : response.statusText;
    throw new Error(errorMessage || 'Google AI request failed');
  }

  const data = await response.json();
  const count = Array.isArray(data?.models) ? data.models.length : 0;
  return count > 0 ? `${count} models` : '';
}

async function testOpenRouter(apiKey: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'RealMultiLLM',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await safeJson(response);
    const errorMessage = typeof body?.error?.message === 'string' ? body.error.message : response.statusText;
    throw new Error(errorMessage || 'OpenRouter request failed');
  }

  const data = await response.json();
  const count = Array.isArray(data?.data) ? data.data.length : 0;
  return count > 0 ? `${count} models` : '';
}

async function testGrok(apiKey: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await safeJson(response);
    const errorMessage = typeof body?.error?.message === 'string' ? body.error.message : response.statusText;
    throw new Error(errorMessage || 'Grok request failed');
  }

  const data = await response.json();
  const count = Array.isArray(data?.data) ? data.data.length : 0;
  return count > 0 ? `${count} models` : '';
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

void main();
