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

**Expansion roadmap (D-38 — approved 2026-11-14).** The modules below are planned in three waves (P3 must-have, P4 high value, P5 good to have). Each still needs its phase-kickoff decisions (Section 5.10) before it is built, ships switched off, and follows the module completion gate. Build may run in parallel with pilot hardening, but no expansion module is enabled for a live society before the pilot go-live gates are closed.

| #   | Module                                   | Key             | Disableable | Release |
| --- | ---------------------------------------- | --------------- | ----------- | ------- |
| 10  | Society Expenses & Accounts              | `expense`       | Yes         | P3-1    |
| 11  | Resident & Vehicle Directory             | `directory`     | Yes         | P3-2    |
| 12  | Move-in / Move-out & Tenancy             | `tenancy`       | Yes         | P3-3    |
| 13  | Document Repository                      | `document`      | Yes         | P3-4    |
| 14  | Parking Management                       | `parking`       | Yes         | P3-5    |
| 15  | Emergency & SOS                          | `sos`           | Yes         | P3-6    |
| 16  | Polls & Voting (ported from Civic Pulse) | `poll`          | Yes         | P4-1    |
| 17  | Meetings & AGM                           | `meeting`       | Yes         | P4-2    |
| 18  | Vendors & Purchase Approvals             | `vendor`        | Yes         | P4-3    |
| 19  | Guard Patrol & Incident Log              | `patrol`        | Yes         | P4-4    |
| 20  | Utility Metering                         | `metering`      | Yes         | P4-5    |
| 21  | Asset Register                           | `asset`         | Yes         | P5-1    |
| 22  | Resident Community & Marketplace         | `community`     | Yes         | P5-2    |
| 23  | Events & RSVPs                           | `event`         | Yes         | P5-3    |
| 24  | Home-Services Directory                  | `home_services` | Yes         | P5-4    |

Platform enhancements in the same waves (not separate modules): committee analytics dashboard (P4-6), service-request SLA escalation (P5-5, inside `service_request`), and multi-language (P5-6, Core). The multi-society overview and outside operator accounts (P5-7) are deferred to the future (D-65); see [deferred-features.md](roadmap/deferred-features.md).

**Module dependencies**

- `delivery` is independent of `visitor`; it shares only Core notification and unit data. **[A-05]** (Avoids coupling so modules toggle independently.)
- `staff`, `housekeeping`, `amc` are independent of each other. `amc` may link to `service_request` optionally if both enabled (P2).
- Enabling/disabling a module never deletes its data (see MOD-4).
- Expansion modules use optional links only: `parking` and `tenancy` read `directory` vehicles/contacts when it is enabled; `vendor` and `metering` post to `expense`/`billing` only when those are enabled; `meeting` can attach `poll` resolutions; `asset` can link to `amc` contracts. A module never requires another optional module to be enabled. **[A-36]**

---

## 4. Core Platform Module (`core`)

### 4.0 Public website, society hosts and beta (D-34)

**Approved 2026-11-09:** `homeish.vercel.app` is the public marketing website, not a login screen. `demo.homeish.vercel.app` is a public interactive synthetic demo, periodically reset. Future societies use their own configured subdomains of the same application, not separate branches. **Owner clarification:** Maplewood is a real society: its address is prepared but disabled (placeholder page only). Do not onboard it now; the owner will do that with the create-society script (`scripts/create-society.mjs`, see OPERATIONS "Society onboarding") once MVP is ready.

`beta.homeish.vercel.app` belongs to a separate Vercel project deploying the `beta` branch for testing and later new features. Verified changes are merged into `main` for the shared website/society deployment. Beta must never use real society data or the production database. **Database projects (2026-11-09, ARCHITECTURE AD-14):** `homeish-testdb` for development/testing/beta, `homeish-demo` for the synthetic demo, and `homeish-live` for all onboarded societies; the database-backed demo will move to its own Vercel project `demo-homeish` so the main deployment never holds demo credentials. This preserves D-24: live societies share a database with enforced society isolation; it does not copy Civic Pulse's per-society database model.

Current delivery is the marketing page, host allow-list, beta entry and a browser-only synthetic demo illustration (manual and 15-minute resets). Authentication, actual modules, isolated backend provisioning and database-backed demo resets remain prerequisites for a full working demo or any real society activation. Maplewood's reserved host shows a disabled "not open yet" page; all other society hosts fail closed as unconfigured. No society directory is published.

**Hosting approval, 2026-11-09:** Vercel reported the originally requested product address is assigned to another project, so the owner chose the name Homeish (D-01). `homeish.vercel.app` is attached to `homeish` and `beta-homeish.vercel.app` to `beta-homeish`, under team `arp-dev`. After a temporary pause, the owner approved resuming both scaffold projects and automatic deployment: merge a feature branch into `beta` to deploy `beta-homeish`, verify it, then merge `beta` into `main` to deploy `homeish`. The owner also approved committing/pushing and performing this initial release sequence. `vercel.json` enables only the two release branches; the project build gate isolates them. Preview branch tracking stays disabled and Production domain assignment is automatic. This does not activate authentication, backends, modules or real societies. The nested demo/beta example URLs above are not confirmed live addresses; current hosted beta testing uses `beta-homeish.vercel.app`.

#### 4.0.1 Public homepage refresh (H1/H2)

**Owner request recorded 2026-11-14:** take high-level inspiration from [Multi-School ERP's public homepage](https://multischoolerp.com/), adapted to society management. This is a follow-up to the existing public website (D-34), not a new app module. **Approved 2026-11-14:** society committees/admins are the primary audience, with resident benefits; **Try demo** is the only marketing CTA; planned modules belong in a separate clearly labelled roadmap; proof assets are synthetic product screenshots only. Any future enquiry destination remains deferred outside this refresh.

**Implementation authorised 2026-11-15 (D-49):** complete both H1 and H2 locally. The owner confirmed that the separate demo is not set up and must wait until the product is ready. Show **Try demo** as a natively disabled button with **Demo coming soon**, with no demo URL or inline substitute. Enable and connect it only in a separately authorised task after demo hosting, synthetic-data isolation and reset behavior are verified. Preserve the existing demo-host implementation and all host boundaries; this refresh neither provisions nor publishes a demo. **Owner review 2026-11-15:** the delivered copy and all three synthetic screenshots were explicitly approved. Real-device/screen-reader/zoom acceptance, release and demo setup remain separate and pending.

**Verified reference observations (2026-11-14):** the public HTML/page text presents an audience-led hero with purchase and demo actions, a trust-summary strip, deliverable cards, role-specific demo links, screenshot-led feature explanations, a module catalogue and UI gallery, testimonials, purchase details, FAQs, getting-started steps, repeated closing actions and policy links. This records the page's content structure only: its demos, customer statements, security claims and product completeness were not independently tested.

**Homeish section hierarchy (within the approved decisions):**

1. **Header and hero:** retain the Homeish name, selected logo and "A little more like home." tagline; lead with society committees/admins choosing the product and explain resident benefits in plain language. The only marketing CTA is **Try demo**, disabled with **Demo coming soon** until the separately verified demo is ready (D-49). Preserve existing-society address/sign-in entry as separate utility navigation, not another marketing CTA. No request-walkthrough/contact CTA or enquiry form is included.
2. **Trust summary:** short, evidenced explanations of society isolation, role-based access and privacy, with honest rollout limits. Proof assets are synthetic Homeish product screenshots only: no testimonials, customer/society logos or references, fabricated adoption/statistics, certifications or unsupported uptime/security guarantees.
3. **People and everyday workflows:** explain the work of residents, guards, admins/managers and committee members. Use original synthetic Homeish product screenshots with brief outcome-led explanations, not school terminology or borrowed artwork. H2 captures the existing payment-details, common-area service-request and resident amenity-booking fixtures, without real names, contact details or records.
4. **Module overview and separate roadmap:** distinguish **Released for testing** (visitor, delivery, billing, service requests, notices, staff, housekeeping, AMC and amenities), **In development** (locally verified expenses and directory, not yet released to beta) and the separate **Planned modules** roadmap (P18-P33). Live society activation and owner UAT remain pending. Do not imply any roadmap module is usable now or enabled for every society.
5. **Preview and setup:** explicitly label screenshots as still images, not a connected demo. Explain that demo hosting/connection and live society onboarding are not open, then outline future society setup and role-based use. Preserve D-34 host boundaries and disabled/unconfigured society behavior. Once a demo is separately authorised, verify its actual destination, supported interactions, synthetic-data notices and resets before enabling the CTA.
6. **Practical FAQs:** cover society onboarding, module enablement, privacy, the installable web app and connectivity limits, and UPI submission followed by admin confirmation. Subscription/offer wording must follow D-08/D-33; do not import the reference's source-code sale, one-time price, native-app downloads or delivery promises.
7. **Closing action and footer:** repeat the disabled **Try demo** action and **Demo coming soon** note; preserve existing-society entry as utility navigation and include the existing privacy policy. Do not invent a terms route, contact/request-walkthrough action or enquiry form; enquiry destination remains deliberately deferred.

**Availability and evidence rule:** distinguish released beta functionality awaiting owner UAT/live activation, in-development previews and planned modules from production-enabled functionality. A roadmap entry, passing local tests or code merged to `main` is not proof of live availability. Check release evidence, module completion gates and production approval when finalising copy; never advertise an unfinished directory or another incomplete module as available.

**Brand, accessibility and privacy guardrails:** use Homeish's existing paper/ink/blue palette, Manrope/Sora typography, logo, tokens and plain-language voice (DESIGN Sections 1, 14 and 18). Create original copy, imagery and composition: no copied text, assets, branding or pixel layout. Preserve WCAG 2.2 AA, semantic headings/skip link, keyboard access and visible focus, meaningful alt text, 48px targets, 320px reflow/200% zoom, reduced motion and lightweight mobile delivery. Use synthetic data only in public previews; never publish resident names/contact details, emergency contacts, vehicles or a society directory. No new lead-data collection, third-party trackers or embedded services without separate approval and a documented purpose.

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
3. _Frequent visitors_ (guest, relative): Resident saves as "frequent" for faster pre-approval. **[A-10]** Originally P2; delivered in MVP+ (2026-11-14): residents save, pre-approve from and remove frequent visitors on the visitors page.

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
- `DEL-4` Resident can pre-announce an expected delivery (platform, window) so the guard sees it as expected. **[A-14]** Originally P2; delivered in MVP+ (2026-11-14): window up to 24 hours, residents can cancel, guards see a read-only "Expected deliveries" list.
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
- `BIL-3` Late fee: society-level rule — fixed amount or percentage, applies after due date + grace days; computed by a scheduled job. Late fees do not compound. **[D-13 — Approved 2026-11-09]** Percentage rules support up to two decimal places, greater than 0% and no more than 100%; fixed amounts are stored as whole paise. Fees remain off by default. **[D-35 — Approved 2026-11-10]**
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

**P38 dues additions (D-71 approved for P38.2–P38.4; P38.1 remains blocked):**

- `BIL-18` Optional simple annual interest applies only to future bills. No rate or legal basis is approved; this requirement stays blocked until an accountant/legal review approves the rate, calculation and late-fee interaction. No interest is calculated or posted meanwhile.
- `BIL-19` Admins manage payment-plan tracker records; committee members can view them. Each plan links one unit to selected open bills and snapshots their remaining balances on the plan date. An open bill can belong to only one non-cancelled plan. Admins may edit terms and remarks, but not the bill links; changing the bill set requires cancelling the plan with a reason (retained in history) and creating a replacement. Terms include a down payment, installment count and first due date; installments are equal monthly amounts, with the final installment absorbing paise rounding. Progress is an estimate derived only from confirmed allocations for payments dated on or after the plan date and confirmed after plan creation, applied to the down payment and then installments in order. The current unit-ledger due remains authoritative. There is no in-app approval step or financial effect, and a plan never changes bills, due dates, allocations, reminders, fees or ledger balances.
- `BIL-20` Admins record and manage internal recovery actions and follow-ups; committee members can view them. Action types are Phone call, In-person discussion, Meeting or Other internal action; outcomes are Reached, No response, Follow-up needed, Resolved or Other. Assignee is optional and limited to an active admin account in the same society. These are not legal notices or proof of service; no message is sent, and legal-notice actions or wording need separate approval. Records follow the approved financial-record retention policy.
- `BIL-21` Admins and committee members can view a read-only as-of collection report. For bills due on or before the as-of date, collected is confirmed payment amounts allocated to those bills, with both `paid_on` and `confirmed_at` on or before that date; advance or unallocated credit is excluded. Billed is the original bill amount less approved waivers effective by that date. Keep BIL-11 and P27 definitions unchanged.

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

- `SRQ-1` Resident creates a request: category (Plumbing, Electrical, Lift, Cleaning, Security, Parking, Noise, Other — admin-managed list), location type (**My unit** / **Common area**), description, up to 3 photos, priority (Normal/Urgent; becomes four levels with P49, see SRQ-10).
- `SRQ-2` Admin assigns to an internal staff member or external vendor (a name + phone; vendors are not app users in MVP **[A-18]**).
- `SRQ-3` Status lifecycle: `Open → Assigned → In Progress → Resolved → Closed` (+ `Rejected`/`Reopened`). Resident confirms closure or reopens within X days (default 3); otherwise auto-closes.
- `SRQ-4` Comment thread on each request. The requester, admin and assignee (if a user) may post; other residents may read common-area request threads but cannot comment. **[D-17]**
- `SRQ-5` Resident rates resolution (1–5) after closure with optional comment.
- `SRQ-6` Target resolution time per category (set by admin); overdue requests flagged on admin dashboard. P49 replaces the per-category target with a category × priority table (SRQ-11).
- `SRQ-7` Filters: status, category, unit, date, assignee. Residents see their own requests and may read all common-area requests; they cannot change or comment on common-area requests in MVP. Upvoting was deferred to P2 and is now delivered in MVP+ (2026-11-14): residents can upvote open common-area requests once and remove the vote; counts show on lists and detail, and admins can sort by most upvoted. **[D-17 — Approved 2026-11-09]**
- `SRQ-8` Notifications on every status change and new comment.
- `SRQ-9` Report: counts by category/status, average resolution time, average rating.

**Module settings**: category list, SLA hours per category, auto-close days.

**P49 helpdesk additions (D-70 — approved 2026-11-19; SRQ-1 priority, SRQ-3, SRQ-5, SRQ-6, SRQ-9 and D-59 stay in force until P49 is released).** Owner kickoff answers 2026-11-19:

- `SRQ-10` Priority is Critical, High, Medium or Low (replaces Normal/Urgent in SRQ-1). The resident picks it; an admin may change it, which adds a timeline entry and recalculates the due time from when the request was logged.
- `SRQ-11` The target is set per category and priority (replaces SRQ-6's per-category target). Starting values come from today's category target: Medium = that target rounded up to whole days (at least 1); High = half of Medium rounded up (at least 1); Critical = 1 day; Low = twice Medium. Example: Plumbing at 48 hours starts as Critical 1, High 1, Medium 2, Low 4 days. A category with no target today has no target at any priority. Admins may change any value.
- `SRQ-12` Existing requests show Urgent as High and Normal as Medium and keep their recorded due times.
- `SRQ-13` The wait before committee escalation (D-59) is set either per category or per priority; each society's admin chooses. Societies that already use `service_request` when P49 is released stay on per category with their current values; societies that enable it later start on per priority, with every priority at 2 days. Admins may switch at any time; the change applies to escalation checks from then on.
- `SRQ-14` Admins may put a request On Hold with a required reason, which the requester sees and is notified about (SRQ-8). While on hold, the overdue flag and escalation stop; on release, the due time moves later by the time held. There is no maximum hold; admin lists show how many days a request has been on hold. Auto-close and reopen rules are unchanged.
- `SRQ-15` A read-only performance report (extends SRQ-9): resolution %, on-time %, average days by category, priority and month, open load per assignee, repeat issues, monthly volume and closing backlog. Admins and committee see the report and feedback scores; unit-level repeats and residents' written feedback comments are admin-only. No new P27 metric.
- `SRQ-16` Escalation responses: status (Pending Response, Action Taken, Resolved, Further Escalated), responder, response date, days to respond and outcome notes. Existing escalation levels and notifications are unchanged.
- `SRQ-17` Detailed feedback (extends SRQ-5): Resolution Quality, Response Speed and Staff Behaviour, 1–5 each, plus an overall score and follow-up needed/done. Existing single ratings are shown as the overall score.
- `SRQ-18` Admins and housekeeping supervisors may log a request for a unit and record how it arrived (Walk-in, Phone, WhatsApp, Email, Helpdesk App, Daily Rounds). Resident-created requests default to Helpdesk App. This is a label only, with no channel integration.
- `SRQ-19` Daily common-area check: admins define inspection points; admins, housekeeping supervisors and guards mark each point OK or Issue once a day. An Issue can create or link a common-area request. Reports show the OK rate and the points with the most issues. This is not guard patrol (P25) or a cleaning schedule (D-20).
- `SRQ-20` When `vendor` is enabled, admins can pick an active vendor as the assignee; the name and phone are copied to the request, and blacklisted vendors show a warning. Free text stays available, and existing requests are unchanged.

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
- `STF-9` A resident may submit a staff member whose phone matches an existing society profile; the new unit link stays pending for administrator review, and the matched profile is not exposed to that resident before approval.
- `STF-10` A resident's one-day block denies entry only to that resident's unit; it does not block entry to other linked units.
- `STF-11` Guard staff views show only name, photo, role and entry warnings; phone and ID details remain hidden.
- `STF-12` A staff member can have only one open gate attendance at a time; gate entry and exit are explicit actions.

**P48 staff-record additions (D-68 — approved 2026-11-19).** Owner kickoff answers 2026-11-19; payroll stays out of scope (D-19), and D-18 still applies:

- `STF-13` Society staff only (not domestic staff) get employment details: department, designation, employment type (Permanent, Contract, Daily Wage, Part-time), joining date, weekly off and employment status (Active, On Notice, Left) with an exit date when Left. No salary or pay fields.
- `STF-14` Marking a staff member Left shows them as blocked in admin and committee staff lists until an admin sets them back to Active. Society staff do not use the gate entry flow today; if they ever do, Left must be refused with the STF-7 warning. On Notice changes nothing.
- `STF-15` Private performance notes on society staff: date, category (Training needed, Warning, Appraisal, Appreciation, Other), rating 1–5, note, action, follow-up date, recorded by and Open/Closed. Admins write notes; admins and committee members read them; residents, guards and the staff member never see them. The writer may edit a note; every edit and deletion is audit-logged. Notes are kept until an admin deletes them; the audit log keeps who deleted a note and when, but not its text.

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

**P13 owner decisions:** Quantities support three decimal places. Opening stock is a receipt. Past dates are allowed, future dates are rejected, and every dated historical balance must remain nonnegative. History is immutable; signed adjustments require a reason. Low-stock notifications use in-app and push delivery, at most once per item per society-local day until restocked. Admins and supervisors manage inventory; committee members have read-only access including costs and reports. Residents and guards have no inventory access.

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

**P14 owner decisions:** Renewal creates a linked successor and preserves the previous contract and visits. Admin visit corrections are audited. Admins and committee receive in-app and push reminders, not email; defaults are 60/30/7 days. A missed run or late creation sends only the most urgent due catch-up reminder. Admins can link service requests when both modules are enabled; residents receive only the safe asset label, never vendor, contact, cost or documents.

**User Stories**

- As an admin, I get a reminder 30 days before the lift AMC expires.

---

### 5.8 Notice Board (`notice`) — P2-4

**[D-21 — Approved 2026-11-09]** Include the Notice Board as the first post-MVP module because it is simple and high-use.

- `NTC-1` Admin/Committee posts a notice: title, body, optional attachment, audience (All / Block / Owners only), optional expiry.
- `NTC-2` Push notification on publish; residents view list, pinned notices first.
- `NTC-3` Read receipts count visible to the author (aggregate only).

**P11 decisions (owner, 2026-11-13):**

- Audience: all residents, one or more chosen blocks, or owners only. Guards never see notices.
- There is no limit on pinned notices.
- Notices can be edited. An edited notice shows an "Edited" label and does not send a new notification.
- Channels: push and in-app only (no email).
- Expired notices are hidden from residents and kept in the manager archive with withdrawn notices.
- Attachment (one JPEG, PNG or PDF up to 5 MB) and expiry date are optional. A notice expires at the end of the chosen day in India time.
- Managers (admin and committee) see the aggregate read count and the audience size.
- Admins manage every notice. Committee members edit, pin and withdraw only notices they posted. Notices are withdrawn, never deleted.

**P53 notice additions (D-71 approved 2026-11-20):**

- `NTC-4` Drafts and scheduling: admins and committee members can save a notice as a draft, or schedule it for a later posting day. Drafts and scheduled notices are never shown to residents and send nothing. The daily job posts a scheduled notice on its posting day with the normal notification; "Publish now" posts it at once. A scheduled notice whose expiry has already passed returns to draft. Withdrawing a draft or scheduled notice moves it to the archive.
- `NTC-5` Planning fields: each notice may record prepared by, notice-board location, priority (High, Medium, Low) and a next action with an optional date (a date needs an action). Only admins and committee members see them; residents never do. The planning status shown is Draft, Scheduled, Posted (published and not expired) or Removed (withdrawn or expired). Audience, pinning, expiry, attachment, read counts and archive stay as in P11.

### 5.9 Amenity Booking (`amenity`) — P2-5

**[D-22 — Approved 2026-11-09]** Keep Amenity Booking as an optional post-MVP module; societies can leave it switched off.

- `AMN-1` Admin defines amenities (Clubhouse, Hall, Court), slots, capacity, fee (optional, links to billing if enabled), rules text.
- `AMN-2` Resident books a free slot; admin can cancel; no double-booking.
- `AMN-3` Booking list for admin; cancellation by resident until X hours before.

**P15 owner decisions:** Amenities use exclusive recurring weekday slots; capacity is the maximum guest count, not shared reservations. Free and paid bookings confirm immediately. Fees are snapshotted and atomically debited to the existing unit ledger; paid amenities require billing enabled. Resident cancellation is allowed until the slot starts (0-hour cutoff); all allowed resident cancellations and admin cancellations append a full ledger credit. Admin cancellation requires a reason and resident notification. The minimum lead is 24 hours; the booking horizon and active per-unit/per-amenity daily limit are unlimited (0). Active occupancy is required; household members see their occupied unit's bookings, while other units' occupied slots remain anonymous. Each booking acknowledges current rules when present. Schedule edits do not change existing times, fees or accepted rules. No payment gateway is included.

> Modules beyond 5.9 are planned in Section 5.10 (D-38). Their requirements are proposals until each phase's kickoff decisions are recorded.

### 5.10 Expansion Modules (planned — D-38)

Requirement IDs are provisional and are refined at each phase kickoff, as was done for P12–P15. Every module is society-scoped, uses the existing roles (admin, committee, guard, resident, supervisor where relevant), audits management changes, stores files in private buckets, and uses only approved services (Supabase, Brevo email, in-app notifications, Realtime). Nothing below adds SMS, WhatsApp, a payment gateway, a new vendor or native apps.

#### 5.10.1 Society Expenses & Accounts (`expense`) — P3-1

Simple society bookkeeping, not double-entry accounting (D-39). **P16 kickoff decisions (approved 2026-11-14):** default categories are repairs, utilities, staff, housekeeping, security, AMC, insurance/taxes, administration, events and other; accounts include cash and one or more banks with opening balances; committee approval is required above ₹50,000, configurable by society admins; closed months are locked, with admin reopening only by an audited reason; financial year is 1 April–31 March.

- `EXP-1` Admin records expenses with date, category, payee, amount (paise), payment mode (cash, bank, UPI, cheque), reference and an optional receipt (JPEG/PNG/PDF).
- `EXP-2` Expense categories are society-defined, with defaults created on enable.
- `EXP-3` Cash and bank books: named accounts with an opening balance, append-only entries and reversal instead of deletion.
- `EXP-4` Confirmed `billing` payments appear as income automatically when billing is enabled; other income (donations, interest) is entered manually.
- `EXP-5` Reports: income vs expense by month/category, account balances, outstanding dues summary (from billing), CSV and PDF export.
- `EXP-6` Optional committee approval above a society-set amount; committee read-only access otherwise.

**P16 implementation choices (approved 2026-11-15, D-44):** any one committee member other than the person who recorded an expense approves it above the threshold; at or below it, expenses post immediately. Admins choose the account that receives confirmed billing payments as income. Exports are CSV and PDF. Residents see nothing in this module. Expenses are not edited; they are rejected or reversed and recorded again. An expense above the threshold stays pending if no other committee member exists.

**P39 accounts additions (D-69 — approved 2026-11-19).** Owner kickoff answers 2026-11-19. These are views and registers on top of P16; none creates, changes or deletes a cash/bank entry, and D-39's simple bookkeeping stays. Access follows P16 (admins manage, committee read-only, residents none) unless stated. Fixed deposits (P39.5) are decided in Batch 4.

- `EXP-7` Each cash/bank book row shows a running balance calculated from the opening balance, in date order and then the order entries were recorded. A reversal is its own row on its own date; the original row is unchanged. The balance is calculated, not stored.
- `EXP-8` Every entry has one permanent voucher number based on its direction: money in (including billing payments and reversals of expenses) `RV/<financial year>/<number>` and money out `PV/<financial year>/<number>`, restarting each financial year. Existing entries are numbered once, in date order, when the feature is turned on. A number never changes, and no new financial entry is created.
- `EXP-9` Manual bank reconciliation: admins record statement items (date, reference, party, type, amount) against bank books and mark them matched or cancelled with a reason. Items unmatched for more than 30 days are flagged as old. Differences never post entries; real adjustments use the normal P16 entries.
- `EXP-10` Petty cash: an admin marks one cash account as petty cash and names one app user as its custodian. The custodian sees only the petty-cash view and records physical cash counts (date, counted amount, note); admins can too. The book amount comes from P16 entries; any difference from a count is shown, never posted. Changing the custodian requires a handover count, and the custodian history is kept. A fixed float (imprest) amount is left for a possible future Pro version.
- `EXP-11` The accounts report adds monthly net surplus/deficit and the cumulative figure from the start of the financial year, labelled so it is not mistaken for cash or bank balances. No new P27 metric.

#### 5.10.2 Resident & Vehicle Directory (`directory`) — P3-2

Builds on Core unit occupants (owner, tenant, family). **P17 kickoff decisions (approved 2026-11-14):** resident-visible directory shows name and unit by default, phone is hidden unless the person opts in; admins and committee may still see verified contact phones regardless of resident-directory phone opt-in; committee directory access is read-only; guards see the unit for a matched vehicle but never phone; there is no vehicle-per-unit cap; when Core ends an occupancy, directory/vehicle access is deactivated immediately and personal directory data is deleted one year after its recorded `ended_at`, except required audit records. Guard lookup uses the existing standard authenticated-action rate-limit policy. A society's supported maximum size is not yet known, so database-side pagination is required before fetching directory lists. **D-48 (approved 2026-11-14):** when an active resident moves to another unit in the same society, transfer active vehicles and emergency contacts to the new unit, audit each transfer, and require vehicle re-verification; keep visibility preferences attached to the person.

- `DIR-1` Residents manage household membership through Core and add emergency contacts and vehicles (type, registration number, optional sticker/tag number) for their unit; admin can add and verify.
- `DIR-2` Each person controls resident-directory visibility of their name and unit (visible by default) and phone (hidden by default); admin and committee can see verified contact phone data regardless of that directory preference.
- `DIR-3` Guards can search vehicles by registration number to identify resident vehicles and their unit; guards never see phone numbers.
- `DIR-4` Registration numbers are normalised and unique per society among active vehicles.
- `DIR-5` Vehicle and emergency-contact data are deactivated when the occupant moves out and erased after one year; only required audit records are retained.
- `DIR-6` Emergency-contact numbers are visible to the active household, admin and committee; guards do not have directory access (D-46).

#### 5.10.3 Move-in / Move-out & Tenancy (`tenancy`) — P3-3

- `TEN-1` A resident or admin raises a move-in or move-out request with date, time window, and lift/loading-bay booking if the society uses it.
- `TEN-2` Tenant move-in requires a rental agreement and consent from any one active owner of the unit, with no admin bypass. Society-configurable police-verification proof is optional/off by default; it is required only when that society enables the requirement. No Aadhaar or other government ID copies may be collected (D-50).
- `TEN-3` Move-out shows a dues clearance check from `billing` when enabled; any positive outstanding unit balance blocks completion and NOC issue, without an override. A failed check blocks for retry. When Billing is disabled, explicitly show **Not checked** and allow the workflow without claiming clearance. An admin issues the NOC PDF. There is no move fee or deposit in this version (D-50).
- `TEN-4` Approval schedules the move and notifies guards; it does not change occupancy or access. An admin confirms actual completion to atomically add or end the tenant occupancy in Core. Use existing Core invitations, but do not activate the new tenant occupancy before completion. No backdated requests initially; move-out needs no separate owner consent (D-50).
- `TEN-5` In-app agreement-expiry reminders to owner and admin at 30 days, 7 days and expiry. Reuse an existing amenity booking when applicable; do not automatically reserve a lift/loading bay (D-50).

**P18 privacy and NOC policy (D-50, approved 2026-11-15):** private PDF/JPG/PNG uploads, at most 5 MiB per file, readable only by the tenant, active unit owners and admins. Committee is read-only for request status, not tenant files; guards see unit/date/time/status only. Delete tenant uploads and NOC files one year after move-out, or after 30 days for rejected/cancelled requests. Preserve Core occupancy history and financial records; existing audit retention applies. This is a narrow exception to the earlier police-proof storage exclusion, not permission to collect general identity documents.

**Approved NOC template:** "[Society] has no objection to the approved move-out of [resident] from [unit] on [move date]. Dues status at issue: [cleared as of timestamp / not checked because Billing is disabled]. Issued by [admin] on [issue date]. This records the society's move-out approval."

**NOC font boundary (owner-approved D-50 follow-up, 2026-11-15):** preserve all text supported by the installed PDF font, with canonical NFC normalisation; never strip accents or substitute question marks in names/labels. If a rendered field contains unsupported characters, clearly block NOC issuance before upload, without changing the saved names. Full-script font support remains a follow-up; no new dependency is authorised. This applies to the new tenancy NOC, not a behaviour change to existing Billing/Expense PDFs.

#### 5.10.4 Document Repository (`document`) — P3-4

- `DOC-1` Admin uploads society documents (bylaws, minutes, audit reports, NOCs, circulars) into folders with an audience: all residents, owners only, committee only.
- `DOC-2` Versions are kept; documents are archived, not deleted.
- `DOC-3` Residents can download unit-specific documents issued to their unit (for example a NOC).
- `DOC-4` Access uses signed private-file links; download events are audited for committee-only documents.

**P19 owner decisions (D-51, approved 2026-11-15):** admin-managed folders, seeded with Bylaws, Minutes, Audit reports, Circulars and NOCs, which admins can rename, add and archive. Each folder has one audience: all residents, owners only, or committee and admins. Files are PDF/JPEG/PNG up to 5 MB. **Every** download is audited, not only committee-only documents. Residents cannot upload or request documents. Unit-issued documents are visible to all occupants or owners only, chosen per document; P18 NOCs appear read-only in the unit's documents when Tenancy is enabled. Versions are kept, documents are archived and never deleted, and access uses signed private links.

#### 5.10.5 Parking Management (`parking`) — P3-5

- `PRK-1` Admin defines parking slots (level, number, type: car/two-wheeler/visitor/EV) and allocates them to units.
- `PRK-2` Waitlist for unallocated requests in request order.
- `PRK-3` Residents issue visitor parking passes linked to a visitor entry when `visitor` is enabled.
- `PRK-4` Guards and residents report wrong parking with an optional photo; the slot holder and admin are notified.

**P20 owner decisions (D-52, approved 2026-11-15):** slot types car, two-wheeler, visitor and EV, each with a label and optional location note. Admins may allocate any number of slots to a unit, with no fees. One first-in, first-out waitlist per slot type; allocating out of order needs a written, audited reason. Admins and the unit's residents may optionally link the unit's directory vehicles to a slot: a car or EV slot holds at most one four-wheeler plus any number of two-wheelers, a two-wheeler slot holds two-wheelers only, and visitor slots are never allocated. Without Directory there are no links. Residents create visitor passes of up to 24 hours, optionally linked to a visitor entry; passes are unavailable when Visitor is off. Wrong-parking reports pick a slot or type a vehicle number and notify the matched unit (slot holder or directory vehicle) and admins; a reporter outside that unit is not told which unit matched. Report photos are kept for 3 days by default (admin-configurable 1–90).

#### 5.10.6 Emergency & SOS (`sos`) — P3-6

Delivered through in-app notifications and Realtime only (D-41); no SMS, WhatsApp, calls or push dependency.

- `SOS-1` Resident raises an SOS (medical, fire, security, other) with one confirmed tap from the home screen.
- `SOS-2` On-duty guards and admin/committee receive an in-app alert that stays visible until acknowledged, with the guard alert sound used for gate alerts.
- `SOS-3` Responders acknowledge, update and close the alert; every step is timestamped and audited.
- `SOS-4` Society emergency contacts (hospital, fire, police, security agency) are listed for all residents.
- `SOS-5` Abuse protection: rate limit per unit and a required close reason. The UI states clearly that Homeish does not replace emergency services.

**P21 owner decisions (D-53, approved 2026-11-15):** residents and guards can raise an SOS (medical, fire, security, other); the unit is attached automatically, with an optional short note. Admins configure recipients: signed-in guards (on by default), admins (on), committee (off) and residents (off, same floor, same block or whole society). There is no on-duty or shift concept; "on-duty guards" means users with the guard role. Delivery is in-app and Realtime only (D-41). Recipients see a persistent banner on any screen until they mark it seen or the alert ends, and guard devices repeat the alert sound every 30 seconds. Acknowledge, update and close are timestamped and audited. Close reasons are Resolved, False alarm, Duplicate, Test and Other, with a note required for False alarm and Other. The raiser may cancel before acknowledgement ("Raised by mistake"). One open SOS per unit and at most three per unit per hour. Emergency contacts are admin-managed and seeded with India 112, 108 (ambulance), 101 (fire) and 100 (police).

#### 5.10.7 Polls & Voting (`poll`) — P4-1

A native Homeish module ported from the Civic Pulse voting design (D-40). Civic Pulse remains a separate standalone product.

- `POL-1` PUBLIC polls: single or multi-select options, named responses visible to authorized management, a voter may change their selection until closing.
- `POL-2` PRIVATE elections: offices and candidates; only aggregate totals are ever stored or shown; participation is recorded separately from choices (application-level privacy, not cryptographic anonymity).
- `POL-3` Lifecycle: Draft, Scheduled, Active, Completed, Cancelled; the vote is frozen once active; deadlines enforced in the database.
- `POL-4` Entitlement: one vote per unit, cast by the unit's designated voting representative. Owners vote by default; tenant voting is a society setting, off by default (D-42).
- `POL-5` Results shown in-app after completion; management downloads PDF/CSV exports with the Civic Pulse privacy rules (PRIVATE exports list who voted, never choices).
- `POL-6` Zero duplicate, partial or post-deadline ballots, enforced atomically in the database.

**P22 owner decisions (D-60, approved 2026-11-16):** one vote per unit, cast by its representative. The default representative is the unit's active primary occupant if eligible, otherwise the earliest active owner; an admin or an active owner of that unit can choose another eligible occupant, and every change is audited. The voter list and representative names are frozen when a vote is scheduled or immediately activated. Tenant voting is a society setting (off by default, D-42); while a vote is a draft the admin can override it for that vote only, and the vote's value (the override, otherwise the society setting at that moment) is fixed when the vote is scheduled or immediately activated, together with the voter list; family members never vote. A vote covers the whole society by default, or blocks the admin chooses. Everyone living in a voting unit sees the vote and its permitted totals; only the representative votes. Residents see live totals of an open public poll; a private election shows turnout only until it completes. Private elections include "None of the above", which is counted but never wins. The admin can extend the deadline, complete early or cancel (from scheduled or open) with a required reason. Committee members see turnout counts while voting is open (never choices, never names) and results, roster and exports after completion; admins see who has voted once it opens. PDF and CSV exports are for admins and committee, completed votes only, with no email addresses; private exports list who voted, never choices. In-app notifications only: to the representatives when a vote opens, when results are available and when a scheduled or open vote is cancelled. Two years after a vote completes or is cancelled, per-person records (named responses, participation and voter list) are deleted; totals are kept. The load test target is 500 units with 100 concurrent voters.

#### 5.10.8 Meetings & AGM (`meeting`) — P4-2

- `MTG-1` Admin schedules a meeting (AGM, SGM, committee) with agenda, venue/online link and notice period check.
- `MTG-2` Attendance by unit with a quorum indicator.
- `MTG-3` Resolutions can be linked to a `poll` vote when enabled.
- `MTG-4` Minutes and action items with owners and due dates; published minutes are stored in `document` when enabled.

**P23 owner decisions (D-61, approved 2026-11-16):** meeting types are AGM, SGM and committee meeting. By default AGM and SGM invite every active unit and a committee meeting invites the committee members; the admin can change the invitees of a meeting while it is still upcoming — whole society, chosen blocks, chosen floors or chosen units (unit meetings), or chosen committee members (committee meetings). Notice periods are society settings (defaults: AGM 14 days, SGM 7 days, committee 3 days); a shorter notice shows a warning only and does not block or need a reason. Quorum is a society setting shown as an indicator that never blocks: a percentage of invited units present for AGM and SGM (default 33%) and a percentage of invited committee members present for committee meetings (default 50%). Attendance is recorded per unit (per member for committee meetings): the admin marks it, and a unit may attend by proxy, recorded by the admin with the proxy's name and counted toward quorum. During a meeting the admin can open and close self check-in; while it is open, any active owner or tenant occupant (not family members) of an invited unit can mark the unit present once, and the admin can correct or undo any mark. The admin records each resolution's outcome (passed, failed or deferred, with optional for, against and abstain counts); when `poll` is enabled the admin can also create a pre-filled draft poll from a resolution or link an existing poll, and the completed poll's result is shown with the resolution. Admins and committee members can draft minutes; the admin can edit any draft, including one written by the committee, and only the admin publishes. Published AGM and SGM minutes are visible to residents of invited units; committee-meeting minutes are visible to admins and committee members only. When `document` is enabled, publishing also saves a PDF of the minutes in the document repository with the same visibility. Action items have an owner and a due date; a society setting decides whether owners can be any active society member (default) or only admins and committee members. Owners get a notification when assigned and one daily reminder while an item is overdue. Notifications are in-app plus push, to invitees when a meeting is scheduled, rescheduled or cancelled and when minutes are published. Meetings, attendance, resolutions and minutes are kept permanently as society records.

#### 5.10.9 Vendors & Purchase Approvals (`vendor`) — P4-3

- `VEN-1` Vendor directory with category, contact, GST number (optional), documents and a rating from admin/committee.
- `VEN-2` Purchase request with up to several quotes; approval by a society-configured number of committee approvers.
- `VEN-3` Approved purchases create an expense draft when `expense` is enabled.
- `VEN-4` No vendor logins (Section 14.3).

**Owner decisions (2026-11-16, D-54):** one quote is enough below ₹25,000 and three quotes are needed from ₹25,000; the threshold and quote count are society settings, and an admin can override the quote rule with an audited reason. The number of committee approvals is a society setting from 0 to 5 (default 1); with 0, an admin approves alone and the approval is audited. The person who raised a request can never approve it. Vendor ratings are 1–5 stars with an optional comment, visible to admins and committee only.

**P47 vendor additions (D-71 approved for Batch 2 implementation):**

- `VEN-5` Optional vendor PAN (10-character Indian PAN format, stored uppercase), payment terms from 0 to 365 days (0 means due immediately) and onboarded date; a blank terms value uses five days when a bill is created. Blacklisting requires a reason and audit record. Blacklisting warns on new purchase requests and service-request assignment but does not block them or alter past records. PAN is admin-only; existing committee access to other vendor data is unchanged.
- `VEN-6` Admin-managed general vendor contracts record scope, start/end dates, annual value, payment frequency, auto-renewal (a label only), notice days, one optional private document and optional staff-day defaults. **Renew** creates a linked successor; admins may edit a contract with history or terminate it early with a date and reason, and nothing is deleted. Renewal reminders follow the 60/30/7 steps counted back from the notice deadline (end date − notice days), or from the end date when no notice days are set, and go in-app to admins and committee. AMC contracts remain in P14 and are displayed alongside, never duplicated.
- `VEN-7` AMC schedules may record AMC type, an asset type chosen from the asset register's categories, and 1–12 services per year. Space services by `round(365 / services per year)` days from the last logged visit; before any visit is logged, next service remains unscheduled. Existing free-text frequency is not guessed or converted.
- `VEN-8` Admins record one monthly agency staff-day check per contract and month: sanctioned/actual days, shortfall, contracted amount, deduction, payable and bill-raised variance. The contract's default sanctioned days and per-missing-day rate are copied into each check and can be changed there. The rate is applied to the shortfall, capped at the contracted amount; without a rate, an admin may enter a reasoned manual deduction, also capped at the contracted amount. Changing a saved check needs a reason and keeps the earlier values. The check creates no bill or payment.
- `VEN-9` Admins manage work orders linked to an approved P24 purchase request, one non-cancelled work order per request; committee members can view them. Numbers run per society and calendar year (`WO-YYYY-0001`); the record tracks description, value, issue date, optional due date, completion date and status, with days open derived and delay derived only when a due date is set. Description and due date may be edited with history; value and vendor are fixed; status only moves forward (Issued may go straight to Completed), and cancelling needs a reason.
- `VEN-10` Admins manage vendor invoices owed; committee members can view them. At bill creation, the due date is the invoice date plus the vendor's saved payment terms, or five days if no terms are saved; the effective terms are snapshotted. The Due Soon window is seven calendar days through the due date, and overdue begins the following day. Outstanding is the invoice amount less linked P16 cash-book payments; partial payments are allowed. Show payment status (`Pending`, `Partly paid`, `Paid`) separately from the due-state warning (`Due Soon`, `Overdue`); a partly paid overdue bill keeps `Partly paid` and also shows `Overdue`. A bill cannot be manually marked paid or paid outside the existing P16 entry flow. Any unreversed money-out entry from a posted expense can be linked, whatever its payee; one entry may be split across bills and a bill may have several entries, never above the bill's outstanding or the entry's unlinked amount. A reversed entry stays linked but stops counting. An admin may unlink a wrongly linked payment with a reason; the link stays in history but stops counting. Invoice numbers are unique per vendor among non-cancelled bills. A bill can be edited with history until a payment counts; after that it can only be cancelled, with a reason, once no linked payment counts.
- `VEN-11` Vendor/contract summaries show source-linked active vendors, contract value, renewals due (unrenewed general and AMC contracts in Due Soon or Urgent), ratings, open work orders, overdue AMC services and bills owed: society totals on the vendor list and one vendor's figures on its page. Do not add a P27 metric for this summary.
- AMC status changes to Upcoming, Active, Due Soon, Urgent and Expired. Society admins can change the expiry windows on the AMC admin page; defaults are Due Soon within 60 days and Urgent within 30 days, and Urgent must remain shorter than Due Soon. Existing 60/30/7 reminder days do not change. The P27 "Contracts expiring" metric keeps its fixed 30/60-day meaning, and a separate "AMC renewal bands" metric follows the society's windows.

#### 5.10.10 Guard Patrol & Incident Log (`patrol`) — P4-4

- `PAT-1` Admin defines patrol checkpoints with printable QR codes and patrol schedules.
- `PAT-2` Guards scan checkpoints during a round; missed checkpoints are flagged.
- `PAT-3` Incident reports with category, description, photos and follow-up; serious incidents notify admin immediately.
- `PAT-4` Shift handover notes between guards.

**Owner decisions (2026-11-16, D-55):** admins print an A4 sheet of QR codes, one per checkpoint, each with a short typed code underneath. Guards scan with the phone's built-in browser QR reader (no new library) or type the code. Admins set rounds per shift (for example every 2 hours) with a grace period; a checkpoint not scanned within its round is flagged as missed. Incident severity is low, medium, high or critical; high and critical notify admins immediately. Up to 3 photos per incident, kept 90 days by default (society setting 30–365).

#### 5.10.11 Utility Metering (`metering`) — P4-5

- `MTR-1` Admin defines meters (water, electricity, DG/gas) per unit or common area, with a rate per unit of consumption.
- `MTR-2` Readings entered by staff, admin or resident (with photo); readings lower than the previous one need a reason.
- `MTR-3` Consumption charges are added to the next bill when `billing` is enabled.
- `MTR-4` Consumption reports and unusual-usage flags.

**Owner decisions (2026-11-16, D-56):** meter types are water, electricity, DG and gas, per unit or common area. A flat rate per meter type for now; slab rates later. Admins and guards enter readings directly (staff records cannot sign in); residents submit a reading with a photo, and an admin approves it before it is used. Monthly cycle: approved readings up to the bill date are added as a charge on the next bill, and a reading is never billed twice. Utility charges are billed automatically when the monthly bills are generated, with an admin "Run utility billing" action as a catch-up. Each unit gets a separate "Utility charges – Mon YYYY" bill, and the society's round-to-the-rupee setting applies to it.

#### 5.10.12 Committee Analytics Dashboard (Core) — P4-6

- `ANL-1` One dashboard for admin and committee: dues ageing, collection trend, expense vs income, request SLA performance, amenity use, visitor trends, and only sections for enabled modules.
- `ANL-2` Aggregate figures only; no personal data beyond what the viewer can already see.

**P27 owner decisions (D-62, approved 2026-11-16):** the product offers a catalogue of summary metrics, two or three per module, each labelled with its module and a short plain description. A metric is shown only while its module is enabled. The admin chooses in society settings which metrics the dashboard shows; the six ANL-1 metrics are on by default (when their module is enabled) and every other metric is off until the admin turns it on. Admins and committee members see the same dashboard, including financial figures, as aggregates only. Trends are monthly for the last 3, 6 or 12 months (default 12); money sections can also show the current financial year (April–March). Figures are totals and buckets only, never lists of units or people, and each section links to its module's screen for detail. Figures are calculated live from the module data each time the page loads (no copied summary tables) and must meet the target scale. Only the admin can export the dashboard as CSV or PDF. The metric catalogue is drafted with the build and reviewed by the owner before release.

**P27 metric catalogue (draft — owner review before release).** ★ marks the six metrics on by default. "Money" metrics can use the current financial year instead of the month range. "Today" metrics are a snapshot and ignore the range.

| Module          | Metric                     | What it shows                                                         | Default | Money |
| --------------- | -------------------------- | --------------------------------------------------------------------- | ------- | ----- |
| core            | Unit occupancy             | Occupied vs vacant units today, and owners vs tenants living in them. |         |       |
| core            | Member sign-ups            | New active members per month.                                         |         |       |
| billing         | Dues ageing                | Unpaid dues grouped by age: 0–30, 31–60, 61–90 and 90+ days.          | ★       |       |
| billing         | Collection trend           | Amount billed vs collected each month.                                | ★       | Yes   |
| billing         | Collection rate            | Share of each month's bills paid in full.                             |         | Yes   |
| expense         | Expense vs income          | Money in vs money out each month.                                     | ★       | Yes   |
| expense         | Spend by category          | Where the money went, by expense category.                            |         | Yes   |
| service_request | Request SLA performance    | Requests resolved within vs after their SLA each month.               | ★       |       |
| service_request | Open requests              | Requests still open, by category.                                     |         |       |
| service_request | Time to resolve            | Average days from raised to resolved, per month.                      |         |       |
| amenity         | Amenity use                | Confirmed bookings per amenity over the selected months.              | ★       |       |
| amenity         | Booking cancellations      | Cancelled vs confirmed bookings per month.                            |         |       |
| visitor         | Visitor trends             | Visitor entries per month.                                            | ★       |       |
| visitor         | Busy gate hours            | Visitor entries by hour of day over the selected period.              |         |       |
| delivery        | Deliveries                 | Deliveries received per month.                                        |         |       |
| delivery        | Uncollected deliveries     | Deliveries still waiting at the gate today.                           |         |       |
| staff           | Staff attendance           | Share of expected staff days marked present, per month.               |         |       |
| staff           | Active staff               | Active staff by type.                                                 |         |       |
| housekeeping    | Supplies used              | Housekeeping supplies issued per month.                               |         |       |
| housekeeping    | Low stock                  | Items at or below their reorder level today.                          |         |       |
| amc             | Contracts expiring         | AMC contracts ending in the next 60 days.                             |         |       |
| amc             | AMC renewal bands          | AMC contracts in the society's Urgent and Due Soon windows today.     |         |       |
| amc             | Service visits             | AMC visits completed per month.                                       |         |       |
| notice          | Notices published          | Notices published per month.                                          |         |       |
| notice          | Notice read rate           | Average share of recipients who opened a notice, per month.           |         |       |
| directory       | Registered vehicles        | Active vehicles by type.                                              |         |       |
| directory       | Vehicles awaiting check    | Vehicles waiting for verification today.                              |         |       |
| tenancy         | Move-ins and move-outs     | Completed move-ins vs move-outs per month.                            |         |       |
| tenancy         | Pending tenancy requests   | Move requests waiting for a decision today.                           |         |       |
| document        | Documents added            | Documents published per month.                                        |         |       |
| document        | Document downloads         | Document downloads per month.                                         |         |       |
| parking         | Parking occupancy          | Allocated vs free parking slots today.                                |         |       |
| parking         | Parking reports            | Parking complaints raised vs resolved per month.                      |         |       |
| sos             | Emergency alerts           | SOS alerts raised per month.                                          |         |       |
| sos             | Alert response time        | Average minutes until an alert was acknowledged, per month.           |         |       |
| vendor          | Purchase requests          | Purchase requests by status.                                          |         |       |
| vendor          | Approved purchases         | Value of approved purchases per month.                                |         | Yes   |
| patrol          | Patrol completion          | Checkpoints scanned vs missed per month.                              |         |       |
| patrol          | Incidents                  | Incidents per month by severity.                                      |         |       |
| metering        | Utility consumption        | Consumption per meter type per month.                                 |         |       |
| metering        | Readings awaiting approval | Resident readings waiting for an admin today.                         |         |       |
| asset           | Assets                     | Active assets by category.                                            |         |       |
| asset           | Warranties expiring        | Assets whose warranty ends in the next 90 days.                       |         |       |
| home_services   | Service providers          | Visible providers by category.                                        |         |       |
| home_services   | Provider ratings           | Average rating and number of ratings per category.                    |         |       |
| poll            | Votes held                 | Votes completed per month.                                            |         |       |
| poll            | Voting turnout             | Average turnout of completed votes, per month.                        |         |       |
| meeting         | Meetings held              | Meetings held per month by type.                                      |         |       |
| meeting         | Meeting attendance         | Average share of invitees present, per month.                         |         |       |
| meeting         | Action items               | Open, overdue and done action items today.                            |         |       |

#### 5.10.13 Later-wave modules and enhancements (P5)

- **Asset Register (`asset`, P5-1):** common assets (lifts, pumps, generators, CCTV) with location, purchase/warranty details, AMC link and maintenance history.
- **Resident Community & Marketplace (`community`, P5-2):** moderated discussion groups, buy/sell/give-away and lost-and-found listings; admin moderation, reporting and removal; no payments.
- **Events & RSVPs (`event`, P5-3):** event announcements, RSVP with guest count, optional contribution recorded as a billing charge when enabled.
- **Home-Services Directory (`home_services`, P5-4):** society-curated local service providers (plumber, electrician) with resident ratings; no provider logins or bookings.
- **SLA escalation (P5-5, `service_request`):** requests past their SLA escalate to the next level (admin → committee, D-59) at configurable intervals.

**Owner decisions (2026-11-16, D-57 to D-59):**

- **Asset Register (D-57):** each society defines its own asset categories. Admins add and edit assets; committee members can view; residents and guards cannot see the register. Maintenance history combines entries recorded by hand with AMC service visits, which are shown only when `amc` is enabled. No depreciation.
- **Home-Services Directory (D-58):** admins add providers directly; committee members can suggest a provider, which becomes visible to residents only after an admin approves it. Residents rate a provider 1–5 stars, one rating per resident per provider, which they can change, with an optional short comment; an admin can hide a comment. Other residents see comments without names; admins and committee members see who wrote each rating. A hidden comment still counts in the average, but its text is visible only to admins and to the resident who wrote it.
- **SLA escalation (D-59):** when a request misses its SLA it escalates to admins; if it is still open after a further number of days (default 2, set per category) it escalates to the committee. Escalation runs with the existing daily job, so steps count in whole days. Every escalation always creates an in-app notification; each society's admin chooses whether an email is also sent (so the choices are in-app, or in-app plus email), so a failed email never loses an escalation. If a society has no committee members, the committee escalation is still recorded and nobody is notified. Each escalation adds an entry to the request's timeline, and the resident who raised the request can see that it was escalated (no separate notification and no recipient names). There is no assignee step: escalation starts with admins. The committee wait counts from the day the request escalated to admins.

**Owner decisions (2026-11-17, D-63):**

- **Events & RSVPs (D-63):** see §5.10.13 for the approved event and RSVP rules, including audience-change withdrawals, full refunds and notifications.

**Owner decisions (2026-11-17, D-64):**

- **Resident community & marketplace (D-64):** see §5.10.13 for the approved moderation, mute, listing expiry and notification rules.

- **Multi-language (P5-6, Core; D-66):** English and Hindi for all society-facing screens, including resident, guard, admin, committee and housekeeping supervisor journeys, login/registration, account settings, navigation, validation, error/empty states and accessibility labels. Regional-language delivery needs a later owner decision. User-entered content, names, addresses and identifiers are not translated or transliterated.

**P33 owner decisions (2026-11-17, D-66; approved scope, not implementation):**

- **Boundaries:** developer console and technical logs, public marketing/privacy pages and the synthetic demo remain English. Stored in-app notification text, push messages, emails including authentication emails, PDFs, CSV exports and printed documents remain English in this build. Translate surrounding controls and explain English-only outputs where needed; never rewrite historical messages or documents.
- **Selection:** default English, with no automatic browser-language switching. A visible selector before login and in account settings offers English and, when allowed by D-67, Hindi. Save a signed-in person's preference to their profile across devices, roles and societies. Keep an explicit signed-out/shared-gate device choice separately; it must not overwrite another guard's account preference. Keep the current page; confirm before switching with unsaved form changes. If saving fails, retain the previous language and show a clear error.
- **Formatting:** use 0-9 digits, Indian number grouping, INR/rupee amounts, translated month names and a 12-hour clock. Preserve existing society time-zone rules, calculations, stored values, identifiers and technical error/reference codes.
- **Translation and resources:** locally AI-drafted, plain Hindi is approved for local/beta review, not professionally reviewed or approved for live societies. Use typed dictionaries and existing React/Intl tools, a forward-only profile-preference migration and existing settings/routes. Official locally bundled Noto Sans Devanagari font files with their SIL Open Font License 1.1 are approved. No new npm dependency, translation vendor, paid service or route structure is approved. Missing translations must fail checks, not silently fall back to English.
- **Release boundary:** owner language review and explicit approval are required before enabling Hindi for live societies. Implementation, commits, pushes and hosted migrations still require their own approval.
- **Language availability gate (D-67):** English is always available. Hindi requires both the developer-enabled Language Support module and an admin-enabled society setting; both are off by default. Admins can change the society setting, while committee members can only view it. Disabling either gate makes signed-in society screens use English without changing saved preferences. Signed-out device choice remains separate.

- **Multi-society overview and operators (P5-7, Core) — deferred (D-65):** not planned for now; the need is not yet confirmed. The scope options and open questions are kept in [deferred-features.md](roadmap/deferred-features.md#multi-society-overview-and-operators-was-p34). Users with memberships in several societies keep using the existing society switcher (DESIGN 11.2).

**P35 core additions (D-71 approved 2026-11-20 for P35.1–P35.7 and P35.13):**

- `CORE-19` Society reference profile: name, address, city, contact email and contact phone are shown from the existing society record, not copied; one profile record per society stores only the new reference fields. Missing values show "Not added", never zero. Admins edit the profile; committee members see ordinary fields, including office-bearer names. Society PAN, bank identifiers and office-bearer personal mobile numbers are admin-only. Bank details are limited to bank name, last four account digits and IFSC; no full bank account number or unsupported value is collected.
- `CORE-20` Office bearers: admins type the chairman, secretary and treasurer names and mobile numbers; the mobiles are admin-only.
- `CORE-21` Advisory setup checklist: the required fields are name, society type, registration number and date, address, city, state, PIN, official email, phone and financial-year start. Registration authority, statutory members and auditor are required only when the society type is Co-operative housing society. The checklist never blocks any action.
- `CORE-22` Capability adoption tracker: one row per Homeish module from the module registry, with status (Not started, Exploring, In use, Mastered), priority (High, Medium, Low), responsible owner, review date and notes. Admins edit; committee members read. It does not track usage, enable or toggle modules, or grant access.
- `CORE-23` Action plans: a society may have many named, standalone action plans; admins and committee members create, edit and see all of them. A new plan may optionally start from a sample plan of the toolkit Foundation/Systems/Growth tasks, all editable. A task owner may be any active society member, including residents; an owner who is not an admin or committee member can only view their own assigned tasks (view-only). Assigning a task sends the owner an in-app notification; there are no overdue alerts. Evidence links continue to obey the source file's existing access rules.
- `CORE-24` Help: about 25 app-authored articles in English and Hindi, searchable and filtered by role and module, covering only features that are built and enabled for the society. Hindi articles are shown only when Hindi is available to the society (D-67); otherwise English only. There are no personal notes, new CMS or search service.
- `CORE-25` Letters: admins and committee members can make 11 letter types: dues reminder, dues final notice, member welcome, complaint acknowledgement, rule-violation warning, hall booking confirmation, vendor work order (from P47 work orders), water/power shutdown, general circular, festival/event announcement and annual newsletter. Each letter is pre-filled only from records that user may already see, its text is editable before download, and it is previewed and then downloaded as an English PDF using the existing PDF rendering. The PDF is not stored and no sending channel is added; a log entry records who made which letter type, for which record and when.
- `CORE-26` Dues reminders and final notices use neutral, factual wording with no penalties or legal threats. Any other statutory or rights-affecting wording needs separate legal approval before use.

**P53 core additions (D-71 approved 2026-11-20 for P53.2–P53.3):**

- `CORE-27` Member contact log: admins and committee members record contacts that are not service requests: date, optional unit, type (query, complaint, request, information, feedback, other), channel (in person, phone, email, letter, WhatsApp, other), direction, a short summary of up to 300 characters, the admin or committee member who handled it, an optional follow-up date and status (Open, Follow-up, Closed), with an optional link to an existing service request instead of a copy. Any admin or committee member can edit any entry; residents never see it. Changes are audited. An entry is not proof that a message was delivered or received. Entries are deleted three years after they are closed.
- `CORE-28` Communication dashboard: a separate admin and committee page, not a P27 metric, showing one month's figures counted only from app records: notices posted, removed and planned; meetings scheduled; events published; SOS alerts raised; service requests received and resolved with average days to resolve (P49.3 definitions); and contacts logged, closed, open and follow-ups overdue. Sections for disabled modules are hidden. No totals are typed in, and channels the app does not store (WhatsApp, paper notices) are not counted.

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
| NFR-13 | Localization       | MVP English only **[A-24]**; P33 adds English/Hindi for the scope in D-66 with the D-67 availability gates. Additional regional languages need a later owner decision.                                                                                                                                            |
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
| Billing P38: payment plans, recovery actions and as-of report      | –            | CRUD            | R                                                                                | –              | –             | –              | –              | –                   |
| Vendor/contract additions (P47)                                    | –            | CRUD            | R                                                                                | –              | –             | –              | –              | –                   |
| Society reference profile (P35)                                    | –            | CRUD            | R (ordinary fields only)                                                         | –              | –             | –              | –              | –                   |
| Capability adoption register (P35)                                 | –            | CRUD            | R                                                                                | –              | –             | –              | –              | –                   |
| Committee action plans (P35)                                       | –            | CRUD            | CRUD                                                                             | R own task     | R own task    | R own task     | R own task     | R own task          |
| Searchable help (P35)                                              | –            | R               | R                                                                                | R              | R             | R              | R              | R                   |
| Correspondence drafts (P35)                                        | –            | C (CORE-25)     | C (CORE-25)                                                                      | –              | –             | –              | –              | –                   |
| Notice drafts, scheduling and planning fields (P53)                | –            | CRUD            | CRUD own notices                                                                 | –              | –             | –              | –              | –                   |
| Member contact log (P53)                                           | –            | CRU             | CRU                                                                              | –              | –             | –              | –              | –                   |
| Communication dashboard (P53)                                      | –            | R               | R                                                                                | –              | –             | –              | –              | –                   |
| **Service request**: create                                        | –            | C               | –                                                                                | –              | –             | C own          | C own          | C own               |
| SR: assign/update status                                           | –            | CRUD            | R                                                                                | –              | –             | –              | –              | –                   |
| SR: view                                                           | –            | R all           | R all                                                                            | –              | –             | R own + common | R own + common | R own + common      |
| SR: rate/reopen                                                    | –            | –               | –                                                                                | –              | –             | U own          | U own          | U own               |
| SR: log for a unit, set intake source (P49)                        | –            | C               | –                                                                                | –              | C             | –              | –              | –                   |
| SR: put on hold, change priority (P49)                             | –            | U               | –                                                                                | –              | –             | –              | –              | –                   |
| SR: daily common-area check (P49; admins manage points)            | –            | CRUD            | R                                                                                | U              | U             | –              | –              | –                   |
| **Staff**: register/manage                                         | –            | CRUD            | R                                                                                | R (entry only) | –             | C/R own staff  | C/R own staff  | R own staff         |
| Staff: mark entry/exit                                             | –            | U               | –                                                                                | U              | –             | –              | –              | –                   |
| Staff: performance notes (P48, society staff)                      | –            | CRUD            | R                                                                                | –              | –             | –              | –              | –                   |
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

### 8.3 Portals and apps

Homeish follows a "web portal for everyone, app for daily tasks" pattern (inspired by MultiSchoolERP, noted 2026-11-15):

| Surface                           | Who uses it                                           | Status                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Developer console (web)           | `developer` (SuperAdmin)                              | Built; separate login and URL (CORE-4, D-04)                                                                                                     |
| Society portal (web, installable) | Admin, committee, HK supervisor, residents and guards | Built; one responsive installable web app (D-23)                                                                                                 |
| Homeish Android app (future)      | Residents and guards                                  | Reference draft only; one app with screens chosen by role, wrapper first and native only if needed (IMPLEMENTATION_PLAN, "Future — Android App") |

The web portal remains the complete product for every role. The Android app is not committed until the owner changes D-23.

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
| A-13 | Vendors and contracts: vendor details, general contracts, AMC schedule, agency staff-day checks, work orders and bills owed (P47)   |
| A-14 | Dues additions: payment-plan tracker, internal recovery follow-ups and as-of collection report (P38)                                |
| A-15 | Society reference profile, capability-adoption tracker and committee action plans (P35)                                             |
| A-16 | Searchable app help and authorized correspondence preview/download (P35)                                                            |

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
| PriorityTarget, InspectionPoint       | see 5.4 (SRQ-11, SRQ-19)                                                                                                                                                                                   | service_request  |
| RoundCheck, EscalationResponse        | see 5.4 (SRQ-16, SRQ-19)                                                                                                                                                                                   | service_request  |
| Staff, StaffUnitLink, StaffAttendance | see 5.5                                                                                                                                                                                                    | staff            |
| StaffPerformanceNote                  | see 5.5 (STF-15)                                                                                                                                                                                           | staff            |
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

Expansion waves P3–P5 (D-38, Section 3 and Section 5.10): expenses, directory, tenancy, documents, parking, SOS; then polls, meetings, vendors, patrol, metering, analytics; then asset register, community, events, home services, SLA escalation and multi-language. The multi-society view is deferred (D-65).

### 14.3 Explicitly Out of Scope (until you request)

- Native iOS/Android apps (unless D-23 changes it)
- Full double-entry accounting (general ledger, trial balance, balance sheet), budgeting, payroll, and paying vendors from within the app (D-39 limits `expense` to simple bookkeeping)
- In-app SaaS subscription billing for societies
- Hardware integrations (intercom, boom barriers, RFID, ANPR, CCTV)
- Offline mode (unless D-25 changes it)
- SMS, WhatsApp or phone-call alerts, including for SOS (D-41)
- Payments inside the marketplace or events
- Vendor/technician/service-provider logins
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
| A-10 | Frequent visitors are P2 (delivered in MVP+ 2026-11-14)                                                                                           |
| A-11 | Any approver for the unit can approve; first response wins                                                                                        |
| A-12 | Blacklist only warns the guard (does not auto-block)                                                                                              |
| A-13 | Unit-level delivery preference setting                                                                                                            |
| A-14 | Delivery pre-announce is P2 (delivered in MVP+ 2026-11-14)                                                                                        |
| A-15 | Payments allocated to oldest dues first                                                                                                           |
| A-16 | Advance payments kept as credit                                                                                                                   |
| A-17 | Bills immutable once published; corrections via adjustments                                                                                       |
| A-18 | Vendors are text records, not users                                                                                                               |
| A-19 | Domestic staff add flow requires admin approval by setting; default is required, and matching profiles require review before linking              |
| A-20 | Per-day staff block is P2; the block applies only to the requesting resident's unit                                                               |
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
| A-36 | Expansion modules link to other optional modules only when those are enabled; none requires another optional module                               |

---

## 17. Decisions Requiring Your Approval

Items marked **High** block design/build of the affected module; resolve them before that module starts.

| ID   | Decision                                          | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Priority |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D-01 | Product name                                      | **Approved 2026-11-09:** Homeish, tagline "A little more like home." (chosen the same day because the originally requested `.vercel.app` address was unavailable; existing logo mark kept)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Closed   |
| D-02 | MVP module set & order                            | **Approved 2026-11-09:** Core + Visitor + Delivery + Billing + Service Request; Staff/HK/AMC next                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed   |
| D-03 | Login method                                      | **Approved 2026-11-09:** email + code now; mobile OTP, passwords and Google later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed   |
| D-04 | Developer login security                          | **Approved 2026-11-09:** email + password + TOTP MFA, separate route                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Closed   |
| D-05 | Resident onboarding                               | **Approved 2026-11-09:** email invite or society-code request with admin approval                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed   |
| D-06 | Notification channels in MVP                      | **Approved 2026-11-09:** in-app + push + email; SMS/WhatsApp post-MVP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Closed   |
| D-07 | Suspended society behavior                        | **Approved 2026-11-09:** read-only access                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Closed   |
| D-08 | SaaS subscription billing in-app                  | **Approved 2026-11-09:** no in-app billing; invoice outside Homeish                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-09 | Error tracking approach                           | **Approved 2026-11-09:** Sentry plus Homeish ErrorLog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Closed   |
| D-10 | No-response visitor policy                        | **Approved 2026-11-09:** guard may allow by society setting, with a required reason and audit entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-11 | QR vs code for pre-approvals                      | **Approved 2026-11-09:** QR and the same readable 6-digit code in MVP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Closed   |
| D-12 | Billing calculation methods                       | **Approved 2026-11-09:** fixed per unit, per sq ft, custom per unit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-13 | Late fee rule                                     | **Approved 2026-11-09:** fixed amount or percentage after grace period; no compounding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Closed   |
| D-14 | Payment gateway                                   | **Approved 2026-11-09:** none in MVP; UPI direct to society, admin confirms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Closed   |
| D-15 | Funds flow (society account vs platform)          | **Approved 2026-11-09:** direct to the society's UPI account                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Closed   |
| D-16 | Gateway fee bearer                                | Not applicable in MVP (no gateway)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Closed   |
| D-17 | Common-area requests visibility                   | **Approved 2026-11-09:** all residents may read; no resident edits or comments in MVP; upvoting delivered in MVP+ 2026-11-14                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Closed   |
| D-18 | ID proof handling for staff                       | **Approved 2026-11-09:** optional ID type + last four digits; no full document                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Closed   |
| D-19 | Payroll for society staff                         | **Approved 2026-11-09:** out of scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Closed   |
| D-20 | Housekeeping = inventory only                     | **Approved 2026-11-09:** stock tracking only; no cleaning schedules or QR area logs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-21 | Add Notice Board module                           | **Approved 2026-11-09:** include as P2-4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Closed   |
| D-22 | Add Amenity Booking module                        | **Approved 2026-11-09:** include as optional P2-5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed   |
| D-23 | Client platform                                   | **Approved 2026-11-09:** installable web app (PWA) for all roles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Closed   |
| D-24 | Tenancy model                                     | **Approved 2026-11-09 (with stack approval):** shared database, separated per society                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Closed   |
| D-25 | Offline support for guards                        | **Approved 2026-11-09:** not in MVP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-26 | Committee approval for waivers                    | **Approved 2026-11-09:** admin-only by default; optional society setting enables committee approval                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-27 | Developer impersonation                           | **Approved 2026-11-09:** no impersonation or view-as access                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Closed   |
| D-28 | Message provider                                  | **Approved 2026-11-09:** Brevo for email now; SMS provider decided later (post-MVP)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-30 | Guard identification in shared gate-account mode  | **Approved 2026-11-09:** RWA admin chooses per society: pick name or personal PIN                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed   |
| D-31 | Protection of society UPI details                 | **Approved 2026-11-09:** admin edits; audited; admins and committee notified; residents see last-changed date                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Closed   |
| D-32 | How a UPI payment is marked paid                  | **Approved 2026-11-09:** resident submits UTR (optional screenshot); admin confirms or rejects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Closed   |
| D-33 | First-ten society offer                           | **Approved 2026-11-09:** first ten live societies pay no Homeish subscription; production hosting remains separately funded; decide later pricing before society eleven is invited                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Closed   |
| D-34 | Public website, society subdomains and beta       | **Approved 2026-11-09:** public marketing root; interactive synthetic demo with periodic resets; future society subdomains, Maplewood address reserved but disabled, onboarding via the create-society script (post-MVP); separate beta Vercel project/branch; beta-to-main release flow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Closed   |
| D-35 | Percentage late-fee precision and limit           | **Approved 2026-11-10:** allow up to two decimal places, greater than 0% and capped at 100%; fixed fees use whole paise; late fees remain off by default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Closed   |
| D-36 | Billing due date and area-charge rounding         | **Approved 2026-11-10:** each society chooses a due day (1–31 or last day of the month) and rounds per-square-foot charges to the nearest rupee or paise, half up; defaults are the 10th and nearest rupee                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Closed   |
| D-29 | Dues ownership on tenant/owner change             | **Approved 2026-11-09:** balance stays with the unit and is billed to the current owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Closed   |
| D-37 | Staff registration, gate and block behavior       | **Approved during P12 kickoff:** approval required by default; matching profiles create a pending link; day blocks are unit-only; guards do not see phone or ID details; entry/exit is explicit with one open attendance; society shifts are one status per person/date                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Closed   |
| D-38 | Expansion module roadmap                          | **Approved 2026-11-14:** add the P3 (must-have), P4 (high value) and P5 (good to have) waves in Section 3/5.10; build may run in parallel with pilot hardening; no expansion module is enabled for a live society before the pilot go-live gates close                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Closed   |
| D-39 | Expenses & accounts depth                         | **Approved 2026-11-14:** simple bookkeeping (expenses, receipts, cash/bank books, income-vs-expense reports); no double-entry ledger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Closed   |
| D-40 | Polls & voting source                             | **Approved 2026-11-14:** port Civic Pulse's voting rules, privacy design, lifecycle and exports into a native `poll` module on Homeish's shared database; Civic Pulse continues as a standalone product                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Closed   |
| D-41 | SOS delivery channels                             | **Approved 2026-11-14:** in-app notifications and Realtime only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Closed   |
| D-42 | Voting entitlement                                | **Approved 2026-11-14:** one vote per unit by its designated representative; tenant voting is a society setting, off by default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Closed   |
| D-43 | Phase-kickoff decisions for each expansion module | Open: resolved at the start of each phase (IMPLEMENTATION_PLAN Section 2.4 and each phase's "Kickoff decisions"), as was done for P12–P15                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | High     |
| D-44 | P16 expenses & accounts kickoff decisions         | **Approved 2026-11-14:** standard categories; cash and one or more bank accounts with opening balances; committee approval over ₹50,000 (society-configurable); closed months locked and admin reopen with audited reason; financial year 1 April–31 March                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Closed   |
| D-45 | P17 directory kickoff decisions                   | **Approved 2026-11-14:** residents see name/unit by default, phone hidden unless opted in; guard vehicle lookup shows unit but no phone; no per-unit vehicle cap; deactivate at move-out and erase personal directory data after one year, retaining required audit records                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Closed   |
| D-46 | Emergency-contact visibility                      | **Approved 2026-11-14:** active household, admin and committee may view contacts; guards cannot view contacts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Closed   |
| D-47 | P17 directory follow-up policies                  | **Approved 2026-11-14:** admin/committee may see verified phone data despite resident-directory opt-out; committee is read-only; Core occupancy end deactivates directory access immediately and the one-year purge clock uses recorded `ended_at`; use the standard authenticated-action lookup rate limit; add database-side pagination because maximum society size is unknown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed   |
| D-48 | Directory records on an in-society unit move      | **Approved 2026-11-14:** transfer active vehicles and emergency contacts to the new unit with audited changes; clear vehicle verification for re-verification; keep visibility preferences attached to the person                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed   |
| D-49 | Homepage delivery and deferred demo connection    | **Approved 2026-11-15:** implement H1 and H2 locally; defer separate demo setup until the product is ready, then connect it in a separately authorised task. Until then, show a disabled **Try demo** button with **Demo coming soon**, no demo URL and no inline substitute. Preserve host boundaries. Owner subsequently approved the delivered copy and three synthetic screenshots; real-device/manual acceptance and release remain pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed   |
| D-50 | P18 tenancy workflow, privacy and five-hour scope | **Approved 2026-11-15:** T1 first, then complete verified P18 slices within five hours, local only. Rental agreement required; police proof configurable/off by default; no government ID copies; private 5 MiB PDF/JPG/PNG with the access/retention policy in §5.10.3. Admin approval schedules; admin actual completion changes Core occupancy. Any one active owner consents to move-in, no bypass; no separate consent for move-out. No move fees/deposits. Positive dues block completion/NOC with Billing enabled, no override; disabled Billing is explicitly not checked. Approve the NOC template and 30/7/0-day in-app expiry reminders above.                                                                                                                                                                                                                                                                                                                       | Closed   |
| D-51 | P19 document repository kickoff decisions         | **Approved 2026-11-15:** see §5.10.4. Seeded admin-managed folders with per-folder audience; PDF/JPEG/PNG up to 5 MB; every download audited; no resident uploads; unit documents for all occupants or owners only; tenancy NOCs read-only; versions kept, archive never delete; signed links.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Closed   |
| D-52 | P20 parking kickoff decisions                     | **Approved 2026-11-15:** see §5.10.5. Car/two-wheeler/visitor/EV slots; unlimited allocation, no fees; FIFO waitlist per type with audited skip reason; optional directory vehicle links under the capacity rule; visitor passes up to 24 hours linked to visitor entries; reports notify the matched unit and admins; photos kept 3 days by default (1–90).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Closed   |
| D-53 | P21 SOS kickoff decisions                         | **Approved 2026-11-15:** see §5.10.6. Residents and guards raise; configurable recipients (guards and admins on, committee off, residents off/floor/block/society); in-app and Realtime only (D-41); persistent banner and 30-second guard sound; audited acknowledge/update/close with reasons; raiser cancel before acknowledgement; one open per unit and three per unit per hour; seeded India emergency contacts; no shift concept.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Closed   |
| D-54 | P24 vendors and purchase approvals decisions      | **Approved 2026-11-16:** see §5.10.9. 1 quote below ₹25,000, 3 from ₹25,000 (society settings) with audited admin override; 0–5 committee approvals (default 1), 0 means admin approves alone; requester never approves; 1–5 star ratings visible to admin and committee.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Closed   |
| D-55 | P25 guard patrol decisions                        | **Approved 2026-11-16:** see §5.10.10. Printable A4 QR sheet with typed codes; built-in browser QR reader, no new library; rounds per shift with grace period and missed-checkpoint flags; low/medium/high/critical severity, high and critical notify admins immediately; up to 3 photos per incident kept 90 days (30–365).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Closed   |
| D-56 | P26 utility metering decisions                    | **Approved 2026-11-16:** see §5.10.11. Water, electricity, DG and gas meters per unit or common area; flat rate per meter type (slabs later); admins and guards record, residents submit with photo for admin approval; monthly cycle, approved readings billed once, automatically with bill generation, on a separate rounded utility bill.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Closed   |
| D-57 | P28 asset register decisions                      | **Approved 2026-11-16:** see §5.10.13. Society-defined categories; admin edits, committee views, residents and guards cannot see; history is manual entries plus AMC visits when `amc` is enabled; no depreciation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-58 | P31 home-services directory decisions             | **Approved 2026-11-16:** see §5.10.13. Admins add providers; committee suggestions need admin approval; residents rate 1–5 stars once per provider (editable) with an optional comment that an admin can hide; raters named to admins and committee only; hidden text admin and author only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Closed   |
| D-59 | P32 SLA escalation decisions                      | **Approved 2026-11-16:** see §5.10.13. Missed SLA escalates to admins, then to committee after N more days (default 2, per category) on the daily job; always in-app, admin may add email; timeline entry visible to the requester.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Closed   |
| D-60 | P22 polls and voting decisions                    | **Approved 2026-11-16:** see §5.10.7. Primary occupant (else earliest owner) represents the unit, changeable by admin or owner with audit; tenant voting from the society setting, overridable per draft vote, frozen at schedule or immediate activation; whole society or chosen blocks; NOTA; live public totals; deadline extension, early completion and cancellation with reasons; committee turnout counts only while open; no emails in exports; in-app notifications; per-person records deleted after 2 years, totals kept; load test 500 units and 100 concurrent voters.                                                                                                                                                                                                                                                                                                                                                                                            | Closed   |
| D-61 | P23 meetings and AGM decisions                    | **Approved 2026-11-16:** see §5.10.8. AGM/SGM invite all units and committee meetings invite committee members by default, editable by blocks, floors or units; notice periods are society settings with a warning only; quorum percentages are society settings shown as an indicator; admin-recorded attendance, proxies counted, admin-controlled resident self check-in; manual resolution outcomes plus optional `poll` link; committee drafts minutes, admin publishes, PDF to `document` when enabled; action-item owner scope is a society setting; in-app plus push; records kept permanently.                                                                                                                                                                                                                                                                                                                                                                         | Closed   |
| D-62 | P27 analytics dashboard decisions                 | **Approved 2026-11-16:** see §5.10.12. Catalogue of 2–3 metrics per module chosen by the admin (ANL-1 six on by default); committee sees financial aggregates; monthly 3/6/12-month trends plus current financial year for money; totals and buckets only with links to module screens; live calculation; admin-only CSV/PDF export; catalogue reviewed by the owner before release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Closed   |
| D-63 | P30 events and RSVPs decisions                    | **Approved 2026-11-17:** see §5.10.13 for the event and RSVP rules, including audience-change withdrawals, full refunds and notifications.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Closed   |
| D-64 | P29 community and marketplace decisions           | **Approved 2026-11-17:** see §5.10.13 for the moderation, mute, listing expiry and notification rules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Closed   |
| D-65 | P34 multi-society overview and operators          | **Deferred 2026-11-17:** the need is not confirmed, so P34 is not planned. The owner's latest preferred scope (a read-only, totals-only overview for existing admins and committee members; no outside operator accounts), the earlier operator options and the open questions are kept in [deferred-features.md](roadmap/deferred-features.md#multi-society-overview-and-operators-was-p34). Revisit only when the owner brings it back.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Deferred |
| D-66 | P33 English/Hindi kickoff scope                   | **Approved 2026-11-17:** see the P33 owner decisions in §5.10.13. Society-facing screens only; English outputs; profile/device preferences; owner review before live Hindi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Closed   |
| D-67 | P33 Hindi availability gate                       | **Approved 2026-11-17:** English is always available; Hindi requires the developer-enabled Language Support module and an admin-enabled society setting, both off by default. Admins manage the setting; committee members read it. Turning either gate off forces signed-in society screens to English without changing saved preferences. Signed-out device choice remains separate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Closed   |
| D-68 | P48 staff-record additions                        | **Approved 2026-11-19:** see STF-13–STF-15 in §5.5. Society staff only; Left shows as blocked; notes written by admins, read by admins and committee, editable with audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Closed   |
| D-69 | P39 accounts additions                            | **Approved 2026-11-19:** see EXP-7–EXP-11 in §5.10.1. Running balances, RV/PV voucher numbers per financial year with one-time numbering of old entries, 30-day reconciliation ageing, an app-user petty-cash custodian with handover counts, and financial-year net flow. No new postings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Closed   |
| D-70 | P49 helpdesk additions                            | **Approved 2026-11-19:** see SRQ-10–SRQ-20 in §5.4. Changes SRQ-1/3/5/6/9 and D-59: four priorities, a category × priority target table, a per-society choice of committee wait, On Hold, reports, feedback, intake source, daily checks and vendor picking. Existing societies keep the per-category committee wait; new societies start per priority.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Closed   |
| D-71 | B2 toolkit additions (P35 core, P38, P47, P53)    | **Owner-approved for Batch 2 implementation:** P47 and P38.2–P38.4; see §§5.3, 5.10.9 and 5.10.13. Includes 60/30-day AMC/contract bands, the seven-day invoice Due Soon window, five-day vendor-terms fallback, capped staff-day deductions, yearly work orders, P16-linked partial payments, AMC visit intervals with no pre-first-visit due date, and P38/P35 access and workflow boundaries. Partly paid overdue bills show both labels. P47 phase details approved 2026-11-19: label-only auto-renew, notice-deadline reminders, split P16 payment links, edit-with-history rules and an added default-off "AMC renewal bands" P27 metric. P38.1 remains blocked pending external review. P38 plans have no in-app approval or financial effect; recovery actions stay internal, and the as-of report excludes advance/unallocated credit. P35 core approved 2026-11-20 (CORE-19 to 26); P35.8–P35.12 stay open. P53 approved 2026-11-20 (NTC-4, NTC-5, CORE-27, CORE-28). | Closed   |

---

## 18. Glossary

- **Society/Apartment**: a residential community managed as one tenant.
- **Unit**: a flat/house.
- **Primary contact**: main person responsible for a unit.
- **Approver**: occupant authorized to approve visitors/deliveries.
- **AMC**: Annual Maintenance Contract.
- **Module**: independently enableable feature area.
- **Reference ID**: code shown on an error to find its log entry.
