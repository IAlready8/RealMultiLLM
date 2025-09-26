// services/persona-service.ts
import prisma from '@/lib/prisma';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type Persona = {
  id?: string;
  name: string;
  systemPrompt: string;
};

export interface PersonaInput {
  name: string;
  description?: string | null;
  instructions: string;
}

export function applyPersonaPrompt(
  messages: ChatMessage[],
  persona: Persona | null
): ChatMessage[] {
  if (!persona || !persona.systemPrompt?.trim()) return messages;

  const systemMsg: ChatMessage = { role: 'system', content: persona.systemPrompt };

  // Replace first system message if present; otherwise prepend
  if (messages.length && messages[0].role === 'system') {
    return [systemMsg, ...messages.slice(1)];
  }
  return [systemMsg, ...messages];
}

export function getDefaultPersonas(): Persona[] {
  return [
    { name: 'General',  systemPrompt: 'You are a helpful, concise assistant.' },
    { name: 'Engineer', systemPrompt: 'You are a pragmatic senior software engineer. Prefer clear, tested code and explain tradeoffs briefly.' },
    { name: 'Researcher', systemPrompt: 'You are a careful researcher. Cite sources, note uncertainty, and avoid overclaiming.' },
  ];
}

const personaSelect = {
  id: true,
  name: true,
  description: true,
  instructions: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getPersonas(userId: string) {
  return prisma.persona.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: personaSelect,
  });
}

export async function createPersona(data: PersonaInput, userId: string) {
  return prisma.persona.create({
    data: {
      name: data.name,
      description: data.description ?? '',
      instructions: data.instructions,
      userId,
    },
    select: personaSelect,
  });
}

export async function updatePersona(id: string, data: Partial<PersonaInput>, userId: string) {
  return prisma.persona.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      userId,
    },
    select: personaSelect,
  });
}

export async function deletePersona(id: string, userId: string) {
  return prisma.persona.delete({
    where: { id },
    select: personaSelect,
  });
}
