
import { callLLMWithCache, streamLLM, LLMMessage, LLMRequestOptions, LLMResponse, LLMStreamCallbacks } from '@/lib/llm-api-client';
import { recordAnalyticsEvent } from '@/services/analytics-service';

export interface ServerLLMRequest extends LLMRequestOptions {
  provider: string;
  messages: LLMMessage[];
  userId: string;
  stream?: boolean;
}

/**
 * Call LLM API from server-side with analytics tracking
 */
export async function callLLMApi(request: ServerLLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();
  
  try {
    // ✅ Fixed: Pass userId to the core API client for server-side key decryption.
    const response = await callLLMWithCache(
      request.userId,
      request.provider,
      request.messages,
      {
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        systemPrompt: request.systemPrompt
      }
    );
    
    const endTime = Date.now();
    await recordAnalyticsEvent({
      event: 'llm_request',
      userId: request.userId,
      payload: {
        provider: request.provider,
        model: request.model,
        tokens: response.usage?.totalTokens || 0,
        responseTime: (endTime - startTime) / 1000,
        success: true
      }
    });
    
    return response;
  } catch (error: any) {
    const endTime = Date.now();
    await recordAnalyticsEvent({
      event: 'llm_error',
      userId: request.userId,
      payload: {
        provider: request.provider,
        model: request.model,
        error: error.message,
        responseTime: (endTime - startTime) / 1000
      }
    });
    
    throw error;
  }
}

/**
 * Stream LLM API from server-side with analytics tracking
 */
export async function streamLLMApi(
  request: ServerLLMRequest,
  callbacks: LLMStreamCallbacks
): Promise<void> {
  const startTime = Date.now();
  let totalTokens = 0;
  
  try {
    const wrappedCallbacks: LLMStreamCallbacks = {
      onChunk: (chunk) => {
        totalTokens += chunk.length / 4;
        callbacks.onChunk(chunk);
      },
      onComplete: async (fullResponse) => {
        const endTime = Date.now();
        await recordAnalyticsEvent({
          event: 'llm_stream_complete',
          userId: request.userId,
          payload: {
            provider: request.provider,
            model: request.model,
            tokens: totalTokens,
            responseTime: (endTime - startTime) / 1000,
            success: true
          }
        });
        callbacks.onComplete?.(fullResponse);
      },
      onError: async (error) => {
        const endTime = Date.now();
        await recordAnalyticsEvent({
          event: 'llm_stream_error',
          userId: request.userId,
          payload: {
            provider: request.provider,
            model: request.model,
            error: error.message,
            responseTime: (endTime - startTime) / 1000
          }
        });
        callbacks.onError?.(error);
      }
    };
    
    // ✅ Fixed: Pass userId to the core streaming API client.
    await streamLLM(
      request.userId,
      request.provider,
      request.messages,
      wrappedCallbacks,
      {
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        systemPrompt: request.systemPrompt
      }
    );
  } catch (error: any) {
    const endTime = Date.now();
    await recordAnalyticsEvent({
      event: 'llm_error',
      userId: request.userId,
      payload: {
        provider: request.provider,
        model: request.model,
        error: error.message,
        responseTime: (endTime - startTime) / 1000
      }
    });
    
    throw error;
  }
}
