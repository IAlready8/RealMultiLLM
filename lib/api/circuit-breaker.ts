// Re-export circuit breaker functionality from the main circuit-breaker module
export {
  executeWithCircuitBreaker,
  CircuitBreakerError,
  type CircuitBreakerConfig,
  type CircuitState,
  circuitBreakerManager,
  ProviderConfigs
} from '@/lib/circuit-breaker';