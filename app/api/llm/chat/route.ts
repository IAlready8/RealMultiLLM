import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { callLLMApi } from '@/services/api-client';
import { recordAnalyticsEvent } from '@/services/analytics-service';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  let provider = 'unknown';

  try {
    const requestBody = await request.json();
    provider = requestBody.provider;
    const { messages, options } = requestBody;

    if (!provider || !messages || messages.length === 0) {
      return NextResponse.json({ error: 'Provider and messages are required' }, { status: 400 });
    }

    // The callLLMApi service now handles API key logic internally for client-side calls.
    // For server-side calls like this API route, we would typically fetch the key securely.
    // The service is already set up to use process.env, so we rely on that here.
    const response = await callLLMApi(provider, messages, options);

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    await recordAnalyticsEvent({
      event: 'llm_request',
      payload: {
        provider,
        model: options?.model || 'default',
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
        responseTime,
        success: true,
      },
      userId: session.user.id,
    });

    // Return a response structure compatible with the frontend
    return NextResponse.json({ role: 'assistant', content: response.text, ...response });

  } catch (error: any) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    console.error(`Error in LLM chat API for provider ${provider}:`, error);

    await recordAnalyticsEvent({
      event: 'llm_error',
      payload: {
        provider,
        error: error.message,
        responseTime,
        success: false,
      },
      userId: session.user.id,
    });

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}