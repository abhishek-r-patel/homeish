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

Beta status, 2026-11-11: UptimeRobot (Free plan) monitor `804629935` checks
`https://beta-homeish.vercel.app/api/health` every five minutes and emails the
owner. Its test notification was received, and it recorded beta's outage before
configuration and the recovery afterwards. Beta still runs the P5–P7 release,
whose health route predates the daily-job freshness check. Confirm the monitor
again after P9 is deployed.

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
issue was resolved. Beta's deployed release predates P9's severity-tag changes;
repeat the test with an application-originated critical error after P9 is
deployed.

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
3. Check that the scheduled caller still sends the configured `CRON_SECRET`.
   Rotate it in the secret store and scheduler together if it may be exposed.
4. Do not delete `job_run_keys` to force a retry. Investigate the failed task;
   the run-key is the idempotency guard, while `completed_at` records success.

## Database backups and restore

No off-site backup destination is currently configured. R2 activation was
declined because it requires usage-based billing. Its implementation is retained
but disabled: the main-branch job requires the Actions variable
`R2_BACKUPS_ENABLED=true` as well as the documented variables and secrets.
Do not enable it without an approved R2 subscription.

Once explicitly enabled and configured, the workflow creates a PostgreSQL 17
custom-format database dump each day and stores it in the private R2 bucket
under `database/`. It removes objects older than 30 days only after a successful
upload. A green workflow run is required to confirm a backup was produced.
Database dumps do not contain Supabase Storage files.

For a restore drill or recovery:

1. Create a **new, empty Supabase project** for the restore. Never restore into
   the live project or a project containing data that must be preserved.
2. Download the chosen `homeish-db-...dump` object from R2 using an authorized
   operator account. Keep the dump and connection details private.
3. Use PostgreSQL 17 client tools and restore to the new project's connection
   URL:

   ```powershell
   pg_restore --no-owner --no-privileges --dbname "$env:RESTORE_DB_URL" "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump"
   ```

   Resolve any Supabase-managed schema or extension errors before considering
   the restore successful. Do not add destructive clean/drop options.

4. Point `SUPABASE_DB_URL` at the new project for the integrity check and run
   `npm run integrity:check`. Investigate every failed check before accepting
   the restore.
5. Record restore start/end time, selected backup timestamp, target project,
   failures, and measured RTO in the restricted incident record. Remove the
   temporary connection variable when finished.

The database-only backup cannot restore photos, payment proofs, QR codes, or
logos. File-copy backups remain deferred pending an approved least-privilege
source credential. A restore with referenced files missing is not a complete
file recovery; retain the integrity report and disclose this limitation.

For a local test database configured in `.env.testdb.local`, run
`npm run integrity:check:testdb`. The checker is read-only, reports counts by
invariant, and exits nonzero if any check fails. It never repairs or deletes
data. Run it after each restore and monthly; the main-branch workflow also runs
it monthly and can be dispatched manually.

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
