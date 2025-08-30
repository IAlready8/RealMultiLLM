import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { callLLMApi } from '@/services/api-client';
import { recordAnalyticsEvent } from '@/services/analytics-service';
import { badRequest, internalError, tooManyRequests, unauthorized } from '@/lib/http';
import { checkAndConsume } from '@/lib/rate-limit';
import { validateChatRequest } from '@/schemas/llm';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return unauthorized();
  }

  const startTime = Date.now();
  let provider = 'unknown';

  try {
    const json = await request.json();
    const parsed = validateChatRequest(json);
    if (!parsed.ok) {
      return badRequest(parsed.error);
    }
    provider = parsed.data.provider;
    const { messages, options = {} } = parsed.data;

    // Basic rate limiting: per-user and global (configurable via env)
    const perUserMax = parseInt(process.env.RATE_LIMIT_LLM_PER_USER_PER_MIN || '60', 10)
    const globalMax = parseInt(process.env.RATE_LIMIT_LLM_GLOBAL_PER_MIN || '600', 10)
    const windowMs = parseInt(process.env.RATE_LIMIT_LLM_WINDOW_MS || '60000', 10)
    const perUser = checkAndConsume(`llm:${session.user.id}`, { windowMs, max: perUserMax });
    const global = checkAndConsume(`llm:global`, { windowMs, max: globalMax });
    if (!perUser.allowed || !global.allowed) {
      return tooManyRequests('Rate limit exceeded', {
        retryAfterMs: Math.max(perUser.retryAfterMs, global.retryAfterMs),
        remaining: Math.min(perUser.remaining, global.remaining),
      });
    }

    // The callLLMApi service now handles API key logic internally for client-side calls.
    // For server-side calls like this API route, we would typically fetch the key securely.
    // The service is already set up to use process.env, so we rely on that here.
    // Use env-based defaults; service also applies per-provider defaults
    const envTimeout = Number(process.env.LLM_FETCH_TIMEOUT_MS || 0) || undefined;
    const envRetries = Number(process.env.LLM_FETCH_RETRIES || 0) || undefined;
    const safeOptions = { ...options } as any;
    if (safeOptions.timeoutMs == null && envTimeout != null) safeOptions.timeoutMs = envTimeout;
    if (safeOptions.retries == null && envRetries != null) safeOptions.retries = envRetries;
    const response = await callLLMApi(provider, messages, safeOptions);

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
    logger.error('llm_chat_error', { provider, message: error?.message })

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

    return internalError(error.message || 'Internal Server Error');
  }
}
