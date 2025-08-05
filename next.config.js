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
  },
  // Add analyzer in development mode only
  webpack: (config, { dev, isServer }) => {
    // Performance optimizations
    config.optimization = {
      ...config.optimization,
      // Avoid large chunks
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        minSize: 20000,
        maxSize: 80000,
      },
    };

    return config;
  },
  // Optional: Enable strict mode in development only
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Improve production performance
  productionBrowserSourceMaps: false,
  // Enable easier debugging in development
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
};

module.exports = nextConfig;
