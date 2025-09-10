// Re-export rate limiting functionality from the main rate-limit module
export {
  checkApiRateLimit,
  resetApiRateLimit,
  getApiRateLimitStatus,
  RateLimitError,
  type RateLimitConfig,
  type RateLimitResult
} from '@/lib/api/rate-limiter';