
import { useState, useEffect, useCallback } from 'react';
import { 
  savePersona, 
  getPersonasByUserId, 
  deletePersona, 
  updatePersona, 
  PersonaData
} from '@/services/persona-storage';

export function usePersonas(userId: string) {
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadPersonas = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await getPersonasByUserId(userId);
      setPersonas(data);
    } catch (err) {
      console.error('Error loading personas:', err);
      setError('Failed to load personas');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);
  
  const saveNewPersona = useCallback(async (title: string, description: string | null, prompt: string) => {
    if (!userId) return;
    try {
      const id = await savePersona(title, description, prompt, userId);
      await loadPersonas();
      return id;
    } catch (err) {
      console.error('Error saving persona:', err);
      setError('Failed to save persona');
      throw err;
    }
  }, [userId, loadPersonas]);
  
  const updateExistingPersona = useCallback(async (id: string, updates: { title?: string; description?: string | null; prompt?: string }) => {
    try {
      await updatePersona(id, updates);
      await loadPersonas();
    } catch (err) {
      console.error('Error updating persona:', err);
      setError('Failed to update persona');
      throw err;
    }
  }, [loadPersonas]);
  
  const deleteExistingPersona = useCallback(async (id: string) => {
    try {
      await deletePersona(id);
      await loadPersonas();
    } catch (err) {
      console.error('Error deleting persona:', err);
      setError('Failed to delete persona');
      throw err;
    }
  }, [loadPersonas]);
  
  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);
  
  return {
    personas,
    isLoading,
    error,
    savePersona: saveNewPersona,
    updatePersona: updateExistingPersona,
    deletePersona: deleteExistingPersona,
    refreshPersonas: loadPersonas
  };
}
