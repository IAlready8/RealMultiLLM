import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import SettingsPage from './page'

// Mock services
vi.mock('@/lib/secure-storage', () => ({
  setStoredApiKey: vi.fn(),
  getStoredApiKey: vi.fn(),
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
})
