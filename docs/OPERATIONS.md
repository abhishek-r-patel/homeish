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

Google Drive replaces the disabled R2 implementation. Owner authorization is
pending; no off-site backup has been produced or restore-tested. Follow the
[phone-friendly Google API setup guide](GOOGLE_DRIVE_BACKUP_SETUP.md). Do not
store the Google account password or enable the workflow before verification.

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
never prunes Drive files. Do not disable TLS verification.
Retain an offline recovery copy of the encryption key separately from Drive.
On key rotation, retain old keys until every archive encrypted with them has
expired, with a private record of the key's applicable backup dates.

For a restore drill or recovery:

1. Create a **new, empty Supabase project** for the restore. Never restore into
   the live project or a project containing data that must be preserved.
2. Download the chosen `homeish-db-...dump.enc` archive from the private Drive
   folder using the authorized backup account. Obtain its recovery key from
   the separate secure store and populate `BACKUP_ENCRYPTION_KEY` in the
   ignored backup profile. Authenticate/decrypt to a new, unused local path:

   ```powershell
   node --env-file=.env.backup.local scripts/backup-google-drive.mjs decrypt-database "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump.enc" "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump"
   pg_restore --list "C:\secure\path\homeish-db-YYYYMMDDTHHMMSSZ.dump"
   ```

   A wrong key, tampered/truncated archive, or existing output file fails without
   publishing plaintext. Keep the decrypted dump and connection details private.
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
   temporary connection variable and decrypted local dump when finished.

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
