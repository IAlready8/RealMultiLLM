import { LLMProvider, Message, ChatOptions, StreamResponse } from '@/types';
import { getProvider } from '@/services/llm-providers';
import { errorManager, LLMProviderError, ValidationError } from '@/lib/error-system';
import { ApiKeyManager } from '@/lib/api-key-manager';
import { logger } from '@/lib/logger';

interface LLMManagerOptions {
  userId?: string;
  teamId?: string;
  requestId?: string;
}

export class LLMManager {
  /**
   * Stream chat messages to a provider
   */
  async stream(
    providerId: string,
    messages: Message[],
    options?: ChatOptions & LLMManagerOptions
  ): Promise<StreamResponse> {
    const requestId = options?.requestId || this.generateRequestId();
    
    try {
      logger.info('LLM stream request started', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        messageCount: messages.length,
        model: options?.model
      });

      // Get provider with error handling
      const provider = getProvider(providerId);
      if (!provider) {
        throw new ValidationError(`Unsupported provider: ${providerId}`, {
          providerId,
          availableProviders: this.getAvailableProviders()
        });
      }

      // Verify API key is available
      if (!ApiKeyManager.hasApiKey(providerId)) {
        throw new ValidationError(`No API key configured for provider: ${providerId}`, {
          providerId
        });
      }

      // Record start time for metrics
      const startTime = Date.now();

      // Call provider's streamChat method
      const result = await provider.streamChat(messages, {
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        topP: options?.topP,
        topK: options?.topK,
        safetySettings: options?.safetySettings
      });

      // Log success metrics
      logger.info('LLM stream request completed', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        duration: Date.now() - startTime,
        model: result.model
      });

      return result;
    } catch (error) {
      logger.error('LLM stream request failed', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        error: error.message,
        stack: error.stack
      });

      // Wrap and re-throw with context
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new LLMProviderError(
        `Stream chat failed for provider ${providerId}: ${error.message}`,
        { providerId, requestId, originalError: error }
      );
    }
  }

  /**
   * Complete a non-streaming chat request
   */
  async complete(
    providerId: string,
    messages: Message[],
    options?: ChatOptions & LLMManagerOptions
  ): Promise<string> {
    const requestId = options?.requestId || this.generateRequestId();
    
    try {
      logger.info('LLM complete request started', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        messageCount: messages.length,
        model: options?.model
      });

      // Get provider with error handling
      const provider = getProvider(providerId);
      if (!provider) {
        throw new ValidationError(`Unsupported provider: ${providerId}`, {
          providerId,
          availableProviders: this.getAvailableProviders()
        });
      }

      // Verify API key is available
      if (!ApiKeyManager.hasApiKey(providerId)) {
        throw new ValidationError(`No API key configured for provider: ${providerId}`, {
          providerId
        });
      }

      // Record start time for metrics
      const startTime = Date.now();

      // For non-streaming, we'll create a temporary stream and collect the result
      const streamResult = await provider.streamChat(messages, {
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        topP: options?.topP,
        topK: options?.topK,
        safetySettings: options?.safetySettings
      });

      // Collect all stream chunks into a single response
      let fullResponse = '';
      if (streamResult.stream && streamResult.stream.getReader) {
        const reader = streamResult.stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && typeof value === 'string') {
              fullResponse += value;
            } else if (value instanceof Uint8Array) {
              fullResponse += new TextDecoder().decode(value);
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      // Log success metrics
      logger.info('LLM complete request completed', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        duration: Date.now() - startTime,
        responseLength: fullResponse.length,
        model: streamResult.model
      });

      return fullResponse;
    } catch (error) {
      logger.error('LLM complete request failed', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        error: error.message,
        stack: error.stack
      });

      // Wrap and re-throw with context
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new LLMProviderError(
        `Complete chat failed for provider ${providerId}: ${error.message}`,
        { providerId, requestId, originalError: error }
      );
    }
  }

  /**
   * Validate provider configuration
   */
  async validateProvider(providerId: string, apiKey: string): Promise<boolean> {
    try {
      const provider = getProvider(providerId);
      if (!provider) {
        return false;
      }

      return await provider.validateConfig({ apiKey });
    } catch (error) {
      logger.error('Provider validation failed', {
        providerId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return [
      'openai',
      'anthropic',
      'google-ai',
      'openrouter',
      'grok'
    ];
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create a singleton instance
export const llmManager = new LLMManager();

export default llmManager;