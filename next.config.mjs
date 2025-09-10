
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations (conservative)
  experimental: {
    turbo: {
      rules: {
        '*.svg': ['@svgr/webpack'],
      },
    },
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  
  // Enable swcMinify for better performance
  swcMinify: true,
  
  // Reduce runtime overhead
  reactStrictMode: true,
  
  // Optimize bundle
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      // Tree shake unused code more aggressively
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }
    
    // Handle Node.js modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "fs": false,
        "net": false,
        "tls": false,
        "crypto": false,
        "events": false,
        "timers/promises": false
      };
    }
    
    return config;
  },
};

export default nextConfig;
