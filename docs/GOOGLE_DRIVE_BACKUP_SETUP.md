# Google Drive backup setup - owner steps from a phone

This guide covers the Google steps that require your involvement. Use your
dedicated backup Google account. No Google password belongs in Homeish, an
environment file, GitHub, or this chat.

Open these pages on your phone's browser. If a console panel does not fit, use
landscape orientation or your browser's **Desktop site** option. Use a personal
device/network only where company policy permits this backup destination; do
not bypass the corporate laptop's restrictions.

**Status:** Google Drive support replaces the disabled R2 implementation.
No Drive backup is operational until credentials are configured, an encrypted
backup is verified, and a restore drill passes. Publishing this guide on
`feature-build-1` does not enable scheduled backups or change `beta`/`main`.

## What you will do

- Create a Google Cloud project and enable the Drive API
- Configure your own OAuth app with access only to files it creates
- Approve that app using Google's official OAuth Playground
- Create the app's private backup folder and save credentials in GitHub secrets
- Leave automatic backups disabled for the remaining verification

Keep a password manager open for temporary secure storage. Do not copy secret
values into repository files, issues, screenshots, email, or chat messages.

## Cost: free tier only

Backups go into the backup account's normal Google Drive (**My Drive**) and use
its free 15 GB storage. That storage is shared with the account's Gmail and
Google Photos, so keep those unused. The Cloud project only registers your free
OAuth app. This setup does not use Google Cloud Storage, Google Workspace,
Google One, a service account, or a shared drive.

- Do not add a billing account or card, start a Google Cloud free trial, or buy
  storage. Nothing in this guide needs them.
- Google lists standard Drive API use at no additional cost. A daily backup
  makes about seven Drive API calls (under 300 quota units), far below Google's
  daily billing threshold of 400,000,000 quota units per project.
- `drive.file` is a non-sensitive scope. Full Drive access is restricted and
  requires additional Google verification, including a security assessment.
- Expired backups are permanently deleted, not moved to Trash. About 30 daily
  encrypted backups are kept.
- The backup job runs on GitHub Actions standard runners, which are free for
  this public repository.

## 1. Sign in to the backup account

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select the dedicated backup account, not your personal primary account.
3. Configure two-step verification and recovery options for that account.
4. Accept Google's terms if prompted.

If Google Cloud offers a free trial or asks for billing or card details, close
or skip it; this setup does not need them. If a required step cannot continue
without billing, stop and report that step number.

## 2. Create the Cloud project

1. Tap the project selector at the top.
2. Choose **New project**.
3. Name it **Homeish Offsite Backup**.
4. Create it, then select that new project.

Keep this project dedicated to backups. Do not create a service account or
download a service-account key: this setup uses your Drive account through OAuth.

## 3. Enable the Google Drive API

1. Open [Google Drive API in the API Library](https://console.cloud.google.com/apis/library/drive.googleapis.com).
2. Confirm **Homeish Offsite Backup** is the selected project.
3. Tap **Enable**.

If it already says **Manage**, the API is enabled.

## 4. Configure the OAuth app

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview).
2. If shown, choose **Get started**.
3. Set the app name to **Homeish Offsite Backup**.
4. Set the support email and developer/contact email to the backup account's
   email address.
5. Choose **External** audience for a normal personal Google account.
6. Complete the required contact/consent fields and create the app.

Menu names can vary: the relevant panels are **Branding**, **Audience**,
**Data Access**, and **Clients**. Do not add a logo or unrelated permissions.

## 5. Add only the per-file Drive permission

1. Open **Data Access** and choose **Add or remove scopes**.
2. Find or manually enter this exact scope:

   ```text
   https://www.googleapis.com/auth/drive.file
   ```

3. Save/update the scope selection.
4. Do not add full Drive access (`.../auth/drive`), Gmail, or other scopes.

`drive.file` allows this app to manage files it creates or files explicitly
opened with it. It does not grant access to every file in the account.

## 6. Change the app from Testing to Production

1. Open **Audience**.
2. Under publishing status, choose **Publish app** / **In production** and
   confirm, after checking that only the scope above is configured.
3. Verify that the publishing status is **In production**.

**Do this before generating the refresh token.** For an external app in Testing,
Google normally expires a Drive refresh token after **7 days**. That is not
suitable for unattended backups.

Production status is not permission to open this app to other users. Keep it
for this dedicated account. Verification requirements depend on Google's
configuration/policies; if verification is required or authorization is blocked,
stop and report the non-secret error text. Do not request broader scopes to get
around a warning.

## 7. Create your own OAuth client

1. Open **Clients**, then **Create client**.
2. Choose **Web application**.
3. Name it **Homeish Backup Automation**.
4. Under **Authorized redirect URIs**, add this exact URL:

   ```text
   https://developers.google.com/oauthplayground
   ```

5. Leave authorized JavaScript origins empty unless Google explicitly requires
   one for a documented reason.
6. Create the client.
7. Save its **Client ID** and **Client secret** privately in your password
   manager. Google may show the secret only when it is created.

The client ID usually ends in `.apps.googleusercontent.com`. Keep using this
same client for authorization, folder creation, and backups.

## 8. Approve access and obtain the refresh token

1. Open [Google's OAuth Playground](https://developers.google.com/oauthplayground/).
2. Open the gear/settings panel.
3. Enable **Use your own OAuth credentials**.
4. Enter your own Client ID and Client secret from step 7.
5. Use the **Server-side** flow and **Offline** access type. If a consent/prompt
   option is offered, choose **Consent** so Google can issue a refresh token.
6. Close settings.
7. In **Step 1**, enter this under **Input your own scopes**:

   ```text
   https://www.googleapis.com/auth/drive.file
   ```

8. Tap **Authorize APIs**, select the dedicated backup account, and approve
   the file permission for **your own** Homeish app. If the account, app, or
   requested permission is different, stop.
9. Back in the Playground's **Step 2**, tap
   **Exchange authorization code for tokens**.
10. Save the **Refresh token** privately in your password manager.

Use the refresh token, not the access token or authorization code. The access
token is short-lived; automation uses the refresh token to obtain new ones.
Do not press **Revoke token** after setup.

**Important:** the Playground revokes tokens created with its default shared
client after 24 hours. **Use your own OAuth credentials** must be enabled.
Combined with step 6, this avoids the default 24-hour/7-day setup traps.
Tokens can still be revoked or expire later; authorization failures must be
treated as failed backups.

## 9. Create the private folder using the same OAuth app

Do not only create a folder in the Drive UI: `drive.file` does not automatically
make such a folder accessible to this app.

In the Playground, keep the same app credentials and authorized token:

1. Expand **Step 3 - Configure request to API**.
2. Set **HTTP Method** to **POST**.
3. Enter this **Request URI**:

   ```text
   https://www.googleapis.com/drive/v3/files?fields=id,name
   ```

4. Set **Content-Type** to `application/json`.
5. Open **Enter request body** and paste:

   ```json
   {
     "name": "Homeish database backups",
     "mimeType": "application/vnd.google-apps.folder",
     "appProperties": {
       "homeishBackup": "database-folder-v1"
     }
   }
   ```

6. Send the request once. A successful response contains an `id` and `name`.
7. Save the folder's `id`. Do not repeat the POST after it succeeds; that would
   create another folder.
8. Open [Google Drive](https://drive.google.com/) and confirm the folder exists.
   Keep it **Restricted**, owned by this account, with no sharing or public link.

The script checks folder ownership, privacy, write capability, and the marker
above. It refuses to upload or prune if these checks fail.

## 10. Store the OAuth credentials in GitHub, not in code

On your phone, open
[Homeish Actions secrets](https://github.com/abhishek-r-patel/homeish/settings/secrets/actions).
You must be signed into the repository owner's GitHub account.

Under **Secrets**, add these **Repository secrets** one at a time:

| Secret name                  | Value                         |
| ---------------------------- | ----------------------------- |
| `GOOGLE_DRIVE_CLIENT_ID`     | Your own Client ID            |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Your own Client secret        |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | The refresh token from step 8 |

Under **Variables**, add these **Repository variables**:

| Variable name                  | Value                 |
| ------------------------------ | --------------------- |
| `GOOGLE_DRIVE_FOLDER_ID`       | Folder ID from step 9 |
| `GOOGLE_DRIVE_BACKUPS_ENABLED` | `false`               |

**Leave the enable variable false.** GitHub secret values cannot be read back
after saving. Keep the originals in your password manager for controlled
rotation/recovery; report only that the names were saved, not their values.

Do not change `SUPABASE_DB_URL` or connect `homeish-live` during these steps.
The source database must be verified separately before any backup run.

## 11. Stop here and hand back

Tell me only **"Google setup complete; GitHub secrets and folder variable saved"**,
or the step number and a redacted error message.

I can take over the remaining implementation/verification, subject to the
normal commit, release, and hosted-database approvals:

1. Generate a cryptographically random encryption key and provision it as the
   Actions secret `BACKUP_ENCRYPTION_KEY` through an approved secure mechanism.
   You must keep a separate offline/password-manager recovery copy. Do not
   store it in Drive with the backups; losing it makes the archives unusable.
2. Verify OAuth and folder access from an approved runner. If Google APIs are
   blocked on the corporate laptop, use an approved runner, not a bypass.
3. Verify the source is the intended non-production database for the first
   test; produce an encrypted backup and verify its remote size/checksum.
4. Download and authenticate/decrypt it; restore to a **new, empty** approved
   target and run the integrity checks.
5. Verify failure notifications and storage capacity, then separately approve
   activation and the normal release to `main`.

The scheduled workflow stays **main-only** and opt-in. Feature-branch publication
does not activate it. A GitHub secret cannot be retrieved for local execution;
if a local check is necessary, provision the same values through a separately
approved secure channel into ignored `.env.backup.local`, using
[the backup-only template](../.env.backup.example). Never send them through chat.

## Troubleshooting

| Symptom                             | Check                                                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch`             | Client type is Web application; the redirect URI exactly matches step 7, without an extra trailing slash                                                    |
| No refresh token                    | Own client selected, Offline access and Consent prompt selected; repeat authorization without revoking a working token until its replacement is provisioned |
| Works briefly, then `invalid_grant` | Default Playground client (24 hours), Testing status (7 days), revoked access, or expired consent; fix the setup and replace the refresh-token secret       |
| Folder inaccessible / HTTP 404      | Correct folder ID and same OAuth client; folder created through step 9, not only the Drive UI                                                               |
| Folder privacy check fails          | Folder is Restricted, untrashed, owned by this account, has the exact marker, and permits new files                                                         |
| Upload quota/storage error          | Check the account's 15 GB usage across Drive, Gmail and Photos, and API quotas; do not broaden permissions or silently skip the backup                      |
| No scheduled run                    | Released to `main`, enabled, and configured; GitHub disables public-repo schedules after 60 days without repository activity; skipped jobs are not backups  |

## Official references

- [Drive API scopes, including `drive.file`](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google OAuth refresh-token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)
- [OAuth Playground, including its own-client setting](https://developers.google.com/oauthplayground/)
- [Operational backup and restore runbook](OPERATIONS.md#database-backups-and-restore)
