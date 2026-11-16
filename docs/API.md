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

- Operations that create user-submitted records (`visitor.createEntry`, `delivery.createEntry`, `delivery.preAnnounce`, `billing.submitPayment`, `request.create`, `request.addComment`) take a **`clientRequestId`** generated once per form open. A repeat with the same ID returns the original result instead of creating a second record (DATABASE 1.1).
- Two copies of the same submission can arrive at the same moment. When that happens, the losing call can hit a unique-key race (`23505`). `visitor.createEntry`, `delivery.createEntry` and `request.create` then retry the call once, so the user gets the original record instead of an "already decided" conflict.
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
| `visitor.frequent.list/save/remove`    | R (own unit)                    | Keep a list of regular visitors (MVP+, A-10)                                    | Audited; writes are denied for suspended societies                                                                              |
| `visitor.frequent.preApprove`          | R (own unit)                    | Create a pre-approval from a saved frequent visitor                             | Same code, QR and rules as `visitor.preApproval.create`                                                                         |

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
| `delivery.preAnnounce`         | R (occupant of the unit)            | Tell the gate a delivery is expected       | MVP+ (A-14); `clientRequestId`; window ≤ 24 h; 20 upcoming per unit (`limit_reached`)  |
| `delivery.preAnnounce.cancel`  | R (occupant of the unit)            | Cancel an expected delivery                | Safe to repeat; audited                                                                |
| `delivery.preAnnounce.list`    | G, A, C (society); R (own units)    | Expected deliveries whose window is open   | Guards see them on `/guard/deliveries`                                                 |

### 5.7 Billing (`billing`)

| Operation                                       | Who                                          | Purpose                                                      | Notes                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `billing.charges.list/create/update/deactivate` | A (write), A/C (list)                        | Charge types                                                 | P7A: checked RPCs; writes and audit commit together; deactivation retains history                                                                                                                                                                                                                                                                                |
| `billing.bills.preview`                         | A                                            | Show per-unit totals before generating                       | Read-only                                                                                                                                                                                                                                                                                                                                                        |
| `billing.bills.generate`                        | A                                            | Create bills for a period/selection                          | Runs as a job; set-based; idempotent by the unit/period/charge rule; applies existing unit credit automatically (DATABASE 6.1); notifies residents after commit; with Utility Metering enabled it also bills the generated units' pending utility charges as a separate bill (5.22); the job summary and audit row include `utility: {bills, charges, has_more}` |
| `billing.fines.add`                             | A                                            | Add a manual fine                                            | Reason required; audited                                                                                                                                                                                                                                                                                                                                         |
| `billing.bills.waive`                           | A                                            | Waive part or all of a bill, or cancel it                    | Reason required; blank amount waives the full outstanding; `not_unpaid` for cancel after payment; audited                                                                                                                                                                                                                                                        |
| `billing.bills.list/get`                        | A, C; R (own unit)                           | Bills and detail                                             |                                                                                                                                                                                                                                                                                                                                                                  |
| `billing.ledger.get`                            | A, C; R (own unit)                           | Unit statement with running balance                          |                                                                                                                                                                                                                                                                                                                                                                  |
| `billing.paymentDetails.get`                    | Members                                      | Society UPI ID, payee, QR path, last changed                 | Residents need it to pay                                                                                                                                                                                                                                                                                                                                         |
| `billing.paymentDetails.update`                 | A                                            | Change UPI details                                           | P7A: validates UPI ID and optional private QR; requires the last-read version; audited; notifies all admins and committee (BIL-15)                                                                                                                                                                                                                               |
| `billing.submitPayment`                         | R                                            | Submit UPI reference (+ optional screenshot path) for a unit | `clientRequestId`; UTR uniqueness; status `awaiting_confirmation`; notifies admins                                                                                                                                                                                                                                                                               |
| `billing.recordPayment`                         | A                                            | Record cash/cheque/bank/UPI received                         | Confirmed immediately; receipt number issued                                                                                                                                                                                                                                                                                                                     |
| `billing.confirmPayment`                        | A                                            | Confirm a submission (may correct the amount)                | Allocates oldest-first; ledger credit; receipt; notifies payer; amount change audited                                                                                                                                                                                                                                                                            |
| `billing.rejectPayment`                         | A                                            | Reject with reason                                           | Resident may resubmit                                                                                                                                                                                                                                                                                                                                            |
| `billing.payments.list/get`                     | A, C (all); R (own unit and own submissions) | Payments and the review queue                                |                                                                                                                                                                                                                                                                                                                                                                  |
| `billing.dashboard`                             | A, C                                         | Billed, collected, outstanding, collection %, top defaulters | Read-only aggregate                                                                                                                                                                                                                                                                                                                                              |
| `billing.reports.export`                        | A, C                                         | CSV: dues by unit, collections, defaulters                   | Runs as a job; audited as an export (LOG-4); formula-safe cells                                                                                                                                                                                                                                                                                                  |

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
| `request.upvote`                          | R                                                  | Add or remove one's vote on an open common-area request  | MVP+ (D-17); one vote per user; returns the new count; `request.list` accepts `sort: votes`        |
| `request.escalationSettings.get/save`     | A                                                  | SLA escalation delivery (P32, D-59)                      | `in_app` or `in_app_email`; in-app is always sent; audited                                         |

Residents use `/requests`, `/requests/new` and `/requests/{requestId}`. Admins and committee members use `/admin/requests` for filtering and dashboard reports; admins can also manage categories, assign requests, update statuses and reject with a reason. Request detail displays the timeline and signed photo links only to users authorized for the parent request.

SLA escalation (P32): category create/update also accepts `committeeEscalationDays` (1–30, default 2). `request.list/get` return `escalationLevel` (`none`, `admin`, `committee`); the requester sees an "Escalated" timeline entry without recipient names. Admins change the delivery on the Categories tab with `saveServiceRequestEscalationSettingsAction`. The daily job's `service_request.escalate` task does the escalation (6.1).

### 5.9 Notice board (`notice`, P11)

| Operation          | Who                            | Purpose                                    | Notes                                                                                             |
| ------------------ | ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `notice.list`      | A, C (all); R (their audience) | Current board: pinned first, then newest   | `view: archive` (withdrawn and expired) for A and C only                                          |
| `notice.get`       | A, C; R in the audience        | Detail with a five-minute attachment link  | Managers also get `read_count` and `audience_count`                                               |
| `notice.create`    | A, C                           | Publish to all, chosen blocks or owners    | `clientRequestId`; optional expiry and attachment; notifies the audience in the app and by push   |
| `notice.update`    | A (any), C (own)               | Edit title, body, audience, expiry or file | `expectedUpdatedAt`; shows "Edited"; no new notification; a replaced or removed file is deleted   |
| `notice.setPinned` | A (any), C (own)               | Pin or unpin                               | No pin limit                                                                                      |
| `notice.withdraw`  | A (any), C (own)               | Remove from the board                      | Kept in the archive; never deleted                                                                |
| `notice.markRead`  | Anyone who can see the notice  | Record a read receipt                      | Called when the resident detail page opens; counts audience members only; clears the in-app alert |

Residents use `/notices` and `/notices/{noticeId}`. Admins and committee members use `/admin/notices` (Current and Archive tabs), `/admin/notices/new`, `/admin/notices/{noticeId}` and `/admin/notices/{noticeId}/edit`. Guards have no notice access.

### 5.10 Staff management (`staff`, P12)

| Operation                             | Who                                                  | Purpose                                                                | Notes                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `staff.list`                          | Admin; residents for linked-unit domestic staff      | Directory and profile links                                            | A pending match to an existing profile is hidden from the requesting resident until approval                                                    |
| `staff.registerDomestic`              | Resident                                             | Register staff for an occupied unit                                    | Requires a private photo; default approval is on; matching phone always creates a pending unit link; client request ID is stable across retries |
| `staff.save` / `staff.review`         | Admin                                                | Save staff and unit assignments; approve or reject a pending unit link | Society-wide staff block and unit link changes are audited                                                                                      |
| `staff.updateSettings`                | Admin                                                | Set resident-registration approval requirement                         | Default `resident_approval_required: true`; audited                                                                                             |
| `staff.blockToday`                    | Resident                                             | Deny entry to one linked unit for the society-local day                | Does not block the staff member from other linked units                                                                                         |
| `staff.checkIn` / `staff.checkOut`    | Identified guard                                     | Record explicit domestic-staff entry and exit                          | One open attendance per person; the gate response omits phone and ID details                                                                    |
| `staff.attendance`                    | Admin; residents for linked staff and occupied units | Read monthly gate attendance                                           | Society-local month boundaries                                                                                                                  |
| `staff.markShift` / `staff.shiftList` | Admin                                                | Record or correct society-staff presence, absence or leave             | One status per staff member/date; future dates rejected; no payroll                                                                             |
| `staff.retention`                     | Service role only                                    | Remove closed gate attendance older than one year                      | Open attendance is retained; invoked by the daily retention job                                                                                 |

Residents use `/staff`; admins use `/admin/staff`; identified guards use `/guard/staff`. Each server action re-authorizes the caller and validates a strict payload before calling the database RPC.

### 5.11 Housekeeping inventory (`housekeeping`, P13)

Admins use `/admin/housekeeping`; supervisors use `/housekeeping`. Committee members can read the admin workspace and download reports but cannot write.

| RPC                              | Purpose                                                               | Access                       |
| -------------------------------- | --------------------------------------------------------------------- | ---------------------------- |
| `housekeeping_items_list`        | Current stock, item metadata and low-stock state                      | Admin, supervisor, committee |
| `housekeeping_item_save`         | Create or optimistically update an item                               | Admin, supervisor            |
| `housekeeping_stock_record`      | Append a receipt, issue or signed adjustment with a stable retry UUID | Admin, supervisor            |
| `housekeeping_transactions_list` | Filter immutable history by item and date range                       | Admin, supervisor, committee |
| `housekeeping_low_stock_run`     | Create deduplicated daily alerts                                      | Service role only            |

`GET /api/housekeeping/export?type=stock|usage|low_stock|transactions&from=YYYY-MM-DD&to=YYYY-MM-DD[&itemId=UUID]` returns a formula-safe, authorized CSV with `no-store` caching. Usage counts explicit stock-out entries, not corrections. All quantities retain exact three-decimal precision. Opening balances are receipts; future dates and any historically negative balance are rejected.

The daily runner invokes `housekeeping.low_stock` for each society before global retention. Notification contents are minimal; item details remain behind module permissions.

### 5.12 AMC management (`amc`, P14)

`/admin/amc` supports admin contract creation/editing, successor renewals, visit logs/corrections, status/vendor/asset filters and authorized CSV exports. Committee access is read-only, including private documents and costs.

- RPCs: `amc_workspace`, `amc_contract_save`, `amc_visit_save`, `amc_request_link`, `amc_request_label`; service-role-only `amc_reminders_run`.
- `GET /api/amc/export?type=contracts|visits[&status=active|expiring|expired&vendor=TEXT&asset=TEXT]` downloads a formula-safe CSV.
- `/api/files/upload-url` accepts the private `amc-files` bucket (JPEG/PNG/PDF, 5 MB maximum), admin only. Saved files are reverified and five-minute view links are issued only to managers.
- Service-request detail exposes only the linked asset label to residents. Admins choose a contract or remove the link; both modules must be enabled.
- The daily `amc.reminders` task delivers only the most urgent due catch-up reminder to admins/committee, with in-app and push delivery.

### 5.13 Amenity booking (`amenity`, P15)

Residents use `/amenities`; admin/committee use `/admin/amenities`. A date picker loads society-local recurring slots and private bookings through `amenity_workspace`. Other units' occupancy is anonymous. Committee controls are read-only.

- `amenity_save`: admin definition of name, exclusive guest capacity, exact fee, rules and recurring weekday slots. Edits retain old slots and booking snapshots.
- `amenity_book`: active occupancy, exact current version/rules acknowledgement, guest limit and 24-hour lead are enforced again in PostgreSQL. Paid bookings require billing enabled and append a unit-ledger debit atomically. Stable client UUIDs protect retries.
- `amenity_cancel`: the resident booker may cancel before the start; admins require a reason and notify residents. Every paid cancellation appends a full credit, never an edit or deletion, even if billing is subsequently disabled.

Bookings confirm immediately. There is no booking horizon, daily unit cap, payment gateway or shared-capacity reservation model.

### 5.14 Resident & vehicle directory (`directory`, P17)

The database provides `directory_resident_list`, `directory_my_preferences`, `directory_my_households`, `directory_set_visibility`, `directory_vehicle_list`, `directory_vehicle_save`, `directory_vehicle_verify`, `directory_vehicle_deactivate`, `directory_emergency_contact_save`, `directory_emergency_contact_deactivate`, `directory_emergency_contacts_list` and `directory_guard_vehicle_lookup`. All require an enabled module and the appropriate active role; writes require a writable society and are audited. Guard lookup returns only verified vehicle type and unit number and uses the standard `otherWritesUserMinute` authenticated-action rate limit. Direct access to directory tables is revoked. `src/core/directory/operations.ts` wraps database operations with module/role authorization, input validation, response-schema validation and safe database-error translation; `src/app/directory/actions.ts` exposes validated read and mutation actions.

The server operations are `getDirectoryResidents` (admin/committee full directory, including opted-out names/phones; residents see only entries whose name is visible), `getDirectoryVehicles` (admin/committee society-wide; residents' current household records), `getDirectoryMyPreferences` / `getDirectoryMyHouseholds` (resident's own active membership), `setDirectoryVisibility` (resident's own visibility choices only), `saveDirectoryVehicle` / `deactivateDirectoryVehicle` (resident's own records or admin), `verifyDirectoryVehicle` (admin only), `saveDirectoryEmergencyContact` / `deactivateDirectoryEmergencyContact` (resident's own records or admin), `getDirectoryEmergencyContacts` (own active household, admin and committee; never guards) and `lookupDirectoryVehicle` (guard; verified result, no phone or name). Co-occupants may read household records but cannot edit another person's records; committee access is read-only.

Directory lists return `{ items, total, limit, offset }`. Limits are 1–100 (default 25), offsets are non-negative PostgreSQL integers, and filtering/counting/paging happen in the database before fetching. Resident search accepts at most 120 characters and matches only visible names and unit numbers, never phones or hidden units. The resident route `/directory` combines the browser with visibility, vehicle and emergency-contact self-service. Search submission and page-size changes reset to page one; clearing search reloads the unfiltered first page. The shared UI offers 10/25/50/100 rows and explicit read-error recovery. `/admin/directory` provides admin management and committee read-only review; its target selectors use the current bounded resident search page rather than an unbounded Core member download. `/guard/directory` provides exact-registration lookup. Navigation and page/action access require the enabled module and permitted role. Disabled and denied states are distinct from empty results; unexpected initial reads reach the shared reporting/retry boundary.

Ending a Core occupancy immediately deactivates that person's unit-scoped records, including previously inactive records, and schedules purging one year after recorded `ended_at` (including backdated or future dates). A same-society unit move transfers active vehicles and emergency contacts, audits transfers without copying names/phones/plates, and clears vehicle verification. Inactive records left at the old unit receive that occupancy's retention anchor. Visibility preferences remain attached to the person and are eligible for purging only after the last occupancy ends. Lifecycle maintenance also runs when the directory module is disabled; disabling alone does not remove data. Membership deactivation, including user erasure, deactivates records and schedules retention from `left_at` (or today). Reactivating a record clears its old purge date. The daily privileged retention task calls service-role-only `directory_retention_run(date, trace)` and validates its `{ vehicles_deleted, emergency_contacts_deleted, preferences_deleted }` counts; active records/current occupancies are protected and repeat runs are idempotent.

### 5.15 Society expenses & accounts (`expense`, P16)

Permissions: `expense:list` (admin, committee), `expense:manage` (admin) and `expense:approve` (committee). Residents, guards and supervisors have no access, and navigation shows "Accounts" only to admins and committee members. `src/core/expense/operations.ts` validates inputs, calls the database functions listed in DATABASE.md §9.7 and validates every response. SQLSTATE `42501` maps to forbidden, `P0002` to not found, `23505` to conflict, and `22023`/`23514`/`23P01` to validation errors with a safe message.

| Operation                                                                 | Caller                                 | Behaviour                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getExpenseWorkspace`                                                     | Admin, committee                       | Today, actor, abilities, settings, accounts with current balances, categories, closed months and up to 100 pending expenses with signed receipt links                                                                                     |
| `listExpenses(status, page)` / `listExpenseEntries(range, account, page)` | Admin, committee                       | 50 rows per page with totals; entries show reversal links and receipts                                                                                                                                                                    |
| `getExpenseReport(range)`                                                 | Admin, committee                       | Income/expenditure by month, category and income source; balances at the range end; outstanding billing dues when billing is enabled. Ranges are at most two years                                                                        |
| `recordExpense`                                                           | Admin                                  | Idempotent by `clientRequestId`; returns `{ id, status }` with `posted` at or below the threshold, otherwise `pending_approval` and committee notification. Cash mode must use the cash account; receipts must be the caller's own upload |
| `decideExpense`                                                           | Committee member who did not record it | Approve posts the expense; reject requires a note. Repeating the same decision is a no-op                                                                                                                                                 |
| `recordIncome`                                                            | Admin                                  | Donation, interest or other income; idempotent                                                                                                                                                                                            |
| `reverseExpenseEntry`                                                     | Admin                                  | Adds an opposite entry with a reason; original stays; each entry can be reversed once; billing and reversal entries cannot be reversed                                                                                                    |
| `saveExpenseAccount` / `saveExpenseCategory` / `saveExpenseSettings`      | Admin                                  | Optimistic `expectedUpdatedAt` checks; opening details fixed once used                                                                                                                                                                    |
| `closeExpenseMonth` / `reopenExpenseMonth`                                | Admin                                  | Only finished months; reopening requires an audited reason                                                                                                                                                                                |

Routes: `/admin/expenses` (balances, approvals, record forms, cash and bank book, expenses), `/admin/expenses/reports` (period report, exports and month close/reopen) and `/admin/expenses/setup` (admin only: settings, accounts and categories).

- `GET /api/expense/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|pdf` downloads the formula-safe entry CSV or a summary PDF for admins and committee members.
- `/api/files/upload-url` accepts the private `expense-files` bucket (JPEG/PNG/PDF, 5 MB maximum), admin only, under `{society}/{user}/expense/`.

---

### 5.16 Tenancy and moves (`tenancy`, P18; D-50)

Approved contract; the implementation plan records which blocks are actually complete. The optional module uses `src/core/tenancy/moves/`, not the existing always-on session/request-context services.

| Operation / RPC                                                | Caller                                             | Contract                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getTenancyWorkspace` / `tenancy_workspace_get`                | Admin, committee, resident, guard                  | Current society-local date, time zone, configured unit label and capabilities. Optional selectors expose all existing resident memberships to admins; owners see only tenants already linked to their active owned units, and tenants only themselves. Status-only readers and calls without targets receive empty selector arrays. Confirmed same-unit amenity bookings are references only. |
| `createTenancyMove` / `tenancy_move_create`                    | Admin, target tenant or active unit owner          | Same-society unit/tenant, move kind, future UTC window, agreement expiry for move-in, optional existing amenity booking and stable client UUID; returns move UUID. Existing invitations/pending occupancies are reused.                                                                                                                                                                       |
| `consentTenancyMove` / `tenancy_move_consent`                  | Active unit owner                                  | Move-in consent only; expected version; no admin bypass.                                                                                                                                                                                                                                                                                                                                      |
| `decideTenancyMove` / `tenancy_move_decide`                    | Admin approves/rejects; admin or requester cancels | Expected version; reason for reject/cancel. Approval schedules only. Corrections use cancellation and a new request.                                                                                                                                                                                                                                                                          |
| `completeTenancyMove` / `tenancy_move_complete`                | Admin                                              | Expected version; rechecks consent, proofs, active membership, schedule and optional booking; move-out rechecks authoritative dues. Atomically updates Core occupancy and timeline/audit.                                                                                                                                                                                                     |
| `listTenancyMoves` / `tenancy_moves_page`                      | Admin, committee, resident, guard                  | Bounded `{ items, total, limit, offset }` (1–100, default 25); status filter. Tenant/owner scope for residents; status-only committee/guard projections contain no tenant identities/files.                                                                                                                                                                                                   |
| `getTenancyMove` / `tenancy_move_get`                          | Admin, target tenant, active unit owner            | Private request detail, timeline and document metadata; committee/guard cannot use this operation.                                                                                                                                                                                                                                                                                            |
| `saveTenancySettings` / `tenancy_settings_update`              | Admin                                              | Audited boolean `police_verification_required`; default false. Other collection/approval/fee policies are fixed by D-50.                                                                                                                                                                                                                                                                      |
| `attachTenancyDocument` / `tenancy_document_attach`            | Tenant, active unit owner, admin                   | Immutable rental/police proof only; validates scoped private object, actual MIME/size and request version. NOCs use the separate admin-only issue operation, not client attachments.                                                                                                                                                                                                          |
| `issueTenancyNoc` / `tenancy_noc_prepare`, `tenancy_noc_issue` | Admin                                              | Completed move-out, expected version; ten-minute, actor-bound authoritative snapshot; server-rendered private PDF, then locked dues/state recheck. Positive dues, changed Billing availability, expired preparation or ended one-year retention blocks issuance. A retry returns the existing NOC, without a second event.                                                                    |
| `prepareTenancyProofUpload` / `tenancy_proof_upload_path`      | Tenant, active unit owner, admin                   | Specific open move-in with a non-ended Core occupancy; immutable missing proof kind only; PDF/JPG/PNG, at most 5 MiB. Returns a generated scoped path before a signed upload token is issued.                                                                                                                                                                                                 |

Permissions come from the central registry: `tenancy:list`, `tenancy:create`, `tenancy:consent`, `tenancy:manage`, `tenancy:files` and `tenancy:guard`. Every operation rechecks the enabled module and current role/scope; writes require a writable society and the standard `otherWritesUserMinute` rate limit. Creation retries return the original move for the same client UUID. Stale versions map to `CONFLICT/stale_version`, state races to `CONFLICT/invalid_state`; private missing/unauthorised records are not found. Expected database failures follow the existing safe error model; unexpected failures reach the reference-ID boundary, not empty/success fallbacks.

Implemented authenticated pages are `/tenancy`, `/tenancy/{id}`, `/admin/tenancy`, `/admin/tenancy/{id}` and `/guard/tenancy`, with registry-derived navigation and role-group loading boundaries. Resident/owner pages contain scoped creation and private detail; administrative private detail requires admin capability, even for committee members who also have resident/owner access. Those members use their resident route for their own private requests. Committee and guard schedules never fetch tenant selectors or private details. Only writable creation views fetch eligible tenants, units and optional booking references.

Lists use status-only filters and exact-total pagination; UI page sizes are 10/25/50/100, with 10 by default. Invalid queries still authorise the module before showing an explicit filter error. Loading, module-disabled, denied, unavailable, error, empty, filtered-empty and suspended/read-only states remain separate. Thin Server Actions reuse the operation schemas, standard result envelopes and reference-ID error boundary. Creation includes its stable UUID before validation and preserves it when a saved response is lost. Confirmation inputs, rejection/cancellation reasons and current versions are validated again by the server.

Private proof controls distinguish upload from successful attachment, reject empty/oversized/wrong-type files, and expose explicit retry/removal without arbitrary Storage deletion. Both upload and view links must match the configured Storage origin and the exact expected bucket/path/endpoint. Superseded uploads are aborted and late results cannot replace a newer selection. View links are requested only for attached files and disappear after the returned lifetime (at most five minutes). Approval is labelled **Scheduled**; only confirmed actual completion changes Core access. No hosted setup, external messaging channel or public tenant endpoint is introduced.

The existing `/api/files/upload-url` accepts `{ bucket: "tenancy-files", moveId, kind, contentType, sizeBytes }` for proof kinds only; NOC upload is internal to the admin issue operation. The owner-approved privileged attestation step downloads and compares the stored NOC with the exact server-rendered bytes, then calls service-only `tenancy_noc_attest`, bound to the current society, move, issuer, path and preparation version. Direct authenticated issuance without that attestation is denied; final issuance retains the administrator's own session and dues checks. `/api/files/url` accepts only an attached, unexpired tenancy document under the caller's current parent-move access. Committee, guards and developer-only accounts have no document bypass. Abandoned uploads are collected after 24 hours rather than accepting arbitrary client deletes. `tenancy.reminders` runs through the existing daily-job boundary, in-app only. Service-only `tenancy_retention_files_list`/`tenancy_retention_run` extend the Storage-first global retention task, including module-off cleanup. Orphan selection waits for in-flight attachments under the lifecycle lock and rechecks committed metadata before returning deletion candidates.

NOC rendering preserves supported NFC text. If any rendered name/label needs unsupported font characters, issuance returns `VALIDATION_FAILED` before Storage upload or attestation, with a clear no-NOC-issued message. It never silently strips accents or replaces names. Full-script fonts are a separately approved follow-up (D-50); existing Billing/Expense PDF behaviour is unchanged.

### 5.17 Document repository (`document`, P19)

Operations live in `src/core/document/`; admin Server Actions are in `(admin)/admin/documents/actions.ts` and the download action in `(resident)/documents/actions.ts`.

| Operation / RPC                                                | Caller                     | Contract                                                                                                                                                                         |
| -------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getDocumentWorkspace` / `document_workspace_get`              | Admin, committee, resident | Capabilities (`can_manage`, `is_staff`, `writable`), `tenancy_enabled`, visible folders and, for admins, up to 3000 units.                                                       |
| `listDocuments` / `document_list`                              | Admin, committee, resident | Folder or unit list within the caller's audience; `{ items, total, limit, offset }` (1–100, default 25). Unit lists add read-only tenancy NOCs (up to 50) when Tenancy is on.    |
| `getDocument` / `document_get`                                 | Admin, committee, resident | Document detail; residents see only the current version, admin and committee the full version history.                                                                           |
| `saveDocumentFolder` / `document_folder_save`                  | Admin                      | Create or rename a folder and set its audience (`all_residents`, `owners_only`, `committee_admins`); at most 50 active folders; expected version on update.                      |
| `setDocumentFolderArchived` / `document_folder_set_archived`   | Admin                      | Archive or restore a folder.                                                                                                                                                     |
| `createDocument` / `document_create`                           | Admin                      | Folder or unit target (unit documents choose `all_occupants` or `owners_only`), title, description and an uploaded file; idempotent on client UUID; creates version 1, notifies. |
| `addDocumentVersion` / `document_version_add`                  | Admin                      | Adds a new current version; idempotent on path; notifies "Document updated".                                                                                                     |
| `updateDocument` / `document_update`                           | Admin                      | Title, description and unit audience; expected version.                                                                                                                          |
| `setDocumentArchived` / `document_set_archived`                | Admin                      | Archive or restore; nothing is deleted.                                                                                                                                          |
| `setDocumentVersionArchived` / `document_version_set_archived` | Admin                      | Archive or restore a version; the only active version cannot be archived.                                                                                                        |
| `prepareDocumentUpload`                                        | Admin                      | PDF/JPEG/PNG up to 5 MiB; returns a generated `document-files` path and signed upload token (`fileUploadUserHourly` limit).                                                      |
| `createDocumentDownloadLink` / `document_download_issue`       | Admin, committee, resident | Audits `document.download` for a visible version, then returns a five-minute signed link with a download filename (`otherWritesUserMinute` limit).                               |

Permissions: `document:list` (admin, committee, resident) and `document:manage` (admin). Guards have no access. Pages are `/documents` (residents) and `/admin/documents` (admin and committee; committee is read-only). The module has no settings. Residents cannot upload. Uploads do not use `/api/files/upload-url`, and downloads do not use `/api/files/url`: the storage read policy accepts only a version with a recent download audit row. Unattached uploads are removed after 24 hours by the retention task.

### 5.18 Parking management (`parking`, P20)

Operations live in `src/core/parking/`; all Server Actions are in `(resident)/parking/actions.ts`.

| Operation / RPC                                              | Caller                      | Contract                                                                                                                                                                                             |
| ------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getParkingResidentWorkspace` / `parking_resident_workspace` | Resident                    | Own units' allocations, linked vehicles, waitlist position and history, passes from the last 7 days, own reports, and `directory_enabled`/`visitor_enabled`.                                         |
| `getParkingAdminWorkspace` / `parking_admin_workspace`       | Admin, committee            | Slots (up to 500), allocations, waitlists per type, reports (up to 100) and settings. Committee is read-only.                                                                                        |
| `getParkingGuardBoard` / `parking_guard_board`               | Guard                       | Optional slot/vehicle query (up to 40 characters), up to 20 matches, and passes active in the next 12 hours.                                                                                         |
| `saveParkingSettings` / `parking_settings_update`            | Admin                       | Audited `photo_retention_days`, 1–90 (default 3).                                                                                                                                                    |
| `saveParkingSlot` / `parking_slot_save`                      | Admin                       | Label, type (`car`, `two_wheeler`, `visitor`, `ev`; fixed after creation) and location note; expected version on update.                                                                             |
| `archiveParkingSlot` / `parking_slot_archive`                | Admin                       | Only an unallocated slot; archiving is permanent.                                                                                                                                                    |
| `createParkingRequest` / `parking_request_create`            | Resident of the unit        | Joins the FIFO waitlist for car, two-wheeler or EV; one waiting request per unit and type; idempotent.                                                                                               |
| `cancelParkingRequest` / `parking_request_cancel`            | Resident of the unit        | Cancels a waiting request.                                                                                                                                                                           |
| `allocateParkingSlot` / `parking_allocate`                   | Admin                       | Allocates a free non-visitor slot to a unit; no per-unit limit or fee. Skipping the head of the queue needs an audited reason. Fulfils the unit's own request and notifies the unit.                 |
| `endParkingAllocation` / `parking_allocation_end`            | Admin                       | Ends the allocation and its vehicle links; notifies the unit.                                                                                                                                        |
| `setParkingVehicleLink` / `parking_vehicle_link_set`         | Admin, resident of the unit | Links or unlinks a unit's directory vehicle to an allocated slot under the capacity rule (DATABASE 9.10). Requires Directory.                                                                        |
| `createParkingPass` / `parking_pass_create`                  | Resident                    | Visitor name, optional vehicle number, start (from 15 minutes ago up to 30 days ahead), duration up to 24 hours, optional same-unit visitor entry; auto-picks a free visitor slot. Requires Visitor. |
| `cancelParkingPass` / `parking_pass_cancel`                  | Resident                    | Only upcoming or current passes.                                                                                                                                                                     |
| `createParkingReport` / `parking_report_create`              | Guard, resident             | Slot or vehicle number, note and optional photo; 10 per user per hour (`RATE_LIMITED`). Notifies the matched unit and all admins.                                                                    |
| `resolveParkingReport` / `parking_report_resolve`            | Admin                       | Resolution note; notifies the reporter.                                                                                                                                                              |
| `prepareParkingPhotoUpload` / `parking_photo_upload_path`    | Guard, resident             | JPEG/PNG up to 5 MiB in the uploader's own `parking-photos` path.                                                                                                                                    |
| `authoriseParkingPhotoView` / `parking_photo_access`         | Report readers              | Attached photo within retention, or the uploader's unattached photo.                                                                                                                                 |

Permissions: `parking:list` (admin, committee, resident), `parking:manage` (admin), `parking:request` and `parking:visitor_pass` (resident), `parking:report` (guard, resident) and `parking:guard` (guard). `photo_retention_days` is admin-editable. Pages are `/parking`, `/admin/parking` (admin and committee) and `/guard/parking`. The matched unit is shown only to admin, committee and that unit's residents, never to another reporter. Report photos are deleted after the retention setting; passes and reports are kept.

### 5.19 Emergency and SOS (`sos`, P21; D-41)

Operations live in `src/core/sos/`; all Server Actions are in `(resident)/sos/actions.ts`. Delivery is in-app notification and Realtime only (D-41).

| Operation / RPC                                      | Caller                            | Contract                                                                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getSosWorkspace` / `sos_workspace`                  | Admin, committee, resident, guard | Open alerts, paged history, emergency contacts (archived ones for admins only), settings and capabilities; units list for guards only.                                                            |
| `sos_my_alerts`                                      | Every signed-in user              | Undismissed open alerts addressed to the caller across societies (up to 20), used by the app-shell banner; the note is hidden from resident-audience recipients.                                  |
| `raiseSos` / `sos_raise`                             | Resident, guard                   | Category (`medical`, `fire`, `security`, `other`), optional note (up to 280) and client UUID. Residents raise for their own unit (auto-selected if only one); guards for any active unit or none. |
| `cancelSos` / `sos_cancel`                           | Raiser                            | Before acknowledgement only; recorded as "Raised by mistake".                                                                                                                                     |
| `acknowledgeSos` / `sos_acknowledge`                 | Admin, committee, guard           | Acknowledges a raised alert; audited.                                                                                                                                                             |
| `addSosUpdate` / `sos_add_update`                    | Admin, committee, guard           | Timestamped update after acknowledgement; audited.                                                                                                                                                |
| `closeSos` / `sos_close`                             | Admin, committee, guard           | Acknowledged alerts; reason `resolved`, `false_alarm`, `duplicate`, `test` or `other`; note required for false alarm and other.                                                                   |
| `dismissSosAlert` / `sos_alert_dismiss`              | Recipient                         | Stops the caller's own banner and sound; does not acknowledge the alert for others; audited.                                                                                                      |
| `saveSosSettings` / `sos_settings_update`            | Admin                             | `notify_guards`, `notify_admins`, `notify_committee` and `resident_scope` (`off`, `floor`, `block`, `society`); at least one responder group on.                                                  |
| `saveSosContact` / `sos_contact_save`                | Admin                             | Emergency contact label and phone; seeded with 112, 108, 101 and 100.                                                                                                                             |
| `setSosContactArchived` / `sos_contact_set_archived` | Admin                             | Archive or restore a contact.                                                                                                                                                                     |

Permissions: `sos:raise` (guard, resident), `sos:list` (all four roles), `sos:respond` (admin, committee, guard) and `sos:manage` (admin). All four settings are admin-editable. Pages are `/sos` (resident navigation label "Emergency"), `/admin/sos` (admin and committee) and `/guard/sos`. Writes use the `otherWritesUserMinute` limit. A second open alert for the same unit returns `CONFLICT/limit_reached`; more than three per unit per hour returns `RATE_LIMITED`; both have friendly messages. Recipients are fixed when raised; residents beyond 5000 are dropped and audited as `sos.recipients_truncated`.

### 5.20 Vendors and purchase approvals (`vendor`, P24; D-54)

Operations live in `src/core/vendor/` (`operations.ts`, `files.ts`); all Server Actions are in `(admin)/admin/vendors/actions.ts`. Only admin and committee can call any of them; there are no resident, guard or vendor interfaces (VEN-4). Amounts are integer paise.

| Server Action / RPC                                                                    | Caller           | Contract                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getVendorWorkspace` / `vendor_workspace_get`                                          | Admin, committee | Settings, `can_manage`, `expense_enabled`, up to 500 vendors with rating average/count and up to 200 requests (submitted and drafts first) with the quote-rule status.                                  |
| `getVendorDetail` / `vendor_get`                                                       | Admin, committee | Vendor contact details, active documents, up to 100 ratings with the caller's own rating, and up to 50 quotes from this vendor.                                                                         |
| `getPurchaseRequestDetail` / `vendor_request_get`                                      | Admin, committee | Request, quote rule, quotes, approvals, expense draft status and capabilities; `approval_blocked_reason` says why the caller cannot decide it.                                                          |
| `saveVendorSettingsAction` / `vendor_settings_update`                                  | Admin            | `quote_threshold_paise` (0 to ₹100 crore), `quotes_above_threshold` (1–5) and `approvals_required` (0–5); audited.                                                                                      |
| `saveVendorAction` / `vendor_save`                                                     | Admin            | Create (idempotent on the client UUID) or update (optimistic version): name, category, contact person, phone, email, optional GSTIN (Indian format, stored upper-case) and notes.                       |
| `setVendorActiveAction` / `vendor_set_active`                                          | Admin            | Activate or deactivate; inactive vendors cannot receive new quotes.                                                                                                                                     |
| `prepareVendorDocumentUploadAction`, `addVendorDocumentAction` / `vendor_document_add` | Admin            | Signed upload to the caller's own `vendor-files` path (PDF/JPEG/PNG up to 5 MiB), then attach with a title; the object is rechecked on attach.                                                          |
| `archiveVendorDocumentAction` / `vendor_document_archive`                              | Admin            | Archive a document; it is never deleted.                                                                                                                                                                |
| `vendorFileLinkAction` / `vendor_file_issue`                                           | Admin, committee | Audits `vendor.file.download`, then returns a 300-second download link for a vendor document or quote file.                                                                                             |
| `saveVendorRatingAction` / `vendor_rating_save`                                        | Admin, committee | 1–5 stars and optional comment (up to 500); one rating per rater per vendor, updated in place.                                                                                                          |
| `savePurchaseRequestAction` / `vendor_request_save`                                    | Admin, committee | Create a draft (idempotent) or edit one (requester or admin; optimistic version): title, description, optional category and estimated amount. Changing the estimate clears an override.                 |
| `prepareVendorQuoteUploadAction`, `addPurchaseQuoteAction` / `vendor_quote_add`        | Admin, committee | Draft only; active vendor, amount, optional note and optional private quote file. One live quote per vendor; clears an override.                                                                        |
| `removePurchaseQuoteAction` / `vendor_quote_remove`                                    | Admin, committee | Draft only; marks the quote removed, clears the selection if it was selected, and clears an override.                                                                                                   |
| `selectPurchaseQuoteAction` / `vendor_quote_select`                                    | Admin, committee | Draft only; selects the quote to go ahead with; selecting a different quote clears an override.                                                                                                         |
| `overrideQuoteRuleAction` / `vendor_quote_override`                                    | Admin            | Draft only; waive the quote count with a reason (5–500 characters) or clear the override; audited.                                                                                                      |
| `submitPurchaseRequestAction` / `vendor_request_submit`                                | Requester, admin | Needs a selected quote and a met (or overridden) rule; snapshots the rule and `approvals_required`, locks quotes and notifies approvers.                                                                |
| `approvePurchaseRequestAction` / `vendor_request_approve`                              | Admin, committee | One approval per person; never by whoever raised, submitted or overrode the request. With 0 required, an admin approves alone. The final approval creates the expense draft and notifies the requester. |
| `rejectPurchaseRequestAction` / `vendor_request_reject`                                | Admin, committee | Reason required; same separation of duties; notifies the requester.                                                                                                                                     |
| `cancelPurchaseRequestAction` / `vendor_request_cancel`                                | Requester, admin | Draft or submitted only, with an optional reason.                                                                                                                                                       |
| `retryPurchaseExpenseDraftAction` / `vendor_expense_draft_retry`                       | Admin            | Approved requests whose draft was skipped; returns the new draft status and never creates a second expense.                                                                                             |

Permissions: `vendor:list`, `vendor:request`, `vendor:approve` and `vendor:rate` (admin, committee) and `vendor:manage` (admin). All three settings are admin-editable. The page is `/admin/vendors` (admin and committee), with `/admin/vendors/[vendorId]` and `/admin/vendors/requests/[requestId]`. Writes use the `otherWritesUserMinute` limit; upload preparation also uses `fileUploadUserHourly`. Separation-of-duties refusals return `FORBIDDEN` with the database message; a locked or unmet rule returns `VALIDATION_FAILED`; a stale version returns `CONFLICT`. Notifications are in-app only, at most 50 per event, and link to `/admin/vendors/requests/{id}` (entity `vendor_purchase_request`).

### 5.21 Guard patrol and incident log (`patrol`, P25; D-55)

Operations live in `src/core/patrol/` (`operations.ts`, `files.ts`, `rounds.ts`); guard Server Actions are in `(guard)/guard/patrol/actions.ts` and admin Server Actions in `(admin)/admin/patrol/actions.ts`. Residents have no access.

| Operation / RPC                                                    | Caller                  | Contract                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getPatrolAdminWorkspace` / `patrol_admin_workspace`               | Admin, committee        | `can_manage`, timezone, settings, checkpoints with codes, schedules, scans from the last 48 hours, the latest 100 incidents with notes and photos, and handover notes from the last 7 days. Committee is read-only.                                        |
| `getPatrolGuardWorkspace` / `patrol_guard_workspace`               | Guard                   | Active checkpoints (no codes), active schedules, scans by all guards from the last 24 hours, the caller's own latest 20 incidents and handover notes from the last 7 days.                                                                                 |
| `getPatrolPrintSheet` / `patrol_print_sheet`                       | Admin                   | Society name and active checkpoints with their codes, for the printable QR sheet at `/admin/patrol/print`.                                                                                                                                                 |
| `savePatrolSettingsAction` / `patrol_settings_update`              | Admin                   | Audited `photo_retention_days`, 30–365 (default 90).                                                                                                                                                                                                       |
| `savePatrolCheckpointAction` / `patrol_checkpoint_save`            | Admin                   | Create (idempotent on the client UUID; generates a unique six-character code) or update (optimistic version): name and optional location note. At most 200 per society (`RATE_LIMITED`).                                                                   |
| `setPatrolCheckpointActiveAction` / `patrol_checkpoint_set_active` | Admin                   | Turn a checkpoint off or on (optimistic version); guards cannot scan an inactive checkpoint and rounds skip it.                                                                                                                                            |
| `savePatrolScheduleAction` / `patrol_schedule_save`                | Admin                   | Name, shift start/end, a round every 15–720 minutes (fits the shift), grace 0–120 minutes (no longer than the interval) and 1–50 checkpoints; at most 50 schedules per society. Timing changes restart missed tracking.                                    |
| `setPatrolScheduleActiveAction` / `patrol_schedule_set_active`     | Admin                   | Turn a schedule off or on (optimistic version).                                                                                                                                                                                                            |
| `recordPatrolScanAction` / `patrol_scan`                           | Guard                   | Typed code or the `homeish-patrol:<code>` QR payload, `method` (`qr`, `typed`) and client UUID; only an active checkpoint of the guard's society (`NOT_FOUND` otherwise). 240 per guard per hour (`RATE_LIMITED`).                                         |
| `preparePatrolPhotoUpload` / `patrol_photo_upload_path`            | Guard                   | JPEG/PNG up to 5 MiB in the guard's own `patrol-photos` path, through `POST /api/files/upload-url`.                                                                                                                                                        |
| `authorisePatrolPhotoView` / `patrol_photo_access`                 | Admin, committee, guard | Attached photo within retention for admin, committee and the reporting guard, or the uploader's unattached photo, through `POST /api/files/url`.                                                                                                           |
| `createPatrolIncidentAction` / `patrol_incident_create`            | Guard                   | Category, severity (`low`, `medium`, `high`, `critical`), description (up to 1000), optional location (up to 200), up to 3 own photos uploaded in the last 24 hours, client UUID; 20 per guard per hour. High and critical notify up to 50 admins at once. |
| `addPatrolIncidentNoteAction` / `patrol_incident_note_add`         | Admin                   | Follow-up note (up to 1000) on an open incident; up to 100 per incident; audited.                                                                                                                                                                          |
| `closePatrolIncidentAction` / `patrol_incident_close`              | Admin                   | Resolution (up to 1000); audited; notifies the reporting guard.                                                                                                                                                                                            |
| `createPatrolHandoverAction` / `patrol_handover_create`            | Guard                   | Handover note (up to 1000) and client UUID; 20 per guard per hour.                                                                                                                                                                                         |
| `acknowledgePatrolHandoverAction` / `patrol_handover_acknowledge`  | Guard                   | Another guard's note from the last 7 days, once; audited.                                                                                                                                                                                                  |

Permissions: `patrol:list` (admin, committee), `patrol:manage` (admin) and `patrol:guard` (guard). `photo_retention_days` is admin-editable. Pages are `/guard/patrol` (guard), `/admin/patrol` (admin and committee; committee is read-only) and `/admin/patrol/print` (admin). Writes use the `otherWritesUserMinute` limit; photo upload preparation also uses `fileUploadUserHourly`. Database caps (SQLSTATE `54000`) return `RATE_LIMITED` with a friendly message; a stale version returns `CONFLICT`. Missed checkpoints are computed on read from schedules and scans (no scheduled job). Incident notifications are in-app only: `patrol_incident` (entity `patrol_admin`, linking to `/admin/patrol`) and `patrol_incident_closed` (entity `patrol_guard`, linking to `/guard/patrol`).

### 5.22 Utility metering (`metering`, P26; D-56)

Operations live in `src/core/metering/`; all Server Actions are in `(resident)/metering/actions.ts`. Writes use the `otherWritesUserMinute` limit; photo upload links also use `fileUploadUserHourly`.

| Operation / RPC                                                | Caller                    | Contract                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getMeteringResidentWorkspace` / `metering_resident_workspace` | Resident                  | Own units' active meters (up to 50) with last approved reading, current rates, and the last 100 readings with status, consumption, reasons and billed amount; `billing_enabled`.                                                                                                      |
| `getMeteringAdminWorkspace` / `metering_admin_workspace`       | Admin, committee          | Meters (up to 500), current rates and the last 20 rate changes, approval queue (up to 100), recent reviewed readings, utility charge totals and the 9-month consumption report. Committee is read-only (`can_manage`).                                                                |
| `getMeteringGuardBoard` / `metering_guard_board`               | Admin, guard              | Optional search by meter label, serial or unit (up to 40 characters), up to 30 active meters with their last reading, and the caller's last 10 readings.                                                                                                                              |
| `saveMeteringMeterAction` / `metering_meter_save`              | Admin                     | Type (`water`, `electricity`, `dg`, `gas`), scope (`unit` with a unit, or `common`), label and serial up to 60, initial reading (3 decimals), active flag; type, scope and unit are fixed; expected version on update.                                                                |
| `setMeteringRateAction` / `metering_rate_set`                  | Admin                     | Flat rate per meter type in whole paise per unit (₹0–₹1,00,000); appended to the history and applied to every charge not yet billed.                                                                                                                                                  |
| `recordMeteringReadingAction` / `metering_reading_record`      | Admin, guard              | Approved at once. Value ≥ 0 with up to 3 decimals; date not in the future, within the last year and on a later day than the latest approved reading (`23514`); a lower value needs a reason (3–300) and consumes 0. Optional photo.                                                   |
| `submitMeteringReadingAction` / `metering_reading_submit`      | Resident of the unit      | Same rules plus a required photo (the caller's own upload from the last 24 hours, extension matching its type; `22023` otherwise); one pending reading per meter; held for review and notifies admins (`metering_reading_submitted`).                                                 |
| `reviewMeteringReadingAction` / `metering_reading_review`      | Admin                     | `approve`, or `reject` with a reason (3–300); approving a lower reading needs a reason; a reading dated on or before a reading approved since is refused (`23514`, reject it instead). Notifies the submitter (`metering_reading_reviewed`). Re-sending the same decision is a no-op. |
| `runMeteringBillingAction` / `metering_billing_run`            | Admin                     | Manual catch-up: bills pending unit-meter charges up to a bill date (not in the future, within a year), 1000 units per run (`has_more`), audited as `metering.billing.run`. Requires Billing (`23514` otherwise). Returns counts and `billed_paise`.                                  |
| `prepareMeteringPhotoUpload` / `metering_photo_upload_path`    | Admin, guard, resident    | JPEG/PNG up to 5 MiB in the uploader's own `metering-photos` path, through `/api/files/upload-url`.                                                                                                                                                                                   |
| `authoriseMeteringPhotoView` / `metering_photo_access`         | Admin, committee, creator | Attached photo, or the uploader's own unattached photo, through `/api/files/url`.                                                                                                                                                                                                     |

Permissions: `metering:list` (admin, committee, resident), `metering:manage` (admin), `metering:record` (admin, guard) and `metering:submit` (resident). The module has no settings. Pages are `/metering` (residents), `/admin/metering` (admin and committee) and `/guard/metering`. When Billing is enabled, monthly bill generation (`billing_bills_generate`) also bills the generated units' pending utility charges as a separate "Utility charges – Mon YYYY" bill per unit, using Billing's rounding setting; the manual run covers anything left. A reading is never billed twice. When Billing is disabled, readings and reports still work and nothing is billed (DATABASE 9.14). Common-area meters are never billed.

### 5.23 Asset register (`asset`, P28; D-57)

Operations live in `src/core/asset/`; Server Actions are in `(admin)/admin/assets/actions.ts`. Writes use the `otherWritesUserMinute` limit; a stale version returns `CONFLICT`.

| Operation / RPC                                              | Caller           | Contract                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAssetWorkspace` / `asset_workspace_get`                  | Admin, committee | Categories with asset counts and up to 1000 assets (`truncated` when more exist); `can_manage` is false for committee.                                                                                          |
| `getAssetDetail` / `asset_get`                               | Admin, committee | Asset details, maintenance entries (up to 200) and, when `amc` is enabled, the linked contract and its visits.                                                                                                  |
| `getAssetFormOptions` / `asset_form_options_get`             | Admin            | Active categories and, when `amc` is enabled, up to 200 contracts plus the currently linked one.                                                                                                                |
| `saveAssetCategoryAction` / `asset_category_save`            | Admin            | Name 1–60, unique per society; at most 200 categories; expected version on update; client UUID on create.                                                                                                       |
| `setAssetCategoryActiveAction` / `asset_category_set_active` | Admin            | Turns a category on or off; never deleted.                                                                                                                                                                      |
| `saveAssetAction` / `asset_save`                             | Admin            | Category, name, location, make, model, serial, supplier, purchase date and cost, warranty end, status (`active`, `under_repair`, `retired`), notes, AMC contract, `expectedAmcEnabled` (`CONFLICT` if changed). |
| `addAssetMaintenanceAction` / `asset_maintenance_add`        | Admin            | Date (not in the future), description up to 1000, done by, optional cost; client UUID.                                                                                                                          |
| `removeAssetMaintenanceAction` / `asset_maintenance_remove`  | Admin            | Marks an entry removed; repeating it does nothing.                                                                                                                                                              |

Permissions: `asset:list` (admin, committee) and `asset:manage` (admin). Pages are `/admin/assets`, `/admin/assets/new`, `/admin/assets/categories`, `/admin/assets/{assetId}` and `/admin/assets/{assetId}/edit`. Residents and guards have no access.

### 5.24 Home-services directory (`home_services`, P31; D-58)

Operations live in `src/core/home-services/`; Server Actions are in `(resident)/home-services/actions.ts`. Writes use the `otherWritesUserMinute` limit; a stale version returns `CONFLICT`.

| Operation / RPC                                                                   | Caller                     | Contract                                                                                                            |
| --------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `getHomeServicesDirectory` / `home_services_directory`                            | Admin, committee, resident | Approved, unarchived providers with average stars and count (up to 500, `truncated`).                               |
| `getHomeServicesProvider` / `home_services_provider_detail`                       | Admin, committee, resident | Provider and ratings; rater names only for admin and committee; hidden comment text only for admins and the author. |
| `getHomeServicesAdminWorkspace` / `home_services_admin_workspace`                 | Admin, committee           | Providers by status, pending suggestions and recent comments (up to 500, `truncated`).                              |
| `saveHomeServicesProviderAction` / `home_services_provider_save`                  | Admin                      | Name, service type, phone, optional area and notes; approved at once; expected version on update.                   |
| `suggestHomeServicesProviderAction` / `home_services_provider_suggest`            | Committee                  | Same fields; pending until an admin reviews it; notifies up to 20 admins in-app.                                    |
| `reviewHomeServicesSuggestionAction` / `home_services_suggestion_review`          | Admin                      | Approve, or reject with a reason up to 300.                                                                         |
| `archiveHomeServicesProviderAction` / `home_services_provider_archive`            | Admin                      | Removes a provider from the directory; ratings are kept.                                                            |
| `saveHomeServicesRatingAction` / `home_services_rating_save`                      | Resident                   | 1–5 stars and an optional comment up to 500; one per resident per provider, editable.                               |
| `setHomeServicesCommentVisibilityAction` / `home_services_comment_visibility_set` | Admin                      | Hide or show a comment; the stars always count.                                                                     |

Permissions: `home_services:list` (admin, committee, resident), `home_services:manage` (admin), `home_services:suggest` (committee) and `home_services:rate` (resident). Pages are `/home-services`, `/home-services/{providerId}`, `/admin/home-services` and `/admin/home-services/{providerId}`. Guards have no access; providers have no logins and there are no bookings.

### 5.25 Polls & Voting (`poll`, P22; D-60)

Operations live in `src/core/poll/`; Server Actions are in the resident and admin Polls routes. The module ships
disabled. Writes use the `otherWritesUserMinute` limit. Each unit has one ballot cast by its frozen representative;
residents with an active occupancy in an electorate unit can view that vote and its permitted results, but only the
representative can submit. Admins manage polls; committee members have read-only management views. Guards and
housekeeping supervisors have no access.

| Operation / RPC                                                | Caller                                          | Contract                                                                                                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getPollMemberList` / `poll_member_list`                       | Resident                                        | Active and scheduled votes for the resident's occupied electorate units; no drafts.                                                                                |
| `getPollMemberVote` / `poll_member_get`                        | Resident                                        | Ballot details and only the caller's own unit submission state; scheduled votes disclose no ballot choices/options.                                                |
| `submitPollPublicBallot` / `poll_ballot_submit`                | Frozen representative                           | Submit or replace the full PUBLIC selection set before close.                                                                                                      |
| `submitPollPrivateBallot` / `poll_ballot_submit`               | Frozen representative                           | Submit one choice per office once; explicit NOTA is supported. Choices are not returned or stored per voter.                                                       |
| `getPollAdminList`, `getPollAdminVote`, `getPollParticipation` | Admin, committee                                | Management list/detail; committee gets counts only while open, with no open-vote names or choices.                                                                 |
| `createPollDraft`, `savePollDraft`, `deletePollDraft`          | Admin                                           | Create idempotent drafts, replace a draft with optimistic revision, or delete a draft.                                                                             |
| `activatePoll`, `schedulePoll`, `withdrawPollSchedule`         | Admin                                           | Validate readiness, freeze the effective tenant setting and electorate, and make permitted lifecycle changes.                                                      |
| `extendPollDeadline`, `completePollEarly`, `cancelPoll`        | Admin                                           | Change an active deadline, complete early or cancel with a required reason. If already overdue, completion commits and the application returns `CONFLICT/expired`. |
| `updatePollSettings`, `setPollRepresentative`                  | Admin; unit owner for their unit                | Change the society default or designate an eligible representative; changes are audited.                                                                           |
| `getPollResults`, `getPollExport`, `getPollRepresentatives`    | Eligible resident; admin/committee as specified | Enforce public/private visibility, completed-only exports and separate private voter rosters; no email addresses.                                                  |

Pages are `/polls`, `/polls/{voteId}`, `/polls/representatives`, `/admin/polls`,
`/admin/polls/new`, `/admin/polls/{voteId}`, `/admin/polls/{voteId}/edit`,
`/admin/polls/representatives` and `/admin/polls/settings`. Committee uses the administrative read-only views.
The completed-vote download route is `GET /api/polls/{voteId}/export?format=pdf|csv`; it requires a session and
admin or committee access. CSV is formula-safe and PDF is rendered with the existing `pdf-lib` dependency. Private
exports separate aggregate results from the list of units that voted; neither format contains email addresses.
The `/fixtures/poll` page uses synthetic scenarios and does not call production services.

### 5.26 Meetings & AGM (`meeting`, P23; D-61)

Operations live in `src/core/meeting/`; Server Actions are in the resident and admin Meetings routes. The module
ships disabled. Writes use the `otherWritesUserMinute` limit and an idempotency request ID. Permissions:
`meeting:attend` (resident), `meeting:list` and `meeting:minutes` (admin, committee) and `meeting:manage` (admin).
Guards and housekeeping supervisors have no access.

| Operation / RPC                                                                                   | Caller                         | Contract                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getMeetingMemberList`, `getMeetingMemberDetail`, `getMyMeetingActions`                           | Resident                       | Non-draft AGM/SGM meetings for units the caller occupies, published minutes, resolutions and the caller's own action items. Invisible meetings return not found.                                                 |
| `selfCheckInToMeeting` / `meeting_self_checkin`                                                   | Owner or tenant occupant       | Checks the caller's invited unit in once while the admin has check-in open; family members are refused.                                                                                                          |
| `getMeetingAdminList`, `getMeetingAdminDetail`, `getMeetingInviteeOptions`, `searchMeetingOwners` | Admin, committee               | Management list and detail with invitees, attendance, quorum indicator, resolutions, minutes and actions.                                                                                                        |
| `createMeeting`, `updateMeeting`, `deleteMeetingDraft`, `scheduleMeeting`, `cancelMeeting`        | Admin                          | Idempotent create; optimistic-version edits while draft/scheduled; schedule snapshots notice and quorum and notifies invitees; short notice is a warning only; cancel needs a reason.                            |
| `setMeetingCheckin`, `markMeetingHeld`, `setMeetingAttendance`, `removeMeetingAttendance`         | Admin                          | Open or close self check-in, mark held, record in-person, online or proxy (with the proxy's name) attendance, or undo a mark.                                                                                    |
| `saveMeetingResolution`, `deleteMeetingResolution`, `setMeetingResolutionOutcome`                 | Admin                          | Up to 50 resolutions; outcome passed, failed or deferred with optional counts.                                                                                                                                   |
| `linkMeetingResolutionPoll`, `createMeetingResolutionPoll`                                        | Admin, with `poll` enabled     | Link an existing poll by ID, or create a pre-filled public single-choice draft poll (For/Against/Abstain) through `createPollDraft` and `savePollDraft`.                                                         |
| `saveMeetingMinutes` / `publishMeetingMinutes` / `retryMeetingMinutesCopy`                        | Admin, committee / admin       | Draft minutes with an optimistic version; only the admin publishes. With `document` enabled, a minutes PDF is copied into the chosen Documents folder; a failed copy never fails the publish and can be retried. |
| `saveMeetingAction`, `setMeetingActionStatus`                                                     | Admin; action owner for status | Up to 200 actions on scheduled or held meetings; owners follow `action_owner_scope` and are notified on assignment. The owner or the admin marks done or reopens.                                                |
| `getMeetingSettings`, `updateMeetingSettings`                                                     | Admin                          | Notice days, quorum percentages and action owner scope; audited.                                                                                                                                                 |

Pages are `/meetings`, `/meetings/{meetingId}`, `/meetings/actions`, `/admin/meetings`, `/admin/meetings/new`,
`/admin/meetings/{meetingId}`, `/admin/meetings/{meetingId}/edit`, `/admin/meetings/actions` and
`/admin/meetings/settings`. Notification types cover scheduled, rescheduled, cancelled, minutes published, action
assigned and action overdue; they are in-app plus push through `sendNotificationPushesForRequest`. The
`/fixtures/meeting` page uses synthetic scenarios and does not call production services.

### 5.27 Committee analytics (Core, P27; D-62)

Operations live in `src/core/analytics/`; the Server Action for settings is in the admin Analytics route.
Permissions: `analytics:read` (admin, committee), `analytics:manage` and `analytics:export` (admin). Guards,
housekeeping supervisors and residents have no access.

| Operation / RPC                                         | Caller           | Contract                                                                                                                                                                                      |
| ------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAnalyticsDashboard` / `analytics_dashboard`         | Admin, committee | `months` 3, 6 or 12 (default 12) and `money` `months` or `fy`. Returns the selected metrics whose module is enabled, in catalogue order, calculated live; totals and buckets only.            |
| `getAnalyticsSettings` / `analytics_settings_get`       | Admin            | Selected metrics, whether they are the defaults, the version and the catalogue with each module's on/off state.                                                                               |
| `updateAnalyticsSettings` / `analytics_settings_update` | Admin            | `otherWritesUserMinute` limit; idempotency request ID; optimistic version (0 while on defaults; 40001 → "Settings changed. Reload and try again."); unknown or duplicate keys 22023; audited. |
| `getAnalyticsExport` / `analytics_export_record`        | Admin            | `exportsUserHourly` limit; audits the export (format, range and the metrics actually exported) before reading the dashboard.                                                                  |

Pages are `/admin/analytics` (admin and committee) and `/admin/analytics/settings` (admin; committee sees the
no-permission state). A metric whose data does not match the expected shape is shown as "not available right now"
and logged as a warning instead of breaking the page. The `/fixtures/analytics` page uses synthetic data.

### 5.28 Events & RSVPs (`event`, P30; D-63)

Operations live in `src/core/event/`; Server Actions are in the resident and admin Events routes. The module ships
disabled. Writes use the `otherWritesUserMinute` limit and an idempotency request ID. Permissions: `event:attend`
(resident), `event:list` and `event:manage` (admin, committee). Guards and housekeeping supervisors have no access.

| Operation / RPC                                                                 | Caller            | Contract                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getEventMemberList`, `getEventMemberDetail`                                    | Resident          | Published and cancelled events for units the caller occupies (upcoming or past), the caller's own units' answers, spots left and the contribution. Invisible events return not found.                                                   |
| `setEventRsvp` / `event_rsvp_set`                                               | Resident occupant | Going with headcount or Not going for one unit; optimistic RSVP version; refused when closed (`event_rsvp_closed`), full (`event_full`), over the per-flat limit or without `billing` for a paid event; charges or refunds.             |
| `getEventAdminList`, `getEventAdminDetail`, `getEventBlockOptions`              | Admin, committee  | Filtered list (upcoming, past, drafts, cancelled, all) and detail with totals, collected net amount and every unit's answer.                                                                                                            |
| `createEvent`, `updateEvent`, `deleteEventDraft`, `publishEvent`, `cancelEvent` | Admin, committee  | Idempotent create; optimistic-version edits until the event ends (contribution locked once published); publish readiness keys; cancel needs a reason and refunds every charge; publish, cancel and time/venue changes notify residents. |

Pages are `/events`, `/events/{eventId}`, `/admin/events`, `/admin/events/new`, `/admin/events/{eventId}` and
`/admin/events/{eventId}/edit`. Notifications are in-app plus push through `sendNotificationPushesForRequest`. The
`/fixtures/event` page uses synthetic scenarios and does not call production services.

### 5.29 Resident Community & Marketplace (`community`, P29; D-64)

Operations live in `src/core/community/`; Server Actions are in the resident and admin Community routes. The module
ships disabled. Writes use the `otherWritesUserMinute` limit and an idempotency request ID. Permissions:
`community:participate` (resident) and `community:moderate` (admin). Committee members, guards and housekeeping
supervisors have no access. Errors: `community_invalid_state`, `community_group_archived` and
`community_already_reported` map to a conflict; `community_muted` and `community_not_member` to forbidden;
`community_own_item` and `community_photo_invalid` to validation errors.

| Operation area              | Caller   | Contract                                                                                                                                                                                                                                              |
| --------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home, groups and feed       | Resident | Join or leave active groups; only members see a group's approved posts (plus their own pending or hidden ones). The new-listing alert switch and any active mute are shown on `/community`.                                                           |
| Posts, listings and replies | Resident | New posts and listings wait for admin approval; authors edit only while pending (not while muted) and can withdraw later; listing authors close or renew; replies appear at once on approved, open items. Up to 3 JPG/PNG photos per post or listing. |
| Reports                     | Resident | One report per person and flat per item, never on your own; 3 different flats hide the item until review.                                                                                                                                             |
| Moderation                  | Admin    | Queues pending, hidden, reported and removed; approve, reject (reason), remove (reason) and restore; groups create, rename and archive; mute for 7 days, 30 days or until lifted, and lift early.                                                     |

Photos are uploaded through a community Server Action that calls `community_photo_upload_path` and returns a signed
upload; view links last 300 seconds and are signed on the server only after `community_photo_access`. Pages are
`/community`, `/community/groups/{groupId}`, `/community/posts/{postId}`, `/community/marketplace`,
`/community/marketplace/new`, `/community/marketplace/{listingId}`, `/community/mine`, `/admin/community`,
`/admin/community/items/{targetType}/{targetId}`, `/admin/community/groups` and `/admin/community/mutes`.
Notifications are in-app plus push through `sendNotificationPushesForRequest`. The `/fixtures/community` page uses
synthetic scenarios and does not call production services.

## 6. HTTP Routes

| Route                               | Method       | Caller                         | Authentication                                                                                                                   | Purpose                                                                                                                                                                                                                           |
| ----------------------------------- | ------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`                       | GET          | Uptime monitor                 | None                                                                                                                             | Returns `ok` when the app and database respond, otherwise 503. **No** version, credentials or internals (NFR-11)                                                                                                                  |
| `/api/jobs/daily`                   | GET, POST    | Platform scheduler or operator | Secret bearer token (`CRON_SECRET`, compared in constant time); anything else is rejected with 401 and logged                    | Runs the daily jobs (below). Returns only counts per job                                                                                                                                                                          |
| `/api/push/subscriptions`           | POST, DELETE | Signed-in browser              | Session                                                                                                                          | Save or remove this device's push subscription; max 10 per user; validated; keys stored server-side only                                                                                                                          |
| `/api/client-errors`                | POST         | Browser (may be signed out)    | Same-origin, session optional; rate limited                                                                                      | Receives only message, stack, path and device summary; body ≤ 8 KB; strict schema; scrubbed; stored in the error log; returns the `referenceId` shown to the user                                                                 |
| `/api/files/upload-url`             | POST, DELETE | Signed-in browser              | Session + the owning module's permission and current parent-record access; developer scope applies only where explicitly allowed | Issues validated owner-scoped upload links; deletes only allowed unreferenced files. Tenancy accepts proofs only and has no client delete or NOC upload; parking accepts report photos only; metering accepts reading photos only |
| `/api/files/url`                    | POST         | Signed-in browser              | Session + current access to the owning society/parent record; no committee, guard or developer-only tenancy-document bypass      | Issues an at-most-five-minute private view link after the owning operation checks society, exact path and retention; documents use their own audited download action                                                              |
| `/api/billing/receipts/{paymentId}` | GET          | Signed-in browser              | Session + permission (payer, unit occupants, A, C)                                                                               | Streams the receipt PDF for a confirmed payment                                                                                                                                                                                   |
| `/api/billing/bills/{billId}`       | GET          | Signed-in browser              | Session + permission                                                                                                             | Streams the bill PDF                                                                                                                                                                                                              |
| `/api/exports/{jobId}`              | GET          | Signed-in browser              | Session + the job's creator or A/C of that society                                                                               | Downloads a finished CSV export; file expires with the job                                                                                                                                                                        |
| `/api/polls/{voteId}/export`        | GET          | Signed-in browser              | Session + admin or committee access to the completed vote                                                                        | Downloads a completed Polls PDF or CSV (`format` query); private results and voter roster are separate and no email is included                                                                                                   |
| `/api/analytics/export`             | GET          | Signed-in browser              | Session + admin of the active society (`analytics:export`); rate limited                                                         | Downloads the committee analytics as CSV (Metric, Module, Period or Label, Series, Value, Unit; money in rupees; formula-safe) or PDF (`format`, `months` 3/6/12, `money` months/fy); audited first; `analytics-YYYY-MM-DD` name  |

Rules for all routes:

- Same-origin only: no cross-origin access is allowed and no CORS headers are sent.
- Browser-originated state-changing routes require a session and reject missing/foreign origins. The authenticated daily-job GET and POST are server-to-server scheduler/manual exceptions.
- Inputs are validated (3.4); responses never contain stack traces; errors use the envelope (3.2) with the status codes in 3.5.
- Binary responses carry `no-store` cache headers and a safe download name (no personal data in the file name).

### 6.1 The daily job (`/api/jobs/daily`)

Vercel Cron sends `GET`; `POST` remains supported for authenticated manual invocation. Both methods require the `CRON_SECRET` bearer token. A missing or incorrect secret returns `401`; the attempt is logged without recording the supplied token. The secret comparison is constant-time. Responses are `no-store` and use the standard JSON envelope; success returns `{ ok: true, data: { jobs: [{ job, succeeded, skipped, failed }] } }`. Only per-job counts are returned.

Runs once a day (the free scheduler tier allows only one run per day and may start up to an hour late; the design tolerates both — ARCHITECTURE AD-02). The period key is the current calendar date in Asia/Kolkata. For each society-scoped task and trial/active society, the runner inserts `(society_id, job_name, period_key)` into `job_run_keys` before invoking the task. A conflict skips the task, so repeated calls for that date do no duplicate work. A global task claims one run key using the first eligible society; if there are no eligible societies, the retention task still runs because its database operations are idempotent. Each task failure is logged and counted without stopping other tasks or societies. A failed task can retry on the next period; it is not retried during the same period. Until modules register tasks, the registry is empty and the endpoint returns an empty `jobs` list without querying societies.

| Task                                   | Behavior                                                                                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Late fees                              | Adds one late-fee bill per overdue bill and month per society rule (BIL-3)                                                                                                                         |
| Reminders                              | Due-soon, due-today and overdue notifications (BIL-10)                                                                                                                                             |
| Stale payments                         | Flags UPI submissions waiting more than N days and notifies admins (BIL-17)                                                                                                                        |
| Visitor expiry                         | Finalises pending entries after their response deadline (VIS-4, VIS-7)                                                                                                                             |
| Delivery overdue view                  | Computes pending-response expiry and flags uncollected parcels on read (DEL-5, DEL-7)                                                                                                              |
| Request auto-close                     | Closes `resolved` requests after the society's days (SRQ-3)                                                                                                                                        |
| Request SLA escalation                 | `service_request.escalate`, after auto-close: escalates overdue requests to admins, then to committee after the category's days (P32, D-59); in-app, plus email if set                             |
| Poll opening, completion and retention | `poll.reconcile` and `poll.retention`: reconcile due votes and notifications, then purge per-person voter data older than two years while retaining totals (P22, D-60)                             |
| Meeting action reminders               | `meeting.action_reminders`, after `poll.reconcile`: one overdue reminder per open action item per society-local day, in-app plus push; capped at 2000 (P23, D-61)                                  |
| Event reminders                        | `event.reminders`, after `meeting.action_reminders`: one reminder per published event starting tomorrow (society-local) to flats that answered Going, in-app plus push; capped at 2000 (P30, D-63) |
| Module reminders (post-MVP)            | AMC expiry, low stock                                                                                                                                                                              |
| Retention                              | Removes expired private files through Storage, then anonymises/deletes rows per DATABASE 11.3; logs affected and orphan-file counts by bucket                                                      |
| Backup export                          | When enabled, GitHub Actions encrypts a nightly PostgreSQL 17 dump and uploads it to private Google Drive; weekly storage-file copy remains deferred (DATABASE 15.2)                               |

A task failure is logged (error log + Sentry) and does not stop the other tasks; the next day's run retries unfinished work because tasks are idempotent.

The off-site database backup runs separately from this route, only on `main` with `GOOGLE_DRIVE_BACKUPS_ENABLED=true`. It uses `SUPABASE_DB_URL`, OAuth `drive.file` credentials, a private app-created folder, and a separate encryption key from GitHub Actions configuration. Matching encrypted archives are retained for 30 days, with pruning only after remote size/checksum verification. It does not use or require the Supabase service-role key. Owner setup and the first verified backup/restore remain pending; see [the Google Drive guide](GOOGLE_DRIVE_BACKUP_SETUP.md).

### 6.2 File upload flow

An authorized admin or MFA-verified developer sends `POST /api/files/upload-url` with `{ bucket: "society-assets", societyId, contentType, sizeBytes }` to upload a logo. A guard/admin with visitor-create permission sends `{ bucket: "visitor-photos", unitId, contentType, sizeBytes }` for a visitor photo; the route checks the enabled visitor module, active unit, society, role, MIME type and size. That path is `{ society_id}/{unit_id}/visitors/{random_uuid}.jpg|png`. A requester sends `{ bucket: "request-files", requestId, contentType, sizeBytes }`; the route requires the enabled request module and `request:create`, and returns a path under `{ society_id}/{user_id}/requests/{client_request_id}/{random_uuid}.jpg|png`. An admin or committee member sends `{ bucket: "notice-files", requestId, contentType, sizeBytes }` for a notice attachment; the route requires the enabled notice module and `notice:create`, accepts JPEG, PNG or PDF, and returns `{ society_id}/notices/{requestId}/{random_uuid}.jpg|png|pdf`. The path, type and stored size are checked again when the notice is saved. Request IDs are client-generated idempotency keys and are revalidated when the uploaded object is attached to the request. In each case the response contains `{ path, signedUrl }`. The browser uploads directly to that one path with upsert disabled; the signed upload token expires after **two hours**. All files are at most 5 MiB. JPEG/PNG and, where the owning bucket permits, PDF are accepted; logo and gate-photo rules remain image-only.

Tenancy proof uploads use `{ bucket: "tenancy-files", moveId, kind, contentType, sizeBytes }` after the parent move is saved. The route and attachment operation both check current parent access and the exact immutable proof path; an uploaded object is not yet attached. See §5.16 for rental/police proof kinds, server-only NOC generation/attestation, private view access and retention. There is no client-supplied NOC or arbitrary tenancy-delete operation.

Parking report photos use `{ bucket: "parking-photos", contentType, sizeBytes }` with `parking:report` (guard or resident); `parking_photo_upload_path` returns `{ society_id}/reports/{uploader_id}/{random_uuid}.jpg|png`, and `parking_report_create` checks the object when the report is saved. `POST /api/files/url` with `{ bucket: "parking-photos", path }` calls `parking_photo_access` and returns a 300-second link. Document files do not use either route: `prepareDocumentUpload` (admin) issues the signed upload token directly, and `documentDownloadAction` audits the download before signing a 300-second link (§5.17). Unattached parking and document uploads are removed after 24 hours. Vendor files also bypass both routes: `prepareVendorDocumentUploadAction` (admin) and `prepareVendorQuoteUploadAction` (admin or committee) issue a signed upload to `{ society_id}/vendors/{uploader_id}/{random_uuid}.pdf|jpg|png`, and `vendorFileLinkAction` audits the download before signing a 300-second link (§5.20). Unattached vendor uploads are removed after 24 hours.

Patrol incident photos use `{ bucket: "patrol-photos", contentType, sizeBytes }` with `patrol:guard`; `patrol_photo_upload_path` returns `{ society_id}/incidents/{uploader_id}/{random_uuid}.jpg|png`, and `patrol_incident_create` attaches only the guard's own objects uploaded in the last 24 hours whose extension matches the stored type. `POST /api/files/url` with `{ bucket: "patrol-photos", path }` calls `patrol_photo_access` (admin, committee or the reporting guard) and returns a 300-second link (§5.21). Unattached patrol uploads are removed after 24 hours; attached photos after `photo_retention_days`.

The owning operation rechecks the path, object metadata, MIME type and actual size before saving an attachment. Replacing or clearing a logo audits the path change, then removes the former object. To remove an uploaded but unattached logo, send `DELETE /api/files/upload-url` with `{ bucket: "society-assets", path }`; attached logos cannot be deleted through this route. To view a logo, send `POST /api/files/url` with `{ bucket: "society-assets", path }`; an active society member or an MFA-verified developer receives `{ signedUrl, expiresIn: 300 }`. Private attachment links require the owning operation's current parent access. Browser uploads/downloads go directly to Storage; server-generated PDFs and NOC byte attestation also use authorised server-side Storage flows.

Only the bucket/owner combinations registered by the file boundary and documented owning operations are accepted. Future owning operations must recheck the exact society-scoped path, object existence, MIME type and actual size before saving an attachment.

---

## 7. Realtime Channels

| Channel         | Table              | Subscribers                         | Purpose                                      |
| --------------- | ------------------ | ----------------------------------- | -------------------------------------------- |
| Visitor status  | `visitor_entries`  | G, A (society); R (rows RLS allows) | Waiting panel, pending approvals, inside-now |
| Delivery status | `delivery_entries` | Same                                | Delivery response and parcel status          |
| Inbox           | `notifications`    | The user only                       | Unread badge; SOS alert banner hint          |

The P21 SOS banner (§5.19) subscribes to the user's own `notifications` inserts on channel `sos-banner:{userId}`, reloads `sos_my_alerts` on each event and rechecks every 30 seconds. No SOS table is published (D-41: in-app and Realtime only).

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

- **Fail-safe behavior:** if the counter store is unavailable, security-sensitive limits (sign-in codes, PIN, code validation, society code lookup) **fail closed** (the action is refused with `INTEGRATION_FAILED`, "A connected service is temporarily unavailable", rather than a misleading "too many attempts"); the rest **fail open** and the failure is logged.
- **Non-production sign-in limits:** when `NEXT_PUBLIC_APP_ENV` is not `production` (local, preview and staging/beta), the `auth.requestCode` and `auth.verifyCode` hourly and cooldown counters allow 50 per window so testers can sign in and out repeatedly. The per-code wrong-try lock and developer sign-in limits are unchanged, and production keeps the values above.
- **Email quota guard:** each transactional email, including the operational alert, reserves one send against `BREVO_DAILY_EMAIL_QUOTA`; one developer alert is sent at 80% and sends over the configured cap are held. Provider timeouts and 5xx responses receive one retry; all adapter failures are logged without recipient or response-body details and never fail the originating action.
- Reads are not individually limited by the app; platform protection (DDoS, bot rules) is provided by the host.

---

## 11. Required Environment Variables

Names only; values are kept in the host's secret store and never committed (ARCHITECTURE 16.2). **Public** variables begin with `NEXT_PUBLIC_` and are visible in the browser; everything else is **server-only**. A build check fails if a secret-looking name carries the public prefix.

| Variable                                                                             | Scope                                                        | Purpose                                                                                              | Required in                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------- |
| `NEXT_PUBLIC_APP_ENV`                                                                | Public                                                       | `local`, `preview`, `staging`, `production`                                                          | All                         |
| `NEXT_PUBLIC_APP_URL`                                                                | Public                                                       | Base URL (used to validate origins and build links)                                                  | All                         |
| `APP_DEPLOYMENT`                                                                     | Server                                                       | `shared` (default) or `beta`; restricts accepted hosts and Vercel release branch                     | Set explicitly on Vercel    |
| `APP_BASE_DOMAIN`                                                                    | Server                                                       | Parent hostname without scheme/port; defaults to `homeish.vercel.app`                                | Optional override           |
| `VERCEL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`                              | Server, provider-injected                                    | Disable local hosts on Vercel; allow exact deployment/project aliases for their own environment only | Vercel                      |
| `APP_VERSION`                                                                        | Server (injected at build)                                   | Version shown in the error log                                                                       | All                         |
| `NEXT_PUBLIC_SUPABASE_URL`                                                           | Public                                                       | Supabase project URL                                                                                 | All                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                      | Public                                                       | Public client key; safe because the database rules decide access                                     | All                         |
| `SUPABASE_SERVICE_ROLE_KEY`                                                          | **Server secret**                                            | Privileged identity (only the isolated server module, ARCHITECTURE 8.4)                              | All except local-only tools |
| `SUPABASE_DB_URL`                                                                    | **Server secret (CI/migrations/backup only, never runtime)** | Direct database connection                                                                           | CI                          |
| `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_DRIVE_BACKUPS_ENABLED`                             | GitHub Actions variable                                      | Private app-created backup folder; explicit opt-in (default disabled)                                | `main` backup workflow      |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` | **GitHub Actions secret**                                    | Own OAuth app and offline `drive.file` authorization, never the Google account password              | `main` backup workflow      |
| `BACKUP_ENCRYPTION_KEY`                                                              | **GitHub Actions secret; separate offline recovery copy**    | 32-byte AES-256-GCM key encoded as 64 hex characters; never stored alongside archives                | Backup/restore tooling      |
| `BREVO_API_KEY`                                                                      | **Server secret**                                            | Send receipts and alerts                                                                             | Staging, production         |
| `BREVO_DAILY_EMAIL_QUOTA`                                                            | Server                                                       | Per-deployment daily sending cap; an alert is sent at 80%                                            | Staging, production         |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`                                              | Server                                                       | Verified sender                                                                                      | Staging, production         |
| `DEVELOPER_ALERT_EMAIL`                                                              | Server                                                       | Where critical alerts go                                                                             | Staging, production         |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                                                       | Public                                                       | Browser push subscription key                                                                        | All                         |
| `VAPID_PRIVATE_KEY`                                                                  | **Server secret**                                            | Signs push messages                                                                                  | All                         |
| `VAPID_SUBJECT`                                                                      | Server                                                       | Contact address for push services                                                                    | All                         |
| `NEXT_PUBLIC_SENTRY_DSN`                                                             | Public                                                       | Where browser errors go (a DSN is not a secret)                                                      | Staging, production         |
| `SENTRY_DSN`                                                                         | Server                                                       | Where server errors go                                                                               | Staging, production         |
| `SENTRY_AUTH_TOKEN`                                                                  | **CI secret**                                                | Uploads source maps                                                                                  | CI                          |
| `CRON_SECRET`                                                                        | **Server secret**                                            | Authenticates the scheduler on `/api/jobs/daily`                                                     | Staging, production         |
| `GUARD_SESSION_SECRET`                                                               | **Server secret**                                            | Signs the on-duty guard cookie                                                                       | All                         |
| `RATE_LIMIT_HASH_SALT`                                                               | **Server secret**                                            | Hashes rate-limit keys                                                                               | All                         |

Notes:

- **Brevo SMTP credentials** for sign-in codes are entered in the Supabase project settings, not in this application's environment.
- Limits, retention periods and defaults are constants in code and per-society settings in the database, not environment variables **[APA-03]** (this supersedes the "Feature" row in ARCHITECTURE 16.2).
- Startup validates this list with a schema; a missing or malformed value fails fast with a clear message (names only, never values).
- Local, preview and staging share the non-production `homeish-testdb` Supabase project and its keys (ARCHITECTURE AD-13); the demo uses `homeish-demo` keys only in the `demo-homeish` deployment; production uses `homeish-live`, whose keys live only in the host secret stores and are never used elsewhere (AD-14).
- The public website/entry scaffold makes no backend calls. Hosted scaffolds may use `preview` with nonfunctional `.invalid` backend URLs and placeholder keys, never real society credentials. Do not treat this as staging/production readiness. Full demo and beta backends remain unconfigured.
- D-34 host routing adds no authenticated operations, public society lookup API or reset endpoint. Server-side page rendering resolves an `active` society host through the service-role-only `society_host_lookup(slug)` RPC (id, name, status; archived societies are hidden); onboarding uses the developer RPCs `developer_create_society_with_slug`, `developer_set_society_slug` and `developer_society_onboarding_status` (OPERATIONS "Society onboarding"). Unknown hosts return 404; non-marketing hosts carry `X-Robots-Tag: noindex, nofollow`; host-routed pages are private/no-store. The reserved Maplewood host serves only a disabled `/` placeholder; its other paths return 404, and onboarding and login remain unavailable. An `active` society host serves sign-in and the app, but never `/developer`. A hostname is not a society authorization credential.
- Homepage H1/H2 adds no operations, routes, enquiry submission or data collection. **Owner decision D-49 (2026-11-15):** the public homepage renders disabled **Try demo** buttons with **Demo coming soon**, no URL and no inline demo. Demo hosting and CTA connection require a later authorised, verified setup after product readiness. Existing demo-host routing and browser-only resets remain unchanged.
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
| Staff gate payload             | Guards receive staff name, photo, role, status and destination-unit warnings only; phone, ID type and ID suffix are never included                                                                                                  |
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
