# Homeish — Agent Instructions (AGENTS.md)

| Field     | Value                                                                                  |
| --------- | -------------------------------------------------------------------------------------- |
| Product   | Homeish (PRD D-01 approved 2026-11-09)                                                 |
| Version   | 0.1                                                                                    |
| Date      | 2026-11-15                                                                             |
| Audience  | The coding agent working in this repository                                            |
| Authority | Rules for _how_ to work. What to build is defined by the project documents (Section 2) |

These rules apply to every task, every session and every tool. If a rule here conflicts with a casual request, follow the rule and tell the user why; if the user explicitly overrides a rule, do what they ask and note the exception in the change summary.

---

## 01 Owner and Approvals

Communication, safety and approval practices come from the owner's personal Copilot instructions. Homeish-specific additions:

- Do not re-open decisions the documents mark as **Approved**; do ask about anything not yet approved.
- Product scope comes from the governing documents. If a requirement is absent, it is out of scope until the owner adds it.

---

## 02 Governing Documents

Read the relevant documents **before** changing behavior. Follow each document within its own domain.

| Document                             | Authority                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [PRD.md](./PRD.md)                   | What the product does: scope, roles, requirements, approved decisions (D-nn), assumptions (A-nn) |
| [DESIGN.md](./DESIGN.md)             | How it looks and behaves: tokens, components, states, accessibility, page layouts                |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, boundaries, folder structure, security model, testing and deployment                      |
| [DATABASE.md](./DATABASE.md)         | Tables, constraints, indexes, row-level security, retention, backups                             |
| [API.md](./API.md)                   | Server operations, routes, error codes, rate limits, integrations, environment variables         |
| This file                            | Working rules                                                                                    |

Precedence: **PRD** for behavior → **DESIGN** for appearance and interaction → **ARCHITECTURE/DATABASE/API** for technical choices. DATABASE governs schema; API governs contracts. A later document may not weaken a guarantee made by an earlier one.

Rules:

- Distinguish **proposed**, **implemented**, **tested** and **approved**. A document is not proof that code works; passing tests are not user approval.
- If documents contradict each other, or a needed detail is missing, **stop and ask** (Section 01). Never silently choose the weaker or riskier option.
- Every approved decision lives in its owning document. When a decision changes, update the owning document and every document that repeats it, in the same task.

---

## 03 Start of Every Task (mandatory)

Follow the personal instructions for inspecting the worktree, reading code, reusing patterns and keeping changes focused. For Homeish:

1. Identify the affected module(s) (`core`, `visitor`, `delivery`, `billing`, `service_request`, or a post-MVP module) and relevant requirement/screen IDs.
2. Read the governing documents for that area and check the plan against the module, layer (Section 04), permissions and required screen states.
3. Verify with the applicable checks (Section 14), update the owning documents (Section 15) and report real results.

### 03.1 Build order

Modules are built one at a time in this order, each shippable behind its module toggle: **Core → Visitor → Delivery → Billing → Service Request**; then post-MVP modules as the user approves. Do not start a later module, or pull its tables, until the user asks. A new module ships **disabled** by default.

### 03.2 Existing application

This is not a greenfield scaffold. Inspect the current implementation and [root code map](../AGENTS.md#current-code-map) before adding files; do not recreate already implemented modules from the target architecture diagram.

### 03.3 Phase workflow

1. For the current phase, identify its agreed scope and blocked tasks. Gather the foreseeable owner decisions before building, with plain-language options, recommendations and examples; do not reopen approved decisions.
2. Record approved decisions in the governing documents before coding. Do not make intermediate commits while gathering decisions or building the phase.
3. Implement and verify the agreed phase scope. If a new consequential decision arises, pause and ask; report failed or unrun checks rather than calling the phase complete.
4. Once the agreed work is complete, propose the local commits and wait for the owner's confirmation under the [commit workflow](../AGENTS.md#commit-and-release-workflow). Wait for a separate owner go-ahead before starting the next phase; ask for direction if the current phase is blocked or incomplete.

---

## 04 Project and Folder Structure

ARCHITECTURE Section 9 describes the target structure. The current domain services live under `src/core/<domain>/`, domain UI under `src/components/<domain>/`, and the central registry and permission maps in `src/core/modules/index.ts`; there is no `src/modules/` tree today. Preserve the existing locations for focused changes. A move to the target structure needs a separately approved task, not a second implementation alongside existing code.

Key boundaries still apply:

- **Modular monolith.** One Next.js app. The target separates the always-on platform from toggleable modules; a domain's current location in `src/core/` does not exempt it from module-toggle checks. `src/components/ui/` holds shared controls; `src/app/` contains thin routing, layout and operation entry points.
- **Layers inside a module** (ARCHITECTURE 6.1): screens → server operations (thin) → service (business rules) → queries (database access). Each layer calls only the one below it. Screens never touch the database; queries contain no business rules.
- **Modules never import other modules.** Cross-module needs go through `core` (units, notifications, memberships) or a route link. A module imports only from `core`, `components/ui` and `lib`.
- **Adding a module** = one folder, one registry entry, its migrations, its navigation items, its permission map. Touch nothing else.
- Route groups map to roles: `(auth)`, `(resident)`, `(guard)`, `(admin)`, `(housekeeping)`, `developer`. Do not mix role shells.
- Put new files where the documents say they belong. If no place fits, ask before inventing a new top-level folder.
- Do not create generic "utils", "helpers" or "common" dumping grounds. Put code next to the thing it serves, or in `lib/` only if it is pure, small and used by several modules.
- Do not create new top-level folders, new config systems or new abstractions "for later".

---

## 05 Code Quality and Naming

- **Naming**
  - Files and folders: `kebab-case`. Components and types: `PascalCase`. Functions and variables: `camelCase`. Constants: `UPPER_SNAKE_CASE`. Database objects: `snake_case`, tables plural, module-prefixed (DATABASE 1).
  - Server operations are named `area.verbNoun` (API 3.1). Error codes, enumeration values and statuses use the exact spelling in API and DATABASE.
  - Names describe the domain in the product's vocabulary (DESIGN Section 16): _visitor_, _delivery_, _dues_, _bill_, _unit_, _society_, _service request_ — not synonyms. Never hard-code a society's custom wording; use the configured label.
  - No abbreviations that are not already in the documents. Booleans read as questions (`isActive`, `hasHistory`).
- **Small, single-purpose functions** and components. Prefer clear code over clever code; avoid deep nesting; return early.
- **No dead code, commented-out code, unused exports, leftover debug output or TODOs without an owner and a reason.**
- **Header comment in every source file:** one or two lines stating the file's purpose. **Inline comments only for non-obvious decisions** (why, never what). Do not write multi-paragraph comments or comments that narrate your change.
- **Plain-language user text** follows DESIGN Section 1.3 and Section 16 (sentence case, Title Case on primary buttons, no jargon, no emoji). All user-facing strings are kept together per module so they can be translated later (PRD NFR-13).
- **Money** is integer paise everywhere; dates and times follow API 3.3; time zone rules follow DESIGN DA-01.

---

## 06 Component and Pattern Reuse

- **Reuse before you create.** Search `components/ui/` and the module for an existing component, hook, schema or helper that already does the job. Extend it if the change is small and general; otherwise compose it.
- Create a new shared component only when the same UI is needed in **at least two places** or DESIGN names it in the component inventory (DESIGN Section 19). A new composite belonging to one module lives inside that module.
- **Use design tokens only** (DESIGN Sections 2–4): colour, type, spacing, radius, motion. No raw hex values, arbitrary pixel values or one-off styles in components. If a token is missing, propose it by updating DESIGN first.
- Status chips, empty states, error panels, skeletons, dialogs, forms, tables, pagination and filters must use the shared components and the exact behavior in DESIGN Sections 4.4, 6, 7 and 9.
- Every screen defines **loading, empty (and filtered-empty), error and no-permission states** (DESIGN Section 9). A screen without them is not done.
- Keep accessibility inside the shared components (focus handling, labels, live regions), not repeated per screen (DESIGN Section 14).
- Do not copy-paste a block a third time: extract it. Do not extract a block the second time unless it is clearly the same concept.
- Follow the visitor/delivery/billing/request patterns already established by earlier modules rather than inventing a different approach for the next one.

### Learnings

- Use static imports for local Next Image sources under Homeish's host-aware proxy, for example importing a JPEG rather than passing `"/preview.jpg"`. The installed optimiser's internal public-path requests omit Host and are correctly rejected; static imports use the existing framework-static exclusion. Verify actual image decoding in browser tests, not just the presence of an image element. Do not weaken host validation or CSP to fix image loading.
- P18 NOCs must preserve font-supported NFC names/labels. Check `PDFFont.getCharacterSet()` and explicitly reject unsupported text before upload; do not use the legacy ASCII `pdfSafeText()` replacement, which changes names. Existing Billing/Expense PDF behaviour remains unchanged unless separately approved.
- Native selects can appear blank even when axe and page reflow pass: padding may consume the text area. Check the selected text against the control's content width at supported sizes, and wrap grouped time controls by their available width.

---

## 07 Dependency Management

- **Default: no new dependency.** Use the platform, the existing stack and what is already installed. The approved stack and its roles are in ARCHITECTURE Section 2; do not swap or add alternatives (no ORM, state library, CSS-in-JS, component kit, job queue, cache, search engine or second validation library).
- Add a package only when it replaces substantial hard-to-get-right code (auth, PDF, validation, accessibility primitives, push, error reporting) **and** the user has approved it. In your request, state in plain words: what it does, why existing tools are not enough, its cost/licence, how widely it is used and maintained, and the recommendation.
- Check before adding: maintained recently, licence allows commercial use, no known serious vulnerabilities, small footprint, compatible with the project's runtime.
- Pin versions through the lockfile; commit the lockfile with the manifest change. Use locked installs in CI. Never run blanket upgrade commands; upgrade one package at a time, for a stated reason, with tests passing.
- Never install packages from unknown sources, run install scripts you have not understood, or add packages to "make a warning go away".
- Remove dependencies you made unnecessary, in the same change.
- Record newly added or removed dependencies in your task report and, if they affect the architecture, update ARCHITECTURE.

---

## 08 Type Safety and Validation

- **TypeScript strict mode** everywhere. No `any`, no unchecked casts, no `@ts-ignore`/`@ts-expect-error` or lint suppressions to hide a problem. Narrow types explicitly; model "can be missing" as `null`, never as an empty string or zero.
- **Database types are generated** from the schema (ARCHITECTURE 7.1); never hand-edit them. Regenerate after every migration and commit the result with it.
- **One schema per input**, shared by the form and the server operation (API 3.4). The server always validates again. Unknown fields are rejected; strings are trimmed and length-limited; enumerations are closed lists using the exact values in DATABASE.
- Parse at the boundary (user input, database results where shape matters, outside-service responses, environment variables) into typed values; the interior of the code then trusts the types.
- Represent results as the documented envelope (API 3.2) and states as discriminated unions rather than loose flags.
- Environment variables are read **only** through the validated configuration module; no direct reads of process settings elsewhere. Public and server-only variables are never mixed (Section 10, API 11).
- Do not widen a type to make code compile. Fix the data flow.

---

## 09 Error Handling and Logging

Follow ARCHITECTURE 14 and API 3.5, 14.

- **Expected failures are returned, not thrown:** validation, permission, module disabled, suspended society, conflict, not found, rate limit, integration failure. Use the closed error-code and conflict-reason lists; do not invent codes.
- **Unexpected failures** are caught at the boundary (server operation, route, error boundary), converted to an internal error, **logged with a reference ID**, and shown to the user with that reference ID (PRD LOG-2). No silent catch, no swallowed errors, no success-shaped fallbacks, no empty results on failure.
- **User messages** say what happened, what it means for their data, and what to do next, in plain language (DESIGN 9.3). Never show stack traces, SQL, internal IDs or whether someone else's data exists.
- **Logging is best effort and must never throw.** Failure to log must not create a new user-visible error.
- **Never log** (or send to the error reporter): codes/OTPs, tokens, cookies, authorization headers, push keys, PINs, full phone numbers, UPI IDs or payment references beyond what an audit row legitimately needs, document or photo content, or whole request bodies. Always pass data through the single scrubber.
- Every operation carries the **request ID** into logs, database calls and outside-service calls (PRD LOG-8).
- **Outside calls** use a timeout, a limited retry only when repeating is safe, a defined fallback, and a logged failure (API 14). Do not add retry loops or queues beyond the documented design.
- **Money and gate-critical paths** must never fail silently: a failed visitor entry stays on screen for retry; a payment is never shown as confirmed until the admin confirms it.
- Do not use alerts, toasts or auto-dismissing messages for errors or money outcomes (DESIGN 6.11).

---

## 10 Security and Secrets

**Secrets**

- **Never** put secrets in source code, logs, comments, tests, fixtures, screenshots, documentation, commit messages, error messages or browser-visible code. This includes the service-role key, database URLs, Brevo key, push private key, scheduler secret, guard-session secret, rate-limit salt and any token.
- Secrets live only in the host's secret store and in ignored local environment files. Commit an example file with **names and placeholders only** (API Section 11).
- Only variables explicitly marked public (`NEXT_PUBLIC_…`) may reach the browser. Never prefix a secret with the public marker. If you find a secret in the repository, stop, tell the user plainly, and do not copy it elsewhere.
- Never print secret values in the terminal, in task reports or in chat. Refer to them by name.
- Never use real people's data. Test data is synthetic, with emails on a reserved example domain (DATABASE 14.3).

**Authentication and authorization (server-side only)**

- Authorization is enforced on the server and in the database. Hiding a button is only a convenience.
- Follow the pipeline in API 2.5 for every operation: authenticated → developer MFA (if developer) → society state → module enabled → role → ownership → database rules.
- Derive identity from the verified session, never from a client-supplied user or society ID. Re-read roles from the database for each request.
- The permission matrix lives in **one code map per module**; the service checks, the screen visibility and the tests all read from it. Do not duplicate permission logic in screens.
- Never use the service-role (privileged) identity outside the isolated privileged module and the cases listed in ARCHITECTURE 8.4. Anything that can run under the user's own session must.

**General**

- Treat all input as hostile: validate, encode, parameterise. No string-built queries, no raw HTML rendering of user text, no `eval`-style execution, no open redirects (redirect targets come from a fixed list).
- CSV exports neutralise cells starting with `=`, `+`, `-`, `@`. Files: private storage, short-lived links, type and size checks (DATABASE 12).
- Do not weaken security headers, content-security policy, same-origin rules, rate limits, cookie flags or session settings to make something work. If one blocks a feature, ask.
- Do not disable tests, checks, linting or verification (`--no-verify`, skipped tests, ignored errors) to get a change through.
- Keep personal data minimal and masked per API 13. Add no new personal-data fields, trackers, analytics or third-party scripts without approval and a documented purpose.
- Report any suspected vulnerability or exposed secret immediately and plainly; do not hide it in a normal summary.

---

## 11 Database and API Access

Follow DATABASE and API exactly.

**Schema and migrations**

- All schema changes are **forward-only migration files**, one concern per file, named as in DATABASE 14.1. **Never edit a migration that has already been applied** anywhere shared; add a new one.
- A new table ships **in the same migration** with: constraints, same-society keys, indexes, row-level security enabled, policies, minimal grants (nothing for the anonymous role), and rejecting triggers on append-only tables. Never "add security later".
- Every tenant table has `society_id`, a same-society composite key to its parents, and an index starting with `society_id`.
- Match DATABASE conventions: UUID keys, `timestamptz`, money as integer paise, `text` + check for statuses, length limits on free text, `ON DELETE RESTRICT`, soft delete or deactivate (no hard delete on money, entries, requests, audit).
- **Append-only data stays append-only:** ledger, payments after confirmation, allocations, bill lines, visitor/delivery history, request events, audit logs. Corrections are new reasoned entries, never edits.
- Update DATABASE.md in the same change as any migration; regenerate types.
- **Automated database tests use disposable local PostgreSQL**, never a hosted project. `homeish-testdb` is shared by development and staging/beta (AD-13), so hosted migrations, seeds, resets and manual Auth checks need the owner's explicit approval; do not treat its name as permission to reset it. Live changes go through the reviewed pipeline (ARCHITECTURE 19), never from this machine.
- Never copy production data to any other environment. Never hand-edit production rows.

**Data access**

- Normal reads and writes use the **caller's own session** so row-level security applies. Multi-row, locked or audited changes are **single database functions** that run in one transaction (visitor decisions, bill generation, payment confirmation, module toggle, role change). The service calls the function; it does not stitch several calls together.
- No ORM, no direct database connection from the running app, no database credentials in app code (the direct connection string is for migration/backup tooling only).
- Business rules that must always hold live in the database (constraints, functions, row rules) **and** in the service for good error messages; do not rely on the screen.
- Never trust a client-supplied amount, society ID, role or status. Compute money on the server.

**Operations and routes**

- Add or change an operation or route only if the requirement needs it, and **update API.md first or in the same change**: name, who may call it, purpose, input, output, errors, rate limit.
- Follow the response envelope, error codes, idempotency (`clientRequestId`), concurrent-edit (`version`), pagination, sorting and filtering conventions (API Section 3). Keep personal data out of URLs.
- Pages load data through server query functions; screens do not call internal HTTP endpoints for ordinary reads and writes. Do not add routes beyond API Section 6 without updating that section.
- Every outside service sits behind one adapter in `core/integrations/`; services decide what to do with the result. Webhooks follow API Section 9 if ever added.
- Realtime events are hints; always refetch authoritative data through the normal operation.

---

## 12 Module-Specific Guardrails

- **Module toggle:** a disabled module leaves no navigation item, no card, no layout gap, no accessible route, no background work and no notifications. Data is never deleted by disabling (PRD MOD-1 to MOD-6). Check the toggle in the service and rely on the database rule as well.
- **Visitor/Delivery:** first response wins; guard override needs a reason; entries record the handling guard (both gate-login modes); status transitions only through the documented functions.
- **Billing:** bills are immutable once published; money is append-only; a UPI payment becomes confirmed **only** through the admin confirm function; duplicate payment references are blocked by the database; UPI detail changes are audited and notify admins and committee; credit applies automatically to the next bills (DATABASE 6.1).
- **Service requests:** transitions through functions only; every change writes a timeline event and notification.
- **Guards:** the PIN is stored only as a hash and never returned or logged; attempt limits apply.
- **Developer console:** looks different from the admin shell, requires MFA, audits every action, and has no impersonation.

---

## 13 Testing

Follow ARCHITECTURE 18. A change is not finished until its tests exist and pass.

| What you change                                                                                    | Required tests                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic (money, dates, late fees, allocation, permission map, schemas, scrubber, error mapping) | Unit tests with edge cases (zero, boundary dates, rounding, duplicates)                                                                                                                                                |
| Table, policy, function or migration                                                               | Database tests: tenant isolation, each role/matrix cell allowed and denied, module-disabled denial, uniqueness and check rules, append-only protection, idempotency, concurrency (e.g., two approvers, double confirm) |
| Service or server operation                                                                        | Integration tests against disposable local PostgreSQL for database behavior, with fakes for outside services; hosted Auth smoke checks are separate and require explicit approval                                      |
| Screen or journey                                                                                  | End-to-end tests at phone and desktop sizes covering the happy path, loading, empty, error, no-permission and module-disabled states, plus an automated accessibility check                                            |
| Outside-service adapter                                                                            | Tests against fakes; failure, timeout and retry behavior                                                                                                                                                               |
| Bug fix                                                                                            | A test that fails before the fix and passes after                                                                                                                                                                      |

Rules:

- **Permission tests are generated from the same map the app uses**; a new capability without an allow and a deny test fails the build.
- Test cross-society access explicitly for every new table or operation: it must be impossible.
- Tests use synthetic data and fakes; they never call real email, push or payment services and never use real credentials.
- Do not weaken, skip, delete or "update to match" a failing test to make it pass. If a test is wrong, say why and fix it deliberately; if behavior must change, update the documents first.
- Keep tests deterministic: no dependence on real time (use a controllable clock), ordering, network or shared state.
- Automated accessibility checks do not replace manual keyboard, screen-reader, zoom and low-end-phone passes, which are part of each module's acceptance (DESIGN Section 15). Never claim manual checks happened if they did not.
- Do not claim tests pass without running them. Report exactly what was run and the result.

---

## 14 Verification Before You Say "Done"

Use the [root command reference](../AGENTS.md#commands-and-database-safety) and run the checks relevant to the change; report real results. Documentation-only changes do not require application suites unless documentation tests exist. The full release gate in [root AGENTS.md](../AGENTS.md#commit-and-release-workflow) is unchanged.

For application changes:

1. Typecheck, lint and formatting pass without suppressions.
2. Unit, database and integration tests for the affected area pass; the whole suite passes before a module is declared complete.
3. Generated database types are current; no migration is edited after being applied; the CI checks listed in DATABASE 14.1 pass.
4. Every new screen has all required states and meets DESIGN's acceptance checklist (DESIGN Section 15) for the part you changed.
5. A scan confirms no secrets, no real data, no leftover debug output and no source file missing its header comment.
6. Documents are updated (Section 15) and consistent with the code.
7. The change touches only what the task required.

If you could not run something (missing tool, no database, no network), say so plainly and list what remains unverified. Local checks are not deployment verification and not user sign-off.

---

## 15 Documentation Discipline

Update documents **in the same task** as the code, without being asked.

| If you change…                                                          | Update…                                     |
| ----------------------------------------------------------------------- | ------------------------------------------- |
| Behavior, roles, rules, scope                                           | PRD (requirement, story, matrix, decisions) |
| Visuals, components, states, copy rules                                 | DESIGN (tokens, component, page layout)     |
| Structure, stack, boundaries, deployment                                | ARCHITECTURE                                |
| Tables, columns, constraints, indexes, policies, retention              | DATABASE                                    |
| Operations, routes, errors, limits, integrations, environment variables | API                                         |
| Working rules                                                           | This file                                   |

- Keep document tables consistent: IDs (A-nn, D-nn, DD-nn, AA-nn, AD-nn, DBA-nn, DBD-nn, APA-nn, APD-nn) are never reused; approved decisions are marked **Approved** with the date; open ones stay visibly open.
- After a decision change, search all documents for stale wording and fix it.
- **Do not create new markdown files** to describe changes. Update the existing documents. Create a new document only when the user asks.
- Do not claim a feature is implemented, tested or approved unless it is. Do not fabricate approvals, test results or measurements.
- Keep the README current with real setup and run instructions once code exists.
- Add the file's header comment, and list new files in the structure section of ARCHITECTURE when they introduce a new folder or module.

---

## 16 Git and Release Rules

The personal instructions cover worktree safety, focused changes, approvals and safeguards. Project additions:

- Work on a branch named for the task (e.g., `module-visitor/approval-flow`), not directly on the main branch.
- Follow the approval sequence and per-commit/full-release gates in [root AGENTS.md](../AGENTS.md#commit-and-release-workflow); do not duplicate or weaken that workflow here.
- Commit messages follow [.vscode/settings.json](../.vscode/settings.json); put relevant plan, requirement or screen IDs (e.g., `P0.6`, `VIS-4`, `G-02`) in a bullet, not the subject.
- Releases follow ARCHITECTURE 19: migrations before code, backward-compatible, modules shipped dark and enabled per society.

---

## 17 Local Tooling and Protected Paths

Windows and PowerShell practices come from the owner's personal Copilot instructions. Project additions:

- Use the manifest scripts and [local setup guide](./LOCAL_SETUP.md), including the disposable PostgreSQL runner for database tests. Plain `npm run test:integration` may skip locally without a configured server; skipped tests are not a pass.
- The personal guardrail reads [.github/copilot-protected.txt](../.github/copilot-protected.txt). It asks before edits to deployment/CI configuration, hosted-database and backup tooling, or `src/core/privileged/`. Secret files, generated files, lockfiles and committed migrations already have shared protection.
- This list requests edit confirmation in Copilot; it does not guard every shell command, replace code review/CI or authorize hosted operations. The managed gitleaks pre-commit hook is installed locally, not committed with the app.

---

## 18 Stop and Ask When…

- A requirement is ambiguous, missing or contradicted by another document.
- The task needs a new dependency, a new top-level folder, a new route, a new table, or a change to a guarantee (privacy, security, money, retention, permissions).
- You would need the privileged database identity, or to relax a rule, header, limit or check.
- You find a secret, real personal data, or a vulnerability.
- The change would delete data, rename widely, or affect shared or production systems.
- The existing code does not match the documents and it is unclear which is right.

When you ask: state the question in plain words, list the options with simple pros and cons, **give your recommendation**, and say what you will do in the meantime (usually: nothing on that part).

---

## 19 Definition of Done (checklist)

- [ ] Task and affected requirement IDs stated; documents read; existing code inspected.
- [ ] Only the necessary files changed; no unrelated edits; no new dependency unless approved.
- [ ] Follows folder structure, layering, naming and design tokens; reuses existing components and patterns.
- [ ] Strict types; inputs validated with the shared schema on the server; no suppressions.
- [ ] Authorization enforced server-side and in the database; module toggle respected.
- [ ] Database changes in forward-only migrations with row-level security, constraints, indexes and generated types; DATABASE.md updated.
- [ ] Operations and routes follow API conventions; API.md updated.
- [ ] Errors handled per the documented codes; reference IDs shown for unexpected failures; nothing sensitive logged.
- [ ] Loading, empty, error and no-permission states present; accessibility requirements met for the part changed.
- [ ] Tests written and passing; real results reported.
- [ ] Header comments present; documents updated; no stale wording.
- [ ] No secrets, real data or debug output; no unresolved questions hidden.
- [ ] Short plain-language report delivered (below).

### Report format (end of each task)

Use the five-part end-of-task report from the owner's personal Copilot instructions: what changed, what to check, what was verified, open questions or risks, documents updated.
