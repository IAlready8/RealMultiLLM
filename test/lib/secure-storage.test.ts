import { describe, it, expect, beforeEach, vi } from "vitest";
import { setStoredApiKey, getStoredApiKey, getLegacyApiKeyIfPresent } from "@/lib/secure-storage";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe("secure-storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores and retrieves API keys", async () => {
    const provider = "openai";
    const apiKey = "sk-test-key-123";
    
    await setStoredApiKey(provider, apiKey);
    const retrieved = await getStoredApiKey(provider);
    
    expect(retrieved).toBe(apiKey);
  });

  it("handles legacy API key migration", async () => {
    const provider = "openai";
    const legacyKey = "legacy-key";
    
    localStorageMock.getItem.mockReturnValue(legacyKey);
    
    const result = await getLegacyApiKeyIfPresent(provider);
    
    expect(result).toBe(legacyKey);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(`apiKey_${provider}`);
  });

  it("returns null for non-existent keys", async () => {
    const result = await getStoredApiKey("nonexistent");
    expect(result).toBeNull();
  });

  it("handles empty API keys", async () => {
    await setStoredApiKey("test", "");
    const result = await getStoredApiKey("test");
    expect(result).toBeNull();
  });
});