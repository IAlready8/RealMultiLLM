# Deploying Multi-LLM Platform to Vercel

This guide explains how to deploy your enterprise-grade Multi-LLM Platform to Vercel with all features properly configured.

## Prerequisites

- A Vercel account (sign up at [vercel.com](https://vercel.com))
- Vercel CLI installed: `npm install -g vercel`
- Node.js and npm installed on your machine

## Deployment Preparation

### 1. Install Dependencies
```bash
npm install
```

### 2. Prepare Environment Variables
Before deploying, you need to set up the required environment variables. Create a `.env.local` file for local development or configure them through the Vercel dashboard for production.

Required environment variables:
```
# Authentication
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=https://your-app-name.vercel.app
JWT_SECRET=your_jwt_secret_here

# Database
DATABASE_URL=your_database_url_here

# LLM Provider API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_AI_API_KEY=your_google_ai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GROK_API_KEY=your_grok_api_key

# Security
ENCRYPTION_MASTER_KEY=your_64_character_hex_key

# Enterprise Features
ENABLE_ANALYTICS=true
ENABLE_TELEMETRY=true
ENABLE_AUDIT_LOGGING=true
CACHE_ENABLED=true
COMPRESSION_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
BLOCK_SUSPICIOUS_IPS=true
TELEMETRY_SAMPLE_RATE=0.1
LOG_LEVEL=info
LOG_FORMAT=json
```

## Deployment Steps

### Option 1: Deploy via CLI (Recommended)

1. **Build and deploy the application:**
```bash
vercel --prod
```

2. **Add environment variables during the deployment process:**
   - When prompted, add all the required environment variables
   - Select your project's team and name
   - Confirm the deployment

### Option 2: Deploy via Git Integration

1. **Push your code to a Git repository (GitHub, GitLab, or Bitbucket)**

2. **Import your project to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your Git repository
   - Configure the project settings:
     - Framework: Next.js
     - Build Command: `npm run build:vercel` (or just `npm run build`)
     - Install Command: `npm install`
     - Output Directory: Leave empty (Next.js handles this automatically)

3. **Add environment variables in the Vercel dashboard:**
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add all the required environment variables listed above

## Enterprise Features Configuration

### 1. Configuration Management
- The application uses the enterprise config module (`lib/config/index.ts`) with Zod validation
- All configuration is validated at startup
- Sensitive values are properly masked

### 2. Telemetry & Observability
- Telemetry is configured via `lib/observability/telemetry.ts`
- Metrics are collected and can be sent to external services
- Logging is configured with structured JSON format

### 3. Security Hardening
- Rate limiting and slow-down mechanisms are configured
- Input validation and sanitization are active
- Security headers are automatically applied
- IP blocking capabilities are available

### 4. Performance Optimization
- Caching is configured with TTL and size limits
- Compression is enabled for responses
- Performance profiling tools are available

## Post-Deployment Verification

After deployment, verify that:

1. **The application loads correctly** at your Vercel URL
2. **All LLM providers are working** by testing chat functionality 
3. **Authentication works** with your configured providers
4. **Analytics and telemetry** are collecting data (if enabled)
5. **Security features** are active (check security headers in browser dev tools)

## Troubleshooting

### UI Not Displaying Correctly
- Ensure Tailwind CSS is properly built by checking the `globals.css` file
- Verify that the `tailwind.config.ts` is correctly configured
- Check browser console for CSS-related errors
- Verify that all CSS classes used in components exist in Tailwind config

### Environment Variables Not Working
- Double-check that all required environment variables are set in the Vercel dashboard
- Note that variables set locally in `.env.local` are not automatically deployed
- For production, always configure environment variables through the Vercel dashboard

### Database Connection Issues
- Ensure your database URL is properly formatted
- For production databases, ensure the database allows connections from Vercel's IP ranges
- Make sure Prisma schema is properly configured

### Build Failures
- The application uses the build script at `scripts/build-vercel.sh`
- Check the build logs in the Vercel dashboard for specific errors
- Ensure all dependencies are properly listed in `package.json`

## Scaling Recommendations

For enterprise deployments, consider:

1. **Database Scaling**: Use a production-grade database service with proper backup and scaling
2. **CDN Configuration**: Configure image optimization and asset caching
3. **Monitoring**: Set up alerts for critical metrics and errors
4. **Security**: Regularly update dependencies and review access logs
5. **Caching**: Consider using Redis for advanced caching strategies

## Support

If you encounter issues during deployment:

1. Check the Vercel deployment logs in the dashboard
2. Verify all environment variables are correctly set
3. Ensure all enterprise modules are properly integrated
4. Review the build logs for specific error messages
5. Consult the Vercel documentation for platform-specific issues

Your enterprise-grade Multi-LLM Platform is now ready for production deployment on Vercel with full security, performance, and observability features enabled!