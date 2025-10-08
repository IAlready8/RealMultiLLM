# Vercel Deployment Checklist

## Pre-Deployment Requirements

### 1. Environment Variables
- [ ] `ENCRYPTION_MASTER_KEY` - 64-character hex key for API key encryption
- [ ] `NEXTAUTH_SECRET` - 32+ character secret for NextAuth.js
- [ ] `DATABASE_URL` - PostgreSQL connection string for production
- [ ] Provider API keys (optional, can be set via UI):
  - [ ] `OPENAI_API_KEY` - OpenAI API key
  - [ ] `ANTHROPIC_API_KEY` - Anthropic API key
  - [ ] `GOOGLE_AI_API_KEY` - Google AI API key
  - [ ] `OPENROUTER_API_KEY` - OpenRouter API key
  - [ ] `GROK_API_KEY` - Grok API key

### 2. Database Configuration
- [ ] PostgreSQL database provisioned
- [ ] Database connection tested
- [ ] Prisma schema deployed
- [ ] Database migrations run

### 3. Security Configuration
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] API key encryption validated
- [ ] Authentication configured

## Deployment Steps

### 1. Vercel Project Setup
- [ ] Project imported to Vercel
- [ ] Framework preset set to Next.js
- [ ] Build command configured: `npx prisma generate && npx prisma migrate deploy && npm run build`
- [ ] Output directory set to `.next`
- [ ] Environment variables added to Vercel project settings

### 2. Build Process
- [ ] Dependencies installed with `npm ci`
- [ ] Prisma client generated
- [ ] Database migrations deployed
- [ ] Application built successfully
- [ ] Standalone output created

### 3. Environment Variables Setup
Generate required keys:
```bash
# Generate ENCRYPTION_MASTER_KEY (64-character hex)
openssl rand -hex 64

# Generate NEXTAUTH_SECRET (32+ character base64)
openssl rand -base64 32
```

Add to Vercel environment variables:
- `NODE_ENV` = `production`
- `NEXTAUTH_URL` = `https://your-project-name.vercel.app`
- `DATABASE_URL` = `postgresql://username:password@host:5432/database?schema=public`
- `ENCRYPTION_MASTER_KEY` = `[generated 64-character hex key]`
- `NEXTAUTH_SECRET` = `[generated 32+ character base64 key]`

### 4. Provider Configuration
- [ ] OpenAI provider service implemented
- [ ] Anthropic provider service implemented
- [ ] Google AI provider service implemented
- [ ] OpenRouter provider service implemented
- [ ] Grok provider service implemented
- [ ] Provider registry updated with all services
- [ ] API service updated to handle all providers

## Post-Deployment Verification

### 1. Application Health
- [ ] Application loads without errors
- [ ] Authentication works properly
- [ ] Database connections are successful
- [ ] API endpoints return correct responses
- [ ] All LLM providers are accessible

### 2. Security Verification
- [ ] All API keys are properly encrypted
- [ ] Rate limiting functions as expected
- [ ] No security warnings or vulnerabilities
- [ ] Authentication tokens are secure
- [ ] Session management works correctly

### 3. Performance Verification
- [ ] Page load times are acceptable
- [ ] API response times are within expected ranges
- [ ] Serverless functions respond within timeout limits
- [ ] Streaming responses work correctly
- [ ] No performance degradation under load

### 4. Provider Integration Verification
- [ ] OpenAI provider connects and responds
- [ ] Anthropic provider connects and responds
- [ ] Google AI provider connects and responds
- [ ] OpenRouter provider connects and responds
- [ ] Grok provider connects and responds
- [ ] All provider models are accessible
- [ ] Streaming works for all providers

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify `DATABASE_URL` is correctly configured
   - Check that the database allows connections from Vercel
   - Ensure SSL is properly configured for production

2. **API Key Encryption Issues**
   - Verify `ENCRYPTION_MASTER_KEY` is 64 characters and hex format
   - Check that the key is properly set in Vercel environment variables
   - Ensure keys are encrypted before database storage

3. **Authentication Issues**
   - Verify `NEXTAUTH_SECRET` is properly configured
   - Check that `NEXTAUTH_URL` matches your Vercel deployment URL
   - Ensure OAuth providers are properly configured

4. **Provider Integration Issues**
   - Verify provider API keys are correctly formatted
   - Check provider-specific environment variables
   - Test provider connectivity with curl or similar tools

### Debugging Steps

1. **Check Vercel Logs**
   ```bash
   # View deployment logs
   vercel logs your-project-name.vercel.app
   ```

2. **Test Locally with Production Environment**
   ```bash
   # Set production environment variables
   NODE_ENV=production NEXTAUTH_URL=https://your-project-name.vercel.app npm run dev
   ```

3. **Verify Database Connectivity**
   ```bash
   # Test database connection
   npx prisma studio
   ```

4. **Test API Keys**
   ```bash
   # Test provider API keys
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

## Monitoring and Maintenance

### 1. Regular Checks
- [ ] Monitor application logs for errors
- [ ] Check database performance
- [ ] Verify provider API key validity
- [ ] Review security audit logs
- [ ] Check rate limiting effectiveness

### 2. Key Rotation
- [ ] Rotate `ENCRYPTION_MASTER_KEY` annually
- [ ] Rotate `NEXTAUTH_SECRET` annually
- [ ] Rotate provider API keys according to provider guidelines
- [ ] Update Vercel environment variables after rotation

### 3. Updates
- [ ] Regularly update dependencies
- [ ] Monitor for security vulnerabilities
- [ ] Update provider integrations as APIs change
- [ ] Test updates in staging before production

## Rollback Plan

### 1. Identify Issue
- Monitor application metrics and logs
- Identify performance degradation or errors

### 2. Rollback Steps
- Revert to previous deployment in Vercel
- Restore database from backup if needed
- Rotate compromised API keys if necessary

### 3. Post-Rollback
- Investigate root cause of issue
- Fix problem in development environment
- Test fix thoroughly
- Deploy corrected version

## Support Resources

### Documentation
- [API Documentation](./api-documentation.md)
- [Provider Integration Guide](./provider-integration-guide.md)
- [API Key Management](./api-key-management.md)
- [Security Guide](./security-guide.md)

### External Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)

### Contact
- Security issues: security@yourdomain.com
- Support: support@yourdomain.com
- GitHub Issues: https://github.com/yourusername/RealMultiLLM/issues