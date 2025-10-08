# Vercel Deployment Documentation

## Overview

This document provides detailed instructions for deploying the RealMultiLLM platform to Vercel. The platform is optimized for Vercel deployment with minimal configuration required.

## Prerequisites

1. **Vercel Account**: Free or paid account at [vercel.com](https://vercel.com)
2. **GitHub Account**: Repository access for deployment
3. **Node.js 18+**: Runtime environment
4. **Git**: Version control system
5. **API Keys**: LLM provider API keys (optional, can be set via UI)

## Deployment Methods

### 1. One-Click Deploy (Recommended)
Use the Vercel deployment button for quick setup:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/RealMultiLLM&env=ENCRYPTION_MASTER_KEY,NEXTAUTH_SECRET,DATABASE_URL&envDescription=Required%20environment%20variables%20for%20RealMultiLLM&envLink=README.md)

### 2. Manual Deployment
For advanced configuration and customization:

```bash
# Clone repository
git clone https://github.com/yourusername/RealMultiLLM.git
cd RealMultiLLM

# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to Vercel
vercel
```

## Environment Variables

### Required Variables
These variables must be set in your Vercel project settings:

```env
# Core application variables
NODE_ENV=production
NEXTAUTH_URL=https://your-project-name.vercel.app
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
ENCRYPTION_MASTER_KEY=generate-with-openssl-rand-hex-64
DATABASE_URL=postgresql://username:password@host:5432/database?schema=public
```

### Optional Provider Variables
These can be set via the UI or as environment variables:

```env
# LLM Provider API Keys (optional)
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key
OPENROUTER_API_KEY=sk-or-your-openrouter-api-key
GROK_API_KEY=your-grok-api-key
```

### Generate Security Keys
```bash
# Generate NEXTAUTH_SECRET (32+ character base64)
openssl rand -base64 32

# Generate ENCRYPTION_MASTER_KEY (64-character hex)
openssl rand -hex 64

# Generate session secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Vercel Project Configuration

### 1. Import Project
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your RealMultiLLM repository

### 2. Configure Build Settings
- **Build Command**: `npx prisma generate && npx prisma migrate deploy && npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`
- **Development Command**: `npm run dev`

### 3. Add Environment Variables
In your project settings, navigate to "Environment Variables" and add:

1. `NODE_ENV` = `production`
2. `NEXTAUTH_URL` = `https://your-project-name.vercel.app`
3. `NEXTAUTH_SECRET` = `[generated 32+ character base64 key]`
4. `ENCRYPTION_MASTER_KEY` = `[generated 64-character hex key]`
5. `DATABASE_URL` = `[your PostgreSQL connection string]`

### 4. Configure Domains (Optional)
- Add custom domain in "Settings" > "Domains"
- Configure DNS records as instructed
- Enable SSL certificate auto-renewal

## Database Configuration

### Vercel Postgres (Recommended)
Vercel offers integrated PostgreSQL databases:

1. In your Vercel dashboard, go to "Storage" > "Create Database"
2. Select "Postgres"
3. Choose your plan (Hobby for development, Pro for production)
4. Add the connection string to your environment variables

### External PostgreSQL
For external databases:

1. Provision a PostgreSQL database (AWS RDS, DigitalOcean, etc.)
2. Configure network access for Vercel IPs
3. Add the connection string to `DATABASE_URL`

### Connection String Examples
```env
# Vercel Postgres
DATABASE_URL=postgresql://default:password@ep-xxx.us-east-1.postgres.vercel-storage.com:5432/verceldb?sslmode=require

# AWS RDS
DATABASE_URL=postgresql://username:password@your-db-cluster.cluster-xxx.us-east-1.rds.amazonaws.com:5432/dbname?sslmode=require

# DigitalOcean
DATABASE_URL=postgresql://username:password@db-postgresql-nyc1-xxxxx-do-user-xxxxx-0.b.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

## Provider Integration

### Setting API Keys
API keys can be set in two ways:

1. **Via Environment Variables** (during deployment):
   ```bash
   vercel env add OPENAI_API_KEY production
   vercel env add ANTHROPIC_API_KEY production
   vercel env add GOOGLE_AI_API_KEY production
   ```

2. **Via UI** (after deployment):
   - Navigate to Settings > API Keys
   - Add keys for each provider
   - Keys are encrypted before storage

### Provider Configuration
All providers are pre-configured with sensible defaults:

1. **OpenAI**: Uses `gpt-4o` as default model
2. **Anthropic**: Uses `claude-3-5-sonnet-20241022` as default model
3. **Google AI**: Uses `gemini-1.5-pro` as default model
4. **OpenRouter**: Uses `openrouter/auto` for automatic model routing
5. **Grok**: Uses `grok-beta` as default model

### Testing Provider Connectivity
After deployment, test provider connectivity:

1. Navigate to Settings > API Keys
2. Use the "Test" button for each provider
3. Verify successful connection
4. Check error messages if connection fails

## Security Configuration

### HTTPS Enforcement
Vercel automatically enforces HTTPS for all deployments.

### CORS Configuration
CORS is automatically configured for your deployment domain.

### Rate Limiting
Built-in rate limiting protects against abuse:

- **Per-User**: 60 requests per minute
- **Global**: 600 requests per minute
- **Adjustable**: Modify via environment variables

### API Key Encryption
All API keys are encrypted using AES-256:

1. Master key stored in `ENCRYPTION_MASTER_KEY`
2. Keys encrypted before database storage
3. Keys decrypted only when needed for API calls
4. Never stored in plaintext

## Performance Optimization

### Vercel Edge Network
The application leverages Vercel's global edge network:

1. **Static Assets**: Automatically served from CDN
2. **Serverless Functions**: Deployed to nearest regions
3. **Image Optimization**: Automatic image optimization

### Caching Strategies
Implemented caching strategies:

1. **Browser Caching**: Static assets cached for 1 year
2. **Edge Caching**: API responses cached for 1 hour
3. **Database Caching**: Query results cached appropriately

### Serverless Function Configuration
Optimized for Vercel's serverless environment:

1. **Execution Time**: Functions optimized to complete within limits
2. **Memory Usage**: Efficient memory utilization
3. **Cold Starts**: Minimized through proper initialization

## Monitoring and Analytics

### Vercel Analytics
Built-in analytics through Vercel:

1. **Performance Metrics**: Response times, throughput
2. **Error Tracking**: Application errors and exceptions
3. **Geographic Distribution**: User locations and latency

### Custom Analytics
RealMultiLLM includes built-in analytics:

1. **Usage Tracking**: Provider usage statistics
2. **Performance Metrics**: Response times, token counts
3. **Error Monitoring**: API errors and failures

### Log Monitoring
Structured logging for debugging:

1. **Application Logs**: Structured JSON logs
2. **Error Reports**: Detailed error information
3. **Performance Logs**: Timing and resource usage

## CI/CD Integration

### GitHub Actions
Pre-configured GitHub Actions workflow:

1. **Linting**: Code quality checks
2. **Type Checking**: TypeScript validation
3. **Testing**: Unit and integration tests
4. **Security**: Dependency vulnerability scanning

### Vercel Git Integration
Automatic deployments on Git pushes:

1. **Preview Deployments**: For pull requests
2. **Production Deployments**: For main branch
3. **Rollback**: Easy rollback to previous deployments

### Environment Branching
Different environments for different branches:

1. **Main**: Production deployment
2. **Develop**: Staging deployment
3. **Feature**: Preview deployments

## Troubleshooting

### Common Issues

1. **Database Connection**
   - Verify `DATABASE_URL` is correctly formatted
   - Ensure database allows connections from Vercel
   - Check SSL configuration

2. **Authentication Errors**
   - Verify `NEXTAUTH_SECRET` is set correctly
   - Check that `NEXTAUTH_URL` matches deployment URL
   - Ensure OAuth providers are configured properly

3. **API Key Issues**
   - Verify provider API keys are valid
   - Check key format and permissions
   - Test keys with provider's API directly

4. **Build Failures**
   - Check build logs in Vercel dashboard
   - Verify Node.js version compatibility
   - Ensure all dependencies are properly installed

### Debugging Commands

```bash
# View deployment logs
vercel logs your-project-name.vercel.app

# Redeploy with latest changes
vercel --prod

# Check environment variables
vercel env pull

# Run local development with production env
NODE_ENV=production npm run dev
```

## Advanced Configuration

### Custom Domains
Configure custom domains:

1. Add domain in Vercel dashboard
2. Configure DNS records as instructed
3. Wait for SSL certificate provisioning
4. Verify domain configuration

### Environment Variables Management
Manage environment variables via CLI:

```bash
# Add environment variable
vercel env add VARIABLE_NAME production

# Pull environment variables
vercel env pull

# List environment variables
vercel env ls

# Remove environment variable
vercel env rm VARIABLE_NAME production
```

### Scaling Considerations
For high-traffic applications:

1. **Database**: Upgrade to Pro PostgreSQL plan
2. **Functions**: Monitor execution times and optimize
3. **Caching**: Implement Redis caching for frequent queries
4. **CDN**: Leverage Vercel's global CDN

## Maintenance

### Regular Updates
Keep your deployment updated:

1. **Dependencies**: Regularly update npm packages
2. **Security**: Monitor for vulnerabilities
3. **Performance**: Profile and optimize regularly

### Key Rotation
Rotate keys regularly for security:

1. **NEXTAUTH_SECRET**: Rotate annually
2. **ENCRYPTION_MASTER_KEY**: Rotate annually
3. **Provider Keys**: Rotate according to provider schedule
4. **Database Password**: Rotate quarterly

### Backup Strategy
Implement backup strategies:

1. **Database**: Regular database backups
2. **Environment**: Export environment variables
3. **Code**: Maintain Git repository backups
4. **Analytics**: Export analytics data regularly

## Support Resources

### Documentation
- [API Documentation](./api-documentation.md)
- [Provider Integration Guide](./provider-integration-guide.md)
- [API Key Management](./api-key-management.md)
- [Security Guide](./security-guide.md)
- [Performance Optimization](./performance-optimization.md)

### External Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)

### Community Support
- GitHub Issues: [RealMultiLLM Issues](https://github.com/yourusername/RealMultiLLM/issues)
- Discord: [Vercel Community](https://discord.gg/vercel)
- Stack Overflow: Tag questions with `realmultillm`

## Best Practices

### Security Best Practices
1. Never commit API keys to version control
2. Use environment variables for secrets
3. Rotate keys regularly
4. Monitor for suspicious activity
5. Implement proper authentication
6. Use HTTPS for all communications

### Performance Best Practices
1. Optimize database queries
2. Implement proper caching
3. Minimize bundle sizes
4. Use streaming for long responses
5. Monitor function execution times
6. Profile regularly for bottlenecks

### Deployment Best Practices
1. Use preview deployments for testing
2. Implement gradual rollouts
3. Monitor deployments closely
4. Have rollback plans ready
5. Test in staging before production
6. Document deployment procedures

### Monitoring Best Practices
1. Set up alerts for critical metrics
2. Monitor error rates and response times
3. Track API key usage and costs
4. Log security-relevant events
5. Implement audit trails
6. Review logs regularly

## Compliance

### GDPR Compliance
The platform implements GDPR compliance measures:

1. **Data Minimization**: Only collect necessary data
2. **Encryption**: Encrypt sensitive data at rest
3. **Right to Erasure**: Implement data deletion
4. **Privacy by Design**: Build privacy into the architecture

### SOC 2 Compliance
SOC 2 compliance is maintained through:

1. **Security Policies**: Documented security policies
2. **Access Controls**: Strong access controls
3. **Monitoring**: Continuous monitoring
4. **Incident Response**: Incident response procedures

## Further Reading

- [Deployment Checklist](./deployment-checklist.md)
- [API Documentation](./api-documentation.md)
- [Provider Integration Guide](./provider-integration-guide.md)
- [Security Guide](./security-guide.md)
- [Performance Optimization](./performance-optimization.md)