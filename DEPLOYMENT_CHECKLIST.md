# 🚀 Quick Start Deployment Checklist

Use this checklist to deploy RealMultiLLM to Vercel with a production database in under 30 minutes.

## ✅ Pre-Deployment Checklist

### 1. Accounts Setup (5 minutes)
- [ ] GitHub account ready
- [ ] Vercel account created ([vercel.com](https://vercel.com))
- [ ] Database provider chosen:
  - [ ] Supabase account ([supabase.com](https://supabase.com)) OR
  - [ ] Neon account ([neon.tech](https://neon.tech))
- [ ] At least one LLM API key obtained:
  - [ ] OpenAI ([platform.openai.com](https://platform.openai.com/api-keys))
  - [ ] Anthropic ([console.anthropic.com](https://console.anthropic.com/settings/keys))
  - [ ] Google AI ([makersuite.google.com](https://makersuite.google.com/app/apikey))

### 2. Local Validation (5 minutes)
```bash
# Clone repository
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM

# Install dependencies
npm install

# Run validation
./scripts/validate-deployment.sh
```

- [ ] All validation checks pass
- [ ] Build completes successfully

### 3. Database Setup (5 minutes)

#### For Supabase:
- [ ] Created new project
- [ ] Copied connection pooler URL (port 6543)
- [ ] Format: `postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`

#### For Neon:
- [ ] Created new project
- [ ] Copied pooled connection string
- [ ] Format: `postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require`

### 4. Generate Secrets (2 minutes)
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_MASTER_KEY
openssl rand -hex 64
```

- [ ] NEXTAUTH_SECRET generated (save it!)
- [ ] ENCRYPTION_MASTER_KEY generated (save it!)

### 5. Vercel Project Setup (5 minutes)
- [ ] Connected GitHub repository to Vercel
- [ ] Framework preset: Next.js (auto-detected)
- [ ] Build settings left as default

### 6. Environment Variables (10 minutes)

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

#### Required Variables:
- [ ] `NEXTAUTH_URL` = `https://your-app.vercel.app`
- [ ] `NEXTAUTH_SECRET` = (from step 4)
- [ ] `DATABASE_URL` = (from step 3)
- [ ] `ENCRYPTION_MASTER_KEY` = (from step 4)
- [ ] `ALLOW_DEMO_MODE` = `false`
- [ ] At least one LLM API key:
  - [ ] `OPENAI_API_KEY`
  - [ ] `ANTHROPIC_API_KEY`
  - [ ] `GOOGLE_AI_API_KEY`

#### Optional Variables:
- [ ] `GOOGLE_CLIENT_ID` (for Google OAuth)
- [ ] `GOOGLE_CLIENT_SECRET` (for Google OAuth)
- [ ] `GITHUB_CLIENT_ID` (for GitHub OAuth)
- [ ] `GITHUB_CLIENT_SECRET` (for GitHub OAuth)

### 7. Deploy (2 minutes)
- [ ] Pushed to GitHub main branch
- [ ] Vercel automatically triggered build
- [ ] Build completed successfully
- [ ] Deployment URL generated

### 8. Database Schema Deployment (3 minutes)
```bash
# Set production DATABASE_URL
export DATABASE_URL="your-production-connection-string"

# Generate Prisma client
npx prisma generate

# Deploy schema
npx prisma db push
```

- [ ] Schema deployed successfully
- [ ] Tables visible in database dashboard

### 9. Create First User (2 minutes)

#### Option A: Using Prisma Studio
```bash
# Open Prisma Studio
npx prisma studio

# Create user manually in GUI
```

#### Option B: Using bcrypt hash
```bash
# Generate password hash
node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 10))"

# Insert via SQL in database dashboard
INSERT INTO "User" (id, email, name, password, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@example.com',
  'Admin User',
  '$2a$10$HASHED_PASSWORD_HERE',
  NOW(),
  NOW()
);
```

- [ ] User account created
- [ ] Email and password saved securely

### 10. Verification (5 minutes)
Visit your deployment URL:

- [ ] Homepage loads without errors
- [ ] Can sign in with created account
- [ ] Settings page accessible
- [ ] Can configure LLM provider
- [ ] Chat functionality works
- [ ] No console errors

## 📊 Post-Deployment

### Security Verification
- [ ] `ALLOW_DEMO_MODE` is `false` or not set
- [ ] All secrets are in environment variables (not code)
- [ ] OAuth redirect URIs match deployment URL
- [ ] Database uses connection pooling
- [ ] HTTPS is working

### Optional Enhancements
- [ ] Set up custom domain
- [ ] Configure OAuth providers
- [ ] Enable monitoring/analytics
- [ ] Set up database backups
- [ ] Configure rate limiting

## 🐛 Troubleshooting

### Build Fails
1. Check build logs in Vercel Dashboard
2. Verify `prebuild` script runs `prisma generate`
3. Clear Vercel build cache
4. Check all dependencies are listed in package.json

### Database Connection Fails
1. Verify `DATABASE_URL` format is correct
2. Check database is not paused (Supabase free tier)
3. Ensure connection pooling is configured
4. Test connection locally: `npx prisma db execute --stdin <<< "SELECT 1;"`

### Authentication Fails
1. Verify `NEXTAUTH_URL` matches deployment URL exactly
2. Check `NEXTAUTH_SECRET` is set and 32+ characters
3. Verify `DATABASE_URL` is set correctly
4. Check OAuth redirect URIs if using Google/GitHub

### API Calls Fail
1. Verify at least one LLM API key is set
2. Check API key format (OpenAI: `sk-proj-...`, Anthropic: `sk-ant-api03-...`)
3. Test API key directly with provider
4. Check Vercel function logs for errors

## 📚 Detailed Documentation

For more information, see:
- **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)** - Complete deployment guide
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Database configuration
- **[AUTH_SETUP.md](./AUTH_SETUP.md)** - Authentication setup
- **[.env.production.example](./.env.production.example)** - Environment variables reference

## 🎯 Quick Commands Reference

```bash
# Validate deployment readiness
./scripts/validate-deployment.sh

# Setup database
./scripts/setup-database.sh

# Generate Prisma client
npx prisma generate

# Deploy database schema
npx prisma db push

# Open Prisma Studio
npx prisma studio

# View Vercel logs
vercel logs

# Deploy manually via CLI
vercel --prod
```

## 📞 Need Help?

1. Check the troubleshooting section above
2. Review detailed documentation files
3. Check [GitHub Issues](https://github.com/IAlready8/RealMultiLLM/issues)
4. Verify all environment variables are set correctly

---

**Estimated Total Time: 30-45 minutes** ⏱️

Once you've completed this checklist, your RealMultiLLM instance will be fully deployed and operational! 🎉
