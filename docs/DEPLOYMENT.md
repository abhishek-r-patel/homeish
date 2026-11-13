# Homeish — Deployment (DEPLOYMENT.md)

How Homeish moves from a feature branch to beta and to production, which
secrets each environment needs, how database changes are released and undone,
and the checklist for the first live society. Day-to-day monitoring, backups,
incidents and society onboarding are in [OPERATIONS.md](./OPERATIONS.md).
Hosting decisions are in [ARCHITECTURE.md](./ARCHITECTURE.md) Section 16.

| Status | Beta live on `homeish-testdb`; production (`homeish-live`) paused until go-live (P10.5) |
| ------ | --------------------------------------------------------------------------------------- |

## 1. Environments

| Environment | Vercel project          | Git branch | Supabase project                       | `NEXT_PUBLIC_APP_ENV` | `APP_DEPLOYMENT` | Data                         |
| ----------- | ----------------------- | ---------- | -------------------------------------- | --------------------- | ---------------- | ---------------------------- |
| Local       | none                    | any        | `homeish-testdb` (`.env.testdb.local`) | `local`               | `shared`         | Synthetic                    |
| Beta        | `beta-homeish`          | `beta`     | `homeish-testdb`                       | `staging`             | `beta`           | Synthetic only               |
| Production  | `homeish`               | `main`     | `homeish-live` (paused)                | `production`          | `shared`         | Real societies; never copied |
| Demo        | `demo-homeish` (future) | —          | `homeish-demo` (paused)                | —                     | —                | Synthetic, resettable        |

Rules that never change:

- Beta never connects to `homeish-live`, and production data is never copied to
  testdb, a laptop or a backup outside the approved off-site copy.
- `scripts/with-env.mjs` refuses the `live` profile on a laptop. Production
  commands run only from an approved operator session.
- Feature branches deploy nowhere. `vercel.json` enables only `main` and `beta`,
  and `scripts/vercel-ignore-build.mjs` makes each project build only its own
  branch.

## 2. Release pipeline

1. **Feature branch.** Work happens on a feature branch. Before pushing, run the
   full local gate on its head:

   ```powershell
   npm run check
   npm run test:integration:local
   npm run build
   npx playwright test
   ```

   Stop the local testdb dev server first and load `.env.example` values for
   Playwright, as CI does (`cp .env.example .env.local`). Feature-branch pushes
   do not run CI.

2. **Beta.** Fast-forward local `beta` to `origin/beta`, merge the feature branch
   with `--no-ff`, and push. GitHub Actions runs CI (checks, database, e2e) and
   CodeQL, and Vercel builds `beta-homeish` at the same time. Vercel does not
   wait for CI, so treat a beta release as accepted only when CI and CodeQL are
   green **and** the beta checks in Section 6 pass.
3. **Database changes for beta** are applied to `homeish-testdb` before or with
   the beta push (Section 3).
4. **Production.** Merge verified `beta` into `main` with `--no-ff`
   (`chore(release): merge verified beta into main`) and push. Vercel builds
   `homeish`. Production migrations are applied first (Section 3).
5. Nothing is committed, pushed or merged, and no hosted migration is applied,
   without the owner's approval (AGENTS.md).

## 3. Database migrations

Migrations live in `supabase/migrations`, are forward-only, and are never edited
after they reach a hosted project (DATABASE Section 14).

| Step | testdb (beta)                                                            | homeish-live (production)                                      |
| ---- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1    | Pass `npm run test:integration:local` (every migration on PostgreSQL 17) | Same commit already applied to testdb and verified on beta     |
| 2    | `npm run db:list` to see pending migrations                              | Take a fresh backup and confirm the last nightly off-site copy |
| 3    | `npm run db:push` (add `-- --yes` only in agent mode, after approval)    | Apply from the approved operator session with the live profile |
| 4    | Deploy the app (push `beta`)                                             | Deploy the app (push `main`)                                   |
| 5    | `npm run db:types:check` stays clean                                     | `npm run integrity:check` against live; check `/api/health`    |

Order matters: **migrate first, then deploy code.** Every migration must keep
the previous app build working (expand/contract): add tables, columns and new
function parameters with defaults first; remove old ones only in a later
release once no running build uses them.

## 4. Rollback

| What went wrong            | Action                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App bug after deploy       | In Vercel, promote the previous production deployment ("Instant Rollback"). Then revert the merge on the branch and release again                                        |
| Migration bug, data intact | Write a new corrective migration; never edit or delete an applied one. Test it locally, apply to testdb, then production                                                 |
| Migration damaged data     | Suspend affected societies (OPERATIONS "Suspend a society"), restore the backup into a **new** project, compare, and repair forward. Never restore over the live project |
| Secret leaked              | Rotate it (OPERATIONS "Rotate a secret"), redeploy, and check the audit and error logs                                                                                   |

Because migrations are expand/contract, rolling the app back one release is
always safe without touching the database.

## 5. Secrets and configuration

Values live only in the Vercel project's environment settings (Production
target), GitHub Actions secrets, or ignored local profile files. Names are in
`.env.example`; never commit values. Beta and production have **separate**
values for every secret.

| Variable                                                                                                     | Beta              | Production            | Notes                                                              |
| ------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_APP_ENV`                                                                                        | `staging`         | `production`          | Controls secure cookies and production-only limits                 |
| `APP_DEPLOYMENT`, `APP_BASE_DOMAIN`                                                                          | yes               | yes                   | `beta` / `shared`; parent host for society subdomains              |
| `NEXT_PUBLIC_APP_URL`, `APP_VERSION`                                                                         | yes               | yes                   |                                                                    |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                  | testdb            | live                  | Public                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                                  | testdb            | live                  | Server only; used by the strict privileged list (ARCHITECTURE 8.4) |
| `SUPABASE_DB_URL`                                                                                            | GitHub/local only | operator session only | Never set in Vercel                                                |
| `BREVO_API_KEY`, `BREVO_DAILY_EMAIL_QUOTA`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `DEVELOPER_ALERT_EMAIL` | yes               | yes                   | Sender verified per environment                                    |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                                         | yes               | yes                   | Separate key pairs                                                 |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`                                                  | yes               | yes                   | Separate Sentry environments                                       |
| `CRON_SECRET`, `GUARD_SESSION_SECRET`, `RATE_LIMIT_HASH_SALT`                                                | yes               | yes                   | Random, at least 32 bytes each                                     |

The app validates configuration at start-up and fails fast if a value is missing
or malformed (`src/core/config`). Changing a variable needs a redeploy
(OPERATIONS "Apply hosting configuration changes").

Supabase Auth settings are not in code: email-code sign-in through Brevo SMTP,
code length 6, 10-minute expiry, and production sign-in rate limits. Record
them per project when they change.

## 6. Checks after every deploy

Beta (`https://beta-homeish.vercel.app`) or production:

1. `/api/health` returns `200`.
2. Response headers include `Content-Security-Policy` (with a nonce),
   `Strict-Transport-Security`, `X-Frame-Options: DENY` and
   `X-Content-Type-Options: nosniff`, and no `X-Powered-By`.
3. Sign in with an email code; the browser console shows no CSP violations.
4. Open one screen per enabled module.
5. Sentry shows no new errors for the release; the uptime monitor is green.
6. The next daily job run (18:30 UTC) succeeds (OPERATIONS "Health and daily
   jobs").

## 7. Production go-live checklist (P10.5–P10.8)

Do these in order. Each needs the owner; nothing here is automated.

**Before resuming production (done on testdb/beta):**

- [ ] P10.1 security review closed: no open critical or high findings.
- [ ] P10.2 accessibility: automated checks pass and the owner's TalkBack and
      VoiceOver checklist ([ACCESSIBILITY_CHECKLIST.md](ACCESSIBILITY_CHECKLIST.md)) is recorded.
- [ ] P10.3 performance at 1,500 units within budget.
- [ ] P10.4 failure drills recorded.
- [ ] P10.6 restore drill passed with clean integrity checks.
- [ ] P10.7 UAT ([UAT_SCRIPT.md](UAT_SCRIPT.md)) passed on beta for each module to be enabled.

**Production setup (P10.5):**

- [ ] Resume `homeish-live` (PostgreSQL 17; confirm its region is India, and
      set the Vercel function region to match, API APA-04). Upgrade to the paid
      plan with daily backups once the first society pays.
- [ ] Apply all migrations from the approved operator session; run
      `npm run integrity:check`.
- [ ] Configure Supabase Auth (Brevo SMTP sender, code settings, rate limits,
      site URL and redirect URLs for the production host).
- [ ] Create the developer account and enrol its authenticator.
- [ ] Set every production variable in the `homeish` Vercel project (Section 5).
      Generate new random values; never reuse beta values.
- [ ] Vercel plan per the owner's decision (Hobby for the free pilot, Pro once a
      society pays). Domain: none yet; when one is bought, attach it and verify
      the email sender domain (SPF/DKIM) with Brevo.
- [ ] Sentry production environment with the critical-error alert; uptime
      monitor on `/api/health`.
- [ ] Enable and verify the nightly off-site backup for `homeish-live`, then run
      a restore drill from it (P10.6) before the first society.
- [ ] Release `beta` to `main` and run the Section 6 checks on
      `https://homeish.vercel.app`.

**Pilot go-live (P10.8):**

- [ ] Create the pilot society with the create-society script (OPERATIONS
      "Society onboarding"), mark its host `active` in code and release it.
- [ ] Enable modules one at a time (visitor, delivery, billing, requests), each
      after its UAT passes.
- [ ] Onboard the admin; review errors daily for the first two weeks.
