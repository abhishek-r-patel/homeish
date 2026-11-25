# Homeish — Local Setup (LOCAL_SETUP.md)

Step-by-step setup for a Windows development machine. Docker Desktop cannot be installed, so the app does not use a local Supabase stack. Development and staging/beta share the synthetic-only cloud project `homeish-testdb` (ARCHITECTURE AD-13, AD-14). Automated database integration tests instead use disposable local PostgreSQL 17 with portable server tools, without Docker or hosted credentials (Section 6).

## 1. Tools

- Node.js 26.13.1 and npm (see README and `.nvmrc`).
- The Supabase CLI is a project development dependency (`supabase` in `package.json`); it is installed by `npm ci`. Do not install it globally.

```powershell
npm ci
```

After an approved CLI update, check the installed project version and validate the local configuration:

```powershell
npx --no-install supabase --version
npx --no-install supabase config validate
```

Without `--resolve-env`, configuration validation does not read environment secrets or contact hosted resources. It does not apply the local configuration to testdb or live.

## 2. Network certificates (company networks)

Some company networks inspect secure web traffic with their own certificate. Windows trusts it, but Node.js does not by default, so the Supabase CLI fails with `Transport error` or `SELF_SIGNED_CERT_IN_CHAIN`. The project's database commands (`npm run db:*`) already tell Node to also trust the Windows certificate store. For any other direct CLI call in the same window, set:

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
```

Direct PostgreSQL integrity checks also require Supabase's server root
certificate in `SUPABASE_DB_CA_CERT`; system CA trust alone is not a
substitute. Keep `verify-full` enabled.

## 3. Supabase projects

| Project          | Ref                    | Use                                                       | State  |
| ---------------- | ---------------------- | --------------------------------------------------------- | ------ |
| `homeish-testdb` | `oqyagsabodaueghtrocv` | Development, manual Auth checks, staging/beta (synthetic) | Active |
| `homeish-demo`   | `iauusmylbymplqtheinp` | Synthetic showcase data only; planned public demo (P61)   | Paused |
| `homeish-live`   | `yhwadldjeyirkgbmoctb` | All onboarded societies — real data; changes only via CI  | Paused |

All are in South Asia (Mumbai). Paused projects must be resumed before 14 Dec 2027 (AD-14).

## 4. Sign the CLI in and link testdb (once per machine)

1. In the Supabase dashboard, open **Account → Access tokens** and create a token limited to `homeish-testdb` with a short expiry.
2. Sign in and link (the token is stored in Windows Credential Manager, not in the project):

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
npx supabase login
npx supabase link --project-ref oqyagsabodaueghtrocv
```

The link is kept in `supabase/.temp/`, which Git ignores. Never link `homeish-live` from a laptop.

## 5. Environment profiles

Each database has its own ignored settings file: `.env.testdb.local`, `.env.demo.local`, `.env.live.local` (README, "Database-specific environment profiles"). Project addresses, keys and app secrets are filled from Supabase; set the database password without it appearing on screen:

```powershell
./scripts/set-db-password.ps1 testdb
```

`.env.live.local` is only the source for GitHub/Vercel secrets later; every project script refuses to run against live.

## 6. Database commands

**Empty database (redesign fresh start):** `npm run db:push` cannot install
every migration because the CLI does not wrap each one in a transaction. Use
`node scripts/with-env.mjs testdb node scripts/db.mjs fresh-install
--wipe-testdb` only with the owner's approval; it needs `SUPABASE_DB_CA_CERT`
set to the Supabase root certificate (the repository variable
`SUPABASE_TESTDB_CA_CERT`). See
[DEPLOYMENT Section 3](./DEPLOYMENT.md#3-database-migrations).

| Command                                                   | What it does                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run db:new -- <module>_<short_description>`          | Creates an empty, timestamped migration file in `supabase/migrations/` |
| `npm run db:list`                                         | Shows which migrations testdb has applied                              |
| `npm run db:push`                                         | Applies new migrations to testdb (add `-- --dry-run` to preview first) |
| `npm run env -- testdb node scripts/db.mjs fresh-install` | Installs all migrations on an empty testdb, one transaction each       |
| `npm run db:types`                                        | Regenerates `src/core/db/database.types.ts` from testdb                |
| `npm run db:types:check`                                  | Fails if the generated types no longer match testdb                    |
| `npm run check:migrations`                                | Checks migration file names (also part of `npm run check`)             |

Database commands load `.env.testdb.local` and run against the address in it. To target the demo project once it is resumed: `npm run env -- demo node scripts/db.mjs push`. They refuse `homeish-live` and an unset password, and hide database addresses in their output.

**Planned demo data commands (PRD D-97; IMPLEMENTATION_PLAN P61.2–P61.3; not built, names fixed at coding):**

- **Seed:** a demo seed command creates Green Meadows Residency (50 flats) and Gulmohar Apartments (30 flats).
- **Reset:** a reset command deletes and rebuilds only demo-labelled data.
- **Where they run:** both accept only a throwaway local database, `testdb` or `demo`. They refuse live or any unknown address.
- **Dry run:** both print a plan first and change data only with `--apply`.
- **Approval:** running them on testdb or demo is a hosted data change, so it needs the owner's approval each time until the scheduled reset is live.

### Database integration tests

Database tests (migrations, RLS, SQL functions) are Vitest files in `tests/integration/`. They never use testdb, demo or live: they run against a throwaway PostgreSQL 17 server on this machine and refuse any other host. For each test file the harness (`tests/integration/support/database.ts`) creates a fresh database, adds a small stand-in for Supabase's `auth` schema and roles (`supabase-stub.sql`, `roles.sql`), applies every migration in order and drops the database afterwards. Database creation is serialized, so the integration config runs at most four test files at a time to keep queued files within the test timeout. Extend the stand-in only to mirror real Supabase behaviour a migration needs; sign-in itself is verified against testdb.

Every test connection uses UTC, matching CI regardless of the machine's timezone. Fixtures for society-day rules must derive the society date; daily-job fixtures must use the Asia/Kolkata job date rather than the session's `current_date`. For timestamp validation, include a time and UTC offset: a date-only value is interpreted as UTC midnight, which can still be in the future after the society's local day has started.

Run them with the portable PostgreSQL server tools (no Docker). Set `PG_BIN` to its `bin` folder once per PowerShell window, or add that folder to `PATH`:

```powershell
$env:PG_BIN = 'C:\path\to\postgresql\bin'
npm run test:integration:local
```

The script creates a temporary server on `127.0.0.1:54329`, runs the tests, then stops the server and deletes its files. It prints numbered steps, then one line per finished test file with a counter, elapsed time and a rough time-left estimate (shown after the first four files), and ends with the total time. CI prints the same per-file lines. It stops if its own server cannot start, including when that port is already in use; it never substitutes an existing server. Without a server, `npm run test:integration` skips these tests locally; in CI a missing server is an error. GitHub Actions divides the same tests into four Vitest shards. Each shard has its own `postgres:17` service container and still runs up to four test files at a time, so no database password is stored in GitHub and failures remain independent. The unchanged `database` summary check passes only after every shard passes, preserving the branch-protection check name.

### Migration rules (DATABASE 14.1)

- Name: `YYYYMMDDHHMMSS_<module>_<short_description>.sql`, where `<module>` is a module key (`core`, `visitor`, `delivery`, `billing`, `service_request`, `staff`, `housekeeping`, `amc`, `notice`, `amenity`). `db:new` adds the timestamp.
- Forward-only: never edit a migration once it has run on testdb; fix forward with a new one.
- One concern per file; a table ships with RLS enabled, its policies and grants in the same file.
- Regenerate types from the tested schema and commit them with the migration. For ordinary releases, apply to testdb only after approval and run `npm run db:types`; the current batch follows the exception above.
- Roll-out order: testdb → demo → live; live only through approved CI.

### Email-code sign-in setup

`supabase/config.toml` disables public sign-up, requests six-digit codes that expire after ten minutes, uses a code-only email template, enables local TOTP enrollment/verification, and caps society sessions at 30 days. Developer access is separately capped at four hours per auth session and requires MFA from the previous 15 minutes. The local SMTP catcher remains enabled for local-stack use. The project does not run that stack, and these settings have not been pushed to `homeish-testdb`.

Before real email testing, verify the sender domain in Brevo and configure its SMTP credentials in the `homeish-testdb` dashboard. Hosted Auth settings have not been changed; automated tests mock delivery. A test recipient only needs to be an inbox the tester controls. Do not configure production email or share SMTP credentials in source.

### Folders

- `supabase/migrations/`: forward-only SQL.
- `supabase/seed/`: synthetic seed files (`*.sql`, configured in `supabase/config.toml`); never real people.
- `tests/integration/`: database integration tests and their harness; run with `npm run test:integration:local`.
- `supabase/config.toml`: CLI settings. It describes a local stack we do not run; hosted project settings are changed in the dashboard, never with `supabase config push`.

## 7. Optional RepoWise

RepoWise helps explore code relationships and possible test or documentation
impacts. It is an optional developer tool, not an app dependency. Version
0.61.0 uses the AGPL-3.0-or-later licence; review it before distributing the
tool. The shared [Copilot configuration](../.mcp.json) uses a separate, local,
committed-only snapshot. It never includes uncommitted Homeish changes, and its
one-commit history limits history-based suggestions. Check findings against
the current working tree and tests; never delete code solely on its reports.

The setup disables RepoWise telemetry, selects the mock provider and embedder,
excludes environment files from the index, and disables editor changes and
hooks. Model answers and the uncommitted-change risk tool are not exposed to
Copilot. The clone can still contain tracked example files and Git metadata can
contain tracked file names. Copilot can receive indexed code snippets when it
uses the tools. The offline settings are not an operating-system firewall:
RepoWise still runs with your account's permissions.

### One-time setup

Install Python 3.12 and RepoWise separately in an isolated location outside the
Homeish checkout. This downloads packages; it does not add an npm dependency.
For example, replace the paths below with your own:

```powershell
$tool = 'C:\path\outside-homeish\repowise-tool'
if (Test-Path -LiteralPath $tool) { throw 'Choose a new tool directory' }
& 'C:\path\to\python312\python.exe' -m venv $tool
if ($LASTEXITCODE -ne 0) { throw 'Could not create the virtual environment' }
& (Join-Path $tool 'Scripts\python.exe') -m pip install --only-binary=:all: 'repowise==0.61.0'
if ($LASTEXITCODE -ne 0) { throw 'Could not install RepoWise' }
```

In a dedicated PowerShell window opened in Homeish, choose two new, separate
directories outside the checkout for the snapshot and its private profile.
Do not copy your normal home directory or agent transcripts into that profile.
If you already installed version 0.61.0, point the executable setting at it:

```powershell
$env:HOMEISH_REPOWISE_EXECUTABLE = 'C:\path\outside-homeish\repowise-tool\Scripts\repowise.exe'
$env:HOMEISH_REPOWISE_SNAPSHOT = 'C:\path\outside-homeish\repowise-snapshot'
$env:HOMEISH_REPOWISE_PROFILE = 'C:\path\outside-homeish\repowise-profile'
$source = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw 'Open PowerShell in the Homeish checkout first' }
if ((Test-Path -LiteralPath $env:HOMEISH_REPOWISE_SNAPSHOT) -or
    (Test-Path -LiteralPath $env:HOMEISH_REPOWISE_PROFILE)) {
  throw 'Choose new snapshot and profile directories'
}
New-Item -ItemType Directory -Force -Path $env:HOMEISH_REPOWISE_PROFILE | Out-Null
git clone --no-local --depth 1 -- $source $env:HOMEISH_REPOWISE_SNAPSHOT
if ($LASTEXITCODE -ne 0) { throw 'Could not clone the committed snapshot' }
```

Set these process-only protections in that window before **each** indexing or
refresh command. They also keep RepoWise's transcript search in the dedicated
profile. Close the window afterwards; these do not change your normal home:

```powershell
$env:USERPROFILE = $env:HOMEISH_REPOWISE_PROFILE
$env:HOME = $env:HOMEISH_REPOWISE_PROFILE
$env:XDG_CONFIG_HOME = $env:HOMEISH_REPOWISE_PROFILE
$env:COPILOT_HOME = $env:HOMEISH_REPOWISE_PROFILE
$env:REPOWISE_CONFIG_DIR = $env:HOMEISH_REPOWISE_PROFILE
$env:REPOWISE_OFFLINE = '1'
$env:REPOWISE_TELEMETRY_DISABLED = '1'
$env:REPOWISE_PROVIDER = 'mock'
$env:REPOWISE_EMBEDDER = 'mock'
$env:REPOWISE_DB_URL = ''
$env:REPOWISE_PLUGINS = ''
$env:DO_NOT_TRACK = '1'
$env:HF_HUB_OFFLINE = '1'
$env:HF_HUB_DISABLE_TELEMETRY = '1'
$env:TRANSFORMERS_OFFLINE = '1'
$env:PYTHONNOUSERSITE = '1'
```

Build the index and pin its provider to mock:

```powershell
& $env:HOMEISH_REPOWISE_EXECUTABLE init $env:HOMEISH_REPOWISE_SNAPSHOT `
  --provider mock --embedder mock --no-prose --no-codex --no-editor-setup `
  --no-hook --no-distill-hook --no-claude-md --no-agents --no-save-key `
  --no-workspace --commit-limit 1 --exclude '.env*' --exclude '**/.env*'
if ($LASTEXITCODE -ne 0) { throw 'RepoWise indexing failed' }
& $env:HOMEISH_REPOWISE_EXECUTABLE config set --path $env:HOMEISH_REPOWISE_SNAPSHOT provider mock
if ($LASTEXITCODE -ne 0) { throw 'Could not pin the mock provider' }
```

For VS Code to find the paths in future sessions, set only these three
non-secret user variables, after checking that they are not already set:

```powershell
$names = 'HOMEISH_REPOWISE_EXECUTABLE', 'HOMEISH_REPOWISE_SNAPSHOT', 'HOMEISH_REPOWISE_PROFILE'
foreach ($name in $names) {
  if ([Environment]::GetEnvironmentVariable($name, 'User')) {
    throw "$name is already set; review it before changing it"
  }
}
foreach ($name in $names) {
  [Environment]::SetEnvironmentVariable($name, [Environment]::GetEnvironmentVariable($name, 'Process'), 'User')
}
```

Restart VS Code completely, open the trusted Homeish workspace, and enable
`repowise` in **Chat: Open Customizations → MCP Servers** if necessary. Ask
Copilot to use RepoWise to find a known symbol, then inspect the tool call. A
successful local index alone does not prove that Copilot loaded the server.
Developers who do not opt in can disable this server in their workspace; the
app itself does not require it.

### Refresh after a commit

The snapshot does not refresh automatically. In a new dedicated PowerShell
window, first set the process-only protections above, then run:

```powershell
git -C $env:HOMEISH_REPOWISE_SNAPSHOT fetch --depth 1 --no-tags origin HEAD
if ($LASTEXITCODE -ne 0) { throw 'Could not fetch the local committed HEAD' }
git -C $env:HOMEISH_REPOWISE_SNAPSHOT switch --detach FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw 'Could not update the snapshot' }
$budget = @(git -C $env:HOMEISH_REPOWISE_SNAPSHOT ls-files).Count
if ($LASTEXITCODE -ne 0 -or $budget -eq 0) { throw 'Could not count tracked snapshot files' }
& $env:HOMEISH_REPOWISE_EXECUTABLE update $env:HOMEISH_REPOWISE_SNAPSHOT `
  --no-workspace --no-agents --provider mock --cascade-budget $budget
if ($LASTEXITCODE -ne 0) { throw 'RepoWise index update failed' }
```

The snapshot's `origin` is the local Homeish checkout. If Git refuses to switch
because the snapshot has changes, stop and investigate; do not force or reset
it. Check the update output for stale-page warnings and treat any remaining
stale pages as incomplete. Do not add a hosted service, model provider, hook
or live-worktree index without separate approval.
