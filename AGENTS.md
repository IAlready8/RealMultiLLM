% Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js routes, layouts, and pages.
- `components/`: Reusable React components (PascalCase files).
- `lib/`: Client utilities (auth, crypto, storage, Prisma client).
- `services/`: App services (API client, personas, analytics, exports).
- `prisma/`: Prisma schema and generated client.
- `test/`: Vitest + Testing Library unit/integration tests.
- `tests/`: Python tests (pytest) for backend/CLI utilities.
- `scripts/`, `hooks/`, `init/`: Local tooling and project setup.

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js dev server.
- `npm run build`: Build app (runs `prisma generate` via `prebuild`).
- `npm start`: Serve production build.
- `npm run lint`: Lint with ESLint (Next core-web-vitals).
- `npm run type-check`: TypeScript strict type checks.
- `npm run test`: Run Vitest; `npm run test:coverage` for coverage.
- Python (optional): `pytest -q` in `tests/`; install with `poetry install` or `pip install -r requirements.txt`.

## Coding Style & Naming Conventions
- Formatting: Prettier (2 spaces, single quotes, trailing commas, 80 cols).
- Linting: ESLint `next/core-web-vitals`; fix issues before PR.
- TypeScript: `strict: true`; prefer explicit types at module boundaries.
- Naming: Components `PascalCase`, hooks `use-*.ts`, utilities `kebab-case.ts`.
- Tests: `*.test.tsx|ts` in `test/`; mirror source path when possible.

## Testing Guidelines
- Frameworks: Vitest + Testing Library (JS/TS), Pytest (Python utils).
- Run: `npm run test` locally; keep `npm run test:coverage` clean.
- Patterns: Co-locate mocks in `test/**/__mocks__` or `test/test-utils.tsx`.
- Add tests with new features and bug fixes; avoid flaky timers/network.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits style observed (e.g., `feat:`, `fix:`, `perf:`, `chore:`; optional scopes like `feat(security): ...`).
- PRs: Clear description, linked issues, screenshots for UI changes, test coverage notes, and migration notes if Prisma changes.
- Checks: Ensure `npm run lint`, `npm run type-check`, and tests pass.

## Security & Configuration Tips
- Env: Copy `.env.example` to `.env.local`; never commit secrets.
- Keys: Validate API keys with `node test-api-key.js`.
- Database: Keep Prisma schema in sync; regenerate with `npx prisma generate` if needed.
- See `ARCHITECTURE.md` and `DESIGN_SYSTEM.md` for deeper context.

