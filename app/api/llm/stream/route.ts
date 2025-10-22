import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { invokeLLM } from '@/lib/llm-manager-instance';
import { enforceModelPolicy } from '@/lib/model-policy';
import { trackCost } from '@/lib/cost-tracker';
import {
  checkApiRateLimit,
  RateLimitError
} from '@/lib/api';
import { processSecurityRequest } from '@/lib/security';
import { logger } from '@/lib/observability/logger';
import { metricsRegistry } from '@/lib/observability/metrics';
import { validateChatRequest } from '@/schemas/llm';
import { logDataAccessEvent } from '@/lib/compliance';
import prisma from '@/lib/prisma';

/**
 * Streaming LLM endpoint with full enterprise integration
 * - LLM Manager orchestration
 * - Model policy enforcement
 * - Cost tracking
 * - Rate limiting
 * - RBAC authorization
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Apply security middleware
  const securityResult = await processSecurityRequest(request);
  if (!securityResult.success) {
    return NextResponse.json(
      { error: { message: securityResult.error } },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  const endpoint = 'llm/stream';

  try {
    // Check rate limit
    const rateLimitResult = await checkApiRateLimit(request, endpoint, userId);

    if (!rateLimitResult.allowed) {
      await logDataAccessEvent(
        userId,
        'llm_api',
        'rate_limit_exceeded',
        securityResult.context?.ip,
        securityResult.context?.userAgent,
        { endpoint, limit: rateLimitResult.limit }
      );

      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`,
        'RATE_LIMIT_EXCEEDED',
        {
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime
        }
      );
    }

    // Validate request
    const validationResult = validateChatRequest(await request.json());
    if (!validationResult.ok) {
      return NextResponse.json({ error: { message: validationResult.error } }, { status: 400 });
    }

    const { messages, provider, options } = validationResult.data;
    const model = options?.model || 'default';

    // Enforce model policy
    await enforceModelPolicy(userId, model, options?.maxTokens);

    // Get API key for provider
    const providerConfig = await prisma.providerConfig.findUnique({
      where: { userId_provider: { userId, provider } }
    });

    if (!providerConfig || !providerConfig.apiKey) {
      return NextResponse.json(
        { error: { message: `No API key configured for provider: ${provider}` } },
        { status: 400 }
      );
    }

    logger.info('llm.stream.start', { provider, userId, model, requestId });

    // Invoke LLM Manager with streaming
    const result = await invokeLLM(provider, messages, {
      userId,
      apiKey: providerConfig.apiKey,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      stream: true,
    });

    if (typeof result === 'string') {
      throw new Error('Expected streaming response but got string');
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        
        let tokenCount = 0;
        
        try {
          for await (const chunk of result) {
            tokenCount += chunk.split(' ').length; // Rough estimate

            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'chunk', content: chunk }) + '\n')
            );
          }

          // Calculate approximate token usage
          const promptTokens = messages.reduce((acc, m) =>
            acc + m.content.split(' ').length, 0
          );
          const completionTokens = tokenCount;

          // Track cost (non-blocking)
          trackCost(userId, provider, model, promptTokens, completionTokens).catch(err =>
            logger.error('cost_tracking_error', { error: err.message })
          );

          controller.enqueue(
            encoder.encode(JSON.stringify({
              type: 'done',
              usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
            }) + '\n')
          );
          controller.close();

          const ms = Date.now() - startTime;
          logger.info('llm.stream.success', { provider, userId, model, ms, requestId });

          // Metrics
          metricsRegistry.registerCounter(
            'llm_requests_total',
            'Total LLM requests',
            { provider, model, status: 'success' }
          ).inc(1);

          metricsRegistry.registerHistogram(
            'llm_request_duration_seconds',
            'LLM request duration',
            [0.1, 0.5, 1, 2, 5, 10, 30, 60],
            { provider, model }
          ).observe(ms / 1000);

          // Log data access
          await logDataAccessEvent(
            userId,
            'llm_api',
            'read',
            securityResult.context?.ip,
            securityResult.context?.userAgent,
            { provider, model, responseTime: ms }
          );

        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown streaming error';
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'error', error: message }) + '\n')
          );
          controller.error(error);

          logger.error('llm.stream.error', { provider, userId, error: message, requestId });

          metricsRegistry.registerCounter(
            'llm_requests_total',
            'Total LLM requests',
            { provider, model, status: 'error' }
          ).inc(1);
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        ...securityResult.headers,
      },
    });

  } catch (error) {
    const ms = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') ? error.statusCode : 500;

    logger.error('llm.stream.error', { error: message, userId, ms, requestId });

    metricsRegistry.registerCounter(
      'llm_requests_total',
      'Total LLM requests',
      { provider: 'unknown', model: 'unknown', status: 'error' }
    ).inc(1);

    return NextResponse.json(
      { error: { message: message } },
      { status: statusCode, headers: securityResult.headers }
    );
  }
}
