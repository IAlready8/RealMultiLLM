// lib/secure-storage.ts
const isServer = typeof window === 'undefined';

export function decryptString(value: string): string {
  try {
    const b64 = /^[A-Za-z0-9+/=]+$/;
    if (b64.test(value)) {
      return isServer ? Buffer.from(value, 'base64').toString('utf8') : atob(value);
    }
    return value;
  } catch {
    return value;
  }
}

export function encryptString(value: string): string {
  try {
    return isServer ? Buffer.from(value, 'utf8').toString('base64') : btoa(value);
  } catch {
    return value;
  }
}

function localKey(provider: string, userId?: string) {
  return `llm:key:${userId ?? 'anon'}:${provider}`;
}

export function getStoredApiKey(provider: string, userId?: string): string | null {
  if (isServer) {
    const env: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      'google-ai': process.env.Google_AI_API_KEY ?? process.env.GOOGLE_AI_API_KEY,
      grok: process.env.GROK_API_KEY,
      llama: process.env.LLAMA_API_KEY,
      github: process.env.GITHUB_COPILOT_API_KEY,
    };
    return env[provider] ?? null;
  }
  const raw = window.localStorage.getItem(localKey(provider, userId));
  return raw ? decryptString(raw) : null;
}

export function setStoredApiKey(provider: string, key: string, userId?: string): void {
  if (isServer) return;
  window.localStorage.setItem(localKey(provider, userId), encryptString(key));
}