# Usage Guide

3-STEP PLAN
1) Local-first quickstart for macOS
2) Real-world flows (auth, chat, personas, analytics)
3) Maintenance (profiling, reset, upgrades)

Quickstart (macOS)
1) Copy env: `cp .env.example .env.local`
2) One-liner: `./scripts/quick-setup.sh`
3) App: http://localhost:3000

Core Flows
- Sign In: OAuth (Google/GitHub) or credentials if enabled
- Multi-LLM Chat: Provide API keys via in-app secure storage
- Personas: Create/edit persona prompts; use in chat
- Analytics: Inspect usage and performance graphs
- Comparison: Run side-by-side model tests

Maintenance
- Profile endpoint: `./scripts/profile.sh http://localhost:3000/api/health`
- Reset DB: `./scripts/reset-db.sh`
- Type-check: `npm run type-check`
- Lint: `npm run lint`
- Tests: `npm run test:run`

Upgrades
- Update providers via env keys
- Switch to Postgres by changing DATABASE_URL and running `npx prisma migrate deploy`

SELF-AUDIT
- Covers local-first, key flows, and maintenance. Expand with screenshots if needed.
