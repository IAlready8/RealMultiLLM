
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations for Vercel deployment
  experimental: {
    // Enable SWC transforms for better performance
    swcPlugins: [],
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  
  // Image optimization with additional remote patterns
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatar.vercel.sh',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },
  
  // Enable compression
  compress: true,
  
  // Reduce runtime overhead
  reactStrictMode: true,
  
  // Optimize for serverless deployment
  output: 'standalone',
  
  // Optimize bundle
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      // Enable additional optimizations in production
      config.optimization.minimize = true;
      config.optimization.usedExports = true;
      config.optimization.providedExports = true;
      config.optimization.sideEffects = false;
      
      // Optimize chunk splitting
      if (!isServer) {
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all',
            },
          },
        };
      }
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
  
  // Additional security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Or 'SAMEORIGIN' if you need same-origin framing
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ];
  },
  
  // Optional: redirects for better UX
  async redirects() {
    return [
      {
        source: '/app',
        destination: '/',
        permanent: true,
      },
      {
        source: '/health',
        destination: '/api/health',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
