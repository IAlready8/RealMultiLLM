# 🚀 Vercel Deployment Guide for RealMultiLLM

This guide provides comprehensive step-by-step instructions for deploying RealMultiLLM to Vercel with a production database (Supabase or Neon).

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Deploy](#quick-deploy)
- [Manual Deployment](#manual-deployment)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

Before deploying, ensure you have:

1. **GitHub Account** - Repository must be on GitHub
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
3. **Database Account** - Either [Supabase](https://supabase.com) or [Neon](https://neon.tech)
4. **API Keys** - At least one LLM provider API key (OpenAI, Anthropic, or Google AI)

## ⚡ Quick Deploy

### Option 1: Deploy Button (Recommended for First-Time Users)

1. Click the "Deploy to Vercel" button:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIAlready8%2FRealMultiLLM)

2. Follow the Vercel deployment wizard
3. Configure environment variables (see [Environment Variables](#environment-variables))
4. Wait for the build to complete
5. Configure your database (see [Database Setup](#database-setup))

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to your project
cd RealMultiLLM

# Deploy to Vercel
vercel

# Follow the CLI prompts
# For first deployment, select "Link to existing project? No"
# Choose your scope and project name
```

## 📝 Manual Deployment

### Step 1: Connect Repository to Vercel

1. **Log in to Vercel Dashboard**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New" → "Project"

2. **Import Git Repository**
   - Select your RealMultiLLM repository from GitHub
   - Click "Import"

3. **Configure Project Settings**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build` (or leave default)
   - Output Directory: `.next` (default for Next.js)
   - Install Command: `npm install` (or leave default)

### Step 2: Set Up Database

Choose one of the following database providers:

#### Option A: Supabase (Recommended)

See [DATABASE_SETUP.md](./DATABASE_SETUP.md#supabase-setup) for detailed instructions.

**Quick Setup:**

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings → Database
3. Copy the "Connection string" (URI format)
4. Note: Use the connection pooler URL for production (port 6543)

```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
```

#### Option B: Neon (Alternative)

See [DATABASE_SETUP.md](./DATABASE_SETUP.md#neon-setup) for detailed instructions.

**Quick Setup:**

1. Create a new project at [neon.tech](https://neon.tech)
2. Create a new database
3. Copy the connection string from the dashboard
4. Note: Neon provides connection pooling by default

```
postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
```

### Step 3: Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add all required variables (see [Environment Variables](#environment-variables))
3. Make sure to set variables for **Production**, **Preview**, and **Development** as needed

### Step 4: Deploy Database Schema

After setting up your database, deploy the Prisma schema:

```bash
# Set your DATABASE_URL locally for this operation
export DATABASE_URL="your-production-database-url"

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Or use migrations for production
npx prisma migrate deploy
```

### Step 5: Deploy Application

1. **Trigger Deployment**
   - Push to your main branch, or
   - Click "Deploy" in Vercel dashboard

2. **Monitor Build**
   - Watch the build logs in Vercel dashboard
   - Build typically takes 2-5 minutes

3. **Verify Deployment**
   - Visit your deployed URL
   - Test authentication and basic features

## 🔐 Environment Variables

### Required Variables

Add these environment variables in Vercel Dashboard → Settings → Environment Variables:

#### Core Application

```bash
# Next.js and NextAuth Configuration
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Database
DATABASE_URL=your-postgresql-connection-string

# Security - Master Encryption Key for API Keys
ENCRYPTION_MASTER_KEY=generate-with-openssl-rand-hex-64
```

#### LLM Provider API Keys (At least one required)

```bash
# OpenAI (GPT models)
OPENAI_API_KEY=sk-proj-your-openai-api-key

# Anthropic (Claude models)
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-api-key

# Google AI (Gemini models)
GOOGLE_AI_API_KEY=your-google-ai-api-key

# OpenRouter (Multiple models)
OPENROUTER_API_KEY=sk-or-your-openrouter-api-key
```

### Optional Variables

#### OAuth Providers

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
```

#### Security & Features

```bash
# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Session Configuration
SESSION_MAX_AGE=7200

# Demo Mode (MUST be false in production)
ALLOW_DEMO_MODE=false

# Analytics & Monitoring
ENABLE_ANALYTICS=true
ENABLE_TELEMETRY=true

# Logging
LOG_LEVEL=info
```

### Generating Secure Keys

Use these commands to generate secure keys:

```bash
# Generate NEXTAUTH_SECRET (32+ characters)
openssl rand -base64 32

# Generate ENCRYPTION_MASTER_KEY (64 characters hex)
openssl rand -hex 64

# Alternative using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Setting Environment Variables in Vercel

**Via Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Click "Add New"
3. Enter Key and Value
4. Select environments (Production, Preview, Development)
5. Click "Save"

**Via Vercel CLI:**
```bash
# Add a variable
vercel env add NEXTAUTH_SECRET production

# List all variables
vercel env ls

# Pull environment variables to local
vercel env pull .env.local
```

## 🔧 Post-Deployment

### 1. Initialize Database

After first deployment:

```bash
# Connect to your database and run migrations
npx prisma migrate deploy

# Or push schema directly (for development)
npx prisma db push

# Verify database tables
npx prisma studio
```

### 2. Create Demo Account (Optional)

For testing purposes, you can create a demo account:

```bash
# Use Prisma Studio to create a user manually, or
# Use the credentials provider with the demo account

# Demo credentials (as configured in lib/auth.ts):
# Email: demo@example.com
# Password: DemoPassword123!@#
# Note: Only works if ALLOW_DEMO_MODE=true (development only)
```

### 3. Configure OAuth Providers (Optional)

If using Google or GitHub OAuth:

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-app.vercel.app/api/auth/callback/google`

**GitHub OAuth:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set callback URL: `https://your-app.vercel.app/api/auth/callback/github`

### 4. Test Deployment

Verify the following:

- ✅ Home page loads correctly
- ✅ Authentication works (sign in/sign out)
- ✅ Database connections are successful
- ✅ LLM API calls work (test chat functionality)
- ✅ Settings page displays configured providers
- ✅ All routes are accessible

### 5. Set Up Custom Domain (Optional)

1. Go to your project → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Update `NEXTAUTH_URL` to use custom domain

## 🐛 Troubleshooting

### Build Failures

**Issue:** Build fails with "Module not found" errors
```bash
# Solution: Clear Vercel build cache
# Go to Vercel Dashboard → Settings → General → Clear Build Cache
```

**Issue:** Prisma client generation fails
```bash
# Solution: Ensure prisma generate runs in prebuild
# Check package.json has: "prebuild": "prisma generate"
```

### Database Connection Issues

**Issue:** "Can't reach database server"
```bash
# Solution: Check DATABASE_URL format
# Ensure connection pooling is enabled (use port 6543 for Supabase)
# Verify database is not paused (Supabase) or in maintenance
```

**Issue:** SSL/TLS connection errors
```bash
# Solution: Add SSL parameters to connection string
# For Supabase: ?pgbouncer=true&connection_limit=1
# For Neon: ?sslmode=require
```

### Authentication Problems

**Issue:** NextAuth "Configuration error"
```bash
# Solution: Verify all required env vars are set:
# - NEXTAUTH_URL (must match your deployment URL exactly)
# - NEXTAUTH_SECRET (must be 32+ characters)
# - DATABASE_URL (must be valid PostgreSQL connection)
```

**Issue:** OAuth provider errors
```bash
# Solution: Check OAuth redirect URIs match your deployment URL
# Google: https://your-app.vercel.app/api/auth/callback/google
# GitHub: https://your-app.vercel.app/api/auth/callback/github
```

### Runtime Errors

**Issue:** 500 Internal Server Error
```bash
# Solution: Check Vercel function logs
# Dashboard → Deployments → [Your deployment] → Functions
# Look for error details in logs
```

**Issue:** API routes timeout
```bash
# Solution: Vercel Serverless Functions have 10s timeout (Hobby plan)
# Optimize long-running operations
# Consider upgrading to Pro plan for 60s timeout
```

### Performance Issues

**Issue:** Slow database queries
```bash
# Solution: Enable connection pooling
# Use Supabase connection pooler (port 6543)
# Or add Neon connection pooling
# Ensure proper indexes on Prisma schema
```

**Issue:** Cold starts
```bash
# Solution: Vercel Pro plan reduces cold starts
# Use database connection pooling
# Keep functions warm with health checks
```

## 📊 Monitoring & Maintenance

### View Logs

```bash
# View real-time logs via CLI
vercel logs

# View specific deployment logs
vercel logs [deployment-url]

# Follow logs in real-time
vercel logs --follow
```

### Analytics

- Access analytics in Vercel Dashboard → Analytics
- Monitor page views, performance, and errors
- Set up alerts for critical issues

### Database Maintenance

**Supabase:**
- Monitor database usage in Supabase Dashboard
- Set up database backups (automatic on paid plans)
- Review slow queries in SQL Editor

**Neon:**
- Monitor compute and storage usage
- Configure branch protection
- Set up point-in-time recovery

## 🔒 Security Best Practices

1. **Never commit secrets** - Use environment variables only
2. **Rotate keys regularly** - Especially API keys and database credentials
3. **Use HTTPS only** - Enforce secure connections
4. **Enable rate limiting** - Protect against abuse
5. **Monitor logs** - Watch for suspicious activity
6. **Keep dependencies updated** - Run `npm audit` regularly
7. **Use strong passwords** - For database and admin accounts
8. **Enable 2FA** - On Vercel, GitHub, and database provider accounts

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Supabase Documentation](https://supabase.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)

## 📞 Need Help?

- Check [GitHub Issues](https://github.com/IAlready8/RealMultiLLM/issues)
- Review [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- See [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- Read [AUTH_SETUP.md](./AUTH_SETUP.md)

---

**Ready to deploy?** Follow the steps above and your RealMultiLLM instance will be live in minutes! 🎉
