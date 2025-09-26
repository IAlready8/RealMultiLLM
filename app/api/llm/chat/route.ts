import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { callLLMApi } from '@/lib/llm-api-client-server';
import { 
  checkApiRateLimit, 
  withErrorHandling,
  createErrorResponse,
  RateLimitError,
  executeWithCircuitBreaker,
  CircuitBreakerError
} from '@/lib/api'
import { processSecurityRequest, sanitizeInput } from '@/lib/security'
import { logger } from '@/lib/observability/logger'
import { 
  metricsRegistry 
} from '@/lib/observability/metrics'
import { withObservability } from '@/lib/observability/middleware'
import { validateChatRequest } from '@/schemas/llm'
import { logDataAccessEvent } from '@/lib/compliance'

// Adds centralized logging and supports new Ollama provider via callLLMApi.
// Compliant with audit logging and data governance.

export async function POST(request: Request) {
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
  const endpoint = 'llm/chat';
  const startTime = Date.now();
  let body: any = null;
  
  try {
    // Check rate limit
    const rateLimitResult = await checkApiRateLimit(request, endpoint, userId);
    
    if (!rateLimitResult.allowed) {
      // Log rate limit violation for compliance
      await logDataAccessEvent(
        userId,
        'llm_api',
        'rate_limit_exceeded',
        securityResult.context?.ip,
        securityResult.context?.userAgent,
        {
          endpoint,
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime
        }
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
    // Validate request body
    const validationResult = validateChatRequest(await request.json());
    if (!validationResult.ok) {
      return NextResponse.json({ error: { message: validationResult.error } }, { status: 400 });
    }
    body = validationResult.data;

    const { messages, provider, options } = body;
    const log = logger.child({ userId });

    // Sanitize messages
    const sanitizedMessages = messages.map((message: any) => ({
      ...message,
      content: sanitizeInput(message.content),
    }));

    // Generate request ID for tracking
    const requestId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Apply request deduplication for identical requests
    const { requestDeduplicator } = await import('@/lib/request-deduplication');
    const response = await requestDeduplicator.deduplicate(
      userId,
      provider,
      sanitizedMessages,
      options,
      () => executeWithCircuitBreaker(
        provider, // Use provider name instead of endpoint
        () => callLLMApi({
          provider,
          messages: sanitizedMessages,
          userId,
          ...options
        }),
        {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 30000, // 30 seconds
          resetTimeout: 60000, // 1 minute
          monitoringWindow: 300000, // 5 minutes
          expectedFailureRate: 0.1
        }
      ),
      requestId
    );

    const ms = Date.now() - startTime;

    // Log data access for compliance
    await logDataAccessEvent(
      userId,
      'llm_api',
      'read',
      securityResult.context?.ip,
      securityResult.context?.userAgent,
      {
        provider,
        model: options?.model || 'default',
        promptLength: messages.reduce((sum: number, msg: any) => sum + (msg.content?.length || 0), 0),
        responseTime: ms
      }
    );

    log.info('llm.chat.success', { ms });

    // Track API key usage for lifecycle management (non-blocking)
    import('@/lib/api-key-tracker').then(({ trackApiKeyUsage }) => {
      trackApiKeyUsage({
        userId,
        provider,
        success: true,
        timestamp: new Date()
      });
    });

    // Invalidate analytics cache for real-time data (non-blocking)
    import('@/lib/smart-cache-invalidator').then(({ smartCacheInvalidator }) => {
      smartCacheInvalidator.invalidateByEvent('llm_request', {
        userId,
        provider,
        model: options?.model || 'default'
      });
    });

    // Record success metrics
    const successMetric = metricsRegistry.registerCounter(
      'llm_requests_total',
      'Total number of LLM requests',
      { provider, model: options?.model || 'default', status: 'success' }
    );
    successMetric.inc(1);
    
    const durationMetric = metricsRegistry.registerHistogram(
      'llm_request_duration_seconds',
      'LLM request duration in seconds',
      [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      { provider, model: options?.model || 'default' }
    );
    durationMetric.observe(ms / 1000); // Convert to seconds
    
    if (response.usage?.totalTokens) {
      const tokenMetric = metricsRegistry.registerCounter(
        'llm_tokens_total',
        'Total number of tokens used',
        { provider, model: options?.model || 'default', type: 'total' }
      );
      tokenMetric.inc(response.usage.totalTokens);
    }

    // Handle successful request with security middleware
    return NextResponse.json(response, {
      headers: {
        ...securityResult.headers,
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      },
    });
  } catch (error: any) {
    const ms = Date.now() - startTime;
    const { messages, provider, options } = body || {};

    try {
      // Log data access error for compliance
      await logDataAccessEvent(
        userId,
        'llm_api',
        'read',
        securityResult.context?.ip,
        securityResult.context?.userAgent,
        {
          provider: provider || 'unknown',
          error: error?.message || 'Unknown',
          responseTime: ms
        }
      );
    } catch {}

    const isTest =
      process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

    if (!isTest) {
      logger.error('llm.chat.error', { error, ms });

      // Queue error for async processing (non-blocking)
      import('@/lib/async-error-processor').then(({ asyncErrorProcessor }) => {
        const errorLevel = error?.statusCode >= 500 ? 'critical' : 'error';
        asyncErrorProcessor.queueError(
          error,
          errorLevel,
          'llm.chat.endpoint',
          {
            provider: provider || 'unknown',
            model: options?.model || 'default',
            responseTime: ms,
            userId,
            requestId
          },
          userId
        );
      });
    }

    // Record error metrics
    const errorMetric = metricsRegistry.registerCounter(
      'llm_requests_total',
      'Total number of LLM requests',
      { provider: provider || 'unknown', model: options?.model || 'default', status: 'error' }
    );
    errorMetric.inc(1);

    // Return standardized error response
    const errorResponse = createErrorResponse(error as any);
    return NextResponse.json(errorResponse, { 
      status: errorResponse.error.statusCode || 500,
      headers: securityResult.headers
    });
  }
}
