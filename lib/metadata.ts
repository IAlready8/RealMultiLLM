import type { Metadata } from 'next';

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  openGraph?: {
    title?: string;
    description?: string;
    images?: string[];
  };
}

const defaultMetadata = {
  siteName: 'RealMultiLLM',
  siteUrl: process.env.NEXTAUTH_URL || 'https://realmultillm.com',
  description: 'Professional multi-LLM platform for chat, analytics, personas, and AI workflow automation.',
  keywords: [
    'LLM',
    'AI',
    'Chat',
    'OpenAI',
    'Claude',
    'Gemini',
    'Multi-LLM',
    'AI Platform',
    'GPT',
    'Artificial Intelligence',
  ],
};

export function generateMetadata({
  title,
  description,
  keywords = [],
  openGraph,
}: PageMetadata): Metadata {
  const fullTitle = `${title} | ${defaultMetadata.siteName}`;
  const allKeywords = [...defaultMetadata.keywords, ...keywords];

  return {
    title: fullTitle,
    description: description,
    keywords: allKeywords.join(', '),
    authors: [{ name: 'RealMultiLLM Team' }],
    creator: 'RealMultiLLM',
    publisher: 'RealMultiLLM',
    applicationName: defaultMetadata.siteName,
    
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: defaultMetadata.siteUrl,
      siteName: defaultMetadata.siteName,
      title: openGraph?.title || fullTitle,
      description: openGraph?.description || description,
      images: openGraph?.images || [],
    },
    
    twitter: {
      card: 'summary_large_image',
      title: openGraph?.title || fullTitle,
      description: openGraph?.description || description,
      images: openGraph?.images || [],
    },
    
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    
    viewport: {
      width: 'device-width',
      initialScale: 1,
      maximumScale: 5,
    },
    
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
  };
}

// Pre-configured metadata for common pages
export const pageMetadata = {
  home: generateMetadata({
    title: 'Home',
    description: 'Professional multi-LLM platform with chat, analytics, personas, pipelines, and more.',
  }),
  
  chat: generateMetadata({
    title: 'Multi-Chat',
    description: 'Chat with multiple AI models simultaneously. Compare responses and capabilities in real-time.',
    keywords: ['AI Chat', 'Multi-LLM Chat', 'GPT Chat', 'Claude Chat'],
  }),
  
  personas: generateMetadata({
    title: 'AI Personas',
    description: 'Create and manage custom AI personas with specialized system prompts and behaviors.',
    keywords: ['AI Personas', 'Custom AI', 'System Prompts', 'AI Behavior'],
  }),
  
  goals: generateMetadata({
    title: 'Goal Hub',
    description: 'Track and manage your goals with AI assistance. Set objectives and monitor progress.',
    keywords: ['Goal Tracking', 'AI Goals', 'Task Management', 'Productivity'],
  }),
  
  pipeline: generateMetadata({
    title: 'AI Pipeline',
    description: 'Create multi-step AI workflows by chaining LLM calls together in sequence.',
    keywords: ['AI Pipeline', 'Workflow Automation', 'LLM Chain', 'AI Automation'],
  }),
  
  analytics: generateMetadata({
    title: 'Analytics',
    description: 'Comprehensive usage analytics and insights for your LLM interactions.',
    keywords: ['LLM Analytics', 'Usage Statistics', 'AI Metrics', 'Performance Tracking'],
  }),
  
  comparison: generateMetadata({
    title: 'Model Comparison',
    description: 'Compare multiple AI models side-by-side to find the best for your needs.',
    keywords: ['Model Comparison', 'AI Comparison', 'LLM Benchmark', 'AI Models'],
  }),
  
  settings: generateMetadata({
    title: 'Settings',
    description: 'Configure your API keys, preferences, and application settings.',
    keywords: ['Settings', 'Configuration', 'API Keys', 'Preferences'],
  }),
  
  observability: generateMetadata({
    title: 'Observability',
    description: 'Monitor system health, performance metrics, and application logs.',
    keywords: ['Observability', 'Monitoring', 'Metrics', 'System Health'],
  }),
};

// Breadcrumb schema for SEO
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${defaultMetadata.siteUrl}${item.url}`,
    })),
  };
}

// Organization schema for SEO
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: defaultMetadata.siteName,
  url: defaultMetadata.siteUrl,
  logo: `${defaultMetadata.siteUrl}/logo.png`,
  description: defaultMetadata.description,
  sameAs: [
    // Add social media links here
  ],
};

// WebApplication schema for SEO
export const webApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: defaultMetadata.siteName,
  url: defaultMetadata.siteUrl,
  description: defaultMetadata.description,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};
