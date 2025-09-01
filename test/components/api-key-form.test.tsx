import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApiKeyForm from '@/components/api-key-form';
import { useToast } from '@/components/ui/use-toast';

// Mock the useToast hook
const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('ApiKeyForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default fetch mock: /api/config returns no configured providers
    (global.fetch as Mock).mockImplementation(async (url: string, init?: any) => {
      if (url === '/api/config') {
        return { ok: true, json: async () => ({ configuredProviders: [] }) } as any
      }
      if (url === '/api/test-api-key') {
        return { ok: true, json: async () => ({ valid: true, message: 'ok' }) } as any
      }
      if (url === '/api/config' && init?.method === 'POST') {
        return { ok: true, json: async () => ({}) } as any
      }
      return { ok: true, json: async () => ({}) } as any
    });
  });

  it('should render input fields for all providers', () => {
    render(<ApiKeyForm />);
    expect(screen.getByLabelText(/OpenAI API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Claude API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Google AI API Key/i)).toBeInTheDocument();
  });

  it('shows Saved badge for configured providers and masked placeholder', async () => {
    (global.fetch as Mock).mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ configuredProviders: ['openai'] }),
    }) as any);
    render(<ApiKeyForm />);
    // Saved badge visible
    await waitFor(() => {
      expect(screen.getAllByText('Saved')[0]).toBeInTheDocument();
    })
    const openaiInput = screen.getByLabelText(/OpenAI API Key/i) as HTMLInputElement
    expect(openaiInput.placeholder).toMatch(/•+/)
  });

  it('should save a single API key when its Save button is clicked', async () => {
    render(<ApiKeyForm />);
    const openaiInput = screen.getByLabelText(/OpenAI API Key/i);
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });

    fireEvent.change(openaiInput, { target: { value: 'new_openai_key' } });
    fireEvent.click(saveButtons[0]); // Click the first Save button for OpenAI

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/test-api-key', expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith('/api/config', expect.any(Object));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }));
    });
  });

  it('should clear a single API key when its Clear button is clicked', async () => {
    // Start with configured provider to enable Clear button
    (global.fetch as Mock).mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ configuredProviders: ['openai'] }),
    }) as any)
    render(<ApiKeyForm />);
    // Wait until Saved badge appears to ensure initial fetch completed
    await waitFor(() => {
      expect(screen.getAllByText('Saved')[0]).toBeInTheDocument()
    })

    const clearButtons = screen.getAllByRole('button', { name: 'Clear' });
    fireEvent.click(clearButtons[0]);

    await waitFor(() => {
      expect((global.fetch as Mock)).toHaveBeenNthCalledWith(2, '/api/config', expect.objectContaining({ method: 'POST' }))
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'API Key Cleared' }));
    });
  });
  // Removed legacy "Save All API Keys" behavior; UI saves per-provider only.
});
