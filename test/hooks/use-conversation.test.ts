import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConversation } from '@/hooks/use-conversation';

// Mock the conversation storage service
vi.mock('@/services/conversation-storage', () => ({
  saveConversation: vi.fn().mockResolvedValue('test-id-1'),
  getConversationsByType: vi.fn().mockResolvedValue([]),
  updateConversation: vi.fn().mockResolvedValue(undefined),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
}));

// Import mocked functions after vi.mock
import * as conversationStorage from '@/services/conversation-storage';
const mockSaveConversation = vi.mocked(conversationStorage.saveConversation);
const mockGetConversationsByType = vi.mocked(conversationStorage.getConversationsByType);
const mockUpdateConversation = vi.mocked(conversationStorage.updateConversation);
const mockDeleteConversation = vi.mocked(conversationStorage.deleteConversation);

describe('useConversation Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty conversations', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));

    expect(result.current.conversations).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should save a new conversation', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));

    let conversationId: string;
    await act(async () => {
      conversationId = await result.current.saveConversation('Test Conversation', { messages: [] });
    });

    expect(conversationId!).toBe('test-id-1');
  });

  it('should update conversation', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));

    await act(async () => {
      await result.current.updateConversation('test-id', { title: 'Updated Title' });
    });

    // Mock should have been called
    expect(mockUpdateConversation).toHaveBeenCalledWith('test-id', { title: 'Updated Title' });
  });

  it('should delete conversation', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));

    await act(async () => {
      await result.current.deleteConversation('test-id');
    });

    // Mock should have been called
    expect(mockDeleteConversation).toHaveBeenCalledWith('test-id');
  });

  it('should refresh conversations', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));

    await act(async () => {
      await result.current.refreshConversations();
    });

    // Mock should have been called
    expect(mockGetConversationsByType).toHaveBeenCalledWith('multi-chat');
  });

  it('should handle errors gracefully', async () => {
    // Mock an error
    mockSaveConversation.mockRejectedValueOnce(new Error('Storage error'));

    const { result } = renderHook(() => useConversation('multi-chat'));

    await act(async () => {
      try {
        await result.current.saveConversation('Test', {});
      } catch (err) {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe('Failed to save conversation');
  });
});