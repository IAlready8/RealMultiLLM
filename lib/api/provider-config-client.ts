// Client utilities for managing provider configurations and testing API keys
// These helpers wrap the Next.js API routes used by the settings UI so they
// can also be consumed by CLI/testing scripts when needed.

export interface ProviderConfigInput {
  provider: string;
  apiKey: string;
  settings?: Record<string, unknown>;
}

export interface ProviderConfigResponse {
  id: string;
  provider: string;
  isActive: boolean;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSettingsUpdate {
  provider: string;
  settings: Record<string, unknown>;
}

export interface TestApiKeyResult {
  valid: boolean;
  message: string;
}

const PROVIDER_CONFIG_ENDPOINT = '/api/provider-configs';
const TEST_API_KEY_ENDPOINT = '/api/test-api-key';

async function handleJsonResponse<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    let details: unknown;

    try {
      details = await response.json();
    } catch (parseError) {
      // Ignore JSON parse failures and fall back to default error message.
    }

    const message =
      typeof details === 'object' && details && 'error' in details
        ? String((details as Record<string, unknown>).error)
        : errorMessage;

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function testApiKey(provider: string, apiKey: string): Promise<TestApiKeyResult> {
  const response = await fetch(TEST_API_KEY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });

  return handleJsonResponse<TestApiKeyResult>(response, 'Failed to test API key');
}

export async function saveProviderConfig(input: ProviderConfigInput): Promise<ProviderConfigResponse> {
  const response = await fetch(PROVIDER_CONFIG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await handleJsonResponse<{ config: ProviderConfigResponse }>(
    response,
    'Failed to save provider configuration'
  );

  return data.config;
}

export async function getProviderConfigs(): Promise<ProviderConfigResponse[]> {
  const response = await fetch(PROVIDER_CONFIG_ENDPOINT, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  const data = await handleJsonResponse<{ configs: ProviderConfigResponse[] }>(
    response,
    'Failed to fetch provider configurations'
  );

  return data.configs;
}

export async function updateProviderSettings(
  payload: ProviderSettingsUpdate
): Promise<ProviderConfigResponse> {
  const response = await fetch(PROVIDER_CONFIG_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await handleJsonResponse<{ config: ProviderConfigResponse }>(
    response,
    'Failed to update provider settings'
  );

  return data.config;
}
