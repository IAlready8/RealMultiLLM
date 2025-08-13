import { logger } from './logger';

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Fetch with timeout and retry logic
 */
export async function fetchWithTimeout(
  url: string, 
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 seconds default
    retries = 3,
    retryDelay: initialRetryDelay = 1000,
    ...fetchOptions
  } = options;

  let retryDelay = initialRetryDelay;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        // If response is successful, return it
        if (response.ok) {
          return response;
        }

        // For non-2xx responses, throw error to trigger retry on 5xx
        if (response.status >= 500 && attempt < retries) {
          throw new Error(`Server error: ${response.status}`);
        }

        // For 4xx errors, don't retry
        return response;

      } catch (error) {
        clearTimeout(timeoutId);
        
        // If this is the last attempt, throw the error
        if (attempt === retries) {
          throw error;
        }

        lastError = error as Error;
        
        // Log retry attempt
        logger.warn(`Request failed, retrying in ${retryDelay}ms`, {
          url,
          attempt: attempt + 1,
          maxRetries: retries,
          error: (error as Error).message
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Exponential backoff
        retryDelay *= 2;
      }
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === retries) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

/**
 * Circuit breaker pattern for API calls
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,
    private timeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is open');
      }
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened due to repeated failures', {
        failures: this.failures,
        threshold: this.threshold
      });
    }
  }

  getState() {
    return this.state;
  }
}

// Export a default circuit breaker for LLM APIs
export const llmCircuitBreaker = new CircuitBreaker(5, 60000);