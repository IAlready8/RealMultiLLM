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
    // Optimize images for better performance
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },
  experimental: {
    // Optimize for 8GB RAM machines
    optimizeCss: true,
    scrollRestoration: true,
    serverActions: {
      bodySizeLimit: '2mb', // Limit request size for better performance
    },
    // Note: memoryBasedWorkerPoolSize is not available in this Next.js version
    // workerThreads: false, // Enable this in future versions if available
  },
  // Memory and performance optimizations
  webpack: (config, { dev, isServer }) => {
    // Performance optimizations for constrained hardware
    config.optimization = {
      ...config.optimization,
      // Avoid large chunks to reduce memory usage
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        minSize: 20000,
        maxSize: 80000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 200000,
          },
        },
      },
    };

    // Reduce bundle size
    if (!dev && !isServer) {
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Memory optimization - limit parallelism
    if (!dev) {
      config.parallelism = 1;
    }

    return config;
  },
  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Performance settings
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  
  // Development optimizations
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  
  // Output configuration for deployment
  output: 'standalone',
  distDir: '.next',
};

module.exports = nextConfig;
