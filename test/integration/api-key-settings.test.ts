/**
 * Integration test for API Key Settings functionality
 * Tests the complete flow of saving and testing API keys
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/app/settings/page';
import { storeApiKey, getStoredApiKey } from '@/lib/secure-storage';

// Mock the secure storage
vi.mock('@/lib/secure-storage', () => ({
  storeApiKey: vi.fn(),
  getStoredApiKey: vi.fn(),
  removeApiKey: vi.fn(),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: '1', email: 'test@example.com' } },
    status: 'authenticated'
  }),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock fetch for API testing
global.fetch = vi.fn();

describe('API Key Settings Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
    
    // Setup default mocks
    vi.mocked(getStoredApiKey).mockResolvedValue(null);
    vi.mocked(storeApiKey).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save and test OpenAI API key successfully', async () => {
    const user = userEvent.setup();
    
    // Mock successful API test response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        valid: true,
        message: 'API key is valid'
      })
    } as Response);

    render(<SettingsPage />);

    // Find OpenAI API key input
    const openaiInput = screen.getByPlaceholderText(/sk-.*OpenAI/);
    const saveButton = screen.getByText('Save & Test');

    // Enter a valid OpenAI API key
    const testApiKey = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef';
    await user.type(openaiInput, testApiKey);

    // Click save button
    await user.click(saveButton);

    // Wait for the save and test process
    await waitFor(() => {
      expect(storeApiKey).toHaveBeenCalledWith('openai', testApiKey);
    });

    // Verify API test was called
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          apiKey: testApiKey
        })
      });
    });

    // Verify success toast was shown
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '✅ API Key Valid',
          description: expect.stringContaining('OpenAI API key is working correctly')
        })
      );
    });

    // Verify success indicator is shown
    expect(screen.getByText('✅ API key is valid and working')).toBeInTheDocument();
  });

  it('should handle invalid API key format', async () => {
    const user = userEvent.setup();
    
    // Mock API test response with format error
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        valid: false,
        message: "OpenAI API key must start with 'sk-'"
      })
    } as Response);

    render(<SettingsPage />);

    // Find OpenAI API key input
    const openaiInput = screen.getByPlaceholderText(/sk-.*OpenAI/);
    const saveButton = screen.getByText('Save & Test');

    // Enter invalid API key format
    const invalidApiKey = 'invalid-key-format';
    await user.type(openaiInput, invalidApiKey);

    // Click save button
    await user.click(saveButton);

    // Wait for the error
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '❌ API Key Invalid',
          description: "OpenAI API key must start with 'sk-'",
          variant: 'destructive'
        })
      );
    });

    // Verify error indicator is shown
    expect(screen.getByText('❌ API key test failed')).toBeInTheDocument();
  });

  it('should handle network errors during API testing', async () => {
    const user = userEvent.setup();
    
    // Mock network error
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    render(<SettingsPage />);

    // Find OpenAI API key input
    const openaiInput = screen.getByPlaceholderText(/sk-.*OpenAI/);
    const saveButton = screen.getByText('Save & Test');

    // Enter API key
    const testApiKey = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef';
    await user.type(openaiInput, testApiKey);

    // Click save button
    await user.click(saveButton);

    // Wait for the network error handling
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🔌 Connection Error',
          description: 'Failed to test API key: Network error',
          variant: 'destructive'
        })
      );
    });
  });

  it('should test Claude API key with proper validation', async () => {
    const user = userEvent.setup();
    
    // Mock successful Claude API test response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        valid: true,
        message: 'API key is valid'
      })
    } as Response);

    render(<SettingsPage />);

    // Find Claude API key input
    const claudeInput = screen.getByPlaceholderText(/sk-.*Claude/);

    // Enter a valid Claude API key
    const testApiKey = 'sk-ant-api03-abcd1234567890abcd1234567890abcd1234567890abcd-1234567890abcd';
    await user.type(claudeInput, testApiKey);

    // Find and click the save button for Claude
    const saveButtons = screen.getAllByText('Save & Test');
    const claudeSaveButton = saveButtons[1]; // Assuming Claude is second
    await user.click(claudeSaveButton);

    // Wait for the API test
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'claude',
          apiKey: testApiKey
        })
      });
    });

    // Verify success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '✅ API Key Valid'
        })
      );
    });
  });

  it('should prevent saving empty API keys', async () => {
    const user = userEvent.setup();
    
    render(<SettingsPage />);

    // Find OpenAI save button - should be disabled initially
    const saveButton = screen.getByText('Save & Test');
    expect(saveButton).toBeDisabled();

    // Enter empty/whitespace key
    const openaiInput = screen.getByPlaceholderText(/sk-.*OpenAI/);
    await user.type(openaiInput, '   ');

    // Button should still be disabled
    expect(saveButton).toBeDisabled();

    // Clear and leave empty
    await user.clear(openaiInput);
    
    // Try to save anyway by calling the function directly would show error
    // This tests the validation in the save function
  });

  it('should load previously saved API keys on mount', async () => {
    // Mock existing saved API key
    vi.mocked(getStoredApiKey).mockImplementation((provider) => {
      if (provider === 'openai') {
        return Promise.resolve('sk-saved1234567890abcdef1234567890abcdef1234567890ab');
      }
      return Promise.resolve(null);
    });

    render(<SettingsPage />);

    // Wait for the component to load saved keys
    await waitFor(() => {
      const openaiInput = screen.getByPlaceholderText(/sk-.*OpenAI/) as HTMLInputElement;
      expect(openaiInput.value).toBe('sk-saved1234567890abcdef1234567890abcdef1234567890ab');
    });

    // Verify the status indicator shows configured
    expect(screen.getByText('API key configured')).toBeInTheDocument();
  });

  it('should show proper status indicators during testing', async () => {
    const user = userEvent.setup();
    
    // Mock delayed API response
    vi.mocked(fetch).mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: () => Promise.resolve({ valid: true, message: 'API key is valid' })
          } as Response);
        }, 100);
      })
    );

    render(<SettingsPage />);

    const openaiInput = screen.getByPlaceholderText(/sk-.*OpenAI/);
    const saveButton = screen.getByText('Save & Test');

    // Enter API key
    await user.type(openaiInput, 'sk-1234567890abcdef1234567890abcdef1234567890abcdef');

    // Click save
    await user.click(saveButton);

    // Should show testing status
    expect(screen.getByText('🔄 Testing API key...')).toBeInTheDocument();
    expect(screen.getByText('Saving...')).toBeInTheDocument();

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('✅ API key is valid and working')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should handle Enter key press to save API key', async () => {
    const user = userEvent.setup();
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valid: true, message: 'API key is valid' })
    } as Response);

    render(<SettingsPage />);

    const openaiInput = screen.getByPlaceholderText(/sk-.*OpenAI/);
    
    // Enter API key
    await user.type(openaiInput, 'sk-1234567890abcdef1234567890abcdef1234567890abcdef');
    
    // Press Enter
    await user.keyboard('{Enter}');

    // Should trigger save and test
    await waitFor(() => {
      expect(storeApiKey).toHaveBeenCalled();
    });
  });
});

describe('API Key Testing Route Integration', () => {
  it('should validate different provider key formats', async () => {
    // Test OpenAI key format validation
    const openaiResponse = await fetch('http://localhost:3003/api/test-api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        apiKey: 'invalid-format'
      })
    });

    const openaiData = await openaiResponse.json();
    expect(openaiData.valid).toBe(false);
    expect(openaiData.message).toContain("must start with 'sk-'");

    // Test Claude key format validation
    const claudeResponse = await fetch('http://localhost:3003/api/test-api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'claude',
        apiKey: 'invalid-format'
      })
    });

    const claudeData = await claudeResponse.json();
    expect(claudeData.valid).toBe(false);
    expect(claudeData.message).toContain("must start with 'sk-ant-'");
  });
});