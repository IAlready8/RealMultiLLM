import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getPersonas, 
  createPersona, 
  updatePersona, 
  deletePersona,
  applyPersonaPrompt,
  getDefaultPersonas 
} from '@/services/persona-service';

// Mock fetch
global.fetch = vi.fn();

describe('Persona Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPersonas', () => {
    it('should fetch personas successfully', async () => {
      const mockPersonas = [
        {
          id: '1',
          title: 'Assistant',
          description: 'Helpful assistant',
          prompt: 'You are a helpful assistant',
          userId: 'user1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockPersonas)
      });

      const result = await getPersonas();

      expect(global.fetch).toHaveBeenCalledWith('/api/personas');
      expect(result).toEqual(mockPersonas);
    });

    it('should handle fetch errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      });

      await expect(getPersonas()).rejects.toThrow('Failed to fetch personas');
    });
  });

  describe('createPersona', () => {
    it('should create persona successfully', async () => {
      const newPersona = {
        title: 'New Persona',
        description: 'A new persona',
        prompt: 'You are a new assistant'
      };

      const createdPersona = {
        id: '2',
        userId: 'user1',
        ...newPersona,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(createdPersona)
      });

      const result = await createPersona(newPersona);

      expect(global.fetch).toHaveBeenCalledWith('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPersona)
      });
      expect(result).toEqual(createdPersona);
    });
  });

  describe('updatePersona', () => {
    it('should update persona successfully', async () => {
      const updateData = {
        title: 'Updated Persona',
        description: 'Updated description'
      };

      const updatedPersona = {
        id: '1',
        userId: 'user1',
        ...updateData,
        prompt: 'Original prompt',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(updatedPersona)
      });

      const result = await updatePersona('1', updateData);

      expect(global.fetch).toHaveBeenCalledWith('/api/personas/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      expect(result).toEqual(updatedPersona);
    });
  });

  describe('deletePersona', () => {
    it('should delete persona successfully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      await deletePersona('1');

      expect(global.fetch).toHaveBeenCalledWith('/api/personas/1', {
        method: 'DELETE'
      });
    });
  });

  describe('applyPersonaPrompt', () => {
    it('should prepend persona prompt to messages', () => {
      const persona = {
        id: '1',
        title: 'Assistant',
        description: 'Helpful',
        prompt: 'You are a helpful assistant',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const result = applyPersonaPrompt(messages, persona);

      expect(result).toEqual([
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' }
      ]);
    });

    it('should replace existing system message', () => {
      const persona = {
        id: '1',
        title: 'Assistant',
        description: 'Helpful',
        prompt: 'You are a helpful assistant',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const messages = [
        { role: 'system', content: 'Old system prompt' },
        { role: 'user', content: 'Hello' }
      ];

      const result = applyPersonaPrompt(messages, persona);

      expect(result).toEqual([
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' }
      ]);
    });

    it('should return original messages if no persona provided', () => {
      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const result = applyPersonaPrompt(messages, null);

      expect(result).toEqual(messages);
    });
  });

  describe('getDefaultPersonas', () => {
    it('should return default persona templates', () => {
      const defaults = getDefaultPersonas();

      expect(Array.isArray(defaults)).toBe(true);
      expect(defaults.length).toBeGreaterThan(0);
      expect(defaults[0]).toHaveProperty('title');
      expect(defaults[0]).toHaveProperty('description');
      expect(defaults[0]).toHaveProperty('prompt');
    });
  });
});