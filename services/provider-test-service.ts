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
      // Use fetch directly for testing
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hello, respond with just "OK"' }],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: 'OpenAI connection failed',
          latency,
          error: error.error?.message || response.statusText,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (content.toLowerCase().includes('ok')) {
        return {
          success: true,
          message: 'OpenAI connection successful',
          latency,
        };
      } else {
        return {
          success: false,
          message: 'OpenAI responded but content unexpected',
          latency,
        };
      }
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
   * Test Anthropic provider configuration
   */
  async testAnthropic(config: ProviderConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    try {
      // Use fetch directly for testing
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model || 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'Hello, respond with just "OK"' }],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: 'Anthropic connection failed',
          latency,
          error: error.error?.message || response.statusText,
        };
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      if (content.toLowerCase().includes('ok')) {
        return {
          success: true,
          message: 'Anthropic connection successful',
          latency,
        };
      } else {
        return {
          success: false,
          message: 'Anthropic responded but content unexpected',
          latency,
        };
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        message: 'Anthropic connection failed',
        latency,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Test Google AI provider configuration
   */
  async testGoogleAI(config: ProviderConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    try {
      // Use fetch directly for testing
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-pro'}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: 'Hello, respond with just "OK"' }]
              }
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 10,
            },
          }),
        }
      );

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: 'Google AI connection failed',
          latency,
          error: error.error?.message || response.statusText,
        };
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (content.toLowerCase().includes('ok')) {
        return {
          success: true,
          message: 'Google AI connection successful',
          latency,
        };
      } else {
        return {
          success: false,
          message: 'Google AI responded but content unexpected',
          latency,
        };
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        message: 'Google AI connection failed',
        latency,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Test OpenRouter provider configuration
   */
  async testOpenRouter(config: ProviderConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    try {
      // Use fetch directly for testing
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'openai/gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello, respond with just "OK"' }],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: 'OpenRouter connection failed',
          latency,
          error: error.error?.message || response.statusText,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (content.toLowerCase().includes('ok')) {
        return {
          success: true,
          message: 'OpenRouter connection successful',
          latency,
        };
      } else {
        return {
          success: false,
          message: 'OpenRouter responded but content unexpected',
          latency,
        };
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        message: 'OpenRouter connection failed',
        latency,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Test Grok provider configuration
   */
  async testGrok(config: ProviderConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    try {
      // Use fetch directly for testing
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'grok-1',
          messages: [{ role: 'user', content: 'Hello, respond with just "OK"' }],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: 'Grok connection failed',
          latency,
          error: error.error?.message || response.statusText,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (content.toLowerCase().includes('ok')) {
        return {
          success: true,
          message: 'Grok connection successful',
          latency,
        };
      } else {
        return {
          success: false,
          message: 'Grok responded but content unexpected',
          latency,
        };
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        message: 'Grok connection failed',
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
      case 'anthropic':
        return this.testAnthropic(config);
      case 'google-ai':
      case 'googleai':
        return this.testGoogleAI(config);
      case 'openrouter':
        return this.testOpenRouter(config);
      case 'grok':
        return this.testGrok(config);
      default:
        return {
          success: false,
          message: `Unsupported provider type: ${providerType}`,
          error: 'UNSUPPORTED_PROVIDER',
        };
    }
  }

  /**
   * Test all providers with provided configurations
   */
  async testAllProviders(
    configs: Record<string, ProviderConfig>
  ): Promise<Record<string, ProviderTestResult>> {
    const results: Record<string, ProviderTestResult> = {};

    // Test providers in parallel for efficiency
    const testPromises = Object.entries(configs).map(async ([provider, config]) => {
      const result = await this.testProvider(provider, config);
      results[provider] = result;
    });

    await Promise.all(testPromises);
    return results;
  }

  /**
   * Get supported providers list
   */
  getSupportedProviders(): string[] {
    return ['openai', 'anthropic', 'google-ai', 'openrouter', 'grok'];
  }

  /**
   * Validate provider configuration
   */
  validateConfig(providerType: string, config: ProviderConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.apiKey || config.apiKey.trim() === '') {
      errors.push('API key is required');
    }

    // Provider-specific validations
    switch (providerType.toLowerCase()) {
      case 'openai':
        if (!config.apiKey.startsWith('sk-')) {
          errors.push('OpenAI API key should start with "sk-"');
        }
        break;
      case 'anthropic':
        if (!config.apiKey.startsWith('sk-ant-')) {
          errors.push('Anthropic API key should start with "sk-ant-"');
        }
        break;
      case 'google-ai':
        // Google AI keys have various formats, so we'll be less strict
        if (config.apiKey.length < 20) {
          errors.push('Google AI API key appears to be too short');
        }
        break;
      case 'openrouter':
        if (!config.apiKey.startsWith('sk-or-')) {
          errors.push('OpenRouter API key should start with "sk-or-"');
        }
        break;
      case 'grok':
        // Grok key format validation
        if (config.apiKey.length < 10) {
          errors.push('Grok API key appears to be too short');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const providerTestService = new ProviderTestService();

/**
 * Helper function to test provider connectivity
 * Used by chat-client.ts for API key validation before making requests
 */
export async function testProviderConnectivity(
  provider: string,
  apiKey: string
): Promise<ProviderTestResult> {
  return providerTestService.testProvider(provider, { apiKey });
}

export default ProviderTestService;