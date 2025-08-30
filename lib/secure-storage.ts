// lib/secure-storage.ts
import { isServer } from "./runtime";
import { deriveKey, aesGcmEncrypt, aesGcmDecrypt, decryptApiKey } from "./crypto";

/**
 * VERSIONING
 * v0: plain base64 string (legacy)
 * v1: plain utf8 string
 * v2:gcm:<b64(iv|cipher|tag)>
 */

// Allow both canonical provider ids and common aliases used by the app.
const ENV_MAP: Record<string, string | undefined> = {
  // OpenAI
  openai: process.env.OPENAI_API_KEY,
  // Anthropic/Claude
  anthropic: process.env.ANTHROPIC_API_KEY,
  claude: process.env.ANTHROPIC_API_KEY,
  // Google AI (Gemini)
  "google-ai": process.env.GOOGLE_AI_API_KEY ?? process.env.GOOGLEAI_API_KEY,
  google: process.env.GOOGLE_AI_API_KEY ?? process.env.GOOGLEAI_API_KEY,
  // XAI Grok
  grok: process.env.GROK_API_KEY,
  // Llama (local/third-party)
  llama: process.env.LLAMA_API_KEY,
  // GitHub Copilot
  github: process.env.GITHUB_COPILOT_API_KEY,
  // OpenRouter
  openrouter: process.env.OPENROUTER_API_KEY,
};

function keyName(provider: string, userId?: string) {
  return `llm:key:${userId ?? "anon"}:${provider}`;
}

function storageSecret(userId?: string) {
  // Server prefers strong secret; client falls back to public salt.
  const s =
    (isServer ? process.env.SECURE_STORAGE_SECRET : process.env.NEXT_PUBLIC_SECURE_STORAGE_SALT) ||
    process.env.NEXTAUTH_SECRET ||
    "default-dev-secret";
  return `${s}:${userId ?? "anon"}`;
}

function looksBase64(s: string) {
  return /^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0;
}

// Cache for decrypted values to avoid repeated crypto operations
const decryptionCache = new Map<string, string>();
const cacheTimeout = 5 * 60 * 1000; // 5 minutes
let lastCacheClean = Date.now();

// PUBLIC: decrypt / encrypt helpers (kept for imports in lib/llm-api-client.ts)
export async function decryptString(value: string): Promise<string> {
  try {
    if (value.startsWith("v2:gcm:")) {
      const key = await deriveKey(storageSecret());
      return await aesGcmDecrypt(key, value);
    }
    // legacy b64 or plain
    if (looksBase64(value)) {
      // Buffer handles both envs via runtime helpers; keep behavior compatibility
      return isServer ? Buffer.from(value, "base64").toString("utf8") : atob(value);
    }
    return value;
  } catch {
    return value;
  }
}

export async function encryptString(value: string): Promise<string> {
  try {
    const key = await deriveKey(storageSecret());
    return await aesGcmEncrypt(key, value);
  } catch {
    // hard fallback: return plaintext to not block UX
    return value;
  }
}

/** SERVER: prefer env over persisted secret */
export async function getStoredApiKey(provider: string, userId?: string): Promise<string | null> {
  if (isServer) return ENV_MAP[provider] ?? null;
  
  const key = keyName(provider, userId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  
  // Check cache first to avoid repeated crypto operations
  const cacheKey = `${key}:${raw}`;
  const now = Date.now();
  
  // Clean cache periodically
  if (now - lastCacheClean > cacheTimeout) {
    decryptionCache.clear();
    lastCacheClean = now;
  }
  
  if (decryptionCache.has(cacheKey)) {
    return decryptionCache.get(cacheKey)!;
  }
  
  const decrypted = await decryptString(raw);
  decryptionCache.set(cacheKey, decrypted);
  return decrypted;
}

// LEGACY FALLBACK: support old key names used in tests and prior UI
// If the new key is not present, check `apiKey_<provider>` and decrypt via legacy helper
export async function getLegacyApiKeyIfPresent(provider: string): Promise<string | null> {
  if (isServer) return null;
  const legacy = window.localStorage.getItem(`apiKey_${provider}`);
  if (!legacy) return null;
  try {
    return decryptApiKey(legacy);
  } catch {
    return legacy;
  }
}

export async function setStoredApiKey(provider: string, key: string, userId?: string): Promise<void> {
  if (isServer) return; // server should write to DB, not localStorage
  const token = await encryptString(key);
  window.localStorage.setItem(keyName(provider, userId), token);
}

export function removeStoredApiKey(provider: string, userId?: string): void {
  if (isServer) return;
  window.localStorage.removeItem(keyName(provider, userId));
}

/** AUTO-MIGRATION: upgrade legacy values to v2 on read */
export async function autoMigrateLegacyKeys(providers: string[], userId?: string): Promise<void> {
  if (isServer) return;
  for (const p of providers) {
    const k = keyName(p, userId);
    const raw = window.localStorage.getItem(k);
    if (!raw) continue;
    if (raw.startsWith("v2:gcm:")) continue;
    // legacy -> v2
    const plain = await decryptString(raw);
    const v2 = await encryptString(plain);
    window.localStorage.setItem(k, v2);
  }
}

/** OPTIONAL: enumerate keys for UI */
export function listStoredProviders(userId?: string): string[] {
  if (isServer || !window?.localStorage) return [];
  const out: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)!;
    const m = /^llm:key:(?:[^:]+):(.+)$/.exec(k);
    if (m) out.push(m[1]);
  }
  return Array.from(new Set(out));
}

/** LEGACY ALIASES required by existing imports */
export const secureRetrieve = getStoredApiKey;
export const secureStore = setStoredApiKey;
export const secureRemove = removeStoredApiKey;
