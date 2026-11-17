# Deferred Features

This register records capabilities that are outside the current pilot scope. Do not add providers, packages, environment variables, database columns, placeholder implementations, or generic abstractions for these items unless the owner explicitly brings them back into scope.

## Deferred from the pilot

| Capability                                                                               | Pilot status | Repository status and guardrail                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WhatsApp messaging and WhatsApp OTP                                                      | Deferred     | No active implementation or provider package was found. Do not add a provider or placeholder.                                                                                                                                                                                                                 |
| SMS messaging and SMS OTP                                                                | Deferred     | No active implementation was found. Supabase CLI configuration has SMS disabled; do not enable it or add a provider.                                                                                                                                                                                          |
| Phone-based authentication                                                               | Deferred     | Phone fields used for profiles or society workflows are not authentication. Keep sign-in email-based.                                                                                                                                                                                                         |
| Push notifications                                                                       | Deferred     | Web Push code, schema, dependencies, and VAPID configuration already exist and are used by the current application. Do not add more push functionality. Do not delete or silently disable working code; obtain an explicit decision on whether it should remain dormant or be removed/disabled for the pilot. |
| Clerk, Auth0, Twilio, Ably, Pusher, or another authentication, email, or realtime vendor | Deferred     | Supabase Auth, Brevo, and Supabase Realtime remain the approved services. Do not add alternate providers or provider abstractions.                                                                                                                                                                            |
| Redis, Kafka, Kubernetes, or a separate queue/cache service                              | Deferred     | The current application uses PostgreSQL and existing hosting capabilities. Reconsider only for a demonstrated pilot requirement and after owner approval.                                                                                                                                                     |
| Datadog, New Relic, or another paid monitoring service                                   | Deferred     | Continue using Sentry and existing hosting/database monitoring. No paid monitoring service is approved.                                                                                                                                                                                                       |
| Payment processing or payment gateway                                                    | Deferred     | The current billing flow records direct society UPI payments for later admin confirmation; it does not process or move money. Do not add gateway SDKs, webhooks, or payment credentials.                                                                                                                      |
| Paid infrastructure for hypothetical future scale                                        | Deferred     | Prefer existing free tiers for the pilot. A paid service requires a demonstrated need, cost estimate, free alternative, and explicit approval.                                                                                                                                                                |
| Additional email, authentication, or realtime providers                                  | Deferred     | Keep the current providers; no fallback or placeholder provider should be added.                                                                                                                                                                                                                              |

These are scope decisions, not a commitment to implement later. Reconsider an item only when pilot evidence shows a concrete need and the owner approves the scope, privacy/security impact, operational burden, and any cost.

The approved expansion modules (PRD D-38, Section 5.10; IMPLEMENTATION_PLAN P16–P33) are designed within these boundaries. For example, SOS uses in-app and Realtime alerts only, and expenses, events and the marketplace do not move money.

## Deferred product ideas

### Multi-society overview and operators (was P34)

**Status:** deferred 2026-11-17 (PRD D-65, P5-7). The owner is not sure it is needed. Nothing is built, and no database, route or role exists for it. People who belong to several societies already use the existing society switcher. Bring this back only on an explicit owner decision, then re-plan it from the options below.

**Who is involved today.** Admins manage their own society. Committee members have read-only access to what the admin sees. The developer checks errors and logs when an admin or user reports a problem. There is no "operator" role today.

**Scope options considered.** Rough estimates only, made before any detailed design:

| Option                                         | What it means                                                                                                                                                                                                                                | Rough effort                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A. Basic overview                              | Existing admins/committee members with several societies see each society's name, status and enabled modules on one page.                                                                                                                    | 2–3 hours                                                         |
| B. "My societies" overview (latest preference) | Option A plus totals for each society (see the list below). Read-only, totals only, no names or phone numbers. Only societies where the person is already an active admin or committee member. Opening a society uses the existing switcher. | 5–6 hours                                                         |
| C. Outside operator accounts                   | A management company or builder gets an operator account, created by the developer. Each society's admin must consent and can revoke access at any time. Operators see the overview totals only.                                             | Not estimated; needs a new role, consent flow and security review |
| D. Operators with read-only admin screens      | Option C plus read-only access to each consenting society's admin screens.                                                                                                                                                                   | 12+ hours; touches almost every permission check                  |

Owner's decisions so far: an earlier answer chose B, C and D together ("both, with read-only admin screens for operators"). Later, the owner said outside operators are not needed and preferred B. The whole item was then deferred. Treat B as the starting point if this returns.

**Figures the owner selected for option B:** flat and resident counts; pending visitor, community-post/listing and request approvals; open service requests and complaints; billing due and collected this month; enabled modules; open SOS alerts; visitor count today; plus society name and status.

**Open questions to answer before re-planning:**

1. Is there a real user who needs it? Examples include a person who is admin or committee in two or more societies, a property management company, or a builder handing over several societies. How many such users are there?
2. Is the existing society switcher enough, or do they need everything on one page?
3. Should committee members see the overview, or only admins?
4. If outside operators come back (C/D), who creates them, and does each society's admin have to approve and be able to revoke access? Is access logged and visible to the society admin?
5. What may an operator see: totals only, or read-only admin screens that include residents' personal details? Personal data shown across societies needs a privacy review.
6. Does any of this change billing or what a society pays?
7. Which figures matter most if only some are built first? Should a module that is off show "not enabled", never zero? What should a failed count show?

**Guardrails if revived:** reuse the existing memberships and switcher; check access separately for each society on every read; do not bypass tenant isolation with privileged database access; get a database-safety review before release.

## Existing implementation requiring a decision

Web Push conflicts with the current pilot boundary because it was implemented under the earlier product decision. The Phase 1 audit records the overlap in [pilot-readiness-audit.md](../audits/pilot-readiness-audit.md). Until the owner decides otherwise, do not extend it or remove its working functionality.
