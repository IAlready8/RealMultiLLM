import { LLMProvider, Message, ChatOptions, StreamResponse } from '@/types';
import { getProvider } from '@/services/llm-providers';
import { errorManager, LLMProviderError, ValidationError } from '@/lib/error-system';
import { hasValidApiKey } from '@/lib/api-key-service';
import logger from '@/lib/logger';

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
        throw new ValidationError(
          `Unsupported provider: ${providerId}`,
          'providerId',
          {
            endpoint: 'LLM.stream',
            metadata: {
              providerId,
              availableProviders: this.getAvailableProviders()
            }
          }
        );
      }

      // Verify API key is available
      if (options?.userId && !(await hasValidApiKey(options.userId, providerId))) {
        throw new ValidationError(
          `No API key configured for provider: ${providerId}`,
          'apiKey',
          {
            endpoint: 'LLM.stream',
            userId: options.userId,
            metadata: {
              providerId
            }
          }
        );
      }

      // Record start time for metrics
      const startTime = Date.now();

      // Prepare options for provider
      const providerOptions = {
        messages,
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: true
      };

      // Call provider's streamChat method
      const streamResult = await provider.streamChat(providerOptions);

      // Collect all stream chunks into a single response
      let fullContent = '';
      for await (const chunk of streamResult) {
        if (chunk && typeof chunk === 'string') {
          fullContent += chunk;
        }
      }

      // Log success metrics
      logger.info('LLM stream request completed', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        duration: Date.now() - startTime
      });

      // Return the collected response
      return {
        content: fullContent,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('LLM stream request failed', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        error: errorMessage,
        stack: errorStack
      });

      // Wrap and re-throw with context
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new LLMProviderError(
        providerId,
        `Stream chat failed for provider ${providerId}: ${errorMessage}`,
        {
          endpoint: 'LLM.stream',
          userId: options?.userId,
          metadata: {
            providerId,
            requestId
          }
        },
        error instanceof Error ? error : new Error(errorMessage)
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
        throw new ValidationError(
          `Unsupported provider: ${providerId}`,
          'providerId',
          {
            endpoint: 'LLM.complete',
            metadata: {
              providerId,
              availableProviders: this.getAvailableProviders()
            }
          }
        );
      }

      // Verify API key is available
      if (options?.userId && !(await hasValidApiKey(options.userId, providerId))) {
        throw new ValidationError(
          `No API key configured for provider: ${providerId}`,
          'apiKey',
          {
            endpoint: 'LLM.complete',
            userId: options.userId,
            metadata: {
              providerId
            }
          }
        );
      }

      // Record start time for metrics
      const startTime = Date.now();

      // For non-streaming, we'll create a temporary stream and collect the result
      const providerOptions = {
        messages,
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: false
      };

      const streamResult = await provider.streamChat(providerOptions);

      // Collect all stream chunks into a single response
      let fullResponse = '';
      for await (const chunk of streamResult) {
        if (chunk && typeof chunk === 'string') {
          fullResponse += chunk;
        }
      }

      // Log success metrics
      logger.info('LLM complete request completed', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        duration: Date.now() - startTime,
        responseLength: fullResponse.length
      });

      return fullResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('LLM complete request failed', {
        providerId,
        userId: options?.userId,
        teamId: options?.teamId,
        requestId,
        error: errorMessage,
        stack: errorStack
      });

      // Wrap and re-throw with context
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new LLMProviderError(
        providerId,
        `Complete chat failed for provider ${providerId}: ${errorMessage}`,
        {
          endpoint: 'LLM.complete',
          userId: options?.userId,
          metadata: {
            providerId,
            requestId
          }
        },
        error instanceof Error ? error : new Error(errorMessage)
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Provider validation failed', {
        providerId,
        error: errorMessage
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