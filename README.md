# Dwello

Dwello is a multi-tenant society-management web app. Its approved foundation is a single Next.js App Router application with TypeScript, Tailwind CSS and Supabase.

## Requirements

- Node.js 24.20.0 (npm 11.19.0 was used for this setup)
- npm

## Start locally

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The checked-in environment file contains placeholders only. The app shell does not connect to Supabase yet; local database setup is a separate foundation task and requires Docker Desktop and the Supabase CLI.

## Checks

```powershell
npm run check
npx playwright install chromium
npm run e2e
npm run build
```

`npm run check` runs formatting, lint, strict type checking, unit tests, source-header checks and a public-environment-name check. Playwright runs the browser smoke and accessibility check.

## Project structure

- `src/app/`: route groups, layouts and route handlers only
- `src/core/`: shared platform configuration and later core services
- `src/components/ui/`: shared design-system controls
- `src/styles/`: Tailwind theme and global tokens
- `public/`: Dwello logo and later PWA assets
- `src/modules/`: isolated product modules, added as their phases begin
- `supabase/`: migrations, synthetic seed data and database tests
- `tests/`: unit and browser tests
- `docs/`: product, design, architecture and agent instructions

## Dependencies

Runtime foundations: Next.js 16.4.5, React 19.3.1, Tailwind CSS 4.3.5, Supabase SSR 0.12.7, Supabase JS 2.119.0, Zod 4.6.7, and self-hosted Manrope and Sora 5.3.0. Development foundations: TypeScript 5.9.3, ESLint 10.14.0, Prettier 3.9.10, Vitest 5.1.0, Playwright 1.65.0 and axe 4.14.0. `package-lock.json` records exact transitive versions.

Radix UI, Lucide, React Hook Form, Sentry, Web Push and PDF tooling are intentionally deferred until their first use. No feature modules or database schema are implemented in this foundation.

## Project documents

- [Product requirements](docs/PRD.md)
- [Design system](docs/DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [Agent instructions](docs/AGENTS.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)