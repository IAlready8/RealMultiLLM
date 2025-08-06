/** @type {import('next').NextConfig} */
const nextConfig = {
  // 3-STEP PLAN:
  // 1. Optimize for constrained hardware (8GB RAM)
  // 2. Enable proper testing support
  // 3. Configure for both development and production
  
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
  experimental: {
    // Optimize for 8GB RAM machines
    optimizeCss: true,
    scrollRestoration: true,
    serverActions: {
      bodySizeLimit: '2mb', // Limit request size for better performance
    },
    // Reduce memory usage during development
    esmExternals: 'loose',
  },
  
  // Memory and performance optimizations
  webpack: (config, { dev, isServer }) => {
    // Performance optimizations for memory-constrained environments
    config.optimization = {
      ...config.optimization,
      // Reduce bundle size and memory usage
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        minSize: 20000,
        maxSize: 80000,
        cacheGroups: {
          // Separate vendor chunks for better caching
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
        },
      },
    };

    // Reduce memory usage in development
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.next'],
      };
    }

    return config;
  },
  
  // Build-time optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Improve production performance
  productionBrowserSourceMaps: false,
  
  // Enable easier debugging in development while being stricter in production
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  
  // Output configuration
  output: 'standalone',
  
  // Environment variables validation
  env: {
    // Add runtime environment variable validation
    NODE_ENV: process.env.NODE_ENV,
  },
};

module.exports = nextConfig;
