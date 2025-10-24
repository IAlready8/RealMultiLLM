import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../services/llm-providers/openai-service';

describe('Simple OpenAI Import Test', () => {
  it('should be able to import and instantiate OpenAIProvider', () => {
    const provider = new OpenAIProvider('dummy-key');
    expect(provider).toBeDefined();
    expect(provider.getMetadata().id).toBe('openai');
  });
});
