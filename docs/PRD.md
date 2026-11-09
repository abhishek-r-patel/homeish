# Homeish — Society Management SaaS: Product Requirements Document (PRD)

| Field    | Value                                                 |
| -------- | ----------------------------------------------------- |
| Product  | Homeish                                               |
| Version  | 0.1 (Draft for approval)                              |
| Date     | 2026-11-09                                            |
| Status   | Draft — pending owner approval of items in Section 17 |
| Audience | Product owner, coding agent (source of truth)         |

**Conventions used in this document**

- **[A-nn]** = Assumption (made so work can proceed; change if wrong).
- **[D-nn]** = Decision requiring your approval (see Section 17).
- **MVP** = must ship in first release. **P2** = after MVP. Anything not listed is out of scope.
- Requirement IDs (e.g., `VIS-3`) are stable and should be referenced in tasks/tests.

---

## 1. Problem, Value Proposition, Target Users

### 1.1 Problem

Residential societies/apartments run on a mix of paper registers, WhatsApp groups, spreadsheets and phone calls. This causes:

- Unverified visitors/deliveries entering premises; no audit trail.
- Residents unaware of who is at the gate.
- Manual, error-prone maintenance billing and poor dues collection.
- Staff (maids, drivers, cooks) attendance and entry untracked.
- Service complaints lost in chat threads; no accountability or SLA.
- Housekeeping consumables and AMC (annual maintenance contracts) tracked ad hoc, leading to lapses and expiries.
- Committee has no single view of operations.

### 1.2 Value Proposition

One multi-tenant SaaS app where every society stakeholder (resident, guard, committee, admin, housekeeping supervisor, vendor) does their daily society tasks in one place, with a **modular** design so each society only pays for/uses what it needs, and the product owner (developer/superadmin) can enable or disable modules per society.

### 1.3 Target Users

| User                       | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| Resident (Owner / Tenant)  | Lives in a unit; approves visitors, pays dues, raises requests         |
| Security Guard             | At gate; logs visitors/deliveries/staff entry                          |
| Society Admin / Manager    | Day-to-day operations, billing, vendors                                |
| Committee Member           | Oversight, approvals, reports                                          |
| Housekeeping Supervisor    | Manages inventory consumption/stock                                    |
| Domestic Staff / Visitor   | Not app users in MVP (identified via entries/passes only) — **[A-01]** |
| Platform Owner (Developer) | You; configures societies, modules, views logs                         |

### 1.4 Market Assumptions

- **[A-02]** Initial market: India (INR, +91 phone numbers, GST-relevant invoices, UPI payments).
- **[A-03]** Society size: 50–1,500 units; single society may have multiple towers/blocks.
- **[A-04]** Smartphone usage is universal among residents; guards use a shared or dedicated Android device/tablet.

---

## 2. Product Principles

1. **Modular**: every feature area is a module that can be enabled/disabled per society; disabled modules are invisible and inaccessible (UI and API).
2. **Multi-tenant by default**: every record belongs to one society; no cross-society data access.
3. **Simple first**: smallest workflow that solves the problem; no configurability that isn't required.
4. **Debuggable**: every failure is logged with context so the platform owner can trace it.
5. **Auditable**: sensitive actions (money, entry, role changes) leave an audit record.

---

## 3. Module Overview and Release Plan

Modules are built and released one at a time, in the order below. **Core Platform** is mandatory and cannot be disabled.

| #   | Module                                                                                                                    | Key               | Disableable | Release |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------- | ------- |
| 0   | Core Platform (auth, society, units, users, roles, notifications, audit/error logging, module registry, developer config) | `core`            | No          | MVP-0   |
| 1   | Visitor Management                                                                                                        | `visitor`         | Yes         | MVP-1   |
| 2   | Delivery Management                                                                                                       | `delivery`        | Yes         | MVP-2   |
| 3   | Maintenance, Fines & Payments                                                                                             | `billing`         | Yes         | MVP-3   |
| 4   | Service Requests / Complaints                                                                                             | `service_request` | Yes         | MVP-4   |
| 5   | Staff Management (domestic & society staff)                                                                               | `staff`           | Yes         | P2-1    |
| 6   | Housekeeping Inventory                                                                                                    | `housekeeping`    | Yes         | P2-2    |
| 7   | AMC Management                                                                                                            | `amc`             | Yes         | P2-3    |
| 8   | Notice Board / Announcements                                                                                              | `notice`          | Yes         | P2-4    |
| 9   | Amenity Booking                                                                                                           | `amenity`         | Yes         | P2-5    |

**[D-02] Module order and MVP boundary — Approved 2026-11-09.** MVP = Core + Visitor + Delivery + Billing + Service Request. Staff, Housekeeping, AMC are the first post-MVP wave.

**Module dependencies**

- `delivery` is independent of `visitor`; it shares only Core notification and unit data. **[A-05]** (Avoids coupling so modules toggle independently.)
- `staff`, `housekeeping`, `amc` are independent of each other. `amc` may link to `service_request` optionally if both enabled (P2).
- Enabling/disabling a module never deletes its data (see MOD-4).

---

## 4. Core Platform Module (`core`)

### 4.0 Public website, society hosts and beta (D-34)

**Approved 2026-11-09:** `homeish.vercel.app` is the public marketing website, not a login screen. `demo.homeish.vercel.app` is a public interactive synthetic demo, periodically reset. Future societies use their own configured subdomains of the same application, not separate branches. **Owner clarification:** Maplewood is a real society: its address is prepared but disabled (placeholder page only). Do not onboard it now; the owner will do that through a future create-society script once MVP is ready.

`beta.homeish.vercel.app` belongs to a separate Vercel project deploying the `beta` branch for testing and later new features. Verified changes are merged into `main` for the shared website/society deployment. Beta must never use real society data or the production database. **Database projects (2026-11-09, ARCHITECTURE AD-14):** `homeish-testdb` for development/testing/beta, `homeish-demo` for the synthetic demo, and `homeish-live` for all onboarded societies; the database-backed demo will move to its own Vercel project `demo-homeish` so the main deployment never holds demo credentials. This preserves D-24: live societies share a database with enforced society isolation; it does not copy Civic Pulse's per-society database model.

Current delivery is the marketing page, host allow-list, beta entry and a browser-only synthetic demo illustration (manual and 15-minute resets). Authentication, actual modules, isolated backend provisioning and database-backed demo resets remain prerequisites for a full working demo or any real society activation. Maplewood's reserved host shows a disabled "not open yet" page; all other society hosts fail closed as unconfigured. No society directory is published.

**Hosting approval, 2026-11-09:** Vercel reported the originally requested product address is assigned to another project, so the owner chose the name Homeish (D-01). `homeish.vercel.app` is attached to `homeish` and `beta-homeish.vercel.app` to `beta-homeish`, under team `arp-dev`. After a temporary pause, the owner approved resuming both scaffold projects and automatic deployment: merge a feature branch into `beta` to deploy `beta-homeish`, verify it, then merge `beta` into `main` to deploy `homeish`. The owner also approved committing/pushing and performing this initial release sequence. `vercel.json` enables only the two release branches; the project build gate isolates them. Preview branch tracking stays disabled and Production domain assignment is automatic. This does not activate authentication, backends, modules or real societies. The nested demo/beta example URLs above are not confirmed live addresses; current hosted beta testing uses `beta-homeish.vercel.app`.

### 4.1 Features and Functional Requirements

**Authentication & Accounts**

- `CORE-1` Users sign in with **email + one-time code (OTP) sent by email** in MVP. **[D-03 — Approved 2026-11-09]** The login system must be built so these can be added later **without changing user data**: mobile + OTP, email + password, mobile + password, and social login (e.g., Google). The email address is the user's unique identity; a mobile number is an optional profile field. **[A-34, A-35]**
- `CORE-2` Session persists on device until logout or expiry (**[A-06]** 30 days; guards: 12-hour shift sessions configurable later, not MVP).
- `CORE-3` A user can belong to multiple societies (e.g., owner in two) and switch between them. **[A-07]**
- `CORE-4` Developer/Superadmin sign in via separate login (email + password + TOTP MFA) at a separate URL. **[D-04 — Approved 2026-11-09]**

**Society & Structure**

- `CORE-5` Developer creates a society with: name, address, city, contact, timezone, currency (default INR), logo.
- `CORE-6` Society structure: Society → Blocks/Towers (optional) → Units (flat/house number, floor, type, area sq ft optional).
- `CORE-7` Admin can add/edit/deactivate blocks and units; bulk import units via CSV (MVP).

**Residents & Membership**

- `CORE-8` Unit has occupants with relationship type: Owner, Tenant, Family Member. One **primary contact** per unit.
- `CORE-9` Admin can invite a resident by email address to a unit; or resident self-registers using the **society code** shared by the admin (a rotatable code that can be switched off; it lets them pick their unit without exposing the list of societies) → admin approves. **[D-05 — Approved 2026-11-09; API APD-1]**
- `CORE-10` Admin can deactivate/move out a resident; their access is revoked immediately; historical records retained.
- `CORE-11` Bulk resident import via CSV (MVP).

**Roles & Permissions** — see Section 8.

**Notifications**

- `CORE-12` Channels in MVP: in-app notification inbox, phone push notification, and email (login codes, receipts, developer alerts). SMS/WhatsApp is post-MVP. **[D-06 — Approved 2026-11-09]** If a resident does not respond to a push alert, the guard sees "No response" and can call the resident (VIS-4).
- `CORE-13` In-app notification inbox per user with read/unread.
- `CORE-14` Users can't disable critical notifications (visitor at gate, payment due); no granular preference center in MVP.

**Society Settings (RWA Settings page, admin-editable)**

- `CORE-16` **Gate login mode** (admin chooses): (1) **Individual guard accounts** — each guard has their own email and signs in with it (default); or (2) **Shared gate account** — one shared email for all guards, where each guard identifies themselves when they start a shift or log an entry, so each entry still records who handled it. The admin also chooses _how_ guards identify themselves: **pick their name** from the guard list, or enter a **personal PIN** (stored only as a hash, attempts rate-limited). **[D-30 — Approved 2026-11-09; A-31]**
- `CORE-17` Other society profile values (name, address, contact, logo, timezone, and the society's custom label for "Unit") are editable by admin as listed in CORE-5. The custom label is 1–24 letters or spaces and defaults to "Unit". Module settings follow MOD-3 unless a module section says admin-editable (e.g., billing UPI details, BIL-15). Every change is audit-logged. **[DD-05 — Approved 2026-11-09]**
- `CORE-18` Users may choose the Homeish font style (Manrope for body text and Sora for headings) or their device's default font. The preference is saved to their account and follows them across devices. **[DD-02 — Approved 2026-11-09]**

**Module Registry & Developer Config** (developer-only)

- `MOD-1` Developer config pages list all modules per society with an on/off toggle.
- `MOD-2` Disabled module: nav items hidden, API endpoints return a "module disabled" response, background jobs for it skip that society, notifications for it stop.
- `MOD-3` Each module may have module-level settings (defined in each module section), editable by developer; selected settings may be exposed to society admins (flag per setting). **[A-08]** MVP: all module settings developer-only unless stated.
- `MOD-4` Disabling a module retains all its data; re-enabling restores access to it.
- `MOD-5` Every toggle/config change is audit-logged (who, when, old → new).
- `MOD-6` Society-level feature flags are stored as data, not code branches per society.

**Platform Subscription (SaaS)**

- `SAAS-1` Each society has a status: Trial, Active, Suspended, Archived. Suspended societies get read-only access. **[D-07 — Approved 2026-11-09]**
- `SAAS-2` Developer manually sets plan/status in MVP. **No** in-app subscription billing/payment from societies in MVP; invoices are handled outside Homeish. The first ten live societies receive Homeish without a subscription charge; hosting costs are separate. The subscription price and offer terms after the first ten will be decided before society eleven is invited. **[D-08, D-33 — Approved 2026-11-09]**
- `SAAS-3` Tenant isolation enforced at data layer for every query.

**Logging, Error Tracking & Observability** (developer-facing)

- `LOG-1` **Error log**: every unhandled/handled server error and client error is captured with: timestamp, society ID, user ID, role, module, route/action, request ID, error message, stack trace, app version, device/browser info, severity.
- `LOG-2` Every user-facing error displays a short **reference ID** that maps to the log entry so the user can report it and the developer can find it.
- `LOG-3` **Developer Log Viewer** page: filter by society, module, severity, date range, user, reference ID; view detail; mark as Resolved/Ignored; search text.
- `LOG-4` **Audit log** (separate from error log): who did what, when, on what entity, before/after values for sensitive actions (role changes, module toggles, payments, fines, resident approvals, visitor override, bill generation, data exports).
- `LOG-5` Logs never store secrets, OTPs, full payment credentials, or full personal data beyond what's required (mask phone, no document images in logs).
- `LOG-6` Log retention: **[A-09]** error logs 90 days, audit logs 2 years (configurable by developer).
- `LOG-7` Critical-severity errors trigger an alert to developer by email. **[D-09 — Approved 2026-11-09]** Use Sentry plus an app-level log table for tenant-specific audit; do not build an alerting engine.
- `LOG-8` Request ID propagated across client → server → third-party calls for tracing.

**Data Export**

- `CORE-15` Admin can export lists (residents, payments, visitors) to CSV, subject to role permission; exports are audit-logged.

### 4.2 User Stories (Core)

- As a **developer**, I create a society, define blocks/units, and enable only `visitor` and `billing` for it.
- As a **developer**, I search an error by reference ID a resident gave me and see the stack trace and context.
- As an **admin**, I import 300 units and invite residents by email.
- As a **resident**, I sign in with OTP and see only modules my society has enabled.
- As a **resident**, I switch between two societies I belong to.

---

## 5. Module Requirements

### 5.1 Visitor Management (`visitor`)

**Purpose**: Control and record who enters the society and obtain resident consent.

**Journeys**

1. _Walk-in visitor_: Guard logs visitor (name, phone, purpose, unit, optional photo, vehicle no.) → resident gets push notification → approves/denies → guard allows/denies → guard marks check-out.
2. _Pre-approved visitor_: Resident creates an invite (name, date/time window, optional vehicle) → system generates a 6-digit code/QR → guard validates at gate → auto-checked-in, resident notified.
3. _Frequent visitors_ (guest, relative): Resident saves as "frequent" for faster pre-approval. **[A-10]** P2 — not MVP.

**Functional Requirements**

- `VIS-1` Guard can create a visitor entry: name, mobile, purpose (list: Guest, Cab, Service, Official, Other), unit, vehicle number (optional), number of people, photo (optional).
- `VIS-2` System notifies all active occupants flagged "approver" for that unit. First response wins. **[A-11]**
- `VIS-3` Resident can Approve or Deny; Deny requires no reason.
- `VIS-4` If no response within X minutes (default 3, developer-configurable), the guard sees "No response" and can call the resident (phone dial link). If the society setting allows it, the guard may then mark "Allowed by guard — no response" with a required reason and audit entry. **[D-10 — Approved 2026-11-09]**
- `VIS-5` Resident can pre-approve a visitor with a valid window (from/to). System generates a one-time 6-digit code and a QR encoding that same code. A guard may scan the QR or enter the code manually. **[D-11 — Approved 2026-11-09]**
- `VIS-6` Guard can enter a code to validate and check in a pre-approved visitor; invalid/expired code shows clear error.
- `VIS-7` Guard marks visitor check-out; entry status lifecycle: `Pending → Approved/Denied/Expired → Checked-in → Checked-out`.
- `VIS-8` Resident sees visitor history (own unit). Guard sees today's log for the society. Admin sees all with filters (date, unit, status).
- `VIS-9` Overstay highlight: visitors checked in longer than N hours (default 12) shown as "Still inside" on the admin dashboard.
- `VIS-10` Blacklist: Admin can add a phone number to society blacklist; guard sees a warning when matched (MVP: warn only). **[A-12]**

**Module settings**: approval timeout, overstay hours, photo required (yes/no), guard-override allowed (yes/no).

**User Stories**

- As a guard, I log a visitor in under 30 seconds.
- As a resident, I approve a visitor from the notification without opening the full app.
- As a resident, I pre-approve my guest and share a code.
- As an admin, I view who entered on a specific date.

**Acceptance (sample)**

- Given a visitor entry for Unit A-101, when the resident approves, the guard device shows "Approved" within 5 seconds (p95) of approval.
- Given an expired pre-approval code, when the guard enters it, the system rejects it and logs the attempt.

---

### 5.2 Delivery Management (`delivery`)

**Purpose**: Track parcels/food deliveries and reduce gate friction.

**Functional Requirements**

- `DEL-1` Guard logs a delivery: company/platform (list + other), delivery person name (optional), unit, type (Food, Parcel, Grocery, Other), optional photo.
- `DEL-2` Resident notified; options: **Allow at gate/Send inside**, **Leave at gate/security desk**, **Deny/Return**.
- `DEL-3` Resident can set a standing preference per unit: "Always allow", "Always leave at gate", "Ask me" (default). **[A-13]**
- `DEL-4` Resident can pre-announce an expected delivery (platform, window) so the guard sees it as expected. **[A-14]** P2.
- `DEL-5` For parcels left at the security desk: status `Received → Collected` and resident marks/guard marks collection, with timestamp. Uncollected parcels older than N days are listed for the guard/admin (default 3).
- `DEL-6` Delivery history per unit; society-wide log for guard/admin.
- `DEL-7` Delivery statuses: `Pending response → Allowed / Left at gate / Denied → Collected / Closed`.

**Module settings**: response timeout, uncollected-parcel threshold days, enable "leave at gate" option.

**User Stories**

- As a resident, I tell the guard to keep my parcel at the gate while I'm away.
- As a guard, I see which parcels are still uncollected.

---

### 5.3 Maintenance, Fines & Payments (`billing`)

**Purpose**: Generate dues, collect payments, track overdue, and give residents/committee transparency.

**Concepts**

- **Charge Type**: e.g., Monthly Maintenance, Sinking Fund, Parking, Water, One-time charge.
- **Bill/Invoice**: a due for a unit for a period, containing one or more charge lines.
- **Fine**: a penalty added to a unit's ledger (manual by admin, or auto late fee).
- **Payment**: paid directly to the society's UPI account and submitted by the resident for admin confirmation, or recorded by the admin (cash/cheque/bank transfer/UPI).
- **Unit Ledger**: running statement of debits (bills/fines) and credits (payments).

**Functional Requirements**

- `BIL-1` Admin defines charge types with a calculation method: **Fixed per unit**, **Per sq ft**, or **Custom per unit** (manual amount). **[D-12 — Approved 2026-11-09]** Other methods (consumption-based water, tiered) are out of MVP.
- `BIL-2` Admin generates bills for a period (monthly default) for all/selected units; preview before confirming; generation is idempotent (no duplicates for same unit + period + charge type).
- `BIL-3` Late fee: society-level rule — fixed amount or percentage, applies after due date + grace days; computed by a scheduled job. Late fees do not compound. **[D-13 — Approved 2026-11-09]**
- `BIL-4` Admin can add a manual fine to a unit (amount, reason, date) and waive/cancel a bill or fine with mandatory reason (audit-logged). Committee approval is optional by society setting and off by default. **[D-26 — Approved 2026-11-09]**
- `BIL-5` Resident sees: current dues, past bills, payment history, ledger, and downloads receipts/invoices as PDF.
- `BIL-6` **UPI payment with admin confirmation** (MVP). **[D-14, D-32 — Approved 2026-11-09: no payment gateway in MVP]** Resident taps Pay Now; the app shows the society's UPI ID, payee name, QR code and exact amount, with a "Pay with UPI app" button on phones (**[A-32]** UPI app deep links vary by phone; the QR and copy-UPI-ID options are always shown). After paying, the resident submits the **UPI reference number (UTR)** and an optional screenshot (JPG/PNG, up to 5 MB). The payment shows as **Awaiting confirmation**. The admin checks the bank/UPI statement in a **review queue** and either **Confirms** (ledger credit and receipt) or **Rejects** (reason required; resident is notified and can resubmit). The app never moves money and never marks a payment Confirmed without an authorised admin action.
- `BIL-7` **Direct payment recording** by admin: amount, mode (Cash/Cheque/Bank Transfer/UPI), reference no., date; entries recorded by the admin are Confirmed immediately and a receipt is generated.
- `BIL-8` Partial payments allowed; payments apply to oldest due first. **[A-15]**
- `BIL-9` Advance payments / credit balance retained on the unit ledger. **[A-16]**
- `BIL-10` Reminders: automated notification at X days before due, on due date, and every Y days overdue (developer-configurable defaults: 3 / 0 / 7).
- `BIL-11` Admin/Committee dashboard: total billed, collected, outstanding, top defaulters, collection % for selected period.
- `BIL-12` Reports (CSV export): dues by unit, collections by date range, defaulter list.
- `BIL-13` Bills are immutable once published; corrections via credit note/adjustment entry, never editing history. **[A-17]**
- `BIL-14` Funds flow: **[D-15 — Approved 2026-11-09]** money goes directly from the resident to the society's own UPI account. The platform never holds, receives or settles funds. **[D-16]** Gateway fees do not apply in MVP.
- `BIL-15` **Society UPI details** (UPI ID, payee name, optional QR image) are set by the RWA admin in the billing settings. **[D-31 — Approved 2026-11-09]** Every change is audit-logged (old and new value), all admins and committee members are notified, and residents see "UPI details last changed on {date}" on the payment screen. The UPI ID format is validated on save.
- `BIL-16` The same UTR cannot be submitted twice within a society. A rejected submission can be resubmitted with a corrected reference.
- `BIL-17` Submissions awaiting confirmation longer than N days (default 3, developer-configurable) are highlighted for the admin. Residents see the status of each submission (Awaiting confirmation / Confirmed / Rejected with reason).

**Out of MVP**: expense/accounting books, vendor payments, tax return filing, GST invoices beyond a simple tax field, budget management.

**Module settings**: due day of month, grace days, late fee rule, reminder schedule, pending-confirmation alert days, and **society UPI details (admin-editable and audited, BIL-15)**.

**User Stories**

- As a resident, I pay this month's maintenance via UPI, submit the reference number, and get a receipt once the admin confirms.
- As an admin, I confirm or reject submitted UPI payments from a review queue.
- As an admin, I generate bills for 300 units for the month and send reminders.
- As a committee member, I see collection percentage and defaulters.
- As an admin, I record a cheque payment collected at the office.

---

### 5.4 Service Requests / Complaints (`service_request`)

**Purpose**: Resident raises issues; staff/vendors resolve; admin tracks SLA.

**Functional Requirements**

- `SRQ-1` Resident creates a request: category (Plumbing, Electrical, Lift, Cleaning, Security, Parking, Noise, Other — admin-managed list), location type (**My unit** / **Common area**), description, up to 3 photos, priority (Normal/Urgent).
- `SRQ-2` Admin assigns to an internal staff member or external vendor (a name + phone; vendors are not app users in MVP **[A-18]**).
- `SRQ-3` Status lifecycle: `Open → Assigned → In Progress → Resolved → Closed` (+ `Rejected`/`Reopened`). Resident confirms closure or reopens within X days (default 3); otherwise auto-closes.
- `SRQ-4` Comment thread on each request. The requester, admin and assignee (if a user) may post; other residents may read common-area request threads but cannot comment. **[D-17]**
- `SRQ-5` Resident rates resolution (1–5) after closure with optional comment.
- `SRQ-6` Target resolution time per category (set by admin); overdue requests flagged on admin dashboard.
- `SRQ-7` Filters: status, category, unit, date, assignee. Residents see their own requests and may read all common-area requests; they cannot change or comment on common-area requests in MVP. Upvoting is deferred to P2. **[D-17 — Approved 2026-11-09]**
- `SRQ-8` Notifications on every status change and new comment.
- `SRQ-9` Report: counts by category/status, average resolution time, average rating.

**Module settings**: category list, SLA hours per category, auto-close days.

**User Stories**

- As a resident, I report a leaking tap with a photo and track it.
- As an admin, I assign a plumber and see which requests are overdue.

---

### 5.5 Staff Management (`staff`) — P2-1

**Purpose**: Register domestic help and society staff, track entry and attendance.

**Functional Requirements**

- `STF-1` Two staff types: **Domestic staff** (maid, cook, driver, nanny — linked to one or more units) and **Society staff** (guard, housekeeping, electrician, gardener — employed by society).
- `STF-2` Staff profile: name, phone, photo, optional ID proof type + last 4 digits, role, linked units, status (Active/Blocked), police verification status (flag only). Do not upload or store a full ID document in MVP. **[D-18 — Approved 2026-11-09]**
- `STF-3` Resident adds domestic staff to their unit; admin approves/registers (setting-based). **[A-19]**
- `STF-4` Guard marks staff **entry/exit** by selecting from the registered list or entering a staff code; creates an attendance record automatically.
- `STF-5` Resident views attendance of their staff (days present, times in/out) monthly.
- `STF-6` Resident can notify "do not allow today" for a staff member (one-day block). **[A-20]** P2 within module.
- `STF-7` Admin can block a staff member society-wide; guard sees blocked warning.
- `STF-8` Society staff: simple shift attendance (present/absent/leave) marked by admin; payroll is out of scope. **[D-19 — Approved 2026-11-09]**

**User Stories**

- As a resident, I register my maid and see her monthly attendance.
- As a guard, I check in a registered maid by selecting her name.

---

### 5.6 Housekeeping Inventory (`housekeeping`) — P2-2

**Purpose**: Track cleaning/consumable stock and usage.

**Functional Requirements**

- `HKP-1` Admin/Supervisor defines inventory items: name, unit of measure, category (Cleaning, Tools, Consumables, Other), minimum stock level (reorder threshold).
- `HKP-2` Record **Stock In** (purchase/receipt: quantity, date, vendor name, cost optional) and **Stock Out** (issue/use: quantity, date, issued to/purpose).
- `HKP-3` Current stock auto-calculated from transactions; no negative stock (blocked with message).
- `HKP-4` Low-stock alert to admin/supervisor when stock ≤ minimum.
- `HKP-5` Transaction history per item; correction via adjustment entry with reason (no edits).
- `HKP-6` Basic report: current stock, usage over a date range, low-stock list (CSV export).
- `HKP-7` Housekeeping covers inventory stock only. Task checklists, cleaning schedules and QR-scanned area cleaning logs are **out of scope**. **[D-20 — Approved 2026-11-09]**

**User Stories**

- As a supervisor, I record 10 phenyl bottles issued today and see what is low.

---

### 5.7 AMC Management (`amc`) — P2-3

**Purpose**: Track annual maintenance contracts and prevent lapses.

**Functional Requirements**

- `AMC-1` Admin creates an AMC record: asset/service (Lift, DG, Fire system, CCTV, Pump, etc.), vendor name, contact, contract start/end, cost, payment terms (text), visit frequency (text/number per year), attached document (PDF/image).
- `AMC-2` Status computed: Active, Expiring Soon (≤ N days, default 30), Expired.
- `AMC-3` Renewal reminders to admin/committee at 60/30/7 days before expiry (default; developer-configurable).
- `AMC-4` Service visit log per AMC: date, summary, technician name, attached report (optional).
- `AMC-5` List & filter by status, vendor, asset; CSV export.
- `AMC-6` Optional link: a service request can reference an AMC asset (only when both modules are enabled). **[A-21]** P2.
- `AMC-7` Vendor payments/accounting against AMC are out of scope.

**User Stories**

- As an admin, I get a reminder 30 days before the lift AMC expires.

---

### 5.8 Notice Board (`notice`) — P2-4

**[D-21 — Approved 2026-11-09]** Include the Notice Board as the first post-MVP module because it is simple and high-use.

- `NTC-1` Admin/Committee posts a notice: title, body, optional attachment, audience (All / Block / Owners only), optional expiry.
- `NTC-2` Push notification on publish; residents view list, pinned notices first.
- `NTC-3` Read receipts count visible to the author (aggregate only).

### 5.9 Amenity Booking (`amenity`) — P2-5

**[D-22 — Approved 2026-11-09]** Keep Amenity Booking as an optional post-MVP module; societies can leave it switched off.

- `AMN-1` Admin defines amenities (Clubhouse, Hall, Court), slots, capacity, fee (optional, links to billing if enabled), rules text.
- `AMN-2` Resident books a free slot; admin can cancel; no double-booking.
- `AMN-3` Booking list for admin; cancellation by resident until X hours before.

> Further ideas (polls, community forum, parking management, emergency SOS, vehicle registry, document vault, marketplace) are **not** included. They should be added only upon your explicit request.

---

## 6. Core User Journeys (End-to-End)

1. **Society Onboarding (Developer → Admin)**: Developer creates society → enables modules → creates first Admin by email → Admin signs in, sets up blocks/units (CSV) → adds guards → invites residents.
2. **Resident Onboarding**: Receives email invite → email code login → confirms profile and unit → sees home with enabled modules.
3. **Visitor at the gate**: Guard logs visitor → resident notified → approve → entry → check-out.
4. **Monthly billing cycle**: Admin generates bills → residents notified → pay via UPI (admin confirms) or offline → receipts → reminders → late fee → dashboard review.
5. **Raise & resolve a request**: Resident raises → admin assigns → status updates → resident confirms → rating.
6. **Debugging an issue**: Resident sees error with reference ID → shares with developer → developer finds it in Log Viewer → resolves/marks.
7. **Module toggle**: Developer disables `delivery` for Society X → guards/residents no longer see it → data retained → re-enabled later with history intact.

---

## 7. Non-Functional Requirements

| ID     | Category           | Requirement                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1  | Platform           | **[D-23 — Approved 2026-11-09]** One responsive installable web app (PWA) for guard, resident, admin and developer; native apps later if needed. Push notifications on iPhone work only after the app is added to the home screen.                                                                                |
| NFR-2  | Performance        | p95 page/API response < 500 ms for typical reads, < 1 s for writes (excluding third-party); bill generation for 1,500 units completes < 2 min (can run as background job).                                                                                                                                        |
| NFR-3  | Availability       | Target 99.5% monthly (MVP). Gate flows (visitor/delivery) are the most critical.                                                                                                                                                                                                                                  |
| NFR-4  | Scalability        | Support 100 societies / 100,000 users in the first year with no re-architecture. **[A-22]**                                                                                                                                                                                                                       |
| NFR-5  | Multi-tenancy      | Single shared database, `society_id` on every tenant record, enforced server-side on every query. **[D-24]** **[D-24 — Approved 2026-11-09 with the technology choice]** shared database, kept separate per society by database rules.                                                                            |
| NFR-6  | Security           | OWASP Top 10 compliance; HTTPS only; role checks server-side; rate-limited OTP and login; encrypted secrets (payment keys); input validation; secure file uploads (type/size limit, scanned/validated).                                                                                                           |
| NFR-7  | Privacy            | Collect minimum personal data; comply with India DPDP Act principles **[A-23]**: consent at sign-up, data export/deletion on request (admin-triggered via developer), privacy policy + terms.                                                                                                                     |
| NFR-8  | Payments           | No card or bank credentials stored. The society UPI ID and payee name are the only payment identifiers stored and are treated as sensitive (change-audited, committee notified). Payments are confirmed only by an authorised admin; duplicate UTRs are blocked; amounts shown are always computed on the server. |
| NFR-9  | Data integrity     | Financial and entry records are append-only/immutable; soft-delete elsewhere; timestamps stored in UTC and displayed in society timezone.                                                                                                                                                                         |
| NFR-10 | Backup/Recovery    | Daily automated backups, 30-day retention; RPO ≤ 24h, RTO ≤ 4h (MVP).                                                                                                                                                                                                                                             |
| NFR-11 | Observability      | See `LOG-*`. Health check endpoint; uptime monitor.                                                                                                                                                                                                                                                               |
| NFR-12 | Accessibility & UX | Large tap targets for guard UI; WCAG AA contrast; readable on low-end Android; works on 3G-class networks (lightweight pages).                                                                                                                                                                                    |
| NFR-13 | Localization       | MVP English only; text externalized to allow Hindi/regional later. **[A-24]**                                                                                                                                                                                                                                     |
| NFR-14 | Compatibility      | Latest 2 versions of Chrome/Safari/Edge; Android 9+; iOS 15+.                                                                                                                                                                                                                                                     |
| NFR-15 | Offline            | Not supported in MVP; clear "no connection" state shown. **[D-25 — Approved 2026-11-09]**                                                                                                                                                                                                                         |
| NFR-16 | Testing            | Automated tests for permission checks, billing calculations, tenant isolation, module toggle enforcement; manual UAT per module before release.                                                                                                                                                                   |
| NFR-17 | Maintainability    | Each module is isolated (own routes, data tables, permissions, settings) with a single registration point in the module registry.                                                                                                                                                                                 |
| NFR-18 | Cost control       | Prefer managed services; avoid custom infrastructure not required for MVP.                                                                                                                                                                                                                                        |

---

## 8. Roles and Permissions

### 8.1 Roles

| Role                            | Scope         | Notes                                                                                                  |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `developer` (Superadmin)        | Platform-wide | Not tied to any society; separate login; **only** role with module toggles, society config, log viewer |
| `admin` (Society Admin/Manager) | Society       | Full operational control inside society                                                                |
| `committee`                     | Society       | Read-mostly oversight + approvals/notices; no operational data entry unless also admin **[A-25]**      |
| `guard`                         | Society       | Gate operations only                                                                                   |
| `housekeeping_supervisor`       | Society       | Housekeeping inventory only (P2)                                                                       |
| `resident_owner`                | Unit          | Owner of a unit                                                                                        |
| `resident_tenant`               | Unit          | Tenant of a unit                                                                                       |
| `resident_family`               | Unit          | Family member; limited by primary contact (no payments by default **[A-26]**)                          |

A user can hold multiple roles within a society (e.g., committee + resident). Permissions are the union.

### 8.2 Permission Matrix

Legend: **C**reate, **R**ead, **U**pdate, **D**elete/cancel, **A**pprove, `own` = own unit/records only, `–` = no access.

| Capability                                                         | developer    | admin           | committee                                                                        | guard          | HK supervisor | owner          | tenant         | family              |
| ------------------------------------------------------------------ | ------------ | --------------- | -------------------------------------------------------------------------------- | -------------- | ------------- | -------------- | -------------- | ------------------- |
| Create/configure society, toggle modules                           | CRUD         | –               | –                                                                                | –              | –             | –              | –              | –                   |
| View error logs                                                    | R/U(resolve) | –               | –                                                                                | –              | –             | –              | –              | –                   |
| View audit logs                                                    | R            | R (own society) | R                                                                                | –              | –             | –              | –              | –                   |
| Manage blocks/units                                                | R            | CRUD            | R                                                                                | R              | –             | –              | –              | –                   |
| Manage residents / roles                                           | R            | CRUD            | R                                                                                | –              | –             | R own unit     | R own unit     | –                   |
| Approve self-registrations                                         | –            | A               | A (if enabled)                                                                   | –              | –             | –              | –              | –                   |
| **Visitor**: log entry                                             | –            | C               | –                                                                                | C/U            | –             | –              | –              | –                   |
| Visitor: approve/deny own                                          | –            | –               | –                                                                                | –              | –             | A own          | A own          | A own (if approver) |
| Visitor: pre-approve                                               | –            | –               | –                                                                                | –              | –             | C own          | C own          | C own               |
| Visitor: view history                                              | –            | R all           | R all                                                                            | R today/all    | –             | R own          | R own          | R own               |
| Visitor: blacklist                                                 | –            | CRUD            | R                                                                                | R              | –             | –              | –              | –                   |
| **Delivery**: log                                                  | –            | C               | –                                                                                | C/U            | –             | –              | –              | –                   |
| Delivery: respond                                                  | –            | –               | –                                                                                | –              | –             | A own          | A own          | A own               |
| Delivery: view                                                     | –            | R all           | R all                                                                            | R all          | –             | R own          | R own          | R own               |
| **Billing**: define charges/generate bills                         | –            | CRUD            | R                                                                                | –              | –             | –              | –              | –                   |
| Billing: confirm/reject UPI payments, record payments, waive, fine | –            | CRUD            | R; may approve waivers only when the society setting is enabled (off by default) | –              | –             | –              | –              | –                   |
| Billing: view own dues, submit UPI payment details                 | –            | –               | –                                                                                | –              | –             | R/submit own   | R/submit own   | R own               |
| Billing: change society UPI details (audited, committee notified)  | –            | U               | R                                                                                | –              | –             | R (view only)  | R (view only)  | R (view only)       |
| Billing: dashboards/reports                                        | –            | R               | R                                                                                | –              | –             | –              | –              | –                   |
| **Service request**: create                                        | –            | C               | –                                                                                | –              | –             | C own          | C own          | C own               |
| SR: assign/update status                                           | –            | CRUD            | R                                                                                | –              | –             | –              | –              | –                   |
| SR: view                                                           | –            | R all           | R all                                                                            | –              | –             | R own + common | R own + common | R own + common      |
| SR: rate/reopen                                                    | –            | –               | –                                                                                | –              | –             | U own          | U own          | U own               |
| **Staff**: register/manage                                         | –            | CRUD            | R                                                                                | R (entry only) | –             | C/R own staff  | C/R own staff  | R own staff         |
| Staff: mark entry/exit                                             | –            | U               | –                                                                                | U              | –             | –              | –              | –                   |
| **Housekeeping**: items & stock                                    | –            | CRUD            | R                                                                                | –              | CRUD          | –              | –              | –                   |
| **AMC**: manage                                                    | –            | CRUD            | R                                                                                | –              | –             | –              | –              | –                   |
| **Notice**: post                                                   | –            | CRUD            | CRUD                                                                             | –              | –             | R              | R              | R                   |
| **Amenity**: book                                                  | –            | CRUD            | R                                                                                | –              | –             | C/D own        | C/D own        | C/D own             |
| Export data (CSV)                                                  | –            | Yes             | Yes (reports they can view)                                                      | –              | –             | –              | –              | –                   |

**Rules**

- `PERM-1` All permission checks are server-side; UI hiding is convenience only.
- `PERM-2` Disabled module ⇒ all its permissions are void for that society.
- `PERM-3` Tenant sees only data created during their tenancy. **[A-27]**
- `PERM-4` Admin cannot see developer-only config or logs, nor modify their own society's module state.
- `PERM-5` Role changes are audit-logged.
- `PERM-6` Developers cannot impersonate or view the app as a society user. Support uses logs and reference IDs. **[D-27 — Approved 2026-11-09]**

---

## 9. Pages / Screens

### 9.1 Public / Auth

| ID   | Screen                                  | Notes                                      |
| ---- | --------------------------------------- | ------------------------------------------ |
| S-01 | Login (email)                           | Email input, rate-limited                  |
| S-02 | Email code verification                 | Resend timer, attempts limit               |
| S-03 | Society picker                          | Only if user belongs to multiple societies |
| S-04 | Self-registration (select society/unit) | Pending-approval state screen              |
| S-05 | Developer login                         | Separate route, email + password + MFA     |

### 9.2 Shared

| ID   | Screen                                                                        |
| ---- | ----------------------------------------------------------------------------- |
| S-10 | Home / Dashboard (role-specific; shows only enabled modules)                  |
| S-11 | Notification inbox                                                            |
| S-12 | Profile & my unit/household                                                   |
| S-13 | Error screen with reference ID; module-disabled screen; no-access screen; 404 |

### 9.3 Developer Console (developer only)

| ID   | Screen                                                                    |
| ---- | ------------------------------------------------------------------------- |
| D-01 | Societies list (status, plan, module count)                               |
| D-02 | Society detail & edit                                                     |
| D-03 | **Society Config → Modules** (toggle per module, module settings)         |
| D-04 | Society users & roles (create first admin)                                |
| D-05 | **Error Log Viewer** + detail                                             |
| D-06 | Audit log viewer                                                          |
| D-07 | Platform health summary (error counts by society/module, recent critical) |

### 9.4 Admin / Committee

| ID   | Screen                                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Admin dashboard (today's visitors, open requests, collection summary — only enabled modules)                                        |
| A-02 | Blocks & units management (+ CSV import)                                                                                            |
| A-03 | Residents list, invite, approvals                                                                                                   |
| A-04 | Guards & staff accounts                                                                                                             |
| A-05 | Visitor log (filters), blacklist                                                                                                    |
| A-06 | Delivery log, uncollected parcels                                                                                                   |
| A-07 | Billing: charge types, bill generation + preview, bills list, ledger per unit, record payment, fines, late fee config view, reports |
| A-08 | Service requests list/detail/assign, categories                                                                                     |
| A-09 | Staff registry & attendance (P2)                                                                                                    |
| A-10 | Housekeeping items, stock in/out, low stock (P2)                                                                                    |
| A-11 | AMC list/detail/visit log (P2)                                                                                                      |
| A-12 | Notices (P2), Amenity (P2)                                                                                                          |

### 9.5 Guard

| ID   | Screen                                                                         |
| ---- | ------------------------------------------------------------------------------ |
| G-01 | Gate home (big actions: New Visitor, New Delivery, Validate Code, Staff Entry) |
| G-02 | New visitor form → waiting/response screen                                     |
| G-03 | Validate pre-approved code                                                     |
| G-04 | Inside now / today's list with check-out action                                |
| G-05 | New delivery form + uncollected parcels                                        |
| G-06 | Staff entry/exit (P2)                                                          |

### 9.6 Resident

| ID   | Screen                                                          |
| ---- | --------------------------------------------------------------- |
| R-01 | Home (quick actions for enabled modules)                        |
| R-02 | Visitor approval (from notification), pre-approve form, history |
| R-03 | Delivery response, preference setting, history                  |
| R-04 | Dues, bill detail, pay, receipts, ledger                        |
| R-05 | New service request, my requests, detail/thread, rating         |
| R-06 | My staff, attendance (P2)                                       |
| R-07 | Notices, Amenity booking (P2)                                   |
| R-08 | Household members management (owner/primary only)               |

---

## 10. Data Requirements

### 10.1 Entities (conceptual — no schema design here)

| Entity                                | Key fields                                                                                                                                                                                                 | Module           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Society                               | id, name, custom unit label, address, city, timezone, currency, status, plan, created_at                                                                                                                   | core             |
| ModuleConfig                          | society_id, module_key, enabled, settings(JSON), updated_by, updated_at                                                                                                                                    | core             |
| Block                                 | society_id, name                                                                                                                                                                                           | core             |
| Unit                                  | society_id, block_id, number, floor, type, area, status                                                                                                                                                    | core             |
| User                                  | id, name, email (unique, used to sign in), mobile (optional), photo, font preference, status                                                                                                               | core             |
| Membership                            | user_id, society_id, unit_id (nullable), roles, relationship, is_primary, is_approver, status, joined/left dates                                                                                           | core             |
| Notification                          | user_id, society_id, type, title, body, entity_ref, read_at                                                                                                                                                | core             |
| AuditLog                              | society_id, actor_id, action, entity, entity_id, before/after, timestamp, request_id                                                                                                                       | core             |
| ErrorLog                              | id/reference_id, society_id, user_id, role, module, route, message, stack, severity, app_version, device, status(open/resolved/ignored), request_id, timestamp                                             | core             |
| VisitorEntry                          | society_id, unit_id, name, mobile, purpose, vehicle, count, photo, status, approved_by, in/out times, source (walk-in/pre-approved), guard_id                                                              | visitor          |
| PreApproval                           | society_id, unit_id, created_by, visitor name, window, code, status, used_at                                                                                                                               | visitor          |
| BlacklistEntry                        | society_id, mobile, reason, added_by                                                                                                                                                                       | visitor          |
| Delivery                              | society_id, unit_id, company, type, photo, status, decision, decided_by, received/collected times                                                                                                          | delivery         |
| DeliveryPreference                    | unit_id, rule                                                                                                                                                                                              | delivery         |
| ChargeType                            | society_id, name, method, amount, active                                                                                                                                                                   | billing          |
| Bill / BillLine                       | society_id, unit_id, period, due_date, lines, total, status                                                                                                                                                | billing          |
| LedgerEntry                           | unit_id, type(debit/credit), amount, ref, reason, created_at                                                                                                                                               | billing          |
| Payment                               | society_id, unit_id, amount, mode, utr_reference (unique per society), proof_file (optional), status (awaiting confirmation / confirmed / rejected), reject_reason, submitted_by, confirmed_by, receipt_no | billing          |
| PaymentDetails                        | society_id, upi_id, payee_name, qr_image (optional), updated_by, updated_at (history via AuditLog)                                                                                                         | billing          |
| FineRule / LateFeeRule                | society_id, rule config                                                                                                                                                                                    | billing          |
| ServiceRequest                        | society_id, unit_id (nullable), category, location type, description, priority, status, assignee (user or vendor name/phone), SLA due, rating                                                              | service_request  |
| RequestComment, RequestAttachment     | request_id, author, text/file                                                                                                                                                                              | service_request  |
| Staff, StaffUnitLink, StaffAttendance | see 5.5                                                                                                                                                                                                    | staff            |
| InventoryItem, InventoryTransaction   | see 5.6                                                                                                                                                                                                    | housekeeping     |
| AMC, AMCVisit                         | see 5.7                                                                                                                                                                                                    | amc              |
| Notice, Amenity, Booking              | see 5.8/5.9                                                                                                                                                                                                | notice / amenity |

### 10.2 Data Rules

- `DAT-1` Every tenant table has `society_id`, created_at/by, updated_at/by.
- `DAT-2` Money stored as integer minor units (paise) with currency code.
- `DAT-3` Ledger and payment records never deleted or edited; reversed by new entries.
- `DAT-4` Visitor/delivery/staff-entry records retained for **[A-28]** 1 year by default (configurable), then anonymized/archived.
- `DAT-5` Files (photos, PDFs): max 5 MB per file, allowed types JPG/PNG/PDF, stored in object storage with access via signed, expiring URLs, scoped per society.
- `DAT-6` Personal data (phone, name, photo, vehicle) accessible only per role matrix; masked in logs.
- `DAT-7` Unit and user deactivation = soft delete; history preserved.
- `DAT-8` Data export/deletion request process for a user is handled by developer on request (MVP, manual). **[A-29]**
- `DAT-9` Data initially loaded via CSV: Units (block, number, floor, type, area) and Residents (name, email, phone optional, unit, relationship, role). Validation errors reported per row, with a downloadable error report.

---

## 11. Integrations

| Integration                                  | Purpose                                 | Phase         | Notes                                                                                                                                  |
| -------------------------------------------- | --------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Email provider (Brevo)                       | Login codes, receipts, developer alerts | MVP           | **[D-28 — Approved 2026-11-09: Brevo]** Sender domain must be verified (SPF/DKIM) for reliable delivery; provider is swappable (INT-2) |
| Push notifications                           | Visitor/delivery/bill alerts            | MVP           | FCM/Web Push per NFR-1 decision                                                                                                        |
| UPI deep link and QR                         | Resident pays the society directly      | MVP (billing) | No payment gateway or webhooks in MVP; a gateway can be added later without changing the ledger                                        |
| Error tracking                               | Capture and alert on exceptions         | MVP           | **[D-09 — Approved 2026-11-09]** Sentry plus in-app ErrorLog                                                                           |
| Object storage                               | Photos & documents                      | MVP           | Managed cloud storage                                                                                                                  |
| SMS / WhatsApp                               | Mobile OTP login and critical alerts    | Post-MVP      | India DLT registration needed for SMS (lead time); provider chosen later                                                               |
| PDF generation                               | Receipts/invoices                       | MVP           | Server-side                                                                                                                            |
| Accounting (Tally/Zoho)                      | —                                       | Out of scope  |                                                                                                                                        |
| Intercom / boom-barrier / RFID / CCTV / ANPR | —                                       | Out of scope  |                                                                                                                                        |
| Government verification (police/Aadhaar)     | —                                       | Out of scope  |                                                                                                                                        |

Integration rules:

- `INT-1` All external calls are wrapped with timeout, limited retries, and logged on failure with the request ID.
- `INT-2` Provider-specific code is isolated behind a single internal interface so providers can be swapped.
- `INT-3` Webhooks are signature-verified and idempotent.

---

## 12. Loading, Empty, and Error States

### 12.1 Global patterns

| State                   | Behavior                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Loading (lists/pages)   | Skeleton placeholders; no blocking spinners for > 300 ms operations; buttons show in-progress and disable to avoid double submit |
| Empty                   | Friendly message + the primary action (if the role may perform it)                                                               |
| Error (recoverable)     | Inline message + **Retry**; form data preserved                                                                                  |
| Error (unexpected, 5xx) | "Something went wrong" + **Reference ID** + copy button + retry; logged per `LOG-1`                                              |
| Validation error        | Field-level, plain language                                                                                                      |
| Permission denied       | "You don't have access to this" + back to home                                                                                   |
| Module disabled         | "This feature isn't enabled for your society" + contact admin                                                                    |
| Offline / network lost  | Banner "No connection"; actions disabled; auto-retry on reconnect                                                                |
| Session expired         | Redirect to login preserving destination                                                                                         |
| Society suspended       | Banner with contact info; read-only per **[D-07]**                                                                               |

### 12.2 Screen-specific states

| Screen                        | Loading                             | Empty                          | Error                                                                                                     |
| ----------------------------- | ----------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Visitor log                   | Skeleton rows                       | "No visitors today"            | Retry; guard sees prominent "Can't reach server — try again or call resident"                             |
| Visitor waiting (guard)       | "Waiting for resident…" with timer  | —                              | Timeout state with options per `VIS-4`; notification-send failure shows "Couldn't notify — call resident" |
| Pre-approval code entry       | Inline validating                   | —                              | "Invalid / expired / already used" distinct messages                                                      |
| Delivery list                 | Skeleton                            | "No deliveries"                | Retry                                                                                                     |
| Dues                          | Skeleton                            | "No dues — you're all paid up" | Retry; submission rejected: shows the admin's reason with a **Resubmit** action                           |
| Payment awaiting confirmation | Status chip "Awaiting confirmation" | —                              | Shows submitted reference and date; "The admin will confirm after checking the bank statement"            |
| Bill generation               | Progress indicator, background job  | "No units to bill"             | Per-unit failures listed; completed units retained; safe re-run (idempotent)                              |
| Service requests              | Skeleton                            | "No requests yet. Raise one"   | Upload failure per-photo retry                                                                            |
| Notifications                 | Skeleton                            | "You're all caught up"         | Retry                                                                                                     |
| CSV import                    | Row progress                        | —                              | Row-level error report                                                                                    |
| Developer log viewer          | Skeleton                            | "No errors for this filter"    | Retry                                                                                                     |
| Module config                 | Skeleton                            | —                              | Save failure keeps toggle unchanged and shows reason                                                      |

---

## 13. Edge Cases and Business Rules (explicit)

- A unit with no active approver: visitor entry shows "No resident to notify"; guard follows `VIS-4` policy.
- Multiple approvers respond simultaneously: first response wins; the others see the final status.
- Same email, multiple societies: allowed; roles are per society.
- Resident leaves (move-out) with dues: admin can still view/collect dues; the ledger stays attached to the unit; new occupant does not inherit individual-level history. Outstanding unit dues are billed to the current owner. **[D-29 — Approved 2026-11-09]**
- Bill generated twice for the same period: blocked (`BIL-2`).
- Resident submits a UTR the admin cannot find in the statement: admin rejects with a reason; resident may resubmit. Same UTR submitted twice: blocked (`BIL-16`). Resident pays the wrong amount: admin confirms the actual amount received (partial/advance rules `BIL-8`, `BIL-9`) or rejects with a reason.
- Module disabled mid-flow (e.g., visitor pending): pending items freeze; guard sees module-disabled; on re-enable they expire if past timeout.
- Deleting a unit with history: blocked; deactivate only.
- Time zones: all display in the society timezone.
- Pre-approval code reuse: single-use by default; multi-use within window optional per invite (**[A-30]** MVP single-use only).

---

## 14. MVP Scope, Out of Scope, Success Criteria

### 14.1 MVP Scope (proposed — **[D-02]**)

**In scope**

- Core: OTP auth, society/blocks/units, residents, roles, in-app notifications, module registry & developer config, error log + audit log + log viewer, CSV import.
- Visitor management (walk-in, pre-approval by code, history, blacklist warning).
- Delivery management (allow/leave/deny, parcel collection).
- Billing (charges, bill generation, UPI payments with admin confirmation, direct payment recording, fines, late fee, reminders, dashboards, receipts).
- Service requests (create, assign, track, rate).
- English only, responsive web (PWA) per **[D-23]**.

**Release gating**: each module released only after its acceptance criteria and UAT pass; modules can ship independently behind the module toggle.

### 14.2 Post-MVP (planned, not in MVP)

Staff, Housekeeping inventory, AMC, Notice board, Amenity booking (in that order, per D-02/D-21/D-22).

### 14.3 Explicitly Out of Scope (until you request)

- Native iOS/Android apps (unless D-23 changes it)
- Accounting/general ledger, expense & vendor payments, budgeting, payroll
- In-app SaaS subscription billing for societies
- Hardware integrations (intercom, boom barriers, RFID, ANPR, CCTV)
- Offline mode (unless D-25 changes it)
- Multi-language, regional languages
- Resident marketplace, forum, polls, parking management, SOS/panic, vehicle registry, document vault, event management
- Vendor/technician logins
- White-label per-society branding beyond logo
- Developer impersonation of users
- AI features, chatbots
- Public APIs / third-party developer access

### 14.4 Success Criteria

**Product (pilot of 2–3 societies, 90 days after MVP go-live)**

| Metric                                                                   | Target                 |
| ------------------------------------------------------------------------ | ---------------------- |
| Resident activation (signed in at least once / invited)                  | ≥ 70%                  |
| Visitor entries logged digitally vs. total gate traffic (guard-reported) | ≥ 90%                  |
| Median visitor approval response time                                    | < 60 s                 |
| UPI payments confirmed by admin within 24 h of submission                | ≥ 90%                  |
| Service requests resolved within SLA                                     | ≥ 80%                  |
| Admin time to run monthly billing                                        | < 30 min for 300 units |
| Monthly active residents / activated                                     | ≥ 60%                  |
| Pilot society NPS or satisfaction (admin)                                | ≥ 8/10                 |

**Technical**

| Metric                                              | Target              |
| --------------------------------------------------- | ------------------- |
| Unhandled errors with reference ID captured         | 100%                |
| Median time to locate an error from reference ID    | < 2 min             |
| Zero cross-tenant data leaks (tests + review)       | 0                   |
| Module toggle takes effect                          | < 1 min, UI and API |
| Payments awaiting confirmation for more than 3 days | 0 at weekly review  |
| Uptime                                              | ≥ 99.5%             |

---

## 15. Risks

| Risk                                           | Mitigation                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Guards resist adoption / slow data entry       | Minimal-field forms; simple large-button UI; pilot training                                 |
| Login emails land in spam or are delayed       | Verify sender domain (SPF/DKIM), use a reputable provider, show resend and support guidance |
| Wrong or fraudulent UPI ID entered in settings | Audit log, committee notified, "last changed" shown to residents (BIL-15)                   |
| Admin workload confirming payments manually    | Review queue with filters; revisit a payment gateway after pilot                            |
| Notifications unreliable on iOS web push       | Guard can call the resident; add SMS/WhatsApp alerts post-MVP (D-06)                        |
| Scope creep with many modules                  | Enforce module boundaries and this PRD's out-of-scope list                                  |
| Data privacy (visitor/staff PII)               | Minimum data, access by role, retention rules                                               |
| Poor network at gate                           | Clear error states; revisit D-25                                                            |

---

## 16. Assumptions Register

| ID   | Assumption                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Visitors, domestic staff, and vendors are not app users in MVP                                                                                    |
| A-02 | India market: INR, +91, UPI                                                                                                                       |
| A-03 | Society size 50–1,500 units, multi-block supported                                                                                                |
| A-04 | Guards use a shared device or their own Android phone                                                                                             |
| A-05 | `delivery` independent of `visitor`                                                                                                               |
| A-06 | Session length 30 days                                                                                                                            |
| A-07 | One user can belong to multiple societies                                                                                                         |
| A-08 | Module settings are developer-only in MVP                                                                                                         |
| A-09 | Error logs kept 90 days; audit logs 2 years                                                                                                       |
| A-10 | Frequent visitors are P2                                                                                                                          |
| A-11 | Any approver for the unit can approve; first response wins                                                                                        |
| A-12 | Blacklist only warns the guard (does not auto-block)                                                                                              |
| A-13 | Unit-level delivery preference setting                                                                                                            |
| A-14 | Delivery pre-announce is P2                                                                                                                       |
| A-15 | Payments allocated to oldest dues first                                                                                                           |
| A-16 | Advance payments kept as credit                                                                                                                   |
| A-17 | Bills immutable once published; corrections via adjustments                                                                                       |
| A-18 | Vendors are text records, not users                                                                                                               |
| A-19 | Domestic staff add flow requires admin approval by setting                                                                                        |
| A-20 | Per-day staff block is P2                                                                                                                         |
| A-21 | AMC–service request link is P2                                                                                                                    |
| A-22 | Scale: 100 societies, 100k users in year 1                                                                                                        |
| A-23 | DPDP Act principles apply                                                                                                                         |
| A-24 | English only in MVP                                                                                                                               |
| A-25 | Committee is read-mostly                                                                                                                          |
| A-26 | Family members can't pay dues by default                                                                                                          |
| A-27 | Tenants see only data from their tenancy period                                                                                                   |
| A-28 | Entry records kept 1 year                                                                                                                         |
| A-29 | Data deletion requests handled manually by developer                                                                                              |
| A-30 | Pre-approval codes are single-use                                                                                                                 |
| A-31 | In shared gate-account mode, the RWA admin chooses whether guards identify themselves by picking their name or by a personal PIN (approved, D-30) |
| A-32 | UPI app deep links work on most Android UPI apps; iPhone support varies, so QR and copy-UPI-ID are always available                               |
| A-33 | Admin confirms UPI payments manually from the bank/UPI statement; there is no bank integration                                                    |
| A-34 | Email is the unique login identity in MVP; mobile numbers are optional profile data                                                               |
| A-35 | Login methods are separated from user identity so mobile OTP, passwords and social login can be added later without migrating users               |

---

## 17. Decisions Requiring Your Approval

Items marked **High** block design/build of the affected module; resolve them before that module starts.

| ID   | Decision                                         | Recommendation                                                                                                                                                                                                                                                                     | Priority |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D-01 | Product name                                     | **Approved 2026-11-09:** Homeish, tagline "A little more like home." (chosen the same day because the originally requested `.vercel.app` address was unavailable; existing logo mark kept)                                                                                         | Closed   |
| D-02 | MVP module set & order                           | **Approved 2026-11-09:** Core + Visitor + Delivery + Billing + Service Request; Staff/HK/AMC next                                                                                                                                                                                  | Closed   |
| D-03 | Login method                                     | **Approved 2026-11-09:** email + code now; mobile OTP, passwords and Google later                                                                                                                                                                                                  | Closed   |
| D-04 | Developer login security                         | **Approved 2026-11-09:** email + password + TOTP MFA, separate route                                                                                                                                                                                                               | Closed   |
| D-05 | Resident onboarding                              | **Approved 2026-11-09:** email invite or society-code request with admin approval                                                                                                                                                                                                  | Closed   |
| D-06 | Notification channels in MVP                     | **Approved 2026-11-09:** in-app + push + email; SMS/WhatsApp post-MVP                                                                                                                                                                                                              | Closed   |
| D-07 | Suspended society behavior                       | **Approved 2026-11-09:** read-only access                                                                                                                                                                                                                                          | Closed   |
| D-08 | SaaS subscription billing in-app                 | **Approved 2026-11-09:** no in-app billing; invoice outside Homeish                                                                                                                                                                                                                | Closed   |
| D-09 | Error tracking approach                          | **Approved 2026-11-09:** Sentry plus Homeish ErrorLog                                                                                                                                                                                                                              | Closed   |
| D-10 | No-response visitor policy                       | **Approved 2026-11-09:** guard may allow by society setting, with a required reason and audit entry                                                                                                                                                                                | Closed   |
| D-11 | QR vs code for pre-approvals                     | **Approved 2026-11-09:** QR and the same readable 6-digit code in MVP                                                                                                                                                                                                              | Closed   |
| D-12 | Billing calculation methods                      | **Approved 2026-11-09:** fixed per unit, per sq ft, custom per unit                                                                                                                                                                                                                | Closed   |
| D-13 | Late fee rule                                    | **Approved 2026-11-09:** fixed amount or percentage after grace period; no compounding                                                                                                                                                                                             | Closed   |
| D-14 | Payment gateway                                  | **Approved 2026-11-09:** none in MVP; UPI direct to society, admin confirms                                                                                                                                                                                                        | Closed   |
| D-15 | Funds flow (society account vs platform)         | **Approved 2026-11-09:** direct to the society's UPI account                                                                                                                                                                                                                       | Closed   |
| D-16 | Gateway fee bearer                               | Not applicable in MVP (no gateway)                                                                                                                                                                                                                                                 | Closed   |
| D-17 | Common-area requests visibility                  | **Approved 2026-11-09:** all residents may read; no resident edits or comments in MVP                                                                                                                                                                                              | Closed   |
| D-18 | ID proof handling for staff                      | **Approved 2026-11-09:** optional ID type + last four digits; no full document                                                                                                                                                                                                     | Closed   |
| D-19 | Payroll for society staff                        | **Approved 2026-11-09:** out of scope                                                                                                                                                                                                                                              | Closed   |
| D-20 | Housekeeping = inventory only                    | **Approved 2026-11-09:** stock tracking only; no cleaning schedules or QR area logs                                                                                                                                                                                                | Closed   |
| D-21 | Add Notice Board module                          | **Approved 2026-11-09:** include as P2-4                                                                                                                                                                                                                                           | Closed   |
| D-22 | Add Amenity Booking module                       | **Approved 2026-11-09:** include as optional P2-5                                                                                                                                                                                                                                  | Closed   |
| D-23 | Client platform                                  | **Approved 2026-11-09:** installable web app (PWA) for all roles                                                                                                                                                                                                                   | Closed   |
| D-24 | Tenancy model                                    | **Approved 2026-11-09 (with stack approval):** shared database, separated per society                                                                                                                                                                                              | Closed   |
| D-25 | Offline support for guards                       | **Approved 2026-11-09:** not in MVP                                                                                                                                                                                                                                                | Closed   |
| D-26 | Committee approval for waivers                   | **Approved 2026-11-09:** admin-only by default; optional society setting enables committee approval                                                                                                                                                                                | Closed   |
| D-27 | Developer impersonation                          | **Approved 2026-11-09:** no impersonation or view-as access                                                                                                                                                                                                                        | Closed   |
| D-28 | Message provider                                 | **Approved 2026-11-09:** Brevo for email now; SMS provider decided later (post-MVP)                                                                                                                                                                                                | Closed   |
| D-30 | Guard identification in shared gate-account mode | **Approved 2026-11-09:** RWA admin chooses per society: pick name or personal PIN                                                                                                                                                                                                  | Closed   |
| D-31 | Protection of society UPI details                | **Approved 2026-11-09:** admin edits; audited; admins and committee notified; residents see last-changed date                                                                                                                                                                      | Closed   |
| D-32 | How a UPI payment is marked paid                 | **Approved 2026-11-09:** resident submits UTR (optional screenshot); admin confirms or rejects                                                                                                                                                                                     | Closed   |
| D-33 | First-ten society offer                          | **Approved 2026-11-09:** first ten live societies pay no Homeish subscription; production hosting remains separately funded; decide later pricing before society eleven is invited                                                                                                 | Closed   |
| D-34 | Public website, society subdomains and beta      | **Approved 2026-11-09:** public marketing root; interactive synthetic demo with periodic resets; future society subdomains, Maplewood address reserved but disabled, onboarding via post-MVP create-society script; separate beta Vercel project/branch; beta-to-main release flow | Closed   |
| D-29 | Dues ownership on tenant/owner change            | **Approved 2026-11-09:** balance stays with the unit and is billed to the current owner                                                                                                                                                                                            | Closed   |

---

## 18. Glossary

- **Society/Apartment**: a residential community managed as one tenant.
- **Unit**: a flat/house.
- **Primary contact**: main person responsible for a unit.
- **Approver**: occupant authorized to approve visitors/deliveries.
- **AMC**: Annual Maintenance Contract.
- **Module**: independently enableable feature area.
- **Reference ID**: code shown on an error to find its log entry.
