/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

module.exports = nextConfig;
