// Server-side LLM API client with enhanced functionality for backend routes
import { callLLM, callLLMWithCache, streamLLM, LLMMessage, LLMRequestOptions, LLMResponse, LLMStreamCallbacks } from '@/lib/llm-api-client';
import { recordAnalyticsEvent } from '@/services/analytics-service';

export interface ServerLLMRequest extends LLMRequestOptions {
  provider: string;
  messages: LLMMessage[];
  userId: string;
  stream?: boolean;
}

/**
 * Call LLM API from server-side with analytics tracking
 * @param request - The LLM request parameters
 * @returns The LLM response
 */
export async function callLLMApi(request: ServerLLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();
  
  try {
    // Call the LLM with caching
    const response = await callLLMWithCache(
      request.provider,
      request.messages,
      {
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        systemPrompt: request.systemPrompt
      }
    );
    
    // Record analytics event
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
    // Record error analytics event
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
 * @param request - The LLM request parameters
 * @param callbacks - Streaming callbacks
 */
export async function streamLLMApi(
  request: ServerLLMRequest,
  callbacks: LLMStreamCallbacks
): Promise<void> {
  const startTime = Date.now();
  let totalTokens = 0;
  
  try {
    // Wrap the callbacks to track analytics
    const wrappedCallbacks: LLMStreamCallbacks = {
      onChunk: (chunk) => {
        // Estimate tokens from chunk (rough estimation)
        totalTokens += chunk.length / 4;
        callbacks.onChunk(chunk);
      },
      onComplete: async (fullResponse) => {
        // Record analytics event
        const endTime = Date.now();
        await recordAnalyticsEvent({
          event: 'llm_request',
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
        // Record error analytics event
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
        
        callbacks.onError?.(error);
      }
    };
    
    // Call the streaming function
    await streamLLM(
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
    // Record error analytics event
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