# Accessibility manual checklist (P10.2)

Automated checks (`tests/e2e/accessibility.spec.ts`) cover WCAG 2.2 AA rules
with axe, colour contrast, reflow at 640px and 320px, and a visible
focus ring on every keyboard stop. They run on the public pages and every
fixture page. They cannot judge whether announcements make sense, so the owner
completes this checklist on real devices before go-live (DESIGN.md Section 14).

Use Beta (`https://beta-homeish.vercel.app`) with the synthetic society on
testdb. Record the device, OS, browser and date for each pass, and log any
failure with its screen, step and what was heard.

Homepage/P18–P21 changes are local-only until an approved release. Use the synthetic local fixtures for preliminary checks, then repeat against beta after authorised rollout. Do not upload real personal proofs during fixture checks.

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
| 20  | Resident        | Open a folder and download a document; hear its audience and any error                                             | [ ]      | [ ]       |
| 21  | Resident/guard  | Join a parking waitlist, create a visitor pass, report wrong parking with a photo                                  | [ ]      | [ ]       |
| 22  | Resident/guard  | Raise an SOS (confirm dialog), then acknowledge, update and close it as a responder                                | [ ]      | [ ]       |

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

## Documents, parking and SOS (P19–P21)

Preliminary checks use `/fixtures/document`, `/fixtures/parking` and `/fixtures/sos` with synthetic data.

- [ ] Documents: folder names, audience labels, version numbers and archived states are read as text; the download button names the document and any failure is announced with its reference ID.
- [ ] Parking: slot type, queue position, pass window and report status are read as words; the skip-reason and pass-duration fields read their labels and errors; a reporter outside the matched unit hears no unit number.
- [ ] SOS screens: the **Not a replacement for emergency services** warning and its "Call 112" link are read before the raise action; contact numbers are reachable call links.
- [ ] Raising an SOS asks for confirmation in a dialog that announces its title; focus returns to the trigger; success or the one-open/rate-limit message is announced once.
- [ ] Close reasons are a labelled group; a missing note for False alarm or Other is announced and focused.
- [ ] Alert banner: the heading is announced once when an alert arrives without moving focus; **Respond**, **Seen — stop alert**/**Dismiss** and **Mute/Unmute alert sound** (pressed state announced) are reachable by keyboard and screen reader on every screen.
- [ ] Guard device: the alarm repeats about every 30 seconds; when sound is blocked, **Turn on alert sound** appears; muting stops sound but the banner stays visible; a new alert unmutes; the banner remains usable at 200% zoom and 320px without hiding page content permanently.

## Vendors and purchase approvals (P24)

Preliminary checks use `/fixtures/vendor` with synthetic data; its role (admin, committee, requester), view (workspace, vendor, request) and scenario selectors cover drafts, an unmet quote rule, submitted, approved, rejected, empty lists, Expenses off and every route state.

- [ ] Request status, the quote rule ("2 of 3 quotes", overridden) and approvals ("1 of 2 approvals") are read as words, not colour alone.
- [ ] The rating select reads its label and choices "5 stars" to "1 star"; each rating reads as "4 of 5" with its comment, and the average and count are read as text.
- [ ] Submit, approve, reject, cancel, override, quote removal and document archive ask for confirmation; required reasons announce their errors and move focus to the field; focus returns to the trigger.
- [ ] When the viewer cannot decide a request, the reason is read in place of the actions.
- [ ] Document and quote file uploads announce progress, success and failure; download buttons name the file.
- [ ] Amount, GSTIN, phone and email fields read their labels, hints and errors; the lists and detail screens remain usable at 200% zoom and 320px.

## Guard patrol and incident log (P25)

Preliminary checks use `/fixtures/patrol` with synthetic data; its role (guard, admin, committee) and scenario (ready, empty and every route state) selectors cover the guard screen, the admin screen and the committee view-only screen.

- [ ] Guard: **Scan** names what it does; the camera view has an accessible name; when QR scanning is unsupported or the camera is refused, the message is announced and **Or type the checkpoint code** stays reachable; a recorded checkpoint or an unknown-code error is announced once.
- [ ] Round status, missed checkpoints, severity (Low to Critical) and incident status are read as words with times, not colour alone.
- [ ] The incident form reads category, severity, description, location and photo labels, hints and errors; photo uploads announce progress, success and failure; the follow-up note and resolution fields announce their errors and move focus.
- [ ] **Acknowledge** sits inside its handover note, so the writer, time and text are read before it; acknowledged notes read who acknowledged them and when.
- [ ] Admin: turning a checkpoint or schedule off asks for confirmation and returns focus to the trigger; the schedule form's interval unit and checkpoint choices read their labels; committee hears the **View only** banner and finds no edit controls.
- [ ] QR sheet: each tile reads the checkpoint name and typed code; printing on A4 gives readable codes and names.
- [ ] On a guard phone outdoors and one-handed, scanning, typed-code entry and incident reporting work at 200% zoom and 320px.

## Utility metering (P26)

Preliminary checks use `/fixtures/metering` with synthetic data; its role (resident, guard, admin, committee) and scenario (ready, empty and every route state) selectors cover the resident, guard and admin screens and the committee view-only screen. The automated accessibility spec includes this route.

- [ ] Resident: the reading form reads meter, reading, date, photo and reason labels and hints; the reason is announced as required when the value is lower than the last reading; a missing photo, future date or same-day reading error is announced and focus moves to it; photo upload announces progress, success and failure.
- [ ] Reading status (Waiting for review, Approved, Rejected), charge status (To be billed, Billed, No charge), meter resets and usage flags (Unusually high, No usage) are read as words, never colour alone; a rejection reads the administrator's reason.
- [ ] Guard: meter search and the per-meter quick entry work one-handed at 200% zoom and 320px with 56px targets; "Reading saved." is announced once.
- [ ] Admin: **Approve** and **Reject** sit inside their reading, so meter, unit, values and photo link are read first; reject asks for a reason and returns focus; the monthly usage table has headers; committee hears the **View only** banner and finds no edit controls.

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
