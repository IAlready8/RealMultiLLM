# API Integration Guide

This guide explains how to integrate new API providers into RealMultiLLM and use the existing provider system.

## Architecture Overview

The RealMultiLLM platform uses a modular architecture for API providers:

1. **Provider Configuration** (`lib/providers.ts`) - Contains metadata about each provider
2. **API Client** (`services/api-client.ts`) - Handles actual API calls
3. **UI Components** (`components/provider-selector.tsx`) - User interface for provider selection
4. **Settings Management** (`app/settings/page.tsx`) - Configuration interface

## Adding a New Provider

### Step 1: Update Provider Configuration

Add your provider to `lib/providers.ts`:

```typescript
export const PROVIDERS: Record<string, ProviderConfig> = {
  // ... existing providers
  'your-provider': {
    id: 'your-provider',
    name: 'Your Provider Name',
    description: 'Brief description of the provider',
    website: 'https://your-provider.com',
    defaultModel: 'your-default-model',
    apiKeyEnv: 'YOUR_PROVIDER_API_KEY',
    requiresAuth: true,
    pricing: 'paid', // 'free' | 'paid' | 'freemium'
    color: '#YOUR_HEX_COLOR',
    models: [
      {
        id: 'your-model-id',
        name: 'Your Model Name',
        description: 'Model description',
        contextWindow: 4096,
        costPer1KTokens: { input: 0.001, output: 0.002 },
        capabilities: ['text', 'code', 'reasoning']
      }
    ],
    features: ['Feature 1', 'Feature 2', 'Feature 3']
  }
};
```

### Step 2: Implement API Client Function

Add your provider handler in `services/api-client.ts`:

```typescript
// Add case to the switch statement
case "your-provider":
  response = await callYourProvider(prompt, apiKey, options);
  break;

// Implement the provider function
async function callYourProvider(
  prompt: string | string[],
  apiKey: string,
  options: LLMRequestOptions
): Promise<LLMResponse> {
  // Convert prompt to your provider's format
  const formattedPrompt = Array.isArray(prompt) ? prompt.join("\n") : prompt;

  // Make API call
  const response = await fetch("https://api.your-provider.com/v1/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || "your-default-model",
      prompt: formattedPrompt,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      // Add other provider-specific options
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error calling Your Provider API");
  }

  const data = await response.json();

  // Return standardized response
  return {
    role: 'assistant',
    content: data.choices[0].text, // Adjust based on your API response
    timestamp: Date.now(),
    metadata: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    }
  };
}
```

### Step 3: Update Environment Variables

Add your API key to `.env.example`:

```bash
# Your Provider API Key
YOUR_PROVIDER_API_KEY=
```

### Step 4: Test Integration

1. Add your API key to `.env.local`
2. Test the provider in the settings page
3. Verify it works in the chat interface

## Using the Provider System

### Basic Usage

```typescript
import { callLLM } from '@/services/api-client';

const response = await callLLM(
  'your-provider',
  'Hello, world!',
  apiKey,
  {
    model: 'your-model-id',
    temperature: 0.7,
    maxTokens: 1000
  }
);
```

### Provider Selection Component

```tsx
import { ProviderSelector } from '@/components/provider-selector';

function MyComponent() {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');

  return (
    <ProviderSelector
      selectedProvider={selectedProvider}
      selectedModel={selectedModel}
      onSelectionChange={(provider, model) => {
        setSelectedProvider(provider);
        setSelectedModel(model);
      }}
      showPricing={true}
      showCapabilities={true}
    />
  );
}
```

### Cost Calculation

```typescript
import { calculateCost, formatCost } from '@/lib/providers';

const cost = calculateCost('gpt-4o', 1000, 500); // 1000 input, 500 output tokens
const formattedCost = formatCost(cost || 0); // "$0.025"
```

## Provider-Specific Implementation Notes

### OpenAI
- Uses chat completion format
- Supports function calling
- Vision capabilities with GPT-4 models

### Claude (Anthropic)
- Uses message format
- Large context windows
- Strong reasoning capabilities

### Google AI (Gemini)
- Supports multimodal input
- Massive context windows (1M+ tokens)
- System instructions support

### Hugging Face
- Wide variety of open-source models
- Some models may have different response formats
- Free tier with rate limits

### Cohere
- Enterprise-focused
- Multilingual support
- Good for text generation

### Mistral AI
- European AI provider
- Open-source options
- Competitive pricing

### Together AI
- Platform for open-source models
- Cost-effective
- Wide model selection

## Error Handling

All providers should implement consistent error handling:

```typescript
try {
  const response = await callLLM(provider, prompt, apiKey, options);
  // Handle success
} catch (error) {
  if (error.message.includes('API key')) {
    // Handle API key issues
  } else if (error.message.includes('rate limit')) {
    // Handle rate limiting
  } else {
    // Handle other errors
  }
}
```

## Best Practices

1. **API Key Security**: Never expose API keys in client-side code
2. **Rate Limiting**: Implement client-side rate limiting
3. **Error Handling**: Provide meaningful error messages
4. **Token Tracking**: Always track token usage for cost monitoring
5. **Model Selection**: Use appropriate models for different tasks
6. **Fallback Strategy**: Have backup providers for critical applications

## Testing

Use the test suite to verify your provider integration:

```bash
npm test -- --grep "API providers"
```

## Troubleshooting

### Common Issues

1. **API Key Not Working**: Verify key format and permissions
2. **Rate Limits**: Implement exponential backoff
3. **Model Not Found**: Check model availability and spelling
4. **Response Format**: Ensure your response matches LLMResponse interface
5. **Network Errors**: Add retry logic and timeout handling

### Debug Logging

Enable debug mode:

```bash
DEBUG=api-client:* npm run dev
```

This will show detailed API call information in the console.

## Contributing

When adding new providers:

1. Follow the existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Ensure error handling is robust
5. Test with different model configurations