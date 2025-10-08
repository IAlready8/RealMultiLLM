// API Route Configuration for Vercel
// This file provides caching and performance optimization for API routes

export const apiConfig = {
  // Default cache settings for API routes
  cache: {
    // Maximum time to cache responses (in seconds)
    maxAge: 60, // 1 minute default
    // Whether to allow stale responses while revalidating
    staleWhileRevalidate: 30,
  },
  
  // Rate limiting configuration
  rateLimit: {
    // Maximum requests per window
    max: 60,
    // Window duration in milliseconds
    windowMs: 60 * 1000, // 1 minute
    // Message to return when rate limit is exceeded
    message: 'Too many requests, please try again later.',
  },
  
  // Timeout settings
  timeout: {
    // API request timeout in milliseconds
    request: 30000, // 30 seconds
    // Database query timeout
    database: 10000, // 10 seconds
  },
  
  // Response compression settings
  compression: {
    // Enable compression for API responses
    enabled: true,
    // Minimum response size to compress (in bytes)
    threshold: 1024,
  },
  
  // Error handling configuration
  errorHandling: {
    // Whether to include stack traces in error responses
    includeStack: process.env.NODE_ENV === 'development',
    // Default error message
    defaultMessage: 'An error occurred while processing your request',
  },
};

// Provider-specific API configurations
type ProviderApiConfig = {
  cache: {
    maxAge: number
    staleWhileRevalidate: number
  }
  timeout: {
    request: number
  }
  rateLimit: {
    max: number
    windowMs: number
  }
}

export const providerApiConfig: Record<string, ProviderApiConfig> = {
  openai: {
    cache: {
      maxAge: 300, // 5 minutes for model responses
      staleWhileRevalidate: 60,
    },
    timeout: {
      request: 60000, // 60 seconds for OpenAI (can be slow)
    },
    rateLimit: {
      max: 3000, // OpenAI's standard rate limit
      windowMs: 60000, // 1 minute
    },
  },
  
  anthropic: {
    cache: {
      maxAge: 300, // 5 minutes for model responses
      staleWhileRevalidate: 60,
    },
    timeout: {
      request: 60000, // 60 seconds for Anthropic
    },
    rateLimit: {
      max: 40, // Anthropic's standard rate limit
      windowMs: 60000, // 1 minute
    },
  },
  
  google: {
    cache: {
      maxAge: 300, // 5 minutes for model responses
      staleWhileRevalidate: 60,
    },
    timeout: {
      request: 45000, // 45 seconds for Google AI
    },
    rateLimit: {
      max: 100, // Google AI standard rate limit
      windowMs: 60000, // 1 minute
    },
  },
  
  openrouter: {
    cache: {
      maxAge: 300, // 5 minutes for model responses
      staleWhileRevalidate: 60,
    },
    timeout: {
      request: 60000, // 60 seconds for OpenRouter
    },
    rateLimit: {
      max: 100, // OpenRouter's standard rate limit
      windowMs: 60000, // 1 minute
    },
  },
  
  default: {
    cache: {
      maxAge: 60, // 1 minute default
      staleWhileRevalidate: 30,
    },
    timeout: {
      request: 30000, // 30 seconds default
    },
    rateLimit: {
      max: 60, // Default rate limit
      windowMs: 60000, // 1 minute
    },
  },
};

// Get configuration for a specific provider
export function getProviderConfig(providerId: string) {
  return providerApiConfig[providerId] || providerApiConfig.default;
}

// Middleware configuration for API routes
export const apiMiddlewareConfig = {
  cors: {
    origin: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) 
      : [process.env.NEXTAUTH_URL || 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin'
    ],
  },
  
  // Security headers
  security: {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https: 'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      }
    },
    
    // Strict Transport Security
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  },
};

// Performance monitoring configuration
export const performanceConfig = {
  // Enable performance metrics collection
  enableMetrics: process.env.ENABLE_ANALYTICS === 'true',
  
  // Metrics collection interval (in milliseconds)
  collectionInterval: 60000, // 1 minute
  
  // Metrics to collect
  metrics: [
    'api_response_time',
    'database_query_time',
    'provider_response_time',
    'memory_usage',
    'cpu_usage',
  ],
  
  // Performance thresholds
  thresholds: {
    apiResponseTime: 5000, // 5 seconds
    databaseQueryTime: 1000, // 1 second
    providerResponseTime: 10000, // 10 seconds
  },
};

// Export all configurations
export default {
  apiConfig,
  providerApiConfig,
  getProviderConfig,
  apiMiddlewareConfig,
  performanceConfig,
};
