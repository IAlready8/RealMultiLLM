'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

export interface ProviderConfig {
  id: string;
  provider: string;
  isActive: boolean;
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderConfigInput {
  provider: string;
  apiKey: string;
  settings?: Record<string, any>;
}

export interface TestResult {
  valid: boolean;
  message: string;
}

export function useProviderConfig() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all provider configurations
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/provider-configs');
      if (!response.ok) {
        throw new Error('Failed to fetch provider configurations');
      }
      const data = await response.json();
      setConfigs(data.configs || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error fetching configs';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Save or update a provider configuration
  const saveConfig = useCallback(
    async (input: ProviderConfigInput): Promise<ProviderConfig | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/provider-configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save configuration');
        }

        const data = await response.json();
        const savedConfig = data.config;

        // Update local state
        setConfigs((prev) => {
          const existing = prev.findIndex(
            (c) => c.provider === savedConfig.provider
          );
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = savedConfig;
            return updated;
          }
          return [...prev, savedConfig];
        });

        toast({
          title: 'Success',
          description: `Configuration for ${input.provider} saved successfully`,
        });

        return savedConfig;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error saving config';
        setError(message);
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Update only the settings of a provider configuration
  const updateSettings = useCallback(
    async (
      provider: string,
      settings: Record<string, any>
    ): Promise<ProviderConfig | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/provider-configs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, settings }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update settings');
        }

        const data = await response.json();
        const updatedConfig = data.config;

        // Update local state
        setConfigs((prev) =>
          prev.map((c) =>
            c.provider === updatedConfig.provider ? updatedConfig : c
          )
        );

        toast({
          title: 'Success',
          description: `Settings for ${provider} updated successfully`,
        });

        return updatedConfig;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error updating settings';
        setError(message);
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Delete a provider configuration
  const deleteConfig = useCallback(
    async (provider: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/provider-configs/${provider}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete configuration');
        }

        // Update local state
        setConfigs((prev) => prev.filter((c) => c.provider !== provider));

        toast({
          title: 'Success',
          description: `Configuration for ${provider} deleted successfully`,
        });

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error deleting config';
        setError(message);
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Test an API key without saving it
  const testApiKey = useCallback(
    async (provider: string, apiKey: string): Promise<TestResult> => {
      setLoading(true);
      try {
        const response = await fetch('/api/provider-configs/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey }),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            valid: false,
            message: data.error || 'Failed to test API key',
          };
        }

        return {
          valid: data.valid,
          message: data.message || 'Test completed',
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error testing API key';
        return {
          valid: false,
          message,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Get configuration for a specific provider
  const getConfig = useCallback(
    (provider: string): ProviderConfig | undefined => {
      return configs.find((c) => c.provider === provider);
    },
    [configs]
  );

  // Check if a provider is configured
  const isConfigured = useCallback(
    (provider: string): boolean => {
      return configs.some((c) => c.provider === provider && c.isActive);
    },
    [configs]
  );

  // Load configs on mount
  useEffect(() => {
    fetchConfigs();
  }, []);

  return {
    configs,
    loading,
    error,
    fetchConfigs,
    saveConfig,
    updateSettings,
    deleteConfig,
    testApiKey,
    getConfig,
    isConfigured,
  };
}
