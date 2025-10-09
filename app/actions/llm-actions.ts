
"use server";

import { sendChatMessage as sendLLMChatMessage } from "@/services/api-service";
import { saveConversation as saveConv, updateConversation as updateConv } from "@/services/conversation-storage";
import type { ChatMessage, StreamChatOptions } from "@/services/api-service";
import type { Conversation, ConversationData } from "@/types/app";

export async function sendPrompt(provider: string, messages: ChatMessage[], options: StreamChatOptions) {
  return await sendLLMChatMessage(provider, messages, options);
}

export async function sendMultiPrompt(providers: string[], messages: ChatMessage[], options: StreamChatOptions) {
  const responses = await Promise.all(
    providers.map(provider => sendLLMChatMessage(provider, messages, options))
  );
  return responses;
}

export async function saveConversation(type: Conversation['type'], title: string, data: ConversationData<Conversation['type']>) {
  return await saveConv(type, title, data);
}

export async function updateConversation(id: string, updates: Partial<Conversation>) {
  return await updateConv(id, updates);
}
