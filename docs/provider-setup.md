# Provider Setup and Configuration Guide

## Overview

This guide provides step-by-step instructions for setting up and configuring different AI providers in the RealMultiLLM platform. Follow these instructions to integrate your preferred providers and optimize their performance.

## Quick Setup Checklist

- [ ] Gather API keys from each provider
- [ ] Configure environment variables
- [ ] Set up rate limiting
- [ ] Test provider connectivity
- [ ] Configure models and preferences
- [ ] Validate security settings

## Provider Configuration Steps

### 1. OpenAI Setup

#### Prerequisites
- OpenAI account with billing configured
- API key with appropriate permissions

#### Step-by-Step Setup:
1. **Create OpenAI Account**
   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Navigate to "API Keys" section
   - Create or copy an existing API key

2. **Configure API Key**
   - Option A: Set in environment variable:
     ```bash
     OPENAI_API_KEY=sk-your-openai-api-key
     ```
   - Option B: Add via UI in Settings > API Keys
   - Option C: Encrypt and store in database

3. **Configure Model Preferences**
   - Default model: `gpt-4o`
   - Available models:
     - `gpt-4o` (latest best model)
     - `gpt-4o-mini` (cost-effective)
     - `gpt-4-turbo` (balanced)
     - `gpt-3.5-turbo` (fastest)

4. **Set Rate Limits**
   - Per-minute requests: 60 (default)
   - Per-minute tokens: 10,000 (default)

5. **Validate Configuration**
   - Test API key connectivity
   - Verify model list retrieval
   - Test streaming functionality

#### Configuration Example:
```typescript
const openAIConfig = {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,
  rateLimit: {
    maxRequests: 60,
    windowMs: 60000
  }
};
```

### 2. Anthropic (Claude) Setup

#### Prerequisites
- Anthropic account with Claude access
- API key (starts with `sk-ant-`)

#### Step-by-Step Setup:
1. **Get Anthropic API Access**
   - Sign up at [anthropic.com](https://www.anthropic.com/)
   - Request API access through the developer portal
   - Once approved, generate an API key

2. **Configure API Key**
   - Add to environment:
     ```bash
     ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
     ```
   - Or add via UI in Settings > API Keys

3. **Configure Model Preferences**
   - Default model: `claude-3-5-sonnet-20241022`
   - Available models:
     - `claude-3-5-sonnet-20241022` (most capable)
     - `claude-3-opus-20240229` (high-level reasoning)
     - `claude-3-sonnet-20240229` (balanced)
     - `claude-3-haiku-20240307` (fastest)

4. **Configure Claude-Specific Settings**
   - System prompt support: Enabled
   - Max tokens: 4,096 (Claude 3 models)
   - Temperature: Recommended 0.5-0.7

5. **Validate Configuration**
   - Test API connectivity
   - Verify Claude-specific features (system prompts)
   - Test tool use functionality

#### Configuration Example:
```typescript
const anthropicConfig = {
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: 'You are a helpful AI assistant.',
  rateLimit: {
    maxRequests: 40,
    windowMs: 60000
  }
};
```

### 3. Google AI (Gemini) Setup

#### Prerequisites
- Google Cloud account
- Google AI API enabled
- Billing account configured

#### Step-by-Step Setup:
1. **Enable Google AI API**
   - Go to Google Cloud Console
   - Create or select a project
   - Enable the "Generative Language API"
   - Create an API key

2. **Configure API Key**
   - Add to environment:
     ```bash
     GOOGLE_AI_API_KEY=your-google-ai-api-key
     ```
   - Or add via UI in Settings > API Keys

3. **Configure Model Preferences**
   - Default model: `gemini-1.5-pro`
   - Available models:
     - `gemini-1.5-pro` (most capable)
     - `gemini-1.5-flash` (fast and efficient)
     - `gemini-pro` (text generation)
     - `gemini-pro-vision` (multimodal)

4. **Enable Features**
   - Multimodal support: Available for vision models
   - Function calling: Supported with schema definitions
   - Safety settings: Configurable safety thresholds

5. **Validate Configuration**
   - Test API connectivity
   - Verify model list retrieval
   - Test multimodal capabilities (if applicable)

#### Configuration Example:
```typescript
const googleAIConfig = {
  provider: 'google-ai',
  apiKey: process.env.GOOGLE_AI_API_KEY,
  model: 'gemini-1.5-pro',
  temperature: 0.5,
  maxTokens: 8192,
  safetySettings: [
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    }
  ],
  rateLimit: {
    maxRequests: 50,
    windowMs: 60000
  }
};
```

### 4. OpenRouter Setup

#### Prerequisites
- OpenRouter account
- API key with appropriate model access

#### Step-by-Step Setup:
1. **Create OpenRouter Account**
   - Sign up at [openrouter.ai](https://openrouter.ai/)
   - Navigate to "API Keys" section
   - Create or copy an existing API key

2. **Configure API Key**
   - Add to environment:
     ```bash
     OPENROUTER_API_KEY=sk-or-your-openrouter-api-key
     ```
   - Or add via UI in Settings > API Keys

3. **Select Models**
   - Access to 100+ models from various providers
   - Popular models:
     - `openai/gpt-4o` (OpenAI)
     - `anthropic/claude-3.5-sonnet` (Anthropic)
     - `google/gemini-pro` (Google)
     - `meta-llama/llama-3.1-70b-instruct` (Meta)

4. **Configure Pricing Tracking**
   - OpenRouter provides cost tracking
   - Monitor usage per model
   - Set spending limits if needed

5. **Validate Configuration**
   - Test API connectivity
   - Verify model list retrieval
   - Test cross-provider routing

#### Configuration Example:
```typescript
const openRouterConfig = {
  provider: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'openai/gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,
  providerPreferences: {
    allow_fallbacks: true,
    route: "fallback" // Use fallback routing
  },
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000
  }
};
```

### 5. Llama (Hugging Face) Setup

#### Prerequisites
- Hugging Face account
- Access to Llama models (if private)
- API key with appropriate permissions

#### Step-by-Step Setup:
1. **Get Hugging Face Access**
   - Sign up at [huggingface.co](https://huggingface.co/)
   - Navigate to "Settings" > "Access Tokens"
   - Create a new token with "read" permissions

2. **Configure API Key**
   - Add to environment:
     ```bash
     HUGGING_FACE_API_KEY=hf-your-huggingface-api-key
     ```
   - Or add via UI in Settings > API Keys

3. **Select Llama Models**
   - Default model: `meta-llama/Llama-3.1-8B-Instruct`
   - Available models:
     - `meta-llama/Llama-3.1-8B-Instruct`
     - `meta-llama/Llama-3.1-70B-Instruct`
     - `meta-llama/Llama-3.1-405B-Instruct`

4. **Configure Model Parameters**
   - Consider longer processing times for large models
   - Adjust temperature for creative vs precise outputs
   - Set appropriate max tokens based on model capability

5. **Validate Configuration**
   - Test API connectivity
   - Verify model availability
   - Test response times (can be slower than closed models)

#### Configuration Example:
```typescript
const llamaConfig = {
  provider: 'hugging-face',
  apiKey: process.env.HUGGING_FACE_API_KEY,
  model: 'meta-llama/Llama-3.1-8B-Instruct',
  temperature: 0.7,
  maxTokens: 2048,
  parameters: {
    top_p: 0.9,
    repetition_penalty: 1.1
  },
  rateLimit: {
    maxRequests: 30,
    windowMs: 60000
  }
};
```

## Multi-Provider Configuration

### Configuration Schema
```typescript
interface MultiProviderConfig {
  providers: {
    openai?: ProviderConfig;
    anthropic?: ProviderConfig;
    google?: ProviderConfig;
    openrouter?: ProviderConfig;
    huggingface?: ProviderConfig;
    [key: string]: ProviderConfig | undefined;
  };
  defaultProvider?: string;
  fallbackProviders?: string[];
  loadBalancing?: 'round-robin' | 'performance' | 'cost';
  routingRules?: RoutingRule[];
}
```

### Loading Multiple Providers
```typescript
const multiProviderConfig: MultiProviderConfig = {
  providers: {
    openai: openAIConfig,
    anthropic: anthropicConfig,
    google: googleAIConfig,
    openrouter: openRouterConfig
  },
  defaultProvider: 'openai',
  fallbackProviders: ['anthropic', 'google'],
  loadBalancing: 'performance',
  routingRules: [
    {
      condition: 'high-accuracy-required',
      provider: 'anthropic'
    },
    {
      condition: 'cost-sensitive',
      provider: 'huggingface'
    }
  ]
};
```

## Performance Optimization

### Model Selection
- Choose appropriate models for your use case
- Balance between performance and cost
- Consider response time requirements

### Rate Limiting Configuration
- Set appropriate limits based on provider quotas
- Implement adaptive rate limiting
- Monitor usage against limits

### Caching Strategies
- Cache model list responses
- Cache common API responses
- Implement smart caching based on content type

### Connection Pooling
- Maintain persistent connections where possible
- Reuse connections across requests
- Handle connection failures gracefully

## Security Configuration

### API Key Security
- Use encrypted storage for API keys
- Regular rotation of keys
- Environment-specific keys
- Monitor for unauthorized access

### Data Privacy
- Review provider data usage policies
- Implement data anonymization where needed
- Ensure compliance with data protection regulations

### Access Control
- Restrict API key access based on user roles
- Log API key usage
- Implement audit trails

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify API key format
   - Check for typos in environment variables
   - Ensure API key has required permissions

2. **Rate Limiting Issues**
   - Adjust rate limit values in configuration
   - Check provider-specific rate limits
   - Implement exponential backoff

3. **Model Availability**
   - Verify model names are correct
   - Check if models are accessible in your region
   - Confirm billing is properly configured

4. **Connectivity Problems**
   - Check network connectivity
   - Verify proxy settings if applicable
   - Test API endpoints directly

### Diagnostic Commands
```bash
# Test API connectivity
npm run test:api-keys

# Validate configuration files
npm run validate:config

# Check environment variables
npm run check:env
```

## Testing Your Configuration

### Automated Tests
```bash
# Run provider connectivity tests
npm run test:providers

# Run API key validation
npm run test:api-keys

# Run integration tests
npm run test:integration
```

### Manual Validation
1. **Provider Dashboard**: Check individual provider dashboards for usage
2. **Application Logs**: Monitor application logs for errors
3. **Response Quality**: Test response quality and accuracy
4. **Performance Metrics**: Measure response times and throughput

## Advanced Configuration

### Custom Provider Integration
For providers not directly supported, extend the provider interface:

```typescript
class CustomProvider implements LLMProvider {
  id = 'custom-provider';
  name = 'Custom Provider';
  
  async streamChat(messages: Message[], options?: ChatOptions): Promise<StreamResponse> {
    // Implement custom provider logic
  }
}

// Register the provider
registerProvider(new CustomProvider());
```

### Environment-Specific Configurations
Create different configurations for different environments:

```typescript
const config = {
  development: {
    ...developmentConfig,
    rateLimit: { maxRequests: 1000, windowMs: 60000 }
  },
  staging: {
    ...stagingConfig,
    rateLimit: { maxRequests: 100, windowMs: 60000 }
  },
  production: {
    ...productionConfig,
    rateLimit: { maxRequests: 60, windowMs: 60000 }
  }
};
```

## Monitoring and Maintenance

### Key Metrics
- API response times
- Success/error rates
- Token usage
- Cost tracking
- User satisfaction

### Maintenance Tasks
- Regular key rotation
- Model performance evaluation
- Cost optimization
- Security audits

## Best Practices

### Configuration Management
1. **Environment Segregation**: Use different API keys for dev/staging/production
2. **Documentation**: Keep configuration documentation up to date
3. **Version Control**: Track configuration changes
4. **Backup**: Maintain backup configurations

### Provider Selection
1. **Use Case Matching**: Select providers based on specific use case requirements
2. **Performance Testing**: Regularly test provider performance
3. **Cost Analysis**: Monitor costs across providers
4. **Reliability**: Evaluate provider uptime and reliability

### Security
1. **Principle of Least Privilege**: Grant minimal required permissions
2. **Regular Audits**: Perform regular security audits
3. **Incident Response**: Have incident response procedures
4. **Compliance**: Ensure compliance with relevant regulations