<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commit and release workflow

Never commit, push, merge or apply hosted Supabase migrations without the owner's explicit approval. When the owner explicitly asks to commit, push, or merge to `beta` or `main`:

1. Split the uncommitted changes into small, self-contained commits grouped by concern (for example migrations with their database tests, core logic with its unit tests, UI, docs, tooling). Order them so every commit builds on its own: `npx tsc --noEmit` and `npm run test` must pass at each commit (verify in a temporary worktree).
2. Write each message with the rules in `.vscode/settings.json` (Conventional Commit subject, 2–6 imperative bullets, mixed-commit type precedence `feat > fix > perf > refactor > build > ci > test > docs > style > chore`).
3. Show the proposed commits and messages, and wait for the owner's confirmation.
4. After confirmation, go one step at a time and only continue when the previous step is green:
   - commit to the feature branch, run the full local gate on its head (`npm run check`, `npm run test:integration:local`, `npm run build`, `npx playwright test`), push it, and confirm `origin/<feature-branch>` matches the local head before merging (feature-branch pushes do not trigger CI or CodeQL);
   - merge `--no-ff` into `beta` (fast-forward local `beta` to `origin/beta` first), push, and wait for CI (checks, database, e2e) and CodeQL to pass;
   - merge `--no-ff` `beta` into `main` ("chore(release): merge verified beta into main"), push, and wait for CI and CodeQL to pass.
5. If any step fails, stop, report it and fix it on the feature branch with approval before continuing.
