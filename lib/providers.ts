export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  website: string;
  defaultModel: string;
  models: ModelConfig[];
  features: string[];
  pricing: 'free' | 'paid' | 'freemium';
  apiKeyEnv: string;
  requiresAuth: boolean;
  color: string;
  icon?: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  costPer1KTokens?: {
    input: number;
    output: number;
  };
  capabilities: string[];
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'Advanced AI models including GPT-4 and GPT-3.5',
    website: 'https://openai.com',
    defaultModel: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    requiresAuth: true,
    pricing: 'paid',
    color: '#00A67E',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4 Omni',
        description: 'Most capable model for complex tasks',
        contextWindow: 128000,
        costPer1KTokens: { input: 0.005, output: 0.015 },
        capabilities: ['text', 'code', 'reasoning', 'multimodal']
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4 Omni Mini',
        description: 'Faster, cost-effective variant of GPT-4',
        contextWindow: 128000,
        costPer1KTokens: { input: 0.00015, output: 0.0006 },
        capabilities: ['text', 'code', 'reasoning']
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'High-performance model with large context window',
        contextWindow: 128000,
        costPer1KTokens: { input: 0.01, output: 0.03 },
        capabilities: ['text', 'code', 'reasoning', 'multimodal']
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective for simpler tasks',
        contextWindow: 16385,
        costPer1KTokens: { input: 0.0005, output: 0.0015 },
        capabilities: ['text', 'code']
      }
    ],
    features: ['Chat completions', 'System prompts', 'Function calling', 'Vision', 'Streaming']
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    description: 'Constitutional AI with strong reasoning capabilities',
    website: 'https://anthropic.com',
    defaultModel: 'claude-3-opus-20240229',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    requiresAuth: true,
    pricing: 'paid',
    color: '#D4A574',
    models: [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for complex reasoning',
        contextWindow: 200000,
        costPer1KTokens: { input: 0.015, output: 0.075 },
        capabilities: ['text', 'code', 'reasoning', 'analysis', 'multimodal']
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed',
        contextWindow: 200000,
        costPer1KTokens: { input: 0.003, output: 0.015 },
        capabilities: ['text', 'code', 'reasoning', 'multimodal']
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fastest model for simple tasks',
        contextWindow: 200000,
        costPer1KTokens: { input: 0.00025, output: 0.00125 },
        capabilities: ['text', 'code', 'multimodal']
      }
    ],
    features: ['Large context window', 'Constitutional AI', 'System instructions', 'Vision', 'Code generation']
  },
  'google-ai': {
    id: 'google-ai',
    name: 'Google AI',
    description: 'Gemini models with multimodal capabilities',
    website: 'https://ai.google.dev',
    defaultModel: 'gemini-1.5-pro',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
    requiresAuth: true,
    pricing: 'freemium',
    color: '#4285F4',
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Advanced reasoning with 1M+ token context',
        contextWindow: 1048576,
        costPer1KTokens: { input: 0.00125, output: 0.005 },
        capabilities: ['text', 'code', 'reasoning', 'multimodal', 'long-context']
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Faster variant with large context',
        contextWindow: 1048576,
        costPer1KTokens: { input: 0.000075, output: 0.0003 },
        capabilities: ['text', 'code', 'multimodal', 'long-context']
      },
      {
        id: 'gemini-1.0-pro',
        name: 'Gemini 1.0 Pro',
        description: 'Reliable model for various tasks',
        contextWindow: 32768,
        costPer1KTokens: { input: 0.0005, output: 0.0015 },
        capabilities: ['text', 'code', 'reasoning']
      }
    ],
    features: ['Multimodal input', 'Massive context windows', 'Code execution', 'System instructions']
  },
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Open-source models and inference API',
    website: 'https://huggingface.co',
    defaultModel: 'microsoft/DialoGPT-large',
    apiKeyEnv: 'HUGGINGFACE_API_KEY',
    requiresAuth: true,
    pricing: 'freemium',
    color: '#FFD21E',
    models: [
      {
        id: 'microsoft/DialoGPT-large',
        name: 'DialoGPT Large',
        description: 'Conversational AI model',
        contextWindow: 1024,
        capabilities: ['text', 'conversation']
      },
      {
        id: 'EleutherAI/gpt-j-6B',
        name: 'GPT-J 6B',
        description: 'Large open-source language model',
        contextWindow: 2048,
        capabilities: ['text', 'code', 'generation']
      },
      {
        id: 'bigscience/bloom-560m',
        name: 'BLOOM 560M',
        description: 'Multilingual language model',
        contextWindow: 2048,
        capabilities: ['text', 'multilingual']
      },
      {
        id: 'facebook/blenderbot-400M-distill',
        name: 'BlenderBot 400M',
        description: 'Conversational AI with knowledge',
        contextWindow: 128,
        capabilities: ['text', 'conversation', 'knowledge']
      }
    ],
    features: ['Open source models', 'Custom model support', 'Free tier', 'Inference API']
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    description: 'Enterprise-focused language models',
    website: 'https://cohere.ai',
    defaultModel: 'command',
    apiKeyEnv: 'COHERE_API_KEY',
    requiresAuth: true,
    pricing: 'paid',
    color: '#39594C',
    models: [
      {
        id: 'command',
        name: 'Command',
        description: 'Flagship model for text generation',
        contextWindow: 4096,
        costPer1KTokens: { input: 0.001, output: 0.002 },
        capabilities: ['text', 'generation', 'reasoning']
      },
      {
        id: 'command-light',
        name: 'Command Light',
        description: 'Faster, lighter version of Command',
        contextWindow: 4096,
        costPer1KTokens: { input: 0.0003, output: 0.0006 },
        capabilities: ['text', 'generation']
      },
      {
        id: 'command-nightly',
        name: 'Command Nightly',
        description: 'Latest experimental features',
        contextWindow: 4096,
        capabilities: ['text', 'generation', 'experimental']
      }
    ],
    features: ['Enterprise security', 'Multilingual support', 'Fine-tuning', 'Embedding models']
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'European AI with open-source models',
    website: 'https://mistral.ai',
    defaultModel: 'mistral-large-latest',
    apiKeyEnv: 'MISTRAL_API_KEY',
    requiresAuth: true,
    pricing: 'paid',
    color: '#FF7000',
    models: [
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        description: 'Top-tier reasoning and capabilities',
        contextWindow: 32768,
        costPer1KTokens: { input: 0.004, output: 0.012 },
        capabilities: ['text', 'code', 'reasoning', 'multilingual']
      },
      {
        id: 'mistral-medium-latest',
        name: 'Mistral Medium',
        description: 'Balanced performance model',
        contextWindow: 32768,
        costPer1KTokens: { input: 0.00275, output: 0.0081 },
        capabilities: ['text', 'code', 'reasoning']
      },
      {
        id: 'mistral-small-latest',
        name: 'Mistral Small',
        description: 'Cost-effective for simple tasks',
        contextWindow: 32768,
        costPer1KTokens: { input: 0.002, output: 0.006 },
        capabilities: ['text', 'code']
      },
      {
        id: 'open-mistral-7b',
        name: 'Open Mistral 7B',
        description: 'Open-source model',
        contextWindow: 32768,
        costPer1KTokens: { input: 0.00025, output: 0.00025 },
        capabilities: ['text', 'code', 'open-source']
      }
    ],
    features: ['Open source options', 'European data governance', 'Function calling', 'JSON mode']
  },
  together: {
    id: 'together',
    name: 'Together AI',
    description: 'Platform for open-source AI models',
    website: 'https://together.ai',
    defaultModel: 'meta-llama/Llama-2-70b-chat-hf',
    apiKeyEnv: 'TOGETHER_API_KEY',
    requiresAuth: true,
    pricing: 'paid',
    color: '#8B5A3C',
    models: [
      {
        id: 'meta-llama/Llama-2-70b-chat-hf',
        name: 'Llama 2 70B Chat',
        description: 'Large open-source chat model',
        contextWindow: 4096,
        costPer1KTokens: { input: 0.0009, output: 0.0009 },
        capabilities: ['text', 'code', 'conversation', 'reasoning']
      },
      {
        id: 'meta-llama/Llama-2-13b-chat-hf',
        name: 'Llama 2 13B Chat',
        description: 'Medium-sized efficient chat model',
        contextWindow: 4096,
        costPer1KTokens: { input: 0.0002, output: 0.0002 },
        capabilities: ['text', 'conversation']
      },
      {
        id: 'meta-llama/Llama-2-7b-chat-hf',
        name: 'Llama 2 7B Chat',
        description: 'Compact chat model',
        contextWindow: 4096,
        costPer1KTokens: { input: 0.0001, output: 0.0001 },
        capabilities: ['text', 'conversation']
      },
      {
        id: 'NousResearch/Nous-Hermes-Llama2-13b',
        name: 'Nous Hermes Llama2 13B',
        description: 'Fine-tuned for helpful responses',
        contextWindow: 4096,
        costPer1KTokens: { input: 0.0002, output: 0.0002 },
        capabilities: ['text', 'reasoning', 'helpful']
      }
    ],
    features: ['Open source models', 'Cost-effective pricing', 'Wide model selection', 'Custom fine-tuning']
  }
};

export const getProvider = (id: string): ProviderConfig | undefined => {
  return PROVIDERS[id] || PROVIDERS[id.toLowerCase()];
};

export const getAllProviders = (): ProviderConfig[] => {
  return Object.values(PROVIDERS);
};

export const getProviderModels = (providerId: string): ModelConfig[] => {
  const provider = getProvider(providerId);
  return provider?.models || [];
};

export const getDefaultModel = (providerId: string): string => {
  const provider = getProvider(providerId);
  return provider?.defaultModel || '';
};

export const getProviderByModel = (modelId: string): ProviderConfig | undefined => {
  return getAllProviders().find(provider =>
    provider.models.some(model => model.id === modelId)
  );
};

export const getModelConfig = (modelId: string): ModelConfig | undefined => {
  for (const provider of getAllProviders()) {
    const model = provider.models.find(m => m.id === modelId);
    if (model) return model;
  }
  return undefined;
};

export const getProvidersByFeature = (feature: string): ProviderConfig[] => {
  return getAllProviders().filter(provider =>
    provider.features.some(f => f.toLowerCase().includes(feature.toLowerCase()))
  );
};

export const getProvidersByPricing = (pricing: 'free' | 'paid' | 'freemium'): ProviderConfig[] => {
  return getAllProviders().filter(provider => provider.pricing === pricing);
};

export const calculateCost = (
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number | null => {
  const model = getModelConfig(modelId);
  if (!model?.costPer1KTokens) return null;

  const inputCost = (inputTokens / 1000) * model.costPer1KTokens.input;
  const outputCost = (outputTokens / 1000) * model.costPer1KTokens.output;

  return inputCost + outputCost;
};

export const formatCost = (cost: number): string => {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
};

export const getProviderColor = (providerId: string): string => {
  const provider = getProvider(providerId);
  return provider?.color || '#6B7280';
};

export const getProviderDisplayName = (providerId: string): string => {
  const provider = getProvider(providerId);
  return provider?.name || providerId;
};