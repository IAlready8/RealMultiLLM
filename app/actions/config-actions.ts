"use server";

// DEPRECATED: This file uses client-side API key storage which is a security vulnerability.
// Use the /api/config route instead for secure backend API key management.
// This file is kept for backward compatibility but should not be used for new features.

import { getStoredApiKey, setStoredApiKey } from "@/lib/secure-storage";

// LLM providers (should ideally come from a centralized config or API)
const providers = [
  { id: "openai", name: "OpenAI" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
  { id: "llama", name: "Llama" },
  { id: "github", name: "GitHub" },
  { id: "grok", name: "Grok" },
];

export async function getProviders() {
  const apiKeys: Record<string, string> = {};
  for (const provider of providers) {
    const key = await getStoredApiKey(provider.id);
    if (key) {
      apiKeys[provider.id] = key;
    }
  }

  // Note: localStorage is not available on server side
  // This would need to be refactored to work with actual server-side storage
  const modelSettings = {};

  return {
    apiKeys,
    modelSettings,
    providers: providers.map(p => ({ id: p.id, name: p.name }))
  };
}

export async function updateProvider(providerId: string, data: { apiKey?: string; settings?: unknown }) {
  if (data.apiKey !== undefined) {
    if (data.apiKey) {
      await setStoredApiKey(providerId, data.apiKey);
    } else {
      // Optionally remove if key is empty
      // await secureRemove(`apiKey_${providerId}`);
    }
  }

  if (data.settings !== undefined) {
    // Note: localStorage is not available on server side
    // This would need to be refactored to work with actual server-side storage
    // For now, this functionality is disabled on server actions
  }

  return { success: true };
}

export async function testProviderApiKey(providerId: string, apiKey: string) {
  // This is a placeholder for actual API key testing.
  // In a real application, you would make a small, cheap API call
  // to the provider to verify the key's validity.
  // For now, we'll just simulate success.
  console.log(`Testing API key for ${providerId}: ${apiKey ? 'provided' : 'not provided'}`);
  return { valid: !!apiKey, message: apiKey ? "API key appears valid" : "API key is empty" };
}
