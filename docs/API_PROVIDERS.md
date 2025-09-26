# API Providers Documentation

## Overview

RealMultiLLM supports multiple AI/LLM providers, allowing users to interact with different language models through a unified interface. This document provides comprehensive information about each supported provider.

## Supported Providers

### 1. OpenAI

**Provider ID:** `openai`
**Default Model:** `gpt-4o`
**API Endpoint:** `https://api.openai.com/v1/chat/completions`

**Supported Models:**
- `gpt-4o` (Default)
- `gpt-4o-mini`
- `gpt-4-turbo`
- `gpt-4`
- `gpt-3.5-turbo`

**Features:**
- Chat completions
- System prompts
- Temperature control
- Token usage tracking
- Streaming support

**API Key:** Set `OPENAI_API_KEY` in your environment variables.

**Cost:** Variable based on model and token usage. See [OpenAI Pricing](https://openai.com/pricing).

---

### 2. Anthropic (Claude)

**Provider ID:** `claude`
**Default Model:** `claude-3-opus-20240229`
**API Endpoint:** `https://api.anthropic.com/v1/messages`

**Supported Models:**
- `claude-3-opus-20240229` (Default)
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`
- `claude-2.1`
- `claude-2.0`

**Features:**
- Message-based conversations
- System instructions
- Temperature control
- Token usage tracking
- Large context windows

**API Key:** Set `ANTHROPIC_API_KEY` in your environment variables.

**Cost:** Variable based on model and token usage. See [Anthropic Pricing](https://www.anthropic.com/pricing).

---

### 3. Google AI (Gemini)

**Provider ID:** `google-ai` or `gemini`
**Default Model:** `gemini-1.5-pro`
**API Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/`

**Supported Models:**
- `gemini-1.5-pro` (Default)
- `gemini-1.5-flash`
- `gemini-1.0-pro`

**Features:**
- Content generation
- System instructions
- Temperature control
- Token usage tracking
- Multimodal capabilities (text, images)

**API Key:** Set `GOOGLE_AI_API_KEY` in your environment variables.

**Cost:** Variable based on model and token usage. See [Google AI Pricing](https://ai.google.dev/pricing).

---

### 4. Hugging Face

**Provider ID:** `huggingface`
**Default Model:** `microsoft/DialoGPT-large`
**API Endpoint:** `https://api-inference.huggingface.co/models/`

**Supported Models:**
- `microsoft/DialoGPT-large` (Default)
- `microsoft/DialoGPT-medium`
- `microsoft/DialoGPT-small`
- `facebook/blenderbot-400M-distill`
- `EleutherAI/gpt-j-6B`
- `bigscience/bloom-560m`
- Custom models available on Hugging Face Hub

**Features:**
- Text generation
- Wide model selection
- Custom model support
- Temperature control
- Free tier available

**API Key:** Set `HUGGINGFACE_API_KEY` in your environment variables.

**Cost:** Free tier available with rate limits. See [Hugging Face Pricing](https://huggingface.co/pricing).

---

### 5. Cohere

**Provider ID:** `cohere`
**Default Model:** `command`
**API Endpoint:** `https://api.cohere.ai/v1/generate`

**Supported Models:**
- `command` (Default)
- `command-light`
- `command-nightly`

**Features:**
- Text generation
- Temperature control
- Truncation control
- Enterprise-grade security
- Multilingual support

**API Key:** Set `COHERE_API_KEY` in your environment variables.

**Cost:** Usage-based pricing. See [Cohere Pricing](https://cohere.ai/pricing).

---

### 6. Mistral AI

**Provider ID:** `mistral`
**Default Model:** `mistral-large-latest`
**API Endpoint:** `https://api.mistral.ai/v1/chat/completions`

**Supported Models:**
- `mistral-large-latest` (Default)
- `mistral-medium-latest`
- `mistral-small-latest`
- `open-mistral-7b`
- `open-mixtral-8x7b`

**Features:**
- Chat completions
- System prompts
- Temperature control
- Token usage tracking
- Open-source models available

**API Key:** Set `MISTRAL_API_KEY` in your environment variables.

**Cost:** Variable based on model and token usage. See [Mistral Pricing](https://mistral.ai/pricing).

---

### 7. Together AI

**Provider ID:** `together`
**Default Model:** `meta-llama/Llama-2-70b-chat-hf`
**API Endpoint:** `https://api.together.xyz/v1/chat/completions`

**Supported Models:**
- `meta-llama/Llama-2-70b-chat-hf` (Default)
- `meta-llama/Llama-2-13b-chat-hf`
- `meta-llama/Llama-2-7b-chat-hf`
- `togethercomputer/RedPajama-INCITE-7B-Chat`
- `NousResearch/Nous-Hermes-Llama2-13b`
- `WizardLM/WizardLM-13B-V1.2`
- Many other open-source models

**Features:**
- Wide selection of open-source models
- Chat completions
- System prompts
- Temperature control
- Token usage tracking
- Cost-effective pricing

**API Key:** Set `TOGETHER_API_KEY` in your environment variables.

**Cost:** Competitive pricing for open-source models. See [Together Pricing](https://together.ai/pricing).

## Usage

### Basic API Call

```typescript
import { callLLM } from '@/services/api-client';

const response = await callLLM(
  'openai',           // provider
  'Hello, world!',    // prompt
  apiKey,            // API key
  {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2048
  }
);

console.log(response.content);
```

### Multi-turn Conversation

```typescript
const conversation = [
  'Hello!',
  'Hi there! How can I help you?',
  'What is the capital of France?'
];

const response = await callLLM(
  'claude',
  conversation,
  apiKey,
  {
    model: 'claude-3-opus-20240229',
    systemPrompt: 'You are a helpful assistant.',
    temperature: 0.5
  }
);
```

### Provider-Specific Features

#### Google AI with System Instructions

```typescript
const response = await callLLM(
  'google-ai',
  'Explain quantum physics',
  apiKey,
  {
    model: 'gemini-1.5-pro',
    systemPrompt: 'You are a physics professor. Explain concepts clearly and concisely.',
    temperature: 0.3
  }
);
```

#### Hugging Face with Custom Model

```typescript
const response = await callLLM(
  'huggingface',
  'Write a poem about AI',
  apiKey,
  {
    model: 'EleutherAI/gpt-j-6B',
    temperature: 0.8,
    maxTokens: 512
  }
);
```

## Error Handling

All providers implement consistent error handling:

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

## Performance Considerations

### Token Usage

Each provider tracks token usage differently:

- **OpenAI/Mistral/Together:** Full token usage breakdown (prompt + completion)
- **Claude:** Input and output tokens
- **Google AI:** Detailed token count with metadata
- **Cohere:** Basic usage tracking
- **Hugging Face:** No token tracking (model-dependent)

### Rate Limits

Provider-specific rate limits apply:

- **OpenAI:** Model-dependent (RPM/TPM)
- **Claude:** Tier-based limits
- **Google AI:** Generous free tier
- **Hugging Face:** Free tier limitations
- **Cohere:** Usage-based
- **Mistral:** Model-dependent
- **Together:** Competitive limits

## Best Practices

1. **API Key Security:** Never expose API keys in client-side code
2. **Error Handling:** Implement retry logic with exponential backoff
3. **Model Selection:** Choose models based on cost/performance requirements
4. **Rate Limiting:** Implement client-side rate limiting
5. **Monitoring:** Track usage and costs across providers
6. **Fallback Strategy:** Use multiple providers for redundancy

## Model Recommendations

### General Chat
- **OpenAI:** `gpt-4o` (balanced performance/cost)
- **Claude:** `claude-3-sonnet-20240229` (good reasoning)
- **Google AI:** `gemini-1.5-pro` (large context)

### Cost-Effective
- **Together:** `meta-llama/Llama-2-13b-chat-hf`
- **Hugging Face:** Various open-source models
- **Mistral:** `mistral-small-latest`

### High Performance
- **OpenAI:** `gpt-4o`
- **Claude:** `claude-3-opus-20240229`
- **Mistral:** `mistral-large-latest`

### Specialized Tasks
- **Code:** OpenAI GPT-4, Claude Opus
- **Creative Writing:** Claude models
- **Analysis:** Google AI Gemini
- **Multilingual:** Cohere Command

## Integration Testing

Use the provided test suite to verify provider integrations:

```bash
npm test -- --grep "API providers"
```

## Troubleshooting

### Common Issues

1. **Invalid API Key:** Verify key format and permissions
2. **Rate Limits:** Implement backoff strategies
3. **Model Not Found:** Check model availability and spelling
4. **Network Issues:** Add retry logic and timeout handling
5. **Response Parsing:** Handle varying response formats

### Debug Mode

Enable debug logging:

```typescript
process.env.DEBUG = 'api-client:*';
```

This comprehensive documentation should help users understand and effectively use all supported API providers in RealMultiLLM.