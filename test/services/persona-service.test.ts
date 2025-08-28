import { describe, it, expect } from 'vitest';
import {
  applyPersonaPrompt,
  getDefaultPersonas,
  type ChatMessage,
  type Persona,
} from '@/services/persona-service';

describe('Persona Service',
() => {
  describe('applyPersonaPrompt',
  () => {
    it('should prepend persona prompt to messages if no system message exists',
      () => {
        const persona: Persona = {
          name: 'Test Persona',
          systemPrompt: 'You are a test assistant.',
        };
        const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

        const result = applyPersonaPrompt(messages, persona);

        expect(result).toEqual([
          { role: 'system', content: 'You are a test assistant.' },
          { role: 'user', content: 'Hello' },
        ]);
      });

    it('should replace existing system message',
      () => {
        const persona: Persona = {
          name: 'Test Persona',
          systemPrompt: 'You are a new assistant.',
        };
        const messages: ChatMessage[] = [
          { role: 'system', content: 'Old system prompt' },
          { role: 'user', content: 'Hello' },
        ];

        const result = applyPersonaPrompt(messages, persona);

        expect(result).toEqual([
          { role: 'system', content: 'You are a new assistant.' },
          { role: 'user', content: 'Hello' },
        ]);
      });

    it('should return original messages if persona is null',
      () => {
        const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];
        const result = applyPersonaPrompt(messages, null);
        expect(result).toEqual(messages);
      });

    it('should return original messages if persona systemPrompt is empty or whitespace',
      () => {
        const persona: Persona = { name: 'Empty', systemPrompt: '   ' };
        const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];
        const result = applyPersonaPrompt(messages, persona);
        expect(result).toEqual(messages);
      });
  });

  describe('getDefaultPersonas',
  () => {
    it('should return an array of default personas',
      () => {
        const defaults = getDefaultPersonas();
        expect(Array.isArray(defaults)).toBe(true);
        expect(defaults.length).toBeGreaterThan(0);
      });

    it('should return personas with correct properties',
      () => {
        const defaults = getDefaultPersonas();
        const first = defaults[0];
        expect(first).toHaveProperty('name');
        expect(first).toHaveProperty('systemPrompt');
      });
  });
});
