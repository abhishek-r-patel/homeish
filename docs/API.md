# Homeish — API Design (API.md)

| Field      | Value                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Product    | Homeish (PRD D-01 approved 2026-11-09)                                                                           |
| Version    | 0.1 (Draft for approval)                                                                                         |
| Date       | 2026-11-09                                                                                                       |
| Depends on | [PRD.md](./PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [DESIGN.md](./DESIGN.md) |
| Covers     | Every way data moves: browser to server, server to database, and server to outside services                      |

**Conventions**

- **[APA-nn]** = API assumption. **[APD-nn]** = API decision (Section 16).
- This file defines contracts in tables and prose. It contains no code. Names are the contract: an operation, route or error code listed here may only change through this document.
- "Role" letters used below: **D** developer, **A** admin, **C** committee (read-only unless also A), **G** guard, **H** housekeeping supervisor (post-MVP), **R** resident (owner/tenant/family, further limited per unit as in the PRD matrix).
- Where PRD and this file disagree on behavior, the PRD wins.

---

## 1. Principles

1. **There is no public API.** Homeish does not offer an API to partners or other apps (PRD out of scope). Everything below is internal, plus the connections to outside services.
2. **The browser is untrusted.** Every operation re-verifies who the caller is, which society they act in, whether the module is on, their role and ownership of the data — on the server and again in the database (ARCHITECTURE 8.2).
3. **Few doors.** Normal pages and forms use _server operations_ (Section 5). A small set of HTTP routes exists only where an outside system, a file or a scheduler needs one (Section 6).
4. **One shape for answers and errors** across every operation (Section 3).
5. **Secrets never reach the browser** (Sections 11 and 13).
6. **Every outside call is fault-tolerant**: timeout, limited retry, clear fallback, and a log entry with the request ID (Section 14).
7. **Define only what is needed.** No endpoint exists "just in case".

### 1.1 Interface types

| Type                                                                     | Used for                                                                            | Caller                             | Authenticated by                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| **Server operation** (Next.js Server Action)                             | All reads that change with user input and all writes from the app screens           | Our own screens only               | Session cookie, verified server-side on every call     |
| **Page data loading** (Server Components calling server query functions) | All screen data on first load                                                       | Our own pages                      | Same session                                           |
| **HTTP route** (Route Handler)                                           | Health, daily job, push registration, client error reports, file URLs and downloads | Browser, scheduler, uptime monitor | Per route (Section 6)                                  |
| **Realtime channel** (Supabase Realtime)                                 | Live status hints for visitor, delivery and notifications                           | Signed-in browsers                 | Session; row access decided by the same database rules |
| **Auth service calls** (Supabase Auth)                                   | Sign-in codes, developer password + MFA, session refresh                            | Our server on behalf of the user   | Rate limited; closed sign-up                           |
| **Outbound calls**                                                       | Email (Brevo), Web Push, Sentry, file storage                                       | Our server only                    | Server-held secrets                                    |

---

## 2. Authentication and Authorization

### 2.1 Sign-in (PRD CORE-1, D-03)

| Step | Operation                                                  | Rules                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `auth.requestCode` (email, purpose `signin` or `register`) | Always answers with the same generic message ("If this email is registered, a code has been sent") whether or not the email is known. Sends a 6-digit code by email only if the email has an invitation/membership (`signin`) or the caller is in the registration flow (`register`, Section 5.1). Closed sign-up: an email with neither never gets a society |
| 2    | `auth.verifyCode` (email, code)                            | Code is single use and short-lived; 5 wrong tries invalidate it. Sign-in links eligible invitations; registration starts a session without granting society access                                                                                                                                                                                            |
| 3    | Redirect                                                   | Based on state: no active membership → "waiting for approval" / registration screen; several societies → society picker (S-03); otherwise the home screen. Redirect targets are chosen by the server from a fixed list, never from a client-supplied address                                                                                                  |
| —    | `auth.signOut`                                             | Ends the session                                                                                                                                                                                                                                                                                                                                              |

There are **no magic links**: the email template contains only the six-digit code, which is typed in and expires after 10 minutes. The server keeps a private, hashed-email challenge with an atomic five-failure lockout; a new code starts a new challenge. No callback URL or open-redirect target is used. For registration, the caller supplies an active society code; the response remains generic whether the code is valid or not. The verified challenge is bound to the code, and completing sign-in does not grant society access until an administrator approves the later registration request. Future methods (mobile OTP, passwords, Google) are added as extra `auth.*` operations without changing user data (PRD A-35).

For `signin`, the server checks `public.has_signin_access(email)` through the service-role boundary; that function returns only a boolean and is not callable by clients. After code verification, the authenticated session calls `public.claim_memberships()` to activate and link eligible invitations before loading the request context. Both eligible and ineligible addresses receive the same request-code response; provisioning or delivery failures are logged without changing that response. Malformed input and rate limits remain explicit errors.

### 2.2 Developer sign-in

`auth.developerSignIn` (email + password) followed by `auth.developerVerifyMfa` (authenticator code) on a separate screen/route (S-05). Enrollment is available only after password authentication for an existing developer account. Developer access is bound to the Supabase session ID, expires four hours after that session was created, and requires TOTP verification within the previous 15 minutes; otherwise it fails with `MFA_REQUIRED`. Developer accounts are created only by a database administrator (ARCHITECTURE 8.1).

### 2.3 Session

- Secure, HTTP-only, same-site cookies; society sessions retain the configured 30-day lifetime, while developer authorization expires four hours after the auth session begins.
- On every operation the server **verifies the user with the auth service** (not just reads the cookie) and then loads the **request context**: user, active society, roles, enabled modules (ARCHITECTURE 6.2).
- The active society is a hint chosen in the switcher (`session.switchSociety`); it is always re-validated against current memberships, so removing someone's role takes effect on their next request.
- `session.get` returns the signed-in profile and only its active or pending societies. The notification badge reads the current user's unread count directly under RLS and refreshes from the user's Realtime channel.
- After session expiry, the return path is restricted to local `/session`, `/resident`, `/guard`, `/admin`, or `/developer` routes. External and unsupported destinations are discarded.

### 2.4 Shared gate account: guard identity (PRD CORE-16)

- In shared mode the shared login is a normal guard membership; on top of it, `guards.identify` records _which roster guard is on duty_.
- Name-pick mode: select a roster name. PIN mode: enter the personal PIN, checked against the stored hash with attempt limits (Section 10).
- The result is stored in a **short signed cookie** (12-hour maximum, tied to the session and society, signed with `GUARD_SESSION_SECRET`). Every gate operation (visitor/delivery create, check-in/out, override) reads the guard from this cookie and stores the roster ID on the record. If it is missing or expired the operation fails with `GUARD_NOT_IDENTIFIED`, and the screen shows the "Handled by" prompt (DESIGN 12.2).
- In individual mode the roster entry is resolved from the signed-in guard's membership automatically.

### 2.5 Authorization pipeline (every operation, in this order)

1. **Authenticated?** else `UNAUTHENTICATED` / `SESSION_EXPIRED`.
2. **Developer operations:** MFA level, else `MFA_REQUIRED`.
3. **Society state:** `suspended` → reads only (writes `SOCIETY_SUSPENDED`); `archived` → `SOCIETY_ARCHIVED`.
4. **Module enabled** for the society, else `MODULE_DISABLED` (also enforced in the database).
5. **Role permission** from the PRD matrix (one code map is the source for both operation checks and UI visibility).
6. **Ownership/scope:** own unit, own request, own submission, assignee, etc. A record the caller may not see is reported as `NOT_FOUND` (never reveals that it exists).
7. **Database check:** the operation then runs under the caller's own database identity, so row-level security applies again. Operations that use a privileged identity are limited to the list in ARCHITECTURE 8.4.

Cross-society access never exists for non-developers. A society ID sent by the client is never trusted on its own; it must match an active membership.

---

## 3. Conventions

### 3.1 Naming

Operations are named `area.verbNoun` in lower camel case, e.g. `visitor.decide`, `billing.confirmPayment`. Areas: `auth`, `session`, `profile`, `registration`, `society`, `structure`, `members`, `guards`, `notifications`, `jobs`, `audit`, `developer`, `visitor`, `delivery`, `billing`, `request` (service requests). Routes under `/api/...` use lower-case nouns.

### 3.2 Response envelope (all server operations and JSON routes)

| Case    | Shape                                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Success | `ok: true`, `data` (the result), optional `meta` (pagination, server time)                                                                                                                                                              |
| Failure | `ok: false`, `error` with `code`, `message` (plain language, safe to show), optional `fieldErrors` (field → message), optional `reason` (`CONFLICT` only), optional `referenceId` (for unexpected errors), optional `retryAfterSeconds` |

- Expected failures are **returned**, never thrown to the user. Unexpected failures are caught at the boundary, logged, and returned as `INTERNAL_ERROR` with a `referenceId` (PRD LOG-2).
- Messages never include stack traces, SQL, internal IDs of other records, or whether another user's data exists.

### 3.3 Data formats

| Type               | Format                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Field names        | `camelCase` in requests and responses                                                                                                   |
| IDs                | UUID strings                                                                                                                            |
| Timestamps         | ISO 8601 in UTC (`2026-11-09T12:30:00Z`); the screen converts to the society timezone                                                   |
| Dates without time | `YYYY-MM-DD` (bill due date, billing period start)                                                                                      |
| Money              | Integer **paise** (`amountPaise`); the currency comes from the society. Screens format it; the API never returns rounded rupee decimals |
| Enumerations       | Lower-case snake_case, identical to the database check values (DATABASE Sections 3–7)                                                   |
| Optional values    | Explicit `null`, not omitted                                                                                                            |
| Text               | UTF-8, trimmed, no HTML; length limits as in DATABASE                                                                                   |
| Phones/emails      | Emails lower-cased and trimmed; phones normalised to `+91…` format                                                                      |

### 3.4 Validation

- Every operation and route validates its input with a **shared schema** (the same one the form uses); unknown fields are rejected, strings are trimmed and length-limited, enumerations are closed lists, numbers have ranges.
- Validation failures return `VALIDATION_FAILED` with `fieldErrors` in plain language (DESIGN 7.2).
- The database constraints (DATABASE Section 8) are the final backstop; a constraint violation that slips through is mapped to the right conflict or validation code, not shown raw.
- Files: type, size and count are validated before issuing an upload URL **and** again when the upload is attached (Section 6, files).

### 3.5 Error codes

| Code                   | When                                                                 | HTTP status (routes)        | Screen behavior                                         |
| ---------------------- | -------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------- |
| `VALIDATION_FAILED`    | Bad or missing input                                                 | 400                         | Field errors, input preserved                           |
| `UNAUTHENTICATED`      | No valid session                                                     | 401                         | Go to sign-in                                           |
| `SESSION_EXPIRED`      | Session ended                                                        | 401                         | Session-ended page, return to destination after sign-in |
| `MFA_REQUIRED`         | Developer action without recent MFA                                  | 401                         | MFA prompt                                              |
| `FORBIDDEN`            | Role or scope denied                                                 | 403                         | "You don't have access"                                 |
| `NOT_FOUND`            | Missing or not visible                                               | 404                         | Not-found state                                         |
| `MODULE_DISABLED`      | Module off for the society                                           | 403                         | Module-disabled page                                    |
| `SOCIETY_SUSPENDED`    | Write while suspended                                                | 403                         | Read-only banner                                        |
| `SOCIETY_ARCHIVED`     | Any access to an archived society                                    | 403                         | Blocked page                                            |
| `CONFLICT`             | State no longer allows the action. Always carries a `reason` (below) | 409                         | Specific message and next step                          |
| `RATE_LIMITED`         | Too many attempts                                                    | 429 (+ `retryAfterSeconds`) | Wait message with time                                  |
| `GUARD_NOT_IDENTIFIED` | Shared gate account without an identified guard                      | 403                         | "Handled by" prompt                                     |
| `INTEGRATION_FAILED`   | An outside service failed and no fallback exists                     | 502/503                     | Retry or pending state per DESIGN 9.3                   |
| `INTERNAL_ERROR`       | Anything unexpected                                                  | 500                         | Error panel with reference ID                           |

`CONFLICT` reasons (closed list): `already_decided`, `expired`, `duplicate_reference` (UTR), `duplicate_charge`, `stale_version`, `invalid_state`, `limit_reached`, `has_history` (delete blocked), `not_unpaid` (cancel blocked).

The shared error model in `src/core/errors/` owns the closed error-code and conflict-reason lists, safe default messages, HTTP status mapping, response envelopes and UUID request-ID validation. An incoming `x-request-id` is preserved only when it is a valid UUID; otherwise the server generates one.

### 3.6 Idempotency and double submission

- Operations that create user-submitted records (`visitor.createEntry`, `delivery.createEntry`, `billing.submitPayment`, `request.create`, `request.addComment`) take a **`clientRequestId`** generated once per form open. A repeat with the same ID returns the original result instead of creating a second record (DATABASE 1.1).
- Operations with a natural rule are protected by the database instead: UTR uniqueness, one bill line per unit/period/charge type, one late fee per overdue bill and month, first-response-wins decisions.
- State-changing operations on an existing record (confirm payment, decide visitor, waive) are **safe to repeat**: a second call returns `CONFLICT` with reason `already_decided`/`invalid_state` and the current status, never a second effect.
- The submit button also goes into a loading state (DESIGN 6.1), but that is a convenience, not the protection.

### 3.7 Concurrent edits

Edit operations on data several people can change (requests, resident records, charge types, society and module settings) accept the record's last-seen **`version`** (its `updated_at`). If it no longer matches, the operation returns `CONFLICT/stale_version` and the screen offers Reload with the typed input kept (DESIGN 9.4).

### 3.8 Pagination, sorting and filtering (lists)

| Item                     | Rule                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paging                   | `page` (from 1) and `pageSize` (allowed 10, 25, 50, 100; default 25). Response `meta`: `page`, `pageSize`, `total` (exact), `totalPages` — as DESIGN 6.13 requires                  |
| Sorting                  | `sort` and `dir` (`asc`/`desc`) from an allow-list per list; a stable tie-breaker (record ID) is always added; unknown values are rejected                                          |
| Filtering                | Allow-listed filters per list (below). Filters and sorting run over the **whole authorised data set before paging**, with exact totals                                              |
| Text search              | Literal, case-insensitive "contains" match; wildcard characters are escaped; length-limited (2–60)                                                                                  |
| Dates                    | `from` inclusive, `before` exclusive, interpreted in the **society timezone** **[APA-01]**; cross-society developer error and audit filters use **Asia/Kolkata (IST)** **[APA-07]** |
| Personal data in filters | Emails, phone numbers and payment references are searched through the operation's **body**, not the page URL, so they never appear in links, logs or browser history **[APA-02]**   |
| State in the URL         | Non-personal filters, sort and page live in the page URL so refresh, back and sharing work (DESIGN 6.14)                                                                            |
| Large logs               | Error and audit logs use the same page/total model in MVP; a cursor model is introduced only if they pass roughly 100,000 rows (ARCHITECTURE Section 3)                             |

| List                    | Allowed filters                                                                 | Default sort                                         |
| ----------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Visitor log             | date range, unit, status, purpose, visitor name contains, source                | newest first                                         |
| Delivery log            | date range, unit, status, company, type                                         | newest first                                         |
| Members / residents     | role, status, unit, name contains, relationship                                 | name                                                 |
| Bills                   | unit, status (incl. overdue), kind, period, due date range                      | due date, newest first                               |
| Payments / review queue | status, unit, mode, date range, reference contains (body)                       | oldest awaiting first in the queue; otherwise newest |
| Ledger                  | unit (required), date range                                                     | oldest first (running balance)                       |
| Service requests        | status, category, unit, assignee, priority, overdue, date range, location type  | newest first                                         |
| Notifications           | unread only                                                                     | newest first                                         |
| Jobs                    | type, status                                                                    | newest first                                         |
| Audit log               | society, actor, action, entity type, date range                                 | newest first                                         |
| Error log               | society, module, severity, status, source, user, date range, text, reference ID | newest first                                         |

---

## 4. Rules Common to All Write Operations

1. Run the authorization pipeline (2.5).
2. Validate input (3.4); check `version` where applicable (3.7).
3. Perform the change in **one database transaction** using the matching SQL function (DATABASE 13.3) so related rows, notification rows and the audit entry commit together or not at all.
4. After commit, send best-effort side effects (push, email) — their failure never rolls back or fails the user's action (Section 14).
5. Return the new state of the record so the screen can update without a guess.
6. Audit-worthy actions (PRD LOG-4) always write an audit row in step 3, with `reason` where the PRD requires one.

---

## 5. Server Operations Catalogue

"DB function" names the transactional routine (DATABASE 13.3) or "direct" for simple row-level-secured writes. Reads are shown as `.list` / `.get`.

### 5.1 Authentication, session and registration (`auth`, `session`, `profile`, `registration`)

| Operation                                         | Who                          | Purpose                                                                 | Notes                                                                                 |
| ------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `auth.requestCode`                                | Anyone                       | Send a sign-in or registration code                                     | Generic answer; rate limited; Section 2.1                                             |
| `auth.verifyCode`                                 | Anyone                       | Check the code and start a session                                      | Links invited memberships                                                             |
| `auth.signOut`                                    | Signed in                    | End session                                                             |                                                                                       |
| `auth.developerSignIn`, `auth.developerVerifyMfa` | D                            | Developer sign-in with MFA                                              | Separate route                                                                        |
| `session.get`                                     | Signed in                    | Current user, active/pending societies, roles and enabled modules       | Includes the current user's unread notification count                                 |
| `session.switchSociety`                           | Signed in                    | Change active society                                                   | Validated against memberships                                                         |
| `profile.update`                                  | Signed in                    | Change own name, phone, photo, font preference                          | Direct on own row; preference is `manrope_sora` or `device_default`                   |
| `registration.lookupSociety`                      | Anyone (code holder)         | Resolve a **society code** to the society name and its unit picker data | Code must match; rate limited; returns only name, blocks and unit numbers **[APD-1]** |
| `registration.submit`                             | Signed in, no membership yet | Ask to join a unit                                                      | Creates a pending membership and occupancy; notifies admins (CORE-9)                  |

Registration proceeds in three steps: a code lookup returns only the named society and its active blocks/units; the applicant requests and verifies an email code with `purpose: register` and the same `joinCode`; then the signed-in applicant submits `{ joinCode, unitId, fullName, relationship }`. The code is revalidated at submission. The request creates pending membership and occupancy rows, notifies society admins, and grants no access until approval. Lookup is limited to 10 requests/hour and 30/day per IP; submission is limited to 3/day per signed-in account. Unknown, malformed, disabled or rotated codes do not expose a society directory.

### 5.2 Society structure and people (`society`, `structure`, `members`, `guards`)

| Operation                                            | Who                               | Purpose                                                             | DB function / notes                                                                                          |
| ---------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `society.get`                                        | Members, D                        | Society profile and settings                                        |                                                                                                              |
| `society.updateProfile`                              | A, D                              | Name, address, contact, logo, timezone, custom unit label           | Whitelisted columns; unit label is 1–24 letters or spaces; audited                                           |
| `society.updateGateSettings`                         | A, D                              | Gate login mode and guard identification (name pick / PIN)          | Audited                                                                                                      |
| `society.rotateJoinCode` / `society.disableJoinCode` | A, D                              | Create/replace/turn off the society code used for self-registration | Audited **[APD-1]**                                                                                          |
| `structure.blocks.list/create/update`                | A (create/update), members (list) | Manage blocks                                                       | Direct                                                                                                       |
| `structure.units.list/create/update/deactivate`      | A, members (list)                 | Manage units; deactivate only, never delete with history            | Direct; `has_history` conflict                                                                               |
| `structure.units.importPreview` / `importConfirm`    | A                                 | CSV import of units in two steps                                    | 512 KB / 1,000-row limit; preview writes nothing; confirm creates a job with a downloadable row-error report |
| `members.list/get`                                   | A, C                              | People of the society                                               | Phone numbers are masked; invitations and occupancy are shown per Section 13                                 |
| `members.invite`                                     | A                                 | Invite by email to a unit and role(s)                               | Creates invited membership and pending occupancy atomically; family is not an approver by default            |
| `members.importPreview` / `importConfirm`            | A                                 | CSV import of residents                                             | 512 KB / 1,000-row limit; preview writes nothing; confirm creates invited memberships and a results job      |
| `members.approve` / `members.reject`                 | A                                 | Decide a self-registration                                          | Audited; notifies the applicant                                                                              |
| `members.changeRoles`                                | A                                 | Change roles                                                        | Audited (PRD LOG-4)                                                                                          |
| `members.deactivate`                                 | A                                 | Remove access immediately                                           | Audited; history kept (CORE-10)                                                                              |
| `members.unit.assign/move/end`                       | A                                 | Occupancy: owner/tenant/family, primary, approver flag              | Audited; preserves move-out history and enforces one active primary per unit                                 |
| `household.members.list/setApprover`                 | R (owner/primary)                 | See and manage own household approvers                              | Own active units only; changes are audited (R-08)                                                            |
| `profile.update`                                     | Signed-in user                    | Update name, phone and saved font preference                        | Self only; email and account status are read-only                                                            |
| `guards.list/add/update/deactivate`                  | A (write), A/C/G (list)           | Guard roster                                                        | Direct on name/active                                                                                        |
| `guards.setPin`                                      | A                                 | Set or reset a guard's PIN                                          | PIN stored only as a hash; never returned                                                                    |
| `guards.identify`                                    | G (shared mode)                   | Say who is on duty                                                  | Name-pick or PIN; five failures lock the guard for 15 minutes (Section 2.4)                                  |
| `guards.unitContacts`                                | G                                 | Name and phone of a unit's approvers for "Call Resident"            | Returns only active approvers' names and phone numbers for the selected unit                                 |

### 5.3 Notifications and jobs

| Operation                                   | Who                   | Purpose                                                                                                                 |
| ------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `notifications.list` / `unreadCount`        | Signed in             | Own inbox and badge                                                                                                     |
| `notifications.markRead` / `markAllRead`    | Signed in             | Own items only                                                                                                          |
| `/api/push/subscriptions` `POST` / `DELETE` | Signed in             | Register or remove this user's device; endpoint host is allow-listed and key columns are never readable through the API |
| `jobs.list/get`                             | Creator, A, D         | Progress and result of imports, bill generation, exports                                                                |
| `audit.list/get`                            | A, C (own society), D | Audit history with filters (Section 3.8)                                                                                |

Push subscription requests use `POST { endpoint, keys: { p256dh, auth } }` and `DELETE { endpoint }`. Requests must be same-origin JSON; endpoints are limited to supported HTTPS push providers, are rate-limited per user, and can never be listed by an API role. Up to ten endpoints may be registered for one signed-in user.

### 5.4 Developer console (`developer`)

All require MFA (2.2). All actions are audited.

| Operation                                     | Purpose                                     | Notes                                                                                                                     |
| --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `developer.societies.list/get/create/update`  | Manage societies                            | Creation also creates the `core` module row and default settings; request categories are added in P8 (DATABASE 14.2)      |
| `developer.societies.setStatus`               | Trial / active / suspended / archived       | Standard confirmation stating the consequence for suspend/archive (DESIGN 11.4)                                           |
| `developer.modules.list` / `toggle`           | Show and enable/disable modules per society | One transaction with audit; standard confirmation states the effect                                                       |
| `developer.modules.updateSettings`            | Edit module settings                        | Validated against the module's schema                                                                                     |
| `developer.members.createFirstAdmin`          | Invite the first admin of a society         |                                                                                                                           |
| `developer.errors.list/get/lookupByReference` | Error log viewer                            | Filters include society, module, severity, status, source, user, text and IST date range; lookup by reported reference ID |
| `developer.errors.resolve` / `ignore`         | Change error status with optional note      | The record and its detail view are refreshed after the audited update                                                     |
| `developer.audit.list`                        | Cross-society audit                         | Filters include society, actor, action, entity type and IST date range; shows before/after values                         |
| `developer.health.summary`                    | Counts by severity, society and route       | Built from errors logged in the last 24 hours                                                                             |

### 5.5 Visitor (`visitor`)

| Operation                              | Who                             | Purpose                                                                         | Notes                                                                                                                           |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `visitor.createEntry`                  | G, A                            | Log a walk-in; notifies unit approvers                                          | `clientRequestId`; blacklist warning returned in the response; needs identified guard                                           |
| `visitor.decide`                       | R (approver of the unit)        | Allow or deny                                                                   | First response wins; `already_decided` conflict if late                                                                         |
| `visitor.override`                     | G                               | Allow after no response                                                         | Requires reason; only if setting allows; audited                                                                                |
| `visitor.checkIn` / `visitor.checkOut` | G, A                            | Record entry and exit                                                           | Check-in only from `approved`                                                                                                   |
| `visitor.list/get`                     | G, A, C (society); R (own unit) | Logs per Section 3.8                                                            | Live "waiting" and "inside now" views use the same list                                                                         |
| `visitor.preApproval.create`           | R                               | Pre-approve a visitor; returns the 6-digit code and a QR encoding the same code | Code remains available for manual sharing and entry                                                                             |
| `visitor.preApproval.cancel` / `list`  | R (own), A/C                    | Cancel or list                                                                  |                                                                                                                                 |
| `visitor.preApproval.validate`         | G                               | Check a typed or scanned code                                                   | Returns only the matching visitor's name, unit and window, or a distinct reason: invalid / expired / already used; rate limited |
| `visitor.preApproval.checkIn`          | G                               | Create the entry from a valid code and mark the code used                       | Single use                                                                                                                      |
| `visitor.blacklist.list/add/remove`    | A (write), A/C/G (list)         | Manage blacklist                                                                | Warn only (A-12)                                                                                                                |
| `visitor.settings.get/update`          | A                               | Read and change timeout, overstay, photo, phone and override rules              | Updates are audited; writes are denied for suspended societies                                                                  |

### 5.6 Delivery (`delivery`)

| Operation                      | Who                                 | Purpose                                    | Notes                                                                                  |
| ------------------------------ | ----------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `delivery.createEntry`         | G, A                                | Log a delivery                             | Applies the unit's standing rule automatically; photo attachment is rechecked          |
| `delivery.respond`             | R (approver)                        | Allow / leave at gate / deny               | First response wins; leave-at-gate is rejected when disabled                           |
| `delivery.override`            | G                                   | Decide or close after no response          | Requires an identified guard, expired response window and reason; audited and notified |
| `delivery.markCollected`       | G, R (own unit)                     | Mark a parcel collected                    | Only from `left_at_gate`; timestamp and actor are recorded                             |
| `delivery.list/get`            | G, A, C; R (own unit)               | Logs; includes the uncollected-parcel view | Society threshold and timezone are applied by the database                             |
| `delivery.preference.get/set`  | R (approver of own unit), A/C (get) | Read or change a unit standing rule        | Writes require an active unit approver                                                 |
| `delivery.settings.get/update` | G/A/C (get), A (update)             | Read and update delivery module settings   | Timeout, uncollected threshold and leave-at-gate toggle; writes are audited            |

### 5.7 Billing (`billing`)

| Operation                                       | Who                                          | Purpose                                                      | Notes                                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `billing.charges.list/create/update/deactivate` | A (write), A/C (list)                        | Charge types                                                 | P7A: checked RPCs; writes and audit commit together; deactivation retains history                                                                               |
| `billing.bills.preview`                         | A                                            | Show per-unit totals before generating                       | Read-only                                                                                                                                                       |
| `billing.bills.generate`                        | A                                            | Create bills for a period/selection                          | Runs as a job; set-based; idempotent by the unit/period/charge rule; applies existing unit credit automatically (DATABASE 6.1); notifies residents after commit |
| `billing.fines.add`                             | A                                            | Add a manual fine                                            | Reason required; audited                                                                                                                                        |
| `billing.bills.waive`                           | A                                            | Waive part or all of a bill, or cancel it                    | Reason required; blank amount waives the full outstanding; `not_unpaid` for cancel after payment; audited                                                       |
| `billing.bills.list/get`                        | A, C; R (own unit)                           | Bills and detail                                             |                                                                                                                                                                 |
| `billing.ledger.get`                            | A, C; R (own unit)                           | Unit statement with running balance                          |                                                                                                                                                                 |
| `billing.paymentDetails.get`                    | Members                                      | Society UPI ID, payee, QR path, last changed                 | Residents need it to pay                                                                                                                                        |
| `billing.paymentDetails.update`                 | A                                            | Change UPI details                                           | P7A: validates UPI ID and optional private QR; requires the last-read version; audited; notifies all admins and committee (BIL-15)                              |
| `billing.submitPayment`                         | R                                            | Submit UPI reference (+ optional screenshot path) for a unit | `clientRequestId`; UTR uniqueness; status `awaiting_confirmation`; notifies admins                                                                              |
| `billing.recordPayment`                         | A                                            | Record cash/cheque/bank/UPI received                         | Confirmed immediately; receipt number issued                                                                                                                    |
| `billing.confirmPayment`                        | A                                            | Confirm a submission (may correct the amount)                | Allocates oldest-first; ledger credit; receipt; notifies payer; amount change audited                                                                           |
| `billing.rejectPayment`                         | A                                            | Reject with reason                                           | Resident may resubmit                                                                                                                                           |
| `billing.payments.list/get`                     | A, C (all); R (own unit and own submissions) | Payments and the review queue                                |                                                                                                                                                                 |
| `billing.dashboard`                             | A, C                                         | Billed, collected, outstanding, collection %, top defaulters | Read-only aggregate                                                                                                                                             |
| `billing.reports.export`                        | A, C                                         | CSV: dues by unit, collections, defaulters                   | Runs as a job; audited as an export (LOG-4); formula-safe cells                                                                                                 |

P7 implements the full billing module. Admin billing lives at `/admin/billing`, with tabs for Bills, Payments, Fines, Reports, Charge Types and Payment Settings, plus `/admin/billing/generate`, `/admin/billing/bills/{billId}` and `/admin/billing/units/{unitId}` (ledger). Residents use `/bills` (Bills, Ledger and Payments tabs), `/bills/{billId}` and `/bills/pay`. Committee access and suspended societies are read-only. Waivers and cancellations are made directly by admins with a required reason and an audit entry; the waive and cancel actions sit on the bill detail page. Billing rules (due day, grace days, late fee, reminders, alert days) are developer-configured; there is no settings editor in this milestone. Database errors map to `CONFLICT` reasons such as `not_unpaid` and `duplicate_reference`. Successful payment confirmations and recordings email the receipt to the payer; email failure is logged and never fails the confirmation.

Payment screenshots use `/api/files/upload-url` with `bucket: "payment-proofs"`, a `unitId`, an image content type and size. The caller needs `billing:payments:submit` and an **active occupancy of that unit through their own active membership**; an admin role alone is not enough. Paths are `{society_id}/{unit_id}/payments/{random_uuid}.jpg|png`. Viewing a proof through `/api/files/url` is limited to admins and committee.

The daily runner calls billing tasks in this order: `late_fees`, `reminders`, `stale_payments`, followed by visitor expiry, service-request auto-close and global retention (DATABASE 6.10, 7 and 11.3).

`billing_charge_save` accepts `p_id` (null when creating), `p_name`, `p_method`, integer `p_amount_paise` (null only for `custom`), `p_active`, `p_expected_updated_at` and `p_request_id`, with society derived from the session at the server boundary. The shared form schema converts decimal rupee text to exact safe-integer paise without floating-point multiplication. Updating or deactivating a charge never edits an existing bill.

`billing_payment_details_get` returns null when no account is configured, otherwise the UPI ID, payee name, QR path, update timestamp and changing administrator's name. `billing_payment_details_update` accepts the last-read `p_expected_updated_at` (null for the first save); concurrent or stale saves return `CONFLICT`. Changed values, audit and team inbox notifications commit together; an unchanged save creates no new audit or notification. Push delivery happens after commit and never includes account details.

For private QR uploads, `/api/files/upload-url` accepts `bucket: "society-assets"` and `purpose: "billing-qr"` with the current `societyId`, image content type and size. Omitting purpose preserves the logo contract. Only an authorized administrator of a writable, billing-enabled society can upload; JPG/PNG and 5 MiB limits are rechecked on attachment. `/api/files/url` permits members to view the published QR and administrators to preview pending images. DELETE on the upload-url route removes only unattached QR images. A saved QR cannot be overwritten or deleted. Failed old-image cleanup is reported as a saved-with-warning outcome, not a failed save.

### 5.8 Service requests (`request`)

| Operation                                 | Who                                                | Purpose                                                  | Notes                                                                                              |
| ----------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `request.categories.list/create/update`   | Members (list), A (write)                          | Category list and SLA hours                              | Category edits use an optimistic `expectedUpdatedAt`                                               |
| `request.create`                          | R, A                                               | Raise a request (unit or common area)                    | `clientRequestId`; up to 3 attachments; computes SLA due time; notifies admins                     |
| `request.list/get`                        | A, C (all); R (own unit and common-area); assignee | Lists and detail with comments, attachments and timeline |                                                                                                    |
| `request.assign`                          | A                                                  | Assign to a member or an external vendor (name + phone)  | Writes a timeline event                                                                            |
| `request.updateStatus`                    | A, assignee (if a user)                            | Move to in progress / resolved                           | Valid transitions only                                                                             |
| `request.reject`                          | A                                                  | Reject with reason                                       | Reason required                                                                                    |
| `request.confirmClose` / `request.reopen` | R (requester)                                      | Close or reopen within the allowed days                  | Auto-close by the daily job after the society's days                                               |
| `request.rate`                            | R (requester)                                      | 1–5 stars and comment after closing                      | Once                                                                                               |
| `request.addComment`                      | R (requester), A, assignee                         | Comment thread                                           | `clientRequestId`; notifies the other side; residents reading a common-area request cannot comment |

Residents use `/requests`, `/requests/new` and `/requests/{requestId}`. Admins and committee members use `/admin/requests` for filtering and dashboard reports; admins can also manage categories, assign requests, update statuses and reject with a reason. Request detail displays the timeline and signed photo links only to users authorized for the parent request.

---

## 6. HTTP Routes

| Route                               | Method       | Caller                      | Authentication                                                                                                                                                                                                             | Purpose                                                                                                                                                           |
| ----------------------------------- | ------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`                       | GET          | Uptime monitor              | None                                                                                                                                                                                                                       | Returns `ok` when the app and database respond, otherwise 503. **No** version, credentials or internals (NFR-11)                                                  |
| `/api/jobs/daily`                   | GET, POST    | Platform scheduler or operator | Secret bearer token (`CRON_SECRET`, compared in constant time); anything else is rejected with 401 and logged                                                                                                              | Runs the daily jobs (below). Returns only counts per job                                                                                                          |
| `/api/push/subscriptions`           | POST, DELETE | Signed-in browser           | Session                                                                                                                                                                                                                    | Save or remove this device's push subscription; max 10 per user; validated; keys stored server-side only                                                          |
| `/api/client-errors`                | POST         | Browser (may be signed out) | Same-origin, session optional; rate limited                                                                                                                                                                                | Receives only message, stack, path and device summary; body ≤ 8 KB; strict schema; scrubbed; stored in the error log; returns the `referenceId` shown to the user |
| `/api/files/upload-url`             | POST, DELETE | Signed-in browser           | Session + society admin or MFA-verified developer, visitor/delivery create permission for gate photos, billing submit permission plus active occupancy for payment proofs, or request-create permission for request photos | Issues validated owner-scoped upload links; deletes only unattached logos and QR images                                                                           |
| `/api/files/url`                    | POST         | Signed-in browser           | Session + society membership or MFA-verified developer                                                                                                                                                                     | Issues a five-minute logo view link after checking the society and path                                                                                           |
| `/api/billing/receipts/{paymentId}` | GET          | Signed-in browser           | Session + permission (payer, unit occupants, A, C)                                                                                                                                                                         | Streams the receipt PDF for a confirmed payment                                                                                                                   |
| `/api/billing/bills/{billId}`       | GET          | Signed-in browser           | Session + permission                                                                                                                                                                                                       | Streams the bill PDF                                                                                                                                              |
| `/api/exports/{jobId}`              | GET          | Signed-in browser           | Session + the job's creator or A/C of that society                                                                                                                                                                         | Downloads a finished CSV export; file expires with the job                                                                                                        |

Rules for all routes:

- Same-origin only: no cross-origin access is allowed and no CORS headers are sent.
- Browser-originated state-changing routes require a session and reject missing/foreign origins. The authenticated daily-job GET and POST are server-to-server scheduler/manual exceptions.
- Inputs are validated (3.4); responses never contain stack traces; errors use the envelope (3.2) with the status codes in 3.5.
- Binary responses carry `no-store` cache headers and a safe download name (no personal data in the file name).

### 6.1 The daily job (`/api/jobs/daily`)

Vercel Cron sends `GET`; `POST` remains supported for authenticated manual invocation. Both methods require the `CRON_SECRET` bearer token. A missing or incorrect secret returns `401`; the attempt is logged without recording the supplied token. The secret comparison is constant-time. Responses are `no-store` and use the standard JSON envelope; success returns `{ ok: true, data: { jobs: [{ job, succeeded, skipped, failed }] } }`. Only per-job counts are returned.

Runs once a day (the free scheduler tier allows only one run per day and may start up to an hour late; the design tolerates both — ARCHITECTURE AD-02). The period key is the current calendar date in Asia/Kolkata. For each society-scoped task and trial/active society, the runner inserts `(society_id, job_name, period_key)` into `job_run_keys` before invoking the task. A conflict skips the task, so repeated calls for that date do no duplicate work. A global task claims one run key using the first eligible society; if there are no eligible societies, the retention task still runs because its database operations are idempotent. Each task failure is logged and counted without stopping other tasks or societies. A failed task can retry on the next period; it is not retried during the same period. Until modules register tasks, the registry is empty and the endpoint returns an empty `jobs` list without querying societies.

| Task                          | Behavior                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| Late fees                     | Adds one late-fee bill per overdue bill and month per society rule (BIL-3)                   |
| Reminders                     | Due-soon, due-today and overdue notifications (BIL-10)                                       |
| Stale payments                | Flags UPI submissions waiting more than N days and notifies admins (BIL-17)                  |
| Visitor expiry                | Finalises pending entries after their response deadline (VIS-4, VIS-7)                      |
| Delivery overdue view          | Computes pending-response expiry and flags uncollected parcels on read (DEL-5, DEL-7)        |
| Request auto-close            | Closes `resolved` requests after the society's days (SRQ-3)                                  |
| Module reminders (post-MVP)   | AMC expiry, low stock                                                                        |
| Retention                     | Removes expired private files through Storage, then anonymises/deletes rows per DATABASE 11.3; logs affected and orphan-file counts by bucket |
| Backup export                 | When enabled, GitHub Actions encrypts a nightly PostgreSQL 17 dump and uploads it to private Google Drive; weekly storage-file copy remains deferred (DATABASE 15.2) |

A task failure is logged (error log + Sentry) and does not stop the other tasks; the next day's run retries unfinished work because tasks are idempotent.

The off-site database backup runs separately from this route, only on `main` with `GOOGLE_DRIVE_BACKUPS_ENABLED=true`. It uses `SUPABASE_DB_URL`, OAuth `drive.file` credentials, a private app-created folder, and a separate encryption key from GitHub Actions configuration. Matching encrypted archives are retained for 30 days, with pruning only after remote size/checksum verification. It does not use or require the Supabase service-role key. Owner setup and the first verified backup/restore remain pending; see [the Google Drive guide](GOOGLE_DRIVE_BACKUP_SETUP.md).

### 6.2 File upload flow

An authorized admin or MFA-verified developer sends `POST /api/files/upload-url` with `{ bucket: "society-assets", societyId, contentType, sizeBytes }` to upload a logo. A guard/admin with visitor-create permission sends `{ bucket: "visitor-photos", unitId, contentType, sizeBytes }` for a visitor photo; the route checks the enabled visitor module, active unit, society, role, MIME type and size. That path is `{ society_id}/{unit_id}/visitors/{random_uuid}.jpg|png`. A requester sends `{ bucket: "request-files", requestId, contentType, sizeBytes }`; the route requires the enabled request module and `request:create`, and returns a path under `{ society_id}/{user_id}/requests/{client_request_id}/{random_uuid}.jpg|png`. Request IDs are client-generated idempotency keys and are revalidated when the uploaded object is attached to the request. In each case the response contains `{ path, signedUrl }`. The browser uploads directly to that one path with upsert disabled; the signed upload token expires after **two hours**. Only JPEG/PNG images up to 5 MiB are accepted.

The owning operation rechecks the path, object metadata, MIME type and actual size before saving an attachment. Replacing or clearing a logo audits the path change, then removes the former object. To remove an uploaded but unattached logo, send `DELETE /api/files/upload-url` with `{ bucket: "society-assets", path }`; attached logos cannot be deleted through this route. To view a logo, send `POST /api/files/url` with `{ bucket: "society-assets", path }`; an active society member or an MFA-verified developer receives `{ signedUrl, expiresIn: 300 }`. Request detail reads obtain short-lived URLs only after the request RPC has authorized access to its attachments. The file never passes through the application server.

Other bucket/owner combinations are not accepted by these routes. Future owning operations must recheck the exact society-scoped path, object existence, MIME type and actual size before saving an attachment.

---

## 7. Realtime Channels

| Channel         | Table              | Subscribers                         | Purpose                                      |
| --------------- | ------------------ | ----------------------------------- | -------------------------------------------- |
| Visitor status  | `visitor_entries`  | G, A (society); R (rows RLS allows) | Waiting panel, pending approvals, inside-now |
| Delivery status | `delivery_entries` | Same                                | Delivery response and parcel status          |
| Inbox           | `notifications`    | The user only                       | Unread badge                                 |

Rules:

- Events are **hints**: the screen refetches authoritative data through the normal operation after an event.
- Access is decided by the same row rules as normal reads; a user receives nothing they could not fetch directly.
- If the connection drops, the screen switches to polling every 5 seconds (with backoff) and shows "Updated {time}" (DESIGN 8.2).
- No client may publish to channels; all changes come from the database.

---

## 8. External Services and Integrations

Each lives behind one adapter (ARCHITECTURE 12) so it can be replaced.

| Service                          | Purpose                                         | Direction                               | MVP                         | Notes                                                                                                                                      |
| -------------------------------- | ----------------------------------------------- | --------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Supabase Auth**                | Email codes, developer password + MFA, sessions | Server → service                        | Yes                         | Sign-up closed (Section 2.1); email templates carry the 6-digit code, no links                                                             |
| **Brevo (SMTP)**                 | Sends the sign-in codes for Supabase Auth       | Auth service → Brevo                    | Yes                         | SMTP settings entered in the Supabase project; secrets live there, not in our app                                                          |
| **Brevo (email API)**            | Receipts to the payer, developer alerts         | Server → Brevo over HTTPS               | Yes                         | API key server-side only; minimal content (no UPI ID changes in the body, no personal data beyond the recipient's name)                    |
| **Web Push**                     | Visitor, delivery, bill and request alerts      | Server → browser push services          | Yes                         | VAPID-authenticated; payload contains scrubbed title/body and an allow-listed same-origin path, never contact details or subscription keys |
| **Sentry**                       | Error alerts                                    | Browser/Server → Sentry                 | Yes                         | Scrubbed events; user ID and society ID only; no emails or phones                                                                          |
| **Supabase Storage**             | Files                                           | Browser (signed links) and server       | Yes                         | Private buckets only                                                                                                                       |
| **Supabase Database / Realtime** | Data                                            | Server and browser (RLS)                | Yes                         |                                                                                                                                            |
| **UPI link and QR**              | Resident pays the society directly              | Built on the server from stored details | Yes                         | No network call, no payment service; the payee and amount shown are generated server-side                                                  |
| SMS / WhatsApp provider          | Mobile OTP and critical alerts                  | —                                       | **No** (post-MVP, PRD D-06) |                                                                                                                                            |
| Payment gateway                  | Online payment                                  | —                                       | **No** (PRD D-14)           | Would add a webhook route (Section 9)                                                                                                      |

Data sent to each outside party is listed in Section 13.2.

---

## 9. Webhooks and Verification

**MVP has no incoming webhooks** (no payment gateway, no provider callbacks). Two incoming calls exist and are verified:

| Incoming call                                             | Verification                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Scheduler → `/api/jobs/daily`                             | Bearer secret compared in constant time; wrong or missing secret → 401, logged, no work done |
| Browser → `/api/client-errors`, `/api/push/subscriptions` | Same-origin, rate limited; push also requires a session                                      |

**Standard for any webhook added later** (gateway, email bounce events, etc.):

1. Dedicated route with its own secret.
2. Verify the provider's **signature over the raw body** and a timestamp window to block replays.
3. Store the provider's **event ID** with a unique constraint; a repeat is acknowledged and ignored (idempotent).
4. Process in a database transaction; respond quickly; do slow work afterwards.
5. Never trust amounts or statuses from the browser redirect; only the verified webhook (or a server-side status fetch) changes money state.
6. Unknown or invalid events are logged (scrubbed) and answered with a safe status; no details leak.
7. Add the route to Section 6 and its secret to Section 11 in the same change.

Bounced or blocked login emails are checked in the Brevo dashboard in MVP; automated bounce handling is added with a verified webhook only if it becomes a support burden.

---

## 10. Rate Limiting

Counters live in the database (`rate_limits`, ARCHITECTURE AD-05) with hashed keys (no raw emails or IPs). Fixed windows. Exceeding a limit returns `RATE_LIMITED` with `retryAfterSeconds`. The numbers below are starting values, kept as named constants in one place and adjustable without a schema change.

| Operation                           | Limit                                                   | Key                            |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------ |
| `auth.requestCode`                  | 1 per 30 s; 5 per hour                                  | Email + purpose                |
| `auth.requestCode`                  | 20 per hour                                             | IP                             |
| `auth.verifyCode`                   | 5 wrong tries per code (code then invalid); 10 per hour | Email; plus 30 per hour per IP |
| `auth.developerSignIn` / MFA        | 5 attempts per 15 min                                   | Email + IP                     |
| `guards.identify` (PIN)             | 5 failures then 15-minute lock                          | Roster guard                   |
| `visitor.preApproval.validate`      | 10 failures per 10 min; 30 per 10 min                   | Guard session; society         |
| `registration.lookupSociety`        | 10 per hour; 30 per day                                 | IP                             |
| `registration.submit`               | 3 per day                                               | Signed-in account              |
| `billing.submitPayment`             | 10 per hour                                             | User                           |
| `/api/files/upload-url`             | 30 per hour (guards 120)                                | User                           |
| `/api/client-errors`                | 20 per minute                                           | Session or IP                  |
| `/api/push/subscriptions`           | 10 per hour                                             | User                           |
| Exports and reports                 | 5 per hour                                              | User                           |
| Other write operations (soft guard) | 120 per minute                                          | User                           |

- **Fail-safe behavior:** if the counter store is unavailable, security-sensitive limits (sign-in codes, PIN, code validation, society code lookup) **fail closed** (the action is refused with a retry message); the rest **fail open** and the failure is logged.
- **Non-production sign-in limits:** when `NEXT_PUBLIC_APP_ENV` is not `production` (local, preview and staging/beta), the `auth.requestCode` and `auth.verifyCode` hourly and cooldown counters allow 50 per window so testers can sign in and out repeatedly. The per-code wrong-try lock and developer sign-in limits are unchanged, and production keeps the values above.
- **Email quota guard:** each transactional email, including the operational alert, reserves one send against `BREVO_DAILY_EMAIL_QUOTA`; one developer alert is sent at 80% and sends over the configured cap are held. Provider timeouts and 5xx responses receive one retry; all adapter failures are logged without recipient or response-body details and never fail the originating action.
- Reads are not individually limited by the app; platform protection (DDoS, bot rules) is provided by the host.

---

## 11. Required Environment Variables

Names only; values are kept in the host's secret store and never committed (ARCHITECTURE 16.2). **Public** variables begin with `NEXT_PUBLIC_` and are visible in the browser; everything else is **server-only**. A build check fails if a secret-looking name carries the public prefix.

| Variable                                                | Scope                                                        | Purpose                                                                                              | Required in                 |
| ------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------- |
| `NEXT_PUBLIC_APP_ENV`                                   | Public                                                       | `local`, `preview`, `staging`, `production`                                                          | All                         |
| `NEXT_PUBLIC_APP_URL`                                   | Public                                                       | Base URL (used to validate origins and build links)                                                  | All                         |
| `APP_DEPLOYMENT`                                        | Server                                                       | `shared` (default) or `beta`; restricts accepted hosts and Vercel release branch                     | Set explicitly on Vercel    |
| `APP_BASE_DOMAIN`                                       | Server                                                       | Parent hostname without scheme/port; defaults to `homeish.vercel.app`                                | Optional override           |
| `VERCEL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | Server, provider-injected                                    | Disable local hosts on Vercel; allow exact deployment/project aliases for their own environment only | Vercel                      |
| `APP_VERSION`                                           | Server (injected at build)                                   | Version shown in the error log                                                                       | All                         |
| `NEXT_PUBLIC_SUPABASE_URL`                              | Public                                                       | Supabase project URL                                                                                 | All                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                         | Public                                                       | Public client key; safe because the database rules decide access                                     | All                         |
| `SUPABASE_SERVICE_ROLE_KEY`                             | **Server secret**                                            | Privileged identity (only the isolated server module, ARCHITECTURE 8.4)                              | All except local-only tools |
| `SUPABASE_DB_URL`                                       | **Server secret (CI/migrations/backup only, never runtime)** | Direct database connection                                                                           | CI                          |
| `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_DRIVE_BACKUPS_ENABLED` | GitHub Actions variable                                    | Private app-created backup folder; explicit opt-in (default disabled)                                | `main` backup workflow     |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` | **GitHub Actions secret**                 | Own OAuth app and offline `drive.file` authorization, never the Google account password              | `main` backup workflow     |
| `BACKUP_ENCRYPTION_KEY`                                 | **GitHub Actions secret; separate offline recovery copy**    | 32-byte AES-256-GCM key encoded as 64 hex characters; never stored alongside archives                  | Backup/restore tooling    |
| `BREVO_API_KEY`                                         | **Server secret**                                            | Send receipts and alerts                                                                             | Staging, production         |
| `BREVO_DAILY_EMAIL_QUOTA`                               | Server                                                       | Per-deployment daily sending cap; an alert is sent at 80%                                            | Staging, production         |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`                 | Server                                                       | Verified sender                                                                                      | Staging, production         |
| `DEVELOPER_ALERT_EMAIL`                                 | Server                                                       | Where critical alerts go                                                                             | Staging, production         |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                          | Public                                                       | Browser push subscription key                                                                        | All                         |
| `VAPID_PRIVATE_KEY`                                     | **Server secret**                                            | Signs push messages                                                                                  | All                         |
| `VAPID_SUBJECT`                                         | Server                                                       | Contact address for push services                                                                    | All                         |
| `NEXT_PUBLIC_SENTRY_DSN`                                | Public                                                       | Where browser errors go (a DSN is not a secret)                                                      | Staging, production         |
| `SENTRY_DSN`                                            | Server                                                       | Where server errors go                                                                               | Staging, production         |
| `SENTRY_AUTH_TOKEN`                                     | **CI secret**                                                | Uploads source maps                                                                                  | CI                          |
| `CRON_SECRET`                                           | **Server secret**                                            | Authenticates the scheduler on `/api/jobs/daily`                                                     | Staging, production         |
| `GUARD_SESSION_SECRET`                                  | **Server secret**                                            | Signs the on-duty guard cookie                                                                       | All                         |
| `RATE_LIMIT_HASH_SALT`                                  | **Server secret**                                            | Hashes rate-limit keys                                                                               | All                         |

Notes:

- **Brevo SMTP credentials** for sign-in codes are entered in the Supabase project settings, not in this application's environment.
- Limits, retention periods and defaults are constants in code and per-society settings in the database, not environment variables **[APA-03]** (this supersedes the "Feature" row in ARCHITECTURE 16.2).
- Startup validates this list with a schema; a missing or malformed value fails fast with a clear message (names only, never values).
- Local, preview and staging share the non-production `homeish-testdb` Supabase project and its keys (ARCHITECTURE AD-13); the demo uses `homeish-demo` keys only in the `demo-homeish` deployment; production uses `homeish-live`, whose keys live only in the host secret stores and are never used elsewhere (AD-14).
- The public website/entry scaffold makes no backend calls. Hosted scaffolds may use `preview` with nonfunctional `.invalid` backend URLs and placeholder keys, never real society credentials. Do not treat this as staging/production readiness. Full demo and beta backends remain unconfigured.
- D-34 host routing adds no authenticated operations, society lookup API or reset endpoint. Unknown hosts return 404; non-marketing hosts carry `X-Robots-Tag: noindex, nofollow`; host-routed pages are private/no-store. The reserved Maplewood host serves only a disabled `/` placeholder; its other paths return 404, and onboarding and login remain unavailable. A hostname is not a society authorization credential.
- The owner approved resuming scaffold hosting on `homeish.vercel.app` and `beta-homeish.vercel.app`: `beta` deploys to `beta-homeish`, then verified beta merges into `main` to deploy `homeish`. Both projects use their Production target with automatic domain assignment; feature-branch Preview tracking is disabled. `APP_BASE_DOMAIN` remains `homeish.vercel.app`; nested demo/beta example domains are not yet attached. Each project's `NEXT_PUBLIC_APP_URL` must match its approved canonical address before connected workflows are enabled. Scaffold deployment does not provision real integrations or change any API contract.

---

## 12. Authorization Summary per Interface (quick reference)

| Interface                                                      | Who may call                                                               | Society scope  | Extra                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------- | ---------------------------------- |
| `auth.*`                                                       | Anyone (rate limited)                                                      | n/a            | Generic answers; closed sign-up    |
| `session.*`, `profile.*`, `notifications.*`                    | Signed in                                                                  | Own data       |                                    |
| `registration.*`                                               | Anyone with a valid society code; then a signed-in user without membership | One society    | Rate limited                       |
| `society.*`, `structure.*`, `members.*`, `guards.*`, `audit.*` | A (write), C (read), D                                                     | Active society | Role changes and approvals audited |
| `visitor.*`, `delivery.*`                                      | G/A (gate), R (own unit), A/C (read)                                       | Active society | Guard identified; module on        |
| `billing.*`                                                    | A (write), C (read), R (own unit)                                          | Active society | Module on; money actions audited   |
| `request.*`                                                    | R (own), A (manage), C (read), assignee                                    | Active society | Module on                          |
| `developer.*`                                                  | D only                                                                     | Any society    | MFA; audited                       |
| `/api/jobs/daily`                                              | Scheduler                                                                  | All societies  | Secret token                       |
| `/api/health`                                                  | Anyone                                                                     | None           | Status only                        |

---

## 13. Data Privacy in the API

### 13.1 Rules

| Rule                           | Detail                                                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimum data                   | Operations return view-shaped data for the screen (DATABASE 11); no raw table rows; no fields the role does not need                                                                                                                |
| Masking                        | Phones masked (`+91 98••• ••210`) in lists; full number only where an action needs it (guard "Call Resident", resident detail for admin). Applied in the server layer for every response                                            |
| Other people's contact details | Residents never receive another resident's email or phone; comment authors appear by name only                                                                                                                                      |
| Not found vs forbidden         | A record you may not see looks the same as one that does not exist                                                                                                                                                                  |
| Nothing personal in URLs       | IDs only; emails, phones and payment references travel in the request body (APA-02); file names are generic                                                                                                                         |
| Logs                           | The scrubber removes codes, tokens, push keys, PINs, cookies, authorization headers, full phones, document content and UPI/payment references before any log or Sentry event (PRD LOG-5). Request bodies are never logged wholesale |
| CSV and PDF                    | Exports are audited, permission-checked, and CSV cells that begin with `=`, `+`, `-` or `@` are neutralised                                                                                                                         |
| Files                          | Private; short-lived links; never public URLs; never in notifications or emails                                                                                                                                                     |
| Notifications                  | Push and email text carries the minimum (e.g., "Visitor at gate: {name}"), never phone numbers, UPI details or amounts beyond what the recipient needs                                                                              |
| Browser storage                | No personal data or secrets in local storage; only the session cookies and UI preferences                                                                                                                                           |
| Cookies                        | HTTP-only, secure, same-site                                                                                                                                                                                                        |
| Transport and headers          | HTTPS only; strict content security policy; same-origin only; no third-party scripts except the error reporter                                                                                                                      |
| Erasure                        | Handled by the anonymise function (DATABASE 11.2); no API for self-service deletion in MVP (PRD DAT-8)                                                                                                                              |

### 13.2 What each outside party receives

| Party         | Receives                                                                                  | Does not receive                                    |
| ------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Brevo         | Recipient email address, recipient first name, receipt number and amount (receipts only)  | Phone numbers, UPI IDs, visitor data                |
| Push services | Notification title and short body (end-to-end encrypted payload)                          | Unit details beyond the text, personal contact data |
| Sentry        | Error message and stack (scrubbed), route, user ID, society ID, app version, browser type | Email, phone, names, request bodies, codes          |
| Supabase      | All application data (it is the database host)                                            | —                                                   |
| Vercel (host) | Request logs (paths, status, timing)                                                      | Bodies; personal data is kept out of URLs           |
| Scheduler     | Nothing beyond the secret-authenticated call                                              | —                                                   |

**[APA-04]** Choose the Supabase and Vercel regions closest to users (India if available) to support data-protection expectations; confirm availability when creating the projects.

---

## 14. Failure Handling and Fault Tolerance

### 14.1 Timeouts and retries

| Call                          | Timeout                                                                  | Retry                                            | If it still fails                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Database query (user request) | 10 s statement limit                                                     | None automatically                               | Error panel with reference ID; guard sees "Can't reach server" banner (DESIGN 9.3)    |
| Supabase Auth (send code)     | 8 s                                                                      | None (user can request again after the cooldown) | Generic message plus log; never reveals whether the email exists                      |
| Brevo email API               | 5 s                                                                      | 1 retry on timeout/5xx                           | Log; the in-app record is the source of truth; developer alerted on repeated failures |
| Web Push per subscription     | 5 s                                                                      | 1 retry on 429/5xx                               | Dropped; subscriptions answering "gone" are deleted                                   |
| Storage signed link           | 3 s                                                                      | 1                                                | Upload/view error with retry on the file                                              |
| Sentry                        | Non-blocking                                                             | None                                             | Ignored; platform logs still record                                                   |
| Realtime                      | n/a                                                                      | Automatic reconnect with backoff                 | Polling every 5 s with "Updated {time}"                                               |
| Whole server operation        | 10 s budget (the host allows far more, but screens must stay responsive) | None                                             | `INTERNAL_ERROR` with reference ID                                                    |

Retries are used only where repeating is safe (idempotent or read-only).

### 14.2 Behavior by failure

| Failure                                         | Behavior                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database unreachable                            | Operations return `INTERNAL_ERROR` with reference ID (logged to Sentry and platform logs because the log table may be unreachable too); gate screens show the "Can't reach server — call the resident" banner; entries typed by a guard stay on screen until sent |
| Sign-in email not arriving                      | Generic message + resend after cooldown; developer sees send failures in the log; dashboard check for bounces/quota                                                                                                                                               |
| Email provider daily quota exhausted            | Codes stop arriving; alert at 80% (Section 10); staggered onboarding or paid plan                                                                                                                                                                                 |
| Push not delivered                              | Ignored silently; inbox and guard polling remain reliable                                                                                                                                                                                                         |
| Photo upload fails                              | Guard entry and payment submission can proceed without the optional file (prompted); request photos retry per file                                                                                                                                                |
| Realtime down                                   | Polling fallback                                                                                                                                                                                                                                                  |
| Scheduler missed a day                          | Next day's run catches up (idempotent tasks); developer health shows "last daily run" age and alerts after 36 hours                                                                                                                                               |
| Duplicate submissions                           | `clientRequestId` and database uniqueness return the original/`CONFLICT`                                                                                                                                                                                          |
| Concurrent decisions                            | First wins; others get `already_decided` with the final status                                                                                                                                                                                                    |
| Stale push opened                               | Screen shows the item's final status, not an error (DESIGN 8.3)                                                                                                                                                                                                   |
| Partial batch failure (import, bill generation) | Job `partial`: completed rows kept, failed rows reported with reasons and a downloadable error file; safe to re-run                                                                                                                                               |
| Unexpected exception                            | Caught at the boundary, scrubbed, logged with reference ID, Sentry event, user-safe message                                                                                                                                                                       |
| Logging itself fails                            | Never raises a new error; failure goes to Sentry/platform logs only                                                                                                                                                                                               |
| Third-party unavailable for long                | The feature degrades to its non-integrated path (in-app notification instead of email/push; guard calls resident)                                                                                                                                                 |

### 14.3 Required observability per call

Every operation and route logs: request ID, society ID, user ID, operation name, outcome code and duration. Failures are written to the error log with the reference ID. The request ID travels to every outbound call so a problem can be traced end to end (PRD LOG-8).

---

## 15. Versioning and Change Rules

- Internal operations are deployed together with the app; there is no version number to maintain.
- Routes in Section 6 and the error codes in Section 3.5 are a contract with the scheduler, the uptime monitor, the browser code and stored push subscriptions: changing a route, a code or a response shape requires updating this file in the same change.
- Adding a field to a response is allowed; removing or renaming one requires updating every screen that reads it in the same release.
- If a public/partner API is ever approved, it gets a separate versioned namespace, its own credentials and permissions, and its own document (ARCHITECTURE Section 3).

---

## 16. Assumptions and Decisions

### 16.1 Assumptions

| ID     | Assumption                                                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| APA-01 | List date filters are interpreted in the society's timezone                                                                                           |
| APA-02 | Emails, phone numbers and payment references used as search text are sent in request bodies, never in page URLs                                       |
| APA-03 | Limits and retention numbers are code constants and society settings, not environment variables                                                       |
| APA-04 | Supabase and Vercel regions are chosen close to users (India if available)                                                                            |
| APA-05 | A single outgoing email (receipt) per confirmed payment is acceptable for the free email plan's volume; bill reminders use in-app and push, not email |
| APA-06 | One Brevo sender address and domain serve all societies in MVP                                                                                        |
| APA-07 | Cross-society developer error and audit date filters use the app's default timezone, Asia/Kolkata (IST)                                               |

### 16.2 Decisions

| ID    | Decision                                                                                                                             | Status                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| APD-1 | Self-registration uses a **society code** shared by the admin (rotatable, can be switched off); unknown people cannot list societies | **Approved 2026-11-09** |
| APD-2 | Offset paging with exact totals for all lists in MVP (matches DESIGN); cursor paging only if logs grow very large                    | Recommended, low risk   |
| APD-3 | `clientRequestId` on user-created records to prevent double entries                                                                  | Recommended, low risk   |

### 16.3 Changes this file requires elsewhere (already applied)

- DATABASE: `societies.join_code`; `client_request_id` on user-created records.
- ARCHITECTURE: the sign-in invitation check is a service-role-only database function (added to the privileged list); limits are constants, not environment variables.
- PRD: CORE-9 self-registration uses the society code.

---

## 17. Out of Scope (API)

- Public, partner or mobile-app APIs; API keys; GraphQL; versioned REST
- Incoming webhooks of any kind in MVP (payment gateway, SMS delivery, email bounce events)
- Server-to-server sync with accounting or other systems
- Offline queues and background sync
- SMS or WhatsApp sending
- Developer impersonation of users
- Self-service data export or deletion endpoints for residents
