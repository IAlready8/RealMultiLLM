import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApiKeyForm from '@/components/api-key-form';

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

// Mock crypto utilities
vi.mock('@/lib/crypto', () => ({
  encryptApiKey: vi.fn().mockReturnValue('encrypted-key'),
  decryptApiKey: vi.fn().mockReturnValue('decrypted-key'),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

describe('ApiKeyForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should render all provider inputs', () => {
    render(<ApiKeyForm />);
    
    expect(screen.getByLabelText(/OpenAI API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Claude API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Google AI API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Llama API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Grok API Key/i)).toBeInTheDocument();
  });

  it('should load existing API keys from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({
      openai: 'encrypted-openai-key',
      claude: 'encrypted-claude-key'
    }));

    render(<ApiKeyForm />);
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith('apiKeys');
  });

  it('should save API keys when form is submitted', async () => {
    render(<ApiKeyForm />);
    
    const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
    const claudeInput = screen.getByLabelText(/Claude API Key/i);
    const saveButton = screen.getByRole('button', { name: /save api keys/i });

    fireEvent.change(openaiInput, { target: { value: 'sk-test-openai-key' } });
    fireEvent.change(claudeInput, { target: { value: 'claude-test-key' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'apiKeys',
        expect.stringContaining('encrypted-key')
      );
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'API keys saved successfully'
      });
    });
  });

  it('should clear all API keys when clear button is clicked', async () => {
    render(<ApiKeyForm />);
    
    const clearButton = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('apiKeys');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'All API keys cleared'
      });
    });
  });

  it('should toggle password visibility', () => {
    render(<ApiKeyForm />);
    
    const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
    const toggleButtons = screen.getAllByRole('button', { name: /toggle visibility/i });
    
    expect(openaiInput).toHaveAttribute('type', 'password');
    
    fireEvent.click(toggleButtons[0]); // Click first toggle button
    expect(openaiInput).toHaveAttribute('type', 'text');
    
    fireEvent.click(toggleButtons[0]); // Click again to hide
    expect(openaiInput).toHaveAttribute('type', 'password');
  });

  it('should validate API key format', async () => {
    render(<ApiKeyForm />);
    
    const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
    const saveButton = screen.getByRole('button', { name: /save api keys/i });

    fireEvent.change(openaiInput, { target: { value: 'invalid-key' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: expect.stringContaining('Invalid OpenAI API key format'),
        variant: 'destructive'
      });
    });
  });
});