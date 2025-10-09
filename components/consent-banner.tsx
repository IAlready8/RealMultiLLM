/**
 * Consent Banner Component
 * Displays a banner for users to manage their consent preferences
 */

"use client";

import React, { useState, useEffect } from 'react';
import { useConsent } from '../hooks/use-consent';
import { ConsentCategory } from '@/types/compliance';

interface ConsentBannerProps {
  onConsentChange?: (updatedConsents: Record<ConsentCategory, boolean>) => void;
}

const ConsentBanner: React.FC<ConsentBannerProps> = ({ onConsentChange }) => {
  const { consentStatus, loading, error, grantConsent, withdrawConsent, refreshConsentStatus } = useConsent();
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Show the banner if user hasn't consented to all categories
  useEffect(() => {
    if (!loading) {
      const hasAllConsents = Object.values(consentStatus).every(status => status === true);
      setIsVisible(!hasAllConsents);
    }
  }, [consentStatus, loading]);

  const handleAcceptAll = async () => {
    const categories: ConsentCategory[] = [
      'data_processing',
      'marketing_communication',
      'third_party_sharing',
      'analytics',
      'personalization'
    ];

    for (const category of categories) {
      if (!consentStatus[category]) {
        await grantConsent(
          category,
          getDefaultConsentText(category),
          '1.0'
        );
      }
    }
    
    setIsVisible(false);
    // Ensure all values are boolean, not undefined
    const validatedConsent: Record<ConsentCategory, boolean> = {
      data_processing: consentStatus.data_processing ?? false,
      analytics: consentStatus.analytics ?? false,
      marketing_communication: consentStatus.marketing_communication ?? false,
      third_party_sharing: consentStatus.third_party_sharing ?? false,
      personalization: consentStatus.personalization ?? false
    };
    onConsentChange?.(validatedConsent);
  };

  const handleRejectAll = async () => {
    const categories: ConsentCategory[] = [
      'marketing_communication',
      'third_party_sharing',
      'analytics',
      'personalization'
    ];

    for (const category of categories) {
      if (consentStatus[category]) {
        await withdrawConsent(category);
      }
    }
    
    // Always keep data processing consent as required for basic functionality
    setIsVisible(false);
    const validatedConsent2: Record<ConsentCategory, boolean> = {
      data_processing: consentStatus.data_processing ?? false,
      analytics: consentStatus.analytics ?? false,
      marketing_communication: consentStatus.marketing_communication ?? false,
      third_party_sharing: consentStatus.third_party_sharing ?? false,
      personalization: consentStatus.personalization ?? false
    };
    onConsentChange?.(validatedConsent2);
  };

  const handleSavePreferences = async () => {
    setIsVisible(false);
    const validatedConsent3: Record<ConsentCategory, boolean> = {
      data_processing: consentStatus.data_processing ?? false,
      analytics: consentStatus.analytics ?? false,
      marketing_communication: consentStatus.marketing_communication ?? false,
      third_party_sharing: consentStatus.third_party_sharing ?? false,
      personalization: consentStatus.personalization ?? false
    };
    onConsentChange?.(validatedConsent3);
  };

  const toggleConsent = async (category: ConsentCategory) => {
    if (consentStatus[category]) {
      await withdrawConsent(category);
    } else {
      await grantConsent(
        category,
        getDefaultConsentText(category),
        '1.0'
      );
    }
    
    // Refresh status after action
    await refreshConsentStatus();
  };

  if (!isVisible || loading) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">We value your privacy</h3>
            <p className="text-sm text-gray-600 mt-1">
              We use cookies and similar technologies to improve your experience, analyze traffic, and show personalized content.
              By continuing to use our service, you consent to our use of these technologies.
            </p>
            
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            
            {showDetails && (
              <div className="mt-4 space-y-3">
                <ConsentOption 
                  category="data_processing"
                  title="Essential Cookies"
                  description="These cookies are necessary for the website to function and cannot be switched off."
                  checked={consentStatus.data_processing || false}
                  onChange={() => {}} // Essential cookies can't be toggled off
                  disabled={true}
                />
                
                <ConsentOption 
                  category="analytics"
                  title="Analytics Cookies"
                  description="These cookies allow us to count visits and traffic sources to measure and improve the performance of our site."
                  checked={consentStatus.analytics || false}
                  onChange={toggleConsent}
                />
                
                <ConsentOption 
                  category="personalization"
                  title="Personalization Cookies"
                  description="These cookies enable the website to provide enhanced functionality and personalization."
                  checked={consentStatus.personalization || false}
                  onChange={toggleConsent}
                />
                
                <ConsentOption 
                  category="marketing_communication"
                  title="Marketing Communications"
                  description="I consent to receive marketing communications from the company."
                  checked={consentStatus.marketing_communication || false}
                  onChange={toggleConsent}
                />
                
                <ConsentOption 
                  category="third_party_sharing"
                  title="Third-Party Sharing"
                  description="I consent to the sharing of my data with trusted third parties for the purposes described."
                  checked={consentStatus.third_party_sharing || false}
                  onChange={toggleConsent}
                />
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleRejectAll}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Reject All
            </button>
            
            <button
              onClick={handleAcceptAll}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Accept All
            </button>
            
            <button
              onClick={handleSavePreferences}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ConsentOptionProps {
  category: ConsentCategory;
  title: string;
  description: string;
  checked: boolean;
  onChange: (category: ConsentCategory) => void;
  disabled?: boolean;
}

const ConsentOption: React.FC<ConsentOptionProps> = ({ 
  category, 
  title, 
  description, 
  checked, 
  onChange, 
  disabled = false 
}) => {
  return (
    <div className="flex items-start">
      <div className="flex items-center h-5">
        <input
          id={`consent-${category}`}
          name={`consent-${category}`}
          type="checkbox"
          checked={checked}
          onChange={() => !disabled && onChange(category)}
          disabled={disabled}
          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded disabled:opacity-50"
        />
      </div>
      <div className="ml-3 text-sm">
        <label htmlFor={`consent-${category}`} className="font-medium text-gray-900">
          {title}
          {disabled && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Required
            </span>
          )}
        </label>
        <p className="text-gray-500">{description}</p>
      </div>
    </div>
  );
};

// Get default consent text based on category
function getDefaultConsentText(category: ConsentCategory): string {
  switch (category) {
    case 'data_processing':
      return 'I consent to the processing of my personal data in accordance with the terms of the service.';
    case 'marketing_communication':
      return 'I consent to receive marketing communications from the company.';
    case 'third_party_sharing':
      return 'I consent to the sharing of my data with trusted third parties for the purposes described.';
    case 'analytics':
      return 'I consent to the use of analytics tools to improve the service.';
    case 'personalization':
      return 'I consent to the use of my data to personalize my experience.';
    default:
      return 'I consent to the processing of my personal data.';
  }
}

export default ConsentBanner;