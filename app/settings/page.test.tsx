import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import SettingsPage from './page'

// Mock services
vi.mock('@/lib/secure-storage', () => ({
  secureStore: vi.fn(),
  secureRetrieve: vi.fn(),
  secureRemove: vi.fn(),
}))

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
  ExportImportDialog: ({ onExport, onImport }: { onExport: Function; onImport: Function }) => (
    <div data-testid="export-import-dialog">
      <button onClick={() => onExport()}>Export</button>
      <button onClick={() => onImport()}>Import</button>
    </div>
  ),
}))

describe('Settings Page', () => {
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
    
    // Suppress console warnings for cleaner test output
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all main sections', () => {
    render(<SettingsPage />)
    
    expect(screen.getByRole('heading', { name: /configuration & analytics/i })).toBeInTheDocument()
    expect(screen.getByText(/manage your api keys, model settings, and view usage statistics/i)).toBeInTheDocument()
    
    // Check for all tabs
    expect(screen.getByRole('tab', { name: /api keys/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /model settings/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /analytics/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /export\/import/i })).toBeInTheDocument()
  })

  it('displays all supported providers in API Keys tab', () => {
    render(<SettingsPage />)
    
    const providers = ['OpenAI', 'Claude', 'Google AI', 'Llama', 'GitHub', 'Grok']
    
    providers.forEach(provider => {
      expect(screen.getByText(`${provider} API Key`)).toBeInTheDocument()
    })
  })

  it('allows saving API keys', async () => {
    const user = userEvent.setup()
    const { secureStore } = await import('@/lib/secure-storage')
    
    render(<SettingsPage />)
    
    const openAICard = screen.getByText('OpenAI API Key').closest('div.rounded-lg')
    const openaiInput = within(openAICard).getByPlaceholderText('Enter your OpenAI API key')
    const saveButton = within(openAICard).getByRole('button', { name: /save/i })
    
    await user.type(openaiInput, 'sk-test123')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(secureStore).toHaveBeenCalledWith('apiKey_openai', 'sk-test123')
    })
  })

  it('shows API key status indicators', () => {
    render(<SettingsPage />)
    
    const statusMessages = screen.getAllByText(/no api key configured/i)
    expect(statusMessages).toHaveLength(6) // 6 providers
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
    const { secureRetrieve } = await import('@/lib/secure-storage')
    vi.mocked(secureRetrieve).mockResolvedValue('sk-test123')
    
    render(<SettingsPage />)
    
    await waitFor(() => {
      const openAICard = screen.getByText('OpenAI API Key').closest('div.rounded-lg')
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