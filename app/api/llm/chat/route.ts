import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { callLLMApi } from '@/lib/llm-api-client-server';
import { 
  checkApiRateLimit, 
  withErrorHandling,
  createErrorResponse
} from '@/lib/api'
import { processSecurityRequest } from '@/lib/security'
import { logger } from '@/lib/observability/logger'
import { 
  llmRequestsTotal, 
  llmRequestDuration, 
  llmTokensTotal 
} from '@/lib/observability/metrics'
import { withObservability } from '@/lib/observability/middleware'

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
    
    const startTime = Date.now();

    // Validate request body
    const { data: body, error: validationError } = await validateChat(await request.json());
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!body) {
      return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 });
    }

    const { messages, provider, options } = body;
    const log = logger.child({ userId });

    // Execute with circuit breaker protection
    const response = await executeWithCircuitBreaker(
      endpoint,
      () => callLLMApi({
        provider,
        messages,
        options,
        userId
      }),
      {
        failureThreshold: 3,
        timeout: 30000, // 30 seconds
        failureWindow: 300000, // 5 minutes
        fallback: () => {
          throw new CircuitBreakerError(
            'Service temporarily unavailable due to high failure rate. Please try again later.',
            'SERVICE_UNAVAILABLE'
          );
        }
      }
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

    log.info({ ms }, 'llm.chat.success');

    // Record success metrics
    (llmRequestsTotal as any).attributes = { provider, model: options?.model || 'default', status: 'success' };
    llmRequestsTotal.inc(1);
    llmRequestDuration.observe(ms / 1000); // Convert to seconds
    if (response.usage?.totalTokens) {
      (llmTokensTotal as any).attributes = { provider, model: options?.model || 'default' };
      llmTokensTotal.inc(response.usage.totalTokens);
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

    try {
      // Log data access error for compliance
      await logDataAccessEvent(
        userId,
        'llm_api',
        'read',
        securityResult.context?.ip,
        securityResult.context?.userAgent,
        {
          provider,
          error: error?.message || 'Unknown',
          responseTime: ms
        }
      );
    } catch {}

    const isTest =
      process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

    if (!isTest) {
      logger.error({ error, ms }, 'llm.chat.error');
    }

    // Record error metrics
    (llmRequestsTotal as any).attributes = { provider, model: options?.model || 'default', status: 'error' };
    llmRequestsTotal.inc(1);

    // Return standardized error response
    const errorResponse = createErrorResponse(error as any);
    return NextResponse.json(errorResponse, { 
      status: errorResponse.error.statusCode || 500,
      headers: securityResult.headers
    });
  }
}
