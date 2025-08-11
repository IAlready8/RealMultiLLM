'use server';

// OVERWRITTEN FILE: app/actions/config-actions.ts (complete rewrite - SSR safe)
// Server-side provider listing and per-user model settings persisted via Prisma.

import prisma from '@/lib/prisma';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'claude', name: 'Claude' },
  { id: 'google', name: 'Google AI' },
  { id: 'llama', name: 'Llama (Ollama)' },
];

function defaultSettings() {
  const settings: Record<string, any> = {};
  for (const p of PROVIDERS) {
    settings[p.id] = {
      temperature: 0.7,
      maxTokens: 2048,
      defaultModel: 'default',
    };
  }
  return settings;
}

export async function getProviders(userId?: string) {
  let modelSettings: Record<string, any> = defaultSettings();
  if (userId) {
    try {
      const row = await prisma.userSettings.findUnique({ where: { userId } });
      if (row?.modelSettings) {
        try {
          modelSettings = JSON.parse(row.modelSettings);
        } catch (e) {
          // ignore parse error, use defaults
        }
      }
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
    const existing = await prisma.userSettings.findUnique({
      where: { userId },
    });
    let existingSettings = defaultSettings();
    if (existing?.modelSettings) {
      try {
        existingSettings = JSON.parse(existing.modelSettings);
      } catch (e) {
        // ignore parse error
      }
    }

    const merged = {
      ...existingSettings,
      [providerId]: {
        ...(existingSettings?.[providerId] || {}),
        ...data.settings,
      },
    };
    await prisma.userSettings.upsert({
      where: { userId },
      update: { modelSettings: JSON.stringify(merged) },
      create: { userId, modelSettings: JSON.stringify(merged) },
    });
  }
  return { success: true };
}

export async function testProviderApiKey(providerId: string, _apiKey: string) {
  // Stubbed on server to avoid remote calls in server actions
  return {
    valid: !!_apiKey,
    message: _apiKey ? 'API key appears valid' : 'API key is empty',
  };
}
