import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConversation } from '@/hooks/use-conversation';

// Mock IndexedDB
const mockIDB = {
  open: vi.fn(),
  delete: vi.fn(),
  databases: vi.fn()
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIDB,
  writable: true
});

// Mock the IDB library
vi.mock('idb', () => ({
  openDB: vi.fn(),
  deleteDB: vi.fn()
}));

describe('useConversation Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty conversations', () => {
    const { result } = renderHook(() => useConversation());

    expect(result.current.conversations).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('should create a new conversation', async () => {
    const { result } = renderHook(() => useConversation());

    await act(async () => {
      await result.current.createConversation('Test Conversation');
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe('Test Conversation');
    expect(result.current.conversations[0].messages).toEqual([]);
  });

  it('should add message to conversation', async () => {
    const { result } = renderHook(() => useConversation());

    // Create conversation first
    let conversationId: string;
    await act(async () => {
      conversationId = await result.current.createConversation('Test');
    });

    // Add message
    const testMessage = {
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    };

    await act(async () => {
      await result.current.addMessage(conversationId!, testMessage);
    });

    const conversation = result.current.conversations.find(c => c.id === conversationId);
    expect(conversation?.messages).toContain(testMessage);
  });

  it('should delete conversation', async () => {
    const { result } = renderHook(() => useConversation());

    // Create conversation
    let conversationId: string;
    await act(async () => {
      conversationId = await result.current.createConversation('Test');
    });

    expect(result.current.conversations).toHaveLength(1);

    // Delete conversation
    await act(async () => {
      await result.current.deleteConversation(conversationId!);
    });

    expect(result.current.conversations).toHaveLength(0);
  });

  it('should update conversation title', async () => {
    const { result } = renderHook(() => useConversation());

    // Create conversation
    let conversationId: string;
    await act(async () => {
      conversationId = await result.current.createConversation('Original Title');
    });

    // Update title
    await act(async () => {
      await result.current.updateConversation(conversationId!, { title: 'Updated Title' });
    });

    const conversation = result.current.conversations.find(c => c.id === conversationId);
    expect(conversation?.title).toBe('Updated Title');
  });

  it('should export conversation data', async () => {
    const { result } = renderHook(() => useConversation());

    // Create conversation with messages
    let conversationId: string;
    await act(async () => {
      conversationId = await result.current.createConversation('Export Test');
      await result.current.addMessage(conversationId, {
        role: 'user',
        content: 'Test message',
        timestamp: Date.now()
      });
    });

    const exportData = await result.current.exportConversations();

    expect(exportData).toHaveProperty('conversations');
    expect(exportData.conversations).toHaveLength(1);
    expect(exportData.conversations[0].title).toBe('Export Test');
    expect(exportData.conversations[0].messages).toHaveLength(1);
  });

  it('should import conversation data', async () => {
    const { result } = renderHook(() => useConversation());

    const importData = {
      conversations: [
        {
          id: 'import-1',
          title: 'Imported Conversation',
          messages: [
            {
              role: 'user',
              content: 'Imported message',
              timestamp: Date.now()
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    };

    await act(async () => {
      await result.current.importConversations(importData);
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe('Imported Conversation');
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useConversation());

    // Mock console.error to prevent test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Try to add message to non-existent conversation
    await act(async () => {
      await result.current.addMessage('non-existent', {
        role: 'user',
        content: 'Test',
        timestamp: Date.now()
      });
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});