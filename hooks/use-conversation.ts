
import { useState, useEffect, useCallback } from 'react';
import { 
  saveConversation, 
  getConversationsByType, 
  deleteConversation, 
  updateConversation 
} from '@/services/conversation-storage';

interface ConversationData {
  id: string;
  type: 'multi-chat' | 'goal-hub' | 'comparison' | 'pipeline';
  title: string;
  timestamp: number;
  data: any;
}

export function useConversation(type: 'multi-chat' | 'goal-hub' | 'comparison' | 'pipeline') {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getConversationsByType(type);
      setConversations(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [type]);
  
  // Save a new conversation
  const saveNewConversation = useCallback(async (title: string, data: any) => {
    try {
      const id = await saveConversation(type, title, data);
      await loadConversations();
      return id;
    } catch (err) {
      console.error('Error saving conversation:', err);
      setError('Failed to save conversation');
      throw err;
    }
  }, [type, loadConversations]);
  
  // Update an existing conversation
  const updateExistingConversation = useCallback(async (id: string, updates: { title?: string; data?: any }) => {
    try {
      await updateConversation(id, updates);
      await loadConversations();
    } catch (err) {
      console.error('Error updating conversation:', err);
      setError('Failed to update conversation');
      throw err;
    }
  }, [loadConversations]);
  
  // Delete a conversation
  const deleteExistingConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      await loadConversations();
    } catch (err) {
      console.error('Error deleting conversation:', err);
      setError('Failed to delete conversation');
      throw err;
    }
  }, [loadConversations]);
  
  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);
  
  return {
    conversations,
    isLoading,
    error,
    saveConversation: saveNewConversation,
    updateConversation: updateExistingConversation,
    deleteConversation: deleteExistingConversation,
    refreshConversations: loadConversations
  };
}
