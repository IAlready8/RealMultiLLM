"use server";

import { getStoredApiKey, storeApiKey } from "@/lib/secure-storage";

// LLM providers (should ideally come from a centralized config or API)
const providers = [
  { id: "openai", name: "OpenAI" },
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

  const modelSettingsStr = localStorage.getItem("modelSettings");
  const modelSettings = modelSettingsStr ? JSON.parse(modelSettingsStr) : {};

  return {
    apiKeys,
    modelSettings,
    providers: providers.map(p => ({ id: p.id, name: p.name }))
  };
}

export async function updateProvider(providerId: string, data: { apiKey?: string; settings?: any }) {
  if (data.apiKey !== undefined) {
    if (data.apiKey) {
      await storeApiKey(providerId, data.apiKey);
    } else {
      // Optionally remove if key is empty
      // await secureRemove(`apiKey_${providerId}`);
    }
  }

  if (data.settings !== undefined) {
    const savedSettings = localStorage.getItem("modelSettings");
    const currentSettings = savedSettings ? JSON.parse(savedSettings) : {};
    const updatedSettings = {
      ...currentSettings,
      [providerId]: {
        ...currentSettings[providerId],
        ...data.settings
      }
    };
    localStorage.setItem("modelSettings", JSON.stringify(updatedSettings));
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