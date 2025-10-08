// Vercel Optimization Configuration
// This file contains optimization settings specifically for Vercel deployment

// Vercel-specific environment detection
export const isVercel = Boolean(process.env.VERCEL);

// Function to get Vercel environment
export function getVercelEnv(): 'development' | 'preview' | 'production' {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

// Vercel-specific configuration options
export const vercelConfig = {
  // Performance optimizations
  performance: {
    // Enable compression
    compression: true,
    
    // Optimize for Vercel's CDN
    cdn: {
      enableImageOptimization: true,
      imageFormat: ['webp', 'avif'] as const,
    },
    
    // Caching configuration
    cache: {
      // Browser cache TTL for static assets (in seconds)
      browserTtl: 31536000, // 1 year for immutable assets
      
      // Edge cache TTL for API responses (in seconds)
      edgeTtl: 3600, // 1 hour for API responses
      
      // Stale-while-revalidate time (in seconds)
      staleWhileRevalidate: 86400, // 24 hours
      
      // Cache strategies
      strategies: {
        static: { browser: 31536000, edge: 31536000 }, // 1 year
        assets: { browser: 31536000, edge: 86400 }, // 1 year browser, 1 day edge
        api: { browser: 0, edge: 3600 }, // No browser cache, 1 hour edge
        short: { browser: 60, edge: 300 }, // 1 min browser, 5 min edge
      },
    },
  },
  
  // Serverless function configuration
  functions: {
    // Maximum execution time (in seconds)
    maxDuration: 60, // Vercel's maximum for hobby accounts
    
    // Memory allocation (in MB)
    memory: 1024, // 1GB
    
    // Runtime settings
    runtime: 'nodejs18.x',
    
    // Temporary disk space (in MB)
    maxFileSize: 50, // 50MB
  },
  
  // Edge runtime configuration (optional)
  edge: {
    // Enable edge runtime for specific routes
    enabled: false,
    
    // Regions for edge deployment
    regions: ['dub1', 'iad1', 'sfo1', 'cdg1', 'ams1', 'hkg1'],
  },
  
  // Security configuration
  security: {
    // HTTPS enforcement
    https: true,
    
    // Security headers
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    },
    
    // CORS configuration
    cors: {
      origin: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) 
        : [process.env.NEXTAUTH_URL || 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    },
  },
  
  // Analytics and monitoring
  analytics: {
    enabled: process.env.ENABLE_ANALYTICS === 'true',
    performanceMonitoring: true,
    errorTracking: true,
  },
  
  // Database optimization for Vercel
  database: {
    // Connection pooling settings
    connectionPool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 60000,
    },
    
    // Query optimization
    queryOptimization: {
      enableCaching: true,
      maxQueryTime: 5000, // 5 seconds
      enablePreparedStatements: true,
    },
  },
  
  // API optimization
  api: {
    // Rate limiting
    rateLimiting: {
      enabled: process.env.RATE_LIMIT_ENABLED === 'true',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute default
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'), // 60 requests per window
    },
    
    // Response optimization
    responseOptimization: {
      compression: true,
      maxSize: 1024 * 1024, // 1MB
      enableStreaming: true,
    },
  },
  
  // Provider-specific optimizations for Vercel
  providers: {
    openai: {
      timeout: 60000, // 60 seconds
      retries: 2,
      maxConcurrent: 5,
    },
    anthropic: {
      timeout: 60000, // 60 seconds
      retries: 2,
      maxConcurrent: 3,
    },
    google: {
      timeout: 45000, // 45 seconds
      retries: 2,
      maxConcurrent: 5,
    },
    openrouter: {
      timeout: 60000, // 60 seconds
      retries: 2,
      maxConcurrent: 10,
    },
  },
};

// Function to apply Vercel-specific optimizations to Next.js config
export function applyVercelOptimizations(nextConfig: any) {
  // Apply performance optimizations
  const optimizedConfig = {
    ...nextConfig,
    
    // Ensure standalone output for Vercel
    output: 'standalone',
    
    // Enable compression
    compress: vercelConfig.performance.compression,
    
    // Image optimization
    images: {
      ...nextConfig.images,
      formats: [...(nextConfig.images?.formats || []), ...vercelConfig.performance.cdn.imageFormat],
      // Add Vercel's default remote patterns
      remotePatterns: [
        ...(nextConfig.images?.remotePatterns || []),
        {
          protocol: 'https',
          hostname: 'cdn.vercel-insights.com',
        },
      ],
    },
    
    // Custom headers for security and performance
    async headers() {
      const headers = nextConfig.headers ? await nextConfig.headers() : [];
      
      // Add security headers
      headers.push({
        source: '/(.*)',
        headers: Object.entries(vercelConfig.security.headers).map(([key, value]) => ({
          key,
          value: String(value),
        })),
      });
      
      // Add performance headers
      headers.push({
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      });
      
      return headers;
    },
    
    // Custom redirects if needed
    async redirects() {
      const redirects = nextConfig.redirects ? await nextConfig.redirects() : [];
      return redirects;
    },
  };
  
  return optimizedConfig;
}

// Function to get the optimal configuration based on environment
export function getOptimalConfig() {
  const env = getVercelEnv();
  
  // Adjust configuration based on environment
  const config = { ...vercelConfig };
  
  if (env === 'development') {
    // More lenient settings for development
    config.functions.maxDuration = 60; // Still use 60s even in dev
    config.performance.cache.strategies.api.edge = 0; // No edge caching in dev
  } else if (env === 'preview') {
    // Balanced settings for preview deployments
    config.performance.cache.strategies.api.edge = 300; // 5 min edge caching
  } else {
    // Optimized settings for production
    config.performance.cache.strategies.api.edge = 3600; // 1 hour edge caching
  }
  
  // Enable analytics only in production by default
  config.analytics.enabled = env === 'production' && process.env.ENABLE_ANALYTICS !== 'false';
  
  return config;
}

// Export the optimal config based on environment
export const optimalVercelConfig = getOptimalConfig();

export default vercelConfig;