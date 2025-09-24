
"use server";

import { callLLM } from "@/services/api-client";
import { saveConversation as saveConv, updateConversation as updateConv } from "@/services/conversation-storage";

export async function sendPrompt(provider: string, messages: any[], options: any) {
  // Convert messages array to prompt string for the API client
  const prompt = Array.isArray(messages) ? messages.map(m => m.content || m).join('\n') : messages;
  return await callLLM(provider, prompt, options.apiKey || '', options);
}

export async function sendMultiPrompt(providers: string[], messages: any[], options: any) {
  const prompt = Array.isArray(messages) ? messages.map(m => m.content || m).join('\n') : messages;
  const responses = await Promise.all(
    providers.map(provider => callLLM(provider, prompt, options.apiKey || '', options))
  );
  return responses;
}

export async function saveConversation(type: any, title: any, data: any) {
  return await saveConv(type, title, data);
}

export async function updateConversation(id: any, updates: any) {
  return await updateConv(id, updates);
}
