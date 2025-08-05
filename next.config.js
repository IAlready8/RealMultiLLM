/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimized Next.js configuration for constrained hardware
  // Target: 8GB RAM MacBook Air M2 + 16GB MacBook Pro 2013
  
  reactStrictMode: true,
  swcMinify: true,
  
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
    // Optimize image loading
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  experimental: {
    // Memory optimizations for 8GB RAM
    optimizeCss: true,
    scrollRestoration: true,
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Memory-efficient chunk splitting
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 70000,
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      },
    };

    // Disable source maps in production for memory efficiency
    if (!dev) {
      config.devtool = false;
    }

    return config;
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Performance optimizations
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  
  // Development optimizations
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  
  // Output configuration for static deployment
  output: 'standalone',
  
  // Environment variables
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
};

module.exports = nextConfig;
