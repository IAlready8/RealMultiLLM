#!/usr/bin/env node

export {};

/**
 * Smoke test for streaming (communication) capabilities across providers.
 *
 * Usage:
 *   npx tsx scripts/test-streaming.ts
 */

type StreamCheck = {
  id: string;
  name: string;
  env: string;
  tester: (apiKey: string) => Promise<string>;
};

const STREAM_TESTS: StreamCheck[] = [
  {
    id: 'openai',
    name: 'OpenAI Chat Completions',
    env: 'OPENAI_API_KEY',
    tester: streamOpenAI,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    env: 'ANTHROPIC_API_KEY',
    tester: streamAnthropic,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    env: 'OPENROUTER_API_KEY',
    tester: streamOpenRouter,
  },
];

async function main(): Promise<void> {
  let failures = 0;

  for (const test of STREAM_TESTS) {
    const apiKey = process.env[test.env];

    if (!apiKey) {
      console.log(`⏭️  ${test.name}: skipped (missing ${test.env})`);
      continue;
    }

    process.stdout.write(`📡 ${test.name}: streaming... `);

    try {
      const summary = await test.tester(apiKey.trim());
      console.log(`✅ OK — ${summary}`);
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

async function streamOpenAI(apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Respond with a short hello.' }],
      stream: true,
      max_tokens: 20,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await safeJson(response);
    const message = typeof body?.error?.message === 'string' ? body.error.message : response.statusText;
    throw new Error(message || 'OpenAI streaming failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('OpenAI returned no stream');
  }

  const result = await readSSEStream(reader, data => {
    const content = data?.choices?.[0]?.delta?.content;
    return typeof content === 'string' ? content : null;
  });

  return formatSummary(result.content, result.chunks);
}

async function streamAnthropic(apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 64,
      temperature: 0.2,
      stream: true,
      messages: [{ role: 'user', content: 'Respond with a short hello.' }],
    }),
  });

  if (!response.ok) {
    const body = await safeJson(response);
    const message = typeof body?.error?.message === 'string' ? body.error.message : response.statusText;
    throw new Error(message || 'Anthropic streaming failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Anthropic returned no stream');
  }

  const result = await readSSEStream(reader, payload => {
    if (payload?.type === 'content_block_delta') {
      const text = payload?.delta?.text;
      return typeof text === 'string' ? text : null;
    }
    return null;
  });

  return formatSummary(result.content, result.chunks);
}

async function streamOpenRouter(apiKey: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'RealMultiLLM',
    },
    body: JSON.stringify({
      model: 'openrouter/auto',
      messages: [{ role: 'user', content: 'Respond with a short hello.' }],
      max_tokens: 32,
      temperature: 0.2,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await safeJson(response);
    const message = typeof body?.error?.message === 'string' ? body.error.message : response.statusText;
    throw new Error(message || 'OpenRouter streaming failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('OpenRouter returned no stream');
  }

  const result = await readSSEStream(reader, data => {
    const content = data?.choices?.[0]?.delta?.content;
    return typeof content === 'string' ? content : null;
  });

  return formatSummary(result.content, result.chunks);
}

interface StreamResult {
  content: string;
  chunks: number;
}

async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  extractContent: (json: any) => string | null,
  maxChunks = 6
): Promise<StreamResult> {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let chunks = 0;
  let content = '';

  try {
    while (chunks < maxChunks) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }

        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          return { content, chunks };
        }

        try {
          const json = JSON.parse(payload);
          const text = extractContent(json);
          if (text) {
            content += text;
            chunks += 1;
            if (chunks >= maxChunks) {
              return { content, chunks };
            }
          }
        } catch (error) {
          // Ignore parse errors on partial frames.
          continue;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (chunks === 0) {
    throw new Error('No stream data received');
  }

  return { content, chunks };
}

function formatSummary(content: string, chunks: number): string {
  const trimmed = content.replace(/\s+/g, ' ').trim();
  const preview = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
  return `${chunks} chunk${chunks === 1 ? '' : 's'} — "${preview || '(empty)'}"`;
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

void main();
