/**
 * LLM Manager Singleton Instance
 * Provides centralized orchestration for all LLM provider calls
 */

import { LLMManager, Provider, ProviderOptions, ProviderResponse } from '@/src/core/llm_manager';
import { providerRegistry } from '@/services/llm-providers/registry';

/**
 * Provider adapter that wraps our existing provider services
 * to match the LLM Manager's Provider interface
 */
class ProviderAdapter implements Provider {
  constructor(
    public id: string,
    private providerService: any
  ) {}

  async sendMessage(input: string, options?: ProviderOptions & Record<string, any>): Promise<ProviderResponse> {
    const apiKey = options?.['apiKey'] as string | undefined;
    const userId = options?.['userId'] as string | undefined;

    if (!apiKey || !userId) {
      throw new Error(`Missing required parameters for provider ${this.id}`);
    }

    const messages = [{ role: 'user' as const, content: input }];
    const request = {
      userId,
      provider: this.id,
      messages,
      temperature: options?.['temperature'] as number | undefined,
      maxTokens: options?.maxTokens,
      stream: options?.stream,
    };

    if (options?.stream) {
      // Return streaming generator
      const generator = this.providerService.streamChat(request, apiKey);
      return {
        stream: (async function* () {
          for await (const chunk of generator) {
            if (chunk.content) {
              yield chunk.content;
            }
          }
        })(),
      };
    } else {
      // Return non-streaming response
      const response = await this.providerService.chat(request, apiKey);
      return { text: response.content };
    }
  }
}

/**
 * Initialize and configure the LLM Manager
 */
function createLLMManager(): LLMManager {
  const manager = new LLMManager({ concurrency: 10 });

  // Register all available providers
  const providers = providerRegistry.getAll();

  for (const providerService of providers) {
    const metadata = providerService.getMetadata();
    const adapter = new ProviderAdapter(metadata.id, providerService);
    manager.registerProvider(adapter);
  }

  return manager;
}

// Singleton instance
let llmManagerInstance: LLMManager | null = null;

/**
 * Get the global LLM Manager instance
 */
export function getLLMManager(): LLMManager {
  if (!llmManagerInstance) {
    llmManagerInstance = createLLMManager();
  }
  return llmManagerInstance;
}

/**
 * Convenience wrapper for invoking LLM with standard options
 */
export async function invokeLLM(
  provider: string,
  messages: Array<{ role: string; content: string }>,
  options: {
    userId: string;
    apiKey: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }
): Promise<string | AsyncGenerator<string>> {
  const manager = getLLMManager();

  // Combine all messages into single input for manager
  const input = messages.map(m => `${m.role}: ${m.content}`).join('\n');

  return manager.invoke(provider, input, {
    stream: options.stream,
    maxTokens: options.maxTokens,
    userId: options.userId,
    apiKey: options.apiKey,
    temperature: options.temperature,
  } as ProviderOptions & Record<string, any>);
}
