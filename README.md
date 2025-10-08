# Personal LLM Tool

[![Vercel Deployment](https://vercelbadge.vercel.app/api/d3m2smac/RealMultiLLM?style=for-the-badge)](https://vercel.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Multi‑LLM platform with chat, personas, analytics, model comparison, pipelines, and secure API key handling. Built with Next.js 15 (App Router), TypeScript, Prisma, NextAuth, Tailwind + Radix UI, and Vitest.

## Quickstart
- Requirements: Node 20+, npm, SQLite (built‑in), optional Python for core tests.
- Install: `npm ci` and generate Prisma client: `npx prisma generate`
- Env: Copy `.env.example` to `.env.local` and fill values (`DATABASE_URL`, `NEXTAUTH_SECRET`, provider keys)
- Dev: `npm run dev` (Next.js at `http://localhost:3000`)

## Scripts
- `npm run dev`: Start dev server
- `npm run build`: Build production bundle
- `npm run start`: Start production server
- `npm run lint`: Lint codebase
- `npm run type-check`: TypeScript type checks
- `npm run test`: Run Vitest in watch mode
- `npm run test:run`: Run Vitest once
- `npm run test:run:local`: Run tests single-threaded (sandbox-safe)
- `npm run test:coverage` / `npm run test:ci`: CI‑style run with coverage

## Architecture
- High‑level: Next.js App Router UI + API routes in `app/api/*`; Prisma ORM with SQLite (dev), Postgres planned for prod; NextAuth for auth; Tailwind + Radix UI + CVA for design system.
- Providers: Normalized LLM provider clients in `services/llm-providers/*` with streaming support.
- Core (optional): Python async LLM manager in `src/core/llm_manager` with pytest tests.
- CI/CD: GitHub Actions workflow `.github/workflows/ci.yml`, Vercel deploy.

See `ARCHITECTURE.md` for full details.

## Documentation
- Roadmap: `ROADMAP.md`
- Design System: `DESIGN_SYSTEM.md`
- API/Components Guide: `DOCUMENTATION.md`
- Status: `STATUS_UPDATE.md`
- Agents/Contrib Guide: `init/AGENTS.md`
- Provider Integration: `docs/provider-integration.md`
- API Key Management: `docs/api-key-management.md`
- Provider Setup Guide: `docs/provider-setup.md`
- API Endpoint Reference: `docs/api-endpoints.md`
- Provider Examples: `docs/provider-examples.md`
- Vercel Deployment Guide: `docs/vercel-deployment.md`
- Vercel Deployment Checklist: `docs/vercel-deployment-checklist.md`
- Security Guide: `docs/security-guide.md`

## Database
- Local: SQLite via Prisma (schema in `prisma/schema.prisma`)
- Migrations: `prisma/migrations/*`
- Planned: Postgres for staging/production
- Vercel: Integrated PostgreSQL via Vercel Storage

Postgres `DATABASE_URL` examples:
- Local Docker: `postgresql://postgres:postgres@localhost:5432/llmtool?schema=public`
- Managed (Neon/Supabase): `postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require&schema=public`
- Vercel Postgres: `postgresql://default:PASSWORD@HOST:5432/verceldb?sslmode=require&schema=public`

To switch to Postgres:
- Set `DATABASE_URL` to your Postgres URL
- Run `npx prisma generate && npx prisma migrate deploy`
- Verify in CI by setting a Postgres service or secret `DATABASE_URL`

## Environment
Fill these in `.env.local` (see `.env.example`):
- `DATABASE_URL`, `NEXTAUTH_SECRET`, OAuth creds (`GOOGLE_*`, `GITHUB_*`), and provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `OPENROUTER_API_KEY`).

## Testing
- Web (Vitest): `npm run test:run`, coverage with `npm run test:coverage`
- Core (Pytest): `pip install -r requirements.txt && pytest` (optional)

## Streaming
- Endpoint: `POST /api/llm/stream` returns `application/x-ndjson` with events:
  - `{ type: 'chunk', content: string }` repeated, then `{ type: 'done' }`, and `{ type: 'error' }` on failure, `{ type: 'aborted' }` on cancel.
- Client helper: `services/stream-client.ts` provides `streamChat(provider, messages, options, onEvent)` and returns a handle with `abort()`.

Rate limits (env-tunable):
- `RATE_LIMIT_LLM_PER_USER_PER_MIN` (default 60)
- `RATE_LIMIT_LLM_GLOBAL_PER_MIN` (default 600)
- `RATE_LIMIT_LLM_WINDOW_MS` (default 60000)

## Observability
- Structured logs: server emits JSON logs via `lib/logger.ts`
- Basic metrics: request timing and token usage included in analytics events

## Deployment to Vercel

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/d3m2smac/RealMultiLLM&env=ENCRYPTION_MASTER_KEY,NEXTAUTH_SECRET,DATABASE_URL&envDescription=Required%20environment%20variables%20for%20RealMultiLLM&envLink=README.md)

### Manual Deployment

1. **Push your code to a GitHub repository**

2. **Import your project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your RealMultiLLM repository

3. **Configure Environment Variables**
   - Go to your project settings in Vercel
   - Navigate to "Environment Variables"
   - Add the following variables:
     - `NODE_ENV`: `production`
     - `NEXTAUTH_URL`: `https://your-project-name.vercel.app`
     - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
     - `ENCRYPTION_MASTER_KEY`: Generate with `openssl rand -hex 64`
     - `DATABASE_URL`: Your production database URL (PostgreSQL recommended)
     - Provider keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.

4. **Set Build Command**
   - Build Command: `npx prisma generate && npx prisma migrate deploy && npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

5. **Configure Build Process**
   - Framework Preset: Next.js
   - Node.js Version: 18.x
   - Install Command: `npm ci`
   - Build Command: `npx prisma generate && npx prisma migrate deploy && npm run build`
   - Output Directory: `.next`

6. **Deploy**
   - Click "Deploy" to start the deployment process

### Vercel CLI Deployment
1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Link your project: `vercel link`
4. Set environment variables:
   ```bash
   vercel env add NODE_ENV production
   vercel env add NEXTAUTH_URL https://your-project-name.vercel.app
   vercel env add NEXTAUTH_SECRET "your-secret"
   vercel env add ENCRYPTION_MASTER_KEY "your-64-char-hex-key"
   ```
5. Deploy: `vercel --prod`

### Docker Deployment (Alternative)
The platform includes Docker support for alternative deployment options:
- `Dockerfile` - Multi-stage Docker build optimized for ARM64 (M2) architecture
- `docker-compose.yml` - Docker Compose configuration for local development
- `Dockerfile.local` - Local development Docker configuration
- `Dockerfile.vercel` - Vercel-optimized Docker configuration

To deploy with Docker:
```bash
# Build the image
docker build -t realmultillm .

# Run the container
docker run -p 3000:3000 realmultillm
```

### Database Migration for Production
When deploying to production, ensure database migrations run:
- For PostgreSQL: `npx prisma migrate deploy`
- For SQLite: Use a persistent volume or migrate to PostgreSQL
- For Vercel Postgres: Integrated PostgreSQL with automatic migrations

### Environment Variables for Production
Ensure these variables are set in your Vercel project settings:
- `NODE_ENV=production`
- `NEXTAUTH_URL=https://your-project-name.vercel.app` (or your custom domain)
- `NEXTAUTH_SECRET` (32+ character random string)
- `ENCRYPTION_MASTER_KEY` (64-character hex string)
- `DATABASE_URL` (your production database)
- Provider API keys as needed:
  - `OPENAI_API_KEY` - OpenAI API key
  - `ANTHROPIC_API_KEY` - Anthropic (Claude) API key
  - `GOOGLE_AI_API_KEY` - Google AI (Gemini) API key
  - `OPENROUTER_API_KEY` - OpenRouter API key
  - `GROK_API_KEY` - Grok API key

### Provider Integration Status
✅ **Fully Implemented Providers**:
- OpenAI (GPT-4, GPT-4 Turbo, GPT-3.5 Turbo)
- Anthropic (Claude 3 models)
- Google AI (Gemini models)
- OpenRouter (100+ models from various providers)
- Grok (xAI models)

### Security Features
- ✅ AES-256 encryption for API keys
- ✅ Secure environment variable management
- ✅ Rate limiting for API requests
- ✅ Input sanitization and validation
- ✅ Secure session management with NextAuth.js
- ✅ CORS configuration
- ✅ HTTPS enforcement
- ✅ Security headers (Content Security Policy, etc.)

## Performance Optimization
- ✅ Serverless function optimization for Vercel
- ✅ Database connection pooling
- ✅ Caching strategies for improved response times
- ✅ Streaming responses for real-time interactions
- ✅ Memory-efficient processing
- ✅ Request deduplication
- ✅ Asynchronous error processing

## Monitoring and Analytics
- ✅ Structured logging with JSON format
- ✅ Request timing metrics
- ✅ Token usage tracking
- ✅ Provider performance analytics
- ✅ Error tracking and reporting
- ✅ Usage statistics and trends

## License
MIT — see `LICENSE`.

## Contributing
Follow `init/AGENTS.md` for roles, guardrails, conventions, and runbooks.
