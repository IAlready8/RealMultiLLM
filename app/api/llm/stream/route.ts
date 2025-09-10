import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { streamChatMessage } from '@/services/api-service'
import { badRequest, internalError, tooManyRequests, unauthorized } from '@/lib/http'
import { checkAndConsume } from '@/lib/rate-limit'
import { validateChatRequest } from '@/schemas/llm'
import { logger } from '@/lib/observability/logger'
import { 
  llmRequestsTotal, 
  llmRequestDuration, 
  llmTokensTotal 
} from '@/lib/observability/metrics'
import { withObservability } from '@/lib/observability/middleware'

export async function POST(request: Request) {
  return withObservability(async () => {
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
      if (!perUser.allowed || !global.allowed) {
        return tooManyRequests('Rate limit exceeded', {
          retryAfterMs: Math.max(perUser.retryAfterMs, global.retryAfterMs),
          remaining: Math.min(perUser.remaining, global.remaining),
        })
      }

      // Increment LLM request counter
      (llmRequestsTotal as any).attributes = { provider, model: options?.model || 'unknown' };
      llmRequestsTotal.inc(1);
      
      // Start timing
      const startTime = Date.now();
      
      logger.info('llm.stream.start', { provider, userId: session.user.id, messageCount: messages.length })

      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const writeJson = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
          // Provide a way to cancel
          const abortHandler = () => {
            writeJson({ type: 'aborted' })
            controller.close()
          }
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
            
            // Calculate duration
            const duration = (Date.now() - startTime) / 1000; // in seconds
            
            // Record request duration
            (llmRequestDuration as any).attributes = { provider, model: options?.model || 'unknown' };
            llmRequestDuration.observe(duration);
            
            logger.info('llm.stream.success', { 
              provider, 
              userId: session.user.id, 
              duration: `${duration.toFixed(3)}s` 
            })
          } catch (error: any) {
            logger.error('llm_stream_error', { provider, message: error?.message })
            
            // Record error metrics
            (llmRequestsTotal as any).attributes = { provider, model: options?.model || 'unknown', status: 'error' };
            llmRequestsTotal.inc(1);
            
            writeJson({ type: 'error', error: error?.message || 'Internal Error' })
            controller.error(error)
          } finally {
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
      (llmRequestsTotal as any).attributes = { provider: 'unknown', model: 'unknown', status: 'error' };
      llmRequestsTotal.inc(1);
      
      return internalError(error.message || 'Internal Server Error')
    }
  });
}
