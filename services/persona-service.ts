import { monitoring } from "@/lib/monitoring.browser";

export interface Persona {
  id: string;
  title: string;
  description?: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface CreatePersonaRequest {
  title: string;
  description?: string;
  prompt: string;
}

export interface UpdatePersonaRequest {
  id: string;
  title: string;
  description?: string;
  prompt: string;
}

export async function getPersonas(): Promise<Persona[]> {
  monitoring.startTimer('get_personas');
  
  try {
    const response = await fetch("/api/personas");
    if (!response.ok) {
      throw new Error(`Failed to fetch personas: ${response.statusText}`);
    }
    const personas = response.json();
    monitoring.endTimer('get_personas');
    return personas;
  } catch (error) {
    monitoring.endTimer('get_personas');
    monitoring.recordError(error as Error, { operation: 'getPersonas' });
    throw error;
  }
}

export async function createPersona(data: CreatePersonaRequest): Promise<Persona> {
  monitoring.startTimer('create_persona');
  
  try {
    const response = await fetch("/api/personas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create persona: ${errorText}`);
    }
    
    const persona = response.json();
    monitoring.endTimer('create_persona');
    return persona;
  } catch (error) {
    monitoring.endTimer('create_persona');
    monitoring.recordError(error as Error, { operation: 'createPersona' });
    throw error;
  }
}

export async function updatePersona(id: string, data: Partial<UpdatePersonaRequest>): Promise<Persona> {
  monitoring.startTimer('update_persona');
  
  try {
    const response = await fetch(`/api/personas/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update persona: ${errorText}`);
    }
    
    const persona = response.json();
    monitoring.endTimer('update_persona');
    return persona;
  } catch (error) {
    monitoring.endTimer('update_persona');
    monitoring.recordError(error as Error, { operation: 'updatePersona', id });
    throw error;
  }
}

export async function deletePersona(id: string): Promise<void> {
  monitoring.startTimer('delete_persona');
  
  try {
    const response = await fetch(`/api/personas/${id}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete persona: ${errorText}`);
    }
    
    monitoring.endTimer('delete_persona');
  } catch (error) {
    monitoring.endTimer('delete_persona');
    monitoring.recordError(error as Error, { operation: 'deletePersona', id });
    throw error;
  }
}

// Default persona templates
export const DEFAULT_PERSONAS: Omit<CreatePersonaRequest, 'userId'>[] = [
  {
    title: "Professional Assistant",
    description: "A professional, formal assistant for business communications",
    prompt: "You are a professional assistant. Always respond in a formal, business-appropriate tone. Provide accurate, well-structured information and maintain a helpful, courteous demeanor."
  },
  {
    title: "Creative Writer",
    description: "A creative and imaginative writing companion",
    prompt: "You are a creative writing assistant. Help with storytelling, creative ideas, character development, and imaginative scenarios. Be inspiring, creative, and encourage artistic expression."
  },
  {
    title: "Code Mentor",
    description: "A programming mentor and technical advisor",
    prompt: "You are an experienced software engineer and mentor. Provide clear technical explanations, code examples, best practices, and help debug issues. Be patient and educational in your approach."
  },
  {
    title: "Learning Tutor",
    description: "An educational tutor for various subjects",
    prompt: "You are a knowledgeable tutor. Break down complex concepts into simple, understandable parts. Use examples, analogies, and ask questions to ensure understanding. Be encouraging and patient."
  },
  {
    title: "Research Assistant",
    description: "A thorough research assistant for factual information",
    prompt: "You are a research assistant. Provide well-researched, factual information with clear sources when possible. Be thorough, accurate, and organize information in a clear, logical manner."
  }
];

export function getDefaultPersonas() {
  return DEFAULT_PERSONAS;
}

export function applyPersonaPrompt(messages: any[], persona: Persona | null) {
  if (!persona) {
    return messages;
  }

  const systemMessage = { role: 'system', content: persona.prompt };

  const otherMessages = messages.filter(m => m.role !== 'system');

  return [systemMessage, ...otherMessages];
}
