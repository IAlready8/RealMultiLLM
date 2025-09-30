# RealMultiLLM - Multi-LLM Platform

Multi‑LLM platform with chat, personas, analytics, model comparison, pipelines, and secure API key handling. Built with Next.js 14 (App Router), TypeScript, Prisma, NextAuth, Tailwind + Radix UI, and Vitest.

## 🚀 Quick Deploy to Production

**Deploy to Vercel in 30 minutes:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIAlready8%2FRealMultiLLM)

See **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** for step-by-step guide.

## 📚 Documentation

### Deployment & Setup
- **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)** - Complete Vercel deployment guide
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Supabase & Neon database setup
- **[AUTH_SETUP.md](./AUTH_SETUP.md)** - Authentication & OAuth configuration
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - 30-minute deployment guide
- **[.env.production.example](./.env.production.example)** - Production environment variables

### Development
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[DOCUMENTATION.md](./DOCUMENTATION.md)** - API & components guide
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** - UI design system
- **[ROADMAP.md](./ROADMAP.md)** - Project roadmap

### Quick Reference
- **[.env.example](./.env.example)** - Development environment template
- **[CLAUDE.md](./CLAUDE.md)** - Development guidelines

## ⚡ Quick Start (Development)

### Prerequisites
- Node.js 18 or later
- npm or yarn
- Git

### Local Setup

```bash
# Clone repository
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Generate secure keys
./scripts/generate-keys.sh

# Edit .env.local with your values
# Required: NEXTAUTH_SECRET, ENCRYPTION_MASTER_KEY, at least one LLM API key

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### Demo Account (Development Only)

For quick testing in development:
- Email: `demo@example.com`
- Password: `DemoPassword123!@#`
- Enable with: `ALLOW_DEMO_MODE=true` in `.env.local`

**⚠️ Must be disabled in production!**

## 🛠️ Available Scripts

### Development
- `npm run dev` - Start dev server
- `npm run build` - Build production bundle
- `npm run start` - Start production server

### Code Quality
- `npm run lint` - Lint codebase
- `npm run type-check` - TypeScript type checks

### Testing
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:run:local` - Single-threaded (sandbox-safe)
- `npm run test:coverage` - Tests with coverage

### Database
- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema to database
- `npx prisma migrate dev` - Create migration
- `npx prisma studio` - Open database GUI

### Deployment Helpers
- `./scripts/generate-keys.sh` - Generate secure keys
- `./scripts/validate-deployment.sh` - Validate before deploy
- `./scripts/setup-database.sh` - Initialize production database

## 🗄️ Database

### Development
- **SQLite** (default) - File-based, no setup required
- Database file: `dev.db`
- Perfect for local development

### Production
- **PostgreSQL** via [Supabase](https://supabase.com) or [Neon](https://neon.tech)
- Connection pooling included
- Free tier available
- See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for setup

### Migration

```bash
# Switch from SQLite to PostgreSQL
export DATABASE_URL="postgresql://..."
npx prisma generate
npx prisma db push
```

## 🔐 Authentication

RealMultiLLM uses **NextAuth.js** with multiple auth methods:

- ✅ Email/Password (Credentials)
- ✅ Google OAuth
- ✅ GitHub OAuth
- ✅ Demo Account (development only)

See [AUTH_SETUP.md](./AUTH_SETUP.md) for configuration.

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS + Radix UI + Class Variance Authority
- **Database**: Prisma ORM (SQLite dev / PostgreSQL prod)
- **Authentication**: NextAuth.js v4 with Prisma adapter
- **Testing**: Vitest + Testing Library
- **LLM Providers**: OpenAI, Anthropic, Google AI, OpenRouter
- **Deployment**: Vercel (recommended), Netlify supported

## 🔑 Environment Variables

### Required (Production)
```bash
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
DATABASE_URL=postgresql://...
ENCRYPTION_MASTER_KEY=generate-with-openssl-rand-hex-64
```

### LLM Providers (At least one)
```bash
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_AI_API_KEY=...
OPENROUTER_API_KEY=sk-or-...
```

### Optional
```bash
GOOGLE_CLIENT_ID=...      # For Google OAuth
GOOGLE_CLIENT_SECRET=...  # For Google OAuth
GITHUB_CLIENT_ID=...      # For GitHub OAuth
GITHUB_CLIENT_SECRET=...  # For GitHub OAuth
```

See [.env.production.example](./.env.production.example) for complete reference.

## 🧪 Testing

### Web (Vitest)
```bash
npm run test:run         # Run tests once
npm run test             # Watch mode
npm run test:coverage    # With coverage
```

### Core (Pytest - Optional)
```bash
pip install -r requirements.txt
pytest
```

## 🌊 Streaming API

- **Endpoint**: `POST /api/llm/stream`
- **Format**: `application/x-ndjson`
- **Events**: 
  - `{ type: 'chunk', content: string }`
  - `{ type: 'done' }`
  - `{ type: 'error', error: string }`
  - `{ type: 'aborted' }`

### Client Helper
```typescript
import { streamChat } from '@/services/stream-client';

streamChat(provider, messages, options, onEvent);
```

### Rate Limits (Environment Configurable)
- `RATE_LIMIT_LLM_PER_USER_PER_MIN` (default: 60)
- `RATE_LIMIT_LLM_GLOBAL_PER_MIN` (default: 600)
- `RATE_LIMIT_LLM_WINDOW_MS` (default: 60000)

## 📊 Observability

- **Structured Logs**: JSON logs via `lib/logger.ts`
- **Metrics**: Request timing and token usage in analytics
- **Monitoring**: Vercel Analytics, Sentry (optional)

## 🚀 Deployment

### Vercel (Recommended)
1. Follow [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) (30 minutes)
2. Or use: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIAlready8%2FRealMultiLLM)

### Netlify (Alternative)
- Configure `NETLIFY_SITE_ID` and `NETLIFY_AUTH_TOKEN`
- See [netlify.toml](./netlify.toml) for configuration

### CI/CD
- GitHub Actions: `.github/workflows/ci.yml`
- Runs: lint, type-check, tests with coverage
- Deploys on merge to main

## 🤝 Contributing

See [init/AGENTS.md](./init/AGENTS.md) for:
- Development roles and responsibilities
- Code conventions and guardrails
- Runbooks and workflows

## 📄 License

MIT - See [LICENSE](./LICENSE) for details.

## 🆘 Support

- 📖 **Documentation**: Check the comprehensive guides above
- 🐛 **Issues**: [GitHub Issues](https://github.com/IAlready8/RealMultiLLM/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/IAlready8/RealMultiLLM/discussions)

## 🎯 Key Features

- ✅ **Multi-LLM Support** - OpenAI, Anthropic, Google AI, OpenRouter
- ✅ **Real-time Streaming** - NDJSON streaming for live responses
- ✅ **Secure Auth** - NextAuth.js with OAuth and credentials
- ✅ **Analytics** - Usage tracking and visualization
- ✅ **Personas** - Customizable AI personas
- ✅ **Model Comparison** - Side-by-side model testing
- ✅ **Goal Tracking** - Manage and track AI-assisted goals
- ✅ **Encrypted Storage** - Client-side API key encryption
- ✅ **Production Ready** - Vercel deployment with PostgreSQL

---

**Ready to deploy?** Start with [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) 🚀
