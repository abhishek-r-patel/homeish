# Dwello — API Design (API.md)

| Field | Value |
|---|---|
| Product | Dwello (PRD D-01 approved 2026-11-09) |
| Version | 0.1 (Draft for approval) |
| Date | 2026-11-09 |
| Depends on | [PRD.md](./PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [DESIGN.md](./DESIGN.md) |
| Covers | Every way data moves: browser to server, server to database, and server to outside services |

**Conventions**
- **[APA-nn]** = API assumption. **[APD-nn]** = API decision (Section 16).
- This file defines contracts in tables and prose. It contains no code. Names are the contract: an operation, route or error code listed here may only change through this document.
- "Role" letters used below: **D** developer, **A** admin, **C** committee (read-only unless also A), **G** guard, **H** housekeeping supervisor (post-MVP), **R** resident (owner/tenant/family, further limited per unit as in the PRD matrix).
- Where PRD and this file disagree on behavior, the PRD wins.

---

## 1. Principles

1. **There is no public API.** Dwello does not offer an API to partners or other apps (PRD out of scope). Everything below is internal, plus the connections to outside services.
2. **The browser is untrusted.** Every operation re-verifies who the caller is, which society they act in, whether the module is on, their role and ownership of the data — on the server and again in the database (ARCHITECTURE 8.2).
3. **Few doors.** Normal pages and forms use *server operations* (Section 5). A small set of HTTP routes exists only where an outside system, a file or a scheduler needs one (Section 6).
4. **One shape for answers and errors** across every operation (Section 3).
5. **Secrets never reach the browser** (Sections 11 and 13).
6. **Every outside call is fault-tolerant**: timeout, limited retry, clear fallback, and a log entry with the request ID (Section 14).
7. **Define only what is needed.** No endpoint exists "just in case".

### 1.1 Interface types

| Type | Used for | Caller | Authenticated by |
|---|---|---|---|
| **Server operation** (Next.js Server Action) | All reads that change with user input and all writes from the app screens | Our own screens only | Session cookie, verified server-side on every call |
| **Page data loading** (Server Components calling server query functions) | All screen data on first load | Our own pages | Same session |
| **HTTP route** (Route Handler) | Health, daily job, push registration, client error reports, file URLs and downloads | Browser, scheduler, uptime monitor | Per route (Section 6) |
| **Realtime channel** (Supabase Realtime) | Live status hints for visitor, delivery and notifications | Signed-in browsers | Session; row access decided by the same database rules |
| **Auth service calls** (Supabase Auth) | Sign-in codes, developer password + MFA, session refresh | Our server on behalf of the user | Rate limited; closed sign-up |
| **Outbound calls** | Email (Brevo), Web Push, Sentry, file storage | Our server only | Server-held secrets |

---

## 2. Authentication and Authorization

### 2.1 Sign-in (PRD CORE-1, D-03)
| Step | Operation | Rules |
|---|---|---|
| 1 | `auth.requestCode` (email, purpose `signin` or `register`) | Always answers with the same generic message ("If this email is registered, a code has been sent") whether or not the email is known. Sends a 6-digit code by email only if the email has an invitation/membership (`signin`) or the caller is in the registration flow (`register`, Section 5.1). Closed sign-up: an email with neither never gets a society |
| 2 | `auth.verifyCode` (email, code) | Code is single use and short-lived; 5 wrong tries invalidate it; on success a session is created and the user's invited memberships are linked (`claim_memberships`, DATABASE 3.8) |
| 3 | Redirect | Based on state: no active membership → "waiting for approval" / registration screen; several societies → society picker (S-03); otherwise the home screen. Redirect targets are chosen by the server from a fixed list, never from a client-supplied address |
| — | `auth.signOut` | Ends the session |

There are **no magic links**: codes are typed in, so there is no callback URL to protect and no open-redirect risk. Future methods (mobile OTP, passwords, Google) are added as extra `auth.*` operations without changing user data (PRD A-35).

### 2.2 Developer sign-in
`auth.developerSignIn` (email + password) followed by `auth.developerVerifyMfa` (authenticator code) on a separate screen/route (S-05). Every `developer.*` operation requires a session that has passed MFA recently; otherwise it fails with `MFA_REQUIRED`. Developer accounts are created only by a database administrator (ARCHITECTURE 8.1).

### 2.3 Session
- Secure, HTTP-only, same-site cookies; 30-day society sessions, shorter developer sessions (ARCHITECTURE AA-02).
- On every operation the server **verifies the user with the auth service** (not just reads the cookie) and then loads the **request context**: user, active society, roles, enabled modules (ARCHITECTURE 6.2).
- The active society is a hint chosen in the switcher (`session.switchSociety`); it is always re-validated against current memberships, so removing someone's role takes effect on their next request.

### 2.4 Shared gate account: guard identity (PRD CORE-16)
- In shared mode the shared login is a normal guard membership; on top of it, `guards.identify` records *which roster guard is on duty*.
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
| Case | Shape |
|---|---|
| Success | `ok: true`, `data` (the result), optional `meta` (pagination, server time) |
| Failure | `ok: false`, `error` with `code`, `message` (plain language, safe to show), optional `fieldErrors` (field → message), optional `referenceId` (for unexpected errors), optional `retryAfterSeconds` |

- Expected failures are **returned**, never thrown to the user. Unexpected failures are caught at the boundary, logged, and returned as `INTERNAL_ERROR` with a `referenceId` (PRD LOG-2).
- Messages never include stack traces, SQL, internal IDs of other records, or whether another user's data exists.

### 3.3 Data formats
| Type | Format |
|---|---|
| Field names | `camelCase` in requests and responses |
| IDs | UUID strings |
| Timestamps | ISO 8601 in UTC (`2026-11-09T12:30:00Z`); the screen converts to the society timezone |
| Dates without time | `YYYY-MM-DD` (bill due date, billing period start) |
| Money | Integer **paise** (`amountPaise`); the currency comes from the society. Screens format it; the API never returns rounded rupee decimals |
| Enumerations | Lower-case snake_case, identical to the database check values (DATABASE Sections 3–7) |
| Optional values | Explicit `null`, not omitted |
| Text | UTF-8, trimmed, no HTML; length limits as in DATABASE |
| Phones/emails | Emails lower-cased and trimmed; phones normalised to `+91…` format |

### 3.4 Validation
- Every operation and route validates its input with a **shared schema** (the same one the form uses); unknown fields are rejected, strings are trimmed and length-limited, enumerations are closed lists, numbers have ranges.
- Validation failures return `VALIDATION_FAILED` with `fieldErrors` in plain language (DESIGN 7.2).
- The database constraints (DATABASE Section 8) are the final backstop; a constraint violation that slips through is mapped to the right conflict or validation code, not shown raw.
- Files: type, size and count are validated before issuing an upload URL **and** again when the upload is attached (Section 6, files).

### 3.5 Error codes
| Code | When | HTTP status (routes) | Screen behavior |
|---|---|---|---|
| `VALIDATION_FAILED` | Bad or missing input | 400 | Field errors, input preserved |
| `UNAUTHENTICATED` | No valid session | 401 | Go to sign-in |
| `SESSION_EXPIRED` | Session ended | 401 | Session-ended page, return to destination after sign-in |
| `MFA_REQUIRED` | Developer action without recent MFA | 401 | MFA prompt |
| `FORBIDDEN` | Role or scope denied | 403 | "You don't have access" |
| `NOT_FOUND` | Missing or not visible | 404 | Not-found state |
| `MODULE_DISABLED` | Module off for the society | 403 | Module-disabled page |
| `SOCIETY_SUSPENDED` | Write while suspended | 403 | Read-only banner |
| `SOCIETY_ARCHIVED` | Any access to an archived society | 403 | Blocked page |
| `CONFLICT` | State no longer allows the action. Always carries a `reason` (below) | 409 | Specific message and next step |
| `RATE_LIMITED` | Too many attempts | 429 (+ `retryAfterSeconds`) | Wait message with time |
| `GUARD_NOT_IDENTIFIED` | Shared gate account without an identified guard | 403 | "Handled by" prompt |
| `INTEGRATION_FAILED` | An outside service failed and no fallback exists | 502/503 | Retry or pending state per DESIGN 9.3 |
| `INTERNAL_ERROR` | Anything unexpected | 500 | Error panel with reference ID |

`CONFLICT` reasons (closed list): `already_decided`, `expired`, `duplicate_reference` (UTR), `duplicate_charge`, `stale_version`, `invalid_state`, `limit_reached`, `has_history` (delete blocked), `not_unpaid` (cancel blocked).

### 3.6 Idempotency and double submission
- Operations that create user-submitted records (`visitor.createEntry`, `delivery.createEntry`, `billing.submitPayment`, `request.create`, `request.addComment`) take a **`clientRequestId`** generated once per form open. A repeat with the same ID returns the original result instead of creating a second record (DATABASE 1.1).
- Operations with a natural rule are protected by the database instead: UTR uniqueness, one bill line per unit/period/charge type, one late fee per overdue bill and month, first-response-wins decisions.
- State-changing operations on an existing record (confirm payment, decide visitor, waive) are **safe to repeat**: a second call returns `CONFLICT` with reason `already_decided`/`invalid_state` and the current status, never a second effect.
- The submit button also goes into a loading state (DESIGN 6.1), but that is a convenience, not the protection.

### 3.7 Concurrent edits
Edit operations on data several people can change (requests, resident records, charge types, society and module settings) accept the record's last-seen **`version`** (its `updated_at`). If it no longer matches, the operation returns `CONFLICT/stale_version` and the screen offers Reload with the typed input kept (DESIGN 9.4).

### 3.8 Pagination, sorting and filtering (lists)
| Item | Rule |
|---|---|
| Paging | `page` (from 1) and `pageSize` (allowed 10, 25, 50, 100; default 25). Response `meta`: `page`, `pageSize`, `total` (exact), `totalPages` — as DESIGN 6.13 requires |
| Sorting | `sort` and `dir` (`asc`/`desc`) from an allow-list per list; a stable tie-breaker (record ID) is always added; unknown values are rejected |
| Filtering | Allow-listed filters per list (below). Filters and sorting run over the **whole authorised data set before paging**, with exact totals |
| Text search | Literal, case-insensitive "contains" match; wildcard characters are escaped; length-limited (2–60) |
| Dates | `from` inclusive, `before` exclusive, interpreted in the **society timezone** **[APA-01]** |
| Personal data in filters | Emails, phone numbers and payment references are searched through the operation's **body**, not the page URL, so they never appear in links, logs or browser history **[APA-02]** |
| State in the URL | Non-personal filters, sort and page live in the page URL so refresh, back and sharing work (DESIGN 6.14) |
| Large logs | Error and audit logs use the same page/total model in MVP; a cursor model is introduced only if they pass roughly 100,000 rows (ARCHITECTURE Section 3) |

| List | Allowed filters | Default sort |
|---|---|---|
| Visitor log | date range, unit, status, purpose, visitor name contains, source | newest first |
| Delivery log | date range, unit, status, company, type | newest first |
| Members / residents | role, status, unit, name contains, relationship | name |
| Bills | unit, status (incl. overdue), kind, period, due date range | due date, newest first |
| Payments / review queue | status, unit, mode, date range, reference contains (body) | oldest awaiting first in the queue; otherwise newest |
| Ledger | unit (required), date range | oldest first (running balance) |
| Service requests | status, category, unit, assignee, priority, overdue, date range, location type | newest first |
| Notifications | unread only | newest first |
| Jobs | type, status | newest first |
| Audit log | society, actor, action, entity type, date range | newest first |
| Error log | society, module, severity, status, source, user, date range, text, reference ID | newest first |

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
| Operation | Who | Purpose | Notes |
|---|---|---|---|
| `auth.requestCode` | Anyone | Send a sign-in or registration code | Generic answer; rate limited; Section 2.1 |
| `auth.verifyCode` | Anyone | Check the code and start a session | Links invited memberships |
| `auth.signOut` | Signed in | End session | |
| `auth.developerSignIn`, `auth.developerVerifyMfa` | D | Developer sign-in with MFA | Separate route |
| `session.get` | Signed in | Current user, societies, roles, enabled modules, unread count | Used by the shell and navigation |
| `session.switchSociety` | Signed in | Change active society | Validated against memberships |
| `profile.update` | Signed in | Change own name, phone, photo, font preference | Direct on own row; preference is `manrope_sora` or `device_default` |
| `registration.lookupSociety` | Anyone (code holder) | Resolve a **society code** to the society name and its unit picker data | Code must match; rate limited; returns only name, blocks and unit numbers **[APD-1]** |
| `registration.submit` | Signed in, no membership yet | Ask to join a unit | Creates a pending membership and occupancy; notifies admins (CORE-9) |

### 5.2 Society structure and people (`society`, `structure`, `members`, `guards`)
| Operation | Who | Purpose | DB function / notes |
|---|---|---|---|
| `society.get` | Members, D | Society profile and settings | |
| `society.updateProfile` | A, D | Name, address, contact, logo, timezone, custom unit label | Whitelisted columns; unit label is 1–24 letters or spaces; audited |
| `society.updateGateSettings` | A, D | Gate login mode and guard identification (name pick / PIN) | Audited |
| `society.rotateJoinCode` / `society.disableJoinCode` | A, D | Create/replace/turn off the society code used for self-registration | Audited **[APD-1]** |
| `structure.blocks.list/create/update` | A (create/update), members (list) | Manage blocks | Direct |
| `structure.units.list/create/update/deactivate` | A, members (list) | Manage units; deactivate only, never delete with history | Direct; `has_history` conflict |
| `structure.units.importPreview` / `importConfirm` | A | CSV import of units in two steps | Preview writes nothing; confirm creates a job (DATABASE `jobs`) |
| `members.list/get` | A, C | People of the society | PII masked per Section 13 |
| `members.invite` | A | Invite by email to a unit and role(s) | Creates invited membership; no email is sent until the person requests a code |
| `members.importPreview` / `importConfirm` | A | CSV import of residents | Same two-step pattern |
| `members.approve` / `members.reject` | A (C if enabled) | Decide a self-registration | Audited; notifies the applicant |
| `members.changeRoles` | A | Change roles | Audited (PRD LOG-4) |
| `members.deactivate` | A | Remove access immediately | Audited; history kept (CORE-10) |
| `members.unit.assign/move/end` | A | Occupancy: owner/tenant/family, primary, approver flag | Enforces one primary per unit |
| `household.members.list/setApprover` | R (owner/primary) | See and manage own household approvers | Own unit only (R-08) |
| `guards.list/add/update/deactivate` | A (write), A/C/G (list) | Guard roster | Direct on name/active |
| `guards.setPin` | A | Set or reset a guard's PIN | PIN stored only as a hash; never returned |
| `guards.identify` | G (shared mode) | Say who is on duty | Section 2.4; rate limited |
| `guards.unitContacts` | G | Name and phone of a unit's approvers for "Call Resident" | Returns only that; audited by volume, not by row |

### 5.3 Notifications and jobs
| Operation | Who | Purpose |
|---|---|---|
| `notifications.list` / `unreadCount` | Signed in | Own inbox and badge |
| `notifications.markRead` / `markAllRead` | Signed in | Own items only |
| `jobs.list/get` | Creator, A, D | Progress and result of imports, bill generation, exports |
| `audit.list/get` | A, C (own society), D | Audit history with filters (Section 3.8) |

### 5.4 Developer console (`developer`)
All require MFA (2.2). All actions are audited.
| Operation | Purpose | Notes |
|---|---|---|
| `developer.societies.list/get/create/update` | Manage societies | Creation also creates the `core` module row, default settings and default request categories (DATABASE 14.2) |
| `developer.societies.setStatus` | Trial / active / suspended / archived | Standard confirmation stating the consequence for suspend/archive (DESIGN 11.4) |
| `developer.modules.list` / `toggle` | Show and enable/disable modules per society | One transaction with audit; standard confirmation states the effect |
| `developer.modules.updateSettings` | Edit module settings | Validated against the module's schema |
| `developer.members.createFirstAdmin` | Invite the first admin of a society | |
| `developer.errors.list/get/lookupByReference` | Error log viewer | Lookup by the reference ID a user reports |
| `developer.errors.resolve` / `ignore` | Change error status with optional note | |
| `developer.audit.list` | Cross-society audit | |
| `developer.health.summary` | Counts by severity, society and route | Built from the error log |

### 5.5 Visitor (`visitor`)
| Operation | Who | Purpose | Notes |
|---|---|---|---|
| `visitor.createEntry` | G, A | Log a walk-in; notifies unit approvers | `clientRequestId`; blacklist warning returned in the response; needs identified guard |
| `visitor.decide` | R (approver of the unit) | Allow or deny | First response wins; `already_decided` conflict if late |
| `visitor.override` | G | Allow after no response | Requires reason; only if setting allows; audited |
| `visitor.checkIn` / `visitor.checkOut` | G, A | Record entry and exit | Check-in only from `approved` |
| `visitor.list/get` | G, A, C (society); R (own unit) | Logs per Section 3.8 | Live "waiting" and "inside now" views use the same list |
| `visitor.preApproval.create` | R | Pre-approve a visitor; returns the 6-digit code and a QR encoding the same code | Code remains available for manual sharing and entry |
| `visitor.preApproval.cancel` / `list` | R (own), A/C | Cancel or list | |
| `visitor.preApproval.validate` | G | Check a typed or scanned code | Returns only the matching visitor's name, unit and window, or a distinct reason: invalid / expired / already used; rate limited |
| `visitor.preApproval.checkIn` | G | Create the entry from a valid code and mark the code used | Single use |
| `visitor.blacklist.list/add/remove` | A (write), A/C/G (list) | Manage blacklist | Warn only (A-12) |

### 5.6 Delivery (`delivery`)
| Operation | Who | Purpose | Notes |
|---|---|---|---|
| `delivery.createEntry` | G, A | Log a delivery | Applies the unit's standing rule automatically (`decision_source = preference`) |
| `delivery.respond` | R (approver) | Allow / leave at gate / deny | First response wins |
| `delivery.override` | G | Decide after no response | Reason required; audited |
| `delivery.markCollected` | G, R (own unit) | Close a parcel left at the gate | Only from `left_at_gate` |
| `delivery.list/get` | G, A, C; R (own unit) | Logs; includes the uncollected-parcel view | |
| `delivery.preference.get/set` | R (approver of own unit), A/C (get) | Unit standing rule | Direct |

### 5.7 Billing (`billing`)
| Operation | Who | Purpose | Notes |
|---|---|---|---|
| `billing.charges.list/create/update/deactivate` | A (write), A/C (list) | Charge types | Direct |
| `billing.bills.preview` | A | Show per-unit totals before generating | Read-only |
| `billing.bills.generate` | A | Create bills for a period/selection | Runs as a job; set-based; idempotent by the unit/period/charge rule; applies existing unit credit automatically (DATABASE 6.1); notifies residents after commit |
| `billing.fines.add` | A | Add a manual fine | Reason required; audited |
| `billing.bills.waive` | A (C approval if the setting asks) | Waive part or all of a bill | Reason required; `not_unpaid` for cancel after payment; audited |
| `billing.bills.list/get` | A, C; R (own unit) | Bills and detail | |
| `billing.ledger.get` | A, C; R (own unit) | Unit statement with running balance | |
| `billing.paymentDetails.get` | Members | Society UPI ID, payee, QR path, last changed | Residents need it to pay |
| `billing.paymentDetails.update` | A | Change UPI details | Validates UPI ID format; audited; notifies all admins and committee (BIL-15) |
| `billing.submitPayment` | R | Submit UPI reference (+ optional screenshot path) for a unit | `clientRequestId`; UTR uniqueness; status `awaiting_confirmation`; notifies admins |
| `billing.recordPayment` | A | Record cash/cheque/bank/UPI received | Confirmed immediately; receipt number issued |
| `billing.confirmPayment` | A | Confirm a submission (may correct the amount) | Allocates oldest-first; ledger credit; receipt; notifies payer; amount change audited |
| `billing.rejectPayment` | A | Reject with reason | Resident may resubmit |
| `billing.payments.list/get` | A, C (all); R (own unit and own submissions) | Payments and the review queue | |
| `billing.dashboard` | A, C | Billed, collected, outstanding, collection %, top defaulters | Read-only aggregate |
| `billing.reports.export` | A, C | CSV: dues by unit, collections, defaulters | Runs as a job; audited as an export (LOG-4); formula-safe cells |

### 5.8 Service requests (`request`)
| Operation | Who | Purpose | Notes |
|---|---|---|---|
| `request.categories.list/create/update` | Members (list), A (write) | Category list and SLA hours | Direct |
| `request.create` | R, A | Raise a request (unit or common area) | `clientRequestId`; up to 3 attachments; computes SLA due time; notifies admins |
| `request.list/get` | A, C (all); R (own unit and common-area); assignee | Lists and detail with comments, attachments and timeline | |
| `request.assign` | A | Assign to a member or an external vendor (name + phone) | Writes a timeline event |
| `request.updateStatus` | A, assignee (if a user) | Move to in progress / resolved | Valid transitions only |
| `request.reject` | A | Reject with reason | Reason required |
| `request.confirmClose` / `request.reopen` | R (requester) | Close or reopen within the allowed days | Auto-close by the daily job after the society's days |
| `request.rate` | R (requester) | 1–5 stars and comment after closing | Once |
| `request.addComment` | R (requester), A, assignee | Comment thread | `clientRequestId`; notifies the other side; residents reading a common-area request cannot comment |

---

## 6. HTTP Routes

| Route | Method | Caller | Authentication | Purpose |
|---|---|---|---|---|
| `/api/health` | GET | Uptime monitor | None | Returns `ok` when the app and database respond, otherwise 503. **No** version, credentials or internals (NFR-11) |
| `/api/jobs/daily` | POST | Platform scheduler | Secret bearer token (`CRON_SECRET`, compared in constant time); anything else is rejected with 401 and logged | Runs the daily jobs (below). Returns only counts per job |
| `/api/push/subscriptions` | POST, DELETE | Signed-in browser | Session | Save or remove this device's push subscription; max 5 per user; validated; keys stored server-side only |
| `/api/client-errors` | POST | Browser (may be signed out) | Session optional; rate limited | Receives a client error report; body ≤ 8 KB; strict schema; scrubbed; stored in the error log; returns the `referenceId` shown to the user |
| `/api/files/upload-url` | POST | Signed-in browser | Session + permission | Issues a short-lived **upload link** for one allowed file after checking bucket, owner entity, type, size and counts |
| `/api/files/url` | POST | Signed-in browser | Session + permission | Issues a **short-lived view link** for a stored file after checking the caller may see the owning record |
| `/api/billing/receipts/{paymentId}` | GET | Signed-in browser | Session + permission (payer, unit occupants, A, C) | Streams the receipt PDF for a confirmed payment |
| `/api/billing/bills/{billId}` | GET | Signed-in browser | Session + permission | Streams the bill PDF |
| `/api/exports/{jobId}` | GET | Signed-in browser | Session + the job's creator or A/C of that society | Downloads a finished CSV export; file expires with the job |

Rules for all routes:
- Same-origin only: no cross-origin access is allowed and no CORS headers are sent.
- State-changing routes require a session and reject missing/foreign origins; there are no state-changing GET routes.
- Inputs are validated (3.4); responses never contain stack traces; errors use the envelope (3.2) with the status codes in 3.5.
- Binary responses carry `no-store` cache headers and a safe download name (no personal data in the file name).

### 6.1 The daily job (`/api/jobs/daily`)
Runs once a day (the free scheduler tier allows only one run per day and may start up to an hour late; the design tolerates both — ARCHITECTURE AD-02). Each task writes a run key first, so a second call the same day does nothing.

| Task | Behavior |
|---|---|
| Late fees | Adds one late-fee bill per overdue bill and month per society rule (BIL-3) |
| Reminders | Due-soon, due-today and overdue notifications (BIL-10) |
| Stale payments | Flags UPI submissions waiting more than N days and notifies admins (BIL-17) |
| Visitor/delivery housekeeping | Finalises expired pending entries; lists uncollected parcels (DEL-5); overstay flags (VIS-9) |
| Request auto-close | Closes `resolved` requests after the society's days (SRQ-3) |
| Module reminders (post-MVP) | AMC expiry, low stock |
| Retention | Purges and anonymises per DATABASE 11.3; clears old rate-limit counters |
| Backup export | Nightly database export is run by the CI scheduler, not by this route (DATABASE 15.2) |

A task failure is logged (error log + Sentry) and does not stop the other tasks; the next day's run retries unfinished work because tasks are idempotent.

### 6.2 File upload flow
1. Screen asks `/api/files/upload-url` for a link (bucket, owning record, file name, type, size).
2. Browser uploads **directly to storage** with that link (the file never passes through our server; link valid minutes, single path).
3. The business operation that owns the file (`visitor.createEntry`, `billing.submitPayment`, `request.create`, `request.addComment`, `society.updateProfile`, `billing.paymentDetails.update`) receives the **storage path**, re-checks that the object exists, belongs to this society, and matches type and size limits, then saves the path.
4. Files never attached are removed by the weekly orphan cleanup (DATABASE 12).
Limits: JPG, PNG or PDF; 5 MB each; at most 3 on a request; one screenshot per payment submission.

---

## 7. Realtime Channels

| Channel | Table | Subscribers | Purpose |
|---|---|---|---|
| Visitor status | `visitor_entries` | G, A (society); R (rows RLS allows) | Waiting panel, pending approvals, inside-now |
| Delivery status | `delivery_entries` | Same | Delivery response and parcel status |
| Inbox | `notifications` | The user only | Unread badge |

Rules:
- Events are **hints**: the screen refetches authoritative data through the normal operation after an event.
- Access is decided by the same row rules as normal reads; a user receives nothing they could not fetch directly.
- If the connection drops, the screen switches to polling every 5 seconds (with backoff) and shows "Updated {time}" (DESIGN 8.2).
- No client may publish to channels; all changes come from the database.

---

## 8. External Services and Integrations

Each lives behind one adapter (ARCHITECTURE 12) so it can be replaced.

| Service | Purpose | Direction | MVP | Notes |
|---|---|---|---|---|
| **Supabase Auth** | Email codes, developer password + MFA, sessions | Server → service | Yes | Sign-up closed (Section 2.1); email templates carry the 6-digit code, no links |
| **Brevo (SMTP)** | Sends the sign-in codes for Supabase Auth | Auth service → Brevo | Yes | SMTP settings entered in the Supabase project; secrets live there, not in our app |
| **Brevo (email API)** | Receipts to the payer, developer alerts | Server → Brevo over HTTPS | Yes | API key server-side only; minimal content (no UPI ID changes in the body, no personal data beyond the recipient's name) |
| **Web Push** | Visitor, delivery, bill and request alerts | Server → browser push services | Yes | Standard protocol with our server keys; payload limited to title and body per DESIGN 8.3 |
| **Sentry** | Error alerts | Browser/Server → Sentry | Yes | Scrubbed events; user ID and society ID only; no emails or phones |
| **Supabase Storage** | Files | Browser (signed links) and server | Yes | Private buckets only |
| **Supabase Database / Realtime** | Data | Server and browser (RLS) | Yes | |
| **UPI link and QR** | Resident pays the society directly | Built on the server from stored details | Yes | No network call, no payment service; the payee and amount shown are generated server-side |
| SMS / WhatsApp provider | Mobile OTP and critical alerts | — | **No** (post-MVP, PRD D-06) | |
| Payment gateway | Online payment | — | **No** (PRD D-14) | Would add a webhook route (Section 9) |

Data sent to each outside party is listed in Section 13.2.

---

## 9. Webhooks and Verification

**MVP has no incoming webhooks** (no payment gateway, no provider callbacks). Two incoming calls exist and are verified:

| Incoming call | Verification |
|---|---|
| Scheduler → `/api/jobs/daily` | Bearer secret compared in constant time; wrong or missing secret → 401, logged, no work done |
| Browser → `/api/client-errors`, `/api/push/subscriptions` | Same-origin, rate limited; push also requires a session |

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

| Operation | Limit | Key |
|---|---|---|
| `auth.requestCode` | 1 per 30 s; 5 per hour | Email + purpose |
| `auth.requestCode` | 20 per hour | IP |
| `auth.verifyCode` | 5 wrong tries per code (code then invalid); 10 per hour | Email; plus 30 per hour per IP |
| `auth.developerSignIn` / MFA | 5 failures per 15 min | Email + IP |
| `guards.identify` (PIN) | 5 failures then 15-minute lock | Roster guard |
| `visitor.preApproval.validate` | 10 failures per 10 min; 30 per 10 min | Guard session; society |
| `registration.lookupSociety` | 10 per hour; 30 per day | IP |
| `registration.submit` | 3 per day | Email |
| `billing.submitPayment` | 10 per hour | User |
| `/api/files/upload-url` | 30 per hour (guards 120) | User |
| `/api/client-errors` | 20 per minute | Session or IP |
| `/api/push/subscriptions` | 10 per hour | User |
| Exports and reports | 5 per hour | User |
| Other write operations (soft guard) | 120 per minute | User |

- **Fail-safe behavior:** if the counter store is unavailable, security-sensitive limits (sign-in codes, PIN, code validation, society code lookup) **fail closed** (the action is refused with a retry message); the rest **fail open** and the failure is logged.
- **Email quota guard:** the number of login emails per day is tracked; at 80% of the Brevo plan's daily allowance the developer is alerted (the free plan's daily limit makes mass onboarding on one day a real risk; onboard in batches).
- Reads are not individually limited by the app; platform protection (DDoS, bot rules) is provided by the host.

---

## 11. Required Environment Variables

Names only; values are kept in the host's secret store and never committed (ARCHITECTURE 16.2). **Public** variables begin with `NEXT_PUBLIC_` and are visible in the browser; everything else is **server-only**. A build check fails if a secret-looking name carries the public prefix.

| Variable | Scope | Purpose | Required in |
|---|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | Public | `local`, `preview`, `staging`, `production` | All |
| `NEXT_PUBLIC_APP_URL` | Public | Base URL (used to validate origins and build links) | All |
| `APP_VERSION` | Server (injected at build) | Version shown in the error log | All |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Public client key; safe because the database rules decide access | All |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server secret** | Privileged identity (only the isolated server module, ARCHITECTURE 8.4) | All except local-only tools |
| `SUPABASE_DB_URL` | **Server secret (CI/migrations/backup only, never runtime)** | Direct database connection | CI |
| `BREVO_API_KEY` | **Server secret** | Send receipts and alerts | Staging, production |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | Server | Verified sender | Staging, production |
| `DEVELOPER_ALERT_EMAIL` | Server | Where critical alerts go | Staging, production |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public | Browser push subscription key | All |
| `VAPID_PRIVATE_KEY` | **Server secret** | Signs push messages | All |
| `VAPID_SUBJECT` | Server | Contact address for push services | All |
| `NEXT_PUBLIC_SENTRY_DSN` | Public | Where browser errors go (a DSN is not a secret) | Staging, production |
| `SENTRY_DSN` | Server | Where server errors go | Staging, production |
| `SENTRY_AUTH_TOKEN` | **CI secret** | Uploads source maps | CI |
| `CRON_SECRET` | **Server secret** | Authenticates the scheduler on `/api/jobs/daily` | Staging, production |
| `GUARD_SESSION_SECRET` | **Server secret** | Signs the on-duty guard cookie | All |
| `RATE_LIMIT_HASH_SALT` | **Server secret** | Hashes rate-limit keys | All |

Notes:
- **Brevo SMTP credentials** for sign-in codes are entered in the Supabase project settings, not in this application's environment.
- Limits, retention periods and defaults are constants in code and per-society settings in the database, not environment variables **[APA-03]** (this supersedes the "Feature" row in ARCHITECTURE 16.2).
- Startup validates this list with a schema; a missing or malformed value fails fast with a clear message (names only, never values).
- Each environment (local, preview, staging, production) uses its own keys and its own Supabase project; production secrets are never used elsewhere.

---

## 12. Authorization Summary per Interface (quick reference)

| Interface | Who may call | Society scope | Extra |
|---|---|---|---|
| `auth.*` | Anyone (rate limited) | n/a | Generic answers; closed sign-up |
| `session.*`, `profile.*`, `notifications.*` | Signed in | Own data | |
| `registration.*` | Anyone with a valid society code; then a signed-in user without membership | One society | Rate limited |
| `society.*`, `structure.*`, `members.*`, `guards.*`, `audit.*` | A (write), C (read), D | Active society | Role changes and approvals audited |
| `visitor.*`, `delivery.*` | G/A (gate), R (own unit), A/C (read) | Active society | Guard identified; module on |
| `billing.*` | A (write), C (read), R (own unit) | Active society | Module on; money actions audited |
| `request.*` | R (own), A (manage), C (read), assignee | Active society | Module on |
| `developer.*` | D only | Any society | MFA; audited |
| `/api/jobs/daily` | Scheduler | All societies | Secret token |
| `/api/health` | Anyone | None | Status only |

---

## 13. Data Privacy in the API

### 13.1 Rules
| Rule | Detail |
|---|---|
| Minimum data | Operations return view-shaped data for the screen (DATABASE 11); no raw table rows; no fields the role does not need |
| Masking | Phones masked (`+91 98••• ••210`) in lists; full number only where an action needs it (guard "Call Resident", resident detail for admin). Applied in the server layer for every response |
| Other people's contact details | Residents never receive another resident's email or phone; comment authors appear by name only |
| Not found vs forbidden | A record you may not see looks the same as one that does not exist |
| Nothing personal in URLs | IDs only; emails, phones and payment references travel in the request body (APA-02); file names are generic |
| Logs | The scrubber removes codes, tokens, push keys, PINs, cookies, authorization headers, full phones, document content and UPI/payment references before any log or Sentry event (PRD LOG-5). Request bodies are never logged wholesale |
| CSV and PDF | Exports are audited, permission-checked, and CSV cells that begin with `=`, `+`, `-` or `@` are neutralised |
| Files | Private; short-lived links; never public URLs; never in notifications or emails |
| Notifications | Push and email text carries the minimum (e.g., "Visitor at gate: {name}"), never phone numbers, UPI details or amounts beyond what the recipient needs |
| Browser storage | No personal data or secrets in local storage; only the session cookies and UI preferences |
| Cookies | HTTP-only, secure, same-site |
| Transport and headers | HTTPS only; strict content security policy; same-origin only; no third-party scripts except the error reporter |
| Erasure | Handled by the anonymise function (DATABASE 11.2); no API for self-service deletion in MVP (PRD DAT-8) |

### 13.2 What each outside party receives
| Party | Receives | Does not receive |
|---|---|---|
| Brevo | Recipient email address, recipient first name, receipt number and amount (receipts only) | Phone numbers, UPI IDs, visitor data |
| Push services | Notification title and short body (end-to-end encrypted payload) | Unit details beyond the text, personal contact data |
| Sentry | Error message and stack (scrubbed), route, user ID, society ID, app version, browser type | Email, phone, names, request bodies, codes |
| Supabase | All application data (it is the database host) | — |
| Vercel (host) | Request logs (paths, status, timing) | Bodies; personal data is kept out of URLs |
| Scheduler | Nothing beyond the secret-authenticated call | — |

**[APA-04]** Choose the Supabase and Vercel regions closest to users (India if available) to support data-protection expectations; confirm availability when creating the projects.

---

## 14. Failure Handling and Fault Tolerance

### 14.1 Timeouts and retries
| Call | Timeout | Retry | If it still fails |
|---|---|---|---|
| Database query (user request) | 10 s statement limit | None automatically | Error panel with reference ID; guard sees "Can't reach server" banner (DESIGN 9.3) |
| Supabase Auth (send code) | 8 s | None (user can request again after the cooldown) | Generic message plus log; never reveals whether the email exists |
| Brevo email API | 5 s | 1 retry on timeout/5xx | Log; the in-app record is the source of truth; developer alerted on repeated failures |
| Web Push per subscription | 5 s | 1 retry on 429/5xx | Dropped; subscriptions answering "gone" are deleted |
| Storage signed link | 3 s | 1 | Upload/view error with retry on the file |
| Sentry | Non-blocking | None | Ignored; platform logs still record |
| Realtime | n/a | Automatic reconnect with backoff | Polling every 5 s with "Updated {time}" |
| Whole server operation | 10 s budget (the host allows far more, but screens must stay responsive) | None | `INTERNAL_ERROR` with reference ID |

Retries are used only where repeating is safe (idempotent or read-only).

### 14.2 Behavior by failure
| Failure | Behavior |
|---|---|
| Database unreachable | Operations return `INTERNAL_ERROR` with reference ID (logged to Sentry and platform logs because the log table may be unreachable too); gate screens show the "Can't reach server — call the resident" banner; entries typed by a guard stay on screen until sent |
| Sign-in email not arriving | Generic message + resend after cooldown; developer sees send failures in the log; dashboard check for bounces/quota |
| Email provider daily quota exhausted | Codes stop arriving; alert at 80% (Section 10); staggered onboarding or paid plan |
| Push not delivered | Ignored silently; inbox and guard polling remain reliable |
| Photo upload fails | Guard entry and payment submission can proceed without the optional file (prompted); request photos retry per file |
| Realtime down | Polling fallback |
| Scheduler missed a day | Next day's run catches up (idempotent tasks); developer health shows "last daily run" age and alerts after 36 hours |
| Duplicate submissions | `clientRequestId` and database uniqueness return the original/`CONFLICT` |
| Concurrent decisions | First wins; others get `already_decided` with the final status |
| Stale push opened | Screen shows the item's final status, not an error (DESIGN 8.3) |
| Partial batch failure (import, bill generation) | Job `partial`: completed rows kept, failed rows reported with reasons and a downloadable error file; safe to re-run |
| Unexpected exception | Caught at the boundary, scrubbed, logged with reference ID, Sentry event, user-safe message |
| Logging itself fails | Never raises a new error; failure goes to Sentry/platform logs only |
| Third-party unavailable for long | The feature degrades to its non-integrated path (in-app notification instead of email/push; guard calls resident) |

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
| ID | Assumption |
|---|---|
| APA-01 | List date filters are interpreted in the society's timezone |
| APA-02 | Emails, phone numbers and payment references used as search text are sent in request bodies, never in page URLs |
| APA-03 | Limits and retention numbers are code constants and society settings, not environment variables |
| APA-04 | Supabase and Vercel regions are chosen close to users (India if available) |
| APA-05 | A single outgoing email (receipt) per confirmed payment is acceptable for the free email plan's volume; bill reminders use in-app and push, not email |
| APA-06 | One Brevo sender address and domain serve all societies in MVP |

### 16.2 Decisions
| ID | Decision | Status |
|---|---|---|
| APD-1 | Self-registration uses a **society code** shared by the admin (rotatable, can be switched off); unknown people cannot list societies | **Approved 2026-11-09** |
| APD-2 | Offset paging with exact totals for all lists in MVP (matches DESIGN); cursor paging only if logs grow very large | Recommended, low risk |
| APD-3 | `clientRequestId` on user-created records to prevent double entries | Recommended, low risk |

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
