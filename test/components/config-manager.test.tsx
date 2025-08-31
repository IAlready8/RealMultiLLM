import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test-utils'
import { ConfigManager } from '@/components/settings/config-manager'
import { createMockFetch, mockApiResponses } from '../test-utils'

// Mock fetch
const mockFetch = createMockFetch()
global.fetch = mockFetch

describe('ConfigManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should render provider configuration tabs', async () => {
    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Provider Configuration Manager')).toBeInTheDocument()
    })

    // Check all provider tabs are present
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('Google AI')).toBeInTheDocument()
    expect(screen.getByText('OpenRouter')).toBeInTheDocument()
  })

  it('should load existing configurations on mount', async () => {
    const mockConfigs = {
      configs: {
        openai: {
          apiKey: 'sk-test-key',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          rateLimits: { requests: 60, window: 60000 },
          isActive: true,
        },
      },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockConfigs,
    } as Response)

    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/config/validate')
    })

    // Should show configured badge on OpenAI tab
    await waitFor(() => {
      const openAiTab = screen.getByText('OpenAI').closest('button')
      expect(openAiTab).toBeInTheDocument()
      // Badge should be present (green dot)
      const badge = openAiTab?.querySelector('.bg-green-500')
      expect(badge).toBeInTheDocument()
    })
  })

  it('should handle provider configuration form submission', async () => {
    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    })

    // Fill in API key
    const apiKeyInput = screen.getByLabelText(/API Key/)
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-new-key' } })

    // Submit form (test & validate)
    const testButton = screen.getByText('Test & Validate')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/config/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          config: expect.objectContaining({
            apiKey: 'sk-test-new-key',
            models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            rateLimits: { requests: 60, window: 60000 },
            isActive: true,
          }),
        }),
      })
    })
  })

  it('should show validation errors for invalid configuration', async () => {
    const errorResponse = {
      success: false,
      errors: [
        { path: 'apiKey', message: 'API key is required' },
        { path: 'rateLimits.requests', message: 'Must be at least 1' },
      ],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => errorResponse,
    } as Response)

    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    })

    // Submit form with empty API key
    const testButton = screen.getByText('Test & Validate')
    fireEvent.click(testButton)

    // Wait for validation errors to appear
    await waitFor(() => {
      expect(screen.getByText('Configuration errors:')).toBeInTheDocument()
      expect(screen.getByText('• apiKey: API key is required')).toBeInTheDocument()
      expect(screen.getByText('• rateLimits.requests: Must be at least 1')).toBeInTheDocument()
    })
  })

  it('should show success message for valid configuration with connection test', async () => {
    const successResponse = {
      success: true,
      data: {
        apiKey: 'sk-valid-key',
        models: ['gpt-4'],
        rateLimits: { requests: 60, window: 60000 },
        isActive: true,
      },
      connectionTest: {
        success: true,
        latency: 150,
      },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => successResponse,
    } as Response)

    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    })

    // Fill in valid API key
    const apiKeyInput = screen.getByLabelText(/API Key/)
    fireEvent.change(apiKeyInput, { target: { value: 'sk-valid-key' } })

    // Submit form
    const testButton = screen.getByText('Test & Validate')
    fireEvent.click(testButton)

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('Configuration is valid!')).toBeInTheDocument()
      expect(screen.getByText('Connection test: ✓ Passed (150ms)')).toBeInTheDocument()
    })

    // Save button should appear
    expect(screen.getByText('Save Configuration')).toBeInTheDocument()
  })

  it('should handle connection test failure', async () => {
    const failedResponse = {
      success: true,
      data: {
        apiKey: 'sk-invalid-key',
        models: ['gpt-4'],
        rateLimits: { requests: 60, window: 60000 },
        isActive: true,
      },
      connectionTest: {
        success: false,
        error: 'Invalid API key',
      },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => failedResponse,
    } as Response)

    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    })

    const apiKeyInput = screen.getByLabelText(/API Key/)
    fireEvent.change(apiKeyInput, { target: { value: 'sk-invalid-key' } })

    const testButton = screen.getByText('Test & Validate')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(screen.getByText('Configuration is valid!')).toBeInTheDocument()
      expect(screen.getByText('Connection test: ✗ Failed: Invalid API key')).toBeInTheDocument()
    })
  })

  it('should save configuration after successful validation', async () => {
    const validationResponse = {
      success: true,
      data: {
        apiKey: 'sk-valid-key',
        models: ['gpt-4'],
        rateLimits: { requests: 60, window: 60000 },
        isActive: true,
      },
      connectionTest: { success: true, latency: 150 },
    }

    // Mock validation response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validationResponse,
    } as Response)

    // Mock save response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response)

    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    })

    // Fill and validate
    const apiKeyInput = screen.getByLabelText(/API Key/)
    fireEvent.change(apiKeyInput, { target: { value: 'sk-valid-key' } })

    const testButton = screen.getByText('Test & Validate')
    fireEvent.click(testButton)

    // Wait for validation success
    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument()
    })

    // Click save
    const saveButton = screen.getByText('Save Configuration')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/provider-configs/openai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'sk-valid-key',
          models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
          rateLimits: { requests: 60, window: 60000 },
          isActive: true,
          settings: {},
        }),
      })
    })
  })

  it('should handle rate limit configuration', async () => {
    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    })

    // Find rate limit inputs
    const requestsInput = screen.getByLabelText(/Requests per minute/)
    const windowInput = screen.getByLabelText(/Window \(ms\)/)

    // Change rate limits
    fireEvent.change(requestsInput, { target: { value: '100' } })
    fireEvent.change(windowInput, { target: { value: '30000' } })

    // Values should be updated
    expect(requestsInput).toHaveValue(100)
    expect(windowInput).toHaveValue(30000)
  })

  it('should switch between provider tabs', async () => {
    render(<ConfigManager userId="test-user-1" />)

    // Initially should show OpenAI
    await waitFor(() => {
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    })

    // Click Anthropic tab
    const anthropicTab = screen.getByText('Anthropic')
    fireEvent.click(anthropicTab)

    // Should show Anthropic configuration
    await waitFor(() => {
      expect(screen.getByText('Anthropic Configuration')).toBeInTheDocument()
    })

    // Should show Anthropic models
    expect(screen.getByText('claude-3-opus')).toBeInTheDocument()
    expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument()
  })

  it('should handle disable/enable provider', async () => {
    // Mock existing configuration
    const mockConfigs = {
      configs: {
        openai: {
          apiKey: 'sk-test-key',
          models: ['gpt-4'],
          rateLimits: { requests: 60, window: 60000 },
          isActive: true,
        },
      },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockConfigs,
    } as Response)

    render(<ConfigManager userId="test-user-1" />)

    await waitFor(() => {
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument()
    })

    // Should show "Configured" badge
    await waitFor(() => {
      expect(screen.getByText('Configured')).toBeInTheDocument()
    })

    // Should show disable button
    const disableButton = screen.getByText('Disable')
    expect(disableButton).toBeInTheDocument()

    // Click disable
    fireEvent.click(disableButton)

    // Button text should change
    expect(screen.getByText('Enable')).toBeInTheDocument()
  })

  it('should display available models for each provider', async () => {
    render(<ConfigManager userId="test-user-1" />)

    // OpenAI models
    await waitFor(() => {
      expect(screen.getByText('gpt-4')).toBeInTheDocument()
      expect(screen.getByText('gpt-4-turbo')).toBeInTheDocument()
      expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument()
    })

    // Switch to Google AI
    fireEvent.click(screen.getByText('Google AI'))

    await waitFor(() => {
      expect(screen.getByText('gemini-pro')).toBeInTheDocument()
      expect(screen.getByText('gemini-pro-vision')).toBeInTheDocument()
    })
  })

  it('should handle loading and error states', async () => {
    // Mock network error
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<ConfigManager userId="test-user-1" />)

    // Should show loading initially
    expect(screen.getByText('Loading configurations...')).toBeInTheDocument()

    // After error, should still render but without configs
    await waitFor(() => {
      expect(screen.getByText('Provider Configuration Manager')).toBeInTheDocument()
    })
  })
})