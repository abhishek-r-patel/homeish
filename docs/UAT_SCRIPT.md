# UAT script (P10.7)

The owner runs this script on Beta (`https://beta-homeish.vercel.app`) against
`homeish-testdb` before a module is enabled for a real society. Use synthetic
data only. Record each step as Pass, Fail (with the reference ID or a
screenshot) or Not run.

## Setup

1. **Society.** Create a fresh UAT society with the onboarding script
   (OPERATIONS.md "Society onboarding"): run it once without `--apply` to
   review the plan, then with `--apply`. Enable Visitors, Deliveries, Billing
   and Service Requests.
2. **Accounts.** Use addresses you can read, for example plus-addresses on
   your own inbox (`you+admin@…`, `you+resident1@…`, `you+resident2@…`,
   `you+guard@…`). Never use invented addresses: sign-in sends real email.
3. **Structure.** As admin, add one block with at least three units (for
   example `UAT-101`, `UAT-102`, `UAT-103`).
4. **People.** Register resident 1 in `UAT-101` and resident 2 in `UAT-102`
   with the society code; approve both from People. Add the guard from Gate &
   Guards.
5. Use a separate browser profile (or a private window) per role so sessions
   do not mix.

## Core platform

| #   | Role      | Step                                                       | Expected                                                          |
| --- | --------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| C1  | Developer | Sign in with password and authenticator code; open Health  | Health shows all checks green                                     |
| C2  | Resident  | Register with a wrong society code                         | Clear error; no account linked to the society                     |
| C3  | Admin     | Approve resident 1; reject a third test registration       | Approved user sees Home; rejected user sees the rejection message |
| C4  | Resident  | Household: view members of the unit                        | Only own unit shown                                               |
| C5  | Resident  | Open an admin URL (`/admin/billing`) directly              | No-access page, not data                                          |
| C6  | Any       | Profile: change font preference, copy session ID, sign out | Preference persists after sign-in; sign-out ends the session      |
| C7  | Admin     | Settings: disable Deliveries, then re-enable               | Nav item and Home card disappear and return without layout gaps   |

## Visitors

| #   | Role     | Step                                                                   | Expected                                                          |
| --- | -------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| V1  | Resident | Pre-approve a visitor for today                                        | A six-digit gate code is shown and shareable                      |
| V2  | Guard    | Check in with that gate code                                           | Visitor checked in; resident is notified                          |
| V3  | Guard    | Log a walk-in for `UAT-101` with a photo                               | Resident 1 sees an approval request live, without refreshing      |
| V4  | Resident | Approve the walk-in; repeat with a second walk-in and deny it          | Guard sees Approved / Denied with the time                        |
| V5  | Resident | Save a frequent visitor; pre-approve from the frequent card; remove it | Gate code issued; removed visitor no longer listed                |
| V6  | Guard    | Check the visitor out                                                  | Status Checked out; history shows entry and exit times            |
| V7  | Resident | Try to see visitors of `UAT-102`                                       | Not visible                                                       |
| V8  | Admin    | Visitors dashboard and export                                          | Counts match steps above; CSV opens cleanly in a spreadsheet      |
| V9  | Guard    | Turn on airplane mode and try an action                                | Offline banner tells the guard to call the resident; no data lost |

## Deliveries

| #   | Role     | Step                                                                    | Expected                                                   |
| --- | -------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| D1  | Resident | Pre-announce a delivery for the next two hours                          | Listed as expected; guard sees it on the Deliveries screen |
| D2  | Resident | Pre-announce a window longer than 24 hours                              | Rejected with a clear message                              |
| D3  | Guard    | Log a parcel for `UAT-101` with a photo                                 | Resident 1 is notified; parcel shows Pending response      |
| D3a | Resident | Choose Leave at gate; after the guard logs a second parcel, choose Deny | Guard sees Left at gate / Denied live                      |
| D4  | Guard    | Mark the left-at-gate parcel as collected                               | Status Collected with time; resident history updated       |
| D5  | Resident | Cancel a pre-announcement                                               | Disappears from the guard's list                           |
| D6  | Admin    | Deliveries dashboard                                                    | Counts match                                               |

## Billing

| #   | Role     | Step                                                                    | Expected                                                                 |
| --- | -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| B1  | Admin    | Add a fixed and a per-area charge; set synthetic UPI payment details    | Saved; preview shows the QR and UPI ID                                   |
| B2  | Admin    | Generate bills for the current month; preview first                     | Preview totals match; one bill per unit; regenerating does not duplicate |
| B3  | Resident | Open the bill; download or print it                                     | Amount, due date and charge lines are correct                            |
| B4  | Resident | Record a UPI payment with a reference                                   | Shows Awaiting confirmation                                              |
| B5  | Admin    | Confirm the payment; reject a second test payment with a reason         | Receipt issued for the first; resident sees the rejection reason         |
| B6  | Admin    | Add a fine and a waiver to `UAT-102`                                    | Unit ledger and balance update correctly                                 |
| B7  | Admin    | After the due date (or with the daily job), check late fee and reminder | Late fee applied once; resident gets one overdue notification            |
| B8  | Admin    | Export bills and payments                                               | CSV totals match the screen; no cell starts with `=`, `+`, `-` or `@`    |

## Service requests

| #   | Role       | Step                                              | Expected                                                    |
| --- | ---------- | ------------------------------------------------- | ----------------------------------------------------------- |
| R1  | Resident 1 | Raise a private Plumbing request with a photo     | Request number shown; admin sees it as Open                 |
| R2  | Resident 1 | Raise a common-area request (for example lift)    | Visible to resident 2                                       |
| R3  | Resident 2 | Upvote the common-area request; sort by votes     | Count increases once; cannot vote twice; sort puts it first |
| R4  | Admin      | Assign, comment, then resolve the private request | Resident sees each update and is notified                   |
| R5  | Resident 1 | Reopen or rate the resolved request               | State and rating saved                                      |
| R6  | Resident 2 | Try to open resident 1's private request URL      | Not found / no access                                       |
| R7  | Admin      | Requests dashboard                                | Category counts and averages match                          |

## Notifications, jobs and errors

| #   | Role      | Step                                                                        | Expected                                           |
| --- | --------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| N1  | Resident  | Notifications inbox: open one, then Mark all read                           | Deep link opens the item; unread count clears      |
| N2  | Resident  | Allow push on a supported phone; trigger a visitor approval request         | Push arrives and opens the right screen            |
| N3  | Admin     | Jobs: run a CSV import with one bad row; download the errors CSV            | Good rows imported; bad row listed with the reason |
| N4  | Developer | Health after the 18:30 UTC daily run                                        | Daily job fresh; no new critical errors            |
| N5  | Any       | Open a broken link such as `/requests/00000000-0000-0000-0000-000000000000` | Friendly page with a reference ID                  |

## Sign-off

| Module           | Result | Date | Notes |
| ---------------- | ------ | ---- | ----- |
| Core platform    |        |      |       |
| Visitors         |        |      |       |
| Deliveries       |        |      |       |
| Billing          |        |      |       |
| Service requests |        |      |       |

After sign-off, record the result in IMPLEMENTATION_PLAN.md (P10.7) and tick
the UAT line in DEPLOYMENT.md's go-live checklist.
