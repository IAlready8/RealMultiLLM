"use server";

// OVERWRITTEN FILE: app/actions/config-actions.ts (complete rewrite - SSR safe)
// Server-side provider listing and per-user model settings persisted via Prisma.

import prisma from "@/lib/prisma";

const PROVIDERS = [
  { id: "openai", name: "OpenAI" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
  { id: "llama", name: "Llama (Ollama)" },
];

function defaultSettings() {
  const settings: Record<string, any> = {};
  for (const p of PROVIDERS) {
    settings[p.id] = { temperature: 0.7, maxTokens: 2048, defaultModel: "default" };
  }
  return settings;
}

export async function getProviders(userId?: string) {
  let modelSettings: Record<string, any> = defaultSettings();
  if (userId) {
    try {
      const row = await prisma.userSettings.findUnique({ where: { userId } });
      if (row?.modelSettings) modelSettings = row.modelSettings as any;
    } catch {
      // ignore
    }
  }

  return {
    apiKeys: {}, // API keys managed on client via secure local storage
    modelSettings,
    providers: PROVIDERS.map((p) => ({ id: p.id, name: p.name })),
  };
}

export async function updateProvider(
  providerId: string,
  data: { settings?: any },
  userId?: string
) {
  if (data.settings !== undefined && userId) {
    const existing = await prisma.userSettings.findUnique({ where: { userId } });
    const merged = {
      ...(existing?.modelSettings || defaultSettings()),
      [providerId]: {
        ...(existing?.modelSettings?.[providerId] || {}),
        ...data.settings,
      },
    };
    await prisma.userSettings.upsert({
      where: { userId },
      update: { modelSettings: merged },
      create: { userId, modelSettings: merged },
    });
  }
  return { success: true };
}

export async function testProviderApiKey(providerId: string, _apiKey: string) {
  // Stubbed on server to avoid remote calls in server actions
  return { valid: !!_apiKey, message: _apiKey ? "API key appears valid" : "API key is empty" };
}

"use server";

// OVERWRITTEN FILE: app/actions/config-actions.ts (complete rewrite)
// Implements SSR-safe provider/config access by removing localStorage usage.

import prisma from "@/lib/prisma";
import { secureRetrieve, secureStore } from "@/lib/secure-storage";

// Server-side model settings are persisted in DB under UserSettings
// Fallback to environment defaults if none found.

const PROVIDERS = [
  { id: "openai", name: "OpenAI" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI" },
  { id: "llama", name: "Llama (Ollama)" },
];

function defaultSettings() {
  const settings: Record<string, any> = {};
  for (const p of PROVIDERS) {
    settings[p.id] = { temperature: 0.7, maxTokens: 2048, defaultModel: "default" };
  }
  return settings;
}

export async function getProviders(userId?: string) {
  const apiKeys: Record<string, string> = {};
  for (const provider of PROVIDERS) {
    const key = await secureRetrieve(`apiKey_${provider.id}`);
    if (key) apiKeys[provider.id] = key;
  }

  let modelSettings: Record<string, any> = defaultSettings();
  if (userId) {
    try {
      const row = await prisma.userSettings.findUnique({ where: { userId } });
      if (row?.modelSettings) modelSettings = row.modelSettings as any;
    } catch (e) {
      // ignore; fall back to defaults
    }
  }

  return {
    apiKeys,
    modelSettings,
    providers: PROVIDERS.map((p) => ({ id: p.id, name: p.name })),
  };
}

export async function updateProvider(
  providerId: string,
  data: { apiKey?: string; settings?: any },
  userId?: string
) {
  if (data.apiKey !== undefined) {
    if (data.apiKey) {
      await secureStore(`apiKey_${providerId}`, data.apiKey);
    }
  }

  if (data.settings !== undefined && userId) {
    // Upsert user settings
    const existing = await prisma.userSettings.findUnique({ where: { userId } });
    const merged = {
      ...(existing?.modelSettings || defaultSettings()),
      [providerId]: {
        ...(existing?.modelSettings?.[providerId] || {}),
        ...data.settings,
      },
    };
    await prisma.userSettings.upsert({
      where: { userId },
      update: { modelSettings: merged },
      create: { userId, modelSettings: merged },
    });
  }

  return { success: true };
}

export async function testProviderApiKey(providerId: string, apiKey: string) {
  // Keep as a stub to avoid remote calls during server action; use /api/test-api-key route if needed
  return { valid: !!apiKey, message: apiKey ? "API key appears valid" : "API key is empty" };
}

"use server";

import { secureRetrieve, secureStore } from "@/lib/secure-storage";

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
    const key = await secureRetrieve(`apiKey_${provider.id}`);
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
      await secureStore(`apiKey_${providerId}`, data.apiKey);
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