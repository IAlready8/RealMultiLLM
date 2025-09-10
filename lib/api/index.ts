/**
 * Enterprise API System - Advanced Middleware
 * 
 * This module provides advanced API middleware for enterprise applications:
 * - Rate limiting with adaptive algorithms
 * - Circuit breaker patterns for resilience
 * - Comprehensive error handling
 * - Request validation and sanitization
 * - Security enhancements
 * - Monitoring and observability
 * 
 * Features:
 * - Configurable rate limiting per endpoint
 * - Intelligent circuit breaker implementation
 * - Standardized error handling with context
 * - Request/response logging
 * - Performance monitoring
 * - Security headers and protections
 */

// Rate limiting
export { 
  checkApiRateLimit, 
  resetApiRateLimit, 
  getApiRateLimitStatus,
  RateLimitError,
  type RateLimitConfig,
  type RateLimitResult
} from './rate-limiter';

// Circuit breaker
export { 
  executeWithCircuitBreaker, 
  CircuitBreakerError,
  type CircuitBreakerConfig
} from './circuit-breaker';

// Error handling
export { 
  createErrorResponse,
  withErrorHandling
} from './error-handler';