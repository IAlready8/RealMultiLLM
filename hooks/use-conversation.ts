import { useState, useEffect, useCallback } from 'react';
import { 
  saveConversation as save, 
  getConversationsByType as getByType, 
  deleteConversation as del, 
  updateConversation as update
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
      const data = await getByType(type);
      // Sort by timestamp, newest first
      data.sort((a, b) => b.timestamp - a.timestamp);
      setConversations(data);
    } catch (err) {
      console.error(`Error loading conversations of type '${type}':`, err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [type]);
  
  const saveConversation = useCallback(async (title: string, data: ConversationData<T>) => {
    try {
      const id = await save(type, title, data);
      await loadConversations(); // Refresh the list
      return id;
    } catch (err) {
      console.error(`Error saving conversation of type '${type}':`, err);
      setError('Failed to save conversation');
      throw err;
    }
  }, [type, loadConversations]);
  
  const updateConversation = useCallback(async (id: string, updates: ConversationUpdate<T>) => {
    try {
      await update(id, updates);
      await loadConversations(); // Refresh the list
    } catch (err) {
      console.error(`Error updating conversation with id '${id}':`, err);
      setError('Failed to update conversation');
      throw err;
    }
  }, [loadConversations]);
  
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await del(id);
      await loadConversations(); // Refresh the list
    } catch (err) {
      console.error(`Error deleting conversation with id '${id}':`, err);
      setError('Failed to delete conversation');
      throw err;
    }
  }, [loadConversations]);
  
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