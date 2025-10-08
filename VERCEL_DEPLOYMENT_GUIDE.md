# Vercel Deployment Guide for RealMultiLLM

## Overview

This guide provides step-by-step instructions for deploying the RealMultiLLM platform to Vercel, including configuration, environment variables, and optimization tips.

## Prerequisites

- A GitHub account with the RealMultiLLM repository
- A Vercel account (free tier available)
- Valid API keys for the LLM providers you want to use
- A database (PostgreSQL recommended for production)

## Deployment Steps

### 1. Fork or Clone the Repository

If you haven't already, fork the repository or create your own copy:

```bash
git clone https://github.com/your-username/RealMultiLLM.git
cd RealMultiLLM
```

### 2. Sign Up for Vercel

- Go to [vercel.com](https://vercel.com) and sign up for an account
- Connect your GitHub account to import projects

### 3. Import Your Project

1. In your Vercel dashboard, click "Add New Project"
2. Select your RealMultiLLM repository from the GitHub integration
3. Click "Import" to bring the project into Vercel

### 4. Configure Project Settings

#### Build Settings
- **FRAMEWORK PRESET**: Next.js (should be detected automatically)
- **ROOT DIRECTORY**: Leave blank (should default to project root)

#### Build Command
```
npx prisma generate && npx prisma migrate deploy && npm run build
```

#### Output Directory
```
.next
```

#### Development Command
```
npm run dev
```

### 5. Set Environment Variables

In your project settings, go to "Environment Variables" and add:

#### Required Variables
```
NODE_ENV = production
NEXTAUTH_URL = https://your-project-name.vercel.app
NEXTAUTH_SECRET = [generate with: openssl rand -base64 32]
ENCRYPTION_MASTER_KEY = [generate with: openssl rand -hex 64]
DATABASE_URL = [your database connection string]
```

#### Optional Provider Keys
- `OPENAI_API_KEY` = your-openai-api-key
- `ANTHROPIC_API_KEY` = your-anthropic-api-key
- `GOOGLE_AI_API_KEY` = your-google-ai-api-key
- `OPENROUTER_API_KEY` = your-openrouter-api-key
- `HUGGING_FACE_API_KEY` = your-huggingface-api-key

### 6. Configure Database

#### For PostgreSQL (Recommended)
1. Set up a PostgreSQL database (Vercel Postgres, Neon, Supabase, etc.)
2. Use the connection string as your `DATABASE_URL`

Example for Neon:
```
postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
```

#### For SQLite (Development Only)
SQLite is not recommended for production deployment due to limitations with Vercel's serverless functions, but you can use it with caution:

```
file:./sqlite.db
```

### 7. Deploy the Project

1. Click "Deploy" in your Vercel dashboard
2. Wait for the build process to complete (this may take a few minutes)
3. Once complete, your app will be available at `https://your-project-name.vercel.app`

## Post-Deployment Configuration

### Configure Custom Domain (Optional)
1. In your Vercel dashboard, go to your project
2. Navigate to "Settings" > "Domains"
3. Add your custom domain and follow DNS configuration instructions

### Set Up Analytics
If using analytics, ensure your analytics service is properly configured to work in the Vercel environment.

## Optimization Tips

### 1. Database Optimization
- Use connection pooling for PostgreSQL
- Set up read replicas for high-traffic applications
- Consider Vercel Postgres for seamless integration

### 2. Caching and Performance
- Use Vercel KV for caching (Redis-like service)
- Configure proper cache headers for static assets
- Implement API response caching where appropriate

### 3. Environment Optimization
- Use Vercel's preview deployments for pull requests
- Set up staging and production environments with different environment variables
- Use `@vercel/edge-config` for runtime configuration

### 4. Monitoring and Logging
- Enable Vercel Analytics for performance monitoring
- Set up error monitoring (e.g., Sentry)
- Configure structured logging for debugging

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues
- Ensure your database allows connections from Vercel's IP ranges
- Use SSL connections for security
- Check that your database plan allows external connections

#### 2. Environment Variables Not Working
- Verify that variables are set in the correct environment (production/preview)
- Ensure sensitive variables are not exposed in client-side code
- Test that variables are properly loaded in server-side code

#### 3. Build Failures
- Check that all dependencies are properly defined in package.json
- Verify that build commands are correctly configured
- Ensure that environment variables are available during the build process

#### 4. API Key Issues
- Test API keys in the development environment first
- Verify that API keys have the necessary permissions
- Check that API key encryption is working properly

### Debugging Steps

1. Check Vercel's deployment logs for detailed error messages
2. Use `NEXT_PUBLIC_` prefix for environment variables that need to be accessible on the client side
3. Test API endpoints directly to isolate issues
4. Verify database connectivity with a simple test endpoint

## Security Best Practices

### 1. API Key Management
- Never hardcode API keys in the source code
- Use Vercel's environment variable system
- Enable API key encryption in the application
- Rotate keys regularly

### 2. Authentication
- Use NextAuth.js with proper configuration
- Set strong session secrets
- Configure proper OAuth redirect URLs
- Implement secure session management

### 3. Rate Limiting
- Implement rate limiting for API endpoints
- Monitor usage patterns
- Set appropriate limits for different user tiers

### 4. Data Encryption
- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Implement proper data validation and sanitization

## Performance Monitoring

### 1. Core Web Vitals
- Monitor loading performance (LCP)
- Track interactivity (FID)
- Measure visual stability (CLS)

### 2. Usage Analytics
- Track user engagement
- Monitor provider usage
- Analyze performance metrics by provider

### 3. Error Tracking
- Set up error monitoring
- Track API failures
- Monitor rate limit issues

## Scaling Considerations

### 1. Serverless Functions
- Optimize function execution time
- Implement proper caching
- Handle cold start scenarios

### 2. Database Scaling
- Use connection pooling
- Implement read replicas
- Consider database sharding for large datasets

### 3. API Rate Limits
- Plan for provider rate limits
- Implement retry mechanisms
- Use multiple API keys if necessary

## Maintenance

### 1. Regular Updates
- Keep dependencies up to date
- Monitor security advisories
- Test new versions in staging first

### 2. Backup Strategy
- Regular database backups
- Export configurations periodically
- Document deployment procedures

## Support

For additional support:
- Check the documentation in the `docs/` directory
- Report issues on GitHub
- Join our community forum

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [RealMultiLLM Documentation](./README.md)