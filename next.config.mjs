
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
  webpack: (config, { dev }) => {
    if (!dev) {
      // Tree shake unused code more aggressively
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }
    return config;
  },
};

export default nextConfig;
