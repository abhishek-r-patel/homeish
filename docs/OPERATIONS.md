# Homeish Operations Runbook

This runbook covers routine monitoring, incident response, and database recovery.
Never paste database URLs, API tokens, or backup credentials into chat or logs.

## Monitoring

### Health and daily jobs

Monitor `GET /api/health` from an external uptime service every five minutes and
alert on any non-`200` response or repeated timeout. The endpoint returns only
`{"status":"ok"}` or `{"status":"unavailable"}`. It checks database availability
and whether every expected daily task for active societies, including global
retention, completed within 36 hours. With no active societies, daily-job
freshness is not applicable.

The beta Vercel project schedules `GET /api/jobs/daily` daily at 18:30 UTC
(00:00 India Standard Time). Vercel sends the configured `CRON_SECRET` as a
bearer token. Cron Jobs use UTC and are not retried after a failed invocation;
check the Vercel function logs and developer health page after an alert. The
daily run keys make a duplicate invocation safe. Verify the configured job
after deployment with `vercel crons list --project beta-homeish --scope arp-dev`.

The health endpoint does not itself send alerts. Configure the external monitor
to notify the on-call contact. Investigate a failure in the hosting logs and the
developer health page; do not expose internal health details through the public
endpoint.

Beta status, 2026-11-13: UptimeRobot (Free plan) monitor `804629935` checks
`https://beta-homeish.vercel.app/api/health` every five minutes and emails the
owner. Its setup test notification was received, and it recorded beta's outage
before configuration and the recovery afterwards. In a separate controlled
stale-health test, the endpoint returned 503 for six minutes, then returned 200
after the original marker was restored. The owner confirmed receipt of that
test's outage/recovery email on 2026-11-13, after initially being unable to check
during a reported Outlook.com outage.
Health returned 200 and the active validation society's 2026-11-13 IST cycle
completed all six daily tasks. Two authenticated local repeats returned 200 and
skipped all six. The INR 1 test bill was generated after that cycle; its
reminder was later run directly and the resident Notifications page showed
“Society dues are overdue.” No email was sent. The request dashboard's
category-grouping error was fixed in testdb by migration `20261113060000` and
verified against the synthetic request. The guarded testdb integrity workflow
passed on 2026-11-12.

### Sentry critical-error alert

`logUnexpectedError` sends the scrubbed `severity` tag to Sentry. Configure a
Sentry issue alert for events tagged `severity:critical` and route it to the
on-call notification channel. Test the rule in staging with a controlled
critical event, confirm the alert arrives, and resolve the test issue. Do not
include request bodies, user identity, or unsanitized exception context in an
alert.

Configured 2026-11-11: issue alert `1480537` ("Homeish critical errors") fires
when an event's `severity` tag equals `critical` and emails the owner, at most
once every 60 minutes. A synthetic critical event triggered it, and the test
issue was resolved. P9's severity-tag changes are now deployed to beta.

Application-originated verification, 2026-11-13 at 12:26 IST: a one-off synthetic
task ran locally through the real `runDailyJobs` failure handler,
`logUnexpectedError`, and scrubbed Sentry adapter, using `homeish-testdb` and
staging Sentry configuration. Sentry accepted event
`a7fb195ed0c14740a66bfb22d2a4c039` with HTTP 200. Its tags were
`severity:critical`, `source:job`, and `route:/api/jobs/daily`; the scrubbed
outbound event contained no user, request, extra, breadcrumb, or context objects.
The owner confirmed the alert email arrived. The matching
[HOMEISH-4 issue](https://abhishek-patel-a0.sentry.io/issues/160792766/) was
resolved and its resolved state verified after reload. Developer Console error
`ERR-4E0BC92A93` was also verified and resolved with a drill note.

This was a local application-runner drill, not an induced failure of beta's
deployed cron endpoint. All six real job keys were unchanged. The drill used the
separate non-scheduled `core.p9_alert_drill_20261113` run key and synthetic
operational records. No settings or permissions were changed. The temporary live
test and private configuration file were removed. P9 monitoring validation is
complete.

### Email quota

Brevo quota handling sends an alert email when daily usage reaches 80% of the
configured limit. Verify the alert recipient and sender configuration during
staging checks. A quota reservation or alert-delivery failure is recorded in
safe platform logs; it does not bypass the send limit.

Beta email, 2026-11-11:

- Beta uses a Brevo **API** key named `homeish-beta`, restricted to
  Transactional email. Brevo SMTP keys (`xsmtpsib-`) are rejected by the API;
  the adapter needs an API key (`xkeysib-`). Keep Brevo's API-key IP
  restriction off, because Vercel functions have no fixed outbound IPs.
- The key expires on 2027-11-11, and Brevo also deactivates keys left unused
  for 90 days. If sends start failing with `401`, create a replacement key,
  update `BREVO_API_KEY` in `.env.testdb.local` and the `beta-homeish`
  Production environment, then rebuild beta.
- `BREVO_DAILY_EMAIL_QUOTA` is 50 on beta; the Brevo Free plan allows 300 per
  day. The quota counter lives in the shared test database, so local runs with
  `.env.testdb.local` use beta's allowance. They also send real email, because
  the adapter has no environment gate. Do not trigger emails to seeded
  synthetic users; their addresses bounce and harm sender reputation.
- The sender is a verified freemail address. Brevo sends on its behalf from a
  `brevosend.com` address, and a real test message reached the alert inbox.
  This is acceptable for beta only. Live needs its own Brevo key and a custom
  sending domain authenticated with SPF, DKIM, and DMARC.

### Daily job failure

1. Review the `Database Integrity`/daily-job and application workflow histories
   and hosting logs for the affected time.
2. Open the developer console's Platform Health and Error Logs pages. Search
   using the error reference ID where available.
   Failed daily-job tasks are logged as `critical` and trigger the configured
   Sentry alert.
3. Check that the scheduled caller still sends the configured `CRON_SECRET`.
   Rotate it in the secret store and scheduler together if it may be exposed.
4. Do not delete `job_run_keys` to force a retry. Investigate the failed task;
   the run-key is the idempotency guard, while `completed_at` records success.

## Database backups and restore

Google Drive replaces the disabled R2 implementation. The encrypted
homeish-testdb backup and disposable compatible restore drill passed in GitHub
Actions run
[43222943511](https://github.com/abhishek-r-patel/homeish/actions/runs/43222943511);
all 13 read-only integrity checks passed. This verifies the test database only,
not the future production source or full service recovery. Keep scheduled
backups disabled and do not store the Google account password.

The monthly **Database Integrity** workflow is pinned to `homeish-testdb`. It
requires the repository Actions variable `SUPABASE_TESTDB_CA_CERT`, containing
the server root certificate downloaded from that project's Database Settings.
The checker uses it as a trust root and retains `verify-full` hostname
verification.

The main-only workflow requires `GOOGLE_DRIVE_BACKUPS_ENABLED=true`, the private
app-created `GOOGLE_DRIVE_FOLDER_ID` variable, and Actions secrets
`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`,
`GOOGLE_DRIVE_REFRESH_TOKEN`, `BACKUP_ENCRYPTION_KEY`, and `SUPABASE_DB_URL`.
Keep credentials scoped to backup steps, not the application or npm installation.
Use a separate folder/configuration per database environment and verify the
approved source URL before activation; never silently repoint it to live.

Once explicitly enabled, it runs daily at 02:15 UTC. PostgreSQL 17 creates and
lists a custom-format dump before AES-256-GCM encryption. The archive is named
`homeish-db-YYYYMMDDTHHMMSSZ.dump.enc`. Only ciphertext is uploaded. Drive's
reported byte count and MD5 transport checksum must match the local archive
before retention starts; AES-GCM provides content authentication during recovery.
The script permanently deletes only matching app-marked archives in the selected
folder whose Drive creation time is strictly older than 30 days. It preserves
the new archive and unrelated files. Listing, authorization, privacy, upload,
verification, or deletion failures fail the job rather than report success.
Interrupted uploads fail without pruning; rerunning starts a new upload.

Keep the folder Restricted and monitor the account's free 15 GB storage, which
is shared with its Gmail and Photos; about 30 daily archives must fit. GitHub
Actions failure notifications must reach the operator; a skipped job is not a
backup. GitHub disables schedules in this public repository after 60 days
without repository activity; confirm the workflow remains enabled.
The runner's plaintext dump and temporary encrypted file are cleaned up. Do not
upload database dumps as GitHub artifacts. These dumps do not contain Supabase
Storage files.

The scheduled job remains disabled (`GOOGLE_DRIVE_BACKUPS_ENABLED=false`). The
Testdb archives and any future production archives would share the current
Drive folder and marker; production retention could therefore remove expired
testdb archives. Before production activation, add an exact production-project
guard and isolate the source-specific archive retention/folder.

For an approved local check, copy `.env.backup.example` to ignored
`.env.backup.local`, populate OAuth/folder/key values securely, and run:

```powershell
node --env-file=.env.backup.local scripts/backup-google-drive.mjs check
```

This backup profile is separate from application profiles and is loaded
explicitly with Node, not `scripts/with-env.mjs`. If corporate policy/network
blocks Google APIs, use an approved runner: dispatching **Off-site Database
Backup** manually runs the `verify-configuration` job, which performs only this
check with the repository secrets (no database access or upload). Dispatching
it on `feature-build-1` also enables a test-only backup job, which requires
`SUPABASE_TESTDB_URL`, verifies the `homeish-testdb` project reference, and
never prunes Drive files. Its `manual-restore-drill` follow-up downloads that
exact archive from Drive, verifies its size/checksum, authenticates/decrypts it,
and restores all archived schemas into a new disposable database on the runner.
The installed Supabase CLI supplies compatible PostgreSQL 17 and native
extensions such as Supabase Vault; plain PostgreSQL without those extensions
cannot certify a complete restore. The drill runs the read-only integrity checks
and always removes the disposable database, dump, and private diagnostic files.
It never uses a hosted restore-target credential or publishes database artifacts.
Do not disable TLS verification or bypass corporate access restrictions.
Retain an offline recovery copy of the encryption key separately from Drive.
On key rotation, retain old keys until every archive encrypted with them has
expired, with a private record of the key's applicable backup dates.

For a restore drill or recovery:

1. Use the approved disposable runner drill above, or create a **new, empty
   Supabase project** for manual recovery. Never restore into the live project
   or a project containing data that must be preserved.
2. Download the chosen `homeish-db-...dump.enc` archive from the private Drive
   folder using the authorized backup account. Obtain its recovery key from
   the separate secure store and populate `BACKUP_ENCRYPTION_KEY` in the
   ignored backup profile. Authenticate/decrypt to a new, unused local path:

   ```powershell
   node --env-file=.env.backup.local scripts/backup-google-drive.mjs download-database "homeish-db-YYYYMMDDTHHMMSSZ.dump.enc" "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump.enc"
   node --env-file=.env.backup.local scripts/backup-google-drive.mjs decrypt-database "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump.enc" "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump"
   pg_restore --list "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump"
   ```

   A wrong key, tampered/truncated archive, or existing output file fails without
   publishing plaintext. Keep the decrypted dump and connection details private.

3. Use PostgreSQL 17 client tools and restore to the new project's connection
   URL:

   ```powershell
   pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --dbname "$env:RESTORE_DB_URL" "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump"
   ```

   Resolve any Supabase-managed schema or extension errors before considering
   the restore successful. Do not skip schemas or add destructive clean/drop
   options. Vault secrets require their project-bound encryption-key recovery;
   the disposable drill fails if restored `vault.secrets` is nonempty rather
   than claiming those secrets are recoverable with an unrelated local key.

4. Point `SUPABASE_DB_URL` at the new project for the integrity check and run
   `npm run integrity:check`. Investigate every failed check before accepting
   the restore.
5. Record restore start/end time, selected backup timestamp, target project,
   failures, and measured RTO in the restricted incident record. Remove the
   temporary connection variable and decrypted local dump when finished.

The dump intentionally omits owner/ACL settings; the drill verifies the archived
schema and data, not reconstruction of role attributes, grants, or hosted service
configuration. Those must be reapplied and verified before service recovery.
The database-only backup cannot restore photos, payment proofs, QR codes, or
logos. File-copy backups remain deferred pending an approved least-privilege
source credential. A restore with referenced files missing is not a complete
file recovery; retain the integrity report and disclose this limitation.

For a local test database configured in `.env.testdb.local`, run
`npm run integrity:check:testdb`. The checker is read-only, reports counts by
invariant, and exits nonzero if any check fails. It never repairs or deletes
data. Run it after each restore and monthly; the main-branch workflow checks
only the guarded `homeish-testdb` project monthly and can be dispatched
manually. Guarded manual run
[43268107270](https://github.com/abhishek-r-patel/homeish/actions/runs/43268107270)
passed on 2026-11-12.

### Restore drill results (P10.6)

2026-11-13, local, from a `homeish-testdb` dump (latest migration
`20261114060000`):

- **Method:** the schema was rebuilt from the repository migrations on a
  disposable PostgreSQL 17 with the Supabase stub. Then `public` and `private`
  data were restored with
  `pg_restore --data-only --single-transaction --exit-on-error`, and
  `auth.users` was loaded through a staging table. `storage.objects` was empty.
- **Result:** row counts matched the source on all 38 `public`/`private` tables
  and all 13 integrity checks passed. The restore took about 19 s end to end.
- **Limit:** Docker is not available on the laptop, so the full encrypted-archive
  restore into a Supabase-compatible stack is covered by the guarded GitHub
  Actions drill (run 43268107270) instead.
- The dump and restored database were deleted afterwards.

## Society onboarding

A real society gets its own host, `<slug>.<APP_BASE_DOMAIN>`, on the shared
`homeish` deployment (PRD D-34). Beta never serves society hosts. Onboarding has
two halves, and the host opens only when both are done:

1. **Database:** the society row with the matching `slug`, plus an invited
   first admin. `scripts/create-society.mjs` creates them.
2. **Code:** an `active` entry in `src/core/config/societies.ts`, released
   through beta → main. Until then the host shows the "not open yet"
   placeholder, and every other path returns 404.

An `active` host serves sign-in and the app, but never the developer console.
Its `/` page shows sign-in only when the database society with that slug exists
and is not archived. Otherwise the placeholder stays up. The hostname never
grants access: membership and RLS still decide what a user sees.

**How the script works.** It signs in with your own developer account in the
same way as the Developer Console: password, then authenticator code, then
`record_developer_mfa`. It then calls the developer RPCs that the console uses,
so the same checks and audit records apply: `developer.societies.create`,
`developer.societies.setSlug` and `developer.members.createFirstAdmin`, all
under one request ID. It needs only the public Supabase URL and anon key from
the profile. It never uses the service-role key or `SUPABASE_DB_URL`. It is
safe to run again: it reuses a society that already has the slug and an admin
that has already been invited. It stops instead of creating a duplicate when a
society with the same name exists without a slug (adopt that society with
`--society-id <uuid>`), or when a different admin already exists. Every optional
module stays disabled; only `core` is on.

**Prerequisites.** Migration `20261114090000_core_society_slugs.sql` must be
applied to the target project. You need a developer account with an enrolled
authenticator (sign in to the Developer Console once to enrol it), an
interactive terminal, and the society's name, street address, city and
first-admin email.

**Steps.**

1. Rehearse on testdb. The script prints the plan and writes nothing unless you
   pass `--apply`:

   ```powershell
   npm run society:create -- --slug oak-grove --name "Oak Grove" `
     --address "12 Example Road" --city Pune --admin-email admin@example.test `
     --developer-email you@example.test
   ```

   Optional flags: `--contact-email`, `--contact-phone`, `--timezone` (default
   `Asia/Kolkata`), `--currency` (default `INR`), `--unit-label` (default
   `Unit`), `--plan` and `--society-id`. Run with `--help` to list them. Slugs
   are 1–63 lowercase letters, digits or hyphens. `www`, `demo`, `beta`,
   `admin` and `api` are reserved. A slug cannot be changed once it is set.

2. Add `--apply` and enter your password and authenticator code when prompted.
   Check the printed summary: society created, reused or adopted; admin invited
   or reused; enabled modules `core`. If anything is unclear, open Developer
   Console → Audit and filter by the printed request ID.
3. For production, run the same command through the production profile on an
   approved operator host, with `--confirm-live` added. `scripts/with-env.mjs`
   refuses the `live` profile on a laptop (AD-14). The script also refuses any
   homeish-live target that lacks `--confirm-live`.
4. Make the code change that the script prints. Add the entry, or change an
   existing reserved entry such as Maplewood from `status: 'disabled'` to
   `status: 'active'`. In the `homeish` Vercel project, confirm that the host
   is attached as a domain, the same way the `demo` host is. Release through
   beta → main as described in the commit and release workflow in `AGENTS.md`.
5. After the main deployment, open `https://<slug>.<APP_BASE_DOMAIN>/` and check
   that it shows the society name and **Sign in**. The first admin signs in with
   an email code on that host and continues the onboarding journey: blocks and
   units, guards, then residents (PRD §5 flow 1).
6. Enable modules one at a time in Developer Console → Modules, each after it
   passes UAT (IMPLEMENTATION_PLAN P10.8). Move the society from `trial` to
   `active` there when the owner agrees.

To close a host again, set the code entry back to `disabled`, or suspend or
archive the society in the Developer Console. An archived society's host falls
back to the placeholder.

## Incidents and administrative actions

### Find an error by reference ID

Open Developer Console → Error Logs, search by the user-facing reference ID,
and review the scrubbed message, route, severity, and request ID. Use the
hosting/Sentry logs to correlate the request ID. Do not request or copy
unscrubbed payloads.

### Suspend a society or disable a module

Use the corresponding Developer Console action and provide the required reason.
Confirm the resulting status in the console and audit history. Do not update
production rows manually.

### Rotate a secret

Rotate the secret with its provider, update every consuming secret store and
scheduled caller in the same maintenance window, then run a safe connectivity
check. For `CRON_SECRET`, update both the application environment and scheduler.
Do not include secret values in incident records.

For Web Push, generate a new VAPID pair with the `web-push` library and replace
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` together in the local
environment file and the hosting project. Rebuild without the build cache,
because the public key is compiled into browser code. Subscriptions created with
the old key stop receiving pushes; affected users must turn notifications off
and on again. The beta pair was last rotated on 2026-11-11, when no
subscriptions existed.

### Apply hosting configuration changes

`beta-homeish` uses the shared `homeish-testdb` project. Its Production target
sets `NEXT_PUBLIC_APP_ENV=staging`, and Preview sets `preview`. The Brevo,
sender, developer-alert, Sentry, and `CRON_SECRET` variables are Production
only. Private values are Vercel Secret variables, which cannot be read back;
verify them by their effect. Never add `SUPABASE_DB_URL` to a hosting project.

Environment changes apply only to new deployments. To apply them without
publishing code, rebuild the current Production deployment without the build
cache:

- Dashboard: Deployments → current Production deployment → Redeploy, with
  "Use existing Build Cache" cleared. Vercel may require emailed identity
  verification.
- CLI: add `VERCEL_FORCE_NO_BUILD_CACHE=1` to Production, run
  `vercel redeploy <current-production-deployment-url>`, confirm "Skipping build
  cache" in the build log, then remove the variable.

Never use `vercel deploy` for this; it uploads the local working tree, including
uncommitted changes. Afterwards, confirm `/api/health` returns `200`.

### Repair inconsistent data

Do not edit append-only billing, audit, payment, visitor, or delivery history
directly. Use the approved adjustment, waiver, reversal, or a reviewed migration
and record the reason in the audit trail.

## Performance at target scale (P10.3)

`tests/integration/performance-scale.test.ts` seeds a disposable database at
target scale and times the app's list, dashboard, report, bill generation and
daily-job queries as the signed-in role. Each read runs 20 times (past
PostgreSQL's switch to generic plans after five calls). The test fails if a
read's p95 exceeds 500 ms (NFR-2), bill generation for 1,500 units exceeds 10 s,
or a daily job exceeds 30 s. Measured on a Windows laptop with PostgreSQL 17.

Data: society 1 has 1,500 units in 10 blocks, 3,000 residents, 10 guards and 5
supervisors; society 2 has 50 units. Activity: 305,000 visitors, 102,000
deliveries, 12 months of bills for 1,500 units (about 18,500 bills with lines,
ledger, payments and allocations; the current month is generated through the
RPC), 20,500 service requests with events and comments, 205,000 notifications,
200,000 audit logs and 50,000 error logs.

Operations that were too slow before the fix (before = median of 5 runs;
after = median / p95 of 20 runs):

| Operation (role)                        | Before    | After median / p95 |
| --------------------------------------- | --------- | ------------------ |
| `request_list` default (admin)          | 200 ms    | 22 / 29 ms         |
| `request_list` by category (admin)      | 878 ms    | 7 / 9 ms           |
| `request_list` page 20 (admin)          | 7,075 ms  | 21 / 32 ms         |
| `request_list` by assignee (admin)      | 1,168 ms  | 8 / 11 ms          |
| `request_list` sort by votes (admin)    | n/a       | 74 / 81 ms         |
| `request_list` default (resident)       | n/a       | 12 / 17 ms         |
| `billing_bills_list` 25 rows (admin)    | 152 ms    | 19 / 21 ms         |
| `billing_bills_list` page 400 (admin)   | 179 ms    | 45 / 53 ms         |
| `billing_payments_list` 25 rows (admin) | 319 ms    | 18 / 30 ms         |
| `billing_bills_list` (resident)         | 558 ms    | 2 / 2 ms           |
| `billing_payments_list` (resident)      | 585 ms    | 2 / 3 ms           |
| `error_logs` page 1 + exact count (dev) | 1,788 ms  | 5 / 5 ms           |
| `error_logs` society + severity + count | 457 ms    | 7 / 10 ms          |
| `audit_logs` page 1 + exact count (dev) | 10,889 ms | 28 / 31 ms         |
| `audit_logs` society + count (dev)      | 8,285 ms  | 20 / 25 ms         |

Everything else was already fast and is unchanged: gate lists (visitors and
deliveries) 1–60 ms p95, directory and unit lists under 50 ms, billing and
request dashboards and 12-month report exports under 100 ms, notifications under
2 ms. Bill preview plus generation for 1,500 units takes about 2.4 s (limit 2
minutes). Daily jobs take under 2 s each on first run and under 250 ms after.

Causes and fix (`20261114100000_core_perf_list_queries.sql`). No indexes were
added; every slow plan already used the right indexes.

- The list functions called role helpers (`has_role`, `occupies_unit`) once per
  row. These are `SECURITY DEFINER`, so PostgreSQL can't inline or cache them.
  The role checks now run once into variables. Resident rows are first narrowed
  to the caller's units (`private.current_user_unit_ids`) before the per-row
  `occupies_unit` check, which still applies.
- After five calls, `request_list` switched to a generic plan that expected one
  row and repeated full scans of units and profiles for each request. Unit and
  name joins (and payment allocation totals) now run only on the returned page.
- The `error_logs` and `audit_logs` read policies called `is_developer()` per
  row, which made exact counts slow. They now use `(SELECT
private.is_developer())`, which runs once per query.

Results, checks and permissions are unchanged; the integration suite covers
them. Follow-up: an admin audit-log viewer (D-06) would still check
`has_role(society_id, …)` per row; filter by `society_id` first and check
the role once when it is built.

Rerun (about 6–8 minutes, mostly seeding) on a disposable PostgreSQL, never a
hosted one:

```powershell
$env:INTEGRATION_DATABASE_URL = "postgres://supabase_admin@127.0.0.1:54329/postgres"
$env:PERF_SCALE = "1"   # add $env:PERF_EXPLAIN = "1" to log plans of slow queries
npx vitest run --config vitest.integration.config.ts --silent=false tests/integration/performance-scale.test.ts
```

Without `PERF_SCALE=1` the file is skipped, so `npm run test:integration:local`
stays fast. Rerun it after changing a list, dashboard or report function.

## Security re-check (P10.1)

Done 2026-11-13 on `feature-build-1`. Beta gets the new headers when this work
is deployed.

- **Headers:** every response carries a nonce-based Content Security Policy
  (`script-src 'self' 'strict-dynamic'`, `frame-ancestors 'none'`,
  `object-src 'none'`), HSTS (two years, subdomains), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and
  `Permissions-Policy` (`src/core/security/headers.ts`, `src/proxy.ts`). The
  end-to-end tests fail on any CSP violation (`tests/e2e/fixtures.ts`).
- **Cookies:** Supabase session cookies are `Secure` outside local development
  and `SameSite=Lax` (`src/core/db/auth-cookie-options.ts`).
- **Tenant isolation:** `tests/integration/database-cross-society.test.ts`
  calls every society-scoped RPC as an admin of another society and expects a
  refusal.
- **Dependencies:** `npm audit --omit=dev` reports 0 vulnerabilities. The
  moderate `minimatch` advisory affects development tooling only and is an
  accepted residual.
- **Secrets:** gitleaks reports no findings in files that can be committed;
  local `.env.*.local` profiles stay git-ignored.
- **Low findings fixed:**
  - Gate codes now come from a cryptographic random source with rejection
    sampling (`20261114060000_visitor_secure_gate_codes.sql`).
  - CSV exports neutralise cells starting with `=`, `+`, `-`, `@`, tab or
    carriage return.
  - HSTS was added.
  - Payment QR paths were already restricted by a database constraint.

## Failure drills (P10.4)

Each behaviour documented in API.md Section 14.2 was checked on 2026-11-13.

| Failure                          | Method                                                                                           | Result                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database and Auth unreachable    | Local dev server with the testdb profile and `NEXT_PUBLIC_SUPABASE_URL` pointed at a closed port | Health returns 503. Pages show "Something went wrong" with a reference ID. Sign-in shows "A connected service is temporarily unavailable". The session cookie is kept. |
| Duplicate submissions            | `tests/integration/failure-drills.test.ts` races two identical creates on real PostgreSQL        | One visitor, delivery or request row is stored; the app retries the losing call once and returns the original entry                                                    |
| Concurrent decisions             | Same file races two visitor decisions and two delivery responses                                 | The first wins; the second gets `already_decided`                                                                                                                      |
| Scheduler missed a day           | P9 stale-marker test on testdb                                                                   | Health returned 503 after 36 hours and recovered when the marker was restored                                                                                          |
| Email and push failures          | Unit tests for timeouts, quota, retry and pruning                                                | Failures are logged; the in-app record remains                                                                                                                         |
| Unexpected exception and logging | Unit tests and the outage drill (`/api/client-errors` still returned a reference ID)             | Scrubbed, logged with a reference ID; a failed log write never raises a new error                                                                                      |
| Realtime down                    | Code review of the visitor and delivery refresh components (no automated test)                   | Pages refresh every 5 s regardless of Realtime; the gate banner says to call the resident                                                                              |

Fixes made during the drills:

- The root layout's font-preference lookup no longer takes every page down to
  the bare Next.js fallback when Supabase is unreachable; it falls back to the
  default fonts and logs a warning.
- The proxy no longer throws when a session refresh fails for a reason other
  than an invalid session. The page then reports the failure with a reference
  ID, and the session cookies are kept.
- Sign-in limits that fail closed while their store is unavailable now report
  `INTEGRATION_FAILED` instead of a misleading "Too many attempts".
- Duplicate creates now return the original entry instead of "already decided"
  (`src/core/db/retry-on-duplicate.ts`).
- The guard offline banner now says to call the resident, and the visitor and
  delivery forms show the reference ID when an action fails.

Known limitation: with an expired access token during an outage, Supabase's
client retries the session refresh with backoff, so a signed-in page can take
about 25 s before showing the error page. Not drilled: whether a guard's
partly typed entry stays on screen across a failed submit; check it in UAT.
