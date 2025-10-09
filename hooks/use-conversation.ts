import { useState, useEffect, useCallback } from 'react';
import {
  getConversationsByType,
  deleteConversation as deleteConversationService,
  updateConversation as updateConversationService,
  saveConversation as saveConversationService
} from '@/services/conversation-storage';
import type { Conversation, ConversationData } from '@/types/app';

// Define a more specific type for the updates to avoid using 'any'
type ConversationUpdate<T extends Conversation['type']> = Partial<Omit<Extract<Conversation, { type: T }>, 'id'>>;

/**
 * A generic hook for managing conversations of a specific type.
 * @param type The type of conversation to manage (e.g., 'multi-chat').
 */
export function useConversation<T extends Conversation['type']>(type: T) {
  // The state is now strongly typed based on the provided conversation type
  const [conversations, setConversations] = useState<Extract<Conversation, { type: T }>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getConversationsByType(type);
      // Sort by timestamp, newest first - using createdAt if timestamp not available
      data.sort((a, b) => {
        const bTime = b.timestamp || new Date(b.createdAt).getTime();
        const aTime = a.timestamp || new Date(a.createdAt).getTime();
        return bTime - aTime;
      });
      setConversations(data);
    } catch (err) {
      console.error(`Error loading conversations of type '${type}':`, err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [type]);
  
  const updateConversation = useCallback(async (id: string, updates: ConversationUpdate<T>) => {
    try {
      await updateConversationService(id, updates);
      await loadConversations(); // Refresh the list
    } catch (err) {
      console.error(`Error updating conversation with id '${id}':`, err);
      setError('Failed to update conversation');
      throw err;
    }
  }, [loadConversations]);
  
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await deleteConversationService(id);
      await loadConversations(); // Refresh the list
    } catch (err) {
      console.error(`Error deleting conversation with id '${id}':`, err);
      setError('Failed to delete conversation');
      throw err;
    }
  }, [loadConversations]);
  
  const saveConversation = useCallback(async (title: string, data: ConversationData<T>) => {
    try {
      const id = await saveConversationService(type, title, data);
      await loadConversations(); // Refresh the list
      return id;
    } catch (err) {
      console.error(`Error saving conversation of type '${type}':`, err);
      setError('Failed to save conversation');
      throw err;
    }
  }, [type, loadConversations]);
  
  // Load conversations on initial mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);
  
  return {
    conversations,
    isLoading,
    error,
    saveConversation,
    updateConversation,
    deleteConversation,
    refreshConversations: loadConversations
  };
}
