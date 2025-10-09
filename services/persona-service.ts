// services/persona-service.ts
import prisma from '@/lib/prisma';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type Persona = {
  id: string;
  title: string;
  description: string | null;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};

export interface PersonaInput {
  title: string;
  description?: string | null;
  prompt: string;
}

export function applyPersonaPrompt(
  messages: ChatMessage[],
  persona: Persona | null
): ChatMessage[] {
  if (!persona || !persona.prompt?.trim()) return messages;

  const systemMsg: ChatMessage = { role: 'system', content: persona.prompt };

  // Replace first system message if present; otherwise prepend
  if (messages.length && messages[0].role === 'system') {
    return [systemMsg, ...messages.slice(1)];
  }
  return [systemMsg, ...messages];
}

export function getDefaultPersonas(): Persona[] {
  const now = new Date();
  const dummyUserId = 'default-user'; // Or a more appropriate default user ID if available
  return [
    {
      id: 'default-general',
      title: 'General',
      description: 'A helpful, concise assistant.',
      prompt: 'You are a helpful, concise assistant.',
      createdAt: now,
      updatedAt: now,
      userId: dummyUserId,
    },
    {
      id: 'default-engineer',
      title: 'Engineer',
      description: 'A pragmatic senior software engineer.',
      prompt: 'You are a pragmatic senior software engineer. Prefer clear, tested code and explain tradeoffs briefly.',
      createdAt: now,
      updatedAt: now,
      userId: dummyUserId,
    },
    {
    id: 'default-researcher',
      title: 'Researcher',
      description: 'A careful researcher.',
      prompt: 'You are a careful researcher. Cite sources, note uncertainty, and avoid overclaiming.',
      createdAt: now,
      updatedAt: now,
      userId: dummyUserId,
    },
  ];
}

const personaSelect = {
  id: true,
  title: true,
  description: true,
  prompt: true,
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
      title: data.title,
      description: data.description ?? '',
      prompt: data.prompt,
      userId,
    },
    select: personaSelect,
  });
}

export async function updatePersona(id: string, data: Partial<PersonaInput>, userId: string) {
  return prisma.persona.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      prompt: data.prompt,
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
