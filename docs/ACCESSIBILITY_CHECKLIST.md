# Accessibility manual checklist (P10.2)

Automated checks (`tests/e2e/accessibility.spec.ts`) cover WCAG 2.2 AA rules
with axe, colour contrast, reflow at 640px and 320px, and a visible
focus ring on every keyboard stop. They run on the public pages and every
fixture page. They cannot judge whether announcements make sense, so the owner
completes this checklist on real devices before go-live (DESIGN.md Section 14).

Use Beta (`https://beta-homeish.vercel.app`) with the synthetic society on
testdb. Record the device, OS, browser and date for each pass, and log any
failure with its screen, step and what was heard.

Homepage/P18 changes are local-only until an approved release. Use the synthetic local fixtures for preliminary checks, then repeat against beta after authorised rollout. Do not upload real personal proofs during fixture checks.

## Devices

- [ ] Android phone (low-end if available), Chrome, **TalkBack** on.
- [ ] iPhone, Safari, **VoiceOver** on.
- [ ] Guard device (or the Android phone) outdoors in daylight at full and
      half brightness.

## Screen-reader basics (both devices, every screen below)

- [ ] The page title and the single main heading are read on arrival.
- [ ] Swiping moves through content in visual order; nothing is skipped or read
      twice.
- [ ] Every button and link says what it does ("Approve visitor", not
      "Button").
- [ ] Icons that carry meaning are announced; decorative icons are silent.
- [ ] Status chips are read as words ("Pending", "Paid"), not only colours.
- [ ] Form fields read their label, whether they are required, and any help
      text.
- [ ] Submitting a form with an error reads the error and moves to it.
- [ ] Success and progress messages are announced once, without stealing
      focus.
- [ ] Dialogs announce their title; closing returns to the button that opened
      them.
- [ ] Photos read a meaningful description ("Photo of visitor").

## Journeys

| #   | Role            | Journey                                                                                                            | TalkBack | VoiceOver |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------ | -------- | --------- |
| 1   | Anyone          | Sign in with an email one-time code                                                                                | [ ]      | [ ]       |
| 2   | Resident        | Home: read cards and notification count                                                                            | [ ]      | [ ]       |
| 3   | Resident        | Pre-approve a visitor; add, use and remove a frequent visitor                                                      | [ ]      | [ ]       |
| 4   | Resident        | Approve or deny a visitor at the gate (live update announced)                                                      | [ ]      | [ ]       |
| 5   | Resident        | Pre-announce a delivery, then cancel it                                                                            | [ ]      | [ ]       |
| 6   | Resident        | Raise a service request with a photo; upvote a common-area one                                                     | [ ]      | [ ]       |
| 7   | Resident        | Open a bill, read the amount and due date, record a payment                                                        | [ ]      | [ ]       |
| 8   | Resident        | Notifications inbox: open one, mark all read                                                                       | [ ]      | [ ]       |
| 9   | Guard           | Log a walk-in visitor; check in with a gate code                                                                   | [ ]      | [ ]       |
| 10  | Guard           | Log a delivery; see pre-announced deliveries; hand over parcel                                                     | [ ]      | [ ]       |
| 11  | Guard           | Offline banner is announced and says to call the resident                                                          | [ ]      | [ ]       |
| 12  | Admin           | Assign and resolve a service request                                                                               | [ ]      | [ ]       |
| 13  | Admin           | Generate bills, verify a payment, export a CSV                                                                     | [ ]      | [ ]       |
| 14  | Anyone          | Profile: change font preference, copy session ID, sign out                                                         | [ ]      | [ ]       |
| 15  | Anyone          | Error page reads the reference ID                                                                                  | [ ]      | [ ]       |
| 16  | Anyone          | Homepage: understand testing labels, synthetic screenshots and disabled demo; use FAQs and society entry           | [ ]      | [ ]       |
| 17  | Resident/owner  | Create a move, upload then attach proof, recover an error and give owner consent without early access              | [ ]      | [ ]       |
| 18  | Admin           | Confirm a moving decision with a reason where required; complete only after checks; issue and reopen a private NOC | [ ]      | [ ]       |
| 19  | Guard/committee | Filter and page the status-only moving schedule without tenant identity or document controls                       | [ ]      | [ ]       |

## Homepage refresh (H1/H2)

- [ ] Read the committee-first heading, availability limits and screenshot alternatives in a sensible order.
- [ ] Understand that **Try demo** is disabled and **Demo coming soon** is an explanatory note, not a working link.
- [ ] Reach the main content through the skip link; use the section links, utility sign-in and privacy policy.
- [ ] Expand and collapse FAQs with keyboard and both screen readers.
- [ ] At actual 200% browser zoom and enlarged phone text, check for clipped text, overlapping sections or lost controls; repeat at 320px.
- [ ] With reduced motion enabled, section navigation does not animate.
- [ ] Verify image captions still explain the workflow when screenshots do not load.

These are manual checks, not results from an axe run or a simulated viewport. Owner copy/asset approval and hosted rollout are recorded separately in IMPLEMENTATION_PLAN.

## Tenancy (P18)

- [ ] Read the configured unit label, society-local dates/time window and agreement expiry without ambiguity; selected hour, minute and AM/PM values remain visible.
- [ ] Understand upload versus attachment progress, mandatory rental proof, optional/configured police proof and the government-ID prohibition.
- [ ] Use confirmation dialogs entirely by keyboard; hear required reasons, validation failures and reference IDs; verify focus returns to the trigger.
- [ ] Understand that **Scheduled** is not completed and that only confirmed actual completion changes household access.
- [ ] Distinguish positive dues, cleared dues, lookup failure and **Not checked** when Billing is disabled; no failure sounds like clearance.
- [ ] Request a permitted private link, understand its expiry and retry after a denial without disclosing another person's documents.
- [ ] Confirm supported accented names are preserved in the NOC; unsupported scripts show an explicit font-support error without issuing a file or changing saved names.
- [ ] At actual 200% zoom/enlarged phone text, check create, private detail, documents and the status-only schedule; repeat at 320px.
- [ ] On a low-end phone, confirm long forms, file selection/progress and timeline controls remain usable.

## Guard device outdoors

- [ ] Gate code, visitor name and Approve/Deny buttons are readable in direct
      sunlight.
- [ ] Buttons are easy to hit one-handed (56px guard targets).
- [ ] Status colours remain distinguishable; each still has text.

## Text size

- [ ] Phone system font size at its largest: no clipped or overlapping text on
      journeys 2, 4, 7 and 9.
- [ ] Device-default font preference (Profile) applies across screens.

## Sign-off

| Device | OS and browser | Date | Tester | Failures logged |
| ------ | -------------- | ---- | ------ | --------------- |
|        |                |      |        |                 |
