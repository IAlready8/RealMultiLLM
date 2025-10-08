# Production Deployment Guide

Complete guide for deploying RealMultiLLM to production with enterprise-grade security and reliability.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Security Configuration](#security-configuration)
5. [Deployment Platforms](#deployment-platforms)
6. [Monitoring & Observability](#monitoring--observability)
7. [Backup & Disaster Recovery](#backup--disaster-recovery)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

- **Database**: PostgreSQL 14+ (recommended: managed service like AWS RDS, Supabase, or Neon)
- **Redis**: Redis 7+ for caching and rate limiting (optional but recommended)
- **Node.js**: v18+ (v20 recommended for production)
- **Domain**: Custom domain with SSL certificate
- **Email**: SMTP service for authentication emails (SendGrid, AWS SES, etc.)

### Required Accounts

- OpenAI API key (optional, for OpenAI provider)
- Anthropic API key (optional, for Claude)
- Google AI API key (optional, for Gemini)
- OAuth providers (Google, GitHub, etc.)

---

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/RealMultiLLM.git
cd RealMultiLLM
npm install
```

### 2. Environment Variables

Create `.env.production` with the following:

```env
# Application
NODE_ENV=production
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Database
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public&sslmode=require

# Redis (optional but recommended)
REDIS_URL=redis://user:password@host:6379

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# OIDC/SSO (optional)
OIDC_PROVIDER=okta # or auth0, azureAd, google-workspace, keycloak
OKTA_DOMAIN=your-org.okta.com
OKTA_CLIENT_ID=your-okta-client-id
OKTA_CLIENT_SECRET=your-okta-client-secret

# LLM Providers (server-side keys for admin)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...

# Email (for password reset, 2FA)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_API_MAX_REQUESTS=30

# Monitoring
PROMETHEUS_ENABLED=true
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info

# Enterprise Features
ENTERPRISE_MODE=true
RBAC_ENABLED=true
AUDIT_LOG_ENABLED=true
DATA_RETENTION_DAYS=90
COST_TRACKING_ENABLED=true

# Security
ENABLE_2FA=true
PASSWORD_MIN_LENGTH=12
SESSION_MAX_AGE=86400 # 24 hours in seconds
CSRF_PROTECTION=true
```

### 3. Generate Secrets

```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate encryption keys for API key storage
openssl rand -hex 32
```

---

## Database Migration

### 1. Setup PostgreSQL

**Option A: Managed Service (Recommended)**

- **Supabase**: Free tier available, excellent for Next.js
  - Create project at https://supabase.com
  - Get connection string from Settings → Database
  - Enable connection pooling for production

- **Neon**: Serverless PostgreSQL with generous free tier
  - Create project at https://neon.tech
  - Copy connection string

- **AWS RDS**: Enterprise-grade, requires AWS account
  - Create PostgreSQL instance
  - Configure security groups
  - Enable automated backups

**Option B: Self-Hosted**

```bash
# Using Docker
docker run -d \
  --name realmultillm-postgres \
  -e POSTGRES_PASSWORD=your-secure-password \
  -e POSTGRES_DB=realmultillm \
  -p 5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### 2. Update Prisma Schema

Ensure `prisma/schema.prisma` uses PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 3. Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed initial data (optional)
npx prisma db seed
```

### 4. Verify Connection

```bash
npx prisma studio
```

---

## Security Configuration

### 1. SSL/TLS Certificate

**Option A: Let's Encrypt (Free)**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Option B: Platform-Managed (Vercel, Netlify)**

SSL is automatic on these platforms.

### 2. Security Headers

Security headers are configured in `middleware.ts`:

- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `Strict-Transport-Security` - Force HTTPS
- `Content-Security-Policy` - Prevent XSS attacks
- `Permissions-Policy` - Restrict browser features

### 3. Rate Limiting

Configured in middleware for:
- **General routes**: 100 requests/minute
- **API routes**: 30 requests/minute

For production, use Redis-backed rate limiting:

```typescript
// lib/redis-rate-limit.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, window);
  }
  return current <= limit;
}
```

### 4. Authentication

**Enable 2FA for Admin Users**

```bash
# API endpoint for 2FA setup
POST /api/auth/2fa/setup

# Verify and enable
POST /api/auth/2fa/verify
```

**Configure OIDC/SSO**

See `lib/auth/oidc-provider.ts` for supported providers:
- Okta
- Auth0
- Azure AD
- Google Workspace
- Keycloak

### 5. API Key Encryption

API keys are encrypted client-side before storage. Ensure environment has:

```env
ENCRYPTION_KEY=<32-byte-hex-key>
```

---

## Deployment Platforms

### Vercel (Recommended)

**Pros**: Zero-config, automatic SSL, edge functions, serverless
**Cons**: PostgreSQL requires external database

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# ... add all required env vars
```

**Configuration** (`vercel.json`):

```json
{
  "buildCommand": "npx prisma generate && next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/admin/retention",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod

# Configure build settings
netlify.toml:
[build]
  command = "npx prisma generate && npm run build"
  publish = ".next"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Docker + AWS ECS/Fargate

**Dockerfile**:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

**Build and Deploy**:

```bash
# Build
docker build -t realmultillm:latest .

# Run locally
docker run -p 3000:3000 --env-file .env.production realmultillm:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag realmultillm:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/realmultillm:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/realmultillm:latest
```

### Self-Hosted (PM2)

```bash
# Build
npm run build

# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "realmultillm" -- start

# Configure auto-restart
pm2 startup
pm2 save
```

---

## Monitoring & Observability

### 1. Prometheus Metrics

Endpoint: `/api/metrics/prometheus`

**Metrics Exposed**:
- `llm_requests_total` - Total LLM requests by provider
- `llm_request_duration_seconds` - Request latency histogram
- `process_cpu_usage` - CPU usage
- `process_memory_usage` - Memory usage

**Prometheus Configuration** (`prometheus.yml`):

```yaml
scrape_configs:
  - job_name: 'realmultillm'
    scrape_interval: 15s
    static_configs:
      - targets: ['yourdomain.com']
    metrics_path: '/api/metrics/prometheus'
```

### 2. Grafana Dashboard

Import dashboard from `docs/grafana-dashboard.json`:

- Request volume by provider
- Latency percentiles (p50, p95, p99)
- Error rates
- Cost tracking
- User activity

### 3. Logging

**Structured Logging** (`lib/logger.ts`):

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

export default logger;
```

**Log Aggregation**:
- CloudWatch Logs (AWS)
- Datadog
- Logtail
- Better Stack

### 4. Error Tracking

**Sentry Integration**:

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### 5. Uptime Monitoring

- **UptimeRobot**: Free, simple HTTP monitoring
- **Pingdom**: Advanced monitoring with alerts
- **Better Uptime**: Status pages + monitoring

---

## Backup & Disaster Recovery

### 1. Database Backups

**Automated Backups** (PostgreSQL):

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/
```

**Retention Policy**:
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months

### 2. Application State

- User data (conversations, personas, goals) stored in PostgreSQL
- API keys encrypted client-side (cannot be recovered server-side)
- Analytics data retained per compliance requirements

### 3. Disaster Recovery Plan

**RTO (Recovery Time Objective)**: 4 hours
**RPO (Recovery Point Objective)**: 24 hours

**Recovery Steps**:

1. Restore database from latest backup
2. Deploy application from version control
3. Configure environment variables
4. Run database migrations
5. Verify functionality
6. Update DNS if needed

---

## Performance Optimization

### 1. Next.js Optimizations

**next.config.mjs**:

```javascript
export default {
  reactStrictMode: true,
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,

  images: {
    domains: ['yourdomain.com'],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    optimizeCss: true,
  },
};
```

### 2. Database Query Optimization

**Indexing Strategy**:

```sql
-- Add indexes for common queries
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_analytics_created ON "Analytics"("createdAt");
CREATE INDEX idx_conversation_user ON "Conversation"("userId", "createdAt");
CREATE INDEX idx_message_conversation ON "Message"("conversationId");
```

**Connection Pooling**:

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 3. Caching Strategy

**Redis Caching**:

```typescript
// lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCached<T>(key: string, fallback: () => Promise<T>, ttl = 3600): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fallback();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

**Cache Keys**:
- `analytics:user:{userId}:7d` - User analytics (1 hour TTL)
- `provider:config:{provider}` - Provider configuration (24 hours TTL)
- `cost:summary:{userId}:{period}` - Cost summaries (1 hour TTL)

### 4. CDN Configuration

**Vercel Edge Network**: Automatic
**CloudFront**:

```json
{
  "Origins": [
    {
      "DomainName": "yourdomain.com",
      "CustomHeaders": {
        "X-Forwarded-Proto": "https"
      }
    }
  ],
  "CacheBehaviors": [
    {
      "PathPattern": "/_next/static/*",
      "Compress": true,
      "ViewerProtocolPolicy": "redirect-to-https",
      "MinTTL": 31536000
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

**1. Database Connection Errors**

```
Error: P1001: Can't reach database server
```

**Solution**:
- Check `DATABASE_URL` format
- Ensure SSL mode: `?sslmode=require`
- Verify firewall rules allow connections
- Test connection: `npx prisma db pull`

**2. NextAuth Session Issues**

```
Error: [next-auth][error][SESSION_ERROR]
```

**Solution**:
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches deployment URL
- Clear cookies and retry

**3. API Rate Limiting**

```
429 Too Many Requests
```

**Solution**:
- Implement exponential backoff
- Use Redis for distributed rate limiting
- Increase limits for trusted IPs

**4. Build Failures**

```
Error: Prisma schema not found
```

**Solution**:
- Add to build command: `npx prisma generate && npm run build`
- Ensure `prisma/schema.prisma` exists
- Check DATABASE_URL is set during build

### Debug Mode

Enable verbose logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

---

## Post-Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] SSL certificate active
- [ ] DNS records updated
- [ ] OAuth providers configured
- [ ] Email service working
- [ ] 2FA tested for admin users
- [ ] Rate limiting verified
- [ ] Monitoring alerts configured
- [ ] Backup system active
- [ ] Performance baseline established
- [ ] Security headers verified
- [ ] API endpoints tested
- [ ] User authentication working
- [ ] Cost tracking enabled

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/RealMultiLLM/issues
- Documentation: https://docs.yourdomain.com
- Email: support@yourdomain.com

---

**Last Updated**: 2025-01-08
**Version**: 1.0.0
