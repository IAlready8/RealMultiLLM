import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApiKeyForm from '@/components/api-key-form';
import * as crypto from '@/lib/crypto';
import { useToast } from '@/components/ui/use-toast';

// Mock the crypto library
vi.mock('@/lib/crypto', () => ({
  encryptApiKey: vi.fn(key => `encrypted_${key}`),
  decryptApiKey: vi.fn(key => key.replace('encrypted_', '')),
}));

// Mock the useToast hook
const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage with spies
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
      // Also clear the spies
      localStorageMock.getItem.mockClear();
      localStorageMock.setItem.mockClear();
      localStorageMock.removeItem.mockClear();
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ApiKeyForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ valid: true }),
    });
  });

  it('should render input fields for all providers', () => {
    render(<ApiKeyForm />);
    expect(screen.getByLabelText(/OpenAI API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Claude API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Google AI API Key/i)).toBeInTheDocument();
  });

  it('should load and decrypt an existing API key from localStorage on mount', async () => {
    localStorageMock.setItem('apiKey_openai', 'encrypted_test_key');
    render(<ApiKeyForm />);
    await waitFor(() => {
      expect(crypto.decryptApiKey).toHaveBeenCalledWith('encrypted_test_key');
      const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
      expect((openaiInput as HTMLInputElement).value).toBe('test_key');
    });
  });

  it('should save a single API key when its Save button is clicked', async () => {
    render(<ApiKeyForm />);
    const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });

    fireEvent.change(openaiInput, { target: { value: 'new_openai_key' } });
    fireEvent.click(saveButtons[0]); // Click the first Save button for OpenAI

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/test-api-key', expect.any(Object));
      expect(crypto.encryptApiKey).toHaveBeenCalledWith('new_openai_key');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('apiKey_openai', 'encrypted_new_openai_key');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }));
    });
  });

  it('should clear a single API key when its Clear button is clicked', async () => {
    localStorageMock.setItem('apiKey_openai', 'encrypted_test_key');
    render(<ApiKeyForm />);
    
    await waitFor(() => {
        const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
        expect((openaiInput as HTMLInputElement).value).toBe('test_key');
    });

    const clearButtons = screen.getAllByRole('button', { name: 'Clear' });
    fireEvent.click(clearButtons[0]);

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('apiKey_openai');
      const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
      expect((openaiInput as HTMLInputElement).value).toBe('');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'API Key Cleared' }));
    });
  });

  it('should save all entered API keys when "Save All API Keys" is clicked', async () => {
    render(<ApiKeyForm />);
    const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
    const claudeInput = screen.getByLabelText(/Claude API Key/i);
    const saveAllButton = screen.getByRole('button', { name: /Save All API Keys/i });

    fireEvent.change(openaiInput, { target: { value: 'all_openai_key' } });
    fireEvent.change(claudeInput, { target: { value: 'all_claude_key' } });
    fireEvent.click(saveAllButton);

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('apiKey_openai', 'encrypted_all_openai_key');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('apiKey_claude', 'encrypted_all_claude_key');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('2 API keys saved') }));
    });
  });
});
