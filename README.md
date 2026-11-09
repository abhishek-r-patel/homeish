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

Open http://localhost:3000 for the public marketing page or http://demo.localhost:3000 for a synthetic interactive preview. The checked-in environment file contains placeholders only. The app does not connect to Supabase yet; local database setup is a separate foundation task and requires Docker Desktop and the Supabase CLI.

## Website, society addresses and beta

Requested hosting topology (2026-11-09), following Civic Pulse's two-project pattern. **Live deployment is paused by the owner; the requested parent domain is unavailable.**

| Host | Vercel project | Git branch | Purpose |
|---|---|---|---|
| `dwello.vercel.app` | `dwello` | `main` | Public marketing website |
| `demo.dwello.vercel.app` | `dwello` | `main` | Synthetic interactive preview |
| `<society>.dwello.vercel.app` | `dwello` | `main` | Future society host, provisioned only after MVP |
| `beta.dwello.vercel.app` | `beta-dwello` | `beta` | Isolated testing and future features |

`APP_DEPLOYMENT=shared` serves the website and demo entries; `APP_DEPLOYMENT=beta` serves beta only. `APP_BASE_DOMAIN` defaults to `dwello.vercel.app`. Unknown society hosts return 404, never another society or the public demo. Provider-supplied deployment aliases resolve only to their own project's website/beta entry. Hostnames select a screen, not an authenticated society or permission.

The demo is a browser-memory illustration with invented data, manual reset and a 15-minute automatic reset while open. It is not a database-backed visitor workflow. Maplewood's address is reserved in code (`src/core/config/societies.ts`) with status `disabled`: its host shows only a noindexed "Maplewood is not open yet" page, and every other path returns 404. No society record, sign-in, data or onboarding is provisioned. The owner will onboard them through a future create-society script after MVP. Beta has no backend configured. No real society data or credentials are provisioned by this work.

For local beta, stop the shared dev server, set `$env:APP_DEPLOYMENT='beta'` and run `npm run dev`; visit http://beta.localhost:3000. Remove that variable to return to the shared site. Do not run both dev modes against the same Next.js output directory.

### Release and hosting setup

Feature branches → pull request into `beta` → verify the beta site → merge `beta` into `main`. Both Vercel projects use their **Production deployment target**, but only `dwello` is the eventual live-society app. Set each project's Production branch accordingly. CI runs for both release branches. `vercel.json` disables feature-branch deployments; the ignored-build script prevents each project building the other release branch. Configure `APP_DEPLOYMENT` in both Production and Preview targets before the first deployment.

Attach only the bare website and demo hostnames to `dwello`, and the beta hostname to `beta-dwello`; verify DNS/TLS and availability rather than assuming an alias is reserved. The Maplewood host may be attached to `dwello` when hosting resumes (it serves only the disabled placeholder); do not attach other society hosts yet. Connect both projects to the same GitHub repository. Never copy Civic Pulse credentials or configuration into Dwello.

Until database/auth foundations exist, hosted entry pages may use `NEXT_PUBLIC_APP_ENV=preview` with explicitly nonfunctional scaffold values (reserved `.invalid` backend URL and placeholder integration keys). This does **not** make either project production-ready; the Vercel target name is not an app-readiness claim. Before enabling workflows, provision isolated staging/beta and production Supabase projects, give demo a synthetic-only backend/reset boundary, configure real integrations, set the correct application environment, and verify isolation. Never reset a shared production database or onboard Maplewood as part of demo setup.

### Verified setup and deployment pause (2026-11-09)

- Implementation and documentation are committed and pushed to `main` and `beta` in the same GitHub repository.
- Vercel projects `dwello` and `beta-dwello` exist, are connected to the repository, and have Production branches `main` and `beta` respectively, Next.js preset and Node.js 24.
- `dwello.vercel.app` could not be attached: Vercel reports it belongs to another project. The automatically assigned shared address is `dwello-self.vercel.app`; beta's default address is `beta-dwello.vercel.app`. Neither is a deployed site.
- The owner chose **pause live deployment**, not the fallback domain. Both projects have automatic Git deployments disabled and zero deployments. No demo/beta nested domains or real society hosts have been attached.
- Each project has its own scaffold-only environment configuration; no backend, SMTP or real society credentials are connected. Before resuming, choose an available parent domain, update `APP_BASE_DOMAIN` and each project's `NEXT_PUBLIC_APP_URL`, attach/verify the selected hosts, re-enable Git deployments, and verify HTTPS and host isolation after deployment.
- Local verification passed: formatting, lint, type checking, 33 unit tests, four browser tests (including automated accessibility and the exact 15-minute reset), and production build. This is not hosted verification, manual assistive-technology testing or launch approval.

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
- `src/core/`: shared platform configuration, public website/preview screens and later core services
- `src/components/ui/`: shared design-system controls
- `src/styles/`: Tailwind theme and global tokens
- `public/`: Dwello logo and later PWA assets
- `src/modules/`: isolated product modules, added as their phases begin
- `supabase/`: migrations, synthetic seed data and database tests
- `tests/`: unit and browser tests
- `docs/`: product, design, architecture and agent instructions

## Dependencies

Runtime foundations: Next.js 16.4.5, React 19.3.1, Tailwind CSS 4.3.5, Supabase SSR 0.12.7, Supabase JS 2.119.0, Zod 4.6.7, and self-hosted Manrope and Sora 5.3.0. Development foundations: TypeScript 5.9.3, ESLint 10.14.0, Prettier 3.9.10, Vitest 5.1.0, Playwright 1.65.0 and axe 4.14.0. `package-lock.json` records exact transitive versions.

Radix UI, Lucide, React Hook Form, Sentry, Web Push and PDF tooling are intentionally deferred until their first use. No feature modules or database schema are implemented in this foundation. Public website and host-aware environment entry screens are implemented separately from product modules.

## Project documents

- [Product requirements](docs/PRD.md)
- [Design system](docs/DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [Agent instructions](docs/AGENTS.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)