# Performance Optimization Configuration
# These settings are specifically configured for optimal performance on Vercel

# Next.js Runtime Configuration
export const nextRuntimeConfig = {
  // Compression settings for optimized delivery
  compress: true,
  
  // Image optimization settings
  images: {
    // Enable WebP and AVIF formats for better compression
    formats: ['image/webp', 'image/avif'],
    
    // Remote patterns for image optimization
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  
  // Webpack optimization for production
  webpack: (config, { dev, isServer }) => {
    // Optimize for production builds
    if (!dev) {
      // Enable compression for serverless functions
      config.optimization.minimize = true;
      
      // Tree-shaking optimizations
      config.optimization.usedExports = true;
      config.optimization.providedExports = true;
      
      // Optimize split chunks
      if (!isServer) {
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              enforce: true,
            },
          },
        };
      }
    }
    
    return config;
  },
  
  // Serverless function configuration
  experimental: {
    // Standalone build for optimal Vercel deployment
    outputStandalone: true,
    
    // Optimize serverless function size
    serverComponentsExternalPackages: [
      // Add any packages that should be externalized
    ],
  },
};

# Additional optimization settings for Vercel
export const vercelOptimizationConfig = {
  // Caching headers for static assets
  headers: [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    },
  ],
  
  // Redirects for SEO and UX
  redirects: async () => {
    return [
      {
        source: '/app',
        destination: '/',
        permanent: true,
      },
    ];
  },
  
  // Rewrites for clean URLs
  rewrites: async () => {
    return [
      {
        source: '/health',
        destination: '/api/health',
      },
    ];
  },
  
  // Optimization for API routes
  api: {
    // Enable bodyParser for API routes
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};