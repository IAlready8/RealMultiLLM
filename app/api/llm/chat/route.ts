import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { callLLMApi } from '@/services/api-client';
import { recordAnalyticsEvent } from '@/services/analytics-service';
import prisma from '@/lib/prisma';

// Helper function to get API key for a user from the database
async function getApiKeyForUser(userId: string, provider: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { apiKeys: true },
  });

  const apiKeyRecord = user?.apiKeys.find(key => key.provider === provider);
  // Note: This assumes the API key is stored decrypted in the DB for the API route.
  // In a real production scenario, you might have a separate, more secure way to handle this.
  return apiKeyRecord ? apiKeyRecord.key : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const startTime = Date.now();
  let provider = 'unknown';

  try {
    const requestBody = await request.json();
    provider = requestBody.provider;
    const { messages, options } = requestBody;

    if (!provider || !messages || messages.length === 0) {
      return new NextResponse('Provider and messages are required', { status: 400 });
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

    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}