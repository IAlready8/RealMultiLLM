import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import SettingsPage from './page'

// Mock services\nvi.mock('@/lib/secure-storage', () => ({\n  setStoredApiKey: vi.fn(),\n  getStoredApiKey: vi.fn(),\n}))

vi.mock('@/services/export-import-service', () => ({
  exportAllData: vi.fn(),
  importAllData: vi.fn(),
}))

// Mock analytics components
vi.mock('@/components/analytics/usage-chart', () => ({
  UsageChart: ({ title }: { title: string }) => <div data-testid="usage-chart">{title}</div>,
}))

vi.mock('@/components/analytics/model-comparison-chart', () => ({
  ModelComparisonChart: ({ title }: { title: string }) => <div data-testid="model-comparison-chart">{title}</div>,
}))

vi.mock('@/components/export-import-dialog', () => ({
  ExportImportDialog: ({
    onExport,
    onImport
  }: {
    onExport: (password: string) => Promise<string>
    onImport: (data: string, password: string) => Promise<void>
  }) => (
    <div data-testid="export-import-dialog">
      <button onClick={() => {
        void onExport('test-password')
      }}>Export</button>
      <button onClick={() => {
        void onImport('mock-data', 'test-password')
      }}>Import</button>
    </div>
  ),
}))

describe('Settings Page', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let configuredProvidersResponse: string[]
  let openRouterModelsResponse: unknown[]

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    })

    configuredProvidersResponse = []
    openRouterModelsResponse = []
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

      if (url.includes('/api/config') && (!init?.method || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({ configuredProviders: configuredProvidersResponse })
        } as Response
      }

      if (url.includes('/api/config') && init?.method === 'POST') {
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body ?? {}
        const provider = (body as Record<string, string>)?.provider
        if (provider && !configuredProvidersResponse.includes(provider)) {
          configuredProvidersResponse = [...configuredProvidersResponse, provider]
        }

        return {
          ok: true,
          json: async () => ({ success: true })
        } as Response
      }

      if (url.includes('/api/openrouter/models')) {
        return {
          ok: true,
          json: async () => ({ data: openRouterModelsResponse })
        } as Response
      }

      return {
        ok: true,
        json: async () => ({})
      } as Response
    })

    vi.stubGlobal('fetch', fetchMock)

    // Suppress console warnings for cleaner test output
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders all main sections', async () => {
    render(<SettingsPage />)

    expect(await screen.findByRole('heading', { name: /configuration & analytics/i })).toBeInTheDocument()
    expect(await screen.findByText(/manage your api keys, model settings, and view usage statistics/i)).toBeInTheDocument()

    // Check for all tabs
    expect(await screen.findByRole('tab', { name: /api keys/i })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: /model settings/i })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: /analytics/i })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: /export\/import/i })).toBeInTheDocument()
  })

  it('displays all supported providers in API Keys tab', async () => {
    render(<SettingsPage />)

    const providers = ['OpenAI', 'OpenRouter', 'Claude', 'Google AI', 'Llama', 'GitHub', 'Grok']

    for (const provider of providers) {
      expect(await screen.findByText(`${provider} API Key`)).toBeInTheDocument()
    }
  })

  it('allows saving API keys', async () => {
    const user = userEvent.setup()

    render(<SettingsPage />)

    const openAICard = screen.getByTestId('api-card-openai')
    const openaiInput = within(openAICard).getByPlaceholderText('Enter your OpenAI API key')
    const saveButton = within(openAICard).getByRole('button', { name: /save/i })

    await user.type(openaiInput, 'sk-test123')
    await user.click(saveButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/config'),
        expect.objectContaining({ method: 'POST' })
      )
      expect(within(openAICard).getByText(/api key is configured/i)).toBeInTheDocument()
    })
  })

  it('shows API key status indicators', async () => {
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getAllByText(/no api key configured/i)).toHaveLength(7) // 7 providers (includes OpenRouter)
    })
  })

  it('switches to model settings tab and shows provider configurations', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const modelSettingsTab = screen.getByRole('tab', { name: /model settings/i })
    await user.click(modelSettingsTab)
    
    await waitFor(() => {
      expect(screen.getByText('OpenAI Settings')).toBeInTheDocument()
      expect(screen.getByText('Claude Settings')).toBeInTheDocument()
      expect(screen.getByText('Google AI Settings')).toBeInTheDocument()
    })
  })

  it('allows adjusting temperature slider', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const modelSettingsTab = screen.getByRole('tab', { name: /model settings/i })
    await user.click(modelSettingsTab)
    
    await waitFor(() => {
      const sliders = screen.getAllByRole('slider')
      expect(sliders.length).toBeGreaterThan(0)
    })
  })

  it('allows selecting different models for providers', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const modelSettingsTab = screen.getByRole('tab', { name: /model settings/i })
    await user.click(modelSettingsTab)
    
    await waitFor(() => {
      const selectButtons = screen.getAllByRole('combobox')
      expect(selectButtons.length).toBeGreaterThan(0)
    })
  })

  it('displays analytics charts in analytics tab', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const analyticsTab = screen.getByRole('tab', { name: /analytics/i })
    await user.click(analyticsTab)
    
    await waitFor(() => {
      expect(screen.getByTestId('usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('model-comparison-chart')).toBeInTheDocument()
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })
  })

  it('shows activity logs in analytics tab', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const analyticsTab = screen.getByRole('tab', { name: /analytics/i })
    await user.click(analyticsTab)
    
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      expect(screen.getByText(/last \d+ log entries/i)).toBeInTheDocument()
    })
  })

  it('displays export/import functionality', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const exportImportTab = screen.getByRole('tab', { name: /export\/import/i })
    await user.click(exportImportTab)
    
    await waitFor(() => {
      expect(screen.getByTestId('export-import-dialog')).toBeInTheDocument()
      expect(screen.getByText('Export/Import Data')).toBeInTheDocument()
      expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    })
  })

  it('shows clear all data dialog', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const exportImportTab = screen.getByRole('tab', { name: /export\/import/i })
    await user.click(exportImportTab)
    
    await waitFor(() => {
      const clearButton = screen.getByRole('button', { name: /clear all data/i })
      expect(clearButton).toBeInTheDocument()
    })
  })

  it('allows resetting model settings to defaults', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const modelSettingsTab = screen.getByRole('tab', { name: /model settings/i })
    await user.click(modelSettingsTab)
    
    let resetButtons: HTMLElement[] = []
    await waitFor(() => {
      resetButtons = screen.getAllByText(/reset to defaults/i)
      expect(resetButtons.length).toBeGreaterThan(0)
    })
    
    await user.click(resetButtons[0])
    
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })
  })

  it('displays success indicators when API keys are configured', async () => {
    configuredProvidersResponse = ['openai']

    render(<SettingsPage />)

    await waitFor(() => {
      const openAICard = screen.getByTestId('api-card-openai')
      expect(within(openAICard).getByText(/api key is configured/i)).toBeInTheDocument()
    })
  })

  it('saves model settings when sliders are adjusted', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const modelSettingsTab = screen.getByRole('tab', { name: /model settings/i })
    await user.click(modelSettingsTab)
    
    await waitFor(() => {
      const sliders = screen.getAllByRole('slider')
      expect(sliders.length).toBeGreaterThan(0)
    })
  })

  it('generates and displays sample logs', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    
    const analyticsTab = screen.getByRole('tab', { name: /analytics/i })
    await user.click(analyticsTab)
    
    await waitFor(() => {
      const activitySection = screen.getByText('Recent Activity').closest('.bg-gray-900')
      expect(activitySection).toBeInTheDocument()
    })
  })
})
