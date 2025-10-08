# Provider Integration Documentation

## Overview

The RealMultiLLM platform supports multiple AI providers with a standardized integration approach. This document provides comprehensive information about integrating with different LLM providers and optimizing their usage.

## Supported Providers

### 1. OpenAI
- Models: GPT-3.5 Turbo, GPT-4, GPT-4 Turbo, GPT-4o, GPT-4o Mini
- API Key: `OPENAI_API_KEY`
- Rate Limits: Configurable via environment variables
- Features: Streaming, function calling, JSON mode

### 2. Anthropic (Claude)
- Models: Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku, Claude 2.1
- API Key: `ANTHROPIC_API_KEY`
- Rate Limits: Configurable via environment variables
- Features: Streaming, system prompts, tool use

### 3. Google AI (Gemini)
- Models: Gemini Pro, Gemini Pro Vision, Gemini 1.5 Pro, Gemini 1.5 Flash
- API Key: `GOOGLE_AI_API_KEY`
- Rate Limits: Configurable via environment variables
- Features: Streaming, multimodal, function calling

### 4. OpenRouter
- Models: Access to 100+ models from various providers
- API Key: `OPENROUTER_API_KEY`
- Rate Limits: Configurable via environment variables
- Features: Unified API, model comparison

### 5. Llama (via Hugging Face)
- Models: Llama 2, Llama 3, and variants
- API Key: `HUGGING_FACE_API_KEY`
- Rate Limits: Configurable via environment variables
- Features: Open source models, self-hosted options

### 6. Grok
- Models: Grok, Grok Beta
- API Key: `GROK_API_KEY`
- Rate Limits: Configurable via environment variables
- Features: Large context, research-focused

### 7. GitHub Copilot
- Models: GitHub Copilot, Copilot Chat
- API Key: `GITHUB_TOKEN`
- Rate Limits: Configurable via environment variables
- Features: Code completion, explanations

## Integration Architecture

### Service Layer
The provider integration follows a standardized service layer approach:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Routes    │───▶│  LLM Services   │───▶│ Provider Client │
│   (app/api)     │    │ (services/)     │    │ (services/)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Client Interface
All providers implement a common interface:

```typescript
interface LLMProvider {
  id: string;
  name: string;
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
  model: string;
  availableModels: ModelOption[];
  maxTokens: number;
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  maxContextLength: number;
  
  // Core methods
  validateConfig(config: ProviderConfig): Promise<boolean>;
  getModels(): Promise<ModelOption[]>;
  streamChat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<StreamResponse>;
}
```

### Configuration Schema
Each provider has a standardized configuration schema:

```typescript
interface ProviderConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  systemPrompt?: string;
  stream?: boolean;
}
```

## Integration Process

### 1. Adding a New Provider

1. Create a provider service file in `services/llm-providers/`
2. Implement the `LLMProvider` interface
3. Register the provider in the provider registry
4. Add UI components for configuration
5. Include in the streaming client
6. Update documentation

### 2. Provider Client Implementation

Each provider client should implement:

```typescript
class OpenAIProvider implements LLMProvider {
  // Properties
  id = 'openai';
  name = 'OpenAI';
  // ... other properties

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    // Validate API key and model availability
  }

  async getModels(): Promise<ModelOption[]> {
    // Fetch available models from API
  }

  async streamChat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<StreamResponse> {
    // Implement streaming chat functionality
  }
}
```

### 3. Error Handling

Providers implement comprehensive error handling:

- API key validation
- Rate limit detection and handling
- Network error recovery
- Fallback mechanisms
- Detailed error messages

### 4. Rate Limiting

All providers support configurable rate limiting:

```typescript
// Rate limiting configuration
interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
  message: string;
}

// Applied globally and per provider
```

## Environment Variables

### Required Variables
- `ENCRYPTION_MASTER_KEY`: 64-character hex key for API key encryption
- `NEXTAUTH_SECRET`: Secret for NextAuth
- `DATABASE_URL`: Database connection string

### Provider-Specific Variables
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key
- `GOOGLE_AI_API_KEY`: Google AI API key
- `OPENROUTER_API_KEY`: OpenRouter API key
- `HUGGING_FACE_API_KEY`: Hugging Face API key
- `GROK_API_KEY`: Grok API key
- `GITHUB_TOKEN`: GitHub token for Copilot

## Security Considerations

1. **API Key Encryption**: All API keys are encrypted using AES-256 encryption
2. **Environment Validation**: Required environment variables are validated on startup
3. **Rate Limiting**: Configurable rate limits to prevent abuse
4. **CORS Protection**: Proper CORS configuration for API endpoints
5. **Input Sanitization**: Messages are sanitized before being sent to providers

## Performance Optimization

### Caching
- Provider model lists are cached for 1 hour
- Token usage metrics are aggregated efficiently
- Conversation history is stored in IndexedDB

### Streaming
- Server-sent events for real-time responses
- Chunk-based processing for large responses
- Connection timeout handling

### Load Balancing
- Multiple provider support allows for request distribution
- Health checks ensure provider availability
- Automatic fallback mechanisms

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify key format and permissions
   - Check for typos in environment variables
   - Ensure key is properly encrypted

2. **Rate Limiting Errors**
   - Increase rate limit values in environment
   - Check provider-specific limits
   - Implement backoff strategies

3. **Streaming Issues**
   - Verify server configuration supports streaming
   - Check for network interruptions
   - Validate message format

### Debugging

Enable detailed logging by setting `LOG_LEVEL=debug` in environment variables.

## Testing

### Unit Tests
- Provider client functionality
- Error handling scenarios
- Configuration validation
- Rate limit enforcement

### Integration Tests
- End-to-end streaming
- Multi-provider comparisons
- Authentication flows
- Database operations

## Monitoring and Analytics

### Metrics Collected
- API response times
- Token usage
- Error rates
- User engagement

### Analytics Endpoints
- Usage tracking
- Performance monitoring
- Provider comparison metrics

## Best Practices

1. **Security**: Always use encrypted API keys and validate inputs
2. **Performance**: Implement proper caching and rate limiting
3. **Reliability**: Include fallback mechanisms and health checks
4. **Maintainability**: Follow consistent interface patterns
5. **Documentation**: Keep API references up to date

## Provider-Specific Notes

### OpenAI
- Supports function calling with proper schema definition
- JSON mode available for structured outputs
- High rate limits for enterprise accounts

### Anthropic
- System prompts are first-class citizens
- Tool use requires specific formatting
- Claude models have large context windows

### Google AI
- Multimodal inputs supported (text + images)
- Function calling with schema validation
- Gemini models optimized for various tasks

### OpenRouter
- Access to multiple providers through one API
- Intelligent routing based on model availability
- Cost optimization features

## Future Enhancements

1. **Provider Agnostic Features**
   - Unified token counting
   - Cross-provider cost analysis
   - Performance benchmarking

2. **Advanced Routing**
   - Intelligent request routing
   - Cost optimization
   - Performance-based selection

3. **Enhanced Monitoring**
   - Provider-specific metrics
   - Real-time performance tracking
   - Automated alerts