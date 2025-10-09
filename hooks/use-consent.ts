/**
 * Consent Management Hook
 * Provides client-side functions for managing user consents
 */

import { useState, useEffect } from 'react';
import { ConsentCategory } from '../types/compliance';

export type ConsentState = {
  [key in ConsentCategory]?: boolean
}

export interface UseConsentReturn {
  consentStatus: ConsentState;
  loading: boolean;
  error: string | null;
  refreshConsentStatus: () => Promise<void>;
  grantConsent: (category: ConsentCategory, consentText: string, version: string) => Promise<void>;
  withdrawConsent: (category: ConsentCategory) => Promise<void>;
  renewConsent: (category: ConsentCategory, newConsentText: string, newVersion: string) => Promise<void>;
  bulkConsentAction: (categories: ConsentCategory[], action: 'grant' | 'withdraw') => Promise<void>;
}

export function useConsent(): UseConsentReturn {
  const [consentStatus, setConsentStatus] = useState<ConsentState>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current consent status
  const fetchConsentStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/consent');
      if (!response.ok) {
        throw new Error('Failed to fetch consent status');
      }
      
      const consents: any[] = await response.json();
      
      // Convert to a simple status map
      const statusMap: ConsentState = {};
      consents.forEach(consent => {
        if (consent.status === 'granted') {
          statusMap[consent.category as ConsentCategory] = true;
        } else {
          statusMap[consent.category as ConsentCategory] = false;
        }
      });
      
      setConsentStatus(statusMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching consent status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh consent status
  const refreshConsentStatus = async () => {
    await fetchConsentStatus();
  };

  // Grant consent for a category
  const grantConsent = async (category: ConsentCategory, consentText: string, version: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          consentText,
          version,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to grant consent');
      }
      
      // Update local state
      setConsentStatus(prev => ({
        ...prev,
        [category]: true,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error granting consent:', err);
    } finally {
      setLoading(false);
    }
  };

  // Withdraw consent for a category
  const withdrawConsent = async (category: ConsentCategory) => {
    try {
      setLoading(true);
      setError(null);
      
      // First, get the consent ID for this category
      const consentsResponse = await fetch('/api/consent?category=' + category);
      if (!consentsResponse.ok) {
        throw new Error('Failed to fetch consent records');
      }
      
      const consents: any[] = await consentsResponse.json();
      const activeConsent = consents.find(c => c.status === 'granted');
      
      if (!activeConsent) {
        throw new Error('No active consent found for this category');
      }
      
      const response = await fetch(`/api/consent?consentId=${activeConsent.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to withdraw consent');
      }
      
      // Update local state
      setConsentStatus(prev => ({
        ...prev,
        [category]: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error withdrawing consent:', err);
    } finally {
      setLoading(false);
    }
  };

  // Renew consent for a category
  const renewConsent = async (category: ConsentCategory, newConsentText: string, newVersion: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/consent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: category,
          newConsentText,
          newVersion,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to renew consent');
      }
      
      // Update local state
      setConsentStatus(prev => ({
        ...prev,
        [category]: true,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error renewing consent:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bulk consent operations
  const bulkConsentAction = async (categories: ConsentCategory[], action: 'grant' | 'withdraw') => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/consent/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories,
          action,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to ${action} consents`);
      }
      
      // Update local state based on the action
      setConsentStatus(prev => {
        const newState = { ...prev };
        categories.forEach(category => {
          newState[category] = action === 'grant';
        });
        return newState;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error in bulk consent operation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch consent status on component mount
  useEffect(() => {
    fetchConsentStatus();
  }, []);

  return {
    consentStatus,
    loading,
    error,
    refreshConsentStatus,
    grantConsent,
    withdrawConsent,
    renewConsent,
    bulkConsentAction,
  };
}