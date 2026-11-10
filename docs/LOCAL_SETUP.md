# Homeish — Local Setup (LOCAL_SETUP.md)

Step-by-step setup for a Windows development machine. There is no local database: Docker Desktop cannot be installed, so development and automated database tests use the shared cloud project `homeish-testdb`, which only ever holds synthetic data (ARCHITECTURE AD-13, AD-14).

## 1. Tools

- Node.js 24.20.0 and npm (see README).
- The Supabase CLI is a project development dependency (`supabase` in `package.json`); it is installed by `npm ci`. Do not install it globally.

```powershell
npm ci
```

## 2. Network certificates (company networks)

Some company networks inspect secure web traffic with their own certificate. Windows trusts it, but Node.js does not by default, so the Supabase CLI fails with `Transport error` or `SELF_SIGNED_CERT_IN_CHAIN`. The project's database commands (`npm run db:*`) already tell Node to also trust the Windows certificate store. For any other direct CLI call in the same window, set:

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
```

## 3. Supabase projects

| Project          | Ref                    | Use                                                      | State  |
| ---------------- | ---------------------- | -------------------------------------------------------- | ------ |
| `homeish-testdb` | `oqyagsabodaueghtrocv` | Development, automated tests, staging/beta (synthetic)   | Active |
| `homeish-demo`   | `iauusmylbymplqtheinp` | Synthetic showcase data only                             | Paused |
| `homeish-live`   | `yhwadldjeyirkgbmoctb` | All onboarded societies — real data; changes only via CI | Paused |

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

| Command                                          | What it does                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `npm run db:new -- <module>_<short_description>` | Creates an empty, timestamped migration file in `supabase/migrations/` |
| `npm run db:list`                                | Shows which migrations testdb has applied                              |
| `npm run db:push`                                | Applies new migrations to testdb (add `-- --dry-run` to preview first) |
| `npm run db:types`                               | Regenerates `src/core/db/database.types.ts` from testdb                |
| `npm run db:types:check`                         | Fails if the generated types no longer match testdb                    |
| `npm run check:migrations`                       | Checks migration file names (also part of `npm run check`)             |

Database commands load `.env.testdb.local` and run against the address in it. To target the demo project once it is resumed: `npm run env -- demo node scripts/db.mjs push`. They refuse `homeish-live` and an unset password, and hide database addresses in their output.

### Database integration tests

Database tests (migrations, RLS, SQL functions) are Vitest files in `tests/integration/`. They never use testdb, demo or live: they run against a throwaway PostgreSQL 17 server on this machine and refuse any other host. For each test file the harness (`tests/integration/support/database.ts`) creates a fresh database, adds a small stand-in for Supabase's `auth` schema and roles (`supabase-stub.sql`, `roles.sql`), applies every migration in order and drops the database afterwards. Extend the stand-in only to mirror real Supabase behaviour a migration needs; sign-in itself is verified against testdb.

Run them with the portable PostgreSQL server tools (no Docker). Set `PG_BIN` to its `bin` folder once per PowerShell window, or add that folder to `PATH`:

```powershell
$env:PG_BIN = 'C:\path\to\postgresql\bin'
npm run test:integration:local
```

The script creates a temporary server on `127.0.0.1:54329`, runs the tests, then stops the server and deletes its files. Without a server, `npm run test:integration` skips these tests locally; in CI a missing server is an error. GitHub Actions runs the same tests against a `postgres:17` service container, so no database password is stored in GitHub.

### Migration rules (DATABASE 14.1)

- Name: `YYYYMMDDHHMMSS_<module>_<short_description>.sql`, where `<module>` is a module key (`core`, `visitor`, `delivery`, `billing`, `service_request`, `staff`, `housekeeping`, `amc`, `notice`, `amenity`). `db:new` adds the timestamp.
- Forward-only: never edit a migration once it has run on testdb; fix forward with a new one.
- One concern per file; a table ships with RLS enabled, its policies and grants in the same file.
- After every schema change run `npm run db:push`, then `npm run db:types`, and commit the migration and the regenerated types together.
- Roll-out order: testdb → demo → live; live only through approved CI.

### Email-code sign-in setup

`supabase/config.toml` disables public sign-up, requests six-digit codes that expire after ten minutes, uses a code-only email template, enables local TOTP enrollment/verification, and caps society sessions at 30 days. Developer access is separately capped at four hours per auth session and requires MFA from the previous 15 minutes. The local SMTP catcher remains enabled for local-stack use. The project does not run that stack, and these settings have not been pushed to `homeish-testdb`.

Before real email testing, verify the sender domain in Brevo and configure its SMTP credentials in the `homeish-testdb` dashboard. Hosted Auth settings have not been changed; automated tests mock delivery. A test recipient only needs to be an inbox the tester controls. Do not configure production email or share SMTP credentials in source.

### Folders

- `supabase/migrations/`: forward-only SQL.
- `supabase/seed/`: synthetic seed files (`*.sql`, configured in `supabase/config.toml`); never real people.
- `tests/integration/`: database integration tests and their harness; run with `npm run test:integration:local`.
- `supabase/config.toml`: CLI settings. It describes a local stack we do not run; hosted project settings are changed in the dashboard, never with `supabase config push`.
