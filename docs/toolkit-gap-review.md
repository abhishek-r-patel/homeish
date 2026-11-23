# Homeish toolkit gap review

**D-84 status update:** The deposit terms are now selected for planning as recorded in the decision dashboard below; older “open” wording in historical summaries is superseded. Coding remains separately gated.

**D-85–D-89 status update (2026-11-23, proposed):** Items previously left blocked or future are now planned: GAP-M03-07 handover with the P26 metering handoff (P36.7a–b, D-85); GAP-M01-04 and the M20 compliance items (P43.4) and GAP-M04-05/GAP-M20-04 official case log (P44.5) on an accepted-risk route with optional data cleanup (D-86); GAP-M10-05 full reconciliation and fund targets (P40.8b–c, D-87); GAP-M08-07 bill email and user-started sharing with D-06 unchanged (P37.5, D-88); and GAP-M09-01 interest (P38.1, D-89), with accountant review strongly recommended. Older "blocked" wording for these items in the cards below is superseded; coding remains separately gated.

**D-81 status update (2026-11-23):** P46.1–P46.3 are implemented and locally verified in the uncommitted feature work. Historical M07 wording below that calls official voting blocked remains a record of the original review; it is superseded for implementation status. P46 is not committed, released, owner-UAT-approved or enabled live, and the qualified legal-review recommendation remains open.

Review date: 2026-11-19. Owner-selected scope: housing only, all 22 available housing modules, detail level. M25 and M03 comparisons are complete; the owner accepted all 10 M03 cards for planning, subject to the recorded cross-module gates. M02 comparison is complete and all ten decisions are Defer; the approved plan update records them as backlog. All seven M08 decisions are accepted for planning and recorded in P37. All six M09 decisions are accepted for planning and recorded in P38, with calculation, legal and access gates still open. M11 decisions are complete: six accepted for planning in P39, two conflicts rejected with current behavior confirmed. M10 decisions are complete: all nine items are accepted for planning in P40, including conflict Option B, with implementation gates still open. M12's 12 tools in both editions are compared in eight cards; all eight decisions are accepted for planning and recorded in P41, with conflict choices and implementation gates recorded. M13's 12 tools are compared in eight cards; six decisions are accepted for planning in P42/P40.4, and two conflicts are rejected with current behavior confirmed. On 2026-11-22 the owner changed GAP-M13-01 to Option B (D-83, proposed), adding a limited budget plan (P42.5) that unblocks P41.3 and P42.2. M01's 12 tools are compared in five cards; all five decisions are accepted for planning, including Option B for both conflicts, and recorded in P43. Implementation gates remain open. M04's 12 tools are compared in seven cards (5 NEW, 2 ENHANCEMENT); all seven decisions are accepted for planning and recorded in P44, with implementation gates open. Batch 1 (M06/M07/M20) has 11 accepted planning decisions (2 NEW, 7 ENHANCEMENT, 2 CONFLICT): M06 in P45.1/P43.5, M07 in P46, and all six M20 items in P41.5/P43.4/P44.2/P44.5, with A for both M20 conflicts. Official election voting/result execution remains blocked pending legal verification and dependent approvals. Batch 2 (M14/M15/M16) has 21 decisions (4 NEW, 10 ENHANCEMENT, 7 CONFLICT): M14 in P47, M15 in P48 and M16 in P49; M15-02/M15-03 keep current behavior and payroll (M15-05) is deferred for a possible future Pro version. Batch 3 (M17/M18/M19) has 15 new decisions (4 NEW, 9 ENHANCEMENT, 2 CONFLICT): M17 in P50, M18 in P51 with Option B for both conflicts, and M19 in P52; its settled no-parking-fees choice is not reopened. M18 conditional-clearance legal/contract gates and M19 booking-deposit rules remain open. Batch 4 (M23/M24) has 13 decisions: M23's four are accepted in P53 and P35.13 (M23-04 modified B: separate dashboard derived from app records), and all nine M24 insurance/legal/dispute items are rejected because those matters are handled outside the app. All 22 available housing modules are now compared and decided.

This is the persistent evidence and decision-summary report. [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#toolkit-review-decisions) remains the single authoritative plan and decision register. No toolkit item is approved by its presence here. No application code, schema, migrations or tests will be changed in this review.

Continue later module comparisons in this report. Approved plan previews below are historical records, not another active plan.

Toolkit-source links assume the purchased, read-only toolkit folder sits beside this repository; those files are not included here. Source line references describe the review snapshot and may move as files change.

## Decision dashboard

**D-84 addendum (2026-11-23):** The owner has now selected the GAP-M25-09 deposit lifecycle for planning in P35.8–P35.9. This supersedes older M25/M19 notes below that say the receipt, deduction, refund or cancellation rules remain open. The contracts are proposed, off by default, and still need a separate coding go-ahead; accountant review is recommended before real use.

These are **per-module** counts. M03's 10 merged decisions are accepted for planning; all ten M02 decisions are deferred/backlog with no work planned. All seven M08 decisions are accepted for planning and recorded in P37. All six M09 cards are accepted for planning and recorded in P38. M11's six accepted items and two rejected conflicts are recorded in P39. M10's nine decisions are accepted for planning and recorded in P40. M12's eight decisions are accepted for planning and recorded in P41; its A+B conflict choices are additive, and the M12-03 summary remains conditional. M13's six accepted items and two rejected conflicts are recorded in P42/P40.4. M13-01 changed to Option B on 2026-11-22 (D-83, proposed): a limited post-MVP budget plan in P42.5. Tools 147 and 153 are covered by P41.3 and Tool 148 by P42.2, both now proposed under D-83; Tool 154's monthly actuals are partly covered by P16/P27. Budgets stay out of MVP. M01's five decisions are recorded in P43; implementation gates remain open. M04's seven decisions are accepted for planning in P44; Tools 37 and 48 overlap planned work, and P44's legal/source gates remain open. Tools 86 and 87's primary workflows are covered, not claimed as full workbook parity. All M06/M07/M20 decisions are recorded: M06's two in P45.1/P43.5, M07's three in P46 and M20's six in P41.5/P43.4/P44.2/P44.5. Both M20 conflicts use A: facts only and existing source links, with no risk score or duplicate workflow. M07 official voting/results remain blocked; legal and statutory points must be verified against the state co-operative act / our bye-laws, or the applicable apartment/association framework. Batch 2 decisions are recorded: M14's eight in P47 (B for both conflicts), M15's two accepted items in P48 with M15-02/M15-03 A and payroll deferred, and M16's eight in P49 (B for both conflicts). Batch 3's 15 new decisions are recorded: M17's six in P50, M18's four in P51 (B for both conflicts), and M19's five in P52. M19's settled no-parking-fees choice is not reopened; its booking-deposit rules remain gated. Batch 4's 13 decisions are recorded: M23's four accepted in P53/P35.13 and M24's nine rejected (Tool 167 decided with M24). Every available housing module has now been compared.

| Module                            | Tools assessed                  | NEW | ENHANCEMENT | CONFLICT | Already covered                           | Not relevant                          |
| --------------------------------- | ------------------------------- | --- | ----------- | -------- | ----------------------------------------- | ------------------------------------- |
| M25 Setup, guides and library     | All 12, 289-300                 | 1   | 4           | 5        | 1 tool: 293                               | 1 tool: 294                           |
| M03 Units and ownership records   | All 12, 25-36                   | 5   | 5           | 0        | 0 wholly; several partly covered          | 0                                     |
| M02 Members and share ledger      | All 12, 13-24                   | 6   | 2           | 2        | 0 wholly; several partly covered          | 0                                     |
| M08 Maintenance Billing           | All 12, 85-96                   | 1   | 2           | 4        | Core workflows: 86, 87                    | 0                                     |
| M09 Dues and Arrears              | All 12, 97-108                  | 2   | 0           | 4        | Several partly covered                    | 0                                     |
| M10 Funds                         | All 12, 109-120                 | 4   | 4           | 1        | Partial: Tool 113; Tool 117 base in P39.5 | 0                                     |
| M11 Accounts and Cash Book        | All 12, 121-132                 | 2   | 4           | 2        | Core: 121, 122, 131; partials             | 0                                     |
| M12 Financial Statements          | Both editions, all 12, 133-144  | 2   | 2           | 4        | Partial: 133, 136-144                     | 0                                     |
| M13 Budget & Expense Control      | All 12, 145-156                 | 2   | 3           | 3        | Partial/planned: 147, 150, 153, 154       | 0                                     |
| M01 Dashboards                    | All 12, 1-12                    | 1   | 2           | 2        | Partial/planned: 2, 4-8, 10, 12           | 0                                     |
| M04 Registration, Bye-laws & Docs | All 12, 37-48                   | 5   | 2           | 0        | Planned overlap: 37, 48                   | 0                                     |
| M06 Meetings & AGM                | All 12, 61-72                   | 1   | 1           | 0        | 8 covered/overlapping                     | 2 no standalone addition              |
| M07 Elections & Voting            | All 12, 73-84                   | 0   | 3           | 0        | 2 partly covered                          | 2 not imported as described           |
| M20 Audit & Compliance            | All 12, 229-240 (both editions) | 1   | 3           | 2        | 7 covered/overlapping                     | 0                                     |
| M14 Vendors, Contracts & AMC      | All 12, 157–168                 | 2   | 4           | 2        | 161, 164 covered; 167 decided with M24    | 0                                     |
| M15 Staff & Payroll               | All 12, 169–180                 | 1   | 1           | 3        | 180 partly covered                        | 0                                     |
| M16 Complaints & Helpdesk         | All 12, 181–192                 | 1   | 5           | 2        | 186 covered                               | 0                                     |
| M17 Repairs & Redevelopment       | All 12, 193–204                 | 3   | 3           | 0        | Partial: P40.9 and existing sources       | 0                                     |
| M18 Transfer & NOC                | All 12, 205–216                 | 0   | 2           | 2        | Tenancy-only request/PDF overlap          | Fees/checklists/heir flow not adopted |
| M19 Tenants, Parking & Facilities | All 12, 217–228                 | 1   | 4           | 0        | Visitor 225; P18/P20/P15 partial/core     | 0                                     |
| M23 Notices & Communication       | All 12, 265–276                 | 1   | 2           | 1        | 266–271, 273–275 merged into P35.13       | 0                                     |
| M24 Insurance, Legal & Disputes   | All 12, 277–288, plus Tool 167  | 3   | 4           | 2        | Asset warranty dates already built        | 0 (all nine items rejected)           |

Decision cards are merged capabilities, not always one card per tool: M25 has ten cards, while five guides feed one help item and Tool 300 feeds several distinct decisions; M03 and M02 have ten cards each, M08 has seven cards from twelve tools, M11 has eight cards from twelve tools, M12 has eight cards from twelve tools across both editions, M13 has eight cards from twelve tools, M01 has five cards from twelve tools and M04 has seven cards from twelve tools. Five app-only safeguards for M25 and the M03/M02/M08/M09/M10/M11/M12/M13/M01/M04 safeguards below are not added to toolkit-tool totals.

### Ten most valuable decisions in the M25 batch

| Rank | ID         | Decision in everyday words                                                                            | Recommendation                                                                                              |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1    | GAP-M25-08 | Tenant form asks for ID copies and extra personal details                                             | Accepted A: preserve digital tenancy; add no extra printable information form                               |
| 2    | GAP-M25-03 | Shared setup wording differs from the app; the detailed toolkit calculator uses daily annual interest | Keep current rules now, option A; compare optional additions in M08/M09                                     |
| 3    | GAP-M25-02 | One society reference profile with a missing-information checklist                                    | Accept, with authoritative links instead of duplicated figures                                              |
| 4    | GAP-M25-10 | Tenant move-out / owner-sale clearance and agreed handover of outstanding obligations                 | Accepted E, clarified by M18; conditional NOC is not no-dues; legal and contract gates remain open          |
| 5    | GAP-M25-04 | Freely edited lists could change payment and membership meanings                                      | Accepted A: keep current editors and review substantive new capabilities separately                         |
| 6    | GAP-M25-07 | Reusable printable letters and notices                                                                | Accept a scoped library; exclude unresolved fields/workflows                                                |
| 7    | GAP-M25-09 | Booking letter promises refundable deposits the app does not track                                    | Accepted D: optional deposits, deductions and refunds, off by default; existing fee-only behavior preserved |
| 8    | GAP-M25-05 | Committee's first 90 days as an owned, dated plan                                                     | Accept if a committee needs it; reuse existing action patterns                                              |
| 9    | GAP-M25-06 | Searchable practical help and role-appropriate getting started                                        | Accept; adapt to app workflows, not spreadsheet instructions                                                |
| 10   | GAP-M25-01 | Manual adoption/readiness register                                                                    | Defer unless rollout needs more than existing module toggles                                                |

### Most valuable decisions in the M04 batch

| Rank | ID         | Decision in everyday words                               | Recommendation                                                                              |
| ---- | ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | GAP-M04-06 | House rules with penalties                               | Defer penalty policy until its legal authority and connection to existing fines are settled |
| 2    | GAP-M04-03 | Track a bye-law amendment through Registrar decision     | Accept verified milestone tracking; preserve M06's meeting and approval authority           |
| 3    | GAP-M04-01 | Track society certificates and renewal dates             | Accept reminders linked to P19 documents; do not treat reminders as proof of compliance     |
| 4    | GAP-M04-02 | Find governing documents and specific bye-law references | Accept an index linked to P19; do not duplicate files or present summaries as legal advice  |
| 5    | GAP-M04-05 | Track Registrar letters and reply due dates              | Accept a private, admin-managed log; dates must come from verified correspondence           |
| 6    | GAP-M04-04 | Compare registered bye-laws with a model checklist       | Defer until the applicable state/version and qualified review are confirmed                 |
| 7    | GAP-M04-07 | Guide a society through formal formation                 | Defer until formation scope and a state-specific source are agreed                          |

### Highest-value Batch 1 items (all decisions accepted for planning)

| Rank | ID         | Item                                                                | Recommendation / status                                                                           |
| ---- | ---------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | GAP-M07-02 | Election eligibility, nominations, seats and future official voting | Accepted in P46.2 as blocked future planning; legal verification and dependent approvals required |
| 2    | GAP-M07-03 | Election outcomes, disputes and expense reporting                   | Accepted in P46.3; official result calculations blocked; preserve ballot privacy and accounts     |
| 3    | GAP-M20-01 | Compliance calendar and Registrar filing evidence                   | Accepted in P43.4/P44.5; verify dates and sources; no second register                             |
| 4    | GAP-M20-02 | Auditor appointment, query and report follow-up                     | Accepted in P41.5; legal-case/auditor, field, year and access gates remain                        |
| 5    | GAP-M07-01 | Election schedule, preparation, notices and officers                | Accepted in P46.1; source dates and authority; no duplicate meeting notices                       |
| 6    | GAP-M20-04 | Restricted notices and response tracking                            | Accepted as a P44.5 extension; admin-only, source-linked; no sending or penalties                 |
| 7    | GAP-M06-01 | Agenda time-boxing and reusable agenda templates                    | Accepted for planning in P45.1; no statutory defaults                                             |
| 8    | GAP-M20-03 | Statutory-register maintenance view                                 | Accepted in P44.2; evidence only, not a second store or legal-completeness claim                  |
| 9    | GAP-M06-02 | Read-only meeting-governance summary                                | Accepted for planning as an extension to P43.5; keep source-completeness and audience gates open  |
| 10   | GAP-M20-05 | Compliance risk scoring                                             | Accepted A: factual P43.4 records only; omit risk ratings/scores and keep P27 unchanged           |

### M02 decisions (all deferred; recorded in the plan)

All ten decisions are Defer, dated 2026-11-18, with the shared owner reason and reconsideration trigger recorded in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#toolkit-review-decisions). Options B were selected for GAP-M02-06 and GAP-M02-10; they do not authorize implementation.

| Rank | ID         | Item                                                                                   | Recommendation                                                                 | Owner decision           |
| ---- | ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------ |
| 1    | GAP-M02-01 | Statutory member register, distinct from app access and occupancy                      | Accept only as a separate legal record; approve its fields and authority first | Defer                    |
| 2    | GAP-M02-02 | Share-capital transaction ledger                                                       | Accept only with append-only receipts/accounting and M10/M11 gates             | Defer                    |
| 3    | GAP-M02-05 | Nominee and minor-guardian register                                                    | Accept only after verifying legal meaning, scope and visibility                | Defer                    |
| 4    | GAP-M02-06 | Cessation/refund workflow that could be confused with access deactivation or unit dues | Prefer A: keep the current separation and D-29                                 | Defer; Option B recorded |
| 5    | GAP-M02-08 | Joint/associate membership and potential voting rights                                 | Accept only without changing P22 or inferring rights from occupancy            | Defer                    |
| 6    | GAP-M02-03 | Share-certificate lifecycle                                                            | Accept only when linked to approved member/share records and verified rules    | Defer                    |
| 7    | GAP-M02-07 | Membership entrance/admission/annual fees                                              | Accept only after fee authority and accounting treatment are approved          | Defer                    |
| 8    | GAP-M02-04 | Admission pipeline beyond current app-registration approval                            | Accept only as a separate legal workflow with an authorized decision-maker     | Defer                    |
| 9    | GAP-M02-10 | Member KYC/document-completeness tracker                                               | Prefer A: retain the current no-general-government-ID-copy rule                | Defer; Option B recorded |
| 10   | GAP-M02-09 | Search and aggregate member overview                                                   | Accept scoped search; use only authorized, source-labelled data                | Defer                    |

### M08 decision shortlist (all seven accepted; recorded in P37)

The comparison and owner decisions are complete, and the approved plan update is recorded in P37. These decisions are for planning only, not implementation. The primary workflows in Tools 86 and 87 are covered by Homeish bill generation and PDFs; this is not a claim of full workbook parity.

| Rank | ID         | Item                                                                        | Owner decision                                                                                                                          |
| ---- | ---------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | GAP-M08-04 | Parking/facility charges versus the approved no-parking-fees rule           | Accept Option A: preserve D-52; no parking-fee feature                                                                                  |
| 2    | GAP-M08-05 | Pending/cleared/bounced payment states and when receipts/credits are issued | Accept Option A: preserve current BIL-6/BIL-7 payment modes, states and receipt/ledger behavior                                         |
| 3    | GAP-M08-01 | A percentage-of-maintenance charge basis not included in D-12               | Accept Option B: add it as a fourth per-charge-head method using a named Maintenance base and existing per-charge rounding              |
| 4    | GAP-M08-02 | Charge eligibility by Owner/Tenant occupancy                                | Accept: All includes vacant units; Owner/Tenant eligibility uses occupancy on the first day of the billed month; D-29 remains unchanged |
| 5    | GAP-M08-07 | Bill dispatch/acknowledgement tracking and the toolkit's WhatsApp link      | Accept: keep current behavior now; consider channels later only after separate approval; no delivery ledger now                         |
| 6    | GAP-M08-03 | A standalone area/flat what-if calculator                                   | Accept: read-only estimate from configured charge rules; never create or change a bill                                                  |
| 7    | GAP-M08-06 | Payment-mode, wing, bill-status and advance-credit breakdowns               | Accept: add only read-only missing summaries; preserve D-62 metric limit and existing figures                                           |

### M09 decision shortlist (all six accepted; recorded in P38)

The comparison and owner decisions for Tools 97–108 are complete. All six cards are accepted for planning and recorded in P38; this does not authorize implementation. Tools 97, 99 and 108 largely overlap existing ledger, ageing and dashboard behavior; Tools 101/102's notice scope is already planned in P35.13.

| Rank | ID         | Item                                                                                        | Owner decision                                                                                         |
| ---- | ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1    | GAP-M09-01 | Daily simple interest after due date/grace versus current monthly late fees                 | Accept B: optional future-bill interest; calculation/legal rules and late-fee interaction remain gates |
| 2    | GAP-M09-02 | Defaulter threshold: any overdue bill in Homeish versus 2+ overdue bills in Tool 100        | Accept A: keep the current any-overdue-bill rule                                                       |
| 3    | GAP-M09-03 | Payment-plan tracker                                                                        | Accept: track arrangements only; do not change bills, fees or ledger                                   |
| 4    | GAP-M09-04 | Assigned recovery-action and follow-up history                                              | Accept: internal history only; no sending, legal effect or financial posting                           |
| 5    | GAP-M09-05 | Dispute register and `Interest Hold` effect                                                 | Accept A: no separate tracker; keep existing audited correction paths                                  |
| 6    | GAP-M09-06 | As-of collection-efficiency formula and arrears trend versus current BIL-11/P27 definitions | Accept B: separate read-only report; preserve BIL-11/P27 definitions                                   |

### M11 decision shortlist (all eight decisions recorded in P39)

The comparison and owner decisions for Tools 121–132 are complete; six items are accepted for planning and two conflicts are rejected with current behavior confirmed. Cash/bank books and monthly summaries already exist in Homeish; accepted work adds only the missing details and gated extensions. Tool 129's fund mapping remains a P40.1 kickoff gate and requires accountant review.

| Rank | ID         | Item                                                                                | Owner decision                                                    |
| ---- | ---------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1    | GAP-M11-04 | Journal, general ledger and trial balance versus D-39's simple-bookkeeping boundary | Reject A: keep D-39; no full double-entry accounting              |
| 2    | GAP-M11-03 | Cheque-issued/cleared states versus immediate P16 book posting                      | Reject A: keep current posting; no cheque-clearing tracker        |
| 3    | GAP-M11-05 | Bank reconciliation with aged reconciling items                                     | Accept: a separate register; no automatic book adjustments        |
| 4    | GAP-M11-07 | Fixed-deposit register, including maturity and accrued interest                     | Accept, gated by P40.1 fund mapping and accountant review         |
| 5    | GAP-M11-06 | Petty-cash/imprest view linked to the existing cash account                         | Accept: link to P16; no second manually maintained cash balance   |
| 6    | GAP-M11-01 | Running balance for each cash/bank book entry                                       | Accept: derive from existing entries                              |
| 7    | GAP-M11-08 | Monthly/cumulative surplus-deficit reporting                                        | Accept: derive from posted books; no P27 metric change            |
| 8    | GAP-M11-02 | Human-readable voucher reference/register for existing transactions                 | Accept: numbering and historical-entry rules remain kickoff gates |

### Every money, legal or member-rights conflict found in M25

- **GAP-M25-03:** annual daily simple interest versus monthly late fees, and selectable financial-year start versus April-March defaults. Follow-up found an internal toolkit inconsistency: M25 says bill-date grace, but Tool 98 explicitly uses due-date grace, matching the app's starting point. M25's summary rates must not be mistaken for the full toolkit's capabilities: M08 also supports multiple charge heads. No sample rate is authoritative.
- **GAP-M25-04:** editable payment modes, legal membership labels and meeting types versus validated, permission-sensitive values.
- **GAP-M25-08:** collecting tenant government-ID copies contradicts the explicit D-50 prohibition; occupation/employer, adult/child counts and rent/deposit are also extra personal data.
- **GAP-M25-09:** refundable booking deposits and damage deductions have no corresponding deposit lifecycle in the current amenity contract.
- **GAP-M25-10:** owner requires tenant move-out and owner-sale clearance, with outstanding obligations settled or handed over by agreement accepted by the society. Accepted handover scope includes both cases, subject to M18 review; building this would deliberately change the current no-override positive-dues block. An unpaid balance must not be represented as paid/cleared. Pending-action definitions and Billing-disabled handling remain for M18; current behavior stays in force meanwhile.

For legal/statutory points: **verify against the state co-operative act / our bye-laws**. These conflicts do not mean the app is wrong and are not permission to reopen its approved rules automatically.

### Every money, legal or member-rights conflict found in M02

- **GAP-M02-06:** a legal membership-cessation flow is not the same as revoking app access. Tool 19's manually entered dues and automatic net refund could collide with D-29, which keeps unpaid balances on the unit and bills the current owner. Do not offset a member's share refund against unit dues or change D-29 without a separate approved accounting/legal decision.
- **GAP-M02-10:** Tool 22 proposes collecting Aadhaar, PAN and other member KYC evidence. Current policy prohibits government-ID copies; D-50 is a narrow tenancy exception and explicitly does not permit general identity-document collection.
- **GAP-M02-01/03/04/06/08/09:** statutory membership, shareholding, certificate issuance, nominees, joint/associate status and their voting or transfer effects require legal and bye-law review. App access/occupancy and P22's one-vote-per-unit rule are not proof of those rights. Tool examples and statuses are not legal requirements.
- **Money safeguards across GAP-M02-02/07/08:** share transactions, refunds and membership fees must not be presented as confirmed receipts, unit-bill credits or expense postings from typed tracker values. Apply the accepted M10/P40 and M11/P39 source-of-truth boundaries and require authoritative transaction evidence before designing a ledger or reconciliation.

Legal/statutory points: **verify against the state co-operative act / our bye-laws**. All M02 items are deferred; these findings and safeguards do not authorize implementation or change current policy.

### Every money, legal or member-rights conflict found in M08

- **GAP-M08-01:** a percentage-of-maintenance calculation adds a fourth billing basis beyond D-12's approved fixed/per-sq-ft/custom methods. The toolkit's guide says to calculate against Maintenance Charges, but Tool 85's reference describes `Basis` as only Per Sq Ft/Fixed Per Unit, mislabels the `Rate` choices, and the original workbook's percentage formula points at the first charge row. Do not copy the workbook formula without defining the named base and rounding.
- **GAP-M08-04:** recurring parking/facility fees conflict with D-52's approved no-fees parking allocation. P15 permits fees for booked amenities only; that is not authority for parking-slot charges.
- **GAP-M08-05:** toolkit `Pending/Cleared/Bounced` clearance states and payment modes do not match BIL-6/BIL-7. In Homeish, only confirmed payments create ledger credit and receipts; adding clearance states could change when money is recognized and require bounced-payment correction rules.
- **GAP-M08-07:** a bill dispatch tracker includes WhatsApp and other delivery modes; D-06 puts SMS/WhatsApp post-MVP. A tracker must not silently authorize new sending, expose resident contact details, or claim a bill was delivered merely because an in-app/push notification was sent.

For legal/statutory points: **verify against the state co-operative act / our bye-laws**. These conflicts do not mean the app is wrong and are not permission to change approved behavior automatically.

### Every money, legal or member-rights conflict found in M09

- **GAP-M09-01:** Tool 98 calculates annual simple interest per overdue bill, while BIL-3/D-13 uses an optional fixed or percentage late fee after due date plus grace, without compounding. Adding or replacing this changes real amounts; any rate, legal authority, calculation base, rounding and notice wording need review. **Verify against the state co-operative act / our bye-laws.**
- **GAP-M09-02:** Tool 100 labels a unit a defaulter at a configurable threshold of two or more overdue bills; Homeish's BIL-11/BIL-12 currently includes units with any overdue bill. The owner selected A: keep the existing rule and do not hide overdue balances from reports.
- **GAP-M09-05:** Tool 105's `Interest Hold` can affect late fees/interest or recovery while a bill is disputed. The owner selected A: no separate register; corrections stay on Homeish's audited waiver/adjustment paths. No dispute status or hold will pause charges, reminders or collection.
- **GAP-M09-06:** Tool 106's due-date-based collection efficiency is not the same as Homeish's BIL-11 period percentage or P27's "settled in full" collection-rate metric. The owner selected B: add a separately labelled, read-only report; do not silently substitute definitions or add a fourth billing analytics metric. D-62 allows 2–3 metrics per module.
- **GAP-M09-03/04:** Payment arrangements and recovery records must not imply a changed due date, waived debt, received money or legally valid service. Only confirmed payments affect the ledger; statutory recovery wording/deadlines require legal review.

For legal/statutory points: **verify against the state co-operative act / our bye-laws**. These findings do not authorize a rate, recovery action, change to a due date or interruption of current billing.

### Every money, legal or member-rights conflict found in M11

- **GAP-M11-03:** Homeish posts an expense to its cash/bank book when it is approved (or immediately below threshold); it has no separate cheque-clearing state. The toolkit's `Pending/Cleared` and `Issued - Pending/Cleared/Cancelled/Stopped` states could change when a real expense affects account balances. Do not silently delay, duplicate, reverse or reclassify a posted entry.
- **GAP-M11-04:** Tools 123–125 introduce journal debits/credits, general ledger accounts and trial balance. This conflicts with D-39/P16's approved boundary of simple bookkeeping, not full double-entry accounting. Expanding it changes core financial meaning and needs a new product/accounting decision, contract and expert review.
- **GAP-M11-05/07:** Reconciliation items and fixed-deposit interest/maturity affect reported money and may be mistaken for posted income or available cash. The safe proposals keep them separate from cash-book postings; verify rates, taxes and treatment with the society's accountant and relevant bye-laws before any financial use.

These were financial-behavior conflicts, not evidence that the existing app was wrong. The owner rejected both toolkit changes: P16 cheque posting remains unchanged and D-39's simple-bookkeeping boundary is confirmed as intended.

## Plan and existing decisions

- The single app plan is [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md). Its task IDs use `P<phase>.<task>`. The owner approved the M25, M03, M02, M08, M09 and M11 plan updates on 2026-11-18.
- No toolkit decision section existed at baseline. The saved plan now contains [P35 M25 planned work](./IMPLEMENTATION_PLAN.md#phase-p35--toolkit-housing-additions-m25-review), [P36 M03 planned work](./IMPLEMENTATION_PLAN.md#phase-p36--unit-and-ownership-records-m03-review), [P37 M08 planned work](./IMPLEMENTATION_PLAN.md#phase-p37--billing-additions-m08-review), [P38 M09 planned work](./IMPLEMENTATION_PLAN.md#phase-p38--dues-and-arrears-m09-review), [P39 M11 planned work](./IMPLEMENTATION_PLAN.md#phase-p39--accounts--cash-book-m11-review) and the [toolkit decision register](./IMPLEMENTATION_PLAN.md#toolkit-review-decisions).
- On 2026-11-19 the plan's per-phase overview sections (former 1.2–1.21) were combined into one [Section 1.2](./IMPLEMENTATION_PLAN.md#12-accepted-toolkit-additions-p35p53): a grouped dependency diagram and a P35–P53 overview table with proposed, unapproved sizes. The instructions below that add Sections 1.2 and 1.3 record the earlier layout.
- [deferred-features.md](./roadmap/deferred-features.md) is a supporting deferral register, not a second implementation plan. It defers payment processing, SMS/WhatsApp, alternative providers and multi-society overview/operators. Do not reopen these as fresh gaps without a changed need.
- Web Push already exists, but its pilot use has an unresolved scope decision in that register. Preserve the implementation; do not extend or remove it by assumption.
- The plan reports P0-P8 and P11-P33 delivered, P9/P10 partly complete and P34 deferred. These are document statements, not independently verified release evidence. Manual acceptance and live enablement are separate gates.
- Initial worktree: modified package lock and untracked `.github/skills/`. Leave both untouched.

## App baseline

### Reading status correctly

**Built evidence** below means implementation and/or route files are present, supported by the implementation plan. It does not mean every rule has been traced or works in a hosted environment. **Tests present** means corresponding test files exist, not that they passed in this review. Five selected unit-test files have now passed; the exact command and limits are recorded below. Other suites have not been run.

Source and test links below are the evidence entry points, not claims that every file in every folder has been read.

### Modules and screens

| Area                                 | Present implementation / screens                                                                                                          | Status and test evidence                                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core society setup and structure     | [structure operations](../src/core/structure/operations.ts), admin structure screen; blocks, units, activation, CSV import                | Built; [database structure tests](../tests/integration/database-structure.test.ts), [unit CSV tests](../tests/unit/units-csv.test.ts) present                                                                              |
| Accounts, people and registration    | [members](../src/core/members), [registration](../src/core/registration); login, people, registration, household and society switching    | Built; [membership/occupant tests](../tests/integration/database-members-and-occupants.test.ts), [registration tests](../tests/unit/registration.test.ts) present                                                          |
| Developer administration             | [developer](../src/core/developer); societies, modules, errors, audit, health and erasure screens                                         | Built; [developer tests](../tests/unit/developer-console.test.ts) present                                                                                                                                                  |
| Visitors                             | [visitor](../src/core/visitor); resident, guard and admin visitor screens                                                                 | Built; [visitor database tests](../tests/integration/database-visitors.test.ts) present                                                                                                                                    |
| Deliveries                           | [delivery](../src/core/delivery); resident, guard and admin delivery screens                                                              | Built; [delivery database tests](../tests/integration/database-deliveries.test.ts) present                                                                                                                                 |
| Billing, dues and receipts           | [billing operations](../src/core/billing/operations.ts); bill generator, review queue, bill/unit detail, resident dues and payment screen | Built; [billing calculations](../tests/unit/billing-calculations.test.ts), [payment tests](../tests/integration/database-billing-payments.test.ts), [billing browser tests](../tests/e2e/billing-payments.spec.ts) present |
| Requests and complaints              | [service requests](../src/core/service-requests); request creation, detail, admin queue and escalation                                    | Built; [request database tests](../tests/integration/database-service-requests.test.ts), [browser tests](../tests/e2e/service-requests.spec.ts) present                                                                    |
| Notices                              | [notices](../src/core/notices); authoring and resident list/detail                                                                        | Built; [notice tests](../tests/e2e/notices.spec.ts) present                                                                                                                                                                |
| Staff                                | [staff](../src/core/staff); admin/resident staff and guard entry screens                                                                  | Built; [staff tests](../tests/integration/database-staff.test.ts) present; payroll explicitly outside current staff scope                                                                                                  |
| Housekeeping inventory               | [housekeeping](../src/core/housekeeping); inventory screens for admin and supervisor                                                      | Built; [inventory tests](../tests/integration/database-housekeeping.test.ts) present; cleaning schedules/checklists explicitly outside scope                                                                               |
| AMC                                  | [AMC operations](../src/core/amc/operations.ts); contracts, visits, renewals and export                                                   | Built; [AMC tests](../tests/integration/database-amc.test.ts) present                                                                                                                                                      |
| Amenities                            | [amenity operations](../src/core/amenity/operations.ts); setup and resident booking                                                       | Built; [amenity tests](../tests/integration/database-amenity.test.ts) present                                                                                                                                              |
| Society expenses and cash/bank books | [expense operations](../src/core/expense/operations.ts); expenses, setup and reports                                                      | Built; [expense tests](../tests/integration/database-expense.test.ts) present; do not equate cash/bank books with a complete statutory accounting system                                                                   |
| Resident/vehicle directory           | [directory operations](../src/core/directory/operations.ts); household, resident/admin directory and guard lookup                         | Built; [directory tests](../tests/integration/database-directory.test.ts) present                                                                                                                                          |
| Tenancy and moves                    | [tenancy moves](../src/core/tenancy/moves); move requests, consent, review, completion, documents and NOC                                 | Built; [tenancy tests](../tests/integration/database-tenancy.test.ts) present                                                                                                                                              |
| Document repository                  | [document operations](../src/core/document/operations.ts); folders, versions, archive and resident documents                              | Built; [document tests](../tests/integration/database-document.test.ts) present                                                                                                                                            |
| Parking                              | [parking](../src/core/parking); admin/resident/guard parking screens                                                                      | Built; [parking tests](../tests/integration/database-parking.test.ts) present                                                                                                                                              |
| SOS                                  | [SOS](../src/core/sos); resident alert and admin/guard response                                                                           | Built; [SOS tests](../tests/integration/database-sos.test.ts) present                                                                                                                                                      |
| Polls and voting                     | [poll](../src/core/poll); drafts, representatives, ballots and results                                                                    | Built; [poll tests](../tests/e2e/poll.spec.ts) present                                                                                                                                                                     |
| Meetings and AGM                     | [meeting](../src/core/meeting); settings, agenda, attendance, resolutions, minutes and actions                                            | Built; [meeting tests](../tests/e2e/meeting.spec.ts) present                                                                                                                                                               |
| Vendors and purchasing               | [vendor](../src/core/vendor); vendors, purchase requests and decisions                                                                    | Built; [vendor tests](../tests/integration/database-vendor.test.ts) present                                                                                                                                                |
| Patrol                               | [patrol](../src/core/patrol); checkpoints, print view, guard rounds and incidents                                                         | Built; [patrol tests](../tests/integration/database-patrol.test.ts) present                                                                                                                                                |
| Utility metering                     | [metering](../src/core/metering); meters, readings and consumption charges                                                                | Built; [metering tests](../tests/integration/database-metering.test.ts) present                                                                                                                                            |
| Analytics                            | [analytics operations](../src/core/analytics/operations.ts); committee/admin dashboard and settings                                       | Built; [analytics tests](../tests/e2e/analytics.spec.ts) present                                                                                                                                                           |
| Assets                               | [asset operations](../src/core/asset/operations.ts); categories, asset detail and maintenance history                                     | Built; [asset tests](../tests/integration/database-asset.test.ts) present                                                                                                                                                  |
| Community/marketplace                | [community operations](../src/core/community/operations.ts); groups, posts, listings and moderation                                       | Built; [community tests](../tests/e2e/community.spec.ts) present                                                                                                                                                           |
| Events and RSVPs                     | [event operations](../src/core/event/operations.ts); events, audience, attendance responses and optional billing                          | Built; [event tests](../tests/e2e/event.spec.ts) present                                                                                                                                                                   |
| Home services                        | [home services](../src/core/home-services); provider list/detail                                                                          | Built; [home-services tests](../tests/integration/database-home-services.test.ts) present                                                                                                                                  |
| Hindi and language choice            | [i18n](../src/core/i18n); account language/font and translated surfaces                                                                   | Plan reports released with owner acceptance pending; [language browser tests](../tests/e2e/language.spec.ts) present                                                                                                       |
| Multi-society overview/operators     | [P34](./IMPLEMENTATION_PLAN.md#phase-p34--multi-society-overview-deferred)                                                                | Deferred, not built; existing society switcher is a different, built feature                                                                                                                                               |
| Native Android distribution          | [future Android reference](./IMPLEMENTATION_PLAN.md#future--android-app-for-residents-and-guards-reference-only)                          | Reference draft only; not scheduled or approved for implementation                                                                                                                                                         |
| Operations and pilot launch          | [P9/P10](./IMPLEMENTATION_PLAN.md#phase-p9--operations-daily-job-retention-backups-monitoring)                                            | Partial; local checks and delivery marks are not owner UAT, recovery verification or live approval                                                                                                                         |

### Main data and fields

The app's [database contract](./DATABASE.md) distinguishes access to the app from legal ownership/membership.

- Society: profile, timezone, currency and status; module configuration: enabled flag and settings.
- Block: name, active flag. Unit: block, number, floor, free-text unit type, one optional `area_sqft`, active flag.
- Profile: sign-in identity and profile information. Membership: user/invited email, society roles, invited/pending/active/deactivated status, joined/left dates.
- Occupancy: unit, membership, owner/tenant/family relationship, primary/approver flags, pending/active/ended status and start/end dates. Do not assume an app membership is the toolkit's statutory shareholding member.
- Billing: charge method/rate; unit bill and due date; immutable charge lines; payment amount/mode/reference/date/review status; oldest-first allocations; append-only ledger debits/credits; society payment details and receipt numbering.
- Expense: cash/bank account opening balance/date; categories; payee/date/amount/mode/account/status; append-only in/out book entries and month locks.
- Operations: visitor/delivery unit and lifecycle, staff type/links/attendance, inventory item/unit/minimum and movements, AMC dates/vendor/cost/visits, amenity slots/bookings, requests/category/priority/assignee/events.
- Housing/governance/community: tenancy moves and private documents/events; directory preferences/vehicles/emergency contacts; repository folders/versions; parking spaces/allocations; SOS alerts; polls/electorate/ballots; meetings/agenda/attendance/resolutions/minutes/actions; vendors/purchases; patrols/scans/incidents; meters/readings; assets/maintenance; posts/listings/moderation; events/RSVPs.
- Notifications, audit/error records, background jobs and private storage metadata support the domains.

### Calculations, rules and cross-module links

- Money is integer paise. [Billing validation](../src/core/billing/validation.ts) supports fixed, per-square-foot and custom-per-unit charges; exact decimal area calculations have half-up paise/rupee [tests](../tests/unit/billing-calculations.test.ts).
- The billing contract specifies preview before publication, no duplicate generation, immutable published bills, reasoned corrections, non-compounding flat/percentage late fees after grace, partial payments, oldest-due-first allocation and retained credit.
- Resident UPI submissions await admin confirmation; direct admin recordings confirm immediately. The platform does not move money or operate a gateway.
- Expense account balance is opening balance plus receipts minus payments. Above-threshold spending needs a different committee approver; corrections use reversals; closed months block posting.
- Units and occupants feed billing. Confirmed billing payments optionally feed expense books; historical payments are not automatically backfilled. The selected-account/date/closed-month behavior needs detailed comparison if accounts is selected.
- Tenancy/NOC checks the unit ledger when billing is enabled. Positive dues block clearance; disabled billing means `not_checked`, not zero. No assumption of statutory transfer clearance.
- Metering, amenities and events can feed billing when enabled. Vendor purchasing can feed expenses. Meetings may link polls/documents; assets may link AMC.
- Optional modules must remain independently switchable. Toolkit conceptual links do not authorize mandatory dependencies.
- Other domain rules (inventory nonnegative history, meeting quorum, voting rights, meter pricing and dates) need source-level tracing within whichever modules the owner selects.

### Roles and permissions

- [Permission implementation](../src/core/permissions/index.ts) uses `admin`, `committee`, `guard`, `hk_supervisor`, `resident`; developer is a separately authenticated platform identity. Owner/tenant/family is an occupancy relationship, not a separate stored society role.
- The [module registry](../src/core/modules/index.ts) is the central navigation/settings/permission map. Roles combine; server and database enforce society scope, enabled modules and ownership.
- Admins operate the society; committee is mainly read/oversight with specific approvals and notice authoring; guards receive gate/safety-specific projections; supervisors manage inventory; residents see permitted own-unit and shared content. Developers configure modules and diagnose through logs, without impersonation.
- Exact permissions must be compared per capability rather than granting blanket access based on a toolkit workbook.

### Reports, notifications and file exchange

- Billing dashboard/report operations cover billed, collected, outstanding, collection rate and defaulters; CSV dues/collections/defaulters and PDF invoices/receipts are implemented entry points.
- Expense entry export and reports, analytics dashboard/export, inventory reports, AMC export, service-request metrics, poll exports and meeting minutes exist. Report availability and exact figures require module-level checks.
- [Notification operations](../src/core/notifications/operations.ts) implement an authenticated inbox, unread count and read markers. Email and Web Push adapters exist; Realtime refreshes authoritative data. Pilot push scope is unresolved, as noted above; SMS/WhatsApp remains deferred.
- Notifications include billing reminders/review outcomes, operational status changes, contract expiry and module-specific events. Do not infer extra delivery channels from toolkit communication columns.
- CSV import exists for units and residents. Other toolkit registers do not automatically have importers. Existing document uploads and private signed downloads are not the same as bulk structured-data import.
- PDF receipt/invoice, expense document, NOC and meeting-minutes code exists; no broad claim is made that every register can be exported.

## Toolkit handling, original files and verification

- Read the guide's overview, module index, member/unit summaries and M25 summary; read the M25 field reference for Tools 289-293 and 295-300. Tool 294 is excluded as credit-only; its presence and purpose were established from the guide, without reviewing credit rules.
- The reference omits Tool 291's actual fields, Tool 292's list values and Tool 297's action fields. Read the original **291, 292 and 297 Excel files**, locally and read-only, to establish them and check selected formulas.
- The reference gives only titles for the PDF guides and Word templates. Read **Tool 290's first page in full**, topic excerpts from each page of **Tools 295, 296 and 298**, and the text of **Tool 300's Word pack**. These were local reads using already-installed tools; nothing was uploaded or installed. This is not a legal review of the ebooks.
- For M08, read the Module 8 guide and reference entries for **Tools 85–96**, then compare them with Homeish's billing PRD, database/API contracts, billing screens and operations, analytics, and related tests. The guide and Tool 85 reference disagree on field descriptions, so inspect the original **85 Maintenance Charge Master workbook** read-only to verify its validation and formulas. No other original Module 8 workbook was opened. Tool 98 was read as an earlier cross-module clarification, not part of this M08 review.
- To understand the newly required clearance/handover scope, read the M18 guide summary and reference **Tools 207, 208, 209 and 214**: NOC request, numbered issue register, dues clearance and committee conditions/approval. This is not a full M18 review; no original M18 file was opened. The incoming-party liability-handover requirement comes from the owner's clarification, not an assumed toolkit rule.
- Original-file paths are under the toolkit's `Module_25_Setup_Guides_Bonus_Library\01_Tools\Individual_Tools` folder. No source file was modified.
- Module 5 is missing; do not reconstruct it.
- Modules 12 and 20 each have two versions; count each pair once and compare useful differences if selected.
- The guide says individual workbooks do not share live data. Tool 290 makes a broader claim that setup feeds every other tool in the master workbook. The inspected individual Tools 291 and 297 have no external workbook links. Do not treat the guide wording or PDF wording as proof of cross-workbook automation; the app already uses shared database records.
- Sample rates, fees, interest, deadlines, quorum and legal labels are not authoritative requirements. Legal/statutory points must be marked **verify against the state co-operative act / our bye-laws**.
- No toolkit sample names or real member data have been copied into this report or the plan.
- Semantic workspace search returned no results; file discovery and direct source/document reads provide the baseline.
- **Earlier M25/M03 checks:** `npm run test -- tests\unit\create-society.test.ts tests\unit\module-registry.test.tsx tests\unit\billing-validation.test.ts tests\unit\amenity-validation.test.ts tests\unit\tenancy-operations.test.ts` passed with **5 files, 128 tests**. This does not test the M08 documentation or establish live behavior.
- Earlier review batches read relevant existing billing and meeting database-test assertions without running database integration tests. No hosted access, migration or production check was performed. The Tool 85 workbook was inspected locally and read-only; no toolkit Office/PDF file was executed.

## M25 source-to-app coverage

| Toolkit tool                 | Finding / merged decision IDs                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 289 Master table of contents | GAP-M25-01; module navigation/toggles exist, manual adoption ownership and maturity do not                                    |
| 290 Three-step quick start   | GAP-M25-06; setup, enter data, review dashboard; adapt to the app                                                             |
| 291 Society setup            | GAP-M25-02 and GAP-M25-03; consolidate reference/readiness, do not silently replace authoritative rules                       |
| 292 Dropdown master          | GAP-M25-04; distinguish editable categories from protected state and permission values                                        |
| 293 Housing sample data      | Already covered at the synthetic-example feature level by fixtures and test factories; not a claim of a connected public demo |
| 294 Credit sample data       | Not relevant to owner-selected housing-only scope                                                                             |
| 295 Housing ebook            | GAP-M25-06; housing guidance, not approval of every chapter's business feature                                                |
| 296 Compliance ebook         | GAP-M25-06; housing-relevant guidance only, no credit rules or statutory guarantees                                           |
| 297 Committee action plan    | GAP-M25-05; existing meeting actions cover only part of the capability                                                        |
| 298 Hinglish walkthrough     | GAP-M25-06; reuse the existing language approach, not a new language system                                                   |
| 299 FAQ/troubleshooting      | GAP-M25-06; marketing FAQ and developer runbooks are not a searchable user help library                                       |
| 300 Thirteen templates       | GAP-M25-07 through GAP-M25-10, with unsupported promises/data separated from printable formats                                |

### Already covered, not relevant and app-only

- **Already covered: 1 source tool, 293.** Synthetic housing examples already exist in [fixtures](../src/app/fixtures) and [test fixtures](../tests/fixtures). A connected demo remains separately deferred by D-49; do not raise it as a new M25 gap.
- **Not relevant: 1 source tool, 294.** Credit-cooperative sample records are outside this run. Spreadsheet-only help topics such as cell colours, formula editing and Excel compatibility are also not app features to build.
- **App-only safeguards: 5 groups.** (1) society isolation and role-limited access, (2) authenticated email-code login/developer MFA, (3) server/database module-off enforcement, (4) admin-confirmed UPI rather than treating a typed paid amount as confirmed, (5) transactional, append-only financial history. Preserve all five; a workbook's simplicity is not a reason to remove them.
- Existing meeting minutes, reminders, CSV templates and private documents partially cover individual formats and are reused in the decision cards, not counted as wholly missing capabilities.

### Cross-module links checked in this batch

1. **Setup -> units -> members:** unit/block counts can come from Core; an app account/occupancy is not a statutory shareholding member. A legal member total must wait for the M02 comparison, not be filled with the resident count.
2. **Setup -> billing -> dues -> accounts:** Core unit area already feeds billing and confirmed payments can feed expense books. A setup reference must read those settings/results, not maintain a second rate, overdue balance or paid flag. Full M08/M09/M11 posting coverage remains unreviewed.
3. **Setup -> meetings/elections -> compliance:** held-meeting records exist, but committee legal term/election metadata is not part of today's society profile. No automatic statutory deadline is justified until M04/M07/M20 and the applicable rules are reviewed.
4. **Committee plan -> existing operational modules:** action assignments exist, but every current meeting action needs a meeting ID. A standalone committee plan must not require fake meetings, duplicate financial records or force optional modules on.
5. **Templates -> authoritative records:** printable bills/letters must not confirm payments, reserve slots, clear dues, issue a legal certificate or grant tenancy access. Those remain separate operations.

## M25 decision cards

Value and effort are relative: H = high/large, M = medium, L = low/small. Effort is not a time quote. Confidence describes evidence for the comparison, not legal correctness. All ten items are accepted for planning, including three keep-current-behavior choices. Clearance policy gates remain explicitly open. The owner-approved M25 plan edits are saved and verified; no implementation is authorized.

### GAP-M25-01 · NEW · Value L · Effort M · Confidence High

**What:** A manual rollout/adoption register separate from module on/off switches.

**Why it helps:** A committee can distinguish a feature merely enabled from one somebody owns and knows how to use.

**Toolkit source:** [Tool 289](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t289>).

**App today:** [Module registry](../src/core/modules/index.ts) and developer module console cover enabled state, settings, navigation and permissions; [registry tests](../tests/unit/module-registry.test.tsx) passed. Nothing found for adoption owner, review date or mastery after searching `adoption`, `mastered`, `rollout`, `onboarding`, `review date` and the registry/developer surfaces.

**Change needed:** Data/screens: catalogue applicable app capabilities, manual `Adoption Status` = `Not Started, Exploring, In Use, Mastered`, `Priority` = `High, Medium, Low`, `Owner / Responsible`, `Review Date`, `Notes`. Reports: counts in use/mastered, exploring, not reviewed, high-priority pending and module-wise progress. Do not expose all 300 tools as implemented app features.

**Acceptance:** Changing adoption never enables a module, grants a role or claims production readiness; statuses persist per society; disabled/unbuilt features are labelled honestly. Use manual entries, not new usage tracking.

**Depends on:** Existing Core society/module data; no other new item.

**Risks / verify:** New ownership/review work may cost more than it helps. Named responsibility is not authorization. Recommendation: defer until pilot rollout shows a need.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision:** Accepted 2026-11-18; no additional reason or limitation supplied. The owner's acceptance overrides the defer recommendation.

### GAP-M25-02 · ENHANCEMENT · Value H · Effort H · Confidence High

**What:** One society reference profile and setup-completeness view.

**Why it helps:** Prevents missing registration/governance information and repeated, inconsistent entry across modules.

**Toolkit source:** [Tool 291](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t291>); original `Society Setup` rows 7-46.

**App today:** [Society input](../src/core/developer/console.ts#L26) already holds name, address, city, contacts, timezone, currency and unit label; [onboarding runbook](./OPERATIONS.md#L277) and the script already create a society/admin. The script's onboarding-status check is provisioning/idempotency support, not a 39-field society-readiness dashboard. No registration/governance setup profile was found in the society schema, developer form or generated types. Searches included registration number/date/authority, society type, committee term, last election, auditor, IFSC and setup completion.

**Change needed:** Data/screens: map the toolkit's 39 fields without blindly adding 39 new columns:

| Toolkit section | Exact field names and mapping boundary                                                                                                                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity        | `Society Name`, `Society Type`, `Registration Number`, `Date of Registration`, `Registering Authority`, `PAN of Society`, `Registered Address`, `City`, `State`, `PIN Code`, `Official Email`, `Office Phone`; reuse existing profile fields                                                                         |
| Governance      | `Bye-laws Adopted On`, `No. of Committee Members`, `Committee Term (Years)`, `Last AGM Date`, `Last Election Date`, `Statutory Auditor Name`, `Audit Category`, `Financial Year Start Month`; link existing proven records where appropriate, otherwise clearly identify reference information                       |
| Property        | `Total Wings / Buildings`, `Total Flats / Units`, `Total Members`, `Total Parking Slots`, `Year of Construction`, `Total Built-up Area (sq.ft)`; derive from authoritative registers where available, and never equate residents with statutory members or the current single area field with verified built-up area |
| Finance         | `Maintenance Rate (Rs per sq.ft)`, `Sinking Fund Rate (Rs per sq.ft)`, `Interest on Arrears (% p.a.)`, `Grace Period (Days)`, `Bank Name`, `Account No. (last 4 digits only)`, `IFSC Code`; financial interpretation is separately decided in GAP-M25-03, not duplicated here                                        |
| Office bearers  | `Chairman Name`, `Chairman Mobile`, `Secretary Name`, `Secretary Mobile`, `Treasurer Name`, `Treasurer Mobile`; reference roles do not become app access roles, and do not infer missing Module 5 content                                                                                                            |

The original field-status formula is `=IF(D8<>"","Filled",IF(E8="Yes","Missing","Optional"))`. Preserve its useful missing/optional distinction, not the spreadsheet's blanket mandatory flags. Reports: setup completion, required fields done/missing and sections complete; last AGM/election indicators only when their source and applicable rule are verified. No sample committee size, term or rate becomes a default requirement.

**Acceptance:** Reuse existing records; label unavailable/not-applicable data rather than inventing zero; do not block existing users or make co-operative-only fields mandatory for every RWA; missing data is advisory. Protect PAN/bank metadata and office-bearer contact details with explicitly agreed purpose and visibility before implementing them; never collect a full bank-account number from this source. Record where a derived value came from. No law-based deadline is calculated without an approved applicable rule.

**Depends on:** Existing Core structure and society profile; GAP-M25-03 for money settings. Legal membership/area/election/account mappings remain subject to M02/M03/M04/M07/M10/M11/M20 comparisons; show not available until those records exist.

**Risks / verify:** New personal/financial metadata, stale manual counts, retrospective setup requirements and legal-entity differences. **Verify against the state co-operative act / our bye-laws**. Acceptance is planned work, not permission to collect live data now.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision:** Accepted 2026-11-18; no additional reason or limitation supplied.

### GAP-M25-03 · CONFLICT · Value H · Effort M-H by option · Confidence High on differences / Medium on toolkit calculation intent

**What:** Decide whether shared setup is a reference view or a replacement for existing financial rules.

**Why it helps:** Stops a convenient setup screen from silently changing bills, late fees and financial reports.

**Toolkit source:** [Tool 291](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t291>); original rows 27 and 34-40.

**App today:** [Billing settings and charge methods](../src/core/billing/validation.ts#L12) support fixed, per-sq-ft and custom charges, and flat/percentage late fees. PRD BIL-3 starts fees after **due date + grace**, not bill date. [Database-test assertions](../tests/integration/database-billing-fines-reports.test.ts#L336) describe one late fee per eligible bill/month, without compounding; these database tests were read, not run. [Expense year default](../src/core/expense/validation.ts#L281) is April-March.

**Toolkit difference:** One maintenance and sinking-fund rate per square foot; `Interest on Arrears (% p.a.)`; the exact grace hint is **"Days after bill date before interest starts"**. `Financial Year Start Month` offers all twelve months. This setup sheet alone does **not** establish the annual-interest accrual formula or justify an annual-to-monthly conversion.

**Follow-up clarification, 2026-11-18:** The full toolkit is not limited to those two setup rates. [Tool 85](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t85>) has multiple charge heads; the original workbook implements per-area, fixed and percentage-of-maintenance calculations plus owner/tenant applicability. These are candidates for the later M08 comparison, not approvals or new M25 gap cards.

[Tool 98](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t98>) gives the exact rule **Principal x Rate / 100 x interest-bearing days / 365 (simple interest)** and **interest-bearing days = days after (Due Date + grace days)**. Thus the bill-date wording is a toolkit inconsistency, not evidence that the app's due-date rule should change.

The current [database function](../supabase/migrations/20261110200000_billing_fines_late_fees.sql#L257) applies a configured fixed fee or percentage of outstanding principal to each eligible unpaid regular bill or manual fine, at most once in the current calendar month. It does not prorate the percentage by overdue days or charge a late fee on an earlier late fee. Fees default off. Admins manage charge heads/due day/rounding; the broader billing-rule configuration is developer-managed. No hosted society's actual chosen configuration has been checked.

**Change needed:** A shared profile must either read current charge/settings sources with accurate labels, or deliberately change those sources and all affected billing, dues, date calculations and report defaults. Do not add a competing editable finance snapshot.

**Existing impact:** Changing grace origin can change the first penalty date; annual-interest policy can change amounts; a single rate can discard mixed/custom billing; changing fiscal start changes report grouping. Published bills and ledger history must not be rewritten. A migration/cutover policy would be necessary for a replacement.

**Options:** A) Keep existing screens and financial behavior; omit unsupported shared finance inputs. B) Plan replacement financial policy, but block implementation until the exact M08/M09 calculation and M11/M12 period comparisons and owner choices are complete. C) Add a read-only shared reference to existing settings; leave current rates, grace origin, fee calculations and April-March defaults unchanged, and review any policy change in the relevant later module.

**Recommended after follow-up:** A is reasonable for keeping the current app unchanged. Evaluate the daily annual-interest option and additional charge calculations in M08/M09; that review is not approval to add them or double-charge both methods. A read-only reference, C, remains an optional convenience rather than a necessary correction.

**Acceptance:** For C, values/labels match their authoritative settings; a disabled module shows not checked/not configured, never zero debt; no new charges or ledger changes occur. A means no financial change. B remains explicitly blocked on a precise formula, effective date, existing-data policy and legal verification; accepting B is not an executable formula specification.

**Depends on:** Current billing/expense configuration; GAP-M25-02 only for displaying the new reference view. Formula/policy replacement depends on later M08/M09/M11/M12 decisions, not on assumed toolkit examples.

**Risks / verify:** Money, existing balances and statutory reporting. **Verify against the state co-operative act / our bye-laws**.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Chosen option:** [x] A [ ] B [ ] C\
**Owner decision:** Accepted A, 2026-11-18: keep current behavior; compare optional additions separately in M08/M09.

### GAP-M25-04 · CONFLICT · Value H · Effort M-H by option · Confidence High

**What:** A central list catalogue must not turn controlled workflow values into freely editable words.

**Why it helps:** Users can find the right list without breaking payment validation, membership rights or reports.

**Toolkit source:** [Tool 292](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t292>); original `Master Lists` header row 7 and values.

**App today:** [Occupancy/membership contract](./DATABASE.md#L231) separates society roles from `owner, tenant, family` relationships. [Billing modes](../src/core/billing/validation.ts#L335) are `upi, cash, cheque, bank_transfer`; [expense modes](../src/core/expense/validation.ts#L32) use `cash, bank, upi, cheque`. [Meeting types](../src/core/meeting/validation.ts#L106) are AGM, SGM and committee. Expense/request categories already have domain-specific managers. Searches covered dropdown/list/master, categories, statuses, payment modes, membership/occupancy and meeting types.

**Toolkit difference:** Twelve editable lists: `Membership Type`, `Unit Type`, `Occupancy Status`, `Payment Mode`, `Expense Category`, `Income Head`, `Fund Type`, `Meeting Type`, `Complaint Category`, `Vendor Category`, `Staff Role`, `Document Type`. Membership values include `Ordinary, Associate, Nominal, Joint`; occupancy includes `Vacant`, `Locked / Not Reachable`, `Under Renovation`; modes add `Demand Draft` and `Auto Debit`; meeting types add sub-committee/emergency/joint meetings. These are not simple label aliases for today's app values.

**Change needed:** A catalogue can show current lists, their meaning, duplicate/empty checks and links to existing category editors. Any new protected value needs explicit semantics, database validation, permissions, imports and report mappings; do not let an amber spreadsheet cell bypass that process. Omit spreadsheet capacity/near-full metrics unless the app genuinely has such a limit.

**Existing impact:** Arbitrary replacements could invalidate old rows, change financial classifications, alter voting/member meanings or make import/export values incompatible.

**Options:** A) Keep all current list-management screens and controlled values. B) Make the toolkit lists centrally editable, after a separate mapping and migration design for every protected value. C) Add a central catalogue/links and duplicate/empty checks for existing editable domain lists, while keeping state, role, relationship, payment-mode and meeting-type values controlled.

**Recommended after follow-up:** A is reasonable if a central catalogue is not needed. Keep existing category editors and controlled values. Review legal membership categories and physical vacancy/renovation states as real capabilities in M02/M03, not as arbitrary new dropdown words. C is a convenience option, not a required replacement.

**Acceptance:** C introduces no new role, payment mode, legal membership type or meeting lifecycle. Existing records/CSV contracts continue to work. A/B meanings are not mixed: any accepted B replacement is blocked until each new value's behavior and migration are separately decided.

**Depends on:** Existing module registry/domain category managers; later M02/M03/M06/M08/M11 findings for substantive new values.

**Risks / verify:** Money classification and member/voting rights. **Verify against the state co-operative act / our bye-laws** where legal categories are involved.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Chosen option:** [x] A [ ] B [ ] C\
**Owner decision:** Accepted A, 2026-11-18: retain current category editors and protected values.

### GAP-M25-05 · ENHANCEMENT · Value M · Effort H · Confidence High

**What:** A reusable, standalone 90-day committee action plan.

**Why it helps:** A new committee can track handover, money/document checks and follow-up with named responsibility and visible dates.

**Toolkit source:** [Tool 297](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t297>); original plan header row 7 and Settings.

**App today:** [Meeting actions](../src/core/meeting/validation.ts#L355) already have title, membership owner, due date, optional resolution, `open/done`, note and overdue indicator; creation requires `meetingId`. [Action/reminder database tests](../tests/integration/database-meeting-minutes-actions.test.ts#L417) exist but were not run. Nothing found for standalone committee handover plans, phases, day offsets, blocked/progress tracking or a weekly plan after searching 90-day, handover, action plan, progress, phase and checklist.

**Change needed:** Reuse assignment and access patterns; add a plan start date and source fields `Task / Action`, `Phase`, `Category`, `Owner`, `Priority`, `Start Day`, `End Day`, `Start Date`, `Due Date`, `Status`, `Progress %`, `Days Left`, `Timeline Status`, weekly timeline, `Notes`, `Evidence / Link`. Toolkit statuses: `Not Started, In Progress, Done, Blocked`; priorities `High, Medium, Low`; categories `Governance, Finance, Compliance, Operations, Communication, Technology, Safety`. Office-bearer labels are responsibility labels, not new permissions.

**Exact source rules:** Start/due dates = plan start + respective day offset - 1; days left = due date - today. Timeline is Done first, otherwise Overdue if today is past due, Upcoming if before start, otherwise On Track. Source phase split is start day <=30 Foundation, <=60 Systems, otherwise Growth; these are planning examples, not statutory deadlines. The 36 source tasks are editable suggestions, not approval to implement payroll, funds, redevelopment or every referenced module.

**Acceptance:** Plans do not require fake meetings; overlapping meeting actions are linked/reused, not separately marked complete; no optional module is silently enabled; owners see only permitted records/evidence. Summary shows total/completed/in-progress/overdue/high-priority-open tasks, progress and due-in-seven-days. Changing plan dates does not change legal deadlines or past money records.

**Depends on:** Existing memberships/notifications and meeting-action patterns; GAP-M25-02 only if a task links its setup-readiness view.

**Risks / verify:** Duplicate task systems; changing meeting `open/done` must not break existing actions. Reuse does not automatically authorize a general-purpose project-management engine. Legal tasks: **verify against the state co-operative act / our bye-laws**.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision:** Accepted 2026-11-18; no additional reason or limitation supplied.

### GAP-M25-06 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Practical, searchable getting-started/help content for the app's users.

**Why it helps:** Admins and committee members can find everyday answers without reading developer runbooks.

**Toolkit source:** [290](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t290>), [295](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t295>), [296](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t296>), [298](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t298>), [299](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t299>).

**App today:** [Public FAQ](../src/core/website/content.ts#L227), inline form guidance, [operations runbook](./OPERATIONS.md#L277), [UAT script](./UAT_SCRIPT.md) and existing English/Hindi support are partial coverage. Nothing found for a searchable authenticated help/article library after searching FAQ, help center/centre, quick start, walkthrough, knowledge, troubleshooting and the route catalogue. Do not misclassify the marketing FAQ as absent.

**Change needed:** Reuse/adapt the three-step sequence **set up once -> enter data -> read dashboard**, relevant housing/governance guidance and Tool 299's `Category`, `Question`, `Answer`, `Applies To`, `Level` (`Beginner, Intermediate, Advanced`), `Added On`, `Your Notes`, with search/category filtering and matches. Start with app-relevant getting-started, data-entry, dashboard/report, printing and troubleshooting topics. Reuse the current language approach; the Hinglish guide is a content source, not a new translation platform.

**Acceptance:** Instructions match real role/module access and direct UPI/admin confirmation; no workbook cell/formula advice is presented as app functionality; unavailable modules are clearly labelled; housing help does not introduce credit/dairy features; personal notes, if retained, are not exposed across societies. Legal content is clearly general guidance, not a compliance guarantee.

**Depends on:** Existing routes, role checks and language support; individual help topics for accepted future gaps wait until those features exist.

**Risks / verify:** Stale tutorials, instructions that bypass permissions, inadvertently promising deferred messaging or demo availability. **Verify against the state co-operative act / our bye-laws** for legal topics.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision:** Accepted 2026-11-18; no additional reason or limitation supplied.

### GAP-M25-07 · ENHANCEMENT · Value M · Effort H · Confidence High

**What:** Reusable printable letter/notice formats populated only from supported app records.

**Why it helps:** Reduces repeated typing and makes routine communication consistent.

**Toolkit source:** [Tool 300](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t300>); original Word document contains thirteen templates.

**App today:** Existing [meeting minutes PDF](../src/core/meeting/minutes-pdf.ts), [billing PDFs](../src/core/billing/documents.ts), [tenancy NOC](../src/core/tenancy/moves/documents.ts), notice authoring and CSV templates cover specific outputs. Nothing found for a reusable society correspondence pack after searching templates, welcome letter, reminder/final notice, acknowledgement, warning letter, work order, shutdown and the module operations. These existing outputs are not to be rebuilt.

**Change needed:** Extend existing render/download patterns, not a new generic document platform. Source formats: (1) committee meeting notice, (2) AGM notice, (3) minutes, (4) dues reminder, (5) final dues notice, (6) owner NOC request, (7) member welcome, (8) complaint acknowledgement, (9) rule-violation warning, (10) tenant information, (11) hall booking confirmation, (12) vendor work order, (13) water/power shutdown. Reuse existing outputs where covered. Exclude Template 10 under accepted GAP-M25-08-A. Do not add Template 6 as a generic mortgage/loan application; required clearance outputs belong to GAP-M25-10. Template 11 must reflect actual fee/deposit terms under GAP-M25-09-D, never an assumed receipt or refund. No unsupported category, promise, amount, identity field or legal clause is accepted by accepting this library.

**Acceptance:** Authorized users preview/download a draft with current society letterhead and only authorized record data; issued amounts/statuses are not changed by rendering; unpaid/unconfirmed money is not described as paid; no automatic recovery action, new sending channel or subscription is introduced. Use actual app request priorities, not the template's extra High value. Statutory notices, violation wording, quorum/adjournment text and deadlines require applicable-rule approval before use. Tenant/move-out PDFs keep their stricter existing text/font/privacy boundaries.

**Depends on:** Existing module data/PDF/private-file patterns; GAP-M25-02 for new letterhead fields only, not for already available identity; conflict choices GAP-M25-08/09/10 for their formats. Later M06/M09/M14/M18/M19/M23 comparisons merge into this item rather than creating duplicate template-library work.

**Risks / verify:** Personal-data leakage, outdated balances or draft letters mistaken for legal notices/financial approval. **Verify against the state co-operative act / our bye-laws**.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision:** Accepted 2026-11-18; scope is constrained by accepted 08-A, 09-D and 10-E and the outstanding financial/clearance kickoff decisions.

### GAP-M25-08 · CONFLICT · Value H · Effort M-H by option · Confidence High

**What:** Toolkit tenant forms collect more personal data, including ID copies explicitly forbidden by the app.

**Why it helps:** A reusable form must not quietly expand what tenants must disclose.

**Toolkit source:** [Tool 300](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t300>), Template 10.

**App today:** [TEN-2 / D-50](./PRD.md#L492) explicitly prohibits Aadhaar/other government-ID copies. [Allowed tenancy document kinds and inputs](../src/core/tenancy/moves/validation.ts#L26) cover rental agreement, configured police proof and admin-issued NOC; move requests do not collect occupation, employer, rent/deposit or adult/child counts. Current owners/tenant/admin have scoped file access; committee/guard projections are narrower. Selected tenancy unit tests passed; database/retention tests were not run.

**Toolkit difference:** Exact instruction: **"Collect from every tenant before move-in; keep a copy of the agreement and ID."** Fields include adult/child occupant counts, occupation/employer, optional rent/deposit, owner/tenant contacts, vehicle numbers and emergency contact. Agreement and police status overlap existing features; the extra fields are not evidence the app is incorrect.

**Change needed / impact:** Adopting all fields would require an explicit D-50 reversal plus purpose, consent/notice, access, retention and deletion decisions. It must not be achieved through a document-template upload loophole. Existing tenant access/move-out history must not become conditional on new retroactive disclosure.

**Options:** A) Keep current tenancy collection; do not add this form. B) Deliberately expand collection, explicitly replacing the conflicting D-50 boundary only after the precise fields, necessity and retention are approved. C) Provide a reduced template from already permitted records, without government-ID copies, occupation/employer, new child/adult counts or rent/deposit.

**Recommended:** C. Reuse the useful format without new personal-data collection.

**Acceptance:** For C, neither form, upload instructions nor generated PDF asks for forbidden/extra fields; current consent, access and file-retention rules stay unchanged. B has no permission to collect anything until its explicit privacy/legal design is settled.

**Depends on:** GAP-M25-07 for rendering; existing Tenancy/Directory only when enabled. M19 should reference this same conflict, not re-raise a decided one.

**Risks / verify:** Tenant privacy and member rights. **Verify against the state co-operative act / our bye-laws**, and applicable privacy obligations; toolkit wording is not legal authority.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Chosen option:** [x] A [ ] B [ ] C\
**Owner decision:** Accepted A, 2026-11-18: keep digital tenancy; add no printable information form. No new fields, uploads or printable tenant summary are approved by this item. This supersedes the earlier C recommendation.

### GAP-M25-09 · CONFLICT · Value H · Effort M-H by option · Confidence High

**What:** A hall confirmation must not promise a refundable deposit or damage deduction the app cannot account for.

**Why it helps:** Prevents the printed letter and the unit ledger from disagreeing about money.

**Toolkit source:** [Tool 300](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t300>), Template 11.

**App today:** [P15 amenity decisions](./PRD.md#L454) snapshot a fee and append its ledger debit; permitted cancellations append a full credit. [Amenity schema](../src/core/amenity/validation.ts) and [operations](../src/core/amenity/operations.ts) contain no deposit/refund/damage-deduction lifecycle. Searched deposit, refund, damage, fee, charge and cancellation across amenity code/tests. Unit validation tests passed; database concurrency/cancellation assertions were read only.

**Toolkit difference:** Confirmation includes **"Refundable deposit"** and a condition that damage will be recovered from it. Its morning/evening/full-day examples also must not replace the app's actual scheduled times.

**Change needed / impact:** A true deposit feature would need separate liabilities/balances, receipts, deductions, authorizations, refunds, audit and reconciliation, not just another label in a PDF. Existing fee-only bookings cannot be treated as deposit-paid.

**Options:** A) Keep the current booking UI/records without a new confirmation letter. B) Add an explicitly designed deposit/deduction/refund workflow, then enable that wording. C) Generate a confirmation using actual booking times, guests, snapshotted fee/rules and cancellation policy; omit deposits and unsupported deduction promises. D) Following the owner's question, plan deposits/damage deductions/refunds as an optional capability, off by default; preserve existing fee/full-cancellation-credit behavior when off, and include deposit wording only for bookings actually covered by the new tracking.

**Recommended after follow-up:** D can satisfy the requested flexibility if explicitly accepted. It is larger than a letter-format change and needs a money-lifecycle decision at kickoff. C remains the smaller fee-only alternative.

**Acceptance:** For C, document values match the saved booking and ledger semantics; it never states paid merely because a booking is confirmed; no deposit is collected, refunded or deducted. B needs a prospective cutover/migration policy and defined money states before implementation; it does not authorize a gateway.

For D, the new option defaults off; old bookings retain their original terms; off-state billing/cancellation behavior stays unchanged; enabled bookings separately track deposit received, refunded, deducted and outstanding with authorization/audit and account reconciliation. A confirmation does not claim an unreceived deposit was paid. No platform money holding, gateway or automatic bank refund is authorized. Exact receipt/deduction/refund rules remain kickoff decisions, to be informed by M11/M19.

**Depends on:** Existing amenity/billing records; M11/M19 accounting/facilities detail before implementation. GAP-M25-07 is required only for the printable confirmation, not the underlying deposit-tracking capability.

**Risks / verify:** Money, dispute handling and cancellation rights. **Verify against the state co-operative act / our bye-laws**.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Chosen option:** [ ] A [ ] B [ ] C [x] D\
**Owner decision:** Accepted D, 2026-11-18: plan optional deposits/deductions/refunds, off by default; preserve fee-only behavior when off.

**D-84 planning addendum (2026-11-23; proposed, not coding approval):** The owner selected the complete lifecycle: configurable per-amenity amount and payment requirement; default payment-before-confirmation with a society-wide immediate-confirmation option; pre-confirmation override only before any receipt; external partial receipts/refunds recorded by an admin; reasoned, evidenced post-booking deductions; full refund of received deposits on cancellation, separate from the P15 fee credit. Receipt/refund cash is held money, not income; retained deductions become non-cash Other income, counted by P41/P42 without a second cash entry. Admins manage, committee reads, and active residents of the booking's unit read their own records/evidence. No gateway, automatic refund or full liability ledger is included. This addendum settles the earlier M11/M19 planning dependency; the proposed accounting treatment should receive accountant review before real use.

### GAP-M25-10 · CONFLICT · Value H · Effort H for new workflow · Confidence High

**What:** Tenant move-out and owner-sale clearance, including society-approved handover of outstanding obligations without falsely declaring them paid.

**Why it helps:** Prevents two different meanings of NOC being treated as the same legal clearance.

**Toolkit source:** [Tool 300](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t300>), Template 6.

**App today:** [D-50 approved wording](./PRD.md#L506) records an approved move-out with dues checked/explicitly not checked. [Document-repository policy](./PRD.md#L512) says residents cannot upload or request documents. There is no general owner sale/mortgage/loan certificate-request process found in route, operation or template searches. The existing NOC is not missing or a generic no-dues certificate.

**Toolkit difference:** Despite the heading "No Dues Certificate / NOC Request", Template 6 is an **application to the secretary**, for `sale / mortgage / loan / other`, with buyer/bank name, expected date, enclosure list and an undertaking to clear dues. It is not an issued certificate and makes no completed-clearance check.

**Owner's clarified requirement, 2026-11-18:** NOC is required when an existing tenant moves out or an existing owner sells the unit. It should address dues and pending actions affecting the departing person. The outgoing person must settle them or agree a handover to the incoming person, which the society must accept. This is clearance/handover, not a mortgage/loan application feature. The later M18 decision refined the blocking rule: only verified money owed blocks under the normal check; other pending actions do not block by themselves, and an identified obligation may remain outstanding through the approved conditional route (see P51.3).

**Additional toolkit sources for this clarified scope:** [207 NOC Request Tracker](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t207>) separates dues position `Cleared, Part Pending, Pending` from decision `Pending, Approved, Rejected, On Hold`; [208 NOC Issue Register](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t208>) records number, issue/validity, signatory and approval reference; [209 Dues Clearance](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t209>) tracks assessed dues, amount cleared and balance; [214 Committee Approval](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t214>) includes `Approved with Conditions`, conditions, resolution and action follow-up. None of these facts alone authorizes extinguishing a debt by handover.

**Change needed / impact:** Add owner-sale clearance case handling and the approved settlement/handover route, with explicit policy for tenant move-outs. Do not silently widen document-repository permissions or add a resident application process. Issued certificates need approved purpose/text, authority, due-check rules and history. No old move-out certificate may acquire a wider meaning.

**Options initially presented:** A) Keep only today's move-out NOC and read-only resident repository. B) Widen existing NOC/document-request paths for owner sale/mortgage/loan requests. C) Keep existing contracts unchanged and consider a separate owner application after M18 review.

**Accepted option E, reflecting the clarified requirement:** A clearance case for tenant move-out and owner sale/transfer, reusing current tenancy evidence and authoritative unit dues, adding the owner-transfer case and explicit pending-obligation/approved-handover history. Do not add a generic mortgage/loan application process.

**Confirmed policy, 2026-11-18:**

- Handover may cover both tenant move-out and owner sale, with scope revisited in M18 for modifications if needed.
- Outgoing and incoming parties agree; for tenant handover the unit owner also consents; the society admin approves. Revisit this authority arrangement in M18. This is not a new owner-consent rule for ordinary settled move-outs.
- Approved handover may produce a conditional NOC listing outstanding obligations; no-dues is reserved for verified clearance. A handover itself never records payment or wipes the balance.
- Decide what counts as a pending action during M18; do not introduce automatic blockers yet.
- Decide Billing-disabled handling during M18; preserve current behavior until then.

**Recommended after the new clarification:** Plan E once its consequential rules are agreed. Distinguish a true no-dues result from conditional no-objection with an agreed handover. A handover does not create a payment or zero the unit ledger, and must not automatically expose the previous occupant's entire history to the incoming person. The enforceability/release of legal liability requires verification.

**Acceptance:** An application is not an issued NOC; past PDFs retain their original meaning. Do not imply cleared dues when Billing is disabled. Plan the replacement contracts, access limits and existing-data impact explicitly before implementing the selected policy; detailed transfer integration remains dependent on M18 decisions.

For accepted E, the existing D-50 no-override block remains until M18 policy review, governing-document updates and implementation are separately authorized and completed. Ordinary service requests must not silently become exit blockers. When Billing is disabled, today's move-out NOC explicitly says not checked; whether that remains allowed for expanded clearance awaits M18, not a zero-balance assumption. Require traceable party agreement, tenant-unit-owner consent where applicable and admin society acceptance before handover-based clearance. Eligible incoming-party details, pending-action definitions, Billing-off rules, approval evidence, legal wording and retention/access design must be settled before the affected work is built.

**Depends on:** M18 transfer/NOC decisions, existing authoritative billing dues and GAP-M25-07 if a printable application is adopted.

**Risks / verify:** Member rights, property transactions, privacy and legal reliance. **Verify against the state co-operative act / our bye-laws**. This is a scope/meaning conflict, not proof the narrow current NOC is wrong.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Chosen option:** [ ] A [ ] B [ ] C [x] E\
**Owner decision:** Accepted for planning with the confirmed policy and M18 review gates above. Scope/approval are revisitable choices, not permission to override current behavior now.

## Decisions and next steps

- **Accepted 2026-11-18:** all ten M25 cards: 01, 02, 03-A, 04-A, 05, 06, 07, 08-A, 09-D, 10-E. None rejected or wholly deferred. For 01/02/05/06/07 the owner supplied no additional reason; do not invent one.
- **Still open:** M18 pending-action definitions and Billing-disabled policy; revisit accepted handover scope/approval there. Deposit accounting/rules await M11/M19 kickoff; society-profile sensitivity/visibility and new-feature access need their own kickoff decisions. These gates do not defer the whole accepted items.
- M25 decision forms are complete; every selected option and unresolved policy gate is recorded. Future batches still need Accept / Reject / Defer with no default; rejection needs a reason and deferral needs a reason plus trigger/target phase.
- The owner reviewed and approved the exact preview before saving. All ten decided IDs, dates, options and reasons/qualifications are now in the existing plan, linked to P35 tasks. Unanswered policies remain open, not silently chosen.
- Only the existing app plan and this session report were edited. No application/schema/migration/test changes, commits, pushes or hosted changes were made. Pre-existing lockfile and skills-directory changes remain untouched.
- **Remaining module order after M03:** M02 members -> M08 billing -> M09 dues -> M11 accounts -> M10 funds -> M12 statements (both versions) -> M13 budget -> M01 dashboards -> M04 registration/bye-laws -> M06 meetings -> M07 elections -> M14 vendors/AMC -> M15 staff/payroll -> M16 helpdesk -> M17 repairs/redevelopment -> M18 transfer/NOC -> M19 tenants/parking/facilities -> M20 audit/compliance (both versions) -> M23 communication -> M24 insurance/legal/disputes.
- M05 is unavailable; M21/M22 are excluded. Remaining modules have not been comprehensively compared, scored or assumed covered; only the narrow Tool 85/98 and M18 clearance follow-ups described above have been examined.

## Implementation-plan preview - approved and saved

The following is the exact owner-approved preview, retained as review history. It has been saved to the existing implementation plan, with formatting only. Existing phase delivery marks, PRD requirements, code, database files and tests remain untouched.

### A. Header, reading rules and overview

- Replace the version with `0.3 (M25 toolkit decisions and planned P35 additions)`.
- Replace the date with `2026-11-18 (first draft 2026-11-09)`.
- Append to Scope: `Accepted M25 housing-toolkit additions are planned in P35; this does not authorize implementation or release.`
- In the status-marks reading rule, replace `both overview tables` with `overview tables` because the new overview below is a third table.
- After the existing scope-authority reading rule, add:

```markdown
- **Toolkit planning:** accepted toolkit decisions are recorded in this plan for future work, not as changes already made to the app. Before implementing them, update and obtain any required approval for the owning PRD/DESIGN/DATABASE/API contracts. Existing guarantees remain in force until the corresponding replacement is approved and built.
```

After Section 1.1 and before Section 2, add:

```markdown
### 1.2 Accepted housing-toolkit additions (P35)

| Phase | Enhancement                                                                                                                                    | Source                    | Estimate                                         | Prerequisites                                                                  | Status          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ | --------------- |
| P35   | Society reference/setup, manual adoption, committee action plan, help, scoped letters, optional booking deposits and exit/owner-sale clearance | M25 decisions, 2026-11-18 | Not estimated; split into safe blocks at kickoff | Existing Core/module services; per-task review and policy gates below; not P34 | ⬜ Planned only |

P35 is the first accepted toolkit batch, not approval of the remaining 21 housing modules. Financial and clearance work waits for its named review gates; independent items need not wait for unrelated deferred work. P10 pilot/go-live gates and all existing release approvals remain unchanged.
```

Extend the Section 2.2 heading to:

```markdown
### 2.2 Module completion gate (applies to P5–P8, the module phases P11–P34, P35 enhancements and the platform modules in P4)
```

### B. New P35 phase

Insert after P34 and before the unnumbered Android reference:

```markdown
# Phase P35 — Toolkit Housing Additions (M25 review)

**Goal:** enrich the existing app with the accepted setup/help/working tools and the explicitly selected financial/clearance additions, without replacing working modules or treating workbook examples as requirements.

**Prerequisites:** existing Core, module registry, units/memberships, files, role checks and current domain services. P34 is not a dependency. Build in independently verified slices; estimate and split into 6-hour blocks only after each slice's kickoff decisions are resolved.

**Source and approval:** M25 Tools 289–300, reviewed at detail level; decisions accepted for planning on 2026-11-18 in the [Toolkit Review Decisions](#toolkit-review-decisions) register below. Tools 293/294 add no work: synthetic housing examples are already covered at feature level; credit examples are outside scope. Narrow Tool 85/98 and M18 follow-ups are evidence, not completed reviews of those modules.

**Kickoff gates:** agree access, purpose and retention for new data; map the society-profile fields to existing authoritative sources before adding fields. Resolve deposit accounting/receipt/deduction/refund rules through M11/M19. For clearance, apply the M18 decisions recorded in P51; resolve remaining legal, authority, evidence, access and retention gates, plus unit/member/ownership mappings with M02/M03. Update and approve the owning requirements/contracts before changing current behavior.

**Tasks:**

| ID                        | Task                                                                                                       | Depends on                                                                                                                              | Toolkit sources                                        | Status |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| <a id="p35-1"></a>P35.1   | Record unchanged finance, controlled-list and tenant-privacy rules in the implementation kickoff/contracts | Existing behavior; GAP-M25-03-A/04-A/08-A                                                                                               | 291, 292, 300 Template 10; 85/98 clarification         | ⬜     |
| <a id="p35-2"></a>P35.2   | Society reference-profile mapping and permitted data/operations                                            | P35.1; field-purpose/access decisions                                                                                                   | 291                                                    | ⬜     |
| <a id="p35-3"></a>P35.3   | Reference-profile and advisory setup-completeness screens/reports                                          | P35.2                                                                                                                                   | 291                                                    | ⬜     |
| <a id="p35-4"></a>P35.4   | Manual capability-adoption register and progress summaries                                                 | Existing society/module data; agreed access                                                                                             | 289                                                    | ⬜     |
| <a id="p35-5"></a>P35.5   | Standalone committee action-plan records and date/status rules                                             | Existing memberships and meeting-action patterns; agreed access                                                                         | 297                                                    | ⬜     |
| <a id="p35-6"></a>P35.6   | Committee plan screens, weekly timeline and summaries                                                      | P35.5; P35.3 only for a setup-readiness link                                                                                            | 297                                                    | ⬜     |
| <a id="p35-7"></a>P35.7   | Searchable app-specific help and getting-started content                                                   | Existing routes, role checks and language approach; future-feature topics wait for delivery                                             | 290, 295, 296, 298, 299                                | ⬜     |
| <a id="p35-8"></a>P35.8   | Optional booking-deposit configuration, original-term snapshots and accounting contracts                   | P35.1; existing amenity/billing; M11/M19 decisions                                                                                      | 300 Template 11                                        | ⬜     |
| <a id="p35-9"></a>P35.9   | Deposit receipt, deduction and refund records, authorized screens and reconciliation                       | P35.8; approved financial rules                                                                                                         | 300 Template 11                                        | ⬜     |
| <a id="p35-10"></a>P35.10 | Update and approve clearance contracts using the M18 decisions recorded in P51                             | P51; M02/M03 ownership/member mapping; legal, authority and evidence gates                                                              | 300 Template 6 distinction; 207, 208, 209, 214         | ⬜     |
| <a id="p35-11"></a>P35.11 | Clearance cases, settlement/handover evidence, scoped approvals and completion integration                 | P35.10; existing authoritative unit dues, Core occupancy/access and tenancy services                                                    | 207, 209, 214                                          | ⬜     |
| <a id="p35-12"></a>P35.12 | Separately identified no-dues/conditional-clearance outputs and issue history                              | P35.11; approved legal wording, access and file policy                                                                                  | 208, 209, 214; 300 application/certificate distinction | ⬜     |
| <a id="p35-13"></a>P35.13 | Supported correspondence formats using existing rendering/download patterns                                | Existing source records; P35.2 only for new letterhead fields; P35.9 for deposit-specific booking output; P35.12 owns clearance outputs | 300                                                    | ⬜     |

**Acceptance by task:**

- **P35.1 — keep current rules (GAP-M25-03-A/04-A/08-A).** Preserve fixed, per-area and manually entered per-unit charge heads; optional monthly flat/percentage late fees after due date plus grace, at most once per source bill/calendar month, on eligible regular bills/manual fines and never fee-on-fee; percentage uses outstanding, not daily proration. Preserve current permissions, immutable published history and April–March expense-report defaults. No annual daily-interest method or new charge basis is adopted here; compare optional additions separately in M08/M09. Keep domain category editors and validated payment/role/relationship/workflow values, not a central free-list editor. Legal membership is not occupancy. Keep digital tenancy and its existing permitted evidence/access/retention; add no extra tenant-information sheet, printable summary, ID-copy request or other personal fields. Future clearance changes are separately gated under P35.10–P35.12.
- **P35.2 — reference data (GAP-M25-02).** Map all 39 source fields instead of creating 39 duplicate columns. Identity: society name/type, registration number/date/authority, society PAN, address/city/state/PIN and official email/phone. Governance: bye-laws adoption, committee size/term, last AGM/election, auditor/category and financial-year start. Property: wings/units/statutory members/parking counts, construction year and built-up area. Finance: maintenance/sinking-fund rates, annual-arrears-interest/grace references, bank name, last four account digits only and IFSC. Office bearers: chairman/secretary/treasurer names and mobiles. Existing profile/configuration/registers remain authoritative: no single summary rate overrides charge heads or current late-fee rules; no reference financial-year field changes reporting. Do not equate resident count with legal members or the current area field with verified built-up area. Protect sensitive fields with agreed purpose/visibility before collection; no full bank-account number. Statutory/profile mappings await their relevant module reviews; missing sources remain unavailable, not invented zero.
- **P35.3 — completeness (GAP-M25-02).** Show source-linked, advisory Filled/Missing/Optional/Not applicable information and section/required-field completion. Source rule: `=IF(D8<>"","Filled",IF(E8="Yes","Missing","Optional"))`; approve applicable required fields instead of copying blanket workbook flags. Existing societies are not blocked by missing reference data, and co-operative-only fields are not mandatory for every RWA. Do not invent an AGM/election deadline or default term.
- **P35.4 — manual adoption (GAP-M25-01).** Persist per-society capability, `Adoption Status` (`Not Started, Exploring, In Use, Mastered`), `Priority` (`High, Medium, Low`), responsible owner, review date and notes. Show module-wise progress and in-use/mastered, exploring, review-pending and high-priority-pending summaries. Clarify what is built/enabled/unavailable; do not present all 300 tools as app features. Adoption status never toggles a module, grants access or proves readiness. No usage tracking is introduced.
- **P35.5 — action-plan rules (GAP-M25-05).** Plans stand alone without a fake meeting. Include plan start; task/action, phase/category, owner/priority, start/end day, start/due date, status, progress, notes and evidence/link. Statuses: `Not Started, In Progress, Done, Blocked`; priorities: `High, Medium, Low`; categories: `Governance, Finance, Compliance, Operations, Communication, Technology, Safety`. Start/due date = plan start + respective day offset − 1; days left = due date − today. Timeline precedence: Done, otherwise Overdue after due date, Upcoming before start, otherwise On Track. Foundation/Systems/Growth at start-day ≤30/≤60/later are editable planning examples, not legal periods.
- **P35.6 — action-plan use (GAP-M25-05).** Provide weekly timeline and total/completed/in-progress/overdue/high-priority-open, progress and next-seven-day summaries. Link/reuse an existing meeting action instead of keeping conflicting completion states. Preserve existing meeting `open/done` behavior; users see only evidence they may access. Source tasks are editable suggestions, not approval to build their referenced payroll/funds/redevelopment features. A plan never enables a module or alters financial/legal history.
- **P35.7 — help (GAP-M25-06).** Search/filter by category and relevant role/module using Tool 299's category, question, answer, applies-to, level (`Beginner, Intermediate, Advanced`) and added-on concepts. Resolve personal-note visibility if retained. Adapt “set up once → enter data → read dashboard” to real app screens and current English/Hindi patterns. Existing marketing FAQ/runbooks remain; no new search service or translation platform. Do not present spreadsheet cell instructions, unavailable features, unconfirmed payments or deferred messaging/demo features as working app functionality.
- **P35.8 — deposit opt-in (GAP-M25-09-D).** Deposits are optional and off by default. When off, retain current fee-only booking and permitted full-cancellation-credit behavior. Prior bookings retain their original terms. Separately model agreed deposit amounts/terms and approved accounting/access rules; do not treat a booking confirmation as payment received. M11/M19 must resolve receipt, deduction, refund, cancellation, account mapping and correction rules before the affected work starts.
- **P35.9 — deposit history (GAP-M25-09-D).** Track amounts received/refunded/deducted/outstanding separately with authorized actions, evidence/audit and reconciliation to approved accounting records. Keep money append-only and prevent duplicate financial actions. Merely switching the option off must not erase or falsely settle earlier deposits; agree how their outstanding lifecycle remains manageable at kickoff. No payment gateway, platform-held funds or automatic bank refund is authorized.
- **P35.10 — clearance policy (GAP-M25-10-E).** Scope is tenant move-out and owner sale/transfer, not general mortgage/loan applications. Current selected handover scope covers both; outgoing/incoming parties agree, the unit owner also consents for tenant handover, and society admin approves. Revisit scope and approval in M18 as the owner requested. Owner consent here is for handover, not an added requirement for every settled tenant move-out. Pending-action definitions and Billing-disabled handling are unresolved until M18; do not introduce automatic blockers meanwhile. Resolve eligible incoming parties, dues/responsibility mapping, approval evidence, retention/access and legal text there. An app ownership relationship or NOC is not proof or execution of legal title transfer.
- **P35.11 — clearance workflow (GAP-M25-10-E).** Subject to the finalized policy, support settlement or the specifically accepted, society-approved handover of identified obligations. Keep agreement and approval history tied to the unit, parties and authoritative dues; expose only the relevant agreed obligations, not unrestricted previous-occupant history. Handover is not payment, waiver or deletion of the unit balance. Coordinate with existing Core owner/access changes and tenant actual-completion rules; issuing a document alone does not grant/remove occupancy or access. Implement a deliberate, documented replacement of D-50's no-override dues block only after M18 decisions and owning-contract updates; no bypass is authorized now.
- **P35.12 — honest certificates (GAP-M25-10-E).** Allow a distinctly labelled conditional NOC listing outstanding obligations and accepted handover; reserve no-dues claims for verified clearance, and unconditional exit clearance for all applicable obligations being settled. A failed/disabled dues check is never zero/cleared. Preserve today's explicitly Not checked Billing-off tenancy path pending M18's replacement policy; do not infer an expanded financial-clearance policy from it. Identify case/purpose, parties/unit, issue date, issuing authority, dues/obligation snapshot, conditions and agreement/approval reference. Keep issue history and old PDF wording/meaning; do not relabel or regenerate past certificates. Preserve existing private-file, exact-artifact and font-support safeguards. A request/application is not an issued certificate.
- **P35.13 — correspondence (GAP-M25-07).** Reuse existing meeting notices/minutes and financial PDFs. Adapt supported source formats for dues reminders/final notices, member welcome, complaint acknowledgement, rule-violation warnings, hall confirmation, vendor work order and water/power shutdown. Exclude source Template 10 under 08-A; do not enable Template 6 as a generic mortgage/loan application. Required clearance outputs belong to P35.12. Booking confirmations reflect actual saved fee/deposit terms and confirmed amounts only, not assumed receipts/refunds. Authorized users preview/download drafts using permitted records and society letterhead; rendering does not publish money, approve recovery action, widen repository requests or introduce a sending channel. Use actual app priorities. Approve applicable legal wording/deadlines before statutory or rights-affecting use.

**Database and API changes:** planned only. Reuse existing domain/Core boundaries and the single registry; finalize only the necessary profile, adoption, action-plan, deposit and clearance records/operations at the relevant kickoff. Future schema changes are forward-only, society-scoped, protected by row-level security and accompanied by generated types and database tests; money/history stays append-only. No schema, route, new module key, dependency or privileged-client expansion is authorized by this planning entry.

**Tests to add when implementing:** targeted regressions for unchanged policy/defaults and old booking/certificate meaning; setup-source/completeness and action-date boundaries; role/society/module isolation; deposit lifecycle, duplicates and reconciliation; clearance agreement/approval, fresh dues checks, unpaid-versus-cleared and failed/disabled-check behavior, concurrent changes and historical documents; authorized phone/desktop journeys with all required states and accessibility checks. Reuse the app's local runners and synthetic data; these tests have not been implemented or run for P35.

**Completion criteria:** each delivered slice satisfies Section 2.2 and its approved acceptance criteria; owning documents match the implemented behavior; unresolved slice-specific gates are closed explicitly. New module capabilities ship dark/off as applicable; defaults and existing data retain their agreed meaning. Legal/statutory points: **verify against the state co-operative act / our bye-laws**. No live collection, rollout or financial action follows from plan acceptance.

**Status:** ⬜ Accepted for planning only, 2026-11-18. Not implemented, not tested as new functionality, not scheduled or estimated, not released, not owner-UAT-approved and not enabled live. M11/M19 deposit rules and M18 clearance gates remain open; current app behavior is unchanged.

---
```

### C. Decision register

Insert after Assumptions and Decisions and before Current Next Steps:

```markdown
# Toolkit Review Decisions

**Review date:** 2026-11-18. **Scope:** housing only, all 22 available housing modules, detail level, one module at a time. M05 is missing and must not be reconstructed; M21/M22 are excluded; M12/M20 each have two versions to compare as one capability. Toolkit sample rates, fees, dates and rules are not authority.

**M25 complete:** all 12 tools (289–300) compared; ten merged decisions: 1 NEW, 4 ENHANCEMENT, 5 CONFLICT. All ten accepted for planning; none rejected or wholly deferred. Tool 293 housing examples are already covered at feature level; Tool 294 credit examples are not relevant. Acceptance does not mark new functionality built/tested or settle the named kickoff questions.

| ID         | Type        | Decision / option                                              | Date       | Owner reason / qualification                                                                                                                                                                                                                                                                                                                                              | Plan entry                                     |
| ---------- | ----------- | -------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| GAP-M25-01 | NEW         | Accept                                                         | 2026-11-18 | Owner selected Accept; no additional reason supplied                                                                                                                                                                                                                                                                                                                      | [P35.4 manual adoption](#p35-4)                |
| GAP-M25-02 | ENHANCEMENT | Accept                                                         | 2026-11-18 | Owner selected Accept; no additional reason supplied; source/privacy mapping gates apply                                                                                                                                                                                                                                                                                  | [P35.2–P35.3 profile and completeness](#p35-2) |
| GAP-M25-03 | CONFLICT    | Accept A — keep current behavior                               | 2026-11-18 | Preserve current finance behavior; compare optional additions separately in M08/M09                                                                                                                                                                                                                                                                                       | [P35.1 current-policy guardrails](#p35-1)      |
| GAP-M25-04 | CONFLICT    | Accept A — keep current editors/values                         | 2026-11-18 | Retain domain category editors and protected values                                                                                                                                                                                                                                                                                                                       | [P35.1 current-policy guardrails](#p35-1)      |
| GAP-M25-05 | ENHANCEMENT | Accept                                                         | 2026-11-18 | Owner selected Accept; no additional reason supplied                                                                                                                                                                                                                                                                                                                      | [P35.5–P35.6 committee action plan](#p35-5)    |
| GAP-M25-06 | ENHANCEMENT | Accept                                                         | 2026-11-18 | Owner selected Accept; no additional reason supplied                                                                                                                                                                                                                                                                                                                      | [P35.7 help](#p35-7)                           |
| GAP-M25-07 | ENHANCEMENT | Accept — scoped by 08-A/09-D/10-E                              | 2026-11-18 | Owner selected Accept; no additional reason supplied; no unsupported fields or promises                                                                                                                                                                                                                                                                                   | [P35.13 correspondence](#p35-13)               |
| GAP-M25-08 | CONFLICT    | Accept A — digital tenancy; no added form                      | 2026-11-18 | Keep digital tenancy; add no printable information form                                                                                                                                                                                                                                                                                                                   | [P35.1 current-policy guardrails](#p35-1)      |
| GAP-M25-09 | CONFLICT    | Accept D — optional deposits, off by default                   | 2026-11-18 | D-84 records the proposed deposit lifecycle and accounting; preserve fee-only behavior when off; coding remains separately gated                                                                                                                                                                                                                                          | [P35.8–P35.9 optional deposits](#p35-8)        |
| GAP-M25-10 | CONFLICT    | Accept E — exit/owner-sale clearance with conditional handover | 2026-11-18 | M18 later confirmed both case types and admin approval: only verified money owed blocks under the normal check; an agreed, admin-approved conditional handover may leave an identified obligation outstanding, other pending actions do not block by themselves, and Billing-off paperwork says “Not checked / conditional.” Legal and contract approval remains required | [P35.10–P35.12 clearance](#p35-10)             |

**Keep-current choices:** 03-A, 04-A and 08-A confirm the app's current behavior as intended; do not re-raise the same conflicts without changed evidence/need. M08/M09 may compare genuinely optional finance additions separately. M19 should reuse 08-A and 09-D, not reopen them by omission.

**Still open, not decided by this register:** M18 pending-action definitions and Billing-disabled policy; revisit selected handover scope/approval there. Deposit accounting and detailed receipt/deduction/refund/cancellation rules await M11/M19; profile sensitive-field purpose/visibility and new-feature access remain kickoff gates. No default answer or implementation permission is implied.

**Remaining review order (21 modules, not yet comprehensively compared):** M03 units → M02 members → M08 billing → M09 dues → M11 accounts → M10 funds → M12 statements (both versions) → M13 budget → M01 dashboards → M04 registration/bye-laws → M06 meetings → M07 elections → M14 vendors/AMC → M15 staff/payroll → M16 helpdesk → M17 repairs/redevelopment → M18 transfer/NOC → M19 tenants/parking/facilities → M20 audit/compliance (both versions) → M23 communication → M24 insurance/legal. Narrow Tool 85/98 and M18 clarification reads do not count as completed reviews.

Future batches extend this register for every Accept/Reject/Defer. Rejected conflicts must explicitly confirm current behavior as intended; deferrals need owner reason and reconsideration trigger. Merge repeated capabilities into the existing accepted tasks. Legal/statutory points: **verify against the state co-operative act / our bye-laws**.

---
```

### D. Current Next Steps

Append without changing any existing next-step item:

```markdown
- **Toolkit review (planning only):** M25 decisions are recorded above; P35 is accepted future work with explicit kickoff gates, not implementation authorization. Continue the agreed review with M03 units, then M02 members; preserve all existing release/UAT/go-live priorities.
```

## Saved-plan verification

- Owner explicitly selected `Approve — save the previewed plan edits`.
- Re-read the saved header, overview, completion gate, complete P35 section, decision register and file end.
- `npx --no-install prettier --check docs\IMPLEMENTATION_PLAN.md`: passed.
- `git --no-pager diff --check`: passed.
- Read-only local text validation: saved P35 and decision register match the approved preview apart from formatting; 13 unique task anchors, ten accepted decision rows and all decision-to-task links verified; header/overview/gate/next-step edits present.
- Repository diff for the plan: 102 insertions, 9 deletions; status contains only this plan plus the pre-existing lockfile/skills changes. No app test suite was rerun for this documentation-only save; the earlier five-file/128-test baseline result remains separately recorded.
- M25 batch complete; M03 comparison and decision cards are complete and awaiting owner choices. M02 is next after those decisions; 20 modules remain unreviewed. This does not claim the whole toolkit review is complete.

## M03 · Flat / Unit & Ownership Records

Review date: 2026-11-18. All twelve tools (25–36) were compared with current Core structure, occupant/membership, tenancy, document, analytics, billing and parking contracts. Ten merged decision cards: **5 NEW, 5 ENHANCEMENT, 0 CONFLICT**. No whole tool is wholly covered or irrelevant; unit identity, basic unit fields and soft-deactivation are already built, while each tool adds or partly repeats a meaningful function. This is a toolkit-vs-app classification, not a finding that existing behavior is wrong.

### Ten most valuable items

| Rank | ID         | Finding                                                                               | Recommendation                                                                              |
| ---- | ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | GAP-M03-04 | Legal ownership transfers and co-holder interests are not the same as app occupancy   | Accepted for planning with M02/M18 policy gates                                             |
| 2    | GAP-M03-01 | One app area cannot safely stand in for both carpet and built-up measurements         | Accept a verified area profile, without changing today's billing basis by assumption        |
| 3    | GAP-M03-03 | Existing digital tenancy evidence could feed a useful compliance view                 | Accept only a derived, role-limited view; do not re-enter tenant details                    |
| 4    | GAP-M03-05 | Allotment letters and balances are a distinct capital/receipt ledger                  | Accepted for planning with M10/M11 gates; do not treat as paid/posted without policy        |
| 5    | GAP-M03-06 | The repository stores files, not a structured record of agreement copies and metadata | Accept a restricted metadata/index enhancement, not new legal conclusions                   |
| 6    | GAP-M03-07 | Property handover checks differ from the tenancy move workflow                        | Accepted for planning with M18/M19/M26 gates                                                |
| 7    | GAP-M03-09 | No lifecycle is recorded when a unit is vacant or locked                              | Accept a minimal, private operational tracker; do not change billing or unit activation     |
| 8    | GAP-M03-08 | Per-unit document completeness and missing-item follow-up are not tracked             | Accept a linked index; avoid declaring legally required documents missing without authority |
| 9    | GAP-M03-02 | No visual building/floor map exists                                                   | Accept a read-only layout built from real unit records, not the sample tower geometry       |
| 10   | GAP-M03-10 | Existing occupancy analytics are aggregate, not a role-checked Unit 360 view          | Accept a live read-only summary, never duplicate or manually key financial data             |

### Money, legal and member-rights risks in this batch

- **Area/billing:** Tool 28's area share and monthly maintenance base may affect who pays what. Homeish currently has one `area_sqft`, which can feed per-square-foot charges. Do not select carpet, built-up, loading, total-area share or maintenance bases until M08 and applicable governing rules are checked. **Verify against the state co-operative act / our bye-laws** where applicable.
- **Ownership/member rights:** Tools 29–30 track legal transfers, holders and share percentages. Homeish's `owner` occupant relation is not proof of legal title, and `memberships` grant app roles rather than co-operative share ownership. Any share/title registry affects legal and member rights. **Verify against the state co-operative act / our bye-laws** and align with M02/M18.
- **Allotment money:** Tool 31's value/received/balance figures could be mistaken for an authenticated society receivable or payment. Do not connect this to unit dues, bills or cash/bank books without M10/M11 and an owner-approved ledger/reconciliation policy.
- **Documents and privacy:** Tools 30 and 34 include ID-proof tracking; Tool 32 includes registration and stamp-duty data; Tool 35 includes owner contact and sensitive vacancy reasons; Tool 36 includes unit-level contact and dues. No ID copies, broad contact exposure, dispute inferences or new collection purpose are approved by this comparison. Respect current unit-document audiences, role rules and data minimization.
- **Handover/clearance:** Tool 33 includes a manually entered `Dues Cleared` value. Never treat that checkbox as the authoritative billing ledger or as a substitute for the accepted-but-not-yet-built M25 conditional-clearance work. Handover does not grant/remove occupancy or access.
- **No direct existing-policy conflict found** in M03: the toolkit's extra ownership/area/vacancy records are largely features Homeish does not claim to have. Do not mistake gaps for approval to change occupancy, billing, document audiences, owner consent or legal processes.

### Source and app evidence

- Toolkit guide: [M03 overview](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_GUIDE.md#module-3>).
- Detailed reference: [Tools 25–36](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#ref-m3>), read in full. No original workbook was opened because the reference supplied the field lists/statuses and dashboard measures needed for comparison; sample formulas beyond the documented summaries were not independently validated.
- Governing app behavior: [PRD CORE-6 to CORE-10](./PRD.md#L164), [unit/occupancy schema](./DATABASE.md#L215), [unit operation validation and CRUD](../src/core/structure/operations.ts), [CSV preview/import](../src/core/structure/units-csv.ts), [admin structure screen](<../src/app/(admin)/admin/structure/page.tsx>), [tenancy PRD](./PRD.md#L492), [document data/access](./DATABASE.md#L924), [existing unit-occupancy analytics metric](../src/core/analytics/catalogue.ts#L12), [structure integration test](../tests/integration/database-structure.test.ts) and [CSV unit tests](../tests/unit/units-csv.test.ts).
- Current app unit record: optional block, number, optional integer floor, free-label unit type, one optional square-foot area and active/inactive. Admin creates/edits/deactivates and imports up to 1,000 validated rows via preview/job; duplicates and cross-society blocks are rejected, and records with history are deactivated rather than deleted.
- Separate built records cover owner/tenant/family occupancy, one active primary contact, occupancy dates/status and tenancy move-in/out with agreement expiry, optional configured police proof and an NOC. The unit profile does not store legal title/share, co-owner percentage, building position, carpet and built-up areas separately, occupancy/vacancy status, handover condition/keys/snags or a property ownership-transfer history.
- Document Repository supports private, versioned per-unit files with `all_occupants` or `owners_only` audience; it is not a physical-original/copy register, document completeness score or legal checklist. Analytics has an aggregate `core.occupancy` metric, not a Unit 360 person/dues lookup. Parking and Billing data are separately authoritative and optional.
- Existing M25 P35 decisions matter: no extra tenant-information sheet (08-A); optional booking deposits (09-D) are separate from allotment receipts; exit/owner-sale conditional NOC (10-E) remains future work with M18 policy gates. Avoid duplicate or contradictory tasks.

### Decision cards

#### GAP-M03-01 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Expand the single app area value into a source-aware, verified area profile.

**Why it helps:** Separate carpet from built-up area and reveal unverified measurements without silently changing unit charges.

**Toolkit source:** [Tool 25](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t25>), [Tool 28](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t28>).

**App today:** [Unit schema](./DATABASE.md#L215) has one optional `area_sqft`; [structure form](../src/components/structure/structure-controls.tsx#L260) edits it; Billing can use it for per-square-foot charges. No separate carpet/built-up/balcony values, measured-by/date, or verified/pending/re-measure record found.

**Toolkit difference:** Tool 25 captures carpet and built-up area and reports total carpet area, average unit size, maintenance potential and completeness. Tool 28 adds balcony/terrace area, square-metre conversions, loading %, share of total area, a monthly maintenance base and `Verified, Pending, Re-measure` with verifier/date. The reference does not establish a formula or legal billing basis for those calculated fields.

**Change needed:** Optional, provenance-aware measurements and verification status; totals and conversions shown with their units. Keep the existing area value and all bills/history unchanged unless an explicit mapping/migration and M08 billing decision are approved. Do not use any toolkit share/maintenance formula as a default.

**Acceptance:** Missing values remain unknown; verification means an authorized person recorded a source/date, not that legal area was certified. Existing per-square-foot billing keeps its approved basis and published amounts. Carpet/built-up selection, loading and shared-area allocations wait for the applicable by-law/M08 decision.

**Depends on:** Existing Core units; M08 for any charge calculation; M04/M18 if measurement evidence or legal records are required.

**Risks / verify:** Billing fairness, title/area evidence and immutable published bills. **Verify against the state co-operative act / our bye-laws** where area or allocation rules apply.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted as scoped; no additional reason supplied.

#### GAP-M03-02 · NEW · Value M · Effort M · Confidence High

**What:** A read-only wing/floor layout derived from the unit register.

**Why it helps:** Staff can see where units sit and their current known occupancy without maintaining a second flat list.

**Toolkit source:** [Tool 26](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t26>).

**App today:** [Admin structure](<../src/app/(admin)/admin/structure/page.tsx>) lists blocks and units. Core stores block, number and optional floor; no building-grid/position map was found.

**Toolkit difference:** A derived grid uses wing/building, floor and flat position; it colors owner, tenant, vacant, locked and renovation, and counts mapped units, wings/floors and layout fill. Its example uses fixed wings/floors/positions; these are not universal building rules.

**Change needed:** Render a layout from existing block/unit rows, with missing-position and unsupported-layout states. Do not add a position field unless real societies need it and the owner approves. Do not hard-code four wings, six floors or four flats per floor.

**Acceptance:** The map is a view, not another master. It links to the existing unit record, updates from that source and does not infer a legal owner from an occupant contact. Show only statuses supported by approved records; vacancy/locked/renovation state is GAP-M03-09, not guessed from `unit.active`.

**Depends on:** Core structure; approved physical layout/status source and role visibility.

**Risks / verify:** Incorrect maps can misdirect residents/responders; layout reveals occupancy patterns. Limit access and do not expose a detailed resident map to unauthorized roles.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted as scoped; no additional reason supplied.

#### GAP-M03-03 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** A tenancy-status and compliance summary derived from current tenancy records.

**Why it helps:** Admins can see upcoming agreement expiry and missing configured proof without keeping a parallel spreadsheet.

**Toolkit source:** [Tool 27](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t27>).

**App today:** The app already distinguishes owner/tenant/family occupancy, stores tenancy agreement expiry, supports configurable police proof and issues move-out NOCs. Existing admin/committee/guard views have different scopes. No separate tenant-compliance dashboard or report of all units was found.

**Toolkit difference:** Summary figures include owner-/tenant-occupied, fully compliant, agreement expiry within 60 days/expired, police verification pending and NOC pending. Manual fields include `Registered, Notarised, Pending, Expired, Not Applicable`; police status `Done, Pending, Not Applicable`.

**Change needed:** If accepted, derive only indicators supported by existing requests/docs and current society settings; do not duplicate tenant name/contact fields or accept manual statuses that contradict the authoritative tenancy flow. Do not label an agreement legally “registered” or “notarised” unless that status is verified and already supported.

**Acceptance:** A missing document is not a missing consent; optional/off police verification is not a compliance failure. Pending NOC reflects the actual request state, and expiry uses the stored agreement date. Admin access follows Tenancy; committee gets only the existing permitted projection; guards do not gain tenant names, files or contact data.

**Depends on:** Existing Tenancy/Directory and role projections; M19 review may merge repeated tenant reporting into this same item.

**Risks / verify:** Tenant privacy and legal/compliance wording. **Verify against the state co-operative act / our bye-laws**; no toolkit label alone is a legal determination.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted as scoped; no additional reason supplied.

#### GAP-M03-04 · NEW · Value H · Effort L for decision, H for legal workflow · Confidence High

**What:** A legal ownership-transfer history and co-holder/share record distinct from app occupancy.

**Why it helps:** Unit access roles and who lives there do not by themselves establish who holds title or shares.

**Toolkit source:** [Tool 29](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t29>), [Tool 30](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t30>).

**App today:** [Database contract](./DATABASE.md#L231) records memberships for app access and `unit_occupants` for owner/tenant/family occupancy; it preserves historical occupancy. It has no legal title-holder, share percentage or sale/gift/inheritance history.

**Toolkit difference:** Tool 29 records previous/new holder, transfer type/date, consideration, fee, certificate and registered-document identifiers/status. Tool 30 records primary/joint holders, relationship, share %, active/removed, and ID-proof type/status. Dashboard summarizes transfers and share errors.

**Change needed:** First decide whether Homeish should be an authoritative legal title/share register or merely index society-confirmed transfer records. Do not change membership roles from a share-holder entry. No ID type/copy collection is included in this proposal. Ownership transfer review belongs with M18 and legal member mapping with M02.

**Acceptance:** Never infer title from a user's `owner` occupancy or make app access depend on an unverified share percentage. Any approved record identifies source, effective date, approving authority and correction/history semantics. Do not calculate member votes or statutory rights until the governing rules and M02/M07 are reviewed.

**Depends on:** M02 members/legal membership; M18 transfer/NOC; M04 registration/bye-laws. The already accepted M25 clearance item is not a title-transfer registry.

**Risks / verify:** High member/property-rights impact; consideration/fee values are sensitive. **Verify against the state co-operative act / our bye-laws** and applicable property process before treating it as authoritative.

**Recommendation:** Defer the authoritative design decision until M02/M18 rather than accidentally creating a second legal member register.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted for planning with M02/M18 title/member-policy gates; no additional reason supplied.

#### GAP-M03-05 · NEW · Value M · Effort M · Confidence High

**What:** Allotment-letter lifecycle and amount-received/balance tracking.

**Why it helps:** Societies with an allotment process can track draft, issue, acknowledgement and follow-up for an original allocation.

**Toolkit source:** [Tool 31](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t31>).

**App today:** Unit setup and occupant/member workflows exist, and Billing/Expense manage their own operational money. No allotment-letter record or capital allotment receivable was found. Billing ledger rules govern unit bills/payments, not proof of allotment consideration.

**Toolkit difference:** Letter number/date, unit/allottee, allotment value, amount received, derived balance/paid percentage/payment status, draft/issued/acknowledged/cancelled, issue/ack dates and follow-up.

**Change needed:** If later accepted, separate document lifecycle from money posting. A recorded received amount must link to authoritative accounting evidence; a hand-entered amount must not appear as paid, confirmed or unit-dues credit.

**Acceptance:** No duplicate/conflicting money ledger; no automatic bill, fee, transfer, receipt or collection is created. Corrections and receipts follow the owner-approved M10/M11 policies; draft/cancelled letters do not create receivables.

**Depends on:** M10 funds and M11 accounts; M02/M18 for membership/allotment authority; M04 for legal content.

**Risks / verify:** Capital money, financial statements, title/allotment representations. **Verify against the state co-operative act / our bye-laws** and approved accounting treatment.

**Recommendation:** Defer until the accounts/funds modules establish whether this app should keep the ledger at all.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted for planning with M10/M11 accounting-policy gates; no additional reason supplied.

#### GAP-M03-06 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Structured metadata for society-held unit agreements, linked to the existing private document repository.

**Why it helps:** A file upload alone does not tell staff which agreement copy it is or whether an original/certified copy remains in physical custody.

**Toolkit source:** [Tool 32](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t32>).

**App today:** [Document Repository](./DATABASE.md#L924) already versions private per-unit files with audience (`all_occupants` or `owners_only`) and retains history. It does not record agreement type, date/registration-office metadata, physical-copy type/location, stamp-duty status or digitization/completeness.

**Toolkit difference:** `Agreement for Sale, Sale Deed, Conveyance Deed, Leave & License, Share Transfer Agreement, Other`; registration number/sub-registrar, original/certified/photocopy/not-received, stamp duty and paid/pending/exempt, storage location, digitized flag.

**Change needed:** Add an indexed metadata record only if staff need it; link to an existing version rather than duplicate the file. Restrict registration details and physical-location fields to authorized staff. Do not declare legal validity, stamp-duty compliance or a missing legal obligation from a checklist.

**Acceptance:** Existing document audiences, private storage, archive/version behavior and download auditing remain authoritative. Metadata cannot widen the people who may download the underlying agreement. If no digital scan exists, say so plainly rather than making a fake file link.

**Depends on:** Existing Document Repository; M04/M18 for approved agreement types and legal wording.

**Risks / verify:** Confidential property records, physical security of originals, legal/stamp-duty interpretation. **Verify against the state co-operative act / our bye-laws** where applicable.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted as scoped; no additional reason supplied.

#### GAP-M03-07 · NEW · Value M · Effort M · Confidence High

**What:** A unit possession/handover event with an agreed checklist and issues.

**Why it helps:** A tenancy move records scheduled and actual occupancy changes, but does not record the property's physical condition or an owner/builder handover.

**Toolkit source:** [Tool 33](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t33>).

**App today:** Tenancy handles move requests, agreement proof, consent, admin review/completion and occupancy/access; the separate utility Metering module tracks readings. No general builder-to-owner, society-to-member or property-condition/keys/snags checklist was found.

**Toolkit difference:** Handover date/type, receiving party and giver, meter reading, unit condition, open snags, keys/meter/document/welcome checks, checklist %, status and possession year. Its `Dues Cleared` is manually entered.

**Change needed:** A separately auditable event linked to a unit and (where appropriate) the existing tenancy/transfer case. Define who records/accepts checks and how evidence is retained. Meter readings should link to the applicable Metering record; do not overwrite it. Do not use a manual dues checkbox as clearance.

**Acceptance:** Recording handover alone does not grant occupancy, remove access, alter unit billing, prove legal possession/title or settle dues. Keep it separate from Tenancy's actual-completion step and from M25's future conditional NOC.

**Depends on:** M18 transfer workflow, M19 tenancy/facilities, M26 metering; existing Core occupancy and Document Repository.

**Risks / verify:** Property condition/evidence, key-security practices, owner/tenant rights. **Verify against the state co-operative act / our bye-laws** where legal handover is claimed.

**Recommendation:** Defer shape and integration until M18/M19 define which party records a handover and what it changes.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted for planning with M18/M19/M26 workflow gates; no additional reason supplied.

#### GAP-M03-08 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** A per-unit document index with accurate missing-item follow-up.

**Why it helps:** Staff can see which records are actually held without searching unrelated file rows.

**Toolkit source:** [Tool 34](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t34>).

**App today:** Unit-specific digital files exist in the Document Repository, including tenancy NOCs when enabled, with private audience and file-version rules. There is no unit folder number, physical shelf index or completeness/missing-document summary.

**Toolkit difference:** Share certificate, allotment letter, agreement copy, ID proof, address proof, nomination, possession and NOC/transfer documents; statuses `Available, Missing, N/A`; folder number/storage location, last audit, count, completeness, missing-document list and folder status.

**Change needed:** Link index entries to the existing document or record types and distinguish physical original/copy from digital file availability. Explicitly exclude ID-proof collection from this plan; no government-ID field or upload is approved. Any allowed document checklist must be owner-approved, not inferred from the toolkit's eight-item list.

**Acceptance:** A missing index entry does not block service, move-out, billing, voting or member rights. Status must accurately say digital file present, physical copy confirmed, not checked or not applicable; do not turn unknown into missing. Existing tenant file restrictions and P18 retention remain unchanged.

**Depends on:** Document Repository, Tenancy and M18/M04 decisions for approved document categories.

**Risks / verify:** Sensitive-file inventory reveals what a society holds and where originals are kept. Keep location/admin metadata narrowly scoped; **verify any mandatory document list against the state co-operative act / our bye-laws**.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted as scoped; no additional reason supplied.

#### GAP-M03-09 · NEW · Value M · Effort M · Confidence High

**What:** A private vacancy/locked-unit follow-up lifecycle.

**Why it helps:** No active occupant does not tell staff whether a unit is deliberately vacant, temporarily locked, being renovated or needs inspection.

**Toolkit source:** [Tool 35](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t35>).

**App today:** `units.active` is an operational deactivation flag; `unit_occupants` separately records active/historical people. Neither is a vacancy state. No vacant-since, reason, inspection or follow-up record was found.

**Toolkit difference:** Vacancy start/reason, owner contact, last inspection, open/contacted/inspected/tenant-arranged/resolved status and next follow-up; derived days vacant, 180+ days, maintenance at risk and overdue follow-up. Some example reasons include disputes or an untraceable owner.

**Change needed:** If accepted, record only a society-authorized, minimal operational status/date and an assigned follow-up. Treat the toolkit reasons and maintenance-at-risk calculation as examples; do not adopt sensitive categories or calculate lost dues without an approved billing rule.

**Acceptance:** Vacancy never deactivates a unit, stops bills, grants access or means the owner cannot be reached. Do not collect extra contacts by default. No vacancy reason/contact appears in guard, resident, committee or public views absent an explicit approved purpose.

**Depends on:** Core units/occupants; M02 owner mapping; M08/M09 before any vacancy/maintenance money figure; approved access/retention rules.

**Risks / verify:** Owner privacy, security of unoccupied units, disputes and maintenance liability. **Verify against the state co-operative act / our bye-laws** before applying any differential charge or legal notice.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted as scoped; no additional reason supplied.

#### GAP-M03-10 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** A live, role-limited Unit 360 view assembled from enabled authoritative modules.

**Why it helps:** Staff need one safe place to understand a unit's structure, occupancy and available linked records.

**Toolkit source:** [Tool 36](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t36>).

**App today:** Core analytics already has an aggregate Unit Occupancy metric; Billing, Parking and Documents have their own authoritative data/screens. The admin structure page lists units, but no linked unit summary was found. The toolkit dashboard's single manual row per unit duplicates area, owner/contact, parking, charges, dues, document completeness and transfer dates.

**Toolkit difference:** Society totals for units/occupancy/outstanding/defaults/billing base/carpet area/parking/document completeness, dues by wing, plus a selected-unit lookup with owner/member, contact, wing/floor/type, area, parking, maintenance and dues rank/status.

**Change needed:** Reuse the normalized source records and existing live report/query patterns; do not make a manually keyed second master sheet. Derive only when the relevant module is enabled and authorized. Use admin-only detail by default; keep committee aggregate metrics within PRD analytics permissions; no residents' cross-unit lookup.

**Acceptance:** No stale copied totals or amounts, no manual dues/document-completeness fields, and no display of data from a disabled module as if current. Dues by wing and person-level fields obey current Billing/Directory/Document audiences; zero/hidden is not inferred from a missing optional module.

**Depends on:** Core; Billing, Parking, Documents and any approved new M03 records only when enabled; existing analytics conventions.

**Risks / verify:** Cross-module privacy aggregation, financial accuracy and role leakage. No dashboard KPI makes a legal or financial determination.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner decision (2026-11-18):** Accepted as scoped; no additional reason supplied.

### M03 owner decisions and next step

- **Accepted 2026-11-18:** all ten items, GAP-M03-01 through GAP-M03-10. No item was rejected or deferred. The owner supplied no additional rationale; retain the scope and cross-module conditions in the cards rather than inventing a reason.
- **Accepted with explicit planning gates:** GAP-M03-04 awaits M02/M18 title/member policy; GAP-M03-05 awaits M10/M11 accounting policy; GAP-M03-07 awaits M18/M19/M26 workflow policy. These are accepted plan items, not implementation authorization before those reviews.
- No direct conflict-option choices apply because comparison found no existing behavior contradiction. Money, legal, privacy and member-rights risks are recorded in the cards and need the relevant review.
- The owner approved the exact P36 additions and decision-register rows previewed below; they are now saved in the existing plan and rechecked.
- Current queue after M03: M02 -> M08 -> M09 -> M11 -> M10 -> M12 (both versions) -> M13 -> M01 -> M04 -> M06 -> M07 -> M14 -> M15 -> M16 -> M17 -> M18 -> M19 -> M20 (both versions) -> M23 -> M24. 20 modules remain after this batch.
- No M03 application/schema/test changes or module-enable actions have been made. The plan changes below only record accepted future work; the five unit-import/structure tests reported for the prior M25 pass remain unrelated. This M03 review ran no tests.

## M03 implementation-plan preview — approved and saved

The owner accepted all ten M03 items for planning on 2026-11-18 and explicitly approved this preview for saving. The approved edits update the existing plan only; they do not authorize implementation. No feature behavior, permissions, legal status, payment, data migration, test or release changes now.

### A. Header, reading rules and overview

- Replace version with `0.4 (M03 toolkit decisions planned in P36)`.
- Keep date `2026-11-18 (first draft 2026-11-09)`.
- Append to Scope: `Accepted M03 unit/ownership-toolkit additions are planned in P36; this does not authorize implementation or release.`
- Replace the reading rule `No new features or technologies appear in this plan beyond those in the project documents.` with:

```markdown
- No feature or technology is added to the plan without project documentation or an explicit owner decision. Accepted toolkit work is planned below; it does not replace the owning documents.
```

- After Section 1.2 and before Section 2, add:

```markdown
### 1.3 Accepted unit/ownership additions (P36)

| Phase | Enhancement                                                                                                                                                          | Source                    | Estimate                                         | Prerequisites                                                                                    | Status          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------- |
| P36   | Verified area profile, unit layout, tenancy summary, title/share records, allotments, agreement index, handover, document index, vacancy follow-up and Unit 360 view | M03 decisions, 2026-11-18 | Not estimated; split into safe blocks at kickoff | Existing Core structure and the M02/M04/M08/M10/M11/M18/M19/M26 review gates identified per task | ⬜ Planned only |

P36 records all ten accepted M03 items. Acceptance is not a legal determination, money-posting approval, implementation authorization or permission to collect additional identity data. Resolve each named gate before its affected work; unrelated slices may proceed independently after their own kickoff decisions.
```

- Extend the Section 2.2 completion-gate heading to include `P36 enhancements`.

### B. New P36 phase

Insert after P35 and before the unnumbered Android reference:

```markdown
# Phase P36 — Unit and Ownership Records (M03 review)

**Goal:** enrich Core unit records and provide linked property/occupancy views while keeping app access, occupancy, legal ownership, documents and financial records distinct.

**Prerequisites:** Core blocks/units, memberships/occupants, existing Tenancy, Document Repository, Billing, Parking, Metering and analytics. Accepted planning decisions on 2026-11-18; source tools 25–36. Review M02/M04/M08/M10/M11/M18/M19/M26 where listed before affected implementation. M25 P35 stays separate; coordinate its future exit/owner-sale conditional NOC but do not duplicate that workflow.

**Owner decision boundary:** all ten items are accepted for planning. GAP-M03-04 waits for M02/M18 title/member decisions; GAP-M03-05 waits for M10/M11 accounting decisions; GAP-M03-07 waits for M18/M19/M26 workflow decisions. Tool examples are not law, mandatory checklists, area standards, authority to collect IDs or evidence that amounts were paid.

**Tasks:**

| ID                        | Task                                                                                   | Dependencies / kickoff gates                                                                 | Toolkit sources | Status |
| ------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------- | ------ |
| <a id="p36-1"></a>P36.1   | Add a source-aware measured-area profile and verification history                      | Core units; M08/by-law decision before area changes affect any charge                        | 25, 28          | ⬜     |
| <a id="p36-2"></a>P36.2   | Add a read-only wing/floor layout from the Core unit register                          | Confirm physical layout/position source and role visibility; no assumed tower geometry       | 26              | ⬜     |
| <a id="p36-3"></a>P36.3   | Add a role-limited tenancy-status summary derived from Tenancy                         | Existing Tenancy/Directory data and approved projections; M19 may consolidate reports        | 27              | ⬜     |
| <a id="p36-4"></a>P36.4   | Decide and, if approved at M02/M18 kickoff, add legal title-transfer/co-holder history | M02 legal membership and M18 transfer decisions; M04 bye-laws; authority and history policy  | 29, 30          | ⬜     |
| <a id="p36-5"></a>P36.5   | Add allotment-letter lifecycle with audited links to approved accounting evidence      | M10 funds and M11 accounting/receipts; M02/M18 allotment authority                           | 31              | ⬜     |
| <a id="p36-6"></a>P36.6   | Add restricted agreement-copy metadata linked to the existing repository               | Existing Document Repository; M04/M18 agreement categories and legal text                    | 32              | ⬜     |
| <a id="p36-7"></a>P36.7   | Add a unit possession/handover event and checklist                                     | M18 transfer, M19 tenancy/facilities, M26 meter readings; Core occupancy stays authoritative | 33              | ⬜     |
| <a id="p36-8"></a>P36.8   | Add a linked per-unit document availability/completeness index                         | M04/M18 approved categories; existing private-file audiences; no ID-proof collection         | 34              | ⬜     |
| <a id="p36-9"></a>P36.9   | Add a private vacancy/locked-unit follow-up lifecycle                                  | Core unit/occupant records; M02 owner mapping; M08/M09 before money figures                  | 35              | ⬜     |
| <a id="p36-10"></a>P36.10 | Add a live, read-only Unit 360 view from authorized enabled modules                    | Core; Billing/Parking/Documents only when enabled and permitted; existing analytics patterns | 36              | ⬜     |

**Acceptance by task:**

- **P36.1 — measured area (GAP-M03-01).** Store separately when provided: carpet area, built-up area and optional balcony/terrace area, each in square feet; measurement/verification status (`Verified, Pending, Re-measure`) with verifier and date. Show units on derived conversions and label unverified values. Preserve the existing `area_sqft`, billing settings and every published bill. No loading/share-of-total/maintenance formula becomes the billing basis without the M08 and applicable governing-rule decision. Missing is unknown, never zero or certified area.
- **P36.2 — building layout (GAP-M03-02).** Read blocks, unit numbers, floors and any later-approved position fields from the authoritative unit records. Support societies without blocks and irregular floors; show unknown positions instead of fabricating a regular grid. Do not copy the example wing/floor/position values as defaults. Derive owner/tenant display only from permitted current occupancy and approved status; do not infer vacant/locked/renovation from `unit.active`. The map never grants access or exposes residents to unauthorized roles.
- **P36.3 — tenancy summary (GAP-M03-03).** Show supported occupancy, agreement-expiry, configured police-proof and actual request/NOC statuses from existing Tenancy records. Do not create a second tenant register or conflicting hand-entered data. Do not label agreements “registered/notarised,” call optional proof noncompliant, or use sample 60-day rules as legal deadlines unless the owner approves the rule and it is supported by authoritative app evidence. Preserve current admin, committee and guard projections; no identities/files for roles that cannot already see them.
- **P36.4 — ownership/co-holders (GAP-M03-04).** At M02/M18 kickoff, first choose whether the product stores authoritative legal title/share entries or only an index of society-confirmed transfer records, then approve who can attest/correct them, effective-date and history behavior, permitted share fields, and relation to actual app membership/owner access. Never infer title from an `owner` occupant or turn co-holder status into an app role/vote without M02/M04/M07 legal decisions. Tool 30's ID-proof type/copy/status fields are explicitly excluded; no Aadhaar or other government-ID collection is authorized here. Do not market a record as legal title proof.
- **P36.5 — allotment letters (GAP-M03-05).** Track letter number, unit/allottee link, date and draft/issued/acknowledged/cancelled lifecycle only after allotment authority is agreed. Model allotment value/amount received/balance only according to M10/M11 accounting decisions, in integer paise and reconciled to authoritative entries. A typed amount is not a payment, receipt, unit-bill credit or confirmed society income. Corrections, cancellation and reporting follow the approved append-only money policy; no automatic charge/collection is created.
- **P36.6 — agreement metadata (GAP-M03-06).** Link structured agreement type/date/registration-office and copy-held/digitized/storage metadata to the existing private document version where present. Physical copy location and registration identifiers are staff-restricted; metadata does not change underlying file audience/download permission. No unsupported stamp-duty, legal-validity or compliance conclusion; documents remain private, versioned and auditable under the existing repository rules.
- **P36.7 — property handover (GAP-M03-07).** Record the agreed handover type/date/parties, condition, snags and checklist answers as an auditable event linked to a unit and relevant transfer/tenancy context. Link meter readings to Metering rather than duplicating authoritative readings. Do not use the toolkit's manual `Dues Cleared` field; settlement and conditional NOC follow authoritative Billing and the separately gated P35 clearance policy. A checklist cannot change occupancy/access, prove title/possession, alter bills or settle dues. The M18/M19/M26 decisions must define who records/accepts and what event closes the workflow.
- **P36.8 — document index (GAP-M03-08).** Provide only an explicitly approved unit-record checklist and statuses distinguishing digital file present, physical copy confirmed, not checked and not applicable. Link to existing records/files; do not store a second file or duplicate tenant proof. The toolkit's ID-proof row is excluded. No missing item blocks services, tenancy completion, billing, voting or member rights without a separate approved lawful rule. Unknown is not missing; no legal completeness score is implied.
- **P36.9 — vacancy lifecycle (GAP-M03-09).** Track only approved minimal vacancy/locked dates, status, assigned follow-up, inspection date and next follow-up, with narrowly scoped access and retention. Treat sample reasons/contact fields as optional and do not collect extra owner details by default. A unit without an occupant is not automatically vacant/locked; vacancy does not deactivate the unit, stop billing, imply absence of an owner or calculate “maintenance at risk.” No sensitive dispute/owner-tracing details appear in guard, resident, committee or public views absent an approved purpose.
- **P36.10 — Unit 360 (GAP-M03-10).** Build a live read-only view from normalized unit, current occupancy and the enabled/authorized Billing, Parking and Document sources. No copied master row or manually entered amount/status. If a module is disabled, show unavailable/not checked, not zero or cleared. Default person-level details to authorized admin; committee receives only its existing aggregate/specific permissions; no cross-unit resident lookup. Test that linked source access rules are preserved.

**Database and API changes:** planned only. Reuse existing Core and module boundaries; do not add a competing member/title source until P36.4's kickoff outcome. Any future schema work is a forward-only migration with same-society keys, row-level security, minimal grants, generated types, audit/history behavior and database tests. New operations/pages follow the existing contracts. No ID collection, new dependency or live financial integration is approved by this plan.

**Tests to add when implementing:** targeted area source/verification and unchanged-billing regressions; layouts with no block/irregular/unknown positions; tenancy summary role projections and disabled/optional proof; title/co-holder audit/access/history; allotment receipt reconciliation and no payment-shaped manual entry; agreement file audience preservation; handover idempotency and no automatic access/dues effect; document-index unknown/missing distinctions and no ID fields; vacancy vs inactive/occupant/charge boundaries; Unit 360 role/module combinations and live authoritative amounts. Add local database isolation/append-only/concurrency tests and phone/desktop accessible journeys for changed screens. These new tests have not been implemented or run.

**Completion criteria:** each slice closes its named review gate, obtains any required owner approval, updates its owning PRD/DESIGN/DATABASE/API documents, passes Section 2.2 checks, and preserves existing role, module-toggle, privacy, retention and financial-history guarantees. Legal/statutory points: **verify against the state co-operative act / our bye-laws**. No live collection, legal determination or production enablement follows from acceptance of the plan.

**Status:** ⬜ Accepted for planning only, 2026-11-18. Not implemented, not tested as new functionality, not estimated, not released, not owner-UAT-approved and not enabled live. P36.4 remains gated by M02/M18; P36.5 by M10/M11; P36.7 by M18/M19/M26. Other unresolved per-slice privacy/access/legal decisions remain kickoff gates.

---
```

### C. Decision-register updates

In the existing `# Toolkit Review Decisions`, immediately after the M25 table and before `Keep-current choices`, append:

```markdown
**M03 complete:** all 12 tools (25–36) compared; ten merged decisions: 5 NEW, 5 ENHANCEMENT, 0 CONFLICT. All ten accepted for planning on 2026-11-18; none rejected or deferred. Several fields are explicitly excluded or gated below.

| ID         | Type        | Decision                      | Date       | Owner reason / qualification                                                                            | Plan entry        |
| ---------- | ----------- | ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- | ----------------- |
| GAP-M03-01 | ENHANCEMENT | Accept                        | 2026-11-18 | Plan measured area and verification, but keep billing basis/history unchanged; no extra reason supplied | [P36.1](#p36-1)   |
| GAP-M03-02 | NEW         | Accept                        | 2026-11-18 | Plan read-only layout; no assumed geometry; no extra reason supplied                                    | [P36.2](#p36-2)   |
| GAP-M03-03 | ENHANCEMENT | Accept                        | 2026-11-18 | Derive tenancy status; preserve privacy and current workflow; no extra reason supplied                  | [P36.3](#p36-3)   |
| GAP-M03-04 | NEW         | Accept — gated by M02/M18     | 2026-11-18 | Owner accepted scoped feature with M02/M18 policy gates; no additional rationale supplied               | [P36.4](#p36-4)   |
| GAP-M03-05 | NEW         | Accept — gated by M10/M11     | 2026-11-18 | Owner accepted scoped feature with M10/M11 accounting gates; no additional rationale supplied           | [P36.5](#p36-5)   |
| GAP-M03-06 | ENHANCEMENT | Accept                        | 2026-11-18 | Link restricted agreement metadata to existing repository; no extra reason supplied                     | [P36.6](#p36-6)   |
| GAP-M03-07 | NEW         | Accept — gated by M18/M19/M26 | 2026-11-18 | Owner accepted scoped feature with M18/M19/M26 workflow gates; no additional rationale supplied         | [P36.7](#p36-7)   |
| GAP-M03-08 | ENHANCEMENT | Accept                        | 2026-11-18 | Linked document index; exclude ID proof and rights-blocking checklist; no extra reason supplied         | [P36.8](#p36-8)   |
| GAP-M03-09 | NEW         | Accept                        | 2026-11-18 | Private follow-up only; no effect on activation or billing; no extra reason supplied                    | [P36.9](#p36-9)   |
| GAP-M03-10 | ENHANCEMENT | Accept                        | 2026-11-18 | Live, read-only, authorized sources; no manual duplicated balances; no extra reason supplied            | [P36.10](#p36-10) |

**M03 implementation gates:** keep M03.04 out of implementation until M02/M18 determine title/share scope and authority; M03.05 until M10/M11 determine accounting/receipt treatment; M03.07 until M18/M19/M26 define handover, occupancy and meter integration. All P36 slices need their own access/privacy/legal kickoff. There is no M03 rejected-conflict behavior to preserve; no direct conflict was found.
```

Replace the existing **Remaining review order** paragraph in that section with:

```markdown
**Remaining review order (20 modules, not yet comprehensively compared):** M02 members → M08 billing → M09 dues → M11 accounts → M10 funds → M12 statements (both versions) → M13 budget → M01 dashboards → M04 registration/bye-laws → M06 meetings → M07 elections → M14 vendors/AMC → M15 staff/payroll → M16 helpdesk → M17 repairs/redevelopment → M18 transfer/NOC → M19 tenants/parking/facilities → M20 audit/compliance (both versions) → M23 communication → M24 insurance/legal. M25/M03 decisions are complete; narrow cross-module clarifications are not full reviews.
```

### D. Current Next Steps

Replace the existing toolkit-review bullet with:

```markdown
- **Toolkit review (planning only):** M25 decisions and the accepted M03 P36 plan are recorded above; M03's M02/M18, M10/M11 and M18/M19/M26 implementation gates remain open. Continue the agreed review with M02 members; preserve all existing release/UAT/go-live priorities.
```

No phase status or delivery mark outside these edits changes. Twenty modules still await comparison.

## M03 saved-plan verification

- Owner explicitly selected `Approve — save the exact preview`.
- Re-read the plan header, overview, completion gate, complete P36 phase, M03 decision register, remaining-review queue and current next steps.
- `npx --no-install prettier --check docs\IMPLEMENTATION_PLAN.md`: passed.
- `git --no-pager diff --check`: passed.
- Read-only content validation: saved P36 phase, P36 overview and M03 decision register match the approved preview after formatting normalization; all 10 task anchors are unique, all 10 accepted decision rows are present and each links to its task.
- Focused documentation check only; no application test suite rerun. No new application behavior or tests were introduced.
- Only [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) was changed in the repository by this approved batch. Pre-existing modified `package-lock.json` and untracked `.github/skills/` were left untouched.
- M03 is complete. At the end of that batch, M02 members was next and 20 modules remained unreviewed. The current M02 comparison follows; this is a historical batch note, not the current queue.

## M02 Member Register & Share Ledger review

**Status:** Comparison of all twelve tools (13–24) is complete. Ten merged decisions: **6 NEW, 2 ENHANCEMENT, 2 CONFLICT**. All ten are deferred/backlog as of 2026-11-18, with no M02 phase or implementation work planned. The decision register and gates are recorded in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#toolkit-review-decisions). M08 Billing is now compared; its owner decisions are pending before M09 Dues. This report does not authorize implementation.

**Covered / not relevant:** zero tools are wholly covered; none is out of scope. Homeish partly covers Tool 13/14's person/access/occupancy list, Tool 17's app-registration approval, Tool 19's access deactivation and occupancy history, Tool 21's household occupants, Tool 23's current member list, and Tool 24's aggregate sign-up metric. Those are not statutory membership, shareholding, nomination, fee or KYC records.

**Evidence searched:** PRD CORE-8/9/10, R-08, P22 and D-29/D-50/D-60; the `profiles`, `memberships` and `unit_occupants` database contracts; the member directory, registration controls, operations, migrations, tests and analytics; and the Module 2 guide plus reference entries for Tools 13–24. The exact existing fields and role boundaries are linked below. No original workbook, PDF or Word file was opened because the reference supplied the fields and dashboard contents needed for this comparison. App tests were not run for this documentation review; test-file presence is cited as evidence, not reported as a passing run.

### GAP-M02-01 · NEW · Value H · Effort H · Confidence High

**What:** A distinct, society-approved statutory/co-operative member register and profile, separate from Homeish account access and unit occupancy.

**Why it helps:** Societies that need a legal member register can record membership that Homeish's account and household records do not represent.

**Toolkit source:** [Tool 13](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t13>), [Tool 14](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t14>).

**App today:** [Core membership](./DATABASE.md#L231) is a person's sign-in/access to a society, with roles and invited/approval/active/deactivated status. [Unit occupancy](./DATABASE.md#L253) separately records owner/tenant/family, primary/approver and dates. The [People screen](<../src/app/(admin)/admin/members/page.tsx>) shows account email, name, masked phone, roles and current occupancy. The database and app do not prove statutory membership, admission date, member class, shareholding or legal title. The PRD's [CORE-8/9/10](./PRD.md#L167) cover household occupancy, resident invitations/registration and access deactivation—not a statutory member register.

**Toolkit difference:** Tool 13's register includes member ID/name, unit, area, membership type (`Ordinary, Associate, Nominal, Joint`), mobile/email, admission date, date of birth, age, shares held, calculated share capital, occupation, status (`Active, Under Transfer, Ceased`) and calculated membership tenure. Tool 14 repeats that member dataset for a profile card.

**Change needed:** Before adding a legal-membership entity, define the society's applicable member categories and the authority/evidence for admission, status, corrections and history. Keep it linked to—but distinct from—profile, Homeish role, occupancy, ownership and share ledger. Reuse area/unit references only where their meaning is confirmed. Do not collect DOB, occupation, extra phone data or other personal fields merely because the toolkit has them; specify purpose, visibility and retention first.

**Acceptance:** A statutory member entry never creates a login, app role, owner occupancy, title claim or voting entitlement by itself. Account deactivation does not silently cease legal membership, and legal membership is not inferred from being an `owner` occupant. Missing legal facts are unknown, not guessed from app records.

**Depends on:** Existing Core memberships/occupants and units; M03/P36.4 title/share boundary; M04 bye-laws and M18 transfer decisions; M07 voting decisions; M20 compliance review.

**Risks / verify:** Member admission, categories, registers and rights may be statutory; inaccurate data could affect a person's rights. Avoid new personal-data collection without a documented purpose. **Verify against the state co-operative act / our bye-laws.**

**Decision:** [ ] Accept [ ] Reject [x] Defer

### GAP-M02-02 · NEW · Value H · Effort H · Confidence High

**What:** An append-only share-capital transaction ledger with member balances and auditable share movement.

**Why it helps:** Records allotment, transfer and refund history rather than relying on a manually maintained current-share total.

**Toolkit source:** [Tool 15](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t15>).

**App today:** Homeish has no member share ledger or share-capital balance. Billing's [unit ledger](./DATABASE.md#L480) records unit charges and payment allocations; P16 expense books record society cash/bank movements, not share ownership. No matching share/allotment ledger or share transaction found in the Core member flows or database migrations.

**Toolkit difference:** Tool 15 records date, receipt/folio, member ID/name, unit, transaction type (`Allotment, Transfer In, Transfer Out, Refund on Cessation, Forfeiture`), share count, distinctive number range, calculated net shares/amount/member balance, payment mode/reference and remarks. Its dashboard totals outstanding shares, paid-up capital, holders, transactions, current-year allotments/transfers/refunds and capital added.

**Change needed:** Define share units, face value, transaction authority, receipt evidence, transfer/forfeiture/refund rules, corrections and reconciliation before designing the ledger. Amounts must use integer paise. Keep share events append-only; do not make typed amounts or payment modes proof of money received. Do not post share capital into unit bills, dues or expense books by assumption.

**Acceptance:** Every balance is derived from traceable approved events, with reversal/correction history and no duplicate posting. Reports distinguish share count/value from cash received, unit dues and accounting balances. Transfer/refund and any integration with the accounts module require M10/M11 plus M04/M18 approval.

**Depends on:** GAP-M02-01; M03/P36.4 and M18 for transfer/member authority; M10/M11 for receipt, accounting and reconciliation rules.

**Risks / verify:** Financial statements, member capital and transfers are rights-affecting; the toolkit's sample values and statuses are not approved rules. **Verify against the state co-operative act / our bye-laws.**

**Decision:** [ ] Accept [ ] Reject [x] Defer

### GAP-M02-03 · NEW · Value H · Effort M · Confidence High

**What:** A share-certificate issue, delivery, acknowledgement, cancellation and reissue register linked to approved member/share records.

**Why it helps:** Staff can see certificates awaiting issue or acknowledgement and preserve the history of replacement certificates.

**Toolkit source:** [Tool 16](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t16>).

**App today:** No share-certificate entity or workflow was found. The Document Repository stores private, versioned files; it does not track share certificate numbers, distinctive shares, signatories, issue/delivery dates or acknowledgement.

**Toolkit difference:** Tool 16 records certificate number, member/unit, share count and distinctive range, face/total value, allotment/transfer and issue dates, selected signatories, status (`Issued, Pending, Duplicate Issued, Cancelled, Reissued`), delivery date, acknowledgement, days to issue and timeliness. Its dashboard reports pending/overdue/acknowledged/cancelled counts and oldest pending issues.

**Change needed:** Link a certificate only to the approved member/share transaction source; retain replacement/cancellation history and any private document using the existing repository's audience and audit controls. The reference says timeliness is calculated but does not establish a verified legal deadline. Do not turn the sample signatory combinations or a calculated status into a statutory conclusion.

**Acceptance:** Certificate totals reconcile with the authoritative share ledger; reissue never erases or silently replaces prior history. Certificate status alone does not grant app access, prove title or change voting rights. Any deadline/signatory rule is separately approved and evidenced.

**Depends on:** GAP-M02-01/02; M03/P36.4, M04 and M18 decisions; existing Document Repository if a copy is retained.

**Risks / verify:** Incorrect certificates could affect share and member rights. **Verify issuance, signatory and timing rules against the state co-operative act / our bye-laws.**

**Decision:** [ ] Accept [ ] Reject [x] Defer

### GAP-M02-04 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Extend app-registration tracking only if a separate statutory membership-admission pipeline is needed.

**Why it helps:** Shows where membership applications wait and which have an approved resolution, without confusing app registration with legal admission.

**Toolkit source:** [Tool 17](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t17>).

**App today:** Homeish already has join-code registrations and administrator approve/reject actions with an optional rejection note; invited members link at sign-in. The [Pending registrations screen](../src/components/members/registration-controls.tsx) shows name/email/unit/relationship and approval controls. It does not record application type, received date, committee meeting/resolution, admission effective date, certificate status, ageing or target status. Committee members can read the people list; the registration decision is an admin action.

**Toolkit difference:** Tool 17 tracks application number/name/unit/type (`New Purchase, Transfer / Resale, Legal Heir, Gift Deed, Allotment (Builder)`), application date, document status, entrance-fee status, committee meeting/decision (`Pending, Approved, Rejected, Deferred`), resolution, admission and share-certificate dates. It derives stage, time in process and target status, and reports pipeline, ageing, rejection and pending certificates.

**Change needed:** Decide whether to track the existing account/onboarding request, statutory admission, or two explicitly linked workflows. Reuse the current registration approval and notification path where applicable. Do not grant the committee new decision permissions, invent an application deadline, make fees a condition, or treat an app approval as legal admission without M04/M05/M20 authority. M05 committee-tool content is missing and must not be guessed.

**Acceptance:** Each status has a defined source and actor; app-access approval remains distinct from statutory membership admission. Ageing may be informational until a verified target is approved. No share-certificate or fee status is fabricated.

**Depends on:** Existing registration flow; GAP-M02-01/03/07; M04 bye-laws, M05 (unavailable, no assumptions), M18 and M20.

**Risks / verify:** Admission decisions and deadlines may affect member rights. **Verify against the state co-operative act / our bye-laws.**

**Decision:** [ ] Accept [ ] Reject [x] Defer

### GAP-M02-05 · NEW · Value H · Effort M · Confidence High

**What:** A nomination record with allocation checks, revocation history and minor-guardian handling, kept distinct from ownership or inheritance.

**Why it helps:** Helps staff find an authorized recorded nomination and identify incomplete records without mistaking a nominee for a current owner.

**Toolkit source:** [Tool 18](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t18>).

**App today:** No nominee register or nomination workflow was found in the app, Core schema, tenancy process or Document Repository. Homeish's household/occupancy data is not a nomination.

**Toolkit difference:** Tool 18 records member/unit, nominee name and relationship, DOB/age, share percentage, contact, ID-proof and last-four ID number, nomination date, witness, active/revoked status, minor flag/guardian, member total allocation and an allocation check. Its dashboard lists incomplete allocations, minor nominees, revocations and guardian checks.

**Change needed:** First define what a nomination means for this society, who may submit/verify/revoke it, and which records are legally required. If approved, retain a dated and auditable history, use a server-checked allocation rule, tightly restrict access, and link any file through the private repository. Do not collect government ID or DOB without separately approved necessity. A nomination is not a title transfer, beneficiary determination, inheritance decision or permission to expose the record to guards/residents.

**Acceptance:** Any completeness or allocation indicator is advisory and tied to an approved rule; revoked/superseded nominations remain historically auditable but are not shown as active. No nominee gains an app role, occupancy or vote from nomination alone.

**Depends on:** GAP-M02-01/02; M03/P36.4, M04 bye-laws, M18 transfer and M20 compliance.

**Risks / verify:** A wrong nominee, percentage or minor/guardian rule could directly affect member/property rights. **Verify against the state co-operative act / our bye-laws.**

**Decision:** [ ] Accept [ ] Reject [x] Defer

### GAP-M02-06 · CONFLICT · Value H · Effort H · Confidence High

**What:** Decide whether to add a statutory cessation/resignation workflow, without treating it as the app's account-deactivation or unit move-out action.

**Why it helps:** A separate process could track a legal membership exit and any approved share-return steps while preserving login and occupancy controls.

**Toolkit source:** [Tool 19](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t19>).

**App today:** Core `deactivated` means access is revoked and active occupancy ends, with history retained; it is not a statutory `Ceased` member status. Tenant/owner move-out is tracked separately. PRD D-29 says unit dues remain on the unit and are billed to the current owner. No member share refund, cessation approval, legal effective date or member-dues setoff exists.

**Toolkit difference:** Tool 19 combines reason (`Sale / Transfer, Death, Resignation, Expulsion, Other`), notice, committee approval/effective date, share amount/refund, manually entered outstanding dues, net refundable amount, transferee/legal heir and refund/payment status; it reports open refunds, dues and case-age.

**Change needed:** Keep app-access deactivation, unit occupancy end and statutory cessation as distinct decisions and records. If a legal exit process is approved, agree authority, effective date, evidence, share-refund accounting, deceased-member handling and retention. Treat unit dues only from the authoritative unit ledger. Never calculate a member refund by subtracting an unrelated unit balance or overwrite D-29 through a spreadsheet-style manual dues field.

**Acceptance:** No action silently deactivates an account, ends an occupancy, clears unit dues or executes a legal transfer. Refunds require approved share-ledger and accounting evidence, are append-only and cannot appear paid because someone typed a status. Preserve existing app behavior until any replacement is separately approved and documented.

**Depends on:** GAP-M02-01/02/03/08; M03/P36.4; M04/M18 legal transfer rules; M09 dues; M10/M11 accounting.

**Risks / verify:** This touches money, access, property and member rights. D-29 is approved and must not be changed implicitly. **Verify against the state co-operative act / our bye-laws.**

**Options:** A) Keep D-29 and current access/occupancy behavior; any future legal cessation/refund must be separate, gated work → **Recommended**: avoids equating distinct records or offsetting unit debt. B) Plan an integrated cessation/refund/setoff workflow only after an explicit D-29 and accounting/legal decision. C) Another scope, stated by the owner.

**Decision:** [ ] Accept [ ] Reject [x] Defer

**Owner-selected option:** B, deferred pending the explicit D-29 and legal/accounting decisions above.

### GAP-M02-07 · NEW · Value H · Effort M-H · Confidence High

**What:** A fee schedule and auditable membership-fee collection record, separate from unit maintenance dues and ordinary expenses.

**Why it helps:** If the society has approved entrance/admission or annual membership fees, staff can track what is due and what is supported by a receipt.

**Toolkit source:** [Tool 20](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t20>).

**App today:** Billing records unit charges, bills, receipts and the unit ledger; the expense module records society cash/bank movements. No member-level entrance, application, admission, transfer, annual-subscription or nominal-membership fee workflow was found. P35's optional amenity-deposit decision is separate and does not establish member fees.

**Toolkit difference:** Tool 20 uses fee types (`Entrance Fee, Share Application Money, Admission / Membership Fee, Transfer Fee, Annual Membership Subscription, Nominal Membership Fee`), a fee master/standard amount, waiver, net payable, due date, amount paid, payment date/mode, receipt, balance, status and overdue days. Its dashboard summarizes payable/collected/pending/overdue/waived amounts and recent payments.

**Change needed:** Verify applicable fee authority, who owes/approves it, waivers, due dates, receipt evidence and accounting treatment before adding a member-fee subledger. Use integer paise and auditable authoritative payment/receipt records; a manually entered amount/status is never confirmation. Do not turn fees into unit-bill charges, merge them with share capital, or book them to cash/bank without M10/M11 decisions.

**Acceptance:** Sample fees are never defaults. A fee is payable/paid/waived only from the approved rule and authoritative transaction; billing-off, retries, corrections and refunds have explicit behavior. No membership fee is automatically charged or blocks app registration based on this toolkit alone.

**Depends on:** GAP-M02-01/02/04/06; M04 for fee authority; M08/M09 to preserve unit-billing meaning; M10/M11 for receipts and accounting.

**Risks / verify:** Member charges may be regulated and affect service or voting rights. **Verify against the state co-operative act / our bye-laws.**

**Decision:** [ ] Accept [ ] Reject [x] Defer

### GAP-M02-08 · NEW · Value H · Effort H · Confidence High

**What:** A legal joint/associate membership register, with holder order and rights derived only from approved rules—not from household occupancy.

**Why it helps:** Records multiple legal holders or associate members where they are recognized, without giving duplicate or unintended access/voting rights.

**Toolkit source:** [Tool 21](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t21>).

**App today:** A unit may have multiple distinct Homeish memberships and `unit_occupants` for owner/tenant/family; Core separately manages app roles and a primary resident. These records do not store statutory joint/associate categories, share percentages, order, consent letters or voting entitlements. P22/D-60 gives one vote per unit to its designated representative; family members never vote and tenant eligibility is separately configured.

**Toolkit difference:** Tool 21 stores primary member/unit, joint/associate name/category (`Joint Member, Associate Member, Co-owner, Spouse (Joint Holder)`), relationship, holding order/percentage, admission date, DOB/age, phone/ID proof, automatic voting-right and consent-letter status. Its dashboard reports joint units, eligible voters, pending consents and minors.

**Change needed:** Align holder identity and share allocation with GAP-M02-01/02 and M03/P36.4. Define who may attest each category, any lawful rights, whether a record needs a linked app account, and how consent is documented. Exclude ID and DOB fields unless independently approved. Do not derive voting eligibility automatically from a spreadsheet category.

**Acceptance:** Household occupants, legal holders and Homeish roles remain separate. Existing P22 one-vote-per-unit, frozen representative and tenant-voting rules stay unchanged unless the owner explicitly approves a P22/PRD change after M04/M07 legal review.

**Depends on:** GAP-M02-01/02/03/04; M03/P36.4; M04 bye-laws; M07 election rules; M18 transfer.

**Risks / verify:** Joint/associate definitions, consent, co-holder percentages and voting are member-rights/legal matters. Avoid unneeded personal data. **Verify against the state co-operative act / our bye-laws.**

**Decision:** [ ] Accept [ ] Reject [x] Defer

### GAP-M02-09 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Add permitted search/filtering and an aggregate member overview to the existing People directory.

**Why it helps:** Makes a growing society's people list easier to use and can show basic onboarding activity without a copied member spreadsheet.

**Toolkit source:** [Tool 23](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t23>), [Tool 24](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t24>).

**App today:** The [People screen](<../src/app/(admin)/admin/members/page.tsx>) shows a list of members and current unit occupancy; the [directory component](../src/components/members/member-controls.tsx#L390) has no search/filter control. P27's approved analytics catalogue already has an aggregate **Member sign-ups** metric. No statutory-member search fields, share/member-type charts or member dashboard were found.

**Toolkit difference:** Tool 23 filters a repeated member dataset by member ID/name/unit/area/type/mobile and calculates selected profile details. Tool 24 summarizes total members, share capital, area, ceased members, age/tenure, associate/nominal members, admissions and largest share holders.

**Change needed:** Add search only over records the viewer already may access, using existing server-side authorization and masking. Derive counts from the proper source: account memberships for sign-ups versus an approved statutory register for legal members/shares. Do not add a copied search table, expose full phone numbers or export sensitive details, or invent an age/share ranking if its source/purpose is not approved.

**Acceptance:** Search results preserve current admin/committee role boundaries and never imply account membership equals legal membership. Aggregate metrics identify their source and omit unavailable values rather than using zero. Existing P27 member sign-up metric remains authoritative for app onboarding.

**Depends on:** Existing People page and P27 analytics; GAP-M02-01/02 before legal-member/share statistics.

**Risks / verify:** Search/export can expose personal member data; aggregate views can give false legal/share totals if backed by app accounts. Apply current masking and data-minimization rules.

**Decision:** [ ] Accept [ ] Reject [x] Defer

### GAP-M02-10 · CONFLICT · Value H · Effort M-H · Confidence High

**What:** Decide whether any member document checklist is permissible despite the toolkit's general KYC/identity-document fields.

**Why it helps:** A narrowly scoped document-presence checklist could reveal missing society-approved application records, if a lawful purpose is established.

**Toolkit source:** [Tool 22](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t22>).

**App today:** The privacy contract says collect minimum data and **no government ID copies**. D-50 allows only the specific optional tenancy police-verification proof and explicitly says that is not permission for general identity collection. The private Document Repository manages authorized files/audiences; it has no member-KYC status, completion score or expiry/review tracker.

**Toolkit difference:** Tool 22 lists Aadhaar ID, address proof, PAN, photo, ownership document, share-certificate copy, nomination form and membership application, with `Received, Pending, Expired, N/A`, last verified/by, next review and a KYC completion percentage.

**Change needed:** Do not implement the all-fields KYC sheet by default. First identify each document's lawful/purpose-specific need, data minimization, allowed audience, verification, retention/deletion and whether Homeish should record only presence rather than store a copy. Government ID copies (including Aadhaar/PAN) remain excluded unless a separate, explicit owner decision and governing-document update revises current policy; a score must not imply statutory compliance.

**Acceptance:** Preserve D-50 and current privacy policy unless explicitly changed in the owning PRD and database contracts. No ID field, copy, expiry, compliance block or role/access change is introduced from toolkit examples. Any later index distinguishes unknown/not checked from missing and uses the existing private repository.

**Depends on:** Existing Document Repository; GAP-M02-01/04/05; M04/M20 legal/compliance review and an explicit privacy-purpose decision.

**Risks / verify:** Government IDs and member/property documents are sensitive. Overcollection creates harm and retention/access obligations. **Verify against the state co-operative act / our bye-laws and the approved privacy purpose.**

**Options:** A) Keep the current no-government-ID-copy rule and do not add a general member KYC tracker → **Recommended**: no verified legal basis or new collection purpose has been established. B) Consider only a minimal checklist for individually approved non-ID records, after legal/privacy review; keep government-ID copies excluded unless separately approved. C) Another scope, stated by the owner.

**Decision:** [ ] Accept [ ] Reject [x] Defer

**Owner-selected option:** B, deferred pending specific legal/privacy approval; government-ID copies remain excluded.

**M02 owner decisions (2026-11-18):** all ten items are Defer. Shared reason: “Features related to legal membership and share management are not currently supported. They may be introduced in future Pro versions, subject to sufficient customer demand.” Reconsider when sufficient customer demand justifies evaluating a capability for a future Pro version and its listed legal/accounting/privacy gates are resolved; no numeric threshold or delivery commitment is implied. GAP-M02-06 Option B remains subject to D-29 and legal/accounting approval. GAP-M02-10 Option B remains limited to individually approved non-ID records after legal/privacy review; government-ID copies remain excluded. All decisions and gates are recorded in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#toolkit-review-decisions). No M02 implementation is authorized.

## M08 Maintenance Billing & Collection review

**Status:** Comparison of all twelve tools (85–96) is complete. Seven merged decision cards: **1 NEW, 2 ENHANCEMENT, 4 CONFLICT**. All seven are accepted for planning as of 2026-11-18, including two choices to preserve current behavior. The primary workflows in Tools 86 and 87 are covered, without claiming full workbook parity. The approved plan update is recorded in P37 of [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md); M09 Dues is next. This report does not authorize implementation.

**Covered / not relevant:** The primary functions of Tool 86 (monthly bill generation) and Tool 87 (bill printing) are covered by Homeish's monthly bill preview/generation, immutable published bills and PDF bill documents. This is feature-level coverage, not a claim of workbook parity. Tool 86's manually typed `Previous Dues B/F` is not copied: Homeish derives outstanding balance from its unit ledger. No M08 tool is wholly out of scope.

**App today:** [Billing requirements](./PRD.md#L306) approve fixed-per-unit, per-sq-ft and custom-per-unit charges; [billing charge validation](../src/core/billing/validation.ts#L73) enforces those methods. The [bill generator](../src/components/billing/generator.tsx) previews configured charges for selected active units and can generate the bill; the [billing operations](../src/core/billing/operations.ts) use the server-side preview/generation flow and notify units after generation. [Published bills and unit ledger rules](./DATABASE.md#L531) make bills immutable and apply confirmed payments to oldest-due-first; excess payment stays as unit credit. Homeish already has payment review, receipts, CSV billing reports and billing analytics, but not every toolkit report/detail.

**Evidence searched:** Module 8 guide and reference entries for Tools 85–96; billing requirements and D-06/D-12/D-29/D-52/P15/P27 decisions; billing database/API contracts; charge setup, generator, payment/receipt operations, report and analytics code; [billing validation/calculation tests](../tests/unit/billing-validation.test.ts), [billing payment tests](../tests/integration/database-billing-payments.test.ts), [billing reports tests](../tests/integration/database-billing-fines-reports.test.ts), [parking tests](../tests/unit/parking.test.ts) and [amenity tests](../tests/integration/database-amenity.test.ts). Search terms included `basis`, `% of maintenance`, `Applicable To`, `occupancy`, `parking fee`, `clearance`, `payment mode`, `advance`, `wing`, `distribution`, `delivery`, `acknowledged` and `WhatsApp`. The original Tool 85 workbook alone was inspected locally and read-only to resolve reference field/formula inconsistencies; no other original Module 8 workbook was opened. Existing test-file presence is evidence of coverage, not a result: application tests were not run for this documentation review.

### GAP-M08-01 · CONFLICT · Value H · Effort M · Confidence Medium

**What:** Add a percentage-of-maintenance charge basis as a fourth optional method.

**Why it helps:** Societies that deliberately set a charge as a percentage of the maintenance charge could calculate it from one named base instead of re-entering an amount.

**Toolkit source:** [Tool 85](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t85>), the [Module 8 shared rules](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_GUIDE.md#module-8>) and its [original workbook](<../../Cooperative & Housing Society Management Toolkit/Module_08_Maintenance_Billing_Collection_Glex_Media/02_Individual_Tools/85_Maintenance_Charge_Master_Glex_Media.xlsx>) (read-only).

**App today:** [D-12/BIL-1](./PRD.md#L306) approves only fixed per unit, per sq ft and custom per unit; other calculation methods are out of MVP. The [charge schema](../src/core/billing/validation.ts#L73) accepts exactly those three methods. The current unit tests cover charge validation and calculations: [billing validation tests](../tests/unit/billing-validation.test.ts) and [billing calculation tests](../tests/unit/billing-calculations.test.ts).

**Toolkit difference:** The module guide says `% of Maintenance` is calculated on that unit's Maintenance Charges. Tool 85's reference lists `Basis` as only `Per Sq Ft, Fixed Per Unit` and describes `Rate` with `Owner, Tenant, Vacant`; the original workbook instead has a numeric Rate and places Owner/Tenant/Vacant under Unit Master Occupancy. Its percentage formula uses `ROUND(J9*rate/100,0)`, where `J9` is the first charge row, rather than naming the maintenance charge. The workbook's first charge row also lacks the percentage basis in its dropdown. Treat this as a source inconsistency, not an app rule.

**Change needed:** Add an optional fourth method selectable per charge head. The society may continue using the existing three methods for other charge heads. Use a designated Maintenance charge line for the same unit and bill month as the base, then apply Homeish's existing per-charge rounding to the percentage result. Apply it only to future bill calculations; published bills remain unchanged. Do not copy the row-position formula.

**Depends on:** Existing charge configuration and bill preview; P35.1's current billing-method boundary.

**Risks / verify:** This changes bill amounts and adds a method that D-12 explicitly excludes. Existing charges and immutable bills must retain their current meaning. Recheck the approved rounding rule and any governing charge authority before implementation.

**Options:** A) Keep D-12's three methods → **Recommended**: this preserves the approved billing contract, and the workbook does not establish a reliable named-base formula. B) Add an optional percentage method after explicitly approving its base, ordering and rounding; keep existing methods and historical bills unchanged. C) Another precise rule from the owner.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected option:** B, add the fourth method per charge head; use the designated same-unit/month Maintenance charge line as the base and existing per-charge rounding.

### GAP-M08-02 · ENHANCEMENT · Value M · Effort M-H · Confidence High

**What:** Add optional charge eligibility by unit occupancy (`All`, `Owner`, `Tenant`).

**Why it helps:** A charge head can apply only to units with a defined occupancy, rather than requiring admins to select and edit amounts for each unit manually.

**Toolkit source:** [Tool 85](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t85>).

**App today:** Charge types store a name, method, amount and active flag; the [bill generator](../src/core/billing/operations.ts) loads active charges and active units using unit number and area, without occupancy-based charge filtering. Homeish separately stores current unit occupants. [D-29](./PRD.md#L984) says outstanding unit dues remain on the unit and are billed to the current owner.

**Toolkit difference:** Tool 85 adds `Applicable To = All, Owner, Tenant` and Unit Master `Occupancy = Owner, Tenant, Vacant`; charge application is limited by that occupancy. It does not by itself establish that the tenant is personally liable for a unit bill.

**Change needed:** Apply charge eligibility using the occupancy effective on the first day of the billed month. `All` includes all active units, including vacant units; `Owner` and `Tenant` filters apply only to matching occupancy. Preserve unit-level bills and D-29's current-owner liability; do not address invoices directly to tenants based on eligibility alone.

**Depends on:** Existing unit/occupancy and billing records; GAP-M08-01 only if percentage charges are also approved.

**Risks / verify:** Occupancy and charge eligibility can change over time. Do not recalculate already published bills or move unpaid balances from the unit/current owner. Confirm the rule with the owner before changing period calculations.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected rule:** Occupancy at the start of the billed month; `All` includes vacant active units; `Owner`/`Tenant` target matching occupancy only. The bill and unpaid balance remain attached to the unit/current owner under D-29.

### GAP-M08-03 · NEW · Value M · Effort M · Confidence High

**What:** Add a read-only area/flat what-if calculator separate from bill creation.

**Why it helps:** An admin can estimate charges for an area before making or changing a real unit or generating a bill.

**Toolkit source:** [Tool 88](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t88>).

**App today:** The [bill preview](../src/components/billing/generator.tsx) calculates real charges for a selected period, configured units and charge types before generation; no separate arbitrary-area scenario calculator was found. Tool 88 takes flat area and displays maintenance, sinking fund, repair fund, water, non-occupancy, parking/facility and owner/tenant totals.

**Change needed:** Build a non-persistent preview using only the society's configured, active charge rules and existing rounding. It must not create/edit a unit, charge, bill or ledger entry. Any owner/tenant-specific total depends on GAP-M08-02; any percentage basis depends on GAP-M08-01. Do not hard-code toolkit example rates or charge heads.

**Depends on:** Existing calculation/preview service; GAP-M08-01/02 for any calculator output that uses those optional rules.

**Risks / verify:** A scenario estimate must be clearly labelled as an estimate and must not be presented as an issued bill or legal charge assessment.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M08-04 · CONFLICT · Value H · Effort M-H · Confidence High

**What:** Keep the approved no-parking-fees rule; do not add recurring parking/facility fees.

**Why it helps:** A society charging an approved parking/facility fee could derive it from actual allocated slots instead of maintaining a separate manual total.

**Toolkit source:** [Tool 89](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t89>); Tool 85's charge master supplies its fee heads.

**App today:** [D-52/P20](./PRD.md#L522) explicitly provides parking allocations **with no fees**. [P15](./PRD.md#L460) separately allows fees for amenity bookings, with fee snapshots and unit-ledger entries when billing is enabled; this does not authorize recurring parking fees. The existing [parking tests](../tests/unit/parking.test.ts) cover allocation behavior, not parking charges. No recurring parking-fee calculation from allocated slots was found.

**Toolkit difference:** Tool 89 calculates 4W/2W parking and clubhouse amounts from slot counts/membership and allows a manually entered other-facility amount. Its data includes parking slots and previous dues separately from Homeish's existing parking and amenity records.

**Change needed:** No change now. Any later D-52 proposal would first define fee authority, slot-to-fee mapping, effective dates, payer/unit treatment, vacant-unit behavior and how changes avoid duplicate custom charges. It must integrate with authoritative parking allocations and keep P15 booking fees distinct; do not copy typed slot counts or manual balances into billing.

**Depends on:** An explicit D-52/PRD change and the M19 parking/facilities rules; existing unit ledger and P15 fee flow.

**Risks / verify:** This adds a new recurring liability and changes the approved parking policy. No existing bill should be retroactively changed. **Verify fee authority against the state co-operative act / our bye-laws.**

**Options:** A) Keep D-52's no-parking-fees rule and P15's separately approved amenity fees → **Recommended**: it preserves the owner's current decision. B) Revise D-52 and define slot/facility fee rules in M19 before adding any future charges. C) Another scope from the owner.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected option:** A, keep D-52's no-parking-fees rule; no recurring parking/facility charge feature. P15 amenity booking fees remain separate.

### GAP-M08-05 · CONFLICT · Value H · Effort M-H · Confidence High

**What:** Preserve current payment-clearing behavior and supported payment modes.

**Why it helps:** A society that reconciles cheque or transfer settlement separately can distinguish money received from a payment still pending or later bounced.

**Toolkit source:** [Tool 90](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t90>) and [Tool 91](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t91>).

**App today:** [BIL-6](./PRD.md#L311) keeps resident UPI submissions `Awaiting confirmation` until an admin confirms or rejects them; confirmation creates the unit-ledger credit and receipt. [BIL-7](./PRD.md#L312) makes admin-recorded Cash/Cheque/Bank Transfer/UPI payments immediately confirmed and issues a receipt. The [payment schema](../src/core/billing/validation.ts#L424) uses `upi`, `cash`, `cheque`, `bank_transfer` and statuses `awaiting_confirmation`, `confirmed`, `rejected`; no separate clearing or bounced state exists. [Payment integration tests](../tests/integration/database-billing-payments.test.ts) cover payment review/recording and ledger behavior.

**Toolkit difference:** Tool 90 offers Cash, UPI, Cheque, NEFT/RTGS, Card and Other, with `Cleared, Pending, Bounced` clearance status. Tool 91 reflects clearance on receipts. Card/Other are not current Homeish modes; NEFT/RTGS are represented within Bank Transfer.

**Change needed:** No payment lifecycle change now; preserve the current modes, statuses, admin-confirmation behavior, ledger-credit timing and receipt rules. Any later proposal must define mode eligibility, settlement recording, confirmed-but-not-cleared representation, credit/receipt timing and audited reversal of bounced payments. Do not assume a payment gateway or treat a typed mode/reference as proof that funds settled. Existing payment history cannot be safely reclassified without a separately approved data rule.

**Depends on:** D-14/D-32, BIL-6/BIL-7, existing payment/receipt and unit-ledger operations; M10/M11 if the owner wants accounting reconciliation.

**Risks / verify:** This changes recognition of real money and may affect receipts, outstanding balances, reports and follow-up notices. Existing confirmed payment behavior and immutable history must not be silently changed.

**Options:** A) Keep BIL-6/BIL-7 statuses and payment modes → **Recommended**: current confirmed/rejected controls and no-gateway rule are explicit. B) Add selected clearing states/modes only after approval of the lifecycle, receipt timing, bounced-payment correction and audit behavior. C) Another precise flow from the owner.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected option:** A, preserve current payment modes, statuses, admin-confirmation behavior, ledger-credit timing and receipt rules.

### GAP-M08-06 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Add missing read-only billing summaries for payment modes, wings, bill status and unit-credit advances.

**Why it helps:** Admins can review where collections came from, which wings remain outstanding and how much confirmed credit is held without rebuilding totals in a spreadsheet.

**Toolkit source:** [Tool 92](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t92>), [Tool 93](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t93>), [Tool 95](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t95>) and [Tool 96](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t96>).

**App today:** [BIL-11/12](./PRD.md#L316) already provide billed/collected/outstanding, top defaulters, collection percentage and CSV dues/collections/defaulters reports. [P27 analytics](./PRD.md#L590) and the [metric catalogue](../src/core/analytics/catalogue.ts#L36) already include dues ageing, collection trend and collection rate. The [unit ledger](./DATABASE.md#L531) already holds unallocated payment credit. No equivalent payment-mode split, wing collection summary or aggregate bill-status report was found; top pending/defaulter information is already partly covered.

**Toolkit difference:** Tool 92 summarizes receipt count, net collected, share, average receipt, pending clearance and bounced amounts. Tool 93's balance-advance-by-wing view uses manually entered `Adjusted Till Date`. Tool 95 reports wing, units, payable, collected, outstanding, efficiency and status. Tool 96 includes advance held, bill-status summary, top pending units, composition/trend and smart insights.

**Change needed:** Derive any new totals from confirmed payment, bill and unit-ledger records; calculate advance held from unapplied unit credit, never from a second editable balance. Keep pending/rejected submissions separate from confirmed collection. Avoid duplicating BIL-11 or the P27 ageing/trend/rate metrics. D-62 limits the analytics catalogue to 2–3 metrics per module; any new analytics metric must replace an existing one only after owner review. Otherwise, consider approved billing-report detail without adding P27 metrics. Keep analytics aggregate-only and do not expose names, phone numbers or unit-level balances in the dashboard.

**Depends on:** BIL-11/12, unit ledger and payment confirmation; P27/D-62 if shown in the analytics dashboard; GAP-M08-05 only if a new clearing lifecycle is approved.

**Risks / verify:** Pending/bounced amounts must not be counted as collected, and advance totals must reconcile to confirmed credits minus allocations. Report filters must use the same period and definitions as existing billing reports.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M08-07 · CONFLICT · Value M · Effort M-H · Confidence High

**What:** Preserve current bill delivery now; consider new channels only after separate approval.

**Why it helps:** A manual delivery log could show which bills were handed over or acknowledged, beyond whether an in-app/push notice was attempted.

**Toolkit source:** [Tool 94](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t94>).

**App today:** Bill generation sends the currently configured in-app/push notification and bills can be read as PDFs; no per-bill dispatch, physical delivery or acknowledgement record was found. [D-06](./PRD.md#L178) allows in-app, push and email for defined uses and keeps SMS/WhatsApp post-MVP. The [deferred-features register](./roadmap/deferred-features.md) also lists SMS/WhatsApp as deferred.

**Toolkit difference:** Tool 94 tracks `Delivery Mode` (`Hand Delivery, WhatsApp, Email, Letter Box, Courier`), dispatch date, delivered-by, status (`Pending, Delivered, Returned, Not Reachable`), acknowledgement/date, follow-up and an automatic WhatsApp link; it also exposes mobile and payable amount.

**Change needed:** No change now: keep current PDFs and notifications, with no delivery ledger. Only after separate purpose, channel and privacy approval may future work add bill email or WhatsApp; WhatsApp also requires a D-06 change. Do not add a sending provider or claim delivery based on a notification event.

**Depends on:** Existing bill/PDF and notification operations; explicit channel/privacy decision for any new delivery use; M25/P35.13 only for related letter-template scope.

**Risks / verify:** Delivery records can expose personal contact details and create false proof of legal service. Define access, retention and what acknowledgement means. **Verify any legally required notice/service method against the state co-operative act / our bye-laws.**

**Options:** A) Keep current bill PDFs and notifications, with no delivery ledger or new channel. B) Add manual dispatch/acknowledgement tracking only; do not add email/WhatsApp sending → **Recommended**: it preserves D-06 while allowing a delivery record. C) Add bill email or WhatsApp sending only after an explicit purpose/channel/privacy approval and, for WhatsApp, a D-06 change.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected scope:** Keep current PDFs/notifications now; no delivery ledger. Consider bill email/WhatsApp only after separate purpose, privacy and channel approval; WhatsApp also requires a D-06 change.

**Owner decisions:** All seven M08 cards are accepted for planning. The approved plan update is recorded in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) under P37; M09 Dues was next at the time. Its comparison and pending cards are documented below. No implementation is authorized.

## M08 documentation verification

- Re-read the M08 summary and all seven cards after editing; each card includes its toolkit source, app behavior, change needed, dependencies, risks and the recorded owner decision.
- Focused content check: **7 cards, 7 decision rows, 1 NEW, 2 ENHANCEMENT, 4 CONFLICT**; every tool from 85 through 96 is accounted for, including Tools 86/87's covered primary workflows.
- Focused plan check: all seven M08 decisions link to P37 entries/current-behavior guardrails; the remaining review queue has 18 modules and starts with M09; P37 is planning-only.
- `npx --no-install prettier --check docs\IMPLEMENTATION_PLAN.md docs\toolkit-gap-review.md`: passed.
- `git diff --check`: passed for tracked changes; an additional scan found no trailing whitespace in the M08 section.
- Confirmed the cited original Tool 85 workbook path exists. It was inspected locally and read-only; no other M08 original workbook was opened.
- No application tests were run because this batch changes documentation only. The approved decisions and P37 plan entries are recorded in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md); M09 Dues is next.

## M09 · Dues and arrears · Tools 97–108

**Summary:** 2 NEW, 0 ENHANCEMENT, 4 CONFLICT decision cards. Tools 97, 99, 107 and 108 are partly covered by the unit ledger, billing reports and P27 analytics. Tools 101/102 overlap notice-template work already planned in P35.13; this does not authorize sending a new channel. Tools 98, 100, 105 and 106 conflict with current billing or reporting definitions. Tools 103/104 add payment-plan and recovery-action tracking not found in the app. All six decisions are accepted for planning and recorded in P38; calculation, legal and access gates remain.

**Evidence searched:** PRD, database and API contracts; implementation plan and deferred roadmap; billing, late-fee, reminders/reports and analytics code; billing integration tests and migrations. Searches included dues, arrears, interest, overdue, defaulter, payment plan, recovery action, dispute, hold, collection efficiency and their related report/settings names. No M09 original Excel/PDF/Word workbook was opened; the guide and detailed tool reference were sufficient.

**Cross-module links:** Confirmed payments and unapplied credits come from the billing unit ledger; due dates and late fees come from billing settings/jobs; P27 consumes billing data for analytics. A tracker must read those sources, not create a second manual balance. Recovery notices/templates in P35.13 are planned separately and do not imply a new delivery channel or a legal service record.

### GAP-M09-01 · CONFLICT · Value H · Effort M · Confidence High

**What:** Add optional simple annual interest for future bills, gated on legal and calculation approvals and a separate decision about late-fee interaction.

**Why it helps:** Daily interest can represent continuing arrears more closely than a monthly fee, but it changes what a unit owes.

**Toolkit source:** [Tools 97–99](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t97>), especially [Tool 98](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t98>). Tool 98's formula is `Principal × Rate ÷ 100 × interest-bearing days ÷ 365` (simple interest); interest-bearing days begin after `(Due Date + grace days)`. It also has `Interest Waived` and `Interest Hold (Y/N)` inputs.

**App today:** [BIL-3 and D-13](./PRD.md#L300) use society-configured fixed or percentage late fees, off by default, after due date plus grace. The scheduled [late-fee job](../supabase/migrations/20261110200000_billing_fines_late_fees.sql#L1) uses the current outstanding amount, applies its monthly idempotence rule and does not compound. The approved [P37 decision](./IMPLEMENTATION_PLAN.md#L1736) retains this current behavior. The later M09 decision plans optional simple interest for future bills under P38.1, subject to its legal, calculation and late-fee-interaction gates. The bill/ledger contract keeps corrections auditable and bill history immutable ([database contract](./DATABASE.md#L531)).

**Change needed:** If considered, use the exact simple-interest formula above, but first define the principal basis, partial-payment treatment, effective date, rounding, 365-day denominator/leap-year handling, waiver authority, and whether interest can itself bear interest (recommended: no). Never copy a sample rate. Do not silently run interest alongside late fees or recalculate old bills; historical bill balances and confirmed payments must remain intact.

**Depends on:** Existing due dates, grace settings, confirmed payment allocations, current late-fee behavior and P37. Any rate, charge authority or notice wording must be verified against the state co-operative act / our bye-laws before implementation.

**Risks / verify:** This changes real amounts owed, may affect past-due balances and member notices, and can create disputes if the rate/base or effective date is wrong. The toolkit's rate examples are not legal authority.

**Options:** A) Keep BIL-3/D-13 late fees and do not add annual interest → **Recommended**: preserves the approved current billing rule. B) Add a separate, optional simple-interest policy for future bills only, after legal/bye-law and calculation rules are approved; explicitly decide whether the existing fee can also apply. C) Replace the current late fee with simple interest for future bills only, after the same approvals; retain all historical entries unchanged. D) Another precise choice.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected option:** B — add optional simple interest for future bills only, after legal/bye-law and calculation approval. Whether it may coexist with the current monthly late fee remains undecided and is a P38.1 gate.

### GAP-M09-02 · CONFLICT · Value H · Effort S-M · Confidence High

**What:** Keep Homeish's current any-overdue-bill defaulter rule.

**Why it helps:** A threshold could distinguish a late payment from repeated arrears, but it changes who appears on the defaulter list and may change follow-up.

**Toolkit source:** [Tool 100](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t100>); its defaulter rule is configurable, with the example threshold of two or more overdue bills.

**App today:** [BIL-11/12](./PRD.md#L316) and the [billing reports/dashboard](../supabase/migrations/20261110203000_billing_reminders_reports.sql#L1) treat any unit with an unpaid past-due bill as a defaulter; the dashboard ranks the top ten. The dues export includes the overdue units. This does not change the unit's underlying balance.

**Change needed:** No change to the threshold or reports. Keep any unit with an unpaid past-due bill in the defaulter view; keep the full dues and ageing views unchanged. Do not change balances, late fees, payment allocation, access or legal status.

**Depends on:** BIL-11/12; report definition and any P27 dashboard presentation.

**Risks / verify:** A higher threshold could hide a single overdue bill from a list that admins currently use to follow up. Do not describe a dashboard threshold as a statutory/legal definition of default.

**Options:** A) Keep the current any-overdue-bill rule → **Recommended**: preserves current dashboard and report behavior. B) Add a configurable threshold of overdue bills for the defaulter list only, without changing balances or ageing. C) Another precise definition.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected option:** A — keep the current any-overdue-bill defaulter rule; do not add a threshold or hide overdue balances.

### GAP-M09-03 · NEW · Value H · Effort M · Confidence High

**What:** Add an admin-only payment-plan tracker linked to a unit's existing bills and confirmed payments.

**Why it helps:** It gives staff a shared view of an agreed installment arrangement and next due date without maintaining another spreadsheet.

**Toolkit source:** [Tool 103](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t103>). Its fields include Plan ID, Unit, Plan Date, Dues Covered, Down Payment, Number of Installments, First Due Date, Installments Paid and Remarks; it works out installment amount, total received, balance, next due date, number behind, status and current ledger due.

**App today:** No payment-plan record, installment schedule or plan status was found in the app code, docs or migrations searched. The source of actual dues and credits is the existing [unit ledger](./DATABASE.md#L531), not a manually entered plan amount.

**Change needed:** Keep an arrangement tracker separate from the bill ledger. Show plan ID, unit, plan date, covered dues, down payment and installment count, first/next due dates, installments paid, remarks, computed status and the current ledger due. Compute total received only from confirmed payments; show plan balance as a separate estimate. Record the assigned approver and audit history. A plan must not change bill due dates, defer late fees, waive charges, reallocate payments or suppress reminders/recovery unless separately authorized.

**Depends on:** Unit ledger, confirmed payments, billing due dates and role/permission patterns. Any agreement's approval authority and effect on late fees/collection remain separate policy decisions.

**Risks / verify:** A tracker could be mistaken for a formal debt restructuring or for money received. Mark it clearly as an arrangement, and do not alter the authoritative ledger or legal due dates.

**Owner-selected scope:** Tracking only; no bill/ledger changes and no automatic pause in fees, reminders or recovery.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M09-04 · NEW · Value M · Effort M · Confidence High

**What:** Add an assigned recovery-action log with outcomes and follow-up dates.

**Why it helps:** Staff can see the history and owner of a follow-up instead of relying on personal notes or repeated contact.

**Toolkit source:** [Tool 104](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t104>). It records Action ID, date, unit, action type, outcome/remarks, next-action date, assignee and open/closed status; it calculates current dues, follow-up state and days since. Follow-up is Overdue when the next-action date has passed, Due Soon within seven days, Scheduled later, or Closed when closed.

**App today:** No unit-level recovery-action register, assignee or follow-up status was found. [P35.13](./IMPLEMENTATION_PLAN.md) already plans reminder/final-notice templates, but not a recovery history or delivery channel.

**Change needed:** Link each log entry to a unit and derive current dues from the ledger. Add the action date/type, outcome, next date, assignee and open/closed status; calculate the four follow-up states above. Do not use a manually typed `Recovered (₹)` as a payment; any recovered amount must link to confirmed ledger payments. Do not send WhatsApp messages or legal notices, and do not claim service/delivery; exclude WhatsApp as a default action type while D-06 remains unchanged. Legal-notice templates and actions require separate wording/authority review.

**Depends on:** Unit ledger and existing role permissions; P35.13 for any template use; D-06 before any new message channel.

**Risks / verify:** Recovery notes and member-identifying details need restricted access and retention rules. A contact log is not proof of legal service or authority to recover. Verify statutory notices and deadlines against the state co-operative act / our bye-laws.

**Owner-selected scope:** Internal action history only; no messaging, legal effect, accounting entries or change to dues.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M09-05 · CONFLICT · Value H · Effort M · Confidence High

**What:** Keep audited billing corrections without adding a separate dispute register or interest hold.

**Why it helps:** Keeping corrections in the existing audited paths avoids a parallel dispute status and an unapproved hold on charges.

**Toolkit source:** [Tool 105](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t105>). It records a dispute ID, unit, bill reference/period, disputed amount, category, raised date, status, `Interest Hold`, committee remarks, resolution date and adjustment; it calculates days open and an alert. Example statuses are `Open`, `Under Review`, `Resolved - Adjusted`, and `Resolved - Rejected`.

**App today:** No bill-dispute register or interest-hold field was found. Billing changes are handled through audited waiver/adjustment paths and immutable bill history; the app has no rule that a dispute pauses a charge or collection.

**Change needed:** No new workflow. Continue using existing audited waiver/adjustment paths. No dispute status or hold will pause fees, reminders or collection. Any future dispute tracker or hold requires a new owner decision and the legal/financial approvals described above.

**Depends on:** BIL-3/D-13 late-fee rules, the billing adjustment/waiver audit path, unit ledger and authorized committee/admin roles.

**Risks / verify:** If reconsidered, a hold could change money owed and members' recovery treatment; a category or status could imply an approved legal finding. Define who can open, resolve and authorize any financial adjustment. Verify legal and bye-law requirements before changing charges or recovery.

**Options:** A) Keep existing audited corrections; no separate dispute register → **Recommended**: avoids introducing an unapproved hold or parallel workflow. B) Add a non-mutating dispute register; `Interest Hold` is informational only and has no effect on fees, reminders or collection. C) Add a hold that pauses a specifically approved fee/interest amount, only after the amount, authority, start/end dates and reporting effects are approved. D) Another precise choice.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected option:** A — no separate dispute/hold register; keep current audited correction paths and do not pause fees, reminders or collection.

### GAP-M09-06 · CONFLICT · Value H · Effort M · Confidence High

**What:** Add a separate, read-only as-of collection-efficiency report without replacing Homeish metrics.

**Why it helps:** A selected as-of date and wing breakdown can help admins see whether due bills were collected and how outstanding balances vary by bill month.

**Toolkit source:** [Tools 106–108](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t106>). Tool 106 defines `CE % = Collected ÷ Billed for bills whose due date has passed (up to the As-On date)` and includes target/gap/rating and wing summaries. Tools 107/108 provide as-of outstanding by bill month and additional dues/interest/defaulter summaries.

**App today:** [BIL-11](./PRD.md#L316) defines collection percentage as collected divided by billed less waived in a selected bill period. [P27](./PRD.md#L590) defines collection trend as billed by bill month versus confirmed payments by paid date, and collection rate as the share of bills settled in full; its ageing buckets are already present in the [analytics catalogue](../src/core/analytics/catalogue.ts#L36). D-62 limits billing analytics to 2–3 metrics per module. Existing [billing exports](../supabase/migrations/20261110203000_billing_reminders_reports.sql#L1) already cover dues, collections and defaulters.

**Change needed:** Do not change BIL-11 or P27 definitions. If accepted, add a separately labelled, read-only report using Tool 106's as-of date and formula, with all filters and numerator/denominator visible; optionally include an as-of outstanding-by-bill-month table from Tool 107. Derive values from confirmed ledger records, not typed workbook totals. Keep it as report detail, not a new P27 metric, unless the owner separately approves a D-62 replacement. Do not duplicate Tool 108 summaries already present.

**Depends on:** Billing ledger, due dates, waived amounts and existing BIL-11/P27 definitions; D-62 if any dashboard metric is changed.

**Risks / verify:** The toolkit's due-date formula and Homeish's period percentage answer different questions; comparing them without labels can mislead. Confirm treatment of partial payments and waivers in the due-date numerator and denominator before release.

**Options:** A) Keep existing BIL-11/P27 definitions and reports, with no separate due-date efficiency view → **Recommended**: avoids competing figures for the same label. B) Add a separately named, read-only as-of report using Tool 106's formula and optionally Tool 107's month breakdown; do not alter P27 metrics. C) Replace one existing P27 metric only after an explicit D-62 decision and revised definition. D) Another precise choice.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected option:** B — add a separate, read-only as-of report; keep BIL-11/P27 definitions unchanged and add no P27 metric.

### M09 covered, partial and planned tools

- **Tools 97 and 99 — partly covered:** Homeish has an authoritative unit ledger, dues exports, a unit-level defaulter view and P27 ageing buckets (`Not Due`, `1–30`, `31–60`, `61–90`, `Over 90`). The toolkit's separate manual `Members`/`Dues_Data` sheets would duplicate source records; interest columns depend on GAP-M09-01.
- **Tools 101 and 102 — planned overlap:** reminder and final-notice templates are included in P35.13. The template plan does not authorize WhatsApp links/sending, a delivery ledger, or legal service claims; D-06 and any legal notice policy remain gates.
- **Tools 107 and 108 — partly covered:** the as-of monthly outstanding view has no exact counterpart found; the unit ledger, BIL-11/12 exports, ageing, top-defaulter view and P27 reports cover much of their due/balance/collection summary. Any remaining as-of breakdown belongs with GAP-M09-06, not a duplicate dashboard metric.
- **No items classified wholly Not Relevant:** all tool groups relate to housing dues, but several must remain partial or gated because Homeish already has a source of truth or a separate planned workflow.

### M09 documentation verification

- Re-read all six M09 cards and the top summary; each card includes source, app behavior, proposed change, dependencies, risks and the recorded owner decision. Each conflict has options, a recommendation and the selected option.
- Focused content check: **6 cards, 2 NEW, 0 ENHANCEMENT, 4 CONFLICT**. Tools 97–108 are accounted for as cards, partial coverage or planned overlap.
- Confirmed the documented Tool 98 formula and the fields/rules for Tools 103–106 in the read-only detailed reference. No original M09 workbook was opened.
- All six decisions are recorded in P38 in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md); P38 is planning-only and preserves the documented calculation, legal, access and report-definition gates.
- `npx --no-install prettier --check docs\toolkit-gap-review.md`: passed. A focused scan found no trailing whitespace in the M09 section.
- No application code, schema, migrations or tests were changed; application tests were not run because this is documentation-only work.

## M11 — Society Accounts & Cash Book (Tools 121–132)

**Comparison status:** Complete; all eight decisions are recorded in P39. Six are accepted for planning, two conflicts are rejected with current behavior confirmed; no implementation is authorized.

**Summary:** 2 NEW, 4 ENHANCEMENT, 2 CONFLICT cards; all 12 tools assessed. Homeish already has a simple append-only cash/bank book, per-account balances, expense approval and reversal, confirmed billing-income entries, month locks, and period/monthly reports. The accepted additions are per-entry running balances, a readable voucher number, bank reconciliation, a linked petty-cash view, gated fixed-deposit tracking and monthly cumulative surplus reporting. The owner rejected cheque-clearing tracking and full double-entry accounting, confirming P16/D-39 behavior.

**Highest-value M11 decisions:** The eight decision cards below are ranked in the dashboard above. The owner kept D-39's accounting boundary and current cheque posting; accepted a separate bank reconciliation and a fixed-deposit register gated on M10.

**App today — built and tested:** P16 is implemented as simple bookkeeping, not double-entry accounting. It has cash/bank accounts and opening balances; append-only entries for expenses, non-billing income, confirmed billing payments and reversals; approval for larger expenses; reports, CSV/PDF exports and month close/reopen. The PRD and plan document the boundary; database/API contracts, operations, UI and integration/unit tests cover it. See [P16 requirements and D-39](./PRD.md#L468), [database contract](./DATABASE.md#L875), [expense API](./API.md#L446), [expense operations](../src/core/expense/operations.ts), [expense validation](../src/core/expense/validation.ts), [expense integration tests](../tests/integration/database-expense.test.ts) and [expense unit tests](../tests/unit/expense.test.ts).

**Roles and visibility:** The existing expense module uses its current admin/committee permissions and society scoping. No new access roles are proposed here. A bank statement, petty-cash custodian or fixed-deposit record would need an access and audit review at implementation kickoff.

**Module links:** Confirmed maintenance receipts already feed the P16 book. M11 also overlaps the toolkit's M10 fund-wise interest work (Tool 118), so Tool 129 must reuse the future M10 source of truth rather than create a second fund balance or interest ledger. M11's other fund, budget, vendor and staffing links are not being decided by this module review.

**Read-only comparison:** The app's cash/bank book and monthly report are covered in part; this does not imply full workbook parity. No original M11 workbook was opened because the detailed tool reference supplied the fields and rules needed for this comparison.

### GAP-M11-01 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Show a derived running balance beside each entry in the cash and bank books.

**Why it helps:** An account's current balance is available, but an admin or committee reviewer cannot see how each receipt or payment changes the balance along the entry history.

**Toolkit source:** [Tools 121 and 122](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t121>). Both show receipts/payments and a running balance in the book.

**App today:** P16 stores an opening balance and signed append-only entries. The database calculates an account balance as of a date, while the entry-page response contains the entry amount and direction, not a balance after that entry. The current [expense report](../src/core/expense/documents.ts) shows period totals and closing account balances, not a per-row running balance.

**Change needed:** Derive the running amount from the opening balance and existing entries, display it on each cash/bank book row, and include it in the appropriate book export. Do not store a second balance or change posting, reversal, or month-lock behavior.

**Depends on:** P16 account opening balances, book entries, reversals and a stable ordering for entries on the same date.

**Risks / verify:** Same-day ordering and reversals must be handled consistently so the displayed sequence ends at the existing as-of account balance. This is a read-only calculation, not a new financial entry.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected decision:** Accept for planning in [P39.1](./IMPLEMENTATION_PLAN.md#p39-1); derive balances from existing entries only.

### GAP-M11-02 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Provide a human-readable voucher number and register view linked to existing P16 transactions.

**Why it helps:** The current internal entry ID is unique but not convenient to quote in a paper voucher, approval discussion or audit query; an optional external reference is not a shared voucher number.

**Toolkit source:** [Tool 130](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t130>) lists voucher number, date, party, account head, mode, amount, approval and proof. Its `Journal` and `Contra` types are not included in this proposal; see GAP-M11-04.

**App today:** The P16 export includes an internal entry ID, optional reference, counterparty and description. Expense approval state and receipt evidence exist, but there is no common human-readable voucher number for all book entries. See [CSV/PDF export fields](../src/core/expense/documents.ts) and the [book-entry contract](./DATABASE.md#L875).

**Change needed:** If accepted, attach one immutable, readable voucher number to each existing source transaction and show the source's available approval/reference/receipt details in a register. Keep the existing source ID, do not create a duplicate financial entry, and do not add journal/contra posting. Decide the numbering scope and treatment of historical entries before implementation; do not silently renumber records.

**Depends on:** P16 book entries and source links; GAP-M11-04 remains the boundary for journal/contra accounting.

**Risks / verify:** Voucher numbering needs a collision-safe rule and clear handling of pre-existing entries. The register must not imply approval or receipt of money beyond the source record.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected decision:** Accept for planning in [P39.2](./IMPLEMENTATION_PLAN.md#p39-2); numbering scope and historical-entry treatment remain kickoff gates.

### GAP-M11-03 · CONFLICT · Value H · Effort M · Confidence High

**What:** Track cheque issue and clearing states without silently changing when P16 expenses affect account balances.

**Why it helps:** A society can see which cheques remain outstanding and follow up on cancelled, stopped or cleared payments.

**Toolkit source:** [Tools 122 and 128](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t122>). Tool 122 includes a pending/cleared bank status; Tool 128 includes `Issued - Pending`, `Cleared`, `Cancelled` and `Stopped`, cheque number, issue/clearing dates, days pending and an ageing flag. Tool 122 also distinguishes `NEFT / RTGS` and `Debit Card` from a generic bank mode.

**App today:** P16 accepts `cash`, `bank`, `upi` and `cheque` payment modes. Expense approval states are `pending_approval`, `posted` and `rejected`; they are not bank-clearing states. An approved expense is posted to the book without a later cheque-clearing event. See [expense input rules](../src/core/expense/validation.ts) and [P16 database behavior](./DATABASE.md#L875).

**Change needed:** Choose whether to keep current behavior, add a linked informational cheque register, or change the booking rule. A tracking-only register must preserve the existing P16 entry and account balance; a cancelled/stopped cheque must not automatically reverse it. Changing recognition to the clearing date would be a separate financial behavior change.

**Depends on:** P16 expense posting, auditable reversal path and any selected bank reconciliation.

**Risks / verify:** Treating `posted` as `cleared`, delaying a book entry, or silently reversing a cheque can make account balances and reports wrong. Any change to recognition requires an approved accounting policy and migration/reconciliation plan.

**Options:** A) Keep P16 behavior; do not track clearing states → **Recommended**: preserves the approved simple-bookkeeping contract. B) Add a linked tracking-only register, leaving book posting and balances unchanged; corrections still use the existing audited reversal path. C) Change book recognition to depend on clearing, after an explicit accounting decision, impact review and migration plan. D) Another precise choice.

**Decision:** [ ] Accept [x] Reject [ ] Defer

**Owner-selected option:** A — keep P16's current approved-expense posting; do not add a cheque-clearing tracker.

### GAP-M11-04 · CONFLICT · Value H · Effort XL · Confidence High

**What:** Decide whether to retain simple bookkeeping or expand to journals, a general ledger and trial balance.

**Why it helps:** Full double-entry accounting can give an accountant debit/credit journals and a trial balance, but it changes the accounting model, not just the reports.

**Toolkit source:** [Tools 123–125](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t123>) provide journal entries, ledger accounts and trial balance, including debit/credit totals and closing balances.

**App today:** P16 intentionally records single cash/bank movements and calculates account balances; it is not a general ledger. D-39 explicitly puts full double-entry accounting, general ledger, trial balance and balance sheet outside the current product scope. See [D-39](./PRD.md#L1018), [P16 data contract](./DATABASE.md#L875) and [P16 plan](./IMPLEMENTATION_PLAN.md).

**Change needed:** The current recommendation is to keep D-39. Expanding it requires an explicit product decision, accounting design, opening-balance and historical-data treatment, revised database/API/report contracts and expert review before any implementation. Do not represent a cash-book report as a trial balance.

**Depends on:** Owner decision, accountant review, and a new approved accounting contract; Tool 129/M10 fund accounting must be resolved separately.

**Risks / verify:** A partial or incorrectly balanced journal/ledger can misstate society finances and make current reports incomparable. Verify accounting treatment, statutory and bye-law requirements, migration and access controls before accepting a full expansion.

**Options:** A) Keep D-39/P16 as simple bookkeeping; do not plan full double-entry → **Recommended**: maintains the explicit current boundary. B) Defer the full accounting question to a separately approved post-MVP design with an accountant and migration analysis. C) Approve planning for a full double-entry expansion, gated on that design and review. D) Another precise choice.

**Decision:** [ ] Accept [x] Reject [ ] Defer

**Owner-selected option:** A — keep D-39's simple cash/bank bookkeeping; do not add full double-entry accounting.

### GAP-M11-05 · NEW · Value H · Effort M · Confidence High

**What:** Add a manual bank-reconciliation register for comparing book entries with a bank statement, without posting adjustments.

**Why it helps:** It can show deposits not yet credited and payments or charges not yet reflected by the bank, and how long each item has remained unresolved.

**Toolkit source:** [Tool 126](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t126>) records date, reference, party, reconciling-item type and amount; it derives the effect on balance, days outstanding and an ageing flag. Examples include issued cheques not presented, deposits not credited, bank charges/interest not yet entered, and direct debits/credits.

**App today:** P16 has bank accounts, opening balances and book entries but no statement-matching or reconciliation workflow. The app searches found no bank-statement import or bank reconciliation feature.

**Change needed:** If accepted, create a dated reconciliation per bank account with manually entered or matched statement items, the toolkit's reconciling-item categories, derived effects and ageing, and a clearly labelled comparison. Do not automatically create or alter P16 income/expense entries; actual charges or income must still use the existing audited book operations.

**Depends on:** P16 bank accounts and entries; agree the reconciliation's statement-date and access rules at implementation kickoff.

**Risks / verify:** A difference or reconciling item is not proof of an expense, income or cleared payment. Keep the source statement and book separate; use approved entries for any real adjustment and preserve a review trail.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected decision:** Accept for planning in [P39.3](./IMPLEMENTATION_PLAN.md#p39-3); reconciliation does not post book adjustments.

### GAP-M11-06 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Add an optional petty-cash/imprest view tied to the existing cash book.

**Why it helps:** A cash custodian can see the float received, approved spending and expected cash in hand without keeping a second, conflicting society cash balance.

**Toolkit source:** [Tool 127](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t127>) records date, voucher number, purpose, paid to, approved by, imprest received, spent and cash in hand.

**App today:** P16 already records cash receipts and spending in the society cash account, with counterparty, category, reference and the current expense approval workflow. No separate petty-cash custodian or imprest register was found.

**Change needed:** If accepted, link a custodian/imprest view to existing P16 cash entries and derive its book amount from those entries. Any physical cash count should be a separately labelled check, not a second editable ledger balance. Preserve current expense approval thresholds and posting rules.

**Depends on:** P16 cash account, expense approvals and reversals; agree custodian access and any physical-count process first.

**Risks / verify:** A second manually maintained balance can double-count cash or hide a mismatch. Do not introduce a new approval rule or treat a typed count as a posted receipt.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected decision:** Accept for planning in [P39.4](./IMPLEMENTATION_PLAN.md#p39-4); link the view to P16 cash entries, with no second balance.

### GAP-M11-07 · NEW · Value H · Effort M · Confidence Medium

**What:** Add a fixed-deposit register for deposit details, maturity and interest estimates.

**Why it helps:** Committee members can see which deposits are held, their maturity dates and upcoming follow-up without treating an estimate as cash already received.

**Toolkit source:** [Tool 129](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t129>) includes bank, fund, deposit receipt number, principal, rate, tenure, deposit/maturity dates, maturity value, accrued interest and status.

**App today:** No fixed-deposit instrument register was found in the P16 account model or expense operations. The toolkit's M10 Funds module includes related fund/interest work (Tool 118); that module's nine decisions are accepted for planning and recorded in P40.

**Change needed:** If accepted, plan an instrument register linked to the M10 fund and bank sources of truth. Display maturity and accrued-interest figures as estimates until confirmed; do not automatically post principal, accrued interest or maturity proceeds to P16.

**Depends on:** P40.1's approved fund mapping; accountant review of interest calculation, tax and posting treatment.

**Risks / verify:** The toolkit's example rates and formulas are not authoritative. Verify actual deposit terms, applicable taxes, early withdrawal treatment and relevant bye-laws; keep estimated accrual separate from received income and available cash.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected decision:** Accept for planning in [P39.5](./IMPLEMENTATION_PLAN.md#p39-5), gated on P40.1 fund mapping and accountant review.

### GAP-M11-08 · ENHANCEMENT · Value M · Effort S · Confidence High

**What:** Show monthly and cumulative surplus/deficit in the existing accounts report.

**Why it helps:** Month-by-month net flow makes it easier to spot a changing pattern than income and expense totals alone.

**Toolkit source:** [Tools 131 and 132](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t131>). Tool 131 gives monthly and financial-year income/expenditure summaries; Tool 132 adds monthly and cumulative surplus/deficit.

**App today:** The P16 report already provides period income, expense, total surplus/deficit, monthly income/expense and closing account balances. It does not show monthly net surplus/deficit or cumulative net flow for each month. Tool 132's manually entered summary totals should not replace Homeish's posted-book source.

**Change needed:** Extend the existing report with a derived monthly net and cumulative net-flow column from P16 entries. Label cumulative net flow distinctly from account cash/bank balance; keep the existing April–March financial-year default and do not create a separate manually keyed summary.

**Depends on:** P16 report and existing posted/reversed entries; D-62 if anyone later proposes a dashboard metric rather than report detail.

**Risks / verify:** Cumulative operating net flow is not the same as available cash or total account balance because opening balances and transfers may differ. Keep the report read-only and preserve current definitions.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner-selected decision:** Accept for planning in [P39.6](./IMPLEMENTATION_PLAN.md#p39-6); derive the report from posted books and do not add a P27 metric.

### M11 covered, partial and conflicting tools

- **Tools 121–122 — core workflow covered, details partial:** Homeish already has cash/bank accounts, opening balances, dated entries, payment references, account balances and reports. The toolkit's per-entry running balance is GAP-M11-01. Tool 122's cheque-clearing state and more specific bank modes are part of GAP-M11-03.
- **Tools 123–125 — conflict:** Their journal, general ledger and trial-balance model exceeds the simple-bookkeeping scope in D-39; see GAP-M11-04.
- **Tool 126 — new:** no bank-statement matching or reconciliation function was found; see GAP-M11-05.
- **Tool 127 — partial:** cash entries and approval exist, but there is no petty-cash custodian/imprest view; see GAP-M11-06.
- **Tool 128 — conflict/partial:** cheque payment mode exists, but clearing/cancelled/stopped statuses and ageing do not; see GAP-M11-03.
- **Tool 129 — new, cross-module:** no fixed-deposit register was found; M10 Tools 117–118 add related fund and interest details; see GAP-M11-07 and the M10 decisions below.
- **Tool 130 — partial:** internal entry IDs, optional references, expense approval and receipt evidence exist, but no common human-readable voucher number; see GAP-M11-02. Journal/contra voucher types remain outside D-39.
- **Tool 131 — covered:** P16 reports monthly income/expense and financial-year-to-date totals.
- **Tool 132 — partial:** period surplus and monthly income/expense exist, but monthly and cumulative net flow do not; see GAP-M11-08.
- **No tools classified wholly Not Relevant:** all M11 items concern society accounts, but some are already covered, partial, gated or in conflict with the approved simple-bookkeeping boundary.

### M11 documentation verification

- Re-read all eight M11 cards and the top summary; every card includes toolkit source, current app behavior, proposed change, dependencies, risks and the recorded owner decision. Both rejected conflicts record Option A and the current behavior to preserve.
- Focused content check: **8 cards, 2 NEW, 4 ENHANCEMENT, 2 CONFLICT**. Tools 121–132 are accounted for as cards, partial coverage, covered behavior or conflict.
- Read the M11 guide summary and detailed Tools 121–132 reference. No original M11 workbook was opened.
- All eight M11 decisions are recorded in P39 and the Toolkit Review Decisions register. M10's nine decisions are also recorded in P40. At M11 close, M12 was next; M12 decisions are now recorded in P41, and the M13 comparison follows below.
- No application code, schema, migrations or tests were changed. This is documentation-only, so application tests were not run.

## M10 — Sinking Fund, Reserve & Repair Fund (Tools 109–120)

**Later owner decision (2026-11-21):** PRD D-73 supersedes the earlier M10 and P39.5 review gates for the approved manual tools, including redevelopment fund transfers. Professional review is recommended rather than an in-app prerequisite; applicable statutory/bye-law checks and separate live-release approval still apply. The original comparison below is historical and is not proof of implementation or professional approval.

**Review status:** All 12 tools compared at detail level. The owner accepted all nine merged decisions for planning on 2026-11-18; GAP-M10-04 uses Option B. They are recorded in P40 and the Toolkit Review Decisions register in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#toolkit-review-decisions). Acceptance is not implementation approval.

**Counts:** 4 NEW, 4 ENHANCEMENT, 1 CONFLICT; one base capability (Tool 117's fixed-deposit register) is already accepted in P39.5, and Tool 113 partly overlaps P37.3's planned general bill-estimate calculator. No tool is wholly irrelevant.

### Highest-value M10 decisions

The recommendations below are the reviewer's suggestions; the owner's final decision on every item is Accept.

| Rank | ID         | Item                                                               | Recommendation                                                 |
| ---- | ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1    | GAP-M10-01 | Fund-wise balances within the existing cash/bank books             | Accept only as linked allocations, not duplicate books         |
| 2    | GAP-M10-04 | Sanctioned amount vs actual fund spending and approval             | Option B: derive actual spending from P16 entries              |
| 3    | GAP-M10-05 | Fund balance, investment and monthly-movement reports              | Accept after a single fund source is established               |
| 4    | GAP-M10-02 | Sinking/repair/reserve contribution breakdown and tenant surcharge | Accept as a preview; rates and eligibility need approval       |
| 5    | GAP-M10-03 | Corpus amount and collection tracker at admission/transfer         | Defer until M02/M18 confirm authority and treatment            |
| 6    | GAP-M10-06 | Transfers between earmarked funds                                  | Defer until legal authority and approval rules are agreed      |
| 7    | GAP-M10-08 | Gross interest, tax withheld and net interest by fund              | Accept as a tracker; only confirmed cash reaches P16           |
| 8    | GAP-M10-07 | Fixed-deposit maturity alerts beyond the accepted P39.5 register   | Accept as estimates/worklist only; no automatic renewal        |
| 9    | GAP-M10-09 | Multi-year repair funding forecast                                 | Defer until the M17 repairs review to avoid duplicate planning |

### Money, legal and member-rights safeguards in M10

- **GAP-M10-04 is the direct behavior conflict:** P16 posts approved expenses to the authoritative cash/bank book, while Tool 114 lets users type a separate amount "Utilised" and shows its own approval statuses. Do not create two actual-spend totals or let the register bypass P16 approval and posting.
- **GAP-M10-01/05/06:** fund allocations are not separate cash or bank accounts. Fund totals, transfers and FD investments must reconcile to P16 and the accepted P39.5 instrument register without counting the same money twice. Whether a sinking, repair, reserve, corpus or redevelopment fund may be used or transferred for a purpose requires accountant review and verification against the state co-operative act / society bye-laws.
- **GAP-M10-02/03:** contribution rates, tenant surcharges, corpus dues, concessions, and which transfer/admission events can attract a charge affect real member obligations. Toolkit examples do not establish local authority; verify against the state co-operative act / society bye-laws before setting any rule.
- **GAP-M10-07/08:** FD maturity and interest formulas are estimates, not the bank's contract or confirmed income. Tax withholding, accounting recognition, benchmark rates, renewal decisions and actual posting need accountant review. Never post estimated interest or maturity proceeds as received money.
- **GAP-M10-09:** inflation forecasts and special-levy implications are planning estimates, not approved levies, tenders or repair decisions.

### GAP-M10-01 · NEW · Value H · Effort L · Confidence High

**What:** Add sinking, repair and reserve balances as fund allocations linked to P16, rather than as separate cash books.

**Why it helps:** Members of the committee can see money reserved for a purpose without confusing that earmark with a separate bank balance.

**Toolkit source:** [Tools 109–111](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t109>) describe contribution/interest/withdrawal/transfer entries, repair categories and reserve purposes. The ledgers derive running balance as opening balance plus credits minus debits.

**App today:** P16 has named cash/bank accounts, opening balances and append-only entries, but no fund assignment on those entries; see [P16 requirements](./PRD.md), [database contract](./DATABASE.md) and [expense operations](../src/core/expense/operations.ts). A billing charge may be named "Sinking Fund", but that does not allocate the receipt to a fund balance.

**Change needed:** Support fund tags (at minimum sinking, repair and reserve) on approved sources and derive each fund's movements/balance from linked P16 entries. Preserve the toolkit ledger fields where needed: date, voucher/reference, entry type, particulars, unit/party, mode, amount, credit, debit and running balance; keep repair category and reserve purpose as typed, approved context. Do not create another editable opening balance or bank/cash balance.

**Depends on:** P16's append-only entry/reversal rules; accepted P39.1 running-balance work; agreement on the opening fund allocation and handling of historical entries.

**Risks / verify:** An earmark is not another asset. Fund totals must reconcile to the society's real cash, bank and approved FD balances; spending restrictions and any interest allocation require accountant and bye-law review.

**Recommendation:** Accept the linked fund-allocation view, not separate books.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M10-02 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Show a per-unit breakdown of sinking, repair and reserve contributions, including any approved tenant surcharge.

**Why it helps:** A bill preview can show which fund-related charge makes up a total before the bill is created.

**Toolkit source:** [Tool 113](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t113>) uses unit, occupancy and area. Its workbook calculates area-based funds as `ROUND(area × rate per sq.ft. × months, 0)`, reserve as `ROUND(per-unit reserve rate × months, 0)`, and tenant surcharge as `ROUND((sinking + repair + reserve) × surcharge rate, 0)` for tenant occupancy; it then totals the contributions, monthly equivalent and share percentage. These formulas are from the original [calculator workbook](<../../Cooperative & Housing Society Management Toolkit/Module_10_Sinking_Fund_Reserve_Repair_Fund/1_Individual_Tools/113_Fund_Contribution_Calculator.xlsx>).

**App today:** Billing supports fixed, per-sq-ft and custom charges in [billing validation](../src/core/billing/validation.ts). The owner accepted P37.3 for a general estimate from configured billing rules; it does not allocate an estimate among M10 funds or apply a fund-specific tenant surcharge.

**Change needed:** Extend the planned preview only with the approved fund-by-fund breakdown and share. Do not create a bill, set a charge rate, or change occupancy eligibility from the estimate. No rate or percentage in the sample workbook is a default.

**Depends on:** P37.3; approved fund rates, reserve basis, tenant eligibility and surcharge authority; GAP-M10-01 if estimates should reconcile to fund allocations.

**Risks / verify:** Rate, area basis, rounding, period length and tenant surcharge affect members' bills. Verify authority and treatment against the state co-operative act / society bye-laws.

**Recommendation:** Accept the breakdown as a non-posting preview, after its rules are approved.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M10-03 · NEW · Value H · Effort M · Confidence Medium

**What:** Track approved corpus contributions and receipts for admission or transfer events.

**Why it helps:** An authorized corpus obligation and the amount actually received can be seen separately and followed up without treating a typed value as a payment.

**Toolkit source:** [Tool 112](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t112>) records unit, event (`New Admission`, `Flat Transfer`, `Legal Heir Transfer`, `Gift Transfer`), area, concession, receipt reference, mode and received amount. Its workbook uses `corpus due = area × rate`, `net due = max(due − concession, 0)` and `pending = max(net due − received, 0)`; see the original [corpus tracker workbook](<../../Cooperative & Housing Society Management Toolkit/Module_10_Sinking_Fund_Reserve_Repair_Fund/1_Individual_Tools/112_Corpus_Fund_Tracker.xlsx>).

**App today:** No corpus ledger or transfer/admission corpus charge was found. Related member/share fees were deferred in M02, and ownership/transfer terms are not yet settled in M18.

**Change needed:** If accepted, record only a corpus amount already authorized by the society, its unit/event and concession, and link each actual receipt to P16. A tracker value must not create a bill, legal due, confirmed payment, unit-ledger credit or transfer/NOC block.

**Depends on:** M02 membership/fee decisions, M18 transfer rules, P16 receipt/accounting contracts and GAP-M10-01 fund mapping.

**Risks / verify:** This can create or imply a member's financial obligation. The per-area formula and listed event types are toolkit examples, not authority. Verify fees, concessions, legal-heir treatment and receipt handling against the state co-operative act / society bye-laws.

**Recommendation:** Defer until M02/M18 and an accountant confirm authority and money treatment.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M10-04 · CONFLICT · Value H · Effort M · Confidence High

**What:** Compare approved repair/fund spending against a sanctioned amount without making a second actual-spend or approval record.

**Why it helps:** A committee can spot remaining budget, overruns and pending work approvals in one place.

**Toolkit source:** [Tool 114](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t114>) records fund, category, purpose, vendor, resolution, approval, sanctioned and utilised amounts; the workbook calculates variance as sanctioned minus utilised and utilisation percentage as utilised divided by sanctioned. It also labels committee/General Body approval and overrun states.

**App today:** P16's approved/posted expense entries are the source for actual spending; expenses above the configured threshold require approval by a different committee member. Tool 114's manually entered `Utilised` amount and approval state could diverge from or bypass that path; see [P16 requirements](./PRD.md) and [P16 API rules](./API.md).

**Change needed:** If accepted, link a sanction/work record to the resolution and fund, then derive actual utilisation only from its linked P16 entries. Keep committee/General Body resolutions as authority evidence, not a substitute for P16's expense approval and posting.

**Depends on:** P16 expense entries and approvals; GAP-M10-01 fund mapping; agreement on how an approved work item links to one or more expenses.

**Risks / verify:** Toolkit approval labels and thresholds are examples. Do not create duplicate posted amounts, treat a sanction as spending, or imply that an approval in this register posted money.

**Options:** A) Keep P16 as-is and add no fund-utilisation register B) Add a sanction/work register but derive actual spend from linked P16 entries and preserve P16 approvals C) Copy the standalone toolkit register with manually entered utilisation and approval states → **Recommended: B**, to avoid duplicate or bypassed financial records.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Conflict option:** [ ] A [x] B [ ] C

### GAP-M10-05 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Add read-only fund balance and monthly movement summaries to the existing finance reports.

**Why it helps:** Committee members can compare each fund's opening amount, inflows, spending, transfers, investment and target without maintaining a separate monthly spreadsheet.

**Toolkit source:** [Tools 115 and 120](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t115>) show opening balance, contributions/collections, interest, transfers, utilisation, closing balance, invested FDs, cash/bank, funded percentage and monthly trend. The workbook calculates closing as `opening + contributions + interest + transfers in − transfers out − utilisation`; Tool 120 calculates monthly net movement as `collections + interest + transfers in − transfers out − utilisation`.

**App today:** P16 reports income, expense and account balances, not fund-specific balances, funded levels or monthly movement. Tool 115's `closing − invested in FDs` cash/bank split can be useful only if FD balances are linked to the already accepted [P39.5 register](./IMPLEMENTATION_PLAN.md#p39-5).

**Change needed:** Derive summaries from GAP-M10-01 fund allocations and linked P16 entries; link investments to P39.5 and label fund balance separately from available bank/cash. Do not accept manually typed monthly totals or count the same FD as both cash and investment. Target/health labels must be approved, not copied from the sample thresholds.

**Depends on:** GAP-M10-01 fund allocation; GAP-M10-04 if sanctioned/actual work summaries are included; P39.5 for FD balances; accountant-approved target definitions.

**Risks / verify:** A fund balance is not the same as available cash, and a target percentage is not a statutory health grade. Transfers must cancel in the society-wide total.

**Recommendation:** Accept after the underlying fund balances have one reconciled source.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M10-06 · NEW · Value M · Effort M · Confidence Medium

**What:** Record approved transfers between earmarked funds, with linked out/in allocations.

**Why it helps:** A documented transfer can show where an approved reallocation came from, where it went and which resolution authorized it.

**Toolkit source:** [Tool 116](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t116>) records date, transfer number, from/to fund, amount, purpose, resolution and approving body; its validity check rejects same-fund or non-positive transfers and flags pending/over-limit approvals.

**App today:** P16 records cash/bank entries but has no fund-to-fund transfer concept. No permission to move money between a sinking, reserve, repair, corpus or redevelopment fund was found.

**Change needed:** If accepted, make a transfer an equal debit from one approved fund allocation and credit to another, linked to its resolution; it must not change total society cash/bank or create an income/expense. Do not include redevelopment funds until M17 and legal review establish scope.

**Depends on:** GAP-M10-01; approved transfer authority, allowable source/destination pairs, approval body and accounting/audit treatment.

**Risks / verify:** Transferability can be restricted by statute, scheme rules or bye-laws. The toolkit's approval thresholds are examples; they do not authorize any transfer.

**Recommendation:** Defer until an accountant and legal/bye-law review confirm which funds may transfer and who may approve.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M10-07 · ENHANCEMENT · Value M · Effort S · Confidence High

**What:** Add maturity countdown and renewal follow-up to the fixed-deposit register already accepted in P39.5.

**Why it helps:** Admins and committee members can see deposits that are approaching or past maturity without mistaking an alert for a renewed or received deposit.

**Toolkit source:** [Tool 117](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t117>) adds days to maturity and `Active`, `Upcoming`, `Due Soon`, `Matured - Renew` or `Closed` status. Its workbook calculates maturity value as `ROUND(principal × (1 + annual rate/4)^(tenure months/3), 0)` (quarterly compounding), with maturity date derived from start date plus tenure. See the [investment tracker workbook](<../../Cooperative & Housing Society Management Toolkit/Module_10_Sinking_Fund_Reserve_Repair_Fund/1_Individual_Tools/117_Investment_of_Funds_Tracker.xlsx>).

**App today:** The owner already accepted a base FD register in P39.5, including bank, fund, receipt number, principal, rate, tenure, maturity date/value, accrued interest and status. This decision is only for the additional countdown and renewal worklist.

**Change needed:** Add a read-only days-to-maturity/status worklist to P39.5; use actual bank terms for estimates. The toolkit's quarterly-compounding formula is not a substitute for the FD contract. Do not renew, reinvest, notify through a new channel or post money automatically.

**Depends on:** Accepted P39.5 and approved M10 fund mapping; accountant review of maturity/early-withdrawal treatment.

**Risks / verify:** Rates, compounding, tax and renewal decisions vary by deposit. Show estimates and dates clearly; confirm with the bank and accountant.

**Recommendation:** Accept the countdown/worklist, but not automated renewal or money posting.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M10-08 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Track interest earned and tax withheld by fund and source, linked to the actual cash receipt.

**Why it helps:** P16 can remain the record of cash received while a separate view explains gross interest, tax deducted and the resulting net credit for each fund.

**Toolkit source:** [Tool 118](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t118>) records credit date, fund, source, bank/reference, period, average balance, gross interest and TDS. Its workbook calculates `net interest = gross interest − TDS`, `TDS % = TDS / gross interest`, and `annualised yield = gross interest × 12 / (average balance × period months)`. Its guide says use a three-month period for quarterly FD interest and one month for monthly savings interest; these are tracker conventions, not bank accounting terms.

**App today:** P16 supports manual interest income, but not fund/source-level interest or TDS tracking; see [P16 requirements](./PRD.md). The P39.5 fixed-deposit estimate must remain separate from interest actually received.

**Change needed:** Add a fund/source-linked interest detail view for actual credits and tax evidence. Only the confirmed cash amount may be recorded in P16 through its existing income operation; do not auto-post gross interest, estimated accrual or benchmark differences. Do not use a benchmark prompt to recommend moving funds.

**Depends on:** GAP-M10-01 and accepted P39.5; accountant-approved gross/net/TDS treatment and link to the corresponding P16 income entry.

**Risks / verify:** Gross interest, TDS, yield and taxable income are not interchangeable. Formula, time period, tax treatment and benchmark require accountant review; no benchmark or rate from the workbook is a default.

**Recommendation:** Accept a read-only explanation of actual interest credits, gated on accountant review.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M10-09 · NEW · Value M · Effort M · Confidence Medium

**What:** Plan the funding and timing of major repairs over multiple years.

**Why it helps:** A committee can compare expected repair costs with future fund capacity before deciding to raise or allocate money.

**Toolkit source:** [Tool 119](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t119>) records repair item, category, priority, planned year, cost today, funding source and status. Its workbook calculates `inflated cost = ROUND(cost today × (1 + annual escalation rate)^years from base, 0)` and flags timing; see the [repair planner workbook](<../../Cooperative & Housing Society Management Toolkit/Module_10_Sinking_Fund_Reserve_Repair_Fund/1_Individual_Tools/119_Fund_Planning_for_Major_Repairs.xlsx>).

**App today:** No multi-year capital-repair funding forecast was found. The toolkit's later M17 module includes a major repair planner (Tool 193), which has not yet been reviewed; current service requests and vendors do not settle the longer-term planning scope.

**Change needed:** If accepted, plan a forecast of repair item, category, priority, year, estimated cost, funding source and status. Clearly label inflation and shortfall figures as estimates. It must not approve work, create a special levy, promise fund availability or duplicate a future M17 planner.

**Depends on:** M17 major-repair review; GAP-M10-01 and GAP-M10-05 fund balances; engineer/accountant-approved planning assumptions.

**Risks / verify:** The escalation rate and forecast horizon are not authoritative. Any special levy, use restriction or repair approval needs separate member/committee authority and legal review.

**Recommendation:** Defer until M17 is reviewed, then decide whether one shared repair planner should own the feature.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### M10 covered, partial and not-relevant tools

- **Tools 109–111 — partial:** P16 provides the cash/bank book; it has no fund allocations or separate repair/reserve purpose view. See GAP-M10-01.
- **Tool 112 — new:** no corpus charge/receipt register was found; see GAP-M10-03.
- **Tool 113 — partial:** billing has fixed/per-square-foot/custom charge types, and P37.3 plans a general what-if calculator. Fund split, share and tenant surcharge remain; see GAP-M10-02.
- **Tool 114 — conflict:** actual spending and P16 approval must not be duplicated or bypassed; see GAP-M10-04.
- **Tools 115 and 120 — enhancement:** P16 reports account-level income, expense and balances; fund-level closing balance, investment and monthly movement remain; see GAP-M10-05.
- **Tool 116 — new:** no inter-fund transfer workflow; see GAP-M10-06.
- **Tool 117 — partly covered:** the base FD instrument register was accepted in P39.5; countdown/renewal follow-up is the only new M10 decision; see GAP-M10-07.
- **Tool 118 — enhancement:** manual interest income exists in P16, but fund/source/TDS details do not; see GAP-M10-08.
- **Tool 119 — new, cross-module:** no long-term repair funding forecast was found; M17 has related repair planning to compare; see GAP-M10-09.
- **No tools classified wholly Not Relevant:** all M10 tools concern society funds, but some are partly covered, depend on other modules or require money/legal safeguards.

### M10 documentation verification

- Re-read all nine cards and the top summary; each card includes source, current app behavior, change, dependencies, risks and recommendation. All nine decisions are marked Accept, and the direct conflict's Option B is selected.
- Focused content check: **9 cards, 4 NEW, 4 ENHANCEMENT, 1 CONFLICT**. Tools 109–120 are all accounted for as decisions or partial coverage.
- Read the M10 guide summary and detailed Tools 109–120 reference. Opened the original individual Excel workbooks for Tools 109–120 to inspect formulas only; sample workbook values were not read. No PDFs or master workbook were opened.
- All nine M10 decisions are recorded in P40 and the plan's decision register. At M10 close, M12 was next; its comparison and decisions are now complete below. M13 was next after M12, and its comparison follows.
- No application code, schema, migrations or tests were changed. This is documentation-only, so application tests were not run.

## M12 — Financial Statements (Tools 133–144; Editions A and B)

**Review status:** All twelve tools in both editions were compared. All eight merged decision cards are decided and recorded in [P41](./IMPLEMENTATION_PLAN.md#phase-p41--financial-statements-and-reports-m12-review) and the plan's decision register. Every item is accepted for planning; implementation remains gated.

**Counts:** 2 NEW, 2 ENHANCEMENT, 4 CONFLICT. There is no wholly covered or irrelevant tool; several report views are partly covered by P16/P27, but must use those authoritative sources rather than duplicate figures.

**Edition differences:** Edition A is a larger workbook with separate statement, entry, setup and dashboard sheets. Edition B is generally a simpler Instructions/Dashboard/Data layout, often asking for current- and previous-year amounts or monthly grids directly. The fields and calculations are not interchangeable: for example, the expense schedule uses different variance signs between editions, and the annual report/financial dashboard have different degrees of manual input. Treat each tool pair as one capability, not two copies.

### Highest-value M12 decisions

| Rank | ID         | Item                                                                         | Recommendation                                                                                        |
| ---- | ---------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1    | GAP-M12-01 | Cash receipts/payments statement and month-wise income/expense reports       | Accept only as read-only views derived from P16; no second entry ledger                               |
| 2    | GAP-M12-02 | Accrual-basis income and expenditure statement                               | Keep P16 cash-basis reporting unless an accountant-approved, separately scoped accrual view is wanted |
| 3    | GAP-M12-03 | Balance-sheet summary, assets/liabilities and ratios                         | Keep a formal balance sheet out of scope under D-39; revisit only with explicit approval              |
| 4    | GAP-M12-04 | Head-wise schedules, budget comparisons and monthly surplus/deficit tracking | Defer detailed budget comparisons until M13 defines the source and rules                              |
| 5    | GAP-M12-05 | Multi-year income/expense trends, growth and CAGR                            | Accept as a derived report after history and formula boundaries are agreed                            |
| 6    | GAP-M12-06 | Audit-ready statement checklist and tie-out pack                             | Accept a checklist only; M20/statutory requirements and auditor meaning need review                   |
| 7    | GAP-M12-07 | Annual report summary for AGM                                                | Accept a source-linked, non-statutory summary; avoid unsupported compliance claims                    |
| 8    | GAP-M12-08 | Financial dashboard and weighted financial-health score                      | Prefer a limited P16 report extension; preserve P27's approved catalogue and live data                |

**Owner decisions (2026-11-18):** All eight cards are accepted for planning. GAP-M12-01 and GAP-M12-08 use A+B additively: keep existing P16/P27 reports and add only distinct read-only views from approved records. GAP-M12-02 uses A: keep cash-basis reporting, with no accrual conversion. GAP-M12-03 uses B: reconsider only a limited, clearly labelled position summary after authoritative sources and rules are ready; no formal balance sheet or D-39 change is approved. GAP-M12-04–07 are accepted with their M13, history, M20/auditor and source-approval gates. See P41 for the complete plan entries.

### Money, legal and member-rights conflicts and safeguards in M12

- **GAP-M12-01:** Edition A's receipt/payment and month-wise tools accept voucher-level entries; Edition B accepts manual totals or month grids. Homeish already records actual entries in P16. Re-entering or editing those figures in a second workbook-like ledger could disagree with approved payments, reversals or confirmed billing receipts.
- **GAP-M12-02:** The toolkit's Edition A changes the meaning from P16's cash-basis reports using: income = received + closing receivable − opening receivable + opening advance − closing advance; expenditure = paid + closing outstanding − opening outstanding + opening prepaid − closing prepaid. It also treats depreciation as a non-cash provision and excludes major repairs charged to funds, FD placements and capital purchases. These adjustments can change a reported surplus without changing P16 cash.
- **GAP-M12-03:** PRD D-39 explicitly keeps simple bookkeeping and lists a balance sheet as out of scope. Copying assets, liabilities, fund balances or balance-check ratios would change that boundary and could be mistaken for formal accounts; verify any statutory/accounting treatment with an accountant and against the state co-operative act / society bye-laws.
- **GAP-M12-08:** P27 D-62 already defines the live, admin-selected aggregate dashboard. Edition A's manually entered figures, targets and weights (points = score × weight) and Edition B's manually keyed current/prior/budget values can conflict with P16/P27's source-linked figures or create a second financial-health rating.
- **Tools 142–143:** “Audit-ready,” “compliance status” and an annual report are not legal or auditor approvals. Confirm required report contents and wording with the auditor and verify statutory items against the state co-operative act / society bye-laws; do not infer compliance or member obligations from sample fields.
- **Tools 136–137 and 141:** Budget comparisons wait for M13. Tool 141's accumulated/cumulative surplus is not the same as P39.6's planned cash net flow or a formal accrual surplus. Do not mix those measures or copy a toolkit forecast as actual.

### GAP-M12-01 · CONFLICT · Value H · Effort M · Confidence High

**What:** Add a cash receipts/payments statement and month-wise income/expense reports without creating a second transaction ledger.

**Why it helps:** A committee can review annual cash movement and monthly head-level trends from the transactions Homeish already records.

**Toolkit source:** [Tool 133](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t133>) and [Tools 138–139](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t138>) include receipt/payment statements and voucher-based monthly reports in Edition A; Edition B uses categories and current/previous-year values for Tool 133 and hand-entered income/expense-by-month grids for Tools 138–139. The layouts and input methods differ.

**App today:** P16 stores approved cash/bank entries in an append-only book. Its report already shows monthly income/expense totals, expense categories, income sources, closing account balances and outstanding billing dues for up to two years; the page exports entries as CSV and a summary PDF. P27 also has live monthly “Expense vs income” and “Spend by category” metrics. See [P16 requirements](./PRD.md), [P16 operations](../src/core/expense/operations.ts), [expense report page](<../src/app/(admin)/admin/expenses/reports/page.tsx>), [report function](../supabase/migrations/20261115200000_expense_workflows.sql) and [P27 catalogue](../src/core/analytics/catalogue.ts).

**Change needed:** If accepted, derive any additional cash statement or month-by-head view from posted P16 entries. Do not add a manual receipt/payment register or allow typed totals to replace source transactions. Limit classifications to fields the app can support; preserve net reversals and P16's approval/posting behavior. Do not add a P27 metric unless separately approved under D-62.

**Depends on:** P16 entries and reports; P39.1/P39.2 if the view uses running balances or voucher references; P39.5/P40.1 only if an approved fund/FD breakdown is included.

**Risks / verify:** A cash statement is not an accrual statement or balance sheet. Manual re-entry can make approved expenses, reversals and confirmed billing receipts disagree with P16.

**Options:** A) Keep the current P16/P27 reports only B) Add read-only cash statements and monthly head reports derived from P16, with no duplicate entries C) Copy the workbook's manual voucher or month-grid input model → **Recommended: B**, to add useful presentation without creating another source of money data.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Conflict option:** [x] A [x] B [ ] C

### GAP-M12-02 · CONFLICT · Value H · Effort L · Confidence High

**What:** Add an accrual-basis income and expenditure statement, including adjustments for receivables, advances, outstanding expenses and prepayments.

**Why it helps:** An approved accrual view can show earned income and incurred costs even when cash is received or paid in a different period.

**Toolkit source:** [Tool 134](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t134>). Edition A calculates income as `received + closing receivable − opening receivable + opening advance − closing advance` and expenditure as `paid + closing outstanding − opening outstanding + opening prepaid − closing prepaid`; depreciation is treated as a non-cash provision. Edition B is a simpler row-based current/previous-year statement with `Income`, `Expenditure` and `Appropriation` types.

**App today:** P16 reports posted cash/bank entries; it has no accrual-adjustment books for receivables, advances, prepayments or depreciation. D-39 approves simple bookkeeping, not a changed accounting basis. The report's cash totals and P27's income/expense figures are based on posted entries.

**Change needed:** Keep the P16 cash report unchanged. If a distinct accrual view is accepted, first define its period, required source records, opening/closing adjustments, reversals, appropriation and accountant review. Clearly label it as separate from cash movement; do not create or post money entries from a report.

**Depends on:** P16 and P39's approved report boundary; accountant review and an explicit choice of basis before any data model or formula is designed.

**Risks / verify:** Switching a report from cash to accrual changes the apparent surplus/deficit and may alter historical comparisons. The toolkit's rules do not establish local accounting treatment.

**Options:** A) Keep P16's current cash-basis reports B) Consider a separate, non-posting accrual statement after the accountant approves its basis and sources C) Adopt the toolkit's accrual adjustments as the authoritative P16 accounting method → **Recommended: A for now**, because D-39 and the existing reports define simple cash/bank bookkeeping.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Conflict option:** [x] A [ ] B [ ] C

### GAP-M12-03 · CONFLICT · Value H · Effort L · Confidence High

**What:** Add a balance-sheet view of funds, investments, cash, assets and liabilities.

**Why it helps:** Members and committee could see a year-end financial position, rather than only period income, spending and cash/bank balances.

**Toolkit source:** [Tool 135](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t135>) in Edition A compares manually supplied prior/current values and calculates change. Edition B adds asset/liability sides, groups, current/previous values and shares of each side; it also states General Fund = opening General Fund + surplus for the year − appropriations to funds.

**App today:** D-39 and PRD §14.3 explicitly exclude a balance sheet and full accounting. P16 holds cash/bank accounts and entries, not a complete liability/equity register. P28's asset register is for physical common assets and maintenance, not a balance-sheet valuation; P39.5 and P40 are accepted plans, not implemented financial records.

**Change needed:** Do not present a formal balance sheet from incomplete asset/liability sources. If the owner wants a narrower view, define exactly which approved records can be shown, label missing values, keep it read-only, and do not call it a statutory balance sheet or assert a balance check until the accounting basis is approved.

**Depends on:** Explicit D-39 scope decision; accountant/legal review; source records from P16 and any separately approved asset, fund, deposit and liability registers.

**Risks / verify:** A manual figure or incomplete balance check could mislead members about solvency, fund backing or statutory compliance. D-39 currently rules out this feature.

**Options:** A) Keep a formal balance sheet out of scope B) Defer a limited, clearly labelled assets/liabilities summary until authoritative sources and accounting rules exist C) Change D-39 and adopt a formal balance sheet/accounting model after owner, accountant and legal approval → **Recommended: A**, because the approved product boundary excludes it and current records are incomplete.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Conflict option:** [ ] A [x] B [ ] C

### GAP-M12-04 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Add source-linked income/expense schedules by head and budget, plus monthly surplus/deficit tracking.

**Why it helps:** Once an approved budget exists, committee can compare actual results by head and month without maintaining duplicate actual totals.

**Toolkit source:** [Tools 136–137](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t136>) are annual schedules; Edition A has April–March amounts, budget, prior-year comparison and achievement/utilization, while Edition B has budget/current/previous values. For income, Edition B uses actual minus budget (positive is favorable); for expenses it uses budget minus actual (negative is overspend), so the signs differ. [Tool 141](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t141>) adds monthly surplus/deficit and cumulative totals; Edition A forecasts remaining months from the average of the last three entered months, while Edition B compares actual to budget and derives closing General Fund as opening fund + surplus − appropriation.

**App today:** P16 already reports actual income/expense by month and category and computes period net from posted entries; P27 provides approved live money trends. P39.6 plans monthly/cumulative cash net flow, explicitly distinct from cash balance. No Homeish budget-vs-actual schedule was found; M13 Budget has not yet been reviewed.

**Change needed:** If accepted, derive actual amounts from P16 and any budget only from the approved M13 source. Define separate labels/signs for cash net flow, budget variance and any accrual surplus. Do not type actuals a second time, make forecasts look like actuals or add a P27 metric without D-62 review. Reconsider Tool 141's forecast and fund-appropriation portions after M13/P40.

**Depends on:** P16 reports and P39.6; M13 budget review; P40 only for approved fund appropriation; owner/accountant approval of period and variance labels.

**Risks / verify:** M12 and M13 may otherwise create duplicate budgets or opposite expense-variance signs. Edition A's three-month forecast is an estimate, not a financial result.

**Recommendation:** Defer budget-vs-actual details until M13 is reviewed; if accepted now, keep P41 dependent on that review.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M12-05 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Add multi-year, head-wise income and expense comparison with growth and trend indicators.

**Why it helps:** A committee can spot durable changes in income or costs over several financial years, rather than comparing only recent months.

**Toolkit source:** [Tool 140](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t140>). Edition A shows three financial years and a two-year CAGR; Edition B shows five years and a five-year CAGR, plus a trend and expense alerts.

**App today:** P16's report accepts date ranges up to two years. P27 shows monthly trends for 3, 6 or 12 months and an optional current financial year, but not a three-/five-year head-level comparison. P16 book entries are append-only, so a report can be derived from retained source entries rather than manually keyed annual totals.

**Change needed:** If accepted, derive the approved horizon by income/expense head from P16, mark unavailable historical periods as unavailable (not zero), and define how growth works when a prior value is zero or negative. Do not copy alert thresholds or change existing P27 metrics.

**Depends on:** P16 historical entries and stable category/head mapping; P27 D-62 review for any new dashboard metric; accountant review of CAGR and negative/zero-base handling.

**Risks / verify:** The editions use different horizons and the toolkit's sample growth/cost alerts are not authoritative. Historical category changes can make a trend misleading.

**Recommendation:** Accept a read-only multi-year report after its time horizon and missing-history rules are agreed.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M12-06 · NEW · Value H · Effort M · Confidence Medium

**What:** Track audit-pack checklist items, responsible people, due dates and statement-to-book tie-outs.

**Why it helps:** Admins and committee can see which supporting records or reconciliations still need attention before sending material to the auditor.

**Toolkit source:** [Tool 142](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t142>). Edition A is a small check/difference/result worksheet with audit readiness and dates to audit/AGM; Edition B is a detailed item/category/responsible/due-date/status list with statement amount, book amount, difference and tie-out. Neither is evidence that an auditor accepted the pack.

**App today:** P16 has audited month close/reopen actions and expense CSV/PDF exports; no audit-pack checklist or statement tie-out register was found. The subsequent M20 decisions extend planned P41.5 audit tracking; legal-case/auditor verification and implementation remain open.

**Change needed:** If accepted, track checklist status and source-linked reconciliation evidence only. A checklist result must not certify statutory compliance, submit records, change P16 books or claim an audit is passed. Confirm the required items and due-date rules with the auditor.

**Depends on:** M20 audit/compliance review, P16/P39 statement sources and the society's approved AGM/audit calendar.

**Risks / verify:** “Audit-ready” and “overdue” can imply legal status. Verify checklist content against the state co-operative act / society bye-laws and the appointed auditor's requirements.

**Recommendation:** Accept a non-certifying checklist, gated on M20 and auditor review.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M12-07 · NEW · Value H · Effort M · Confidence Medium

**What:** Prepare an annual AGM report summary from approved finance, membership, operations and compliance sources.

**Why it helps:** A committee could assemble a consistent year-at-a-glance without copying figures from unrelated spreadsheets.

**Toolkit source:** [Tool 143](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t143>). Edition A shows registration year, unit/member/committee counts and a dashboard of finance, collection, fund, complaints, meetings, repairs and compliance. Edition B is a manually filled section/metric table with current/previous year, unit, “Better When” (Higher/Lower/Neutral), change, verdict and commentary.

**App today:** P27 provides live aggregates for enabled modules, while no annual AGM report builder was found in the app. Some listed data is in existing modules; M17 repairs remains unreviewed. M20's subsequent planning decisions do not implement compliance sources or establish statutory completeness. The editions do not provide one consistent rule for how each metric is sourced.

**Change needed:** If accepted, create a clearly labelled draft summary that links each figure to an approved source and financial year. Show unavailable values as unavailable; do not use manually typed numbers as verified results, create compliance verdicts, publish member-level data or claim statutory completeness.

**Depends on:** P27's aggregate-only privacy boundary; M06/M17/M20 decisions for meeting, repair and compliance figures; M13/P16/P40 for any budget/fund metrics; owner/auditor approval of the report content.

**Risks / verify:** An AGM report can be treated as an official representation to members or authorities. Verify required wording, metrics and approval/sign-off against the state co-operative act / society bye-laws.

**Recommendation:** Accept a source-linked draft only; keep statutory claims and compliance verdicts out until M20/legal review.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M12-08 · CONFLICT · Value M · Effort M · Confidence High

**What:** Add a financial dashboard, but avoid duplicating P16 reports or P27 metrics and ratings.

**Why it helps:** A focused year-end view could help reviewers find selected financial figures quickly.

**Toolkit source:** [Tool 144](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t144>). Edition A combines manually entered billed/collected/expense data with target and weight inputs; it computes points as `score × weight`. Edition B manually enters category, metric, current/previous year and budget, then calculates changes and status. Both offer figures or judgments already partly represented in P16/P27.

**App today:** P16 has a built report page; P27 D-62 defines one live aggregate dashboard, admin-selected metrics, current-FY money views and admin-only export. It already includes expense-vs-income, collection trend/rate and spend-by-category. See [P27 decisions](./PRD.md) and [metric catalogue](../src/core/analytics/catalogue.ts).

**Change needed:** Do not add manually keyed actuals, targets, weights or a “financial health” score by copying the workbook. If a distinct finance summary is accepted, keep it read-only and source-linked, place it with P16 reports, and omit anything already covered by P27 unless separately approved under D-62.

**Depends on:** P16 reports; D-62/P27 catalogue review; M10/P40 and M13 for fund/budget measures; accountant approval for any ratios or targets.

**Risks / verify:** Different sources or target rules could show contradictory financial results. The toolkit does not define the score formula fully enough to copy its health rating.

**Options:** A) Keep P16/P27 as-is and add no financial scorecard B) Add only distinct, read-only finance-report figures from approved sources, with no duplicate P27 metric or score C) Copy the workbook's manual figures, targets, weights and health score → **Recommended: A for now**, because D-62 already governs shared dashboard metrics and current P16 reports cover core figures.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Conflict option:** [x] A [x] B [ ] C

### M12 covered, partial and not-relevant tools

- **Tool 133 — partial/conflict:** P16 already holds cash/bank entries and period totals; Edition A/B's separate manual ledger or totals would duplicate them. See GAP-M12-01.
- **Tool 134 — conflict:** accrual adjustments are not part of P16's cash-basis reports; see GAP-M12-02.
- **Tool 135 — conflict:** a formal balance sheet is explicitly out of scope under D-39; see GAP-M12-03.
- **Tools 136–137 — partial:** P16 provides actuals by month/category; budget, prior-year head schedules and variance rules remain. See GAP-M12-04.
- **Tools 138–139 — partial/conflict:** P16 provides monthly totals/category/source views; no separate manual report-entry grid should be created. See GAP-M12-01.
- **Tool 140 — enhancement:** P16/P27 cover recent period trends, not the toolkit's longer head-level comparison. See GAP-M12-05.
- **Tool 141 — partial:** P16 reports cash net by period and P39.6 plans cumulative net flow; budget comparison/forecast/fund appropriation require M13/P40 decisions. See GAP-M12-04.
- **Tool 142 — new:** no audit-pack checklist or tie-out register was found; see GAP-M12-06.
- **Tool 143 — new:** P27 has live metrics, but no annual AGM report builder was found; see GAP-M12-07.
- **Tool 144 — partial/conflict:** P16/P27 cover core financial figures; the workbook's manual scorecard risks duplicate or inconsistent metrics. See GAP-M12-08.
- **No tools classified wholly Not Relevant:** all M12 tools concern financial reporting, but some overlap existing P16/P27 views or await the source/accounting/auditor/legal gates retained after the M13/M20 decisions.

### M12 documentation verification

- Read the M12 guide summary and detailed reference entries for Tools 133–144, including both editions. No individual workbook, master workbook or PDF guide was opened; the reference document covered the fields and edition differences used here.
- Searched PRD, DATABASE, API, ARCHITECTURE, source and tests for existing cash/expense reporting, analytics, balance sheets, accrual statements, multi-year reports, audit packs and annual reports. P16's cash reports and P27's live aggregate metrics are built and tested; no M12-style formal balance sheet, audit pack or AGM report builder was found.
- Focused content check: **8 cards, 2 NEW, 2 ENHANCEMENT, 4 CONFLICT**. Tools 133–144 are all accounted for; all eight decisions are marked Accept and all four conflict choices are recorded, including the additive A+B choices.
- All eight M12 decisions are recorded in P41 and the plan's decision register. At M12 close, M13 budget was next and 14 modules remained; the M13 comparison follows below.
- The plan sections, decision rows, task anchors and report summary were re-read after saving. P41 remains planning-only; GAP-M12-03 is conditional and does not amend D-39.
- No application code, schema, migrations or tests were changed. This is documentation-only, so application tests were not run.

## M13 — Budget & Expense Control (Tools 145–156)

**Review status:** All twelve tools were compared against Homeish's current scope and P16/P24/P27 behavior. All eight merged decisions are recorded in the implementation plan: originally five accepted for planning and three conflicts rejected with Option A/current behavior confirmed. On 2026-11-22 the owner changed GAP-M13-01 to Option B (D-83, proposed), so six are now accepted and two rejected. Budget management remains out of MVP; the limited plan (P42.5) is the source for P41.3 and P42.2.

**Counts:** 2 NEW, 3 ENHANCEMENT, 3 CONFLICT. Tools 147 and 153's budget-comparison work is accepted in P41.3 but not built; its budget source is the P42.5 plan proposed under D-83. Tool 154's underlying monthly category totals/trends are partly covered by built P16/P27 reports. Tool 150's sanction register overlaps the planned P40.4 record; the decision below is only about additional source-linked fields, not another register.

**Module links:** The toolkit connects M13 to M11 accounts and uses vendor/staff expense context from M14/M15. In Homeish, P16 is the actual cash/bank source, P24 already handles purchase requests and quote approvals, and P27 is the shared aggregate dashboard. M15 payroll and other toolkit modules remain outside this comparison.

### Highest-value M13 decisions

| Rank | ID         | Item                                                                                    | Recommendation                                                                                    |
| ---- | ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | GAP-M13-01 | Annual budgets, phasing and approved revisions versus the current out-of-scope boundary | Keep budgeting out of scope unless the owner explicitly changes the approved product scope        |
| 2    | GAP-M13-04 | Expense approval authority versus P16 and P24's approved decision rules                 | Preserve P16 posting and P24 purchase approval; do not adopt toolkit authority limits as defaults |
| 3    | GAP-M13-08 | Budget dashboard versus P27's live, admin-selected catalogue                            | Keep P27 authoritative; no duplicate manually keyed dashboard                                     |
| 4    | GAP-M13-03 | Overspend alerts and projected year-end spending                                        | Add only after an approved budget source and owner-approved alert rules exist                     |
| 5    | GAP-M13-05 | Sanction details and utilization tracking                                               | Extend P40.4 only; derive utilization from linked P16 entries                                     |
| 6    | GAP-M13-06 | Vendor-wise actual expense reporting                                                    | Derive actual spending from P16; distinguish it from P24 approved-quote values                    |
| 7    | GAP-M13-02 | Expense-category groups, cost nature and ownership                                      | Add only metadata that does not change existing category IDs or historical entries                |
| 8    | GAP-M13-07 | Cost-saving initiative tracker                                                          | Keep expected and realized savings as separately labelled estimates/records, not cash entries     |

### Money, legal and member-rights conflicts and safeguards in M13

- **GAP-M13-01:** The PRD's out-of-MVP list excludes budget management, and D-39 keeps P16 to simple bookkeeping. Adopting an annual budget, forecast, revision history or budget-versus-actual system changes the approved scope; update the owning PRD and confirm authority before implementation.
- **GAP-M13-04:** P16 D-44 requires approval above a society-configured threshold by a committee member other than the recorder; P24 D-54 separately governs quote requirements and purchase approvers. The toolkit's delegated authority and committee/general-body sanction rules must not replace either flow without explicit owner approval and verification against the state co-operative act / society bye-laws.
- **GAP-M13-05:** Tool 150's manual “Utilised So Far” field would disagree with accepted P40.4, which plans to derive utilization from linked P16 expenses. A sanction is not approval or a posted expense.
- **GAP-M13-08:** P27 D-62 already governs shared dashboard metrics, access, live calculations and exports. Copying workbook totals or adding a second budget scorecard can produce inconsistent money figures.
- **Tools 148, 151 and 152:** projected overruns, vendor dependency and expected/realized savings are not confirmed cash movements. Do not treat forecasts or typed savings as income, approved budget changes or P16 postings.
- Toolkit growth, inflation, authority and alert examples are not local policy. Verify any financial authority, member/committee approval and statutory treatment against the state co-operative act / society bye-laws; do not use sample amounts or thresholds as defaults.

### GAP-M13-01 · CONFLICT · Value H · Effort L · Confidence High

**What:** Add an annual budget builder, monthly/quarterly phasing and an approved budget-revision history.

**Why it helps:** A committee could plan expected spending by category and track authorized changes during the year.

**Toolkit source:** [Tool 145](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t145>) proposes `Last Year × (1 + Growth)`, lets an override replace the proposal, then phases the final budget as Equal Monthly, Quarterly, Half-Yearly or Annual (First Month). [Tool 155](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t155>) records increases/decreases, reason, funding source, approving authority, resolution and status; only `Approved` revisions change the budget, and a reallocation is recorded as one decrease plus one increase.

**App today:** No budget builder or revision workflow was found. PRD §3.3 lists budget management out of MVP, while D-39 limits P16 to simple cash/bank bookkeeping. P16 records actual expenses and reports by month/category. M12's accepted [P41.3](./IMPLEMENTATION_PLAN.md#p41-3) plans budget comparisons only after M13 defines an approved source; it is not implemented and does not create that source.

**Change needed:** Any budget capability requires an explicit scope decision and an approved PRD change before implementation. Keep budgets separate from actual P16 entries, use no sample inflation rate as a default, define who approves initial budgets/revisions and how the approved version is identified, and audit every change. Do not automatically create, alter or defer an expense.

**Depends on:** P16 categories and actuals; M12/P41.3 report definitions; an explicit PRD budget-scope change (and a D-39 change only if P16's responsibility would change); accountant and legal/bye-law review of budget authority.

**Risks / verify:** Budgets and actuals are different measures. An estimate, draft or unapproved revision must not look like committee-approved spending authority or change P16 approval/posting behavior.

**Options:** A) Keep budgeting out of scope under the current PRD and leave D-39/P16 bookkeeping unchanged B) Add a limited, separate budget plan and revisions after an explicit PRD scope change; keep all actuals in P16 C) Adopt the wider toolkit lifecycle, including growth proposals, phasing, revisions and delegated authority, after explicit product, accounting and legal approval → **Recommended: A for now**, because the PRD currently excludes budget management.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Conflict option:** [ ] A [x] B [ ] C

**Owner reason:** Changed from A to B on 2026-11-22 (D-83, proposed). Add a limited yearly budget plan with recorded changes, separate from the books, as P42.5; actual figures come only from posted P16 entries. Budgets stay out of MVP, and D-39 and P16 bookkeeping are unchanged. The original 2026-11-18 choice was A.

### GAP-M13-02 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Add useful metadata to the existing expense categories without replacing their current identifiers or names.

**Why it helps:** Admins and committee could group costs and see who owns a budget area, if budgets are later approved.

**Toolkit source:** [Tool 146](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t146>) adds category group, cost nature (`Fixed`, `Variable`, `Periodic`), budget owner, description, active/inactive status, annual budget, YTD actual, used percentage and alert level.

**App today:** P16 already has society-defined expense categories with a name and active/inactive status; its reports group posted entries by category. The approved defaults include repairs, utilities, staff, housekeeping, security, AMC, insurance/taxes, administration, events and other. See [P16 requirements](./PRD.md), [expense operations](../src/core/expense/operations.ts), [expense category validation](../src/core/expense/validation.ts), [category database rules](../supabase/migrations/20261115200000_expense_workflows.sql) and [expense database tests](../tests/integration/database-expense.test.ts).

**Change needed:** If accepted, consider only category group, cost nature, optional owner and short description. Keep current category IDs/names and history stable; budget amounts, YTD actuals and alerts belong to separately approved budget work and must not be stored as manually maintained duplicate totals.

**Depends on:** P16 category management; GAP-M13-01 if any budget fields are included; agreed visibility for category owner metadata.

**Risks / verify:** Renaming, merging or deactivating a category can affect reports and old entries. Preserve the existing audited category edit and history behavior.

**Recommendation:** Accept the small descriptive metadata extension only if it helps reporting; keep all budget values out until GAP-M13-01 is decided.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M13-03 · NEW · Value H · Effort M · Confidence High

**What:** Add overspend alerts and clearly labelled year-end spending projections.

**Why it helps:** Admins and committee could spot a likely overrun before the budget year ends.

**Toolkit source:** [Tool 148](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t148>) takes annual budget, phased year-to-date budget and YTD actual; it calculates annual used percentage, burn rate (`actual ÷ plan`), projected year-end, projected overrun, budget left, alert level and recommended action.

**App today:** P16 reports actual posted income/expenses, but no annual budget, phased budget, forecast or overspend alert was found. P27 shows live expense/income and spend-by-category metrics; it does not forecast a budget overrun. Searches covered PRD, plan, database/API docs, source and tests.

**Change needed:** If accepted, derive actual spending only from posted P16 entries and compare it with an approved budget and phasing rule. Label projected values as estimates, define alert thresholds and missing-data behavior with the owner, and do not notify or approve spending automatically.

**Depends on:** GAP-M13-01; P16 actuals; M12/P41.3 variance definitions; P27/D-62 review for any dashboard metric.

**Risks / verify:** Tool 148's reference does not establish a local alert threshold or complete projection rule. An estimate must not be treated as an approved budget, overspend determination or actual expense.

**Recommendation:** Accept only after budget scope and its alert/projection rules are approved; otherwise defer with GAP-M13-01.

**Decision:** [x] Accept [ ] Reject [ ] Defer

**Owner qualification:** Accepted for planning. On 2026-11-22 the source, scope and rules were set by D-83 (proposed): on-screen warnings (Watch at 90% by default) and estimated projections from the approved P42.5 budget, with no notifications or blocking.

### GAP-M13-04 · CONFLICT · Value H · Effort M · Confidence High

**What:** Add an expense-request and delegated approval tracker with authority and sanction checks.

**Why it helps:** A committee could track who requested a spend, who decided it and whether the required sanction reference exists.

**Toolkit source:** [Tool 149](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t149>) records date, category, vendor/payee, description, amount and requester, then approval authority, status (`Pending`, `Approved`, `Rejected`, `Paid`), approver, decision date and sanction reference. The reference says spend counts in Budget vs Actual only when Approved or Paid; required authority follows Setup limits, and amounts above the Chairman + Treasurer limit require a committee/general-body sanction reference.

**App today:** P16 already applies D-44: an expense above the society-configured threshold (default ₹50,000) waits for approval by a committee member other than its recorder; at or below it, it posts immediately. P24 has a separate quote/purchase-approval workflow under D-54 and creates a P16 expense draft after a purchase is approved; the draft still follows P16's approval rule. These workflows are built and tested. See [P16 expense operations](../src/core/expense/operations.ts), [P16 database tests](../tests/integration/database-expense.test.ts), [P24 requirements and decisions](./PRD.md), [P24 operations](../src/core/vendor/operations.ts) and [P24 database tests](../tests/integration/database-vendor.test.ts).

**Change needed:** Preserve the distinction between purchase approval and approval/posting of an actual expense. If accepted, add only a source-linked record/reference view that does not approve, post or change P16 expenses, bypass P24 separation of duties, or replace D-44/D-54. Do not copy toolkit authority thresholds.

**Depends on:** D-44/P16 and D-54/P24; P40.4 sanction tracking if a work resolution is involved; owner and legal/bye-law approval for any change to authority.

**Risks / verify:** Combining purchase and expense approvals could double-approve spending or let an approval bypass P16. The toolkit's office titles and authority limits are examples, not proof of this society's legal powers.

**Options:** A) Keep P16 and P24 approval rules unchanged; add no second tracker B) Add only source-linked sanction/reference information while keeping the two existing approval steps and P16 posting authoritative C) Replace the current rules with the toolkit's delegated authority model after explicit D-44/D-54 and legal/bye-law approval → **Recommended: A**, because the current rules are explicitly approved and tested.

**Decision:** [ ] Accept [x] Reject [ ] Defer

**Conflict option:** [x] A [ ] B [ ] C

**Owner reason:** Keep the existing P16 expense and P24 purchase approval rules; do not add a second tracker.

### GAP-M13-05 · ENHANCEMENT · Value M · Effort S · Confidence High

**What:** Extend the planned P40.4 work-sanction record with meeting and validity details.

**Why it helps:** A sanction could be traced to its meeting/resolution and show whether its authorization is still current.

**Toolkit source:** [Tool 150](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t150>) records meeting date/type, resolution number, purpose, category, sanctioned amount, validity, authority, status and proposer. It also asks for “Utilised So Far” and calculates balance and percent utilized.

**App today:** No separate M13 sanction register exists. Accepted M10 decision GAP-M10-04 already plans [P40.4](./IMPLEMENTATION_PLAN.md#p40-4): a work/category, fund, sanction amount, resolution and authority, with utilization derived only from linked P16 expenses. P40.4 is planned, not implemented.

**Change needed:** If accepted, add meeting date/type, resolution reference, validity and lifecycle status to P40.4, reusing an approved M06 meeting/resolution source where available. Continue deriving utilization and balance from linked P16 expenses; do not add a manually typed utilized amount or a second sanction ledger.

**Depends on:** P40.4; P16 expense links; M06 meeting/resolution rules; approval and access policy.

**Risks / verify:** A sanction record is not an expense approval or payment. Confirm who may create/change sanctions and which meeting/resolution types carry authority.

**Recommendation:** Accept as a narrow extension to P40.4, gated on M06 and authority rules; do not recreate Tool 150's manual utilization.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M13-06 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** Add a vendor-wise view of actual expense spending.

**Why it helps:** Admins and committee could compare where money was actually paid, rather than only which quote was approved.

**Toolkit source:** [Tool 151](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t151>) groups vendor/payee and category by financial-year month, then calculates total, share of spending, active months, average per active month and a vendor-dependency flag. Its monthly amounts are typed into the workbook.

**App today:** P16 stores a payee on posted expense entries and reports totals by period/category. P24 stores selected vendors and approved quotes. P27's `vendor.approved_spend` is the approved selected-quote amount, not confirmed P16 expense payments; its existing tests verify that distinction. See [P16 report page](<../src/app/(admin)/admin/expenses/reports/page.tsx>), [P24 operations](../src/core/vendor/operations.ts), [P27 catalogue](../src/core/analytics/catalogue.ts), [vendor spend metric](../supabase/migrations/20261120120000_core_analytics_community_metrics.sql) and [analytics tests](../tests/integration/database-analytics-community.test.ts).

**Change needed:** If accepted, derive actual spend from posted P16 entries and link to P24 vendors only when a reliable source link exists. Mark unmatched payees honestly; do not create manually keyed monthly totals or call an approved quote a payment. Review any new P27 metric under D-62.

**Depends on:** P16 posted entries; P24 vendor links; P27/D-62 catalogue and privacy rules.

**Risks / verify:** Free-text P16 payees may not match P24 vendor records consistently. A dependency flag is a reporting signal, not proof of misconduct or a legal finding.

**Recommendation:** Accept a read-only actual-spend report after reliable vendor matching is defined; preserve the existing approved-quote metric's meaning.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M13-07 · NEW · Value M · Effort M · Confidence Medium

**What:** Track cost-saving initiatives from idea through expected and realized savings.

**Why it helps:** The committee could follow up on energy, contract or process improvements and record whether expected savings were achieved.

**Toolkit source:** [Tool 152](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t152>) includes initiative, saving type, owner, baseline annual cost, expected saving, status (`Idea`, `Approved`, `Implementing`, `Realised`, `Dropped`), realized-to-date, saving and realization percentages, pending saving and priority.

**App today:** No cost-saving initiative or realized-savings tracker was found in PRD, plan, source or tests. P16 records actual cash/bank expenses, not savings estimates.

**Change needed:** If accepted, keep baseline and expected savings visibly estimated; define evidence and approval for realized savings. Do not create income, reduce a P16 expense, change an approved budget or claim a saving in the accounts from a typed tracker value.

**Depends on:** Owner-approved definitions and access; GAP-M13-01 if a baseline budget is used; P16 only for separately confirmed actual entries.

**Risks / verify:** An estimated saving can be mistaken for cash returned or a reduction in actual spending. The tracker must not change vendor contracts or authorize a purchase.

**Recommendation:** Accept only as an internal follow-up tracker with expected and verified realized amounts kept distinct.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M13-08 · CONFLICT · Value H · Effort M · Confidence High

**What:** Add a budget dashboard without creating a competing financial dashboard or manual totals.

**Why it helps:** If budget management is approved, admins could see budget, actual, variance, approvals and warnings together.

**Toolkit source:** [Tool 156](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t156>) shows annual and year-to-date budget/actual/variance, projected year-end, pending approvals, active sanctions, revisions, savings, alerts, surplus/deficit and “on track.” It combines several other M13 tools.

**App today:** P27 D-62 already provides a live, admin-selected catalogue and includes expense-vs-income, spend-by-category and approved vendor spend. P16 has period reports and exports. No M13 budget dashboard exists, and the toolkit's inputs would require the budget scope and source decisions above.

**Change needed:** If accepted, add only source-linked budget figures after the budget source is approved; preserve P27's catalogue, permissions and live calculation, and avoid duplicated metrics. Do not use manual totals or the toolkit's overall status as an approved financial-health rating.

**Depends on:** GAP-M13-01 and the accepted/approved M13 report sources; P16; P27/D-62.

**Risks / verify:** Dashboard totals could disagree with P16, P24 or P27 if they use different sources or periods. A manually entered “on track” label can imply financial approval.

**Options:** A) Keep P27 and P16 as-is; add no separate budget dashboard B) After budget scope is approved, add only distinct, live figures through the existing report/catalogue rules C) Copy the workbook's combined manual dashboard and status judgments → **Recommended: A for now**, because budgeting is currently out of scope and D-62 already governs shared metrics.

**Decision:** [ ] Accept [x] Reject [ ] Defer

**Conflict option:** [x] A [ ] B [ ] C

**Owner reason:** Keep P16/P27 authoritative; do not add a duplicate budget dashboard.

### M13 covered, partial and not-relevant tools

- **Tools 145 and 155 — conflict:** annual budget proposal/phasing and approved revisions; see GAP-M13-01.
- **Tool 146 — enhancement:** P16 already has society-defined active/inactive categories; budget ownership/group/cost metadata is missing; see GAP-M13-02.
- **Tools 147 and 153 — partly planned:** monthly and quarterly budget-versus-actual work is accepted in P41.3, using the P42.5 budget proposed under D-83; do not create a duplicate comparison feature.
- **Tool 148 — new:** no overrun forecast or budget alert exists; see GAP-M13-03.
- **Tool 149 — conflict:** overlaps P16 expense approval and P24 purchase approval; see GAP-M13-04.
- **Tool 150 — partly planned:** P40.4 already plans a source-linked sanction register; only the additional resolution/validity metadata is considered here; see GAP-M13-05.
- **Tool 151 — enhancement:** P16 records actual payees and P24 vendors; no source-linked actual spend-by-vendor report was found; see GAP-M13-06.
- **Tool 152 — new:** no cost-saving initiative tracker was found; see GAP-M13-07.
- **Tool 154 — partly covered:** P16 reports monthly/category actuals and P27 shows monthly trends; the workbook's manual entry chart should not become a second actuals source.
- **Tool 156 — conflict:** its combined budget dashboard depends on new budget data and overlaps P27; see GAP-M13-08.
- **No tools classified wholly Not Relevant:** all M13 tools concern expense control, but some are already planned, partly covered, depend on an out-of-scope budget capability or require money/authority safeguards.

### M13 documentation verification

- Read the M13 guide summary and detailed reference entries for Tools 145–156. The reference included the budget formula, phasing choices, revision rule, approval statuses and each tool's fields. No individual workbook, combined workbook or PDF guide was opened.
- Searched PRD, DATABASE, API, plan, source and tests for budgets, budget-versus-actual, overspend alerts, category metadata, approval flows, sanctions, vendor spend and savings. P16 cash expense handling, P24 purchase approvals and P27 live metrics are built and tested; no M13 budget builder, budget revision, overspend or savings tracker was found.
- Focused content check: **8 cards, 2 NEW, 3 ENHANCEMENT, 3 CONFLICT**. Tools 145–156 are all accounted for; six decisions are accepted (GAP-M13-01 changed to B on 2026-11-22), two conflicts are rejected with Option A/current behavior confirmed, and GAP-M13-03's rules are set by the proposed D-83.
- M13 decisions are recorded in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#toolkit-review-decisions): P42.1–P42.5 and P40.4 hold the accepted work; P41.3, P42.2 and P42.5 are proposed under D-83. M01 decisions are also recorded there in P43. The remaining review order (12 modules) is M04 registration/bye-laws → M06 meetings → M07 elections → M14 vendors/AMC → M15 staff/payroll → M16 helpdesk → M17 repairs/redevelopment → M18 transfer/NOC → M19 tenants/parking/facilities → M20 audit/compliance (both versions) → M23 communication → M24 insurance/legal.
- No application code, schema, migrations or tests were changed. This is documentation-only, so application tests were not run.

## M01 — Society Command Center Dashboard (Tools 1–12)

**Review status:** All twelve tools were compared. Five merged decision cards: **1 NEW, 2 ENHANCEMENT, 2 CONFLICT**. On 2026-11-18, the owner accepted all five for planning, including Option B for GAP-M01-02 and GAP-M01-03. Their P43 plan entries are now recorded; implementation remains gated. M13-01 still keeps budgets out of MVP; M01 does not reopen that decision.

### M01 decision shortlist

| Rank | ID         | Item                                                                                | Recommendation                                                                                  | Owner decision           |
| ---- | ---------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ |
| 1    | GAP-M01-04 | Statutory filing/licence/renewal schedule and compliance status                     | Defer implementation until M20 verifies obligations; do not claim compliance from a manual list | Accept; gated by M04/M20 |
| 2    | GAP-M01-01 | A source-linked Homeish admin command-center landing page                           | Accept a compact home page; leave P27 analytics, source data and permissions authoritative      | Accept                   |
| 3    | GAP-M01-02 | Monthly `Collected ÷ Billed` trend versus current billing percentages               | Add a separate report only; keep existing measures and define calculation rules                 | Accept B                 |
| 4    | GAP-M01-03 | Member names/contact details and suggested actions in financial dashboard/reporting | Keep P27 aggregate-only; limit any added details to a separately approved admin-only view       | Accept B                 |
| 5    | GAP-M01-05 | Committee activity totals by role/person beyond existing meeting action items       | Derive from approved sources; do not create a duplicate activity log                            | Accept; gated by M06     |

### Built, tested and planned evidence

| Capability                           | Evidence and status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P27 analytics                        | Built: the admin analytics page, metric catalogue, live operations and settings are in [analytics](../src/core/analytics/operations.ts), [catalogue](../src/core/analytics/catalogue.ts), [dashboard](../src/components/analytics/dashboard.tsx), and [settings](../src/components/analytics/settings.tsx). P27/D-62 requires admin-selected aggregates, links to source screens, live calculations and admin-only export. Relevant analytics database and browser tests exist; they were not run for this documentation review. |
| Billing dashboard and exports        | Built: BIL-11/BIL-12 and the [billing page](<../src/app/(admin)/admin/billing/page.tsx>) show unit-based top defaulters and export dues, collections and defaulters; the [billing migration](../supabase/migrations/20261110203000_billing_reminders_reports.sql) defines those fields. [Billing report tests](../tests/integration/database-billing-fines-reports.test.ts) exist; they were not run here.                                                                                                                       |
| Meetings and action items            | Built: the [meeting list](<../src/app/(admin)/admin/meetings/page.tsx>), [meeting operations](../src/core/meeting/operations.ts), and P27 `meeting.actions` support scheduled meetings and assigned open/done actions. The current [My action items page](<../src/app/(admin)/admin/meetings/actions/page.tsx>) is personal, not a committee-wide activity scorecard. Meeting/database tests exist; they were not run here.                                                                                                      |
| Requests/complaints                  | Built: [request administration](<../src/app/(admin)/admin/requests/page.tsx>) already shows open, overdue, resolved and closed counts, category performance and a triage list; P27 also has request SLA/category metrics.                                                                                                                                                                                                                                                                                                        |
| Admin home page                      | No `/admin` page route was found (`src/app/(admin)/admin/page.tsx` is absent). P27 lives at `/admin/analytics`, and operational summaries remain in their module pages.                                                                                                                                                                                                                                                                                                                                                          |
| Compliance tracker                   | Nothing matching compliance/statutory filing/renewal tracking was found in `src/app`, `src/core` or `tests`. Subsequent M20 decisions extend planned P41.5 audit tracking and P43.4/P44.5 compliance/filing evidence; none is implemented or an authoritative legal calendar without the remaining source and legal verification.                                                                                                                                                                                                |
| Committee activity log               | P23 tracks meeting action items and P27 counts them in aggregate. No separate committee activity register or per-person completion summary was found. P35.5–P35.6 plan a separate committee action plan, not a duplicate log of notices, inspections and meeting records.                                                                                                                                                                                                                                                        |
| Existing cross-module plan decisions | [P38.4](./IMPLEMENTATION_PLAN.md#p38-4) is a planned read-only as-of collection report; [P40.8](./IMPLEMENTATION_PLAN.md#p40-8) is the planned fund-balance/movement report; [P41.5](./IMPLEMENTATION_PLAN.md#p41-5) is a non-certifying audit checklist. They are not implemented by these M01 comparisons. M13-01 rejects budgets for MVP.                                                                                                                                                                                     |

### M01 conflicts touching money, privacy or legal obligations

- **GAP-M01-02:** The toolkit's monthly ratio and thresholds differ from BIL-11 and P27's separately named measures. Replacing an existing percentage would change financial meaning. The already accepted P38.4 is due-date/as-of based; it does not silently authorize a new monthly ratio.
- **GAP-M01-03:** Tools 1, 10 and 12 use member names and/or phone/contact details alongside unit-level dues, payment history and suggested recovery actions. Current billing reports use unit-level fields, while P27/D-62 shows aggregates only and does not expose people or unit lists. Any expanded member-level view needs an explicit purpose, role boundary and access/retention review.
- **GAP-M01-04:** A compliance panel can imply that the society is legally up to date. The toolkit's frequencies and sample obligations are not authoritative. **Verify statutory obligations against the state co-operative act / our bye-laws**, with M20 and the appropriate adviser, before scheduling or making a compliance claim.
- **Previously settled M01 overlap:** Tool 4's `Outstanding ÷ Monthly Charge` is an approximation, not the age of an individual bill; Homeish uses each bill's due date for ageing. M09-02 confirms the current defaulter rule, and M09-06/P38.4 preserves existing measures while adding a separate as-of report. M01 does not reopen those decisions. Tool 6's budget chart is also excluded by M13-01.

### GAP-M01-01 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Add a source-linked admin command-center landing page that summarizes existing, permitted information and points users to the right module.

**Why it helps:** An admin currently reaches analytics, meetings, requests and billing through separate workspaces; a simple starting page could surface the most useful current signals without maintaining another set of totals.

**Toolkit source:** [Tools 1, 2, 7 and 8](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t1>). Tool 1 combines unit, collection, dues, funds, expenses, budgets, complaints, compliance and next-meeting cards; Tool 7 lists upcoming meetings/deadlines; Tool 8 lists pending complaints.

**App today:** No `/admin` landing page was found. P27 already has a configurable live catalogue with unit occupancy, billing, expense, service-request and meeting metrics; meeting and request details live in their own workspaces. P27's six default-on metrics remain conditional on their source module being enabled; other metrics are admin-selected.

**Change needed:** If accepted, make `/admin` a navigation/summary page that reuses approved P27 values and existing module operations, then links to their owning screens. It may show the next scheduled meeting and link to it using P23's access rules. Do not copy data into a second dashboard store or calculate a second version of a metric. Leave statutory deadlines for GAP-M01-04; show no budget figure under M13-01; include fund figures only when their approved P40.8 source is available. Omit disabled/unavailable sections rather than presenting them as zero. Keep P27 at `/admin/analytics` as the configurable analytics page.

**Acceptance:** Each shown value has an authoritative source and a link to its owning screen; permissions match that source; off modules and unavailable measures are omitted or labelled unavailable; no new personal/unit-level financial list, budget or compliance claim is introduced.

**Depends on:** P27/D-62, P23 meetings and existing request/billing pages; P40.8 only if fund figures are later included.

**Risks / verify:** Do not widen who can see a meeting, action item or financial value. A summary must distinguish unavailable from zero and must not silently replace P27's admin-selected catalogue.

**Recommendation:** Accept the compact, source-linked home page only; retain P27's metric definitions and settings.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M01-02 · CONFLICT · Value H · Effort M · Confidence High

**What:** Decide whether to add the toolkit's monthly collection-efficiency trend, while preserving Homeish's bill-based ageing.

**Why it helps:** A month-by-month ratio can make the billed/collected relationship easier to scan, provided its month and waiver treatment are clear.

**Toolkit source:** [Tool 3](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t3>) defines `Efficiency = Collected ÷ Billed` and shows the previous 12 months. Its `Excellent ≥ 95%, Good ≥ 90%, Watch ≥ 80%, Low below 80%` labels are examples, not society policy. [Tool 4](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t4>) also derives `Months Overdue = Outstanding ÷ Monthly Charge`.

**App today:** P27 `billing.collection_trend` shows bills by bill month and confirmed payments by payment date; `billing.collection_rate` is the share of bills paid in full. BIL-11 reports a selected-period percentage using its existing billing definition. P27 already has three billing metrics. P38.4 is separately planned as an as-of, due-date-based report, not this monthly trend.

**Toolkit difference:** These ratios are not interchangeable. The monthly `Collected ÷ Billed` ratio can differ from BIL-11's selected-period percentage and P27's full-settlement rate; Tool 4's balance/monthly-charge estimate also differs from bill-by-bill due-date ageing.

**Change needed:** If accepted, add only a separately labelled read-only monthly report. Show its numerator, denominator and period basis; first decide how to treat paid dates, partial payments and waivers. Do not replace BIL-11/P27 measures, add a fourth billing metric, or copy the example status thresholds. Keep Homeish's bill-age buckets and M09-02 defaulter rule unchanged; do not substitute Tool 4's `Outstanding ÷ Monthly Charge` estimate for bill due dates.

**Depends on:** P16 billing source records; P27/D-62; P38.4's accepted calculation and partial-payment/waiver gates.

**Risks / verify:** A ratio without a stable month basis or waiver rule can misstate collection performance. Do not treat the toolkit thresholds as an approved warning, target or recovery rule.

**Options:** A) Keep BIL-11/P27 and bill-age buckets as-is; implement only the already accepted P38.4 as-of report → **Recommended for now**: avoids a duplicate ratio before P38.4's calculation gates are settled. B) Add a separate, read-only 12-month `Collected ÷ Billed` report after defining its period, partial-payment and waiver treatment; keep existing measures and bill-age buckets unchanged. C) Another precise scope, stated by the owner.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner-selected option:** B — add a separate read-only 12-month `Collected ÷ Billed` report after defining its period, partial-payment and waiver treatment; preserve BIL-11/P27 and bill-age buckets.

### GAP-M01-03 · CONFLICT · Value H · Effort M · Confidence High

**What:** Decide whether to add member names, contact details and suggested recovery actions to Homeish's existing unit-based defaulter/reporting views.

**Why it helps:** A permitted, purpose-specific admin workflow could make it easier for an authorized person to follow up with a household without maintaining a separate spreadsheet.

**Toolkit source:** [Tools 1, 10 and 12](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t1>). Tool 10 adds member, phone, occupancy, monthly charge, outstanding, months overdue, last payment and suggested action; Tool 12 lists unit/member, outstanding, months, last payment and status. Tool 1's underlying member sheet also stores phone/email.

**App today:** The billing dashboard already ranks units by overdue amount and shows unit number, overdue-bill count, oldest due date and outstanding amount. BIL-12 exports dues-by-unit and defaulters with unit, amount, oldest due date and days overdue. Neither report adds a member phone or name. P27/D-62 is stricter: the admin/committee dashboard shows totals and buckets, not names or unit lists; only admins export it.

**Toolkit difference:** The workbook's member fields and “Suggested Action” would add personal/contact information to a financial follow-up view. Its monthly-charge estimate is not an authoritative bill-age calculation; its action labels are not a Homeish-approved recovery policy.

**Change needed:** Keep financial balances tied to the unit ledger and display only the fields the current report is authorized to show. If an admin-only detail view is later approved, define its purpose, exact fields, role access, audit and retention first; link to existing authorized records rather than copying phone/email into P27. Do not generate or send recovery actions from an example label.

**Depends on:** BIL-11/BIL-12 and P27/D-62; the already-recorded M09-02 and M09-06 decisions remain in force.

**Risks / verify:** More personal and financial detail in a committee-facing list can expose residents or create misleading recovery pressure. No member-level export or contact field should be added without an explicit privacy and access decision.

**Options:** A) Keep current unit-based billing reports and aggregate-only P27; do not add member names, phone/email or automatic suggested actions → **Recommended**: preserves the approved visibility boundary. B) Consider a separate, purpose-limited admin-only detail view after approving exact fields, access, audit and retention; do not change P27 or committee access. C) Another precise scope, stated by the owner.

**Decision:** [x] Accept [ ] Reject [ ] Defer\
**Owner-selected option:** B — consider a separate, purpose-limited admin-only detail view after approving exact fields, access, audit and retention; do not change P27 or committee access.

### GAP-M01-04 · NEW · Value H · Effort M-L · Confidence High

**What:** Consider a manually sourced, non-certifying register of society compliance obligations and due dates.

**Why it helps:** An approved list of filings, licences and renewals could show the responsible person, due date and completion evidence in one place.

**Toolkit source:** [Tools 7 and 9](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t7>). Tool 9's fields include requirement, authority, frequency, due date, completed date and responsible person; Tool 7 also includes statutory deadlines and audit dates.

**App today:** A search of `src/app`, `src/core` and `tests` for `compliance`, `statutory`, filing deadlines and renewals found no compliance tracker. P23 tracks meetings and their action items, not statutory obligations. P41.5 is only a planned, non-certifying audit checklist/tie-out view; it does not establish a compliance calendar.

**Change needed:** Use the accepted M20 scope to extend P43.4 with sourced obligation/calendar and evidence links, while still verifying each legal-case-specific source, authority, frequency, due-date rule, responsible person and evidence. Keep obligations society-configured and source-linked, show only their recorded status, and label the view non-certifying. Never populate statutory dates from toolkit samples or imply “compliant” just because entries are marked complete. M20-05 A excludes risk ratings/scores; M20-06 A reuses existing meeting/election records.

**Depends on:** M20 audit/compliance review (both toolkit versions), M04 registration/bye-laws, owner-approved access and applicable adviser review.

**Risks / verify:** A missed or invented date could cause a legal deadline to be missed; a green status could be mistaken for legal certification. **Verify against the state co-operative act / our bye-laws.**

**Options:** A) Defer until M20 confirms the authoritative obligations and boundaries → **Recommended**. B) Plan a manually maintained, non-certifying tracker now, with every obligation and date supplied and approved by the owner after legal review. C) Automatically populate a statutory calendar from toolkit examples (not recommended; they are not legal authority). D) Another scope, stated by the owner.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M01-05 · ENHANCEMENT · Value M · Effort M · Confidence Medium

**What:** Consider an authorized committee activity summary beyond today's meeting-action counts.

**Why it helps:** A summary of assigned, completed, pending and overdue committee work could help committee members see where follow-up is needed.

**Toolkit source:** [Tool 11](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t11>) records meetings, decisions, action items, notices, inspections and other activities by owner role; it summarizes assigned/completed/in-progress/pending/overdue items and a completion percentage.

**App today:** P23 stores meeting action items with an owner, due date and open/done status; P27 `meeting.actions` reports only aggregate open/overdue/done counts. The `/admin/meetings/actions` page is “My action items,” not a society-wide activity scorecard. Existing notice, meeting and operations records remain in their own modules. P35.5–P35.6 plan a separate committee action plan, not a second source for those records.

**Change needed:** If accepted, first compare this against M06's meeting tools. Prefer a read-only summary derived from an agreed, complete source; do not ask people to re-enter meetings, notices, inspections or action items already recorded elsewhere. Define who may see person/role totals and how a completion percentage handles cancelled, newly assigned or untracked work.

**Depends on:** M06 full meeting-tool review, P23 action-item source, P35.5–P35.6 boundary and agreed audience.

**Risks / verify:** A score based only on meeting actions can misrepresent work performed elsewhere; name-level comparisons may affect committee members unfairly if source coverage is incomplete.

**Recommendation:** Defer until M06 confirms whether a derived summary adds value without duplicating existing module records.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### M01 covered, partial and previously decided tools

- **Tool 2 — partly covered:** P27 `core.occupancy` reports active units and owner/tenant/vacant counts. It does not establish statutory shareholding membership; GAP-M02-01 already defers a legal-member register.
- **Tool 4 — partly covered:** P27 ageing uses each unpaid bill's due date in day buckets. Keep that measure; do not substitute `Outstanding ÷ Monthly Charge`. The prior M09 choices preserve current billing definitions and plan a separate as-of report; they do not authorize the toolkit's monthly-charge estimate. See [P38](./IMPLEMENTATION_PLAN.md#phase-p38--dues-and-arrears-m09-review).
- **Tool 5 — planned overlap:** P40.8 already plans fund-balance and monthly-movement reports; do not create a second fund register or summary.
- **Tool 6 — rejected scope:** M13-01 keeps budgets out of MVP. No budget figure or budget-utilization status is added by M01.
- **Tool 8 — covered:** The request administration page and P27 already show open/overdue and category/SLA summaries.
- **Tools 10 and 12 — partial overlap:** BIL-11/BIL-12 already provide unit-based top-defaulter and dues/collection reports. The workbook's names, phone details, months-overdue estimate and suggested actions are addressed separately in GAP-M01-03; do not duplicate them as a second data source.
- **Tool 7 — partial:** P23 has scheduled meetings and action items; statutory deadline tracking is not found and is addressed in GAP-M01-04.
- **Tool 1 — partial:** P27 already supplies live aggregate metrics, but there was no `/admin` command-center landing page. Any new page is GAP-M01-01 and must not introduce a second metric store. P43.1 now provides `/admin`, reading each value from its owning module rule.

### M01 documentation verification

- Read the M01 overview in [TOOLKIT_GUIDE.md](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_GUIDE.md#module-1>) and detailed reference entries for Tools 1–12 in [TOOLKIT_TOOL_REFERENCE.md](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t1>). No original M01 workbook, PDF or Word file was opened.
- Compared P27/D-62 and BIL-11/BIL-12 with analytics catalogue/operations, billing dashboard/report SQL and tests, service-request dashboard, and P23 meeting/action-item pages and analytics tests. Searched for compliance/statutory filing/renewal and committee activity tracking in source and tests.
- All 12 tools are accounted for: **5 decision cards, 1 NEW, 2 ENHANCEMENT, 2 CONFLICT; the rest are covered, partial or already planned/decided above.** Application tests were not run because this is documentation-only; cited test files are existing evidence, not a claim that they passed in this review.
- **Owner decisions:** GAP-M01-01 through GAP-M01-05 were all accepted for planning on 2026-11-18; GAP-M01-02 and GAP-M01-03 use Option B. No M01 decision is still open. The decisions are recorded in P43; its implementation gates remain open.
- **Decision sequence:** Batches 1–4 are recorded; the toolkit comparison is complete (M23 in P53/P35.13; M24 rejected).

## Batch 1 — Parallel comparisons and M06/M07/M20 decisions

The three comparisons were prepared in parallel and reconciled for overlap. All eleven decisions are accepted for planning: M06 in P45.1/P43.5, M07 in P46, and M20 in P41.5/P43.4/P44.2/P44.5, with A for both M20 conflicts. No implementation is authorized by this report, and official election voting/result execution remains blocked pending legal verification and dependent approvals.

### M06 — Meetings & AGM Manager (Tools 61–72)

#### GAP-M06-01 · ENHANCEMENT · Value M · Effort M · Confidence Medium

**What:** Consider optional agenda-item durations, calculated start/end times and reusable standard-agenda templates.

**Why it helps:** Meeting owners could time-box agendas and reuse common agenda structures.

**Toolkit source:** [Tool 63](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t63>), Agenda Builder; the tool describes agenda items, durations and standard agendas.

**App today:** P23 already plans agenda items, and Homeish has meeting operations and tests (`src/core/meeting/` and `tests/unit/meeting-operations.test.ts`). The reviewed contracts do not establish agenda durations or reusable templates.

**Change needed:** If accepted, add optional duration-in-minutes values, derive start/end times from the meeting start, and allow admins to maintain reusable agenda templates with item order and suggested durations.

**Depends on:** Existing P23 agenda behavior; any template source or owner scope.

**Risks / verify:** Keep timing and templates optional; they must not imply that an agenda is legally sufficient. **Verify against the state co-operative act / our bye-laws.**

**Recommendation:** Accepted for planning in P45.1; keep durations/templates optional and do not make toolkit timings statutory defaults.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M06-02 · NEW · Value M · Effort M · Confidence Medium

**What:** Consider a read-only meeting-governance summary showing meetings, attendance/quorum, resolutions, open actions and minutes status.

**Why it helps:** A single view could bring together existing meeting facts without asking admins to maintain duplicate totals.

**Toolkit source:** [Tool 72](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t72>), Meeting Dashboard.

**App today:** P23 already provides meeting, attendance, resolution, minutes and action records. Meeting-related analytics exist in `src/core/analytics/catalogue.ts` (`meeting.held`, `meeting.attendance`, `meeting.actions`). No combined meeting-specific governance summary was found in the targeted review.

**Change needed:** If accepted, derive each figure from its authoritative P23 record and link to that record. Do not add manually maintained counts or new metrics.

**Depends on:** P23 records; P43.5 source completeness, audience and role/access approval. The accepted item extends P43.5 rather than adding a separate dashboard.

**Risks / verify:** Do not imply that a summary certifies compliance or validates a meeting. The accepted view is merged into P43.5; source completeness, audience and access remain open. **Verify against the state co-operative act / our bye-laws.**

**Recommendation:** Accepted for planning as an extension to P43.5; do not create a duplicate dashboard.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### M06 coverage and boundaries

- **Covered or overlapping (8 tools):** Tools 61–62 and 64–69 are substantially within P23's meeting lifecycle. Tool 72 overlaps existing meeting analytics, although its combined view is the subject of GAP-M06-02.
- **No standalone addition proposed (2 tools):** Tool 70's AGM checklist and Tool 71's dispatch tracking did not show a distinct approved gap in this review. Their checklist/deadline and notice-delivery details should not be imported by assumption.
- **Decision cards (2 tools):** Tool 63 and the distinct combined summary in Tool 72.
- **Existing decision boundaries:** P23 remains the meeting record source. P40.4's resolution source remains open. M06 identifies P43.5's P23 source scope, but source completeness, audience and role/access remain kickoff gates. P44.3 amendment milestones and P44.6 approved house-rule text must not be redefined by meeting records.
- **Review limit:** Targeted contract, implementation and test review; no full UI walkthrough or original workbook inspection. GAP-M06-02 extends P43.5 but does not close its remaining gates.

### Karnataka legal-source check (preliminary)

The owner asked for Karnataka housing-society/RWA information and public sample bye-laws. The owner selected **both apartment associations and registered housing co-operatives, compared separately**, and **future official in-app voting, blocked pending legal verification**. All three M07 and all six M20 decisions are accepted for planning in the linked plan entries below. No registered bye-laws were supplied, and no particular society's applicable legal regime is confirmed. Product acceptance does not verify the law or authorize implementation.

**Important distinction:** "RWA" is a description, not enough to identify the governing law. An apartment owners' association, a registered co-operative and another welfare association must not automatically receive the same election or audit rules. The 2026 apartment legislation also contains applicability and transition provisions affecting earlier registrations; a registration label alone does not settle the position.

#### Sources and verification limits

| Ref   | Source                                                                                                                                                                        | What was checked                                                                                                                                                                                                                                                                               | Limit                                                                                                                                                                                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KA-01 | [Karnataka Apartment (Ownership and Management) Act, 2026 — official English text](https://dpal.karnataka.gov.in/uploads/media_to_upload1793346604.pdf)                       | Act 45 of 2026; assent 9 October 2026; Gazette publication 15 October 2026. Read commencement/application, bye-law hierarchy, association registration, Executive Committee, accounts/audit, bye-law approval/model-making and transition/repeal provisions: §§1, 15, 22–23, 28, 32–37, 65–66. | §1(2) requires a separately notified commencement date. That notification, implementing rules, notified model bye-laws, authority appointments, latest amendments/corrigenda and society-specific applicability have **not** been verified. Publication is not proof of commencement. |
| KA-02 | [Karnataka Apartment Ownership Act, 1972 — official India Code PDF](https://indiacode.gov.in/server/api/core/bitstreams/8024fd99-5c2c-42dc-a82f-a4c4160129f7/content)         | Read §2's declaration-based application and §16's bye-law/election/accounting provisions.                                                                                                                                                                                                      | Historical framework only for this comparison; do not presume it remains the controlling framework where the 2026 Act's commencement, application and transition provisions operate.                                                                                                  |
| KA-03 | [Karnataka Co-operative Election Authority — provisions of the 1959 Act and 1960 Rules](https://coea.karnataka.gov.in/12/co-operative-societies/en)                           | The official page describes board elections, membership-based electoral rolls, Election Officer verification, and custody/disposal of election papers, including §28-B and Rules 13, 13-C, 13-D, 14-AB and 14-AD.                                                                              | This is an official explanatory extract, not a fully verified current consolidation or proof of applicability to every apartment association/RWA. No eligibility condition, period or identity-document requirement is adopted.                                                       |
| KA-04 | [Karnataka Stamps and Registration Department — apartment-registration FAQ](https://igr.karnataka.gov.in/189/registration-of-instruments-relating-to-flats-and-apartments/en) | The FAQ distinguishes apartment declarations, registered instruments and co-operative-society transactions.                                                                                                                                                                                    | Older explanatory guidance; not evidence that the 2026 transition is complete or that a chosen legal form is appropriate.                                                                                                                                                             |
| KA-05 | [Public copy titled Karnataka Apartment Ownership Rules, 1974](https://welworthcity.in/downloads/assets/docs/phl-docs/KAOR1974.pdf)                                           | Search results identify historical declaration/bye-law form material.                                                                                                                                                                                                                          | Private mirror, not an authenticated current government model. Full-file retrieval returned HTTP 406, so its full contents were **not inspected**. It is an illustrative lead only, not an adopted template or verified rule.                                                         |
| KA-06 | [Karnataka Societies Registration Act, 1960 — India Code record](https://www.indiacode.nic.in/handle/123456789/7743?view_type=browse)                                         | The official record was located in search results as a separate registration statute.                                                                                                                                                                                                          | Full text was not retrieved successfully in this check. No conclusion is made that registration under this Act is suitable or sufficient for apartment management.                                                                                                                    |

The section references above identify targeted excerpts, not a clause-by-clause legal review. No current, officially notified model bye-laws under the 2026 Act were verified. The power to publish model bye-laws in §37 is not proof that a particular model has been notified. A sample may help compare fields and workflows, but owner agreement that it looks useful cannot establish its legal applicability.

#### What this means for M07 and M20

- **M07-01 — schedule/notices/officers:** A manual, evidence-linked tracker remains a proposal. Dates, notice sufficiency and the authority of an officer cannot be inferred from toolkit or historical model examples.
- **M07-02 — voters/candidates/seats:** The inspected 2026 text addresses Executive Committee elections and bye-law governance (§§23 and 35), while the co-operative authority describes a different electoral-roll process. Do not mix these regimes or change P22 from either example. Legal form, applicable law/version, membership, registered governing documents, authorized verification and permitted voting method remain gates.
- **M07-03 — outcomes/disputes/expenses:** Recording an externally declared result is different from Homeish determining who is legally elected. No tie-breaking rule, dispute authority or permission to conduct online statutory voting has been verified.
- **M20-01 through M20-04:** The inspected apartment text has its own accounts/audit provision (§28), and its bye-law provisions affect governing-document evidence. Do not apply co-operative auditor/Registrar requirements to every RWA, calculate commencement-based deadlines from the publication date, or mark a filing/record as legally sufficient without verifying its applicable source.
- **M20-05 and M20-06:** The owner accepted Option A for both: factual, non-certifying records and existing meeting/election source links, with no risk rating/score or duplicate workflow. The legal and access gates remain open.
- **Existing behavior:** P22's unit representative, optional tenant voting, electorate freeze, lifecycle controls, ballot privacy and retention are approved product rules, not a verified statutory-election process. P23/P44 records likewise do not establish legal validity merely because an admin records approval.

#### Election scope in everyday terms — owner-selected review direction

- **Record-keeping only:** An authorized officer runs the election outside Homeish. Homeish stores the sourced schedule, officer appointment, approved documents and externally declared result. It does not decide statutory voter/candidate rights, take statutory ballots or declare the legal winner. Ordinary community opinion polls remain separate.
- **Homeish runs the official election:** Homeish would administer the legally approved voter/candidate process, accept ballots, count seats and support the official result process. This needs a verified legal basis, permitted voting method, election authority, privacy/retention rules and explicit changes to the current product contract.
- **Owner direction and subsequent decisions:** Include official in-app voting in future planning, blocked pending legal verification, and compare the two Karnataka legal cases separately. All three M07 cards are accepted for planning in P46. This does not reopen M02's deferred membership/share work or change P22's approved product rules.

All three M07 decisions are recorded in [P46](./IMPLEMENTATION_PLAN.md#phase-p46--election-governance-and-gated-official-voting-m07-review); all six M20 decisions are recorded in [P41.5](./IMPLEMENTATION_PLAN.md#p41-5), [P43.4](./IMPLEMENTATION_PLAN.md#p43-4), [P44.2](./IMPLEMENTATION_PLAN.md#p44-2) and [P44.5](./IMPLEMENTATION_PLAN.md#p44-5). The source check itself does not establish legal applicability. Legal and statutory points remain **verify against the state co-operative act / our bye-laws**, or the applicable Karnataka apartment/association legislation where that is the governing framework.

### M07 — Elections & Voting Tracker (Tools 73–84)

#### GAP-M07-01 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Add an election-specific schedule, preparation checklist, notice and officer tracker.

**Why it helps:** Election milestones, assigned responsibilities, notices and polling-day preparation could be managed together.

**Toolkit source:** [Tools 73, 77, 78 and 81](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t73>) cover schedule and actual dates, election notices, polling checklists, and officer roles, duties, confirmations and conflicts.

**App today:** P23 supports AGM/SGM/committee meetings and notifications, but is not an election schedule or officer register (`docs/PRD.md` §5.10.8; `docs/DATABASE.md` §9.18).

**Change needed:** If accepted, define an election record and milestones with activity, owner, planned/actual dates and status; add a preparation checklist, notice fields and officer appointment/role/duty/confirmation fields. Do not duplicate meeting notices or create legal deadlines by default.

**Depends on:** M06 decisions; approved election and notice rules; M04/P44 registration and governing-document work.

**Risks / verify:** Keep officer contact data limited and access-controlled. Deadlines and notice periods are not verified. **Verify against the state co-operative act / our bye-laws.**

**Recommendation:** Accepted for planning in [P46.1](./IMPLEMENTATION_PLAN.md#p46-1), with dates advisory until their authoritative source is approved.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M07-02 · ENHANCEMENT · Value H · Effort H · Confidence High

**What:** Define an election-specific voter/candidate process, committee seats and a legally verified path to future official in-app voting.

**Why it helps:** Legal election eligibility is distinct from an app poll's frozen electorate and ballot workflow.

**Toolkit source:** [Tools 74–76](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t74>) describe eligibility inputs (membership, paid share capital and dues), nomination filing/category/proposer/seconder/fee/scrutiny, and candidate declarations/documents/category/ballot number. Tool 74 also has manual voted/signature/thumb fields.

**App today:** P22 implements private elections, offices/candidates, one vote per unit, a frozen unit representative/electorate and aggregate-only choices (`docs/PRD.md` §5.10.7 and D-60; poll tables/RPCs in `docs/DATABASE.md`). These are not statutory membership or election-eligibility rules. Household/occupancy is not legal membership; M02's legal-member questions remain deferred. P35.2/P44 also leave election metadata and legal mappings gated.

**Change needed:** Before designing a workflow, approve what counts as a legal member/voter and eligible candidate, seat/category/composition rules, nomination requirements, dues/share effects and the authorized verifier. Assess apartment associations and registered co-operatives separately; do not offer an unverified universal rule set. If accepted, plan an election register with sourced eligibility snapshots, nomination states and audit history, plus future official in-app ballot casting and counting only after the permitted voting method and election authority are verified. Explicitly review the P22/PRD link before any implementation; do not silently reuse or change its unit representative, tenant setting, electorate freeze, lifecycle controls, ballot privacy or retention. Do not collect signatures/thumbprints or sensitive proof documents without a separately approved purpose, access and retention policy.

**Depends on:** Applicable legal form, current authoritative law/commencement and registered governing documents; qualified local review of the permitted voting method and authority; M02 legal membership/share decisions; M04/P44; M06; explicit P22/PRD decision. M02 remains deferred until separately reconsidered. M05 Committee content is missing from the toolkit and cannot supply these rules.

**Risks / verify:** This directly affects member rights, privacy and eligibility. No permission for official online voting has been established by the preliminary source check. Toolkit categories, fees, dues/share checks and tie rules are examples, not adopted rules. Official-election execution must remain blocked pending legal verification. **Verify against the state co-operative act / our bye-laws**, or the applicable apartment/association framework.

**Recommendation:** Accepted as blocked future planning in [P46.2](./IMPLEMENTATION_PLAN.md#p46-2). Do not implement, connect it to P22 or adopt eligibility rules until the legal definitions, authority and permitted voting method are verified and the dependent owner decisions are approved.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M07-03 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Provide election outcomes/declaration, dispute tracking and election-expense reporting with boundaries to existing polls and accounting.

**Why it helps:** Reviewable outcomes and follow-up would be available without treating app poll totals or manually entered costs as authoritative legal records.

**Toolkit source:** [Tools 79–80 and 82–84](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t79>) cover category/seat ranking, tie or unopposed outcomes, result declarations, disputes, expense entries/approval and dashboard/readiness metrics.

**App today:** P22 stores private aggregate tallies and provides completed results/exports; P23 has meeting resolutions/minutes. P16/P39 provide expense and accounts sources. The targeted search found no election-dispute workflow or election dashboard (`docs/DATABASE.md`, `docs/API.md`, `docs/PRD.md` §§5.10.7–5.10.8; `tests/e2e/poll.spec.ts`).

**Change needed:** If accepted, add election outcomes and tie/unopposed handling only under verified rules; a restricted dispute register with status, assignee, resolution and dates; and reports from authoritative election, meeting and expense sources. Distinguish an externally declared result entered as evidence from any future official result process supported by in-app voting; the latter remains blocked with GAP-M07-02. Link election expenses to existing expense/accounting records rather than creating a second ledger. Do not expose private ballot choices or infer statutory results from P22 aggregates.

**Depends on:** GAP-M07-02; P22; M06; M11/P39 accounts and M13/P42 expense-control work.

**Risks / verify:** Results, disputes, tie-breaking, escalation and expense authority have legal and privacy implications. Toolkit expense approval is not Homeish authorization. **Verify against the state co-operative act / our bye-laws.**

**Recommendation:** Accepted for planning in [P46.3](./IMPLEMENTATION_PLAN.md#p46-3). Keep legal results and disputes separate from P22 poll totals; reuse existing expense records. Official result calculations remain blocked with P46.2.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### M07 coverage and boundaries

- **Partly covered (2 tools):** Tool 77 overlaps meeting notices; its election-specific schedule content is not covered. Tool 80 overlaps P22's aggregate results but does not establish a legal result declaration.
- **Not imported as described (2 tools):** Tool 74's manual voted/signature/thumbprint fields and Tool 79's manual booth tally/ranking are not safe substitutes for P22's private ballot and aggregate-only tally. Their separate election-eligibility and result rules still need review.
- **Election-specific gaps grouped in the three cards:** Tools 73–76, 78, and 81–84.
- **Preserve app-only capabilities:** P22's private ballot, unit representative, frozen electorate, lifecycle, turnout and exports; P23 meeting resolutions; existing expense/accounting records.
- **Review limits:** M05 Committee content is missing, and no original workbook was inspected. The card scopes do not infer committee rules or statutory elections from toolkit examples.
- **Owner decisions:** All three M07 cards were accepted for planning on 2026-11-18, and the owner approved the P46 plan-update preview. No separate owner rationale was supplied; the accepted scope and safeguards are recorded in the plan. Legal verification and implementation gates remain open.

### M20 — Statutory Audit & Registrar Compliance Tracker (Tools 229–240; both editions)

**Review status:** All twelve tools in both editions were compared as one capability. All six cards are accepted for planning on 2026-11-18, with A for both conflicts. The owner approved the plan-update preview; the work is merged into P41.5/P43.4/P44.2/P44.5. No new compliance module, implementation, statutory certification or closure of legal-source gates is authorized.

The guide describes two different M20 workbook editions, not copies: Edition A uses Dashboard/Register/Setup-style sheets; Edition B uses Dashboard/Data/Settings with different columns and calculations. Both editions were compared as one capability. Sample categories, rates, thresholds, dates, frequencies and deadlines are examples only; neither edition is selected as authoritative.

#### M20 Karnataka audit-source comparison and proposal boundaries

| Legal case              | Source evidence inspected                                                                                                                                                                                                                                                                                                                                               | What remains unverified                                                                                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apartment association   | The complete §28 of the [official 2026 apartment Act](https://dpal.karnataka.gov.in/uploads/media_to_upload1793346604.pdf) describes accounts, annual audit by a chartered accountant or another prescribed qualified auditor, and submission of audited accounts to the competent authority. It names receipts/payments, income/expenditure and balance-sheet records. | Commencement, transition/application to a particular property, prescribed auditor/form/filing requirements, competent authority and current governing documents. Do not start a deadline from the Act's publication or assume a generic RWA falls within this case.                |
| Registered co-operative | The [official Co-operative Audit Citizens Charter](https://sahakaradarpana.karnataka.gov.in/10/citizens-charter/en) describes §63-based annual audit, general-body appointment from the Director's approved panel, and the Director's appointment role where the society has not appointed an auditor.                                                                  | The current consolidated Act/rules/amendments, applicable panel category, appointment/rotation/filing/rectification rules and society-specific applicability still require verification. The charter is official guidance, not a fully verified current legislative consolidation. |

**Retrieval limits:** A [Ministry of Co-operation copy of the 1959 Act](https://cooperation.gov.in/sites/default/files/inline-files/11of1959%28E%29.pdf) was located, but retrieval failed certificate verification; no security check was disabled. The audit department's [2025–26 annual-report PDF](https://sahakaradarpana.karnataka.gov.in/uploads/ANNUAL%20REPORT%202025%2026%20ENG_1789554925.pdf) was retrieved, but targeted text extraction did not locate the provisions and its first three pages had no extractable text. Neither is used as inspected clause evidence. Registered bye-laws remain unavailable.

**Accounting boundary:** P16/P41's cash reports, an audit checklist and an uploaded report do not establish statutory accounting completeness or a completed legal audit. The inspected apartment text's financial-statement requirements are a legal-fit question, not permission to override D-39 or build a formal balance sheet. Preserve P41.2's source/accountant/legal/scope gate; approved externally prepared statements may be linked as P19 evidence without claiming Homeish generated or certified them.

**Accepted consolidation:** Extend P43.4/P44.5 for obligation/filing evidence, P41.5 for audit follow-up, P44.2 for register-maintenance evidence, and P44.5 for private notice/hearing case details. Do not create a second compliance register, correspondence log, audit ledger or document store. The accepted conflict choices are M20-05 A (factual records, no risk rating/score) and M20-06 A (existing meeting/election source links, no duplicate workflow).

**Decision meaning:** Acceptance approves future planning only; it does not verify a deadline, auditor qualification, filing duty, legal outcome or current compliance. For M20-05/M20-06, Accept with Option A accepts the stated keep-current/no-duplicate boundary, not the alternative feature. All six decisions are recorded in the plan; no separate owner rationale was supplied beyond the selected scope and safeguards.

#### GAP-M20-01 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Extend P43.4's compliance register with verified calendar and filing evidence instead of creating another register.

**Why it helps:** Obligation tracking can connect to filing records and acknowledgements, rather than recording only an obligation or reminder.

**Toolkit source:** [Tools 229 and 234](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t229>) cover compliance calendar and Registrar returns. Edition A includes authority, owner, completion and status; Edition B adds provision/reference and responsible person. Return fields include period/year, filed date, mode and acknowledgement. Tool 235's annual-return steps overlap the planned obligation/document sources.

**App today:** P43.4 is planned as a manually sourced, non-certifying register; P44.5 plans an admin-only Registrar record log. Neither is implemented. The document repository lives in `src/core/document/operations.ts` (`getDocumentWorkspace`, `createDocument`).

**Change needed:** If accepted, extend the existing planned register with the approved obligation/provision, period, responsible person/role, verified due/completion dates, status, evidence link, filing date/mode, acknowledgement and next occurrence. Only create recurrences or alerts from verified deadlines.

**Depends on:** P43.4 and its authority/source gate; P44.5; existing document repository and access controls.

**Risks / verify:** Keep it manual and non-certifying. Never infer obligations or deadlines from samples. **Verify against the state co-operative act / our bye-laws.**

**Recommendation:** Accepted for planning in [P43.4](./IMPLEMENTATION_PLAN.md#p43-4) and [P44.5](./IMPLEMENTATION_PLAN.md#p44-5), with sourced facts and no second register.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M20-02 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Extend P41.5's accepted audit checklist with auditor appointment, audit queries and report/rectification follow-up.

**Why it helps:** A checklist alone does not capture an appointment, incoming auditor queries, report disposition or follow-up evidence.

**Toolkit source:** [Tools 230–233](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t230>) cover the annual checklist, auditor appointment, query response and audit report. Edition A emphasizes appointment mode, consent/engagement, queries and rectification; Edition B adds auditor identifiers/term and report type/filing details.

**App today:** P41.5 is planned, not implemented; M20 now extends its tracking scope while legal-case/auditor, source, field/access and retention gates remain open. Document/version handling exists in `src/core/document/operations.ts` and `src/core/document/validation.ts`. No statutory audit workflow was found in the targeted code search.

**Change needed:** If accepted, extend P41.5 rather than adding a second audit workflow. Link checklist tasks to a financial year, auditor/firm and appointment evidence; record query number/date/area/description/assignee/due/response; and record report received/placed/filed dates, the opinion from the source report and objections with owner, due date and resolution evidence. Record only applicable, verified appointment/filing requirements for the relevant legal case. Keep calculated statuses derived, not editable facts. Do not generate an auditor's opinion, certify audit completion, post adjustments or override D-39/P41.2's accounting-scope gate.

**Depends on:** P41; verified legal-case/auditor requirements; source-linked documents; approved fields, role access, retention and financial-year conventions.

**Risks / verify:** Toolkit auditor categories, rotation formulas and audit classes are not legal rules. Do not imply auditor eligibility, rotation, opinion or filing compliance from workbook samples. **Verify against the state co-operative act / our bye-laws.**

**Recommendation:** Accepted for planning in [P41.5](./IMPLEMENTATION_PLAN.md#p41-5); legal-case requirements, roles, source records and financial-year rules still need approval. Keep it non-certifying.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M20-03 · ENHANCEMENT · Value M · Effort M · Confidence Medium

**What:** Consider a statutory-register completeness/maintenance view within P44's existing document and rules scope.

**Why it helps:** An evidence-linked view could show whether a register exists, its custodian and when it was last reviewed without duplicating document storage.

**Toolkit source:** [Tool 237](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t237>), Statutory Registers Checklist. Edition A includes group, last update, review interval, custodian and auditor verification; Edition B adds maintained/partial/no states and derived next-update/status.

**App today:** P44 plans a governing-document index and rules register; P35/P44 plan linked document tracking. Existing repository functions include `listDocuments` and `getDocument` in `src/core/document/operations.ts`.

**Change needed:** If accepted, consider register type/name, applicability basis, maintained state, format/location, custodian, last-reviewed date and evidence link. Do not prescribe required register lists or legal review intervals without approved jurisdiction-specific sources.

**Depends on:** P44; approved source and categories; existing repository access controls.

**Risks / verify:** Keep it informational and evidence-linked. **Verify against the state co-operative act / our bye-laws.**

**Recommendation:** Accepted for planning in [P44.2](./IMPLEMENTATION_PLAN.md#p44-2); evidence-linked maintenance only, without a parallel store or legal-completeness claim.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M20-04 · NEW · Value M · Effort M · Confidence Medium

**What:** Extend P44.5's private correspondence record with official notice, hearing and response case details; do not create a second log.

**Why it helps:** An external notice, reply due date, hearing and response evidence are different from Homeish's internal security audit log.

**Toolkit source:** [Tool 238](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t238>), Notice & Penalty Tracker. Both editions record notice reference, authority, received/reply dates and subject; the editions differ on hearing and amount fields.

**App today:** `src/app/developer/audit/page.tsx` and `src/core/developer/console.ts` concern platform audit records, not society notices. `supabase/migrations/20261109225100_core_audit_logs.sql` defines `audit_logs`; source documents are handled by `src/core/document/operations.ts`. P44.5 already plans an admin-only Registrar correspondence log; the proposed case fields must extend it rather than duplicate it.

**Change needed:** If accepted, extend P44.5 for approved official issuing authorities with reference, received date, subject, verified reply deadline, assigned reviewer, hearing date, response date/status and linked P19 notice/reply documents; link the applicable P43.4 obligation where relevant. Preserve P44.5's admin-only access, audit and evidence rules; naming a reviewer does not grant app access. Keep penalty amount/payment fields, liability calculations, automatic sending and legal replies out of this scope.

**Depends on:** P43.4/P44.5; source-linked documents; restricted access, retention and escalation rules.

**Risks / verify:** Do not calculate liabilities or send legal replies automatically. **Verify against the state co-operative act / our bye-laws.**

**Recommendation:** Accepted as an extension to [P44.5](./IMPLEMENTATION_PLAN.md#p44-5); keep penalty calculations/fields, sending/submission and automatic legal responses out of scope.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M20-05 · CONFLICT · Value Low–Medium · Effort M · Confidence High

**What:** Decide whether to omit standalone compliance risk scoring or permit a carefully defined internal prioritization view.

**Why it helps:** A score might help order follow-up, but unverified thresholds could duplicate P43.4 and falsely imply compliance status.

**Toolkit source:** [Tools 239–240](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t239>) describe likelihood × impact scoring and dashboards. Edition A has configurable weights/penalties; Edition B supplies sample bands and quarterly review. Tool 240 also overlaps P27 analytics.

**App today:** Accepted P43.4 is a source-linked, factual compliance register; P27 analytics is an approved dashboard source. The plan says P43.4 remains gated and P27's approved dashboard remains unchanged.

**Change needed:** Choose whether to keep P43.4 factual or later add a separate internal prioritization field/view after definitions, access, review cadence and disclaimers are approved. Do not add a legal-compliance score.

**Depends on:** P43.4; explicit owner decision and a verified source/method if prioritization is pursued.

**Risks / verify:** A score must never be shown as certification or statutory compliance. **Verify against the state co-operative act / our bye-laws.**

**Options:** A) Keep P43.4 factual and omit risk scoring. B) Later add a separate internal prioritization view after its method and safeguards are approved. **Recommended: A**, to avoid false assurance and duplicate ownership.

**Recorded choice:** Accept A in [P43.4](./IMPLEMENTATION_PLAN.md#p43-4): facts/evidence only, no risk rating/score; P27 remains unchanged.

**Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [x] A [ ] B

#### GAP-M20-06 · CONFLICT · Value Low · Effort M · Confidence Medium

**What:** Keep meeting/election evidence in M06/M07/P44 rather than create a duplicate M20 workflow; consider links from P43.4 to approved records.

**Why it helps:** A separate checklist could duplicate meeting notices, quorum, minutes and election requirements that have their own governance review.

**Toolkit source:** [Tool 236](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t236>), Election & Meeting Compliance Checklist. Edition A tracks required/held counts and minutes/notice evidence; Edition B tracks event, notice, quorum and minutes with calculated checks.

**App today:** Meeting and minutes workflows exist in `src/core/meeting/operations.ts` and `src/core/meeting/minutes-pdf.ts`. M06's accepted summary extends P43.5, but source completeness, audience and role/access approval remain open. M07 is accepted for planning in P46, with official voting/result execution blocked; the preliminary Karnataka source check above does not establish society-specific legal requirements.

**Change needed:** If Option A is chosen, do not add a duplicate M20 checklist; link relevant P23/P46 meeting/election records to P43.4 once their source/access gates close. If Option B is chosen, add a separate checklist only if those reviews identify a distinct verified obligation and its source/fields are approved.

**Depends on:** Accepted M06/M07 scope and its remaining source/access/legal gates; existing meeting records; P43.4.

**Risks / verify:** Do not hard-code notice periods, quorum or election requirements from examples. **Verify against the state co-operative act / our bye-laws.**

**Options:** A) No duplicate M20 workflow; use approved meeting/election source links. B) Add a separate, source-backed checklist only for a distinct verified obligation. **Recommended: A**, to preserve clear ownership and avoid duplicate records.

**Recorded choice:** Accept A in [P43.4](./IMPLEMENTATION_PLAN.md#p43-4): reuse P23/P46 source links, no duplicate checklist/workflow; all source/access and P46 legal-verification gates remain.

**Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [x] A [ ] B

#### M20 coverage and edition notes

- **Covered or planned overlap (7 tools):** Tool 229 with P43.4; Tool 230 with P41; Tools 234–235 with P43.4/P44.5; Tool 236 with M06/M07; Tool 237 with P44; Tool 240 with P27/P43.4. These are not claims that planned features are implemented.
- **Accepted extensions and omitted alternative:** Tools 231–233 extend P41.5 audit tracking; Tool 238 extends P44.5 case records; Tool 229 extends P43.4 calendar/evidence links. Tool 239's risk-scoring/prioritization alternative is omitted under M20-05 A. No duplicate workflow or register is approved.
- **Important distinction:** Homeish `audit_logs` record application actions/security accountability; they are not statutory society audits.
- **Review limits:** Targeted document/code/test review only; no exhaustive migration, screen, test-assertion or legal-source audit, and no original workbook was independently inspected. The two editions differ; neither their sample data nor formulas were validated as legal rules.

### Batch 1 review notes

- M06's two decisions are accepted and recorded in P45.1/P43.5; M07's three in P46; and all six M20 decisions in P41.5/P43.4/P44.2/P44.5, with A for both conflicts. No application code, schema, migrations or tests were changed.
- Batch 1 contains **11 accepted planning decisions: 2 NEW, 7 ENHANCEMENT and 2 CONFLICT**. No M06/M07/M20 product decision remains open; implementation and legal verification remain separate.
- M07-02 and M07-03 affect election/member rights; M20-05 and M20-06 affect compliance/governance boundaries. The workbook examples are not authoritative. Legal and statutory points must be **verified against the state co-operative act / our bye-laws**.
- Next comparison (at Batch 1 close): M14 vendors/AMC, then M15, M16, M17, M18, M19, M23 and M24. Batches 2 and 3 below have since recorded M14–M19. Continue to assess the Karnataka legal cases separately and preserve all legal-source gates.

## Batch 2 — Parallel comparisons and M14/M15/M16 decisions

The three comparisons were prepared in parallel (read-only) and checked against the PRD, migrations and plan. All 21 decisions are recorded: M14 in [P47](./IMPLEMENTATION_PLAN.md#phase-p47--vendor-contract-and-amc-additions-m14-review), M15 in [P48](./IMPLEMENTATION_PLAN.md#phase-p48--staff-record-additions-m15-review) and M16 in [P49](./IMPLEMENTATION_PLAN.md#phase-p49--helpdesk-additions-m16-review). Nineteen are accepted for planning; GAP-M15-02 and GAP-M15-03 keep current behavior (Option A), and GAP-M15-05 places payroll in deferred/backlog for a possible future Pro version. No owner reasons were supplied. No implementation is authorized. Toolkit numbers and sample values are examples, not defaults. Legal points: **verify against the state co-operative act / our bye-laws**; for M15, verify against applicable labour law.

### Batch 2 counts

| Module                       | Tools           | Cards  | NEW | ENHANCEMENT | CONFLICT | Covered / overlap / held                                                             |
| ---------------------------- | --------------- | ------ | --- | ----------- | -------- | ------------------------------------------------------------------------------------ |
| M14 Vendors, contracts & AMC | All 12, 157–168 | 8      | 2   | 4           | 2        | 161, 164 covered by P24/D-54; 167 held for M24 (overlaps P44.1 and asset warranties) |
| M15 Staff & payroll          | All 12, 169–180 | 5      | 1   | 1           | 3        | 180 partly covered (attendance-rate metric)                                          |
| M16 Complaints & helpdesk    | All 12, 181–192 | 8      | 1   | 5           | 2        | 186 covered (overdue flag and P32 escalation)                                        |
| **Total**                    | 36              | **21** | 4   | 10          | 7        |                                                                                      |

**Conflicts touching money, legal compliance or member/staff rights:** GAP-M14-07 (vendor bills vs the PRD vendor-payments exclusion, AMC-7 and D-39), GAP-M15-05 (payroll vs D-19), GAP-M15-03 (D-20), GAP-M15-02 (P25 on-duty rule), GAP-M16-01 and GAP-M16-02 (resident-facing service commitments).

### M14 — Vendors, Contracts & AMC (Tools 157–168)

#### GAP-M14-01 · ENHANCEMENT · Value M · Effort S · Confidence High

**What:** Add vendor PAN, payment terms (days), onboarded date and status `Active / Inactive / Blacklisted`. **Toolkit source:** [Tool 157](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t157>). **App today:** name, category, contact, phone, email, GSTIN, notes and an active flag (`supabase/migrations/20261116210000_vendor_foundation.sql`). **Risks / verify:** blacklisting needs a reason and audit, and must not change past purchase history.

**Recorded choice:** Accept, in [P47.1](./IMPLEMENTATION_PLAN.md#p47-1). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M14-02 · NEW · Value M · Effort M · Confidence High

**What:** A general (non-AMC) vendor-contract register: scope, start/end, annual value, payment frequency `Monthly, Quarterly, Half-yearly, Yearly, One-time`, auto-renew, notice days and expiry status. **Toolkit source:** [Tool 158](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t158>). **App today:** only AMC contracts (P14). **Risks / verify:** reuse P14 renewal/reminder patterns; do not duplicate AMC records.

**Recorded choice:** Accept, in [P47.2](./IMPLEMENTATION_PLAN.md#p47-2). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M14-03 · ENHANCEMENT · Value M · Effort M · Confidence High

**What:** A structured AMC service schedule: AMC type `Comprehensive / Non-comprehensive`, asset type, services per year, next service due and overdue status. **Toolkit source:** [Tool 159](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t159>). **App today:** `visit_frequency` is free text (`supabase/migrations/20261115150000_amc_management.sql`), so next service cannot be computed. **Risks / verify:** no guessed conversion of existing free text.

**Recorded choice:** Accept, in [P47.3](./IMPLEMENTATION_PLAN.md#p47-3). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M14-04 · ENHANCEMENT · Value M · Effort M · Confidence Medium

**What:** A monthly security/housekeeping agency staff-day check: sanctioned vs actual man-days, shortfall, contracted amount, deduction, payable, bill raised, variance and flag. **Toolkit source:** [Tools 165–166](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t165>). **App today:** nothing. **Risks / verify:** record-only, no payment; deduction rules are contract-specific; must not become a cleaning schedule (D-20). Depends on GAP-M14-02.

**Recorded choice:** Accept, in [P47.5](./IMPLEMENTATION_PLAN.md#p47-5). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M14-05 · CONFLICT · Value L · Effort S · Confidence High

**What:** AMC expiry bands. **App today:** Active / Expiring (within the configurable `expiring_soon_days`, default 30) / Expired; reminders 60/30/7; P27 "contracts ending in 60 days". **Toolkit:** Urgent ≤30, Due Soon ≤90, Upcoming (not started), Expired, with action text ([Tools 158, 160](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t160>)). **Options:** A) keep; B) adopt toolkit-style bands; C) keep and add only "Not started yet". Recommended A.

**Recorded choice:** Accept B, in [P47.4](./IMPLEMENTATION_PLAN.md#p47-4). Changes PRD AMC-2; windows become settings; reminders and the P27 metric are reviewed, not silently changed. **Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [ ] A [x] B [ ] C

#### GAP-M14-06 · NEW · Value M · Effort M · Confidence High

**What:** A work-order register after P24 approval: number, description, issue/due/completion dates, value, status `Issued, In Progress, Completed, Cancelled`, delay and days open. **Toolkit source:** [Tool 162](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t162>). **App today:** P35.13 plans only a printable work-order letter. **Risks / verify:** no payment.

**Recorded choice:** Accept, in [P47.6](./IMPLEMENTATION_PLAN.md#p47-6). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M14-07 · CONFLICT · Value M · Effort M · Confidence High

**What:** Vendor invoices and amounts owed: invoice number/date/amount, due date = invoice date + terms, Overdue / Due Soon. **Toolkit source:** [Tool 163](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t163>) (30-day terms and 7-day window are examples). **App today:** "vendor payments" out of MVP in the PRD, AMC-7 and D-39 simple cash book; GAP-M11-04 A kept D-39. **Options:** A) keep out of scope; B) read-only bills-owed register whose paid amounts come only from P16 entries; C) defer. Recommended A.

**Recorded choice:** Accept B, in [P47.7](./IMPLEMENTATION_PLAN.md#p47-7). Narrows the vendor-payments exclusion for tracking only; the app never pays; D-39 is otherwise unchanged. **Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [ ] A [x] B [ ] C

#### GAP-M14-08 · ENHANCEMENT · Value L · Effort S · Confidence Medium

**What:** A vendor/contract summary on vendor screens: active vendors, active contract value, renewals due, average rating, open work orders, overdue AMC services and (via GAP-M14-07 B) bills owed. **Toolkit source:** [Tool 168](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t168>). **Risks / verify:** no new P27 metric (D-62; GAP-M13-08 precedent).

**Recorded choice:** Accept, in [P47.8](./IMPLEMENTATION_PLAN.md#p47-8). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### M14 coverage

- **Covered (2 tools):** Tools 161 and 164 are covered by P24 quotes, approvals and ratings (D-54).
- **Held (1 tool):** Tool 167 (insurance/warranty) is held for the M24 insurance review because it overlaps P44.1 and asset warranties.

### M15 — Staff & Payroll (Tools 169–180)

#### GAP-M15-01 · ENHANCEMENT · Value M · Effort M · Confidence Medium

**What:** Non-pay staff fields: department, designation, employment type `Permanent, Contract, Daily Wage, Part-time`, joining date, weekly off, status `Active, On Notice, Left` and exit date. **Toolkit source:** [Tools 169, 172](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t169>). **App today:** STF-2 profile and STF-8 attendance. **Risks / verify:** no salary fields; D-18 (no full ID documents) stays.

**Recorded choice:** Accept, in [P48.1](./IMPLEMENTATION_PLAN.md#p48-1). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M15-02 · CONFLICT · Value M · Effort M · Confidence Medium

**What:** Guard roster and duty-post allocation. **Toolkit source:** [Tools 170, 178](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t170>) (reference fields are sparse; workbook not opened). **App today:** P25 "every guard counts as on duty (no shift roster)". **Options:** A) keep; B) information-only roster; C) roster driving who is on duty. Recommended A.

**Recorded choice:** Accept A: keep P25's current behavior as intended. **Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [x] A [ ] B [ ] C

#### GAP-M15-03 · CONFLICT · Value L · Effort M · Confidence High

**What:** Housekeeping/sweeper area roster. **Toolkit source:** [Tool 171](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t171>). **App today:** D-20 "inventory only; no cleaning schedules or area logs". **Options:** A) keep D-20; B) reopen D-20. Recommended A.

**Recorded choice:** Accept A: keep D-20 as intended. **Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [x] A [ ] B

#### GAP-M15-04 · NEW · Value L · Effort S · Confidence Medium

**What:** Private staff performance notes: date, category (examples Training Needed, Warning, Appraisal), rating 1–5, note, action, follow-up date, recorded by and Open/Closed. **Toolkit source:** [Tool 179](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t179>). **Risks / verify:** sensitive personal data; admin-only with access, audit and retention gates. Recommended Defer; the owner accepted it.

**Recorded choice:** Accept, in [P48.2](./IMPLEMENTATION_PLAN.md#p48-2). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M15-05 · CONFLICT · Value H · Effort H · Confidence High

**What:** Payroll: salary calculator, payment register, advances/deductions, leave pay impact and PF/ESI applicability. **Toolkit source:** [Tools 173–177](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t173>). **App today:** D-19 / STF-8 "payroll is out of scope". **Options:** A) keep D-19; B) adopt payroll; C) future Pro version. Recommended A.

**Recorded choice:** Accept C, recorded as deferred/backlog for a possible future Pro version with no planned work; D-19 stays in force. Reconsider only for a future Pro version with customer demand, after accounting, salary-privacy and labour-law review. **Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [ ] A [ ] B [x] C

#### M15 coverage

- **Partly covered (1 tool):** Tool 180's dashboard overlaps the existing attendance-rate metric; its roster and payroll figures follow GAP-M15-02 and GAP-M15-05.

### M16 — Complaints & Helpdesk (Tools 181–192)

#### GAP-M16-01 · CONFLICT · Value H · Effort M · Confidence High

**What:** Priority and response-target basis. **App today:** Normal/Urgent with SLA hours per category (SRQ-1, SRQ-6, P32). **Toolkit:** Critical/High/Medium/Low with target = logged date + target for the priority ([Tools 181, 183](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t181>)). **Options:** A) keep; B) replace with four priorities and priority-based targets; C) keep category targets with an optional priority override. Recommended A or C.

**Recorded choice:** Accept B, in [P49.1](./IMPLEMENTATION_PLAN.md#p49-1). Changes SRQ-1/SRQ-6/D-59; existing requests keep their recorded due times. **Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [ ] A [x] B [ ] C

#### GAP-M16-02 · CONFLICT · Value M · Effort M · Confidence High

**What:** An On Hold status. **App today:** no hold; the target clock and P32 escalation keep running. **Toolkit source:** [Tools 181, 190, 192](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t190>). **Options:** A) keep; B) On Hold with reason that pauses the clock and escalation; C) label only. Recommended A.

**Recorded choice:** Accept B, in [P49.2](./IMPLEMENTATION_PLAN.md#p49-2). Changes SRQ-3/D-59; reason and requester notification required. **Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [ ] A [x] B [ ] C

#### GAP-M16-03 · ENHANCEMENT · Value H · Effort M · Confidence Medium

**What:** A read-only helpdesk performance report: resolution %, on-time %, average days by category/priority/month, assignee workload (toolkit bands are examples), repeat issues by unit/category, monthly volume and closing backlog. **Toolkit source:** [Tools 182, 184, 185, 188, 190, 192](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t182>). **App today:** SRQ-9 counts, average resolution time and rating. **Risks / verify:** P27/D-62 unchanged.

**Recorded choice:** Accept, in [P49.3](./IMPLEMENTATION_PLAN.md#p49-3). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M16-04 · ENHANCEMENT · Value M · Effort S · Confidence High

**What:** Escalation response tracking: responder, response date/days, status `Pending Response, Action Taken, Resolved, Further Escalated` and outcome notes. **Toolkit source:** [Tool 189](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t189>). **App today:** P32 levels, timeline and notifications; no response record.

**Recorded choice:** Accept, in [P49.4](./IMPLEMENTATION_PLAN.md#p49-4). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M16-05 · ENHANCEMENT · Value M · Effort S · Confidence High

**What:** Feedback sub-scores (Resolution Quality, Response Speed, Staff Behaviour, 1–5 each), overall score and follow-up needed/done. **Toolkit source:** [Tool 187](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t187>). **App today:** one 1–5 rating and comment (SRQ-5). **Risks / verify:** keep the meaning of existing ratings.

**Recorded choice:** Accept, in [P49.5](./IMPLEMENTATION_PLAN.md#p49-5). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M16-06 · ENHANCEMENT · Value L · Effort S · Confidence Medium

**What:** Intake source `Walk-in, Phone, WhatsApp, Email, Helpdesk App, Daily Rounds` so admins can log off-app complaints. **Toolkit source:** [Tools 181, 190, 192](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t181>). **App today:** `request.create` allows residents and admins; no source field. **Risks / verify:** a label only; no channel integration.

**Recorded choice:** Accept, in [P49.6](./IMPLEMENTATION_PLAN.md#p49-6). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M16-07 · NEW · Value M · Effort M · Confidence Medium

**What:** A daily common-area check: society-defined points, daily OK/Issue, OK rate and points with most issues; an Issue can create or link a request. **Toolkit source:** [Tool 191](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t191>). **App today:** nothing; P25 patrol is QR checkpoint scanning. **Risks / verify:** inspection only, not a cleaning log (D-20).

**Recorded choice:** Accept, in [P49.7](./IMPLEMENTATION_PLAN.md#p49-7). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M16-08 · ENHANCEMENT · Value M · Effort S · Confidence High

**What:** Pick the assigned vendor from the P24 vendor list (M16→M14 link). **App today:** free-text `assigned_vendor_name/phone` (A-18, SRQ-2). **Risks / verify:** keep free text as the fallback when the vendor module is off.

**Recorded choice:** Accept, in [P49.8](./IMPLEMENTATION_PLAN.md#p49-8). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### M16 coverage

- **Covered (1 tool):** Tool 186 (overdue flag and P32 escalation).

### Batch 2 review notes

- 21 decisions: **4 NEW, 10 ENHANCEMENT and 7 CONFLICT**. Conflicts: M14-05 B, M14-07 B, M15-02 A, M15-03 A, M15-05 C (future Pro backlog), M16-01 B and M16-02 B. No application code, schema, migrations or tests were changed.
- M14-05 B, M14-07 B, M16-01 B and M16-02 B change approved PRD rules; the owning contracts must be updated and approved before implementation.
- Review limits: original M14–M16 workbooks were not opened (Tools 170–172 reference entries are sparse); not every screen or test assertion was traced; no legal or labour-law source was verified.
- Next comparison (at Batch 2 close): M17 repairs/redevelopment → M18 transfer/NOC → M19 tenants/parking/facilities → M23 communication → M24 insurance/legal. M18's requested GAP-M25-10 clearance-scope, pending-action and Billing-off follow-up is now recorded in Batch 3 below; M24 still picks up held Tool 167.

## Batch 3 — Parallel comparisons and M17/M18/M19 decisions

The three read-only comparisons were prepared independently and reconciled for overlap. All **15 new decisions** are accepted for planning: M17's six in [P50](./IMPLEMENTATION_PLAN.md#phase-p50--repairs-and-redevelopment-m17-review), M18's four in [P51](./IMPLEMENTATION_PLAN.md#phase-p51--transfer-and-clearance-additions-m18-review), and M19's five in [P52](./IMPLEMENTATION_PLAN.md#phase-p52--tenant-parking-and-facilities-additions-m19-review). Four are NEW, nine ENHANCEMENT and two CONFLICT. M18-03 and M18-04 use Option B. M19-03 is covered by the earlier M08-04-A/P20 D-52 decision and is not reopened. No implementation is authorized. Toolkit numbers and examples are not product defaults or legal authority.

### M17 — Repairs & Redevelopment (Tools 193–204)

#### GAP-M17-01 · ENHANCEMENT · Confidence High · Tools 193, 194, 197, 204

**What:** Track major repair projects and structural audits, including status, schedule, budget and progress. **App today:** P40.9 plans a repair forecast; assets, vendors, AMC, service requests and expenses are existing partial sources, not a joined project/audit record. **Change needed:** Add project/audit records and progress while preserving those source systems. **Risks / verify:** no duplicate forecast, asset/service history or expense ledger; audit duties/cycles need legal review.

**Recorded choice:** Accept in [P50.1](./IMPLEMENTATION_PLAN.md#p50-1). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M17-02 · NEW · Confidence High · Tools 195–196

**What:** Compare like-for-like contractor quotes and record an advisory scorecard. **App today:** vendor records exist; quote comparison and bidder scoring were not found. **Change needed:** Compare an estimate with up to three quotes and record committee-approved criteria. **Risks / verify:** toolkit weights are examples; scores do not select a contractor or replace committee authority.

**Recorded choice:** Accept in [P50.2](./IMPLEMENTATION_PLAN.md#p50-2). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M17-03 · ENHANCEMENT · Confidence High · Tools 198–199

**What:** Estimate repair funding gaps and optional unit-level levy scenarios. **App today:** P40.9 forecasts; P16/P40 hold related financial sources, but no levy workflow is approved. **Change needed:** Show estimates/scenarios only, with an approved allocation basis. **Risks / verify:** no bill, receivable, collection, receipt, levy authority or work approval; verify any actual levy against the act/bye-laws.

**Recorded choice:** Accept in [P50.3](./IMPLEMENTATION_PLAN.md#p50-3). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M17-04 · NEW · Confidence High · Tools 200–201

**What:** Track redevelopment proposals, developer evidence and offer comparison. **App today:** no redevelopment proposal workflow found. **Change needed:** Track received offers, review stage and decision dates. **Risks / verify:** source-check claims; do not present scores as an endorsement; obtain qualified legal review.

**Recorded choice:** Accept in [P50.4](./IMPLEMENTATION_PLAN.md#p50-4). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M17-05 · NEW · Confidence High · Tools 202–203

**What:** Track restricted redevelopment consent evidence and milestones. **App today:** no redevelopment consent register or timeline found. **Change needed:** Record approved consent evidence and project stages through handover. **Risks / verify:** consent thresholds, eligible members/area, evidence, access and retention need legal review; no toolkit percentage is adopted.

**Recorded choice:** Accept in [P50.5](./IMPLEMENTATION_PLAN.md#p50-5). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M17-06 · ENHANCEMENT · Confidence Medium · Tool 204

**What:** Add a source-linked repair/redevelopment summary for spend, progress, delays and critical open work. **App today:** P27 is an aggregate dashboard, not an M17 project view. **Change needed:** Derive figures from P50 and authoritative P16/P40 sources. **Risks / verify:** no duplicate P27 metric or exposure of member consent/legal documents.

**Recorded choice:** Accept in [P50.6](./IMPLEMENTATION_PLAN.md#p50-6). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### M17 coverage and review limits

- P40.9 and P16/P24/P28/P23 are partial sources; no standalone M17 tool wholly covers the proposed capabilities.
- The original M17 workbook files were not opened. Toolkit formulas, legal thresholds and weights were not independently validated.

### M18 — Transfer & NOC (Tools 205–216)

#### GAP-M18-01 · ENHANCEMENT · Confidence High · Tools 205, 213

**What:** Track owner-transfer applications and milestones. **App today:** P18 covers tenant move-in/move-out, not owner title transfer. **Change needed:** Record case type, parties, unit, stage and milestone dates without claiming that the app transfers legal title.

**Recorded choice:** Accept in [P51.1](./IMPLEMENTATION_PLAN.md#p51-1). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M18-02 · ENHANCEMENT · Confidence High · Tool 214

**What:** Keep case-scoped committee decision and follow-up history. **App today:** tenancy decisions are narrower and do not provide this transfer-case resolution record. **Change needed:** Link decision, conditions and follow-up to the case. **Risks / verify:** do not infer quorum/authority from workbook examples.

**Recorded choice:** Accept in [P51.2](./IMPLEMENTATION_PLAN.md#p51-2). **Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M18-03 · CONFLICT · Confidence High · Tools 207–209

**What:** Decide clearance policy and whether/how it replaces today's dues block. **App today:** verified positive dues block tenancy completion; a failed check blocks for retry; Billing-off tenancy move-out may continue with “Not checked,” not “cleared.” The prior P35.10–12 direction explicitly reserved this policy for M18. **Recorded choice:** Accept B in [P51.3](./IMPLEMENTATION_PLAN.md#p51-3): cover both tenant move-out and owner sale/transfer; keep the earlier party/admin approval roles; only verified money owed can block under the normal check, while the selected conditional route may allow an identified obligation to remain outstanding when the parties agree and society admin approves, subject to the contracts finalized at kickoff; other pending actions do not block by themselves. With Billing off, issue only a “Not checked / conditional” document, never a no-dues claim; failed checks still block for retry. This changes TEN-3/D-50/P35 behavior; contract/legal approval is required before implementation. Handover is not payment, waiver or debt deletion.

**Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [ ] A [x] B [ ] C

#### GAP-M18-04 · CONFLICT · Confidence High · Tools 207–209

**What:** Distinguish an application/request from a certificate actually issued, with a separate issue record. **App today:** issued tenancy PDFs are tied to the existing move-out flow and preserve the statement made at the time. **Recorded choice:** Accept B in [P51.4](./IMPLEMENTATION_PLAN.md#p51-4): add separate issue history for approved transfer/clearance cases; preserve old PDFs and their wording.

**Decision:** [x] Accept [ ] Reject [ ] Defer · Option: [ ] A [x] B

#### M18 coverage and review limits

- Tools 207/208 partly overlap the narrower tenancy NOC flow. Tool 206 transfer-fee calculations are not included without an approved fee policy; Tool 215 heir transfer needs separate legal/member scope; Tools 211–212 checklist contents are not adopted; Tool 216 dashboard waits for defined workflow/targets.
- The original M18 workbook was not opened and no legal interpretation was performed. An NOC is not proof or execution of title transfer.

### M19 — Tenants, Parking & Facilities (Tools 217–228)

#### GAP-M19-01 · ENHANCEMENT · Tools 217, 226

**What:** Add useful tenant details and a move checklist/progress view. **App today:** P18/Core already own occupancy and move status; extra rent/family/contact fields and checklist/deposit-refund reporting are not part of that contract. **Recorded choice:** Accept in [P52.1](./IMPLEMENTATION_PLAN.md#p52-1), linked to the existing records; no duplicate occupancy/deposit ledger.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M19-02 · ENHANCEMENT · Tools 218–219

**What:** Add verification status/date and expanded agreement details. **App today:** police proof is optional/off by default; no full ID copies. **Recorded choice:** Accept in [P52.2](./IMPLEMENTATION_PLAN.md#p52-2), keeping those boundaries. **Risks / verify:** purpose/access/retention and legal claims need review.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M19-03 · CONFLICT · Tools 220–221, 224 — settled earlier; not reopened

Toolkit tenant non-occupancy, parking and facility charges conflict with P20 D-52 and M08-04-A. The existing no-parking-fees decision remains; P15 amenity charges stay distinct. No new choice is collected here.

#### GAP-M19-04 · ENHANCEMENT · Tools 221–222

**What:** Add parking slot condition/status and read-only vacancy/vehicle summaries. **App today:** P20 handles allocation, waitlist, capacity, visitor passes and wrong-parking reports, but no fee-free condition/vehicle-expiry summary. **Recorded choice:** Accept in [P52.3](./IMPLEMENTATION_PLAN.md#p52-3). Vehicle data needs a defined purpose, audience and retention; no charges.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M19-05 · ENHANCEMENT · Tool 223

**What:** Add a distinct amenity calendar/clash view. **App today:** P15 already owns bookings, capacity, confirmation and cancellation. **Recorded choice:** Accept the calendar view only in [P52.4](./IMPLEMENTATION_PLAN.md#p52-4); P15 remains the booking source and its rules do not change. P35.8 optional deposits remain off by default; D-84 now records the proposed receipt/deduction/refund/cancellation/accounting contracts. Coding remains gated separately.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M19-06 · NEW · Tools 227–228

**What:** Add amenity-use/issue records and a source-linked facilities/service report. **App today:** P15 bookings, P28 asset history, P14 AMC, P13 stock and P16 accounts provide separate partial sources. **Recorded choice:** Accept in [P52.5](./IMPLEMENTATION_PLAN.md#p52-5), without duplicating booking, asset, service or accounting records.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### M19 coverage and review limits

- Tool 225's visitor log is covered. Tool 221's slot allocation is covered by P20; Tool 223's core booking is covered by P15.
- Original M19 workbooks, detailed formulas and legal requirements were not checked. Toolkit examples do not establish statutory obligations.

### Batch 3 review notes

- 15 new decisions: **4 NEW, 9 ENHANCEMENT and 2 CONFLICT**. Both M18 conflicts use Option B. M19-03 reuses the already settled M08-04-A/P20 D-52 no-parking-fees boundary.
- M18-03 changes approved clearance behavior and requires TEN-3/D-50/P35 and related product-contract approval. M17 consent/funding and M19 personal/financial-data work remain gated by legal, authority, privacy and accounting review.
- P35.8 optional deposits remain off by default under D-84's proposed contracts. Coding needs a separate go-ahead; accountant review is recommended before real use.
- Review limits: original M17–M19 workbooks were not opened; formulas/legal rules were not validated; no full UI walkthrough or legal review was performed. No app code, schema, migrations or tests were changed.
- **Next comparison (at Batch 3 close):** M23 communication → M24 insurance/legal. M24 also picks up held Tool 167. Batch 4 below has since recorded both.

## Batch 4 — M23 communication and M24 insurance/legal (decided 2026-11-19)

**Method:** Three read-only parallel comparisons (M23; M24 insurance Tools 277–279 plus held Tool 167; M24 legal/dispute Tools 280–288) using the toolkit guide and text reference. Main app claims were spot-checked against migrations and the plan. No original Excel, Word or PDF files were opened.

**App today (verified):** P11 notice board is built and tested with audiences, pinning, optional expiry, archive, attachments and read counts ([notice board migration](../supabase/migrations/20261115110000_notice_board.sql)). P35.13 already plans welcome, warning, complaint-acknowledgement, shutdown and meeting-notice formats. Assets have a warranty end date and a P27 “warranty expiring” figure ([asset migration](../supabase/migrations/20261117110000_asset_foundation.sql)). P16 has an “Insurance & taxes” expense category only. No insurance policy, claim, legal-case, advocate-fee or dispute register exists; P44.2/P44.5 already plan a document index and private notice/hearing log from M04/M20.

### M23 — Notices, Circulars & Communication (Tools 265–276)

4 decisions: **1 NEW, 2 ENHANCEMENT, 1 CONFLICT**, all accepted for planning.

#### GAP-M23-01 · ENHANCEMENT · Value H · Effort M · Tool 265

**What:** Notice-planning fields: prepared by, physical display location, priority, draft/scheduled/posted/removed status and next action date. **App today:** P11 covers audience, pinning, expiry and archive. **Recorded choice:** Accept in [P53.1](./IMPLEMENTATION_PLAN.md#p53-1), reusing P11 fields and mapping statuses onto its lifecycle.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M23-02 · NEW · Value M · Effort M · Tool 272

**What:** Restricted member communication log: date, unit, type, channel, direction, summary, handled by, follow-up date, status and days open. **App today:** nothing found beyond service requests. **Recorded choice:** Accept in [P53.2](./IMPLEMENTATION_PLAN.md#p53-2); link to, not copy, service requests; not proof of delivery; access/retention approval first.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M23-03 · ENHANCEMENT · Value M · Effort S · Tools 266–271, 273–275

**What:** Circular, festival/event announcement and annual newsletter formats. **App today:** P35.13 plans most other letter formats; meeting invitations reuse P23 notices. **Recorded choice:** Accept as an extension of [P35.13](./IMPLEMENTATION_PLAN.md#p35-13); preview/download only, no sending channel.

**Decision:** [x] Accept [ ] Reject [ ] Defer

#### GAP-M23-04 · CONFLICT · Value L · Effort S · Tool 276

**What:** Monthly communication dashboard. The toolkit uses hand-typed monthly totals (notices, circulars, WhatsApp messages, meeting invites, event announcements, emergency alerts, complaints received/resolved, average response) and works out total communications, resolution rate and open complaints. **Options:** A no separate dashboard; B adopt toolkit dashboard; C later summary from records. **Recorded choice:** B, modified by the owner: keep existing dashboards and add a separate admin communication page in [P53.3](./IMPLEMENTATION_PLAN.md#p53-3), with figures counted only from app records; WhatsApp/paper counts omitted until stored; no new P27 metric (D-62 unchanged).

**Decision:** [x] Accept [ ] Reject [ ] Defer

### M24 — Insurance, Legal & Dispute Tracker (Tools 277–288, plus held Tool 167)

9 decisions: **3 NEW, 4 ENHANCEMENT, 2 CONFLICT**, all rejected. Owner reason: “Insurance and legal matters handled outside the app.” Already-accepted P44.2/P44.5 scope from M04/M20 and built asset warranty dates are unchanged.

| ID         | Type        | Tools         | What was offered                                                                                             | Decision                                                   |
| ---------- | ----------- | ------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| GAP-M24-01 | NEW         | 277, 167      | Insurance policy register (cover type, insurer, sum insured, premium, start/expiry, premium paid, days left) | Reject                                                     |
| GAP-M24-02 | ENHANCEMENT | 278, 167      | Renewal status, reminder date, Urgent/Soon/Expired labels, optional estimated renewal premium                | Reject                                                     |
| GAP-M24-03 | NEW         | 279           | Insurance claim tracker (dates, claimed/approved/settled amounts, surveyor, status, days open)               | Reject                                                     |
| GAP-M24-04 | ENHANCEMENT | 280, 281      | Legal case and hearing details added to P44.5                                                                | Reject                                                     |
| GAP-M24-05 | NEW         | 283, 284, 285 | Restricted member/builder dispute register and resolution diary                                              | Reject                                                     |
| GAP-M24-06 | ENHANCEMENT | 286           | Legal-notice direction, reply due/received and next step in P44.5                                            | Reject                                                     |
| GAP-M24-07 | ENHANCEMENT | 287           | Legal-document metadata in P19/P44.2 (related matter, original location, custodian, scanned)                 | Reject                                                     |
| GAP-M24-08 | CONFLICT    | 282           | Advocate fee tracker (A ordinary P16 expenses; B separate tracker; C advocates via P47.7)                    | Reject — current behavior confirmed: ordinary P16 expenses |
| GAP-M24-09 | CONFLICT    | 288           | Legal dashboard with exposure, priority and resolved % (A none; B toolkit; C restricted factual summary)     | Reject — current behavior confirmed: no legal dashboard    |

### Batch 4 review notes

- 13 decisions: **4 NEW, 6 ENHANCEMENT and 3 CONFLICT**; 4 accepted and 9 rejected. Tool 167 is decided with GAP-M24-01/02.
- Review limits: original M23/M24 workbooks and Word templates were not opened; template contents and legal rules were not validated. No app code, schema, migrations or tests were changed.
- **Review complete:** all 22 available housing modules are compared and decided. Totals across the review: 148 decisions — 123 accepted, 11 deferred and 14 rejected. Implementation gates in the plan remain open.

## M04 — Registration, Bye-laws & Governing Documents (Tools 37–48)

**Review status:** All twelve tools were compared at detail level. Seven merged decision cards: **5 NEW, 2 ENHANCEMENT, 0 CONFLICT**. All seven decisions are accepted for planning in P44. Tools 37 and 48 overlap already accepted P35/P43 planning; Tool 47 is accepted as optional planning scope, not assumed current behavior.

### M04 decision shortlist

| Rank | ID         | Item                                                                       | Recommendation                                                                                     | Owner decision |
| ---- | ---------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------- |
| 1    | GAP-M04-06 | Approved society rules and penalties                                       | Accept a source-linked rule-text register only; no penalty amounts or enforcement                  | Accepted       |
| 2    | GAP-M04-03 | Bye-law amendment proposal, meeting decision and Registrar status tracking | Accept verified milestone tracking; M06 and legal authority remain gates                           | Accepted       |
| 3    | GAP-M04-01 | Registration certificates and document expiry/renewal reminders            | Accept source-linked reminders; do not treat reminders as proof of compliance                      | Accepted       |
| 4    | GAP-M04-02 | Governing-document index and clause-level bye-law references               | Accept an index linked to P19 documents, with controlled access and no legal interpretation        | Accepted       |
| 5    | GAP-M04-05 | Registrar correspondence and reply follow-up log                           | Accept a private, admin-managed record; use only dates and references from verified correspondence | Accepted       |
| 6    | GAP-M04-04 | Model bye-law comparison checklist                                         | Plan a manual checklist; block until state/model version and qualified review are confirmed        | Accepted       |
| 7    | GAP-M04-07 | New-society formation checklist                                            | Plan an optional checklist; block until a state-specific source and qualified review are confirmed | Accepted       |

### Built, tested and planned evidence

| Capability                             | Evidence and status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Society profile and setup completeness | Built: Core stores society name, address, city, contact, timezone, currency and unit label; see [DATABASE.md](./DATABASE.md) and [console.ts](../src/core/developer/console.ts). Planned: accepted P35.2–P35.3 already cover broader reference-profile mapping and advisory setup completeness, including registration identity fields. No separate legal-member count, committee-term authority or bye-law source is implemented; legal-member items remain deferred under M02.                                                                                                                                       |
| Document Repository                    | Built: P19 stores society and unit files with titles/descriptions, folders/audiences, versions and archive state; the `document` module is disabled by default. It does not index clauses, custodians, expiry dates or Registrar workflows. Evidence: [document operations](../src/core/document/operations.ts), [validation](../src/core/document/validation.ts), [P19 schema](../supabase/migrations/20261116100000_document_foundation.sql), and [unit](../tests/unit/document.test.ts) / [database tests](../tests/integration/database-document.test.ts) exist. Tests were not run for this documentation review. |
| AMC and meeting records                | Built: P14 owns AMC expiry; P23 records meeting decisions and resolutions. These remain the authoritative sources for their records; a generic register must not duplicate AMC renewals or treat a meeting vote as Registrar approval.                                                                                                                                                                                                                                                                                                                                                                                 |
| Compliance and setup summaries         | Planned, not implemented: P35.3 covers advisory setup completeness; P43.1/P43.4 cover the admin home and a manual, non-certifying obligations register. Tool 48 must not introduce a separate governance-health score.                                                                                                                                                                                                                                                                                                                                                                                                 |
| Society rules and fines                | Built: BIL-4 permits an admin to add a manual fine with amount, reason and date; optional committee approval is off by default. No society-rule register or rule-to-fine authority mapping was found.                                                                                                                                                                                                                                                                                                                                                                                                                  |

### M04 conflicts touching money, legal obligations or member rights

No direct behavior conflict was found. The new rules/penalties proposal (GAP-M04-06) touches money and member rights: today's manual-fine feature does not establish that a house rule or penalty is legally valid. Amendments, model-bye-law comparisons, Registrar correspondence and formation steps also have legal significance. **Verify statutory obligations against the state co-operative act / our bye-laws**, with qualified local advice where needed; toolkit examples are not authority.

### GAP-M04-01 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Track validity and renewal dates for society certificates and other approved documents, without replacing existing module-owned records.

**Why it helps:** Admins could see which registered certificates need attention instead of relying on separate spreadsheets.

**Toolkit source:** [Tools 38 and 45](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t38>). Tool 38 records certificate/registration type, issuing authority, reference number, issue date, valid-until date (blank means perpetual), original custody and scanned-copy status; it derives days to expiry and a validity label. Tool 45 adds document category, responsible person, expiry, renewal lead/action and a renewal-cost field.

**App today:** P19's [Document Repository](./PRD.md) stores private PDF/JPEG/PNG files, title/description, folder audience, versions and archive state; it has no expiry or authority metadata. P14 already owns AMC expiry and renewals. P43.4 plans a manual, non-certifying obligations register, not a document/certificate catalogue.

**Change needed:** Add optional certificate/document expiry metadata linked to the existing P19 record, with an admin reminder and source link. Do not equate an empty expiry field with a verified perpetual certificate unless its source confirms that. Exclude renewal cost, budget alerts and automatic renewal; do not duplicate P14 AMC data or imply that an alert proves compliance.

**Acceptance:** Each reminder points to an authorized document and its verified authority/date; perpetual, unknown and expired states are distinct; disabled or missing source data is not shown as compliant; P14 renewals and P43.4 obligation records are not duplicated.

**Depends on:** P19 document permissions and version history; P14 for AMC records; P43.4/M20 for any statutory obligation interpretation.

**Risks / verify:** A wrong date or “valid” label can cause a missed filing or false assurance. Renewal cost would imply financial planning, which remains outside scope under M13-01.

**Recommendation:** Accept the read-only, source-linked expiry reminders only, with verified dates and no renewal-cost or compliance claim.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M04-02 · ENHANCEMENT · Value H · Effort M · Confidence High

**What:** Make governing documents and specific bye-law references easier to find.

**Why it helps:** An authorized reader can locate the current source document and relevant clause without maintaining a separate file list.

**Toolkit source:** [Tools 39, 41 and 46](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t39>). Tool 39 indexes bye-law number, subject area, heading, summary, page, applicability, status (`Active`, `Amended`, `Repealed`) and last-amended date. Tools 41/46 index document title/category/date/version, storage/custodian, review cycle, physical/digital location, confidentiality and scan status.

**App today:** P19 already has a seeded Bylaws folder, restricted document audiences, titles/descriptions, immutable file versions and audited downloads. It does not have clause-level citations, a governing-document review schedule, physical custody fields or a legal folder index. P35.2's society profile is not a document index.

**Change needed:** Add searchable metadata linked to an existing P19 document/version rather than copying the file. Finalize exact clause/page, subject, document date/version, custodian/location, confidentiality and review-date fields only after purpose and audience are approved. Use only a verified society-held copy; do not auto-fill model text, interpret applicability or treat an index summary as legal advice. Never accept arbitrary storage paths in place of Homeish's private document access.

**Acceptance:** Each entry links to an authorized current P19 version; archived/amended material remains distinguishable; non-authorized readers cannot infer confidential titles or locations; no copied file or second permission system is created.

**Depends on:** P19/D-51 document audiences and private-download audit; P35.2 profile-field mapping; M04/M20 verification for legal-status labels.

**Risks / verify:** Incorrect “active/repealed” labels or summaries could misstate rights. Physical location and confidentiality details need an approved admin-only purpose and access policy.

**Recommendation:** Accept a small, source-linked index; leave legal interpretation and model text out.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M04-03 · NEW · Value H · Effort M · Confidence High

**What:** Record the stages and evidence for a proposed bye-law amendment.

**Why it helps:** A society can see whether a change is only proposed, approved internally, submitted or confirmed by the Registrar.

**Toolkit source:** [Tool 40](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t40>) records bye-law number, proposed change/by/date, committee and General Body decisions, submission and Registrar approval, with derived stage, days elapsed and a health label.

**App today:** P23 records meeting resolutions and outcomes, but no linked bye-law amendment/Registrar-status workflow was found. M05 committee-tool content is missing; do not infer committee authorities from it.

**Change needed:** Track only manually verified milestones and references, keeping the proposed text and supporting records in P19. Separate committee/General Body resolution evidence from a Registrar filing or approval. Derive a neutral stage from recorded facts only; do not calculate legal effectiveness or create approval powers.

**Acceptance:** Every milestone has a source/date and authorized actor; P23 remains authoritative for meeting decisions; a proposed/submitted change is never shown as an effective amendment without verified Registrar evidence and applicable legal review.

**Depends on:** P19 for private records; P23 and the forthcoming M06 decision on meeting records; M04/M20 for legal process and evidence.

**Risks / verify:** Mistaken approval or effective-date labels could affect member rights. **Verify the required approvals, notice and registration steps against the state co-operative act / our bye-laws.**

**Recommendation:** Accept tracking-only records with no automated or implied legal approval.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M04-04 · NEW · Value H · Effort M-L · Confidence Medium

**What:** Compare the society's registered bye-laws with an applicable model-bye-law checklist.

**Why it helps:** An authorized reviewer could organize questions for a qualified adviser instead of relying on an informal spreadsheet.

**Toolkit source:** [Tool 42](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t42>) describes a comparison result and gap-risk level. The text reference does not specify the allowed values, scoring formula or which state/model revision applies.

**App today:** No model-bye-law comparison or gap-risk checklist was found. P19 can store a source document; P43.4 is only a planned manual obligations register and must not become a legal-compliance score.

**Change needed:** Plan a manually completed checklist linked to the society's registered bye-laws and the exact applicable model/source versions. Before implementation, confirm the jurisdiction, authoritative source and qualified reviewer. Do not copy unknown dropdowns/formulas, mark a society compliant/non-compliant automatically, or issue legal advice.

**Acceptance:** Every checklist item cites the applicable source/version and reviewer; no unsupported risk score, deadline or compliance certification appears; the underlying P19 documents remain authoritative.

**Depends on:** Confirmed jurisdiction and authoritative model source; M04/M20 review and qualified local legal advice; P19 document access.

**Risks / verify:** A generic or outdated model may conflict with registered bye-laws or local law. The toolkit's risk labels and examples are not validated legal findings.

**Recommendation:** Accepted for planning as a manual, non-certifying checklist; keep implementation blocked until the jurisdiction, exact model/version and qualified review are confirmed.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M04-05 · NEW · Value M · Effort M · Confidence High

**What:** Keep a private log of correspondence with the Registrar and its recorded reply dates.

**Why it helps:** Admins can track which official letter was received/sent and whether a reply is recorded as pending.

**Toolkit source:** [Tool 43](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t43>) records date, direction (`Inward`, `Outward`), mode, category, subject, reference number, officer/department, reply due date, closure date, status and days open.

**App today:** P19 can store private files, and P35.13 plans supported correspondence templates. No Registrar correspondence register, due-date tracker or external sending/filing flow was found.

**Change needed:** Add an admin-only log with a link to the related P19 file. Treat due dates and closure as manually recorded facts from the notice or verified filing receipt. Do not send letters, file with an authority, infer legal service, or generate statutory deadlines.

**Acceptance:** Each item is society-scoped, admin-only, auditable and linked to its source; pending means only “no reply date recorded,” not a legal status; P35.13 remains a template-only feature.

**Depends on:** P19 private files and audit; P35.13 letter templates; M04/M20 access and retention review.

**Risks / verify:** Registrar letters may contain confidential or personal information. A reply-due field must not be presented as an authoritative deadline unless taken from a verified notice.

**Recommendation:** Accept the private manual log only; keep sending and legal-deadline behavior out.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M04-06 · NEW · Value H · Effort M · Confidence High

**What:** Record society-approved house rules, their approval/effective dates and review status.

**Why it helps:** Residents and administrators could find the version of a society rule that was actually approved.

**Toolkit source:** [Tool 44](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t44>) records rule area/text, who it applies to, approving body, approval/effective dates, a penalty amount, status (`Active`, `Under Review`, `Withdrawn`) and review dates.

**App today:** No house-rule register was found. P19 can hold circulars and bylaws. BIL-4 allows an admin to add a manual fine with amount/reason/date and optional committee approval (off by default), but it does not determine whether a house rule or penalty is lawful or approved.

**Change needed:** Add a reference-only rules register linked to the resolution and source document. Keep rule publication and penalty enforcement separate. Do not calculate, charge, waive or automatically enforce a penalty; any penalty amount or billing integration needs a separate owner decision and M08/M10/M20 review.

**Acceptance:** A rule is visible only after its approved source/body/effective date is verified; withdrawn and superseded records remain distinguishable; residents receive no new charge or enforcement action from a register entry.

**Depends on:** P19 and P23/M06 approval evidence; M04/M20 legal review; separate M08/M10 approval for any financial effect.

**Risks / verify:** Penalties can affect money and member/tenant rights. **Verify authority, limits, notice and appeal rules against the state co-operative act / our bye-laws.** Toolkit example amounts are not adopted.

**Recommendation:** Accept the source-linked register of approved rule text only; defer penalty amounts and enforcement pending separate legal and billing approval.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### GAP-M04-07 · NEW · Value M · Effort M · Confidence Medium

**What:** Provide a checklist to help a newly forming society organize its formal registration steps.

**Why it helps:** A group in the process of forming a society may want one place to track tasks and supporting documents.

**Toolkit source:** [Tool 47](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t47>) describes a roadmap from first meeting to registration with automatic target dates; the text reference does not list the tasks or date formulas.

**App today:** Core lets a developer create a society record and its first admin; this is platform onboarding, not legal incorporation. P35.2/P35.3 plan a profile and advisory completeness view, not a formal formation workflow. No formation checklist was found.

**Change needed:** Keep it as an optional, manually configured project checklist based on an owner-approved, state-specific source. Do not use toolkit sample steps/dates as law, submit filings, assert registration or make the checklist a condition for normal use of an already-existing society.

**Acceptance:** The society's state and legal source are explicit; target dates are manually approved and clearly advisory; completed steps cite evidence; checklist use remains optional and does not change society access or status.

**Depends on:** M04/M20 and qualified local review of the authoritative state-specific source; P35.2 onboarding boundaries.

**Risks / verify:** Formation steps and deadlines differ by state and legal form; unverified automatic target dates could mislead a new society.

**Recommendation:** Accepted for planning as an optional checklist; keep implementation blocked until the state-specific source and qualified review are confirmed.

**Decision:** [x] Accept [ ] Reject [ ] Defer

### M04 covered, partial and previously decided tools

- **Tool 37 — planned overlap:** P35.2/P35.3 already cover a society reference profile and advisory setup-completeness view. P35.2 lists registration number/date/authority, society type, PAN, registered address and other profile fields; do not create a second profile or re-open M25 GAP-M25-02.
- **Tool 48 — planned overlap:** M01 GAP-M01-01/P43.1 plans a source-linked admin home; GAP-M01-04/P43.4 plans a manually sourced, non-certifying obligations register. Do not add a separate governance-health score or make P27 certify compliance.
- **Tool 47 scope:** Core society creation provisions a Homeish record for an organization; it does not mean Homeish currently offers legal incorporation services. The optional checklist is accepted planning scope, not assumed current behavior.
- **No original M04 workbook or guide PDF was opened.** The text reference does not provide Tool 37's input-column list, Tool 42's result/risk values or scoring, or Tool 47's task/date rules. No values or formulas from those sheets are proposed; the related cards are limited or gated accordingly.

### M04 documentation verification

- Read the M04 overview in [TOOLKIT_GUIDE.md](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_GUIDE.md#module-4>) and detailed text-reference entries for Tools 37–48 in [TOOLKIT_TOOL_REFERENCE.md](<../../Cooperative & Housing Society Management Toolkit/TOOLKIT_TOOL_REFERENCE.md#t37>).
- Compared Core society fields and registration flows, P19/D-51 documents and tests, P14 AMC expiry, P23 meeting resolutions, P35.2/P35.3, P35.13, P43.1/P43.4 and the M02 legal-membership deferrals. Searched source and tests for registration numbers, bye-laws, Registrar correspondence, formation, compliance and expiry tracking.
- All 12 tools are accounted for: **7 decision cards (5 NEW, 2 ENHANCEMENT), Tools 37 and 48 overlap planned work; no direct conflict was found.** Legal and financial safeguards do not authorize any application change.
- No application code, schema, migrations or tests were changed. This is documentation-only; application tests were not run.
- **Owner decisions:** GAP-M04-01 through GAP-M04-07 are accepted for planning and recorded in P44 of [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#phase-p44--registration-bye-laws--governing-documents-m04-review). P44.4 and P44.7 remain blocked pending their source and qualified-review gates; no implementation is authorized.
- **Next comparison:** none. Batches 1–4 decisions are recorded; the toolkit comparison is complete (M23 in P53/P35.13; M24 rejected). Legal and implementation gates remain open.
