/**
 * Provider Test Service
 * Tests API key connectivity and configuration for LLM providers
 */

import { OpenAIService } from '@/services/llm-providers/openai-service';
import { AnthropicService } from '@/services/llm-providers/anthropic-service';
import { GoogleAIService } from '@/services/llm-providers/google-ai-service';
import { OpenRouterService } from '@/services/llm-providers/openrouter-service';
import { GrokService } from '@/services/llm-providers/grok-service';

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
      const service = new OpenAIService({
        apiKey: config.apiKey,
        model: config.model || 'gpt-3.5-turbo',
      });

      // Simple test message
      const response = await service.chat([
        { role: 'user', content: 'Hello, respond with just "OK"' }
      ], {
        maxTokens: 10,
        temperature: 0,
      });

      const latency = Date.now() - startTime;

      if (response.content.toLowerCase().includes('ok')) {
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
      const service = new AnthropicService({
        apiKey: config.apiKey,
        model: config.model || 'claude-3-sonnet-20240229',
      });

      const response = await service.chat([
        { role: 'user', content: 'Hello, respond with just "OK"' }
      ], {
        maxTokens: 10,
        temperature: 0,
      });

      const latency = Date.now() - startTime;

      if (response.content.toLowerCase().includes('ok')) {
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
      const service = new GoogleAIService({
        apiKey: config.apiKey,
        model: config.model || 'gemini-1.5-flash',
      });

      const response = await service.chat([
        { role: 'user', content: 'Hello, respond with just "OK"' }
      ], {
        maxTokens: 10,
        temperature: 0,
      });

      const latency = Date.now() - startTime;

      if (response.content.toLowerCase().includes('ok')) {
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
      const service = new OpenRouterService({
        apiKey: config.apiKey,
        model: config.model || 'openai/gpt-3.5-turbo',
      });

      const response = await service.chat([
        { role: 'user', content: 'Hello, respond with just "OK"' }
      ], {
        maxTokens: 10,
        temperature: 0,
      });

      const latency = Date.now() - startTime;

      if (response.content.toLowerCase().includes('ok')) {
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
      const service = new GrokService({
        apiKey: config.apiKey,
        model: config.model || 'grok-1',
      });

      const response = await service.chat([
        { role: 'user', content: 'Hello, respond with just "OK"' }
      ], {
        maxTokens: 10,
        temperature: 0,
      });

      const latency = Date.now() - startTime;

      if (response.content.toLowerCase().includes('ok')) {
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

export default ProviderTestService;