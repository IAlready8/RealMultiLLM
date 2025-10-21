/**
 * Provider Configuration Hook
 * Manages provider configuration state and API interactions
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface ProviderConfig {
  id: string;
  provider: string;
  isActive: boolean;
  lastUsedAt?: Date;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  hasApiKey: boolean;
}

export interface TestResult {
  success: boolean;
  message: string;
  provider: string;
  timestamp: string;
  testedAt: string;
  details?: {
    error?: string;
    statusCode?: number;
    responseTime?: number;
    model?: string;
    rateLimit?: {
      remaining?: number;
      reset?: number;
    };
  };
}

export function useProviderConfig() {
  const { data: session } = useSession();
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // Fetch all provider configurations
  const fetchConfigs = useCallback(async () => {
    if (!session?.user?.id) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/provider-config');
      if (!response.ok) {
        throw new Error('Failed to fetch provider configurations');
      }

      const data = await response.json();
      setConfigs(data.configs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Create or update provider configuration
  const saveProviderConfig = useCallback(async (
    provider: string,
    apiKey: string,
    settings?: Record<string, any>
  ): Promise<boolean> => {
    if (!session?.user?.id) {
      setError('User not authenticated');
      return false;
    }

    try {
      setError(null);

      const response = await fetch('/api/provider-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          apiKey,
          settings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save provider configuration');
      }

      const data = await response.json();

      // Refresh configs to get updated data
      await fetchConfigs();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [session?.user?.id, fetchConfigs]);

  // Update provider configuration
  const updateProviderConfig = useCallback(async (
    configId: string,
    updates: {
      apiKey?: string;
      settings?: Record<string, any>;
      isActive?: boolean;
    }
  ): Promise<boolean> => {
    if (!session?.user?.id) {
      setError('User not authenticated');
      return false;
    }

    try {
      setError(null);

      const response = await fetch(`/api/provider-config?configId=${configId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update provider configuration');
      }

      // Refresh configs to get updated data
      await fetchConfigs();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [session?.user?.id, fetchConfigs]);

  // Delete provider configuration
  const deleteProviderConfig = useCallback(async (configId: string): Promise<boolean> => {
    if (!session?.user?.id) {
      setError('User not authenticated');
      return false;
    }

    try {
      setError(null);

      const response = await fetch(`/api/provider-config?configId=${configId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete provider configuration');
      }

      // Refresh configs to get updated data
      await fetchConfigs();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [session?.user?.id, fetchConfigs]);

  // Test provider API key
  const testProviderApiKey = useCallback(async (provider: string): Promise<TestResult | null> => {
    if (!session?.user?.id) {
      setError('User not authenticated');
      return null;
    }

    try {
      setError(null);
      setTestingProvider(provider);

      const response = await fetch('/api/provider-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test provider');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Return a failed test result
      return {
        success: false,
        message: errorMessage,
        provider,
        timestamp: new Date().toISOString(),
        testedAt: new Date().toISOString(),
        details: {
          error: errorMessage,
        },
      };
    } finally {
      setTestingProvider(null);
    }
  }, [session?.user?.id]);

  // Get configuration for a specific provider
  const getProviderConfig = useCallback((provider: string): ProviderConfig | undefined => {
    return configs.find(config => config.provider === provider);
  }, [configs]);

  // Get active configurations
  const getActiveConfigs = useCallback((): ProviderConfig[] => {
    return configs.filter(config => config.isActive);
  }, [configs]);

  // Load configs on mount and when session changes
  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return {
    configs,
    loading,
    error,
    testingProvider,
    fetchConfigs,
    saveProviderConfig,
    updateProviderConfig,
    deleteProviderConfig,
    testProviderApiKey,
    getProviderConfig,
    getActiveConfigs,
  };
}
