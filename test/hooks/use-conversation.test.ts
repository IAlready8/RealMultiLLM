import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConversation } from '@/hooks/use-conversation';
import * as conversationStorage from '@/services/conversation-storage';

// Mock the conversation-storage service
vi.mock('@/services/conversation-storage', () => ({
  getConversationsByType: vi.fn(),
  saveConversation: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
}));

describe('useConversation Hook', () => {
  const mockConversation = {
    id: '1',
    type: 'multi-chat',
    title: 'Test Conversation',
    timestamp: Date.now(),
    data: { messages: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to a default successful state before each test
    vi.mocked(conversationStorage.getConversationsByType).mockResolvedValue([mockConversation] as any);
    vi.mocked(conversationStorage.saveConversation).mockResolvedValue('new-id' as any);
    vi.mocked(conversationStorage.updateConversation).mockResolvedValue(undefined as any);
    vi.mocked(conversationStorage.deleteConversation).mockResolvedValue(undefined as any);
  });

  it('should load conversations on mount', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));

    await act(async () => {
      // Let the initial useEffect run
    });

    expect(conversationStorage.getConversationsByType).toHaveBeenCalledWith('multi-chat');
    // This assertion needs to wait for the state update after the hook has settled
    await vi.waitFor(() => {
        expect(result.current.conversations).toEqual([mockConversation]);
        expect(result.current.isLoading).toBe(false);
    });
  });

  it('should call saveConversation and refresh list', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));

    await act(async () => {
      await result.current.saveConversation('New Title', { messages: ['hello'] });
    });

    expect(conversationStorage.saveConversation).toHaveBeenCalledWith('multi-chat', 'New Title', { messages: ['hello'] });
    expect(conversationStorage.getConversationsByType).toHaveBeenCalledTimes(2); // Initial load + refresh
  });

  it('should call updateConversation and refresh list', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));
    const updates = { title: 'Updated Title' };

    await act(async () => {
      await result.current.updateConversation('1', updates);
    });

    expect(conversationStorage.updateConversation).toHaveBeenCalledWith('1', updates);
    expect(conversationStorage.getConversationsByType).toHaveBeenCalledTimes(2);
  });

  it('should call deleteConversation and refresh list', async () => {
    const { result } = renderHook(() => useConversation('multi-chat'));

    await act(async () => {
      await result.current.deleteConversation('1');
    });

    expect(conversationStorage.deleteConversation).toHaveBeenCalledWith('1');
    expect(conversationStorage.getConversationsByType).toHaveBeenCalledTimes(2);
  });

  it('should handle errors when loading conversations', async () => {
    vi.mocked(conversationStorage.getConversationsByType).mockRejectedValue(new Error('DB Error'));
    const { result } = renderHook(() => useConversation('multi-chat'));

    await act(async () => {
        // Let the initial useEffect run and fail
    });

    await vi.waitFor(() => {
        expect(result.current.error).toBe('Failed to load conversations');
        expect(result.current.isLoading).toBe(false);
        expect(result.current.conversations).toEqual([]);
    });
  });
});
