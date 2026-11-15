<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

Before any task, read [docs/AGENTS.md](docs/AGENTS.md). It holds this project's working rules, governing documents and definition of done. Generic personal rules (plain-language communication, safety, Windows and PowerShell, commit style, report format) come from the owner's personal Copilot instructions.

## App at a glance

- Multi-tenant society management for residents, guards, admins/committee, housekeeping supervisors and the platform developer.
- One Next.js App Router application with strict TypeScript, React, Tailwind CSS and Supabase; hosted on Vercel. Use [package.json](package.json) and the lockfile for runtime requirements and dependency versions, not old scaffold notes.
- [docs/PRD.md](docs/PRD.md) governs behavior, [docs/DESIGN.md](docs/DESIGN.md) governs interaction and appearance, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md) and [docs/API.md](docs/API.md) govern technical contracts.

## Current code map

- `src/app/`: thin routes, layouts, Server Actions and API entry points.
- `src/core/`: platform services and the existing domain implementations (including visitor, delivery, billing and service requests). `src/modules/` is a target architecture layout, not an existing folder; do not create a parallel implementation or move code as setup cleanup.
- `src/core/modules/index.ts`: current module registry, navigation, settings hooks and permission maps. Reuse it rather than adding another registry.
- `src/components/`: domain UI; `src/components/ui/`: shared controls; `src/styles/`: design tokens.
- `supabase/migrations/`: forward-only schema changes; `src/core/db/database.types.ts`: generated types; `tests/unit/`, `tests/integration/` and `tests/e2e/`: the three test suites.

## Commands and database safety

These are existing manifest commands, not a claim that they passed in this session. Run focused checks for the change; the release gates below remain mandatory when releasing.

| Command                          | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`                    | Start local development with the current local environment                       |
| `npm run typecheck`              | TypeScript checks                                                                |
| `npm run test`                   | Unit tests; append `-- <test-file>` to focus                                     |
| `npm run check`                  | Formatting, lint, types, unit tests and repository-specific checks               |
| `npm run test:integration:local` | Start disposable local PostgreSQL, apply migrations there and run database tests |
| `npm run e2e`                    | Playwright browser tests                                                         |
| `npm run build`                  | Production build                                                                 |

Database integration tests refuse remote hosts. Use the local runner above; plain `npm run test:integration` can skip database tests locally if no server is configured. See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for PostgreSQL prerequisites. `homeish-testdb` is shared by development and beta, not disposable test infrastructure: hosted migrations, seeds, resets and manual Auth checks require explicit approval. Never run against live from this machine.

The personal guardrail also reads [.github/copilot-protected.txt](.github/copilot-protected.txt) to request confirmation before editing Homeish's deployment configuration, database/backup tooling and privileged-client area. This adds edit prompts, not permission to execute those tools or a security boundary.

## Commit and release workflow

Never commit, push, merge or apply hosted Supabase migrations without the owner's explicit approval. When the owner explicitly asks to commit, push, or merge to `beta` or `main`:

1. Split the uncommitted changes into small, self-contained commits grouped by concern (for example migrations with their database tests, core logic with its unit tests, UI, docs, tooling). Order them so every commit builds on its own: `npx tsc --noEmit` and `npm run test` must pass at each commit (verify in a temporary worktree).
2. Write each message with the rules in `.vscode/settings.json` (`type (scope): summary` subject with a space before the scope, 2–6 imperative bullets, no `Co-authored-by` or other trailers, mixed-commit type precedence `feat > fix > perf > refactor > build > ci > test > docs > style > chore`).
3. Show the proposed commits and messages, and wait for the owner's confirmation.
4. After confirmation, go one step at a time and only continue when the previous step is green:
   - commit to the feature branch, run the full local gate on its head (`npm run check`, `npm run test:integration:local`, `npm run build`, `npx playwright test`), push it, and confirm `origin/<feature-branch>` matches the local head before merging (feature-branch pushes do not trigger CI or CodeQL);
   - merge `--no-ff` into `beta` (fast-forward local `beta` to `origin/beta` first), push, and wait for CI (checks, database, e2e) and CodeQL to pass;
   - merge `--no-ff` `beta` into `main` ("chore (release): merge verified beta into main"), push, and wait for CI and CodeQL to pass.
5. If any step fails, stop, report it and fix it on the feature branch with approval before continuing.
