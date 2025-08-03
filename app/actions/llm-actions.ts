
"use server";

import { sendChatMessage as sendLLMChatMessage } from "@/services/api-service";
import { saveConversation as saveConv, updateConversation as updateConv } from "@/services/conversation-storage";

export async function sendPrompt(provider: string, messages: any[], options: any) {
  return await sendLLMChatMessage(provider, messages, options);
}

export async function sendMultiPrompt(providers: string[], messages: any[], options: any) {
  const responses = await Promise.all(
    providers.map(provider => sendLLMChatMessage(provider, messages, options))
  );
  return responses;
}

export async function saveConversation(type: any, title: any, data: any) {
  return await saveConv(type, title, data);
}

export async function updateConversation(id: any, updates: any) {
  return await updateConv(id, updates);
}
