---
name: homeish-code-cleanup
description: Tidy Homeish code in a named module or folder without changing behaviour — remove comments that only repeat the code, review try/catch against Homeish's error rules, and propose splits for files over 300 lines. Use when asked to clean up, tidy or declutter code in this repository.
---

# Homeish code cleanup

Behaviour must not change. No new dependencies, renames beyond moved code, or formatting churn beyond Prettier. Do not commit or push.

## 1. Scope and rules

- Work on one module, folder or list of files. If the user did not name one, ask; never clean the whole repository in one pass.
- Read [AGENTS.md](../../../AGENTS.md), [docs/AGENTS.md](../../../docs/AGENTS.md) sections 05 (code quality) and 09 (error handling and logging), and [docs/ERROR_LOGGING.md](../../../docs/ERROR_LOGGING.md).
- Run `git status` and leave changes you did not make alone.
- Never touch `src/core/db/database.types.ts` (generated), `src/core/i18n/catalogs/` (translation catalogues), `supabase/migrations/` or `src/app/fixtures/`. Ask before editing paths listed in [.github/copilot-protected.txt](../../copilot-protected.txt).

## 2. Baseline

Run `npm run typecheck`, `npm run lint` and `npm run test -- <related test files>` and record the results. If they already fail, stop and report.

## 3. Comments (apply directly)

- Remove comments that restate the code, commented-out code, and comments narrating past changes.
- Keep the one- or two-line header comment at the top of every source file (checked by `npm run check:headers`), comments that explain _why_, and lint or type directives that carry a reason. When unsure, keep it.

## 4. Error handling (report first, then apply approved batches)

Homeish deliberately keeps some handling that generic cleanup advice would delete:

- **Keep:** expected failures returned as results with the closed error codes; boundary catches (server operation, route, error boundary) that log with a reference ID; best-effort logging that must never throw; timeouts and fallbacks around outside calls (API 14); cleanup in `finally`.
- **Remove:** catches that only rethrow unchanged; a second log of an error already logged at the boundary.
- **Fix:** silent catches, success-shaped or empty results on failure, or logging that can throw.

List each case with file and line, the category and the reason. Apply only the batches the user approves. Money, gate (visitor and delivery), sign-in, permission and data-deletion paths always need explicit approval.

## 5. Large files (propose only)

- List files in scope over 300 lines (docs/AGENTS.md section 05), excluding the paths in section 1.
- For each one, propose a split by job: the new `kebab-case` file names, what moves, and which imports change. Keep module strings together, and keep server-only code out of client files.
- Split only the files the user approves, one per change. Give each new file a header comment, update every caller, and update [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) if the folder structure it describes changes.

## 6. Verify and report

- Re-run the baseline commands, then `npm run check`.
- If database operations moved, run `npm run test:integration:local`. If screens or components moved, run `npm run e2e`.
- Report:
  - what was removed or split;
  - what is waiting for approval;
  - the commands run, with results before and after.
