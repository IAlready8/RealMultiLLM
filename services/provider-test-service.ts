/**
 * Provider Test Service
 * Tests API key connectivity and configuration for LLM providers
 */

export interface ProviderTestResult {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}

export interface ProviderConfig {
  apiKey: string;
  model?: string;
  endpoint?: string;
}

export class ProviderTestService {
  /**
   * Test OpenAI provider configuration
   */
  async testOpenAI(config: ProviderConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello, respond with just "OK"' }],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: 'OpenAI API returned an error',
          latency,
          error: `HTTP ${response.status}: ${error}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: 'OpenAI connection successful',
        latency,
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        message: 'OpenAI connection failed',
        latency,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Test provider based on provider type
   */
  async testProvider(
    providerType: string,
    config: ProviderConfig
  ): Promise<ProviderTestResult> {
    switch (providerType.toLowerCase()) {
      case 'openai':
        return this.testOpenAI(config);
      default:
        return {
          success: false,
          message: `Provider testing for ${providerType} not yet implemented`,
          error: 'NOT_IMPLEMENTED',
        };
    }
  }

  /**
   * Get supported providers list
   */
  getSupportedProviders(): string[] {
    return ['openai', 'anthropic', 'google-ai', 'openrouter', 'grok'];
  }
}

// Export singleton instance
export const providerTestService = new ProviderTestService();

export default ProviderTestService;