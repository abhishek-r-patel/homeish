# Homeish

_A little more like home._

Homeish is a multi-tenant society-management web app. Its approved foundation is a single Next.js App Router application with TypeScript, Tailwind CSS and Supabase.

## Requirements

- Node.js 24.20.0 (npm 11.19.0 was used for this setup)
- npm

## Start locally

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000 for the public marketing page or http://demo.localhost:3000 for a synthetic interactive preview. The checked-in environment file contains placeholders only. The app code does not connect to Supabase yet. Because Docker Desktop cannot be installed on the developer machine, development, automated database tests and staging/beta share one free Supabase project, `homeish-testdb` (Mumbai), with synthetic data only, managed through the Supabase CLI (ARCHITECTURE AD-13). It is never used for real society data. Two more projects exist but stay paused until needed: `homeish-demo` (synthetic showcase, later served by its own Vercel project `demo-homeish`) and `homeish-live` (all onboarded societies; schema changes reach it only through approved CI, never from a laptop). See ARCHITECTURE AD-14. CLI sign-in, linking, migrations and type generation are described in [Local setup](docs/LOCAL_SETUP.md).

Line endings are normalised to LF by `.gitattributes`, so formatting checks behave the same on Windows and CI.

### Database-specific environment profiles

Settings for each database live in their own ignored file named `.env.<profile>.local`: `.env.testdb.local` for `homeish-testdb`, `.env.demo.local` for `homeish-demo` and `.env.live.local` for `homeish-live`. The live file exists only as the source for filling GitHub/Vercel secrets later (owner decision, AD-14); it cannot be used to run anything locally. Project URLs, keys and generated app secrets are filled from Supabase automatically; values for paused projects stay `pending-resume-...` until each is resumed. Never paste values into chat or commit them. Set a database password without showing it on screen:

```powershell
./scripts/set-db-password.ps1 testdb   # hidden prompt; also demo or live
npm run dev:testdb                     # app against homeish-testdb
npm run env -- testdb <command...>     # any other command with that profile
```

`scripts/with-env.mjs` loads the profile before the command starts, so its values take precedence over `.env.local`. It refuses the `live` profile, and refuses to run if the file is missing or does not list every variable in `.env.example` (it names the missing variables, never values), so a profile is never silently completed from another database's settings. Plain `npm run dev` keeps using `.env.local` with placeholders.

## Website, society addresses and beta

Approved hosting topology (2026-11-09), following Civic Pulse's two-project pattern. The owner approved resuming scaffold hosting and automatic deployments through beta, then main. The Vercel team is `arp-dev`. `homeish.vercel.app` is attached to `homeish`; the currently attached beta address is `beta-homeish.vercel.app`. Nested demo/beta addresses below remain planned, not verified live addresses.

| Host                           | Vercel project | Git branch | Purpose                                         |
| ------------------------------ | -------------- | ---------- | ----------------------------------------------- |
| `homeish.vercel.app`           | `homeish`      | `main`     | Public marketing website                        |
| `demo.homeish.vercel.app`      | `homeish`      | `main`     | Synthetic interactive preview                   |
| `<society>.homeish.vercel.app` | `homeish`      | `main`     | Future society host, provisioned only after MVP |
| `beta.homeish.vercel.app`      | `beta-homeish` | `beta`     | Isolated testing and future features            |

`APP_DEPLOYMENT=shared` serves the website and demo entries; `APP_DEPLOYMENT=beta` serves beta only. `APP_BASE_DOMAIN` defaults to `homeish.vercel.app`. Unknown society hosts return 404, never another society or the public demo. Provider-supplied deployment aliases resolve only to their own project's website/beta entry. Hostnames select a screen, not an authenticated society or permission.

The demo is a browser-memory illustration with invented data, manual reset and a 15-minute automatic reset while open. It is not a database-backed visitor workflow. Maplewood's address is reserved in code (`src/core/config/societies.ts`) with status `disabled`: its host shows only a noindexed "Maplewood is not open yet" page, and every other path returns 404. No society record, sign-in, data or onboarding is provisioned. The owner will onboard them through a future create-society script after MVP. Beta uses the shared non-production `homeish-testdb` backend with synthetic data only (see Beta configuration below). No real society data or credentials are provisioned by this work.

For local beta, stop the shared dev server, set `$env:APP_DEPLOYMENT='beta'` and run `npm run dev`; visit http://beta.localhost:3000. Remove that variable to return to the shared site. Do not run both dev modes against the same Next.js output directory.

### Release and hosting setup

Feature branches → pull request into `beta` → automatic deployment to `beta-homeish` → verify the beta site → merge `beta` into `main` → automatic deployment to `homeish`. Both Vercel projects use their **Production deployment target**, but only `homeish` is the eventual live-society app. Their Production branches are `beta` and `main` respectively. CI runs for pull requests and both release branches. `vercel.json` enables `main` and `beta` and disables feature-branch deployments; the ignored-build script prevents each project building the other release branch. Keep Preview branch tracking disabled and automatic Production domain assignment enabled in both projects. Configure `APP_DEPLOYMENT=beta` in `beta-homeish` and `APP_DEPLOYMENT=shared` in `homeish`. A direct push to either release branch also triggers deployment; this configuration does not itself enforce pull-request-only merges or wait for CI before publishing.

Attach only the bare website and demo hostnames to `homeish`, and the beta hostname to `beta-homeish`; verify DNS/TLS and availability rather than assuming an alias is reserved. The Maplewood host may be attached to `homeish` when hosting resumes (it serves only the disabled placeholder); do not attach other society hosts yet. Connect both projects to the same GitHub repository. Never copy Civic Pulse credentials or configuration into Homeish.

Until database/auth foundations exist, hosted entry pages may use `NEXT_PUBLIC_APP_ENV=preview` with explicitly nonfunctional scaffold values (reserved `.invalid` backend URL and placeholder integration keys). This does **not** make either project production-ready; the Vercel target name is not an app-readiness claim. Before enabling workflows, connect staging/beta to the shared non-production `homeish-testdb` project (AD-13), provision the paused `homeish-live` project for production and `homeish-demo` for the demo (AD-14), give demo a synthetic-only backend/reset boundary, configure real integrations, set the correct application environment, and verify isolation. Never reset a shared production database or onboard Maplewood as part of demo setup.

### Hosting setup and resume approval (2026-11-09)

- Implementation and documentation are committed and pushed to `main` and `beta` in the same GitHub repository.
- The GitHub repository is `abhishek-r-patel/homeish`. Vercel projects `homeish` and `beta-homeish` are connected to it, with Production branches `main` and `beta` respectively, Next.js preset and Node.js 24.
- `homeish.vercel.app` is attached to `homeish` and `beta-homeish.vercel.app` to `beta-homeish`. The originally requested product address belonged to another Vercel project, which led to the Homeish name (PRD D-01).
- Earlier pushes created scaffold deployments under the previous name; the owner temporarily paused both projects. The owner subsequently approved resuming both projects, committing/pushing this configuration, and publishing the current feature branch through `beta` and then `main`. Release-branch Git deployments are now enabled in repository configuration. No demo/beta nested domains or real society hosts have been attached.
- Each project has its own scaffold-only environment configuration; no backend, SMTP or real society credentials are connected. `APP_BASE_DOMAIN` is `homeish.vercel.app` in both projects. The planned canonical beta URL is `https://beta.homeish.vercel.app`; use the attached `https://beta-homeish.vercel.app` address for current hosted testing. Verify deployment success, HTTPS and host isolation after merging. Attaching additional domains and activating societies remain separate work.
- Local verification passed: formatting, lint, type checking, 33 unit tests, four browser tests (including automated accessibility and the exact 15-minute reset), and production build. This is not hosted verification, manual assistive-technology testing or launch approval.
- Hosted smoke check on 2026-11-09: `https://homeish.vercel.app` served the public marketing page and `https://beta-homeish.vercel.app` served the beta scaffold over HTTPS. This does not verify database connectivity, real society workflows or production readiness.

### Beta configuration (2026-11-11)

- `beta-homeish` is connected to the shared non-production `homeish-testdb` project (synthetic data only), with Brevo transactional email, Sentry error reporting and an external uptime monitor. Its Production target uses `NEXT_PUBLIC_APP_ENV=staging`. See [Operations](docs/OPERATIONS.md) for monitoring, email and configuration-change procedures.
- Beta runs the P5–P7 release (`9010a32`). After a cache-free rebuild, `https://beta-homeish.vercel.app/api/health` returned `200`. P9 is not yet released.
- `homeish` and the paused `homeish-live` project are unchanged; no real society credentials are connected.

### Off-site backup setup

Google Drive replaces the disabled R2 backup implementation. Follow the
[phone-friendly Google API setup guide](docs/GOOGLE_DRIVE_BACKUP_SETUP.md) for
owner authorization, then the [backup/restore runbook](docs/OPERATIONS.md#database-backups-and-restore).
Automation remains disabled until credentials, an encrypted backup, and a restore
drill are verified. No Google account password is used.

## Checks

```powershell
npm run check
npx playwright install chromium
npm run e2e
npm run build
```

`npm run check` runs formatting, lint, strict type checking, unit tests, source-header checks, a public-environment-name check and the migration naming check. `npm run test:integration:local` applies all migrations to a throwaway local PostgreSQL 17 server and runs the database integration tests (see [Local setup](docs/LOCAL_SETUP.md)). GitHub Actions runs static checks and build, database integration tests on a disposable `postgres:17` service, and browser tests as parallel jobs; it also scans repository history with Gitleaks, and CodeQL scans the code for vulnerabilities on pushes, pull requests and weekly. Other database commands (`npm run db:list`, `db:push`, `db:types`, `db:types:check`, `db:new`) are listed in [Local setup](docs/LOCAL_SETUP.md). Playwright runs the browser smoke and accessibility check. The disabled-society control assertions are scoped to the page's main content so framework development tools do not count as society controls.

## Project structure

- `src/app/`: route groups, layouts and route handlers only
- `src/core/`: shared platform configuration, public website/preview screens and later core services
- `src/components/ui/`: shared design-system controls
- `src/styles/`: Tailwind theme and global tokens
- `public/`: Homeish logo and later PWA assets
- `src/modules/`: isolated product modules, added as their phases begin
- `supabase/`: CLI config, migrations, synthetic seed data and database tests
- `src/core/db/`: generated database types (`npm run db:types`)
- `tests/`: unit, database integration and browser tests
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
- [Local setup](docs/LOCAL_SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Accessibility manual checklist](docs/ACCESSIBILITY_CHECKLIST.md)
- [UAT script](docs/UAT_SCRIPT.md)
