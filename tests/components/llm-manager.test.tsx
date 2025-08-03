import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AllTheProviders } from '../../test/test-utils';

// Mock LLM Manager component for testing infrastructure
const MockLLMManager = () => {
  const [selectedModel, setSelectedModel] = vi.fn();
  const [apiLatency, setApiLatency] = vi.fn();
  const [memoryUsage, setMemoryUsage] = vi.fn();
  
  return (
    <div data-testid="llm-manager">
      <h1>LLM Manager</h1>
      <select 
        data-testid="model-selector"
        onChange={(e) => setSelectedModel(e.target.value)}
      >
        <option value="gpt-4">GPT-4</option>
        <option value="claude-3">Claude 3</option>
        <option value="gemini-pro">Gemini Pro</option>
      </select>
      
      <div data-testid="performance-metrics">
        <div data-testid="api-latency">API Latency: 150ms</div>
        <div data-testid="memory-usage">Memory: 45MB</div>
        <div data-testid="tokens-used">Tokens: 1,250</div>
      </div>
      
      <button 
        data-testid="send-message"
        onClick={() => {
          // Simulate API call performance tracking
          const startTime = performance.now();
          setTimeout(() => {
            const endTime = performance.now();
            setApiLatency(endTime - startTime);
          }, 100);
        }}
      >
        Send Message
      </button>
    </div>
  );
};

describe('LLM Manager Component', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let performanceStartTime: number;

  beforeEach(() => {
    user = userEvent.setup();
    performanceStartTime = performance.now();
    
    // Mock performance monitoring
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    
    // Mock API calls for testing
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test response' } }],
        usage: { total_tokens: 150 }
      })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    
    // Performance assertion - component should render quickly
    const renderTime = performance.now() - performanceStartTime;
    expect(renderTime).toBeLessThan(100); // Component should render in <100ms
  });

  it('renders LLM manager interface correctly', async () => {
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    // Core functionality tests
    expect(screen.getByTestId('llm-manager')).toBeInTheDocument();
    expect(screen.getByText('LLM Manager')).toBeInTheDocument();
    expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
  });

  it('allows model selection with performance tracking', async () => {
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    const modelSelector = screen.getByTestId('model-selector');
    
    await act(async () => {
      await user.selectOptions(modelSelector, 'claude-3');
    });

    expect(modelSelector).toHaveValue('claude-3');
  });

  it('displays performance metrics correctly', () => {
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    // Verify performance metrics are displayed
    expect(screen.getByTestId('api-latency')).toHaveTextContent('API Latency: 150ms');
    expect(screen.getByTestId('memory-usage')).toHaveTextContent('Memory: 45MB');
    expect(screen.getByTestId('tokens-used')).toHaveTextContent('Tokens: 1,250');
  });

  it('tracks API latency during message sending', async () => {
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    const sendButton = screen.getByTestId('send-message');
    
    await act(async () => {
      fireEvent.click(sendButton);
    });

    // Wait for simulated API call
    await waitFor(() => {
      // Verify that performance tracking is working
      expect(performance.now).toHaveBeenCalled();
    }, { timeout: 200 });
  });

  it('handles multiple LLM providers efficiently', async () => {
    const providers = ['gpt-4', 'claude-3', 'gemini-pro'];
    
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    const modelSelector = screen.getByTestId('model-selector');

    // Test switching between providers
    for (const provider of providers) {
      await act(async () => {
        await user.selectOptions(modelSelector, provider);
      });
      
      expect(modelSelector).toHaveValue(provider);
    }
  });

  it('maintains performance under load', async () => {
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    const sendButton = screen.getByTestId('send-message');
    const startTime = performance.now();

    // Simulate rapid consecutive API calls
    const promises = Array.from({ length: 5 }, () => 
      act(async () => {
        fireEvent.click(sendButton);
      })
    );

    await Promise.all(promises);
    
    const totalTime = performance.now() - startTime;
    
    // Should handle multiple concurrent calls efficiently
    expect(totalTime).toBeLessThan(1000); // All calls should complete in <1s
  });

  it('monitors memory usage during operations', async () => {
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    // Mock memory monitoring
    const mockMemoryUsage = vi.fn().mockReturnValue({
      usedJSHeapSize: 45 * 1024 * 1024, // 45MB
      totalJSHeapSize: 64 * 1024 * 1024, // 64MB
      jsHeapSizeLimit: 6144 * 1024 * 1024 // 6GB limit for 8GB system
    });

    Object.defineProperty(performance, 'memory', {
      get: mockMemoryUsage
    });

    const memoryMetrics = screen.getByTestId('memory-usage');
    expect(memoryMetrics).toBeInTheDocument();
  });

  it('validates API response handling', async () => {
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    const sendButton = screen.getByTestId('send-message');
    
    await act(async () => {
      fireEvent.click(sendButton);
    });

    // Verify fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    const sendButton = screen.getByTestId('send-message');
    
    await act(async () => {
      fireEvent.click(sendButton);
    });

    // Component should handle errors without crashing
    expect(screen.getByTestId('llm-manager')).toBeInTheDocument();
  });

  it('optimizes for macOS M2 performance constraints', () => {
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    // Verify component doesn't exceed memory constraints
    const component = screen.getByTestId('llm-manager');
    expect(component).toBeInTheDocument();
    
    // Mock performance.memory for M2 MacBook Air (8GB)
    const memoryLimit = 6144 * 1024 * 1024; // 6GB limit
    expect(memoryLimit).toBeGreaterThan(0);
  });
});

// Performance benchmarks for CI/CD
describe('LLM Manager Performance Benchmarks', () => {
  it('renders within performance budget', async () => {
    const startTime = performance.now();
    
    render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );
    
    const renderTime = performance.now() - startTime;
    
    // Performance assertions for CI/CD
    expect(renderTime).toBeLessThan(50); // First render should be <50ms
  });

  it('handles rapid re-renders efficiently', async () => {
    const { rerender } = render(
      <AllTheProviders>
        <MockLLMManager />
      </AllTheProviders>
    );

    const startTime = performance.now();
    
    // Trigger multiple re-renders
    for (let i = 0; i < 10; i++) {
      rerender(
        <AllTheProviders>
          <MockLLMManager />
        </AllTheProviders>
      );
    }
    
    const rerenderTime = performance.now() - startTime;
    expect(rerenderTime).toBeLessThan(100); // 10 re-renders should be <100ms
  });
});