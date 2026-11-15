# Pilot Readiness Audit

**Status:** Phase 1 repository audit  
**Date:** 2026-11-14  
**Scope:** Repository evidence only. No application behavior, database schema, hosted settings, or external services were changed.

## Executive summary

Homeish is already a substantial multi-tenant application, not an empty foundation. The repository contains a Next.js 16 App Router app, Supabase-backed authentication and PostgreSQL, 51 SQL migrations, ten registered modules, private file storage, Brevo email, Sentry, in-app notifications, and Web Push. The database and application include meaningful tenant-isolation, authorization, audit, retention, and recovery controls.

No Critical security finding was confirmed in this audit. **One High pilot-readiness blocker remains:** the documented production project is paused, the automated off-site backup is disabled, and the verified backup/restore work is for synthetic `homeish-testdb` data only. The database backup does not include Storage files. Do not onboard real pilot data until a production-specific backup and restore path (including an accepted plan for files) has been configured and tested.

The current request also changes the pilot scope: Push notifications are now deferred, but the code, schema, dependencies, environment validation, and prior project decisions currently include Web Push as an MVP feature. That working functionality was not removed or disabled in Phase 1. Resolve how it should be handled before implementation work touches it.

The local checks run for this audit passed except for the full dependency audit, which reported nine Moderate transitive `minimatch` advisories. The production-only dependency audit reported zero vulnerabilities.

## Scope and evidence limits

This audit inventories the repository and reviews the primary application, tenant, authentication, database, storage, integrations, backup, CI, and documentation boundaries. The PostgreSQL suite uses a disposable local PostgreSQL 17 instance and Supabase stand-ins; it is not a check of the hosted projects. Hosted dashboards, secret values, live data, deployments, and provider settings were not accessed. This report is not a penetration test, legal/privacy review, manual accessibility sign-off, or production go-live approval.

## Current architecture and technology inventory

- **Application:** Next.js 16.4.6 App Router, TypeScript, React 19.3.1, Tailwind CSS 4, Zod, Vitest, and Playwright. npm and `package-lock.json` are used; Node.js 24 is required.
- **Backend:** Supabase PostgreSQL 17, Supabase Auth, private Storage buckets, and Realtime. Database access uses the signed-in user client for normal operations; the service-role client is isolated in `src/core/privileged/`.
- **Hosting and operations:** Vercel, GitHub Actions, Sentry, Brevo, and Google Drive for encrypted database backup. No Redis, Kafka, Kubernetes, separate API service, payment gateway, or alternate auth/realtime vendor was found in the active application dependency set.
- **Application structure:** `src/app/` contains role-based routes and route handlers; `src/core/` contains shared services and policy boundaries; `src/components/` contains UI; `supabase/migrations/` contains the schema history; `tests/` contains unit, database integration, and browser tests.
- **Implemented modules:** Core, visitor, delivery, billing, service requests, staff, housekeeping, AMC, notice board, and amenity booking are registered in the module registry. New societies are designed to start with Core enabled; other modules can be enabled individually.
- **Environments recorded in project documentation:** `homeish-testdb` is the shared synthetic local/development/beta database; `homeish-demo` and `homeish-live` are paused. These are repository-recorded states, not independently verified hosted settings.

## Features and service status discovered

| Area                             | Repository evidence                                                                                                                                                                                                                                                                  | Audit status                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Authentication                   | Supabase email-code sign-in, closed sign-up, invitation/membership checks, rate limits, and hashed challenge tracking. Developer sign-in uses a separate password and TOTP MFA flow.                                                                                                 | Implemented; live Auth settings are not verified here.                                                        |
| Authorization and tenancy        | Society memberships and roles are loaded from the database per request; the active-society cookie is revalidated. Server operations check society state, module, role, and ownership; SQL/RLS provides a second boundary.                                                            | Implemented with database integration coverage.                                                               |
| Database                         | 51 migrations define core and module data, constraints, same-society foreign keys, RPC operations, audit/error records, retention, and integrity checks.                                                                                                                             | Local migration suite passed; hosted schema parity is unverified.                                             |
| File storage                     | Eight private buckets are covered by Storage policies and society-scoped paths. The server validates ownership, stored size, and content type before attaching files; download links are short-lived.                                                                                | Implemented; database dumps do not back up these objects.                                                     |
| Brevo                            | The application has a server-side Brevo API adapter for transactional email, bounded retries, timeouts, and a database-backed daily quota. Supabase Auth sign-in email delivery is configured separately through its SMTP settings.                                                  | Code exists. Operations documentation records beta setup and tests; no dashboard was inspected in this audit. |
| Sentry                           | Server instrumentation initializes Sentry; event data is scrubbed and request/user/context payloads are removed before sending.                                                                                                                                                      | Code exists. External alert configuration is documented, not verified here.                                   |
| Notifications                    | In-app notifications are implemented. Web Push subscription and delivery code, VAPID environment variables, database storage, and tests are also present.                                                                                                                            | Web Push is active in code and conflicts with the newly stated pilot scope; see the risk register.            |
| Audit, retention, and erasure    | Database functions write audit records for sensitive changes; scheduled retention anonymizes or removes data, and developer user erasure preserves anonymized history.                                                                                                               | Implemented and covered by tests.                                                                             |
| Demo data                        | The public demo is a synthetic browser-memory preview with manual and timed reset. It is not a database-backed visitor workflow. The separate demo Supabase project is documented as paused.                                                                                         | No real data path found in the demo; a database reset workflow is not active.                                 |
| Backups and monitoring           | Google Drive backup scripts encrypt PostgreSQL dumps and verify remote transfer before retention. Health checks database availability and daily-job freshness; a Vercel cron runs scheduled work.                                                                                    | Testdb restore is documented as verified. Production backup is disabled; Storage backup is deferred.          |
| Unused or duplicate integrations | No active SMS, WhatsApp, phone-OTP, Clerk, Auth0, Twilio, Ably, or Pusher implementation was found. Supabase CLI configuration has SMS disabled and contains commented provider templates only. Optional phone fields and phone-based business records are not phone authentication. | No duplicate active provider identified. Existing Web Push is the out-of-scope exception.                     |

## Environment variables, API routes, and server operations

The validated application configuration separates browser-visible values from server-only values. Public names are `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and `NEXT_PUBLIC_SENTRY_DSN`. Server names include `APP_VERSION`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `BREVO_DAILY_EMAIL_QUOTA`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `DEVELOPER_ALERT_EMAIL`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SENTRY_DSN`, `CRON_SECRET`, `GUARD_SESSION_SECRET`, and `RATE_LIMIT_HASH_SALT`. Routing uses `APP_DEPLOYMENT` and `APP_BASE_DOMAIN` (with optional Vercel host variables). The VAPID values are currently required even in local configuration, which is part of the Web Push/pilot-scope conflict.

Database tooling uses `SUPABASE_DB_URL` and, for verified TLS connections, `SUPABASE_DB_CA_CERT`; these are not application-runtime credentials. The separate backup workflow uses `GOOGLE_DRIVE_BACKUPS_ENABLED`, `GOOGLE_DRIVE_FOLDER_ID`, Google OAuth credentials, `BACKUP_ENCRYPTION_KEY`, and an approved database URL. Only variable names were reviewed; no secret values were read.

The built app exposes health and daily-job routes; client-error intake; file upload and signed-URL routes; push subscription management; bill, receipt, CSV, AMC, and housekeeping exports. Normal user workflows use server actions and server-side queries, not a general public API. The scheduled job route is protected by `CRON_SECRET`; user-facing routes validate session, origin, role, and resource scope.

## Tenant, authentication, and authorization design

Society records are identified by `societies.id`; society-host slugs select the appropriate entry page and do not grant permissions. Memberships associate a verified profile with a society and role set. Roles found in the permission map are admin, committee, guard, resident, and housekeeping supervisor; developer access is separate.

Each authenticated request verifies its Supabase user, reloads active memberships and module state, and builds a request context. Operations apply role and ownership checks, while SQL functions and row-level security independently enforce the important rules. Society-scoped tables use `society_id`; same-society composite foreign keys prevent cross-tenant references. Service-role access is kept within the privileged boundary and is not the normal data path.

Society users sign in with email codes; developer access uses password plus recent TOTP MFA. The profile includes an optional phone field, but no phone-based sign-in or OTP flow was found. Hosted Supabase Auth configuration cannot be inferred from `supabase/config.toml`; that file describes CLI/local settings, and the project documentation says hosted settings are configured separately.

## Database and storage security status

The migration and integration-test patterns enforce RLS on public application tables, policies on each table, no anonymous table/column privileges, tenant keys and indexes, and explicit role/module checks. The integration suite includes catalog checks, cross-society RPC and row-visibility tests, Storage bucket policy tests, and domain-specific role tests. The executed local database suite passed.

All eight configured Storage buckets are private and use per-bucket role policies. Uploaded object paths are checked against the active society and owning record, and file metadata is rechecked before attachment. The local tests do not prove that hosted Storage configuration or project-level settings match the migrations.

## Backup, recovery, monitoring, and demo operations

The backup implementation uses PostgreSQL 17 custom-format dumps, AES-256-GCM encryption, private Google Drive storage, remote size/checksum verification, and 30-day retention. Documentation records a successful testdb restore drill into a disposable compatible target with integrity checks. The scheduled workflow is gated by `GOOGLE_DRIVE_BACKUPS_ENABLED=true` and is documented as disabled. Production-specific source guards and archive isolation are required before enabling production backups. Database-only backups omit Storage files and do not by themselves restore hosted role/ACL or provider configuration.

The public health route returns only available/unavailable status and checks database and scheduled-job freshness. The repository documents beta uptime, Sentry, Brevo, and daily-job verification. These external checks were not repeated during this audit. The public demo currently uses synthetic browser state; no production data is seeded into it.

## Testing and dependency findings

The repository contains 57 unit test files, 44 database integration test files, and 11 Playwright spec files. Automated accessibility checks cover public and fixture pages, but they do not replace the documented owner-run keyboard, screen-reader, zoom, and device checks. The implementation plan also records owner UAT and production go-live as incomplete.

Commands run in this audit:

| Command                                   | Result                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                           | Passed: formatting, lint, typecheck, 57 unit files / 426 tests, source headers, public environment names, migration names, and privileged-import boundary.   |
| `npm run test:integration:local`          | Passed: 43 files passed, 1 skipped; 108 tests passed, 9 skipped on temporary PostgreSQL 17. The run emitted two `pg` query-concurrency deprecation warnings. |
| `npm run e2e`                             | Passed: 74 Chromium tests. A Next.js smooth-scroll configuration warning was emitted.                                                                        |
| `npm run build`                           | Passed: optimized Next.js production build.                                                                                                                  |
| `npm audit`                               | Exit code 1: nine Moderate `minimatch` advisories in the full dependency tree. No automatic fix or package update was run.                                   |
| `npm audit --omit=dev`                    | Passed: zero vulnerabilities in the production-only dependency tree.                                                                                         |
| `npm ls --depth=0` and `npm ls minimatch` | Completed; the advisories are transitive and primarily appear in lint/build tooling paths.                                                                   |

CI is configured for Gitleaks, static checks, build, disposable PostgreSQL integration tests, browser tests, and CodeQL. This audit did not run Gitleaks, CodeQL, the performance-scale opt-in suite, or the GitHub workflows. The local public-environment check passed; it is not a full secret-history scan. Do not treat the moderate dependency findings as fixed; evaluate a targeted lockfile update in a separate approved task.

## Documentation status

Product, design, architecture, database, API, setup, deployment, operations, logging, privacy, and UAT documentation exists. However, `README.md` says the app does not connect to Supabase, says modules/schema are not implemented, lists Sentry and Web Push as deferred, and records older package versions. The current source and manifest contradict those statements. Older sections of `docs/ARCHITECTURE.md` also describe product behavior as unimplemented while later implementation-plan sections and the source show it implemented. The new pilot scope also conflicts with the older approved PRD decision that included Web Push.

The requested `docs/audits/pilot-readiness-audit.md` and `docs/roadmap/deferred-features.md` did not exist and are created in this Phase 1 documentation change. See the [deferred-features register](../roadmap/deferred-features.md).

## Prioritized findings

### Critical

- **None confirmed** by the reviewed repository controls and commands. This is not a guarantee against vulnerabilities that require manual penetration testing or hosted configuration access.

### High

1. **Production recovery is not ready for real pilot data.** Project documentation records `homeish-live` as paused, scheduled off-site backup as disabled, and the successful backup/restore drill as testdb-only. Storage files are not included in the database backup. Production backup source isolation and a production-specific restore drill must be completed before onboarding real societies.

### Medium

1. **Pilot scope conflicts with shipped Web Push.** The current request defers push, but Web Push is implemented and required by existing docs and environment validation. Do not add more push functionality; do not silently delete or change the working code. Decide whether to retain it dormant or approve a scoped disable/removal plan.
2. **Full dependency audit has nine Moderate findings.** The production-only audit is clean, but the complete dependency graph is not. Review a narrowly scoped remediation and consider adding a non-mutating dependency audit to CI; do not run `npm audit fix` blindly.
3. **Manual pilot acceptance is incomplete.** The implementation plan records owner screen-reader/device checks, UAT, production setup, pilot onboarding, and post-pilot review as pending. Automated checks alone are not launch approval.
4. **Repository documentation has implementation drift.** Reconcile the older README/architecture status descriptions with the current source, migration set, active modules, and this pilot's revised scope.

### Low

1. **Deployment and CI are not a single hard gate.** The deployment documentation says Vercel can deploy beta while CI/CodeQL run; the documented release process requires the owner to wait for green checks. Confirm that branch protections enforce the intended behavior before production releases.
2. **Local PostgreSQL integration tests emit `pg` deprecation warnings.** They did not fail this run; review separately before a future pg major upgrade.

### Informational

- The demo is synthetic and browser-memory-only; `homeish-demo` is documented as paused.
- No active SMS, WhatsApp, phone OTP, or alternate authentication/realtime vendor implementation was found.
- No dependency or paid service was added in this phase.

## Recommended implementation sequence

1. Confirm how the existing Web Push implementation should be handled under the new pilot boundary. Keep it unchanged until that decision is clear.
2. Before any real data, provision/verify the production project and environment, configure production-only Auth, Brevo, Sentry, and monitoring settings, and complete an isolated production backup/restore drill. Resolve Storage-file recovery and source-specific backup retention.
3. Complete the owner-run UAT and manual accessibility checks for only the modules intended for the pilot. Keep modules disabled until their acceptance.
4. Reconcile stale documentation and review targeted remediation for the moderate dependency advisories. Preserve lockfile-only, tested updates; avoid broad upgrades.
5. Onboard a real pilot society only after the above go-live gates and owner approval; start with Core and enable modules one at a time.

### Expected files and migrations

- **Phase 1 changes:** this audit, the deferred-features register, and the architecture folder inventory only.
- **Application files:** none are justified by the audit alone. If push must be disabled, the scope will likely touch notification delivery, subscription routes/components, service-worker behavior, environment validation, and related tests; define the exact change only after approval.
- **Database migrations:** none are justified by Phase 1 evidence. Existing schema already provides tenancy, RLS, audit, retention, and private storage foundations. Do not create speculative migrations.

### Manual configuration likely to be required

No dashboard settings were changed or verified. Before pilot go-live, the owner/operator will need to verify the dedicated live Supabase project and Auth settings; Vercel environment/secrets and cron; Brevo sender domain and separate production API/SMTP credentials; Sentry environment and critical alert; external health monitoring; and production-specific Google Drive backup credentials, folder, retention boundary, and recovery key. Required variable names are listed in `.env.example` and `docs/DEPLOYMENT.md`; secret values must remain in approved secret stores.

## Assumptions and remaining risks

- The latest pilot-scope instructions supersede older project documentation where they conflict; specifically, push notifications are deferred for the pilot. Whether to retain existing Web Push code dormant or remove/disable it remains open.
- The repository-recorded external service states are accurate but were not independently checked during this audit.
- No hosted migration, seed, reset, deployment, or dashboard change was performed. No real personal data or local secret values were inspected or copied.
- Costs introduced: none. Rollback for this Phase 1 work is limited to reverting the documentation changes; no schema or application rollback is needed.
