/*
 * LLM Manager
 *
 * This module provides an asynchronous task manager that can coordinate calls to
 * multiple large‑language‑model (LLM) providers.  It enforces a global
 * concurrency limit, supports streaming responses via async iterators and
 * exposes a simple API for routing messages to different providers.  It does
 * not impose any specific provider implementation; instead, providers must
 * implement the `Provider` interface defined below.
 *
 * Usage:
 *
 * ```ts
 * import { LLMManager } from './llm_manager';
 * import { OpenAIProvider } from '../providers/openai';
 *
 * const manager = new LLMManager({ concurrency: 4 });
 * manager.registerProvider(new OpenAIProvider(config));
 *
 * const response = await manager.invoke('openai', 'Hello world!', { stream: false });
 * console.log(response);
 *
 * // Streaming example
 * for await (const chunk of manager.invoke('openai', 'Stream me this', { stream: true })) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */

export interface ProviderOptions {
  /** Whether to return a streaming async generator rather than a single string. */
  stream?: boolean;
  /** Optional list of function definitions for function‑calling providers. */
  functions?: unknown[];
  /** Abort signal to cancel a long‑running request. */
  signal?: AbortSignal;
  /** Maximum number of tokens to generate; provider may ignore if not supported. */
  maxTokens?: number;
}

export interface ProviderResponse {
  /** The full text response when `stream` is false. */
  text?: string;
  /** Streaming generator when `stream` is true. */
  stream?: AsyncGenerator<string, void, void>;
}

export interface Provider {
  /** Unique identifier used to look up this provider. */
  id: string;
  /**
   * Sends a message to the provider and returns either a string or an async
   * generator depending on the options.  The implementation is provider
   * specific and may use HTTP requests, websockets or other protocols.
   */
  sendMessage(input: string, options?: ProviderOptions): Promise<ProviderResponse>;
}

interface Task<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export interface LLMManagerConfig {
  /** Maximum number of concurrent requests across all providers. */
  concurrency: number;
}

/**
 * LLMManager orchestrates calls to multiple providers while respecting a
 * configurable concurrency limit.  If more requests are made than allowed,
 * additional tasks are queued and executed as running tasks complete.  The
 * manager also exposes a convenience method for streaming outputs from
 * providers that support it.
 */
export class LLMManager {
  private readonly providers: Map<string, Provider> = new Map();
  private readonly queue: Task<unknown>[] = [];
  private running = 0;
  private readonly concurrency: number;

  constructor(config: LLMManagerConfig) {
    if (config.concurrency < 1) {
      throw new Error('Concurrency must be at least 1');
    }
    this.concurrency = config.concurrency;
  }

  /**
   * Registers a provider instance.  If a provider with the same id already
   * exists it will be replaced.  Providers should encapsulate their own
   * configuration and secrets; the manager does not store API keys.
   */
  registerProvider(provider: Provider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Removes a provider from the manager.
   */
  unregisterProvider(id: string): void {
    this.providers.delete(id);
  }

  /**
   * Invokes a provider by id with the supplied input and options.  If the
   * provider returns a streaming response and `options.stream` is true, this
   * method returns an async generator that yields chunks as they are
   * produced.  Otherwise it resolves to a single string.
   */
  async invoke(id: string, input: string, options: ProviderOptions = {}): Promise<string | AsyncGenerator<string>> {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider '${id}' is not registered`);
    }
    // wrap the provider call in a concurrency‑controlled task
    return new Promise((resolve, reject) => {
      const task: Task<ProviderResponse> = {
        fn: () => provider.sendMessage(input, options),
        resolve: (value) => resolve(options.stream ? (value.stream as AsyncGenerator<string>) : (value.text ?? '')),
        reject,
      };
      this.queue.push(task);
      this.processQueue().catch((err) => {
        // This should never happen; individual task errors are handled per task
        console.error('LLMManager internal error:', err);
      });
    });
  }

  private async processQueue(): Promise<void> {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift() as Task<unknown>;
      this.running++;
      fn().then((result) => {
        this.running--;
        resolve(result);
        this.processQueue().catch((err) => {
          console.error('LLMManager internal error:', err);
        });
      }).catch((error) => {
        this.running--;
        reject(error);
        this.processQueue().catch((err) => {
          console.error('LLMManager internal error:', err);
        });
      });
    }
  }
}