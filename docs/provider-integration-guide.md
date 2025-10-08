# Provider Integration Guide

## Overview

This guide provides detailed instructions for integrating different LLM providers with the RealMultiLLM platform. Each provider has its own unique API structure and requirements, but the platform provides a standardized interface for interacting with all of them.

## Supported Providers

1. [OpenAI](#openai)
2. [Anthropic](#anthropic)
3. [Google AI (Gemini)](#google-ai-gemini)
4. [OpenRouter](#openrouter)
5. [Grok](#grok)

## OpenAI

### Overview
OpenAI provides access to GPT models including GPT-4, GPT-4 Turbo, and GPT-3.5 Turbo. The platform supports streaming responses and various model configurations.

### Setup
1. Obtain an API key from [OpenAI Platform](https://platform.openai.com/)
2. Add the key to your environment variables:
   ```bash
   OPENAI_API_KEY=sk-your-openai-api-key
   ```

### Available Models
- `gpt-4o` - Most capable model (128K context)
- `gpt-4o-mini` - Lightweight model (128K context)
- `gpt-4-turbo` - Powerful reasoning model (128K context)
- `gpt-4` - Previous generation powerful model (8K context)
- `gpt-3.5-turbo` - Fast and cost-effective model (16K context)

### Configuration Options
- `model` - Specify which model to use
- `temperature` - Control randomness (0.0 to 2.0)
- `max_tokens` - Maximum tokens to generate
- `top_p` - Nucleus sampling parameter
- `frequency_penalty` - Reduce repetition (-2.0 to 2.0)
- `presence_penalty` - Increase topic diversity (-2.0 to 2.0)

### Example Usage
```typescript
import OpenAIProvider from '@/services/llm-providers/openai-service';

const openai = new OpenAIProvider();

// Chat completion
const response = await openai.chat({
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  model: 'gpt-4o',
  temperature: 0.7
});

// Streaming chat
const stream = await openai.streamChat({
  messages: [
    { role: 'user', content: 'Write a story about a robot learning to paint' }
  ],
  model: 'gpt-4o',
  temperature: 0.8
});
```

### Rate Limits
- RPM (Requests Per Minute): Varies by model and account tier
- TPM (Tokens Per Minute): Varies by model and account tier
- RPD (Requests Per Day): Varies by model and account tier

## Anthropic

### Overview
Anthropic provides Claude models known for their helpful, honest, and harmless responses. Claude models excel at reasoning tasks and have long context windows.

### Setup
1. Obtain an API key from [Anthropic Console](https://console.anthropic.com/)
2. Add the key to your environment variables:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
   ```

### Available Models
- `claude-3-5-sonnet-20241022` - Most capable model (200K context)
- `claude-3-opus-20240229` - Complex reasoning (200K context)
- `claude-3-sonnet-20240229` - Balanced performance (200K context)
- `claude-3-haiku-20240307` - Fastest model (200K context)

### Configuration Options
- `model` - Specify which model to use
- `temperature` - Control randomness (0.0 to 1.0)
- `max_tokens` - Maximum tokens to generate (1-4096)
- `top_p` - Nucleus sampling parameter
- `top_k` - Top-k sampling parameter

### Example Usage
```typescript
import AnthropicProvider from '@/services/llm-providers/anthropic-service';

const anthropic = new AnthropicProvider();

// Chat completion
const response = await anthropic.chat({
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7
});

// Streaming chat
const stream = await anthropic.streamChat({
  messages: [
    { role: 'user', content: 'Write a detailed analysis of climate change' }
  ],
  model: 'claude-3-opus-20240229',
  temperature: 0.5
});
```

### Rate Limits
- TPM (Tokens Per Minute): 40,000 for Claude 3 models
- RPM (Requests Per Minute): 1,000 for Claude 3 models
- Concurrent requests: 5 for Claude 3 models

## Google AI (Gemini)

### Overview
Google AI provides Gemini models that excel at multimodal tasks and have extremely long context windows. Gemini models are competitive with other leading models in various benchmarks.

### Setup
1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/)
2. Add the key to your environment variables:
   ```bash
   GOOGLE_AI_API_KEY=your-google-ai-api-key
   ```

### Available Models
- `gemini-1.5-pro` - Most capable model (1M context)
- `gemini-1.5-flash` - Fast and efficient model (1M context)
- `gemini-pro` - Text generation model (32K context)
- `gemini-pro-vision` - Multimodal model (16K context)

### Configuration Options
- `model` - Specify which model to use
- `temperature` - Control randomness (0.0 to 1.0)
- `maxOutputTokens` - Maximum tokens to generate
- `topP` - Nucleus sampling parameter
- `topK` - Top-k sampling parameter
- `safetySettings` - Content safety filters

### Example Usage
```typescript
import GoogleAIProvider from '@/services/llm-providers/google-ai-service';

const googleAI = new GoogleAIProvider();

// Chat completion
const response = await googleAI.chat({
  messages: [
    { role: 'user', content: 'How does photosynthesis work?' }
  ],
  model: 'gemini-1.5-pro',
  temperature: 0.7
});

// Streaming chat
const stream = await googleAI.streamChat({
  messages: [
    { role: 'user', content: 'Write a research paper on renewable energy' }
  ],
  model: 'gemini-1.5-pro',
  temperature: 0.6
});
```

### Rate Limits
- RPM (Requests Per Minute): 60 for Gemini 1.5 models
- TPM (Tokens Per Minute): 32,768 for Gemini 1.5 models
- RPD (Requests Per Day): 1,500 for Gemini 1.5 models

## OpenRouter

### Overview
OpenRouter provides access to over 100 models from various providers including OpenAI, Anthropic, Google, and open-source models. It offers automatic model routing and unified API access.

### Setup
1. Obtain an API key from [OpenRouter](https://openrouter.ai/)
2. Add the key to your environment variables:
   ```bash
   OPENROUTER_API_KEY=sk-or-your-openrouter-api-key
   ```

### Available Models
- `openrouter/auto` - Automatic model routing
- `openai/gpt-4o` - OpenAI's GPT-4o
- `anthropic/claude-3.5-sonnet` - Anthropic's Claude 3.5 Sonnet
- `google/gemini-pro` - Google's Gemini Pro
- `meta-llama/llama-3.1-70b-instruct` - Meta's Llama 3.1 70B

### Configuration Options
- `model` - Specify which model to use
- `temperature` - Control randomness (0.0 to 2.0)
- `max_tokens` - Maximum tokens to generate
- `top_p` - Nucleus sampling parameter
- `frequency_penalty` - Reduce repetition
- `presence_penalty` - Increase topic diversity
- `provider` - Specify preferred provider for routing

### Example Usage
```typescript
import OpenRouterProvider from '@/services/llm-providers/openrouter-service';

const openrouter = new OpenRouterProvider();

// Chat completion
const response = await openrouter.chat({
  messages: [
    { role: 'user', content: 'What are the latest advancements in AI?' }
  ],
  model: 'openai/gpt-4o',
  temperature: 0.7
});

// Streaming chat
const stream = await openrouter.streamChat({
  messages: [
    { role: 'user', content: 'Write a comparative analysis of AI models' }
  ],
  model: 'openrouter/auto',
  temperature: 0.8
});
```

### Rate Limits
- Varies by underlying provider
- Generally follows the rate limits of the selected model's original provider
- Some models may have additional OpenRouter-specific limits

## Grok

### Overview
Grok is xAI's large language model trained on Twitter data. It's designed to be helpful, humorous, and rebellious while maintaining factual accuracy.

### Setup
1. Obtain an API key from [xAI](https://x.ai/)
2. Add the key to your environment variables:
   ```bash
   GROK_API_KEY=your-grok-api-key
   ```

### Available Models
- `grok-beta` - Latest Grok model
- `grok-2` - Previous generation model

### Configuration Options
- `model` - Specify which model to use
- `temperature` - Control randomness (0.0 to 2.0)
- `max_tokens` - Maximum tokens to generate
- `top_p` - Nucleus sampling parameter

### Example Usage
```typescript
import GrokProvider from '@/services/llm-providers/grok-service';

const grok = new GrokProvider();

// Chat completion
const response = await grok.chat({
  messages: [
    { role: 'user', content: 'What are people saying about AI today?' }
  ],
  model: 'grok-beta',
  temperature: 0.7
});

// Streaming chat
const stream = await grok.streamChat({
  messages: [
    { role: 'user', content: 'Write a witty tweet about programming' }
  ],
  model: 'grok-beta',
  temperature: 0.9
});
```

### Rate Limits
- RPM (Requests Per Minute): 30
- TPM (Tokens Per Minute): 150,000
- RPD (Requests Per Day): 1,000

## Implementation Details

### Provider Interface
All providers implement a standardized interface:

```typescript
interface LLMProvider {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  model: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  maxContextLength: number;
  availableModels: ModelOption[];
  
  validateConfig(config: ProviderConfig): Promise<boolean>;
  getModels(): Promise<ModelOption[]>;
  chat(options: ChatOptions): Promise<ChatResponse>;
  streamChat(options: ChatOptions): Promise<StreamResponse>;
}
```

### Configuration Management
API keys are securely stored using AES-256 encryption:

1. Keys are encrypted before being stored in the database
2. Only the user can decrypt their own keys
3. Keys are never logged or exposed in plaintext
4. Keys are validated before use

### Error Handling
All providers implement comprehensive error handling:

1. Network errors are caught and retried
2. Rate limit errors are handled with exponential backoff
3. Invalid API keys are detected and reported
4. Provider-specific errors are normalized

### Streaming Support
All providers support streaming responses:

1. Server-Sent Events (SSE) for real-time responses
2. Proper error handling during streaming
3. Connection timeout management
4. Graceful termination handling

## Best Practices

### API Key Security
1. Never hardcode API keys in source code
2. Use environment variables for configuration
3. Rotate keys regularly
4. Monitor key usage and set alerts

### Rate Limit Management
1. Implement proper rate limiting in your application
2. Use exponential backoff for retry logic
3. Cache model responses when appropriate
4. Monitor usage against provider limits

### Model Selection
1. Choose models based on your specific use case
2. Consider context length requirements
3. Balance between performance and cost
4. Test different models for quality and speed

### Error Handling
1. Always implement proper error handling
2. Log errors for debugging and monitoring
3. Provide user-friendly error messages
4. Implement fallback mechanisms

## Troubleshooting

### Common Issues

1. **Invalid API Key**
   - Verify the key format matches provider requirements
   - Check that the key has proper permissions
   - Ensure the key hasn't expired

2. **Rate Limiting**
   - Implement proper rate limiting in your application
   - Use exponential backoff for retry logic
   - Consider upgrading your provider plan

3. **Network Errors**
   - Check internet connectivity
   - Verify provider API status
   - Implement retry logic with timeouts

4. **Model Unavailable**
   - Check provider documentation for model availability
   - Verify your account has access to the model
   - Try alternative models

### Debugging Steps

1. **Check API Key**
   ```bash
   # Test your API key with curl
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

2. **Verify Environment Variables**
   ```bash
   # Check that environment variables are set
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   ```

3. **Review Logs**
   ```bash
   # Check application logs for errors
   tail -f logs/application.log
   ```

4. **Test Connectivity**
   ```bash
   # Test provider connectivity
   ping api.openai.com
   ping api.anthropic.com
   ```

## Provider Comparison

| Provider | Model | Context Length | Strengths | Weaknesses |
|----------|-------|---------------|-----------|------------|
| OpenAI | GPT-4o | 128K tokens | General purpose, coding | Expensive |
| Anthropic | Claude 3.5 Sonnet | 200K tokens | Reasoning, long context | Slower response |
| Google AI | Gemini 1.5 Pro | 1M tokens | Multimodal, massive context | Less consistent |
| OpenRouter | Auto | Varies | Model variety, routing | Dependent on underlying providers |
| Grok | Grok Beta | 128K tokens | Current events, humor | Limited availability |

## Further Reading

- [API Documentation](./api-documentation.md)
- [Security Guide](./security-guide.md)
- [Performance Optimization](./performance-optimization.md)
- [Rate Limiting](./rate-limiting.md)