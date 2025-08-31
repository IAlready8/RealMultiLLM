// app/api/llm/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { deriveKey, aesGcmDecrypt } from '@/lib/crypto';

// Mapping of providers to their API endpoints
const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages', // Note: Claude has a different API structure
  // Add other providers as needed
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { provider, messages, options } = body;
    console.log(JSON.stringify({ level: 'info', message: 'LLM Proxy POST request received', userId: session?.user?.id, method: req.method, path: req.url, provider: provider }));

    if (!session?.user?.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (!provider || !PROVIDER_ENDPOINTS[provider]) {
      return new NextResponse(JSON.stringify({ error: 'Invalid or unsupported provider' }), { status: 400 });
    }

    const providerConfig = await prisma.providerConfig.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: provider,
        },
      },
    });

    if (!providerConfig?.apiKey) {
      return new NextResponse(JSON.stringify({ error: `API key for ${provider} not configured.` }), { status: 400 });
    }

    const secret = process.env.SECURE_STORAGE_SECRET;
    if (!secret) {
      console.error('SECURE_STORAGE_SECRET is not set.');
      return new NextResponse(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
    }

    const encryptionKey = await deriveKey(`${secret}:${session.user.id}`);
    const decryptedApiKey = await aesGcmDecrypt(encryptionKey, providerConfig.apiKey);

    const upstreamUrl = PROVIDER_ENDPOINTS[provider];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${decryptedApiKey}`,
    };
    
    // Handle provider-specific headers (e.g., Anthropic)
    if (provider === 'claude') {
        headers['anthropic-version'] = '2023-06-01';
        // Note: Claude might require other headers
    }

    // Construct the proper OpenAI-format request
    const llmRequest = {
      model: options?.model || 'gpt-3.5-turbo',
      messages: messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 4096,
      stream: true,
    };

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(llmRequest),
    });

    // Check for non-streaming error responses from the upstream API
    if (!upstreamResponse.body) {
        const errorBody = await upstreamResponse.text();
        console.log(JSON.stringify({ level: 'error', message: 'LLM Proxy upstream error', userId: session.user.id, provider: provider, status: upstreamResponse.status, errorBody: errorBody }));
        return new NextResponse(errorBody, { status: upstreamResponse.status });
    }

    // Transform OpenAI SSE stream to NDJSON format
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = upstreamResponse.body!.getReader();
        const decoder = new TextDecoder();
        
        const writeJson = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              writeJson({ type: 'done' });
              break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                  writeJson({ type: 'done' });
                  controller.close();
                  reader.releaseLock();
                  return;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  
                  if (content) {
                    writeJson({ type: 'chunk', content });
                  }
                  
                  if (parsed.choices?.[0]?.finish_reason) {
                    writeJson({ type: 'done' });
                    controller.close();
                    reader.releaseLock();
                    return;
                  }
                } catch (parseError) {
                  // Skip malformed chunks
                  continue;
                }
              }
            }
          }
        } catch (error) {
          writeJson({ type: 'error', error: (error as Error).message || 'Stream error' });
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
        
        controller.close();
      },
    });

    console.log(JSON.stringify({ level: 'info', message: 'LLM Proxy response streamed successfully', userId: session.user.id, provider: provider }));
    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('LLM Proxy Error:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
