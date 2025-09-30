# Complete Setup Guide

Step-by-step guide to set up and run RealMultiLLM locally.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [API Keys Configuration](#api-keys-configuration)
7. [OAuth Setup](#oauth-setup)
8. [Running the Application](#running-the-application)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Production Deployment](#production-deployment)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v20.x or higher ([Download](https://nodejs.org/))
- **npm** v10.x or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **SQLite** (built-in, no separate installation needed)

Optional:
- **PostgreSQL** for production deployment
- **Docker** for containerized deployment

### Verify Prerequisites

```bash
node --version  # Should output v20.x.x or higher
npm --version   # Should output v10.x.x or higher
git --version   # Should output git version 2.x.x or higher
```

---

## Quick Start

For the fastest setup, use the automated script:

```bash
# Clone the repository
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM

# Run quick setup script
./scripts/quick-setup.sh

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

---

## Detailed Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 14
- React 18
- Prisma ORM
- NextAuth.js
- Tailwind CSS
- And many more...

### Step 3: Generate Prisma Client

```bash
npx prisma generate
```

This generates the Prisma client based on your schema.

---

## Environment Configuration

### Step 1: Create Environment File

Copy the example environment file:

```bash
cp .env.example .env.local
```

### Step 2: Configure Required Variables

Edit `.env.local` and configure the following essential variables:

#### Core Settings

```bash
# Application URL
NEXTAUTH_URL=http://localhost:3000

# NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your_random_secret_here_min_32_characters
```

#### Database

```bash
# SQLite (Development - Default)
DATABASE_URL="file:./prisma/dev.db"

# PostgreSQL (Production - Recommended)
# DATABASE_URL="postgresql://username:password@localhost:5432/realmultillm?schema=public"
```

---

## Database Setup

### SQLite (Development)

SQLite is used by default for development. The database file will be created automatically:

```bash
# Create database and run migrations
npx prisma migrate dev --name init

# Open Prisma Studio to view/edit data (optional)
npx prisma studio
```

### PostgreSQL (Production)

For production, we recommend PostgreSQL:

#### Option 1: Local PostgreSQL

```bash
# Install PostgreSQL
# macOS: brew install postgresql@16
# Ubuntu: sudo apt install postgresql-16

# Create database
createdb realmultillm

# Update DATABASE_URL in .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5432/realmultillm?schema=public"

# Run migrations
npx prisma migrate deploy
```

#### Option 2: Managed PostgreSQL

Use a managed service like:
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Supabase](https://supabase.com) - Open source Firebase alternative
- [Railway](https://railway.app) - Easy PostgreSQL hosting

Example connection string:
```bash
DATABASE_URL="postgresql://user:pass@host.region.neon.tech:5432/database?sslmode=require"
```

---

## API Keys Configuration

Configure API keys for LLM providers you want to use. All are optional - configure only what you need.

### OpenAI

1. Get API key from: https://platform.openai.com/api-keys
2. Add to `.env.local`:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### Anthropic (Claude)

1. Get API key from: https://console.anthropic.com/
2. Add to `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
```

### Google AI (Gemini)

1. Get API key from: https://makersuite.google.com/app/apikey
2. Add to `.env.local`:

```bash
GOOGLE_AI_API_KEY=your-google-ai-api-key-here
```

### OpenRouter

1. Get API key from: https://openrouter.ai/keys
2. Add to `.env.local`:

```bash
OPENROUTER_API_KEY=sk-or-your-openrouter-api-key-here
```

### Other Providers (Optional)

```bash
# Llama
LLAMA_API_KEY=your-llama-api-key-here

# GitHub Copilot
GITHUB_TOKEN=your-github-token-here

# Grok
GROK_API_KEY=your-grok-api-key-here
```

---

## OAuth Setup

Configure OAuth providers for user authentication.

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
7. Add to `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### GitHub OAuth

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in details:
   - Application name: RealMultiLLM
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Add to `.env.local`:

```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

---

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

Features in development mode:
- Hot reload on code changes
- Detailed error messages
- Development-only debug tools

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server

# Building
npm run build            # Build for production
npm run start            # Start production server

# Quality Checks
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript checks
npm run format:check     # Check code formatting

# Testing
npm run test             # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage
npm run test:run:local   # Run tests single-threaded (for CI)

# Database
npx prisma studio        # Open Prisma Studio
npx prisma generate      # Generate Prisma Client
npx prisma migrate dev   # Run migrations (dev)
npx prisma migrate deploy # Run migrations (prod)
```

---

## Testing

### Unit & Integration Tests

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Run tests single-threaded (sandbox environments)
npm run test:run:local
```

### Manual Testing

1. Navigate to `http://localhost:3000`
2. Sign up for an account
3. Configure at least one API key in Settings
4. Try the multi-chat feature
5. Create a persona
6. Test analytics dashboard

---

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module '@prisma/client'"

**Solution:**
```bash
npx prisma generate
```

#### Issue: "Error: Invalid `prisma.user.create()` invocation"

**Solution:** Run database migrations
```bash
npx prisma migrate dev
```

#### Issue: "NEXTAUTH_SECRET must be provided"

**Solution:** Generate and set NEXTAUTH_SECRET
```bash
# Generate secret
openssl rand -base64 32

# Add to .env.local
echo "NEXTAUTH_SECRET=<generated_secret>" >> .env.local
```

#### Issue: Port 3000 already in use

**Solution:** Use a different port
```bash
PORT=3001 npm run dev
```

#### Issue: API key not working

**Solution:**
1. Verify the key is correct and active
2. Check it's set in `.env.local` (not `.env.example`)
3. Restart the dev server after adding keys
4. Check API key has sufficient credits/quota

#### Issue: Database locked (SQLite)

**Solution:**
```bash
# Stop all running instances
# Delete the database and recreate
rm prisma/dev.db
npx prisma migrate dev
```

#### Issue: Build fails with "prisma: not found"

**Solution:** Install Prisma globally or use npx
```bash
npm install -g prisma
# or use
npx prisma generate
```

### Getting Help

If you encounter issues not covered here:

1. Check [GitHub Issues](https://github.com/IAlready8/RealMultiLLM/issues)
2. Review documentation in `/docs` folder
3. Check logs in console and browser DevTools
4. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)

---

## Production Deployment

### Environment Variables

Ensure all production environment variables are set:

```bash
# Essential
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<strong-random-secret>
DATABASE_URL=<postgresql-connection-string>

# OAuth
GOOGLE_CLIENT_ID=<prod-google-client-id>
GOOGLE_CLIENT_SECRET=<prod-google-secret>
GITHUB_CLIENT_ID=<prod-github-client-id>
GITHUB_CLIENT_SECRET=<prod-github-secret>

# API Keys
OPENAI_API_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>
# ... other keys
```

### Netlify Deployment

1. Connect your GitHub repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
3. Add environment variables in Netlify dashboard
4. Deploy!

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

### Docker Deployment

```bash
# Build image
docker build -t realmultillm .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="your-db-url" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  realmultillm
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Follow prompts to configure your deployment.

---

## Security Checklist

Before deploying to production:

- [ ] Change NEXTAUTH_SECRET to a strong random value
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS (Netlify/Vercel do this automatically)
- [ ] Review and set appropriate CORS origins
- [ ] Configure rate limiting appropriately
- [ ] Review and update OAuth redirect URIs
- [ ] Never commit `.env.local` to version control
- [ ] Set up monitoring and error tracking
- [ ] Configure backup strategy for database
- [ ] Review security headers in `next.config.mjs`

---

## Performance Optimization

For production deployments:

1. **Enable caching:**
   ```bash
   # Add to .env.local
   ENABLE_CACHE=true
   CACHE_TTL=3600
   ```

2. **Optimize images:** Next.js automatically optimizes images

3. **Enable compression:** Enabled by default in Next.js

4. **Use CDN:** Netlify and Vercel provide CDN automatically

5. **Monitor performance:**
   ```bash
   npm run profile
   ```

---

## Next Steps

Once setup is complete:

1. Review [DOCUMENTATION.md](../DOCUMENTATION.md) for API documentation
2. Check [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) for UI patterns
3. Read [ROADMAP.md](../ROADMAP.md) for future features
4. Explore example personas in the Personas page
5. Set up analytics to track usage
6. Configure monitoring for production

---

## Additional Resources

- [API Routes Documentation](./API_ROUTES.md)
- [API Providers Documentation](./API_PROVIDERS.md)
- [Architecture Documentation](../ARCHITECTURE.md)
- [Contributing Guide](../init/AGENTS.md)

---

## Support

For questions or issues:
- GitHub Issues: https://github.com/IAlready8/RealMultiLLM/issues
- Documentation: See `/docs` folder
- Examples: See `/examples` folder (coming soon)

---

**Happy coding! 🚀**
