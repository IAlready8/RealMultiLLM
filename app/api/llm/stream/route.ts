import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { streamChatMessage } from '@/services/api-service'
import { badRequest, internalError, tooManyRequests, unauthorized } from '@/lib/http'
import { checkAndConsume } from '@/lib/rate-limit'
import { validateChatRequest } from '@/schemas/llm'
import { logger } from '@/lib/observability/logger'
import { 
  metricsRegistry 
} from '@/lib/observability/metrics'

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return unauthorized()
    }

    try {
      const json = await request.json()
      const parsed = validateChatRequest(json)
      if (!parsed.ok) {
        return badRequest(parsed.error)
      }

      const { provider, messages, options } = parsed.data

      const perUserMax = parseInt(process.env.RATE_LIMIT_LLM_PER_USER_PER_MIN || '60', 10)
      const globalMax = parseInt(process.env.RATE_LIMIT_LLM_GLOBAL_PER_MIN || '600', 10)
      const windowMs = parseInt(process.env.RATE_LIMIT_LLM_WINDOW_MS || '60000', 10)
      const perUser = await checkAndConsume(`llm:${session.user.id}`, { windowMs, max: perUserMax })
      const global = await checkAndConsume(`llm:global`, { windowMs, max: globalMax })

      if (!perUser || !global) {
        logger.error('rate_limiter_unavailable', { perUser, global })
        return internalError('Rate limiter unavailable')
      }

      if (!perUser.allowed || !global.allowed) {
        const retryAfterMs = Math.max(perUser.retryAfterMs ?? 0, global.retryAfterMs ?? 0)
        const remaining = Math.min(perUser.remaining ?? 0, global.remaining ?? 0)
        return tooManyRequests('Rate limit exceeded', {
          retryAfterMs,
          remaining,
        })
      }

      // Increment LLM request counter
      const requestMetric = metricsRegistry.registerCounter(
        'llm_requests_total',
        'Total number of LLM requests',
        { provider, model: options?.model || 'unknown' }
      );
      requestMetric.inc(1);
      
      // Start timing
      const startTime = Date.now();
      
      logger.info('llm.stream.start', { provider, userId: session.user.id, messageCount: messages.length })

      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const writeJson = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

          // Enhanced connection management with memory leak prevention
          const { streamConnectionManager } = await import('@/lib/stream-connection-manager');
          const connectionId = streamConnectionManager.registerConnection(
            session.user.id,
            provider,
            controller,
            300000 // 5 minute timeout
          );

          // Enhanced abort handler with connection cleanup
          const abortHandler = streamConnectionManager.createAbortHandler(connectionId, writeJson);
          request.signal.addEventListener('abort', abortHandler)
          try {
            await streamChatMessage(
              provider,
              messages,
              (chunk) => writeJson({ type: 'chunk', content: chunk }),
              { ...options, abortSignal: request.signal } as any
            )
            writeJson({ type: 'done' })
            controller.close()

            // Clean up connection tracking
            streamConnectionManager.removeConnection(connectionId);
            
            // Calculate duration
            const duration = (Date.now() - startTime) / 1000; // in seconds
            
            // Record request duration
            const durationMetric = metricsRegistry.registerHistogram(
              'llm_request_duration_seconds',
              'LLM request duration in seconds',
              [0.1, 0.5, 1, 2, 5, 10, 30, 60],
              { provider, model: options?.model || 'unknown' }
            );
            durationMetric.observe(duration);
            
            logger.info('llm.stream.success', {
              provider,
              userId: session.user.id,
              duration: `${duration.toFixed(3)}s`
            });

            // Track API key usage for lifecycle management (non-blocking)
            import('@/lib/api-key-tracker').then(({ trackApiKeyUsage }) => {
              trackApiKeyUsage({
                userId: session.user.id,
                provider,
                success: true,
                timestamp: new Date()
              });
            });
          } catch (error: any) {
            logger.error('llm_stream_error', { provider, message: error?.message })
            
            // Record error metrics
            const errorMetric = metricsRegistry.registerCounter(
              'llm_requests_total',
              'Total number of LLM requests',
              { provider, model: options?.model || 'unknown', status: 'error' }
            );
            errorMetric.inc(1);
            
            writeJson({ type: 'error', error: error?.message || 'Internal Error' })
            controller.error(error)
          } finally {
            // Ensure connection cleanup in all cases
            streamConnectionManager.removeConnection(connectionId);
            request.signal.removeEventListener('abort', abortHandler)
          }
        },
      })

      return new NextResponse(stream, {
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
      })
    } catch (error: any) {
      logger.error('llm_stream_error_outer', { message: error?.message })
      
      // Record error metrics
      const globalErrorMetric = metricsRegistry.registerCounter(
        'llm_requests_total',
        'Total number of LLM requests',
        { provider: 'unknown', model: 'unknown', status: 'error' }
      );
      globalErrorMetric.inc(1);
      
      return internalError(error.message || 'Internal Server Error')
    }
  } catch (error: any) {
    logger.error('stream_route_error', { error: error.message });
    return internalError('Internal Server Error');
  }
}
