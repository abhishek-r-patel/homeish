# Homeish — Design System and UX Specification (DESIGN.md)

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| Product             | Homeish (PRD D-01 approved 2026-11-09)                        |
| Version             | 0.1 (Draft for approval)                                      |
| Date                | 2026-11-09                                                    |
| Source of truth for | Visual design, UX patterns, components, states, accessibility |
| Depends on          | [PRD.md](./PRD.md) (features, roles, screen IDs, states)      |

**Conventions**

- **[DA-nn]** = Design assumption. **[DD-nn]** = Design decision needing your approval (Section 20).
- Screen IDs (S-, D-, A-, G-, R-) and requirement IDs (VIS-, BIL-, LOG-...) are those defined in the PRD.
- Values here are **tokens**. Implementation must reference tokens by name, never raw values. A new value requires a new token in this document first.
- Where this file and the PRD disagree on behavior, the PRD wins; where they disagree on appearance or interaction, this file wins.
- Contrast ratios below are design targets calculated at token-selection time. They must be re-verified in the rendered UI (Section 15).

---

## 1. Visual Direction and Design Principles

### 1.1 Direction: "The Gate Register"

Homeish digitizes the paper visitor register, the notice board and the maintenance receipt book. The look keeps their clear, trustworthy records while using a cool light background, dark ink text, softer corners, stamped status labels, and one confident blue.

| Do                                                                            | Do not                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| Cool light background, ink-dark text, clear dividers and softer corners       | Gradients, glassmorphism, neon, glow, blurred blobs       |
| One brand colour used sparingly for primary actions and selection             | Multi-colour hero sections, decorative illustration packs |
| Stamp-style status labels (text + icon + tint)                                | Colour-only status dots                                   |
| Dense, scannable lists for staff; spacious, single-task screens for residents | Card-in-card-in-card nesting, shadows on everything       |
| Plain language ("Allow", "Deny", "Pay Now")                                   | Jargon, marketing copy inside the product                 |
| Real data and real empty states                                               | Placeholder stats, fake charts, emoji as UI               |

### 1.2 Principles

1. **Task first.** Each screen has one primary job and one primary action. Secondary actions are visibly quieter.
2. **Role-shaped.** Guards get large, fast, low-reading screens. Residents get short, calm flows. Admins get dense, filterable tables. Developers get a clearly different console (Section 12.5).
3. **Gate speed.** Anything on the guard path (VIS-1, VIS-6, DEL-1) must be completable one-handed, in sunlight, on a low-end Android phone.
4. **Never ambiguous status.** Every entity status is shown as text + icon + colour, identically everywhere (Section 4.4).
5. **Money is exact.** Amounts are always tabular, right-aligned in tables, always with currency symbol, never abbreviated or rounded on screen.
6. **Consequences before commitment.** Destructive, financial and gate-override actions state what will happen before they happen.
7. **Modules are invisible when off.** A disabled module leaves no gap, tab, card or link (MOD-2). Layout must reflow with no empty placeholders.
8. **Errors are owned.** Every unexpected error shows a reference ID (LOG-2) and a way to retry or reach support.
9. **Consistency over cleverness.** Reuse a component before creating one. One pattern per problem across all modules.

### 1.3 Brand Voice (UI copy)

- Plain, short, active. Sentence case for headings and labels. Title Case only for primary button labels (e.g., "Pay Now", "Generate Bills").
- Address the user directly ("Your dues", "Allow this visitor?").
- No exclamation marks, no emoji, no humour in errors.
- Dates: `Sat, 9 Nov 2026`. Times: `6:30 PM` (12-hour). Always society timezone; show the zone label only on deadlines/due dates when it differs from the viewer's device zone. **[DA-01]**
- Currency: `₹12,500.00` (Indian digit grouping `₹1,25,000.00`). Minor units never leak into UI (DAT-2).

---

## 2. Color

Light theme only in MVP. **[DD-01]**: dark mode deferred (guards use sunlight; dark mode doubles the QA matrix). Tokens are semantic so a dark theme can be added later without touching components.

### 2.1 Core palette

| Token            | Hex       | Use                                                                               |
| ---------------- | --------- | --------------------------------------------------------------------------------- |
| `ink`            | `#1B1F23` | Primary text, headings                                                            |
| `ink-muted`      | `#59606A` | Secondary text, captions, helper text                                             |
| `ink-disabled`   | `#8A9099` | Disabled text only (not for essential content)                                    |
| `paper`          | `#F5F7FA` | App background                                                                    |
| `surface`        | `#FFFFFF` | Cards, inputs, sheets, table bodies                                               |
| `surface-sunken` | `#EDF1F6` | Table headers, read-only fields, code blocks                                      |
| `rule`           | `#D9E0E8` | Decorative dividers, card outlines                                                |
| `rule-strong`    | `#7A7F86` | Essential control borders (inputs, checkboxes, secondary buttons), 3:1 on surface |
| `brand`          | `#1E4E8C` | Primary buttons, links, selected state, focus accent                              |
| `brand-hover`    | `#183F72` | Hover/pressed brand                                                               |
| `brand-tint`     | `#E6EEF8` | Selected row/option background, info backgrounds                                  |
| `on-brand`       | `#FFFFFF` | Text/icons on `brand`                                                             |
| `focus`          | `#0B5FFF` | Focus ring (2px, 2px offset; distinct from `brand` fills)                         |

### 2.2 Semantic palette

| Token     | Text/Icon | Tint (backgrounds) | Meaning                                   |
| --------- | --------- | ------------------ | ----------------------------------------- |
| `success` | `#1E6B3A` | `#E7F3EA`          | Approved, paid, resolved, active          |
| `warning` | `#8A4B00` | `#FBF0DC`          | Pending attention, expiring, overdue soon |
| `danger`  | `#B42318` | `#FBE9E7`          | Denied, failed, overdue, destructive      |
| `info`    | `#1E4E8C` | `#E6EEF8`          | Neutral information, in progress          |
| `neutral` | `#59606A` | `#E9EDF2`          | Draft, closed, inactive, cancelled        |

### 2.3 Colour rules

- **Colour is never the only signal.** Pair with icon and text label (WCAG 1.4.1).
- Tints are used for backgrounds of chips and banners; text on a tint uses the matching full-strength token.
- Brand colour is reserved for: primary action, links, selection, active navigation item. It is not used for decoration or status.
- Maximum one `brand` filled button per visible view region (Section 6.1).
- Text on `paper`/`surface` uses `ink` or `ink-muted` only. Do not use `ink-disabled` for information the user needs.
- Do not introduce additional hues. Charts (reports, P2) reuse semantic tokens plus `ink-muted`; never rely on hue alone to separate series.
- Developer console accent: `dev-bar` `#1B1F23` (ink) header with `#FFD966` label chip, see Section 12.5.

### 2.4 Target contrast (to verify)

| Pair                                         | Target  |
| -------------------------------------------- | ------- |
| `ink` / `paper`, `ink` / `surface`           | ≥ 12:1  |
| `ink-muted` / `paper`                        | ≥ 4.5:1 |
| `brand` / `surface` and `on-brand` / `brand` | ≥ 7:1   |
| Semantic text / its tint                     | ≥ 4.5:1 |
| `rule-strong` / `surface` (control boundary) | ≥ 3:1   |
| `focus` ring / adjacent surfaces             | ≥ 3:1   |

---

## 3. Typography

### 3.1 Typeface

- **Default families:** Nunito for body text and Quicksand for headings, bundled with the app so browsers do not request fonts from another site. Users may choose these or their device-default font; the preference is saved to their account. The existing `manrope_sora` saved value continues to mean Homeish typography. **[DD-02 — amended 2026-11-20]**
- **Indic scripts (P33, D-66):** locally bundled Noto Sans Devanagari supports Hindi; the variable font and SIL Open Font License 1.1 are in [public/fonts/](../public/fonts/) and [OFL.txt](../public/fonts/OFL.txt). Line-height tokens below accommodate taller glyphs.
- **Numerals:** Enable tabular numerals on all amounts, counts, dates in tables, codes and OTP.
- **Monospace (log viewer, reference IDs, stack traces only):** system monospace stack.

### 3.2 Type scale (mobile / desktop)

| Token          | Mobile | Desktop | Weight | Line height | Use                                            |
| -------------- | ------ | ------- | ------ | ----------- | ---------------------------------------------- |
| `display`      | 28px   | 32px    | 700    | 1.25        | Login/onboarding headline, amount due hero     |
| `title`        | 22px   | 26px    | 600    | 1.3         | Page title (one per page)                      |
| `heading`      | 18px   | 20px    | 600    | 1.35        | Section headings, card titles                  |
| `subheading`   | 16px   | 16px    | 600    | 1.4         | Group labels, table section rows               |
| `body`         | 16px   | 16px    | 400    | 1.5         | Default text, inputs                           |
| `body-strong`  | 16px   | 16px    | 600    | 1.5         | Emphasis inside body                           |
| `caption`      | 14px   | 14px    | 400    | 1.4         | Helper text, metadata, timestamps              |
| `micro`        | 12px   | 12px    | 500    | 1.3         | Chips and badges only (never for instructions) |
| `code`         | 14px   | 14px    | 500    | 1.4         | Codes, IDs, logs                               |
| `guard-action` | 20px   | 20px    | 600    | 1.3         | Guard-console buttons and list titles          |

### 3.3 Rules

- One `title` (single H1) per page. Heading levels follow document structure, not appearance.
- Inputs and body text never below 16px (prevents mobile zoom and aids older residents).
- Line length for paragraphs ≤ 70 characters; forms are constrained to the form width in Section 5.
- No all-caps passages. Chips may use sentence case only, no forced uppercase.
- Letter spacing is default everywhere.
- Truncate with ellipsis only for secondary text (e.g., a long email in a list). Never truncate amounts, names in confirmation dialogs, unit numbers, status text or codes.
- Visitor/pre-approval codes: `display` size, `code` family, tabular, grouped (`482 915`) for readability and verbal reading.

---

## 4. Spacing, Layout and Surface System

### 4.1 Spacing scale (4px base)

`space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 24 · `space-6` 32 · `space-7` 48 · `space-8` 64

| Context               | Token                                       |
| --------------------- | ------------------------------------------- |
| Icon-to-label gap     | `space-2`                                   |
| Label to control      | `space-1`                                   |
| Between form fields   | `space-4`                                   |
| Inside card/list item | `space-4` (mobile) / `space-5` (desktop)    |
| Between sections      | `space-6`                                   |
| Page gutter           | `space-4` mobile · `space-5` tablet/desktop |

### 4.2 Radius, borders, elevation

| Token            | Value              | Use                                              |
| ---------------- | ------------------ | ------------------------------------------------ |
| `radius-sm`      | 6px                | Chips, badges, small buttons                     |
| `radius-md`      | 12px               | Inputs, buttons, cards, tables                   |
| `radius-lg`      | 20px               | Bottom sheets (top corners), modals, home hero   |
| `border`         | 1px `rule`         | Cards, dividers, table lines                     |
| `border-control` | 1px `rule-strong`  | Inputs, checkboxes, secondary buttons            |
| `shadow-overlay` | single soft shadow | Modals, bottom sheets, popovers, toasts **only** |

Cards and sections have a border, **no shadow**. Elevation is reserved for things that float above content.

### 4.3 Touch targets

- Minimum interactive size: **48 × 48px**, with ≥ 8px between adjacent targets.
- Guard console: **56px minimum height** for all primary controls, **64px** for the four home-screen action tiles (Section 12.2).
- Targets are minimums, not fixed sizes: wrapped or enlarged text grows the control; never clip.

### 4.4 Status chip system (single mapping for the whole product)

A chip = icon + sentence-case label + tint background + full-strength text. 6px radius, `micro` size, minimum chip height 24px (chips are display-only unless inside a 48px interactive row).

| Domain status                                                  | Tone                                        | Icon (concept)                                |
| -------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| Visitor: Pending                                               | warning                                     | clock                                         |
| Visitor: Approved                                              | success                                     | check                                         |
| Visitor: Denied                                                | danger                                      | cross                                         |
| Visitor: Expired / No response                                 | neutral                                     | clock-off                                     |
| Visitor: Checked in                                            | info                                        | arrow-in                                      |
| Visitor: Checked out                                           | neutral                                     | arrow-out                                     |
| Visitor: Still inside (overdue, VIS-9)                         | warning                                     | alert                                         |
| Delivery: Pending response                                     | warning                                     | clock                                         |
| Delivery: No response                                          | neutral                                     | clock-off                                     |
| Delivery: Allowed / Left at gate                               | info                                        | check / package                               |
| Delivery: Denied                                               | danger                                      | cross                                         |
| Delivery: Collected / Closed                                   | success / neutral                           | check                                         |
| Bill: Due                                                      | info                                        | receipt                                       |
| Bill: Overdue                                                  | danger                                      | alert                                         |
| Bill: Paid                                                     | success                                     | check                                         |
| Bill: Partially paid                                           | warning                                     | half-circle                                   |
| Vendor bill: Pending / Partly paid / Paid / Due Soon / Overdue | info / warning / success / warning / danger | receipt / half-circle / check / clock / alert |
| Bill / fine: Waived / Cancelled                                | neutral                                     | slash                                         |
| Payment: Awaiting confirmation                                 | warning                                     | clock                                         |
| Payment: Confirmed                                             | success                                     | check                                         |
| Payment: Rejected                                              | danger                                      | cross                                         |
| Request: Open / Assigned / In progress                         | info                                        | dot / user / progress                         |
| Request: Resolved / Closed                                     | success / neutral                           | check                                         |
| Request: Rejected                                              | danger                                      | cross                                         |
| Request: Reopened / Overdue (SLA)                              | warning / danger                            | refresh / alert                               |
| AMC/contract: Upcoming / Active / Due Soon / Urgent / Expired  | info / success / warning / danger           | calendar / check / clock / alert              |
| Stock: Low                                                     | warning                                     | alert                                         |
| Society: Trial / Active / Suspended / Archived                 | info / success / danger / neutral           |                                               |
| Error log: Open / Resolved / Ignored                           | danger / success / neutral                  |                                               |
| Severity: Critical / Error / Warning / Info                    | danger / danger / warning / info            |                                               |

Rule: a status keeps the same tone, icon and wording in lists, details, notifications and exports.

### 4.5 Layout grid and breakpoints

| Breakpoint | Range      | Columns | Notes                                                    |
| ---------- | ---------- | ------- | -------------------------------------------------------- |
| `compact`  | < 600px    | 4       | Phones; single column; bottom navigation                 |
| `medium`   | 600–1023px | 8       | Tablets; single/two columns; admin uses collapsible rail |
| `expanded` | ≥ 1024px   | 12      | Desktop; persistent sidebar for admin and developer      |

Test widths: 320, 360, 390, 430, 768, 1024, 1280, 1440, plus 200% text zoom.

| Container         | Max width               | Used for                                                   |
| ----------------- | ----------------------- | ---------------------------------------------------------- |
| `content-narrow`  | 560px                   | Forms, login/OTP, detail panels, resident pages on desktop |
| `content-default` | 960px                   | Resident dashboards, resident lists                        |
| `content-wide`    | full width within shell | Admin tables, logs, reports                                |

- Resident app on desktop: centred `content-default` column over `paper`; it is mobile-first and not stretched.
- Admin and developer: tables and filter bars use `content-wide`; forms and detail drawers still use `content-narrow`.
- Never produce page-level horizontal scroll at any width. Wide tables scroll inside their own labelled container (Section 6.12).

---

## 5. Application Shell and Navigation

### 5.1 Shells per role

| Role                              | `compact`                                                                     | `medium`                 | `expanded`                         |
| --------------------------------- | ----------------------------------------------------------------------------- | ------------------------ | ---------------------------------- |
| Resident (owner/tenant/family)    | Top bar + **bottom tab bar**                                                  | Top bar + bottom tab bar | Top bar + left rail (labels shown) |
| Guard                             | Top bar (society name, shift info, account) + big-action home; **no tab bar** | Same                     | Same, centred `content-narrow`     |
| Admin / Committee / HK supervisor | Top bar + bottom tab bar (4 + More)                                           | Collapsible rail         | Persistent sidebar (grouped)       |
| Developer                         | Top bar (dark) + drawer menu                                                  | Collapsible rail         | Persistent sidebar (dark)          |

### 5.2 Top bar

Contents left to right: back button or logo, page title (compact) / society name + switcher (expanded), notification bell with unread count, account menu. Height 56px compact, 64px expanded. The society switcher appears only when the user belongs to several societies (CORE-3, S-03).

### 5.3 Navigation rules

- **Navigation items are generated from enabled modules + the user's permissions.** A disabled module or an unpermitted role produces no item, no heading and no gap (PERM-2, MOD-2).
- **Bottom tab bar:** maximum 5 items: up to 4 module/primary destinations + **More**. Each tab shows icon + label (labels are never hidden). Order by frequency of use per role (below). Active tab uses `brand` icon + label with a top indicator bar (non-colour cue).
- **More** opens a full-screen list (not a popover) with all remaining destinations, profile, notifications settings (MVP: none), switch society, sign out.
- **Sidebar (admin/developer):** grouped sections with `subheading` labels; active item has `brand-tint` background, a 3px `brand` left bar and `brand` text. Collapsed rail shows icons with tooltips and accessible names.
- Badges on nav items: count of items needing the user's action (e.g., pending visitor approvals, open requests). Cap display at `99+`. Badge always has an accessible text equivalent ("3 pending approvals").
- **Breadcrumbs** are shown on `expanded` for pages deeper than 2 levels (admin/developer only). On compact, a back button replaces breadcrumbs.
- Every screen beyond a top-level destination has a visible Back (or Cancel for forms). Back returns to the previous list with its filters, sort, page and scroll position preserved.
- Deep links from push notifications open directly on the relevant item, then Back goes to that module's list, not to the previous app state. **[DA-02]**

### 5.4 Default destinations per role (module-dependent)

| Role      | Tab/side order (shown only if module enabled)                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resident  | Home · Visitors · Bills · Requests · More (Deliveries, Staff, Notices, Amenities, Profile under More; Deliveries moves to a tab if Visitors is off) |
| Guard     | Single home screen with action tiles (no navigation); lists reachable from tiles                                                                    |
| Admin     | Dashboard · Visitors · Billing · Requests · More (Deliveries, Residents, Units, Staff, HK, AMC, Notices, Settings)                                  |
| Committee | Dashboard · Billing · Requests · More (read-only views)                                                                                             |
| Developer | Societies · Modules (inside a society) · Error Logs · Audit Logs · Health                                                                           |

---

## 6. Component Library

Each component has: anatomy, states (default, hover, pressed, focus, disabled, loading, error where relevant), and rules. All states use tokens only.

### 6.1 Buttons

| Variant                                   | Style                                             | Use                                                     |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| Primary                                   | `brand` fill, `on-brand` text                     | The single main action of a region                      |
| Secondary                                 | `surface` fill, `border-control`, `ink` text      | Alternatives, Cancel, Back                              |
| Tertiary / text                           | no border, `brand` text, underline on hover/focus | Low-emphasis links as actions                           |
| Destructive                               | `danger` fill, white text                         | Irreversible/negative action; always via confirm dialog |
| Success-affirm (guard/resident decisions) | `success` fill, white text                        | "Allow" in approval pairs only                          |
| Icon-only                                 | 48×48 target, visible icon 24px                   | Toolbars; always has accessible name + tooltip          |

Rules:

- Height 48px (guard 56px). Radius `radius-md`. Label is Title Case, verb-first ("Pay Now", "Record Payment").
- Full width on `compact`; auto width (min 120px) on larger screens. Button groups: primary on the right on desktop; stacked with primary on top on `compact`.
- **Decision pairs** (Allow / Deny for visitor and delivery) are equal size side by side, Deny as secondary-danger outline (danger border + text) and Allow as success fill. Never place the destructive choice where the accidental tap is likely. Pair spacing ≥ 16px.
- **Loading:** label stays, a spinner replaces the leading icon, button is `aria-busy` and disabled for repeat taps (prevents double submission, especially payments and entries). Width must not change.
- **Disabled:** reduced contrast and `aria-disabled`; if the reason is not obvious, show helper text near the button. Never explain via hover alone.
- No more than one Primary per visible region (page, dialog, sheet).

### 6.2 Text input

- Persistent visible label above the control (never placeholder-only). Optional helper text below in `caption` `ink-muted`.
- Required fields are marked "(required)" in the label text; optional fields marked "(optional)" only when most fields in the form are required, otherwise unmarked. **[DA-03]**
- 48px height, `border-control`, `radius-md`, `surface` fill; focus: 2px `focus` ring plus `brand` border; error: `danger` border, error icon, and message below with `danger` text.
- Read-only: `surface-sunken` fill, no border emphasis, not focusable as an input but selectable text.
- Specialised inputs: **Email** (email keyboard, `autocomplete=email`, trimmed and lower-cased before submit), **Code** (single field, one-time-code autofill, numeric keypad, paste, tabular, 6 digits), **Phone** (optional profile field; fixed +91 prefix, numeric keypad, 10 digits), **Amount** (₹ prefix, numeric keypad, tabular, right-aligned in tables), **Search** (leading icon, clear button, 48px).
- Multi-line: min 3 rows, character counter only when a limit exists.
- Help beyond one line goes in helper text or a "Why we ask" disclosure. No hover-only help.

### 6.3 Select, combobox, multi-select

- Native selects on `compact` where the list ≤ 10 options (best mobile UX). For long lists (blocks, units, categories) use a searchable combobox that opens as a **bottom sheet** on `compact` and an anchored popover (same width as trigger) on larger screens.
- Combobox: type-to-filter, arrow keys, Enter, Escape, announces result count politely.
- **Unit picker** is a specialised combobox: block first, then unit; shows "No matching unit" with the CSV-import hint for admins.

### 6.4 Checkbox, radio, switch

- 24px visible control within a 48px row (label is part of the target). Native inputs with custom skin; selected state uses `brand` plus checkmark/dot (shape, not colour only).
- **Option cards** (e.g., delivery preference, purpose): full-width radio rows ≥ 56px, selected = `brand` 2px border + `brand-tint` + check icon.
- **Switch** only for immediate-effect settings (e.g., module toggle), always with a visible "On/Off" text label. Settings that need Save use checkboxes.

### 6.5 Date and time pickers

- Date: native date input on `compact`; custom calendar popover on `expanded`. Show the selected date in text form beside the control.
- Time: 12-hour with AM/PM. Time zone shown as helper text when it matters (dues, visitor windows).
- Hour, minute and AM/PM controls wrap to the available component width, including nested forms. Preserve readable selected values and full-size targets; page-level no-overflow alone is not sufficient.
- Visitor pre-approval window: two paired fields (From, To) with inline validation that To is after From.

### 6.6 File and photo upload

- Large dashed-rule drop area on desktop; "Take Photo" and "Choose File" buttons on `compact`.
- Keep pickers disabled until browser handlers are attached; mark the upload region busy during that preparation.
- Constraints shown up front (JPG/PNG/PDF, max 5 MB, DAT-5). Thumbnails with remove buttons; per-file progress; per-file retry on failure.
- Guard photo capture opens the camera directly; photo is optional unless society setting requires it, then it is validated before submit.

### 6.7 Cards, list items, stat tiles

- **Card:** `surface`, `border`, `radius-md`, `space-4/5` padding. No shadow. No nested cards; use dividers and headings inside.
- **List item (default pattern for entries):** one row = primary line (name / title), secondary line (unit · time), trailing status chip and chevron when tappable. Whole row is the target (≥ 56px). Rows separated by `rule` lines, not cards, to keep lists compact.
- **Stat tile (dashboards):** label (`caption`), value (`display`, tabular), optional delta/context line. Tiles are links when they drill down (visible chevron or underline on hover). No sparkline decoration in MVP.
- **Detail page structure:** header (title + status chip + primary action), key facts as a labelled definition list, then sections (timeline, comments, attachments).

### 6.8 Chips, badges, counts

- Status chip per Section 4.4. Count badge: 20px minimum, `danger`-tint only for "needs your action", otherwise `neutral`.
- Filter chips (applied filters) show the filter text and a remove button (48px target via padding); there is always a "Clear all".

### 6.9 Tabs and segmented controls

- Tabs switch views of the same entity (e.g., Details / History). Segmented control switches the filter of a list (e.g., Today / Upcoming). Max 5 segments; use select beyond that.
- Selected state: `brand` text + 2px underline (tabs) or `brand-tint` fill + border (segmented). Keyboard: arrow keys move, Enter/Space activates (roving tabindex).
- Tabs scroll horizontally inside their own container on `compact` with a visible clipped-edge cue; labels never truncate.

### 6.10 Modal, bottom sheet, confirm dialog, popover

| Component                                  | Use                                         | Rules                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bottom sheet (`compact`) / dialog (larger) | Short forms and pickers                     | Max height 90dvh, internal scroll, grabber handle, close button, Escape closes                                                                                                                         |
| Confirm dialog                             | Destructive, financial and override actions | Title states the action ("Waive ₹2,500 fine?"), body states the consequence and whether it can be undone, buttons: Cancel (secondary, **initial focus**) and the explicit action (destructive/primary) |
| Popover                                    | Filter panels, small menus                  | Anchored to trigger, never wider than viewport minus 16px                                                                                                                                              |

- Focus is trapped, returns to the trigger on close; background is inert; page scroll locked.
- Required-reason actions (waive bill/fine, guard override, reject request, cancel booking) include a mandatory reason field inside the confirm dialog (BIL-4, VIS-4).
- Never stack dialogs. If a dialog needs a sub-choice, use inline steps within it.
- Dialogs never auto-dismiss.

### 6.11 Feedback components

| Component                      | When                                                                              | Behavior                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inline field error**         | Validation                                                                        | Below field; linked via `aria-describedby`; plain language ("Enter a 10-digit mobile number")                                                                 |
| **Error summary**              | Long forms / multi-error submit                                                   | Banner at form top listing errors as links to fields; receives focus once after failed submit                                                                 |
| **Banner**                     | Persistent page-level info (suspended society, module notice, offline, read-only) | Full width within content, icon + text + optional action, not dismissible when it describes a state; dismissible when advisory                                |
| **Toast**                      | Low-risk success only ("Request raised", "Link copied")                           | Bottom (compact) / bottom-left (expanded), 5 seconds, pause on hover/focus, announced politely, has Undo only if undo is real. **Never for errors or money.** |
| **Result screen**              | Money, entry outcomes, long processes                                             | Full-region confirmation with outcome, reference/receipt, next action                                                                                         |
| **Notification (in-app item)** | Notification inbox                                                                | Title, one-line body, relative time, unread indicator (dot + "Unread" text for assistive tech)                                                                |

Important outcomes (payment, approvals, errors) are persistent until acknowledged and are never toasts.

### 6.12 Data table

- Semantic table with headers; numeric columns right-aligned and tabular; first column is the identifier (e.g., unit, name) and is sticky horizontally when scrolled.
- Header: `surface-sunken`, `subheading` weight; sortable headers are buttons with direction icon and `aria-sort`.
- Row hover `brand-tint` at low emphasis; selected rows `brand-tint` plus a visible left marker.
- **Responsive:** on `compact`, rows collapse into stacked list items (primary line, secondary line, chip) with the same reading order. Tables with genuine 2D comparison (ledger, stock transactions) keep table form inside a labelled, keyboard-focusable, internally scrolling region.
- Row actions: one primary row click (open detail); additional actions in an overflow menu (48px) with accessible name "Actions for {row name}".
- Toolbar above table: search, filter button (with applied-count), column chooser (expanded only), export (only if permitted), bulk actions bar when rows selected (count on left, actions on right).
- Sorting and filtering are server-side across the full dataset with an exact total. Never sort only the visible page.
- Never truncate decision-relevant text; wrap it.

### 6.13 Pagination

`Page X of Y · N results` text, First/Previous/Next/Last as icon buttons with accessible names, per-page selector (10/25/50/100, default 25). Always shown on paginated lists, including 1 page / 0 results (disabled controls). Page size and filters persist when navigating back. Infinite scroll is not used.

### 6.14 Filter bar

- Search always visible. Other filters behind a single **Filters** button (with applied count) that opens a popover (expanded) or bottom sheet (compact).
- Date range uses preset segmented choices (Today, 7 days, This month, Custom).
- Applied filters appear as removable chips below the bar. "Clear all" resets and returns to page 1.
- Filter state lives in the URL so it survives refresh and sharing.

### 6.15 Timeline / activity

Vertical list with timestamp, actor, action and optional reason. Used for visitor lifecycle, request history, payment/ledger events, audit entries. Times are relative within 24 hours with absolute time on focus/hover and in text for assistive tech.

### 6.16 Avatar and identity

Circular 40px with initials (no randomised colours; always `neutral` tint) or uploaded photo. Name and unit shown beside it. Guards see the visitor photo at ≥ 96px when available.

### 6.17 Code display (pre-approval, receipts, reference IDs)

- Pre-approval pass: show the QR and its matching `display`-size, grouped, tabular 6-digit code together. Keep **Copy** and **Share** actions (48px), with the validity window and single-use note beneath. The code remains readable if scanning is unavailable.
- Reference IDs and request IDs: `code` style in a `surface-sunken` chip with a Copy button. Copy confirms via toast.

### 6.18 Stepper / progress

- Multi-step processes (bill generation, CSV import): horizontal numbered steps on `expanded`, a "Step X of Y" text on `compact`. Long processes show a progress bar with percent text and a status line; they run as background jobs and remain visible after navigation (see 11.3).

### 6.19 Skeleton and spinner

Defined in Section 9.

### 6.20 Module-specific composites

| Composite               | Used in               | Anatomy                                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor approval card   | R-02 (push deep link) | Visitor photo or placeholder, name, purpose, vehicle, time, large Allow / Deny pair                                                                                                                                                                                                           |
| Guard waiting panel     | G-02                  | Visitor summary, live status chip, elapsed timer, fallback actions after timeout (Call Resident, Allow By Guard)                                                                                                                                                                              |
| Gate action tile        | G-01                  | 64px+ tile, 28px icon, `guard-action` label, pending-count badge                                                                                                                                                                                                                              |
| Amount due hero         | R-04                  | Label, `display` amount, due date chip, primary Pay Now                                                                                                                                                                                                                                       |
| UPI pay panel           | R-04                  | Payee name, UPI ID with Copy, QR, Pay with UPI App button, "last changed" line                                                                                                                                                                                                                |
| Payment review row      | A-07                  | Unit, amount, reference with Copy, screenshot thumbnail, submitted time, Confirm / Reject                                                                                                                                                                                                     |
| Ledger row              | R-04, A-07            | Date, description, debit, credit, running balance (table)                                                                                                                                                                                                                                     |
| Staff profile editor    | R-06, A-13            | Name, phone, role, photo upload, optional ID type + last four, verification flag, linked units and society status                                                                                                                                                                             |
| Staff gate card         | G-01                  | Name, photo, role, destination-unit block warning and one explicit Check in or Check out action; no phone or ID                                                                                                                                                                               |
| Society shift row       | A-13                  | Staff name, date and Present / Absent / Leave; existing dates remain editable                                                                                                                                                                                                                 |
| Module toggle row       | D-03                  | Module name, description, On/Off switch with text, last changed by/at, settings link                                                                                                                                                                                                          |
| Log detail panel        | D-05                  | Header (severity, reference ID, status), context list, stack trace (monospace, wrap + copy), actions (Resolve, Ignore)                                                                                                                                                                        |
| Rating input            | R-05                  | Five 48px star buttons as radio group with text value, labelled "1 of 5" etc.                                                                                                                                                                                                                 |
| Poll ballot             | P22                   | Names the unit being represented; PRIVATE ballots require a review step and never echo choices in the submission confirmation                                                                                                                                                                 |
| Poll results            | P22                   | Reads turnout and permitted totals as text, distinguishes ties/no-votes/no-winner, and keeps private aggregate results separate from the completed voter roster                                                                                                                               |
| Meeting quorum          | P23                   | Shows present / invited and the required percentage as text under a "Quorum met" or "Quorum not met" banner title; it is an indicator and never blocks an action                                                                                                                              |
| Meeting notice banner   | P23                   | Warning banner when the start is sooner than the society's notice days; it states given vs required days and does not block scheduling                                                                                                                                                        |
| Minutes copy failed     | P23                   | After publish, an error banner says the minutes are published but the Documents copy failed, with a Retry button; publishing is never undone                                                                                                                                                  |
| Analytics card          | P27                   | Metric name, module tag, short description, range caption and a "View in" link to the module; trends are a scrollable table with CSS bars, breakdowns a ranked list, today's figures big-number tiles                                                                                         |
| Analytics range         | P27                   | 3 / 6 / 12 months as links with the current one marked; money metrics can switch to "This financial year"; money in ₹ with Indian grouping, missing values "—"                                                                                                                                |
| Event RSVP form         | P30                   | Per flat: Going (with "How many people are coming?") or Not going as a labelled radio group; a live line states "₹X will be added to your flat's bill" or "₹X will be credited back"; full, closed and cancelled states replace the form with text; event list answers name each invited flat |
| Event editor            | P30                   | Contribution type and amount are read-only once published, with a note why; a warning shows when the event has a contribution and `billing` is off; times in IST                                                                                                                              |
| Community item status   | P29                   | Text chips "Awaiting review", "Hidden", "Removed", "Closed" and "Expired" on the author's and admin's views; other residents only ever see approved items; a muted resident sees a banner with the end time and a reason when an action is unavailable                                        |
| Community photos        | P29                   | Up to 3 JPG/PNG photos per post or listing, with help text saying who can see them and "Remove one to add another" at the limit; numbered alt text ("Photo 1 of 3"); links expire after 5 minutes and reload on the next page view                                                            |
| Community mute settings | P29                   | Admin-only controls on the Muted residents page separately allow pending edits, reports and listing renewals while muted; all are off by default and save success or stale-save errors are announced                                                                                          |

---

## 7. Forms

### 7.1 Structure

- Single column everywhere. Group related fields under a `heading` with `space-6` between groups. Use a divider, not a nested card, to separate groups.
- Order fields by the user's mental sequence. Required fields first; optional fields collapsed under "More details" when there are more than 3.
- Forms ≤ 7 fields appear on one screen; longer forms are sectioned with in-page anchor headings (not multi-page wizards) except Bill Generation and CSV Import which are steppers (6.18).
- Field width matches expected content (e.g., amount and pincode are short; descriptions are full-width). Desktop form width ≤ `content-narrow`.

### 7.2 Validation

- Validate on blur for format errors; validate on submit for the entire form. Never show errors for untouched fields while the user is typing.
- Errors are specific and actionable: "Enter a mobile number with 10 digits", not "Invalid input".
- After a failed submit: show the error summary (long forms) and move focus to it once, otherwise to the first invalid field. Preserve everything the user entered.
- Server-side errors that map to a field display on that field; others go to a form-level banner with the reference ID when unexpected.
- Prevent double-submit: submit button loading state plus idempotency on the server (BIL-2, NFR-8).

### 7.3 Specific form guidance

| Form                                 | Guidance                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login / code (S-01, S-02)            | Email field autofocus; code single field with autofill; resend button shows a cooldown in readable text ("Resend in 0:30", announced at start and end only); generic wording "If this email is registered, a code has been sent. Check your inbox and spam folder."; lockout message shows when to try again; "Use a different email" link |
| New visitor (G-02)                   | Fields in this order: unit, visitor name, mobile (optional if society allows), purpose, people count, vehicle (optional), photo (optional). The photo uploads privately and its path is re-verified on submit. Unit picker remembers the last block. Target: complete in < 30 seconds                                                      |
| Pre-approve (R-02)                   | Name, from/to window (defaults: now → end of day, interpreted in the society time zone), optional vehicle; on success show the **result screen** with the QR and matching code, Copy and Share. Guards can scan with a supported device camera or enter the same code manually                                                             |
| New delivery (G-05)                  | Company (option chips with "Other"), type, unit, photo optional                                                                                                                                                                                                                                                                            |
| Service request (R-05)               | Category (option cards/list), location type segmented (My Unit / Common Area), description (required), photos up to 3, priority (Normal/Urgent switch with text label)                                                                                                                                                                     |
| Charge type / bill generation (A-07) | Stepper: 1 Choose period and charges → 2 Select units → 3 Preview totals (table + count + grand total) → 4 Confirm. Idempotency message in step 3 if bills already exist for the period                                                                                                                                                    |
| Record offline payment (A-07)        | Unit, amount, mode (segmented), reference (required for cheque/bank transfer), date; receipt shown on success                                                                                                                                                                                                                              |
| Submit payment details (R-04)        | UPI reference number (required, letters/digits only, duplicate gives "This reference was already submitted"), optional screenshot (JPG/PNG, 5 MB); amount is read-only and shown above                                                                                                                                                     |
| Payment settings (A-07)              | UPI ID (format check with a clear example), payee name, optional QR; confirm dialog before save; after save shows who changed it and when                                                                                                                                                                                                  |
| Waive / fine / cancel                | Always in confirm dialog with required reason                                                                                                                                                                                                                                                                                              |
| CSV import (A-02, A-03)              | Download template → choose file → validate → preview table with per-row status → confirm → results with downloadable error report. No data is written until confirm                                                                                                                                                                        |
| Society config (D-02, D-03)          | Developer-only; autosave is **not** used. Explicit Save with a dirty-state indicator and a "Discard changes" action; save confirms what changed                                                                                                                                                                                            |

### 7.4 Unsaved changes

Leaving a dirty form (Back, nav, close) prompts a confirm dialog: "Leave without saving?" with Cancel (initial focus) and Leave. Forms for guard entry do not prompt (they are short); they preserve their values only for an in-session resume after an error.

---

## 8. Interaction and Motion

### 8.1 Motion principles

- Motion explains change, never decorates. No looping, bouncing, parallax or celebratory effects. No animated numbers for amounts or counts.
- Durations: `motion-fast` 120ms (hover, focus, switch), `motion-base` 200ms (expand/collapse, tab change), `motion-slow` 280ms (sheets, dialogs). Easing: ease-out for entering, ease-in for leaving.
- Animate opacity and transform only. Do not animate layout properties that cause reflow.
- **Reduced motion:** when the user prefers reduced motion, replace transitions with instant state changes (keep focus and state indicators). Skeleton shimmer becomes a static placeholder.

### 8.2 Specific behaviors

| Interaction                         | Behavior                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Press feedback                      | Immediate pressed state (`brand-hover` or tint) within 100ms of touch                                                                                 |
| Real-time status (visitor approval) | Chip and text update in place; polite live-region announcement ("Visitor approved"); a subtle `motion-base` fade on the chip only                     |
| Guard waiting panel                 | Elapsed timer updates each second visually but is announced only at start, at timeout and on resolution                                               |
| Pull-to-refresh                     | Allowed on resident and guard lists; also always provide a visible **Refresh** button (not gesture-only)                                              |
| Swipe actions                       | Not used in MVP (not discoverable, not accessible)                                                                                                    |
| Long-press                          | Not used for any essential action                                                                                                                     |
| Hover                               | Enhances only (tooltip, row highlight); no instruction or action depends on hover                                                                     |
| Copy                                | Copy button → toast "Copied" and button label briefly "Copied" (text, not colour)                                                                     |
| Optimistic updates                  | Not used for money, entry decisions, approvals or role/module changes (wait for server confirmation). Allowed for read-state (mark notification read) |
| Auto-refresh                        | Guard lists and waiting panels refresh via real-time updates; dashboards refresh on focus; show "Updated 10:42 AM" text                               |
| Scroll restoration                  | Preserve scroll and filters when returning to lists                                                                                                   |
| Haptics / sound                     | Guard console only: a short distinct alert when a resident decision arrives, with a global mute setting. **[DD-03 — Approved 2026-11-09]**            |

### 8.3 Notification (push) UX

- Visitor and delivery pushes are **actionable**: title "Visitor at gate: {name}", body "{purpose} · {unit}", with Allow / Deny actions where the platform supports it and a tap that deep-links to the approval card (R-02).
- Pushes never expose more personal data than needed on the lock screen (name + purpose only; no phone, no photo).
- A stale push (already decided or expired) opens the item showing its **final status**, not an error.

---

## 9. Loading, Empty and Error States

These implement PRD Section 12 visually. Every list, detail and form region must define all three.

### 9.1 Loading

| Situation                                          | Pattern                                                                                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First load of a list/detail                        | **Skeleton** matching the final layout (rows for lists, blocks for details, tiles for dashboards). Show after 300ms delay to avoid flicker; minimum display 400ms once shown |
| Refresh with existing data                         | Keep content visible, show a thin top progress indicator and a "Refreshing…" text for assistive tech; do not blank the list                                                  |
| Button action                                      | Button loading state (6.1); the rest of the screen stays interactive unless the action blocks it                                                                             |
| Long process (bill generation, CSV import, export) | Progress bar with percent and status text, runs in the background; user can navigate away and return to see status (11.3)                                                    |
| Payment submission                                 | Submit button loading state, then the **Awaiting confirmation** result screen (never shown as Paid until an admin confirms)                                                  |
| Images                                             | Reserved aspect-ratio box with `surface-sunken` placeholder; no layout shift                                                                                                 |
| Whole app / route                                  | Skeleton shell (top bar + content skeleton); no full-screen spinner                                                                                                          |

Rules: skeletons never contain fake numbers or zero counts; spinners always have an accessible name ("Loading visitors"); a request not complete after 10 seconds adds a "Still working…" line with a Cancel/Retry option.

### 9.2 Empty

Anatomy: small line icon (32px, `ink-muted`), one-line heading, one-sentence explanation, optional primary action if the role may perform it. Unframed (no card border), centred in the region.

| Context                     | Heading                      | Support line                                     | Action              |
| --------------------------- | ---------------------------- | ------------------------------------------------ | ------------------- |
| No visitors today (guard)   | No visitors today            | New entries will appear here.                    | New Visitor         |
| Resident visitor history    | No visitors yet              | Pre-approve a guest to get started.              | Pre-Approve Visitor |
| Dues all paid               | You're all paid up           | No dues right now.                               | View Receipts       |
| No requests                 | No requests yet              | Report a problem with your unit or common areas. | New Request         |
| No notifications            | You're all caught up         |                                                  |                     |
| Filtered results empty      | No results for these filters | Try changing or clearing filters.                | Clear Filters       |
| Admin: no units             | No units yet                 | Add units or import a CSV to begin.              | Import Units        |
| Developer: no errors        | No errors for this filter    |                                                  |                     |
| No permission for an action | Hidden, not empty            |                                                  |                     |

Rules: distinguish **empty** (nothing exists) from **filtered-empty** (exists but filtered) from **no access**. Never show an empty state with a button the user's role cannot use.

### 9.3 Error

| Error type                                     | Pattern                                                                                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field validation                               | Inline (6.2, 7.2)                                                                                                                                                                                    |
| Recoverable request failure (network, timeout) | Inline region error: icon, "Couldn't load {thing}", reason in plain words, **Retry** button; previously loaded content stays visible if present                                                      |
| Unexpected server error (5xx)                  | **Error panel** with heading "Something went wrong", sentence "We've recorded this", **Reference ID** (`code` chip + Copy), Retry, and Back; logged per LOG-1/LOG-2                                  |
| Offline                                        | Persistent banner "No connection. Changes can't be saved." Actions needing the network are disabled with the reason stated; auto-retry on reconnect with a polite announcement                       |
| Session expired                                | Full-page notice "Your session has ended" and **Sign In**; returns the user to the original destination after sign-in                                                                                |
| Permission denied                              | Page: "You don't have access to this", Back to Home. No details about what exists                                                                                                                    |
| Not found (404)                                | "We can't find that page", Back to Home                                                                                                                                                              |
| Module disabled                                | Page: "This feature isn't enabled for your society", contact-admin text; reached only via stale links/bookmarks                                                                                      |
| Society suspended                              | Banner on every page: "{Society} is suspended. You can view but not change data." with contact; actions disabled with reason (PRD D-07)                                                              |
| Payment rejected                               | Status chip **Rejected** with the admin's reason in plain words and a **Resubmit** button; the bill stays Due                                                                                        |
| Payment awaiting confirmation                  | Result screen: "Submitted. Your admin will confirm after checking the bank statement." with the submitted reference, date and a link back to Dues                                                    |
| UPI details missing                            | "Payment details are not set up yet. Please contact your admin." Pay Now is hidden; admin sees a banner with a link to Payment Settings                                                              |
| Gate-critical failure (guard)                  | High-contrast banner: "Can't reach server" with Retry and a persistent instruction to call the resident; **never** silently drops a logged visitor entry; unsent entries remain on screen until sent |
| Bulk/job partial failure                       | Result list: succeeded count, failed rows with reasons, downloadable error report, safe Re-run                                                                                                       |
| Upload failure                                 | Per-file error with Retry/Remove; other files unaffected                                                                                                                                             |

Error copy rules: say what happened, what it means for the user's data, what to do next. No codes or stack traces for non-developers. The reference ID is the only technical detail shown. Errors are never auto-dismissed.

### 9.4 Stale and conflict states

- Decision already made by another approver: show final status with "Already {approved} by {name}".
- Expired pre-approval code: distinct messages for Invalid, Expired, Already used (VIS-6).
- Concurrent edit: "This was changed by someone else. Reload to see the latest." with Reload; form input is preserved to copy.

---

## 10. Responsive Behavior

### 10.1 Principles

Mobile-first. Build for 320px and enhance upward. Every journey is complete on a phone, including admin tasks (generate bills, assign requests, record payments).

### 10.2 Adaptation rules

| Element      | `compact`                                                               | `medium`                             | `expanded`                                         |
| ------------ | ----------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------- |
| Navigation   | Bottom tabs + More                                                      | Bottom tabs or rail                  | Sidebar (admin/dev), left rail (resident)          |
| Page header  | Title only; actions below title as full-width buttons or in an overflow | Title + actions inline               | Title + actions inline; breadcrumbs for deep pages |
| Lists        | Stacked list items                                                      | Stacked or two-column for dashboards | Table (admin) / centred list (resident)            |
| Dashboards   | Single column of stat tiles (2-across for small tiles)                  | 2–3 columns                          | 3–4 columns                                        |
| Forms        | Full width, single column                                               | Constrained to `content-narrow`      | Constrained to `content-narrow`                    |
| Filters      | Bottom sheet                                                            | Popover                              | Popover; applied chips visible                     |
| Detail pages | Single column; sections stacked                                         | Single column                        | Main + side panel (facts/actions) at ≥ 1280px      |
| Dialogs      | Bottom sheet (full width, 90dvh max)                                    | Centred dialog, 560px                | Centred dialog, 560px                              |
| Tables       | Stacked rows; 2D tables scroll inside container                         | Table                                | Table                                              |

### 10.3 Rules

- Sticky bottom action bars (e.g., guard submit, bill pay) respect safe-area insets and the on-screen keyboard; if space is insufficient, revert to inline flow. They never cover the last field, an error, or the focused control.
- Layout reflows at 200% text and 320px width with no loss of content or function and no page-level horizontal scroll.
- Orientation: both supported; guard console works in landscape tablets mounted at the gate.
- Print: bills and receipts print via a dedicated light, ink-saving layout (logo, society, unit, line items, total, payment info). Chrome (nav, buttons) is not printed.
- Low-end devices: no layout depends on blur, shadows or large images; images are size-constrained and lazy-loaded; no animation required to understand state.
- Browsers per PRD NFR-14.

---

## 11. Cross-Cutting UX Patterns

### 11.1 Permissions in the UI

- Authorisation is enforced server-side; the UI additionally **hides** actions the role cannot perform. Do not show disabled controls to explain missing permission, except for the read-only **committee** and **suspended society** states, where controls are visible but disabled with a banner stating why.
- Role/permission changes take effect on next navigation; a user whose access was removed sees the session-expired or no-access state, not a broken screen.

### 11.2 Multi-society

The society switcher (top bar / More) lists societies with the user's role in each. Switching reloads the shell, navigation and data for that society and announces the change ("Now viewing {Society}").

### 11.3 Background jobs and exports

Bill generation, CSV import and exports run as jobs. A "Jobs" indicator (admin top bar, expanded; More menu, compact) lists recent jobs with status chips, progress and results. Completion produces an in-app notification. Results persist until dismissed.

### 11.4 Confirmation levels

| Level          | Use                                                                                                               | Pattern                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| None           | Reversible, low-risk (mark read, filter)                                                                          | Immediate                                                                                                                      |
| Toast          | Low-risk creates (raise request, copy)                                                                            | Toast                                                                                                                          |
| Confirm dialog | Irreversible or consequential (waive, cancel, deactivate resident, publish bills, guard override, record payment) | Dialog with consequence and explicit action label                                                                              |
| Confirm dialog | Developer-only high-impact actions (suspend/archive society, disable module with active users or pending items)   | Standard confirmation states the consequence and explicit action; no text entry is required. **[DD-09 — Approved 2026-11-09]** |

### 11.5 Developer-visible diagnostics

- Every page has a discoverable, non-intrusive way to obtain the current **request/session ID** (More → Help, copyable) so a user can report an issue even without an error screen. **[DD-04 — Approved 2026-11-09]**
- Error panels always show the Reference ID (Section 9.3).

### 11.6 Content and data display

- Names: as entered, never uppercased. Phone numbers: masked (`+91 98••• ••210`) in lists visible to roles not needing the full number; full number where an action needs it (e.g., guard "Call Resident").
- Relative time ≤ 24h ("12 min ago"), absolute afterwards; absolute time always available in text.
- Units are shown as `Block A · 101` consistently. Money as `₹` with grouping and always two decimals in billing contexts.
- Do not show internal IDs except reference IDs, receipt numbers and codes meant for users.

---

## 12. Page-Level Layout Guidance

Screens use PRD IDs. Layouts describe structure and priority, not pixel specs.

### 12.1 Public and Auth (S-01 – S-05)

- Single centred `content-narrow` column on `paper`; logo and product name at top; no marketing content.
- **S-01 Login:** title, email field, Primary "Send Code", short privacy/terms text with links. **S-02 Code verification:** masked email, single code field, Primary "Verify", resend with cooldown, "Use a different email" link, hint to check spam. **S-03 Society picker:** list of societies (name, role) as option rows; remembers last choice. **S-04 Self-registration:** society and unit pickers, name, relationship; on submit a result screen "Waiting for approval" with what happens next. **S-05 Developer login:** visually distinct (dark header, "Developer Console" label), email, password, MFA code step.

### 12.2 Guard (G-01 – G-06)

- **G-01 Gate home:** top bar with society and guard name; four large action tiles in a 2×2 grid (New Visitor, New Delivery, Validate Code, Staff Entry [P2, shown only if enabled]; tiles reflow when modules are disabled, remaining tiles grow to fill the row); beneath: "Waiting for response" list (live), then "Inside now" count linking to G-04. Tiles show pending counts.
- **Shared gate account (when the society chooses it):** the top bar shows a **Handled by** control. The guard picks their name from the admin-maintained guard list when starting a shift, or enters their personal PIN if the society chose PIN mode (4–6 digits, numeric keypad, masked, wrong-attempt lockout message). The current guard's name is shown on every entry screen so it is always clear whose name will be recorded. Switching guard takes one tap.
- **G-02 New visitor:** one screen form (7.3), sticky Primary "Notify Resident" bar. After submit → waiting panel (6.20): status chip, elapsed time, resident unit/name, fallback actions after timeout. Result states: Approved (big success banner, **Let In** primary → marks check-in), Denied (big danger banner, **Done**), No response (warning banner, **Call Resident** and **Allow By Guard** with required reason if enabled).
- **G-03 Validate code:** allow the guard to scan the QR or enter its 6-digit code manually; Primary "Check Code" for manual entry. Show the result with visitor details and **Check In**, or a specific failure message (Invalid / Expired / Already used).
- **G-04 Inside now / today:** segmented (Inside Now, Today, All); list items with name, unit, time in, duration, "Still inside" chip when overdue; trailing **Check Out** button (56px).
- **G-05 Deliveries:** form as 7.3; list of waiting responses and **Uncollected parcels** section with Mark Collected. MVP+ (A-14): a read-only **Expected deliveries** card above the waiting list shows unit, platform and time window of resident pre-announcements.
- Guard UI uses `guard-action` text and 56–64px targets, high-contrast status banners with large icons, minimal reading, and never relies on small text. Pending-count badges and live updates are central.
- **G-06 Staff entry (P12):** select a destination unit, find linked domestic staff or enter a staff code, then use an explicit Check in / Check out action. Show the unit-only or society-wide blocked warning without exposing phone or ID details. Keep entry as the primary action and targets at least 56px.

### 12.3 Resident (R-01 – R-08)

- **R-01 Home:** greeting line (name, unit), then an **Action needed** region (pending visitor/delivery approvals, amount due) only if non-empty, then module shortcuts (large icon buttons, max 2 columns on `compact`) generated from enabled modules, then recent activity. Dues hero appears first when `billing` is enabled and there are dues. The amount is the exact total of open bills across the resident's active units, not a limited bill page; a submitted payment is not deducted before confirmation. Visitor and delivery actions appear only for the resident's approver units while the response is still open. The latest five activity items are the most recently changed visitor and delivery entries for the household, household bills, and service requests the resident created, with module labels and current status. Include only enabled modules and the active society, even for people who also have a staff role. Show a clear no-unit state rather than suggesting an unknown balance is paid. **[Option C — approved for implementation 2026-11-20]**
- **R-02 Visitors:** segmented (Today, Upcoming, History); primary action "Pre-Approve Visitor" (floating on compact is **not** used; button sits in the page header/top of the list). Approval deep link opens the Visitor approval card: Allow/Deny pair at the bottom within thumb reach. MVP+ (A-10): a **Frequent visitors** card saves a name (and optional vehicle) per unit; each saved visitor has a one-step **Pre-approve** form (from/until) and a **Remove** button with the visitor's name in its accessible label.
- **R-03 Deliveries:** list with response buttons on pending items; **Delivery preference** setting shown as option cards on a settings sub-page. MVP+ (A-14): an **Expected deliveries** card lets a resident pick unit, platform and window (society timezone shown as help text) and lists upcoming announcements with **Cancel**.
- **R-04 Dues:** Amount due hero → Pay Now (Primary) → bills list (Due, Overdue, Paid chips) → ledger and receipts under tabs (Bills / Ledger / Receipts). Bill detail shows line items as a definition list with a total row, due date, status and PDF download. **UPI payment screen** (opened by Pay Now): exact amount; society payee name and UPI ID with a Copy button; QR code; "Pay with UPI App" button on phones; a visible line "UPI details last changed on {date}"; then a short form for the UPI reference number (required) and an optional screenshot, with Primary "Submit Payment Details". After submitting, a result screen shows Awaiting confirmation. Rejected submissions show the admin's reason with Resubmit.
- **R-05 Requests:** list (status chips, category, last update) with "New Request" at top; detail shows summary, status timeline, comment thread (chat-like but left-aligned list, newest at bottom), attachments, and the rating/reopen prompt after resolution. Show the comment composer only to the requester, admin or assignee; other residents viewing a common-area request can read the thread but cannot comment. MVP+ (D-17): common-area requests show an upvote count and a toggle button (**Upvote** / **Remove upvote**, `aria-pressed`) on the list and detail; voting is hidden once a request is closed or rejected.
- **Notices (P11):** the resident board lists pinned notices first. Each `NoticeItem` shows the title, a two-line body preview, the author and time, and chips for **Pinned**, **Edited** and **New** (unread). A pinned notice has a brand-coloured border. Opening a notice shows the full body, an attachment link and the expiry, and records the read. Managers use `/admin/notices` with Current and Archive tabs (P53 adds Planned; Section 12.21), where each item also shows the audience and "Read by N". The detail page shows "Read by X of Y", Edit, Pin/Unpin and Withdraw (with confirmation). The compose form has the title, body, audience radios (all, chosen blocks, owners), the DatePicker for an optional expiry with **Remove expiry**, an optional attachment and, when creating, **Pin to the top as important**. Withdrawn and expired notices show **Withdrawn** or **Expired** chips in the archive.
- **R-08 Household:** members list with relationship, approver toggle (switch with text), and Invite action (owner/primary only).

### 12.4 Admin and Committee (A-01 – A-12)

- **A-01 Dashboard:** stat tiles (only for enabled modules) in a grid: Visitors today, Still inside, Open requests, Overdue requests, Collected this month, Outstanding; below, two columns on `expanded`: "Needs attention" list (overdue requests, defaulters, expiring AMCs, low stock) and "Recent activity". Tiles are links to pre-filtered lists. No decorative charts in MVP.
- **List pages (A-03, A-05–A-08, etc.):** page header (title, primary action, secondary actions in overflow), toolbar (search, Filters, Export if permitted), table (6.12), pagination (6.13).
- **A-07 Billing:** page uses tabs: Bills, Charge Types, Payments (with a **Review queue** of UPI submissions showing reference, amount, screenshot and Confirm / Reject with a required reason; submissions waiting beyond the alert days are flagged), Fines, Reports, Payment Settings (UPI ID, payee name, QR image; saving needs a confirm dialog stating that admins and committee will be notified). Bill generation is a stepper opened from the Bills tab (7.3). Unit ledger opens in a side panel (`expanded`) or full page (`compact`). Record Payment and Add Fine open in a dialog/sheet.
  - P7A exposes only Charge Types and Payment Settings, with a read-only summary of developer-managed billing rules. Unimplemented bill/payment/report tabs and resident payment actions stay hidden. QR upload failures must be retried or removed before saving; abandoned uploads can be removed explicitly. Payment-detail saves require a focused confirmation showing the proposed UPI ID and payee, retain entered values on failure, and show one persistent outcome after success.
  - P37: Charge Types shows the occupancy rule and asks for a base and rate only for Percentage of Maintenance. The bill stepper lists omitted lines with reasons and tells admins when a move-in date must be confirmed before billing. Estimate is a read-only tab for admins and committee with area, occupancy and optional custom amounts; show a clearly marked estimate and list exclusions separately. Reports adds payment-mode, wing and bill-status aggregates and labels unapplied credit with its current as-of date. Use the existing loading, empty, error, permission and export patterns.
- **A-08 Requests:** table with status, category, unit, assignee, SLA due (overdue highlighted with danger chip), detail with assign control (select + "Assign" Primary), status change segmented control, internal comment thread. MVP+ (D-17): a **Sort** select (Overdue first, then newest / Most upvoted) and an upvote count caption on common-area rows.
- **Settings pages:** two-column on `expanded` (section nav left, form right); single column on compact.
- **Language availability (P33, D-67):** show the Hindi control in Society settings only after the developer enables Language Support. Admins can change it; committee members see a read-only status. English is always available. If either the module or society setting is off, signed-in society screens use English and saved preferences remain unchanged. When the module is off, tell admins to ask the platform developer to enable it.
- Committee: same layouts, with action controls absent (read-only) and a persistent "Read-only access" banner where the role has partial write.

### 12.5 Developer Console (D-01 – D-07)

- Distinct shell: `dev-bar` dark top bar with a "Developer Console" label chip (`#FFD966` background, ink text), so it is never confused with a society's admin view. Selected society is always shown in the bar with its status chip.
- **D-01 Societies:** table (name, city, status chip, plan, enabled-module count, last error time). Primary action "Create Society".
- **D-03 Modules (Society Config):** list of module toggle rows (6.20), grouped "Core (always on)" and "Modules". Each row: name, one-line description, switch with On/Off text, last changed by/at, "Settings" link when the module has settings. Changing a switch opens a confirm dialog stating the effect ("Residents and guards will stop seeing Visitors immediately. Data is kept."); active users or pending items do not change the standard confirmation pattern (11.4). Save is per toggle, not batched.
- **D-05 Error Log Viewer:** filter bar (society, module, severity, status, date range, user, text) and a **reference ID lookup** field prominently at top; table (time, severity chip, society, module, route, message, status) with monospace message; detail opens as a side panel (`expanded`) or page (`compact`) per 6.20; actions Resolve / Ignore with optional note; bulk resolve for same-message groups is out of MVP.
- **D-06 Audit Logs:** same pattern, columns: time, society, actor, action, entity, summary; before/after values in the detail as a two-column diff list.
- **D-07 Health:** stat tiles (errors last 24h by severity, top 5 failing routes, society error counts) linking to pre-filtered D-05.

### 12.6 Cross-module pages

- **Notification inbox (S-11):** list items grouped Today / Earlier; unread indicator dot plus visible text for assistive tech; tapping opens the deep link and marks read; "Mark all read" in header.
- **Profile (S-12):** read-only facts (name, mobile, society, role, unit) and editable name/photo, font preference (Homeish fonts or device default) and account language (English or Hindi); sign out at the bottom; "Help and support" with copyable session ID (11.5).
- **Error / no-access / module-disabled (S-13):** full-region states per 9.3.

### 12.7 Staff management (P12)

- **R-06 My staff:** unit-linked staff, pending registration state, same-month entry/exit history and an explicitly confirmed unit-only block for today. Registration asks for a photo, name, phone, role and optional ID type/last four; it never asks for a full ID document.
- **A-13 Staff:** add/edit staff, assign domestic staff to units, block profiles society-wide, review pending unit links (including duplicate matches), configure the default-on approval requirement and record or correct one society-staff shift status per date.
- The guard screen is deliberately minimal: staff name, portrait, role and access warning only. Avoid showing contact or ID data in guard cards and action responses.
- **Employment and notes (P48, D-68):** society-staff edit forms add an **Employment** fieldset (department, designation, type, joining date, weekly off, status; exit date appears and is required only for **Left**). Lists show **On notice** and **Left** as word chips; Left also shows the blocked state. A society-staff detail panel adds **Performance notes**, newest first, with category, rating as text ("4 out of 5"), follow-up date and Open/Closed. Admins add, edit their own and delete with confirmation; committee members see the same panels under a single page-level **View only** banner, with phone and job role but no photo or ID details. Domestic staff show no employment or notes controls.

### 12.8 Housekeeping inventory, AMC, amenities and tenancy (P13–P15, P18)

- Inventory cards show exact current/minimum stock, low-stock state, append-only entry controls and dated reports. Admin/supervisor controls include optional receipt costs; committee views are read-only. Corrections are signed adjustments, never edits.
- AMC cards show expiry state, private contract details, linked renewals and visit history. Admin corrections are versioned/audited; committee controls are absent. Documents use short-lived private links. Service-request detail gives residents only an asset label.
- Amenity definitions use repeatable weekday/time fieldsets and exact fee inputs. The date picker shows exclusive slots, the 24-hour lead and guest limit. Each booking explicitly acknowledges current rules. Household booking cards retain original time, fee and accepted rules after schedule edits. Administrator cancellation asks for a reason and confirmation; any fee receives a full ledger credit.
- Navigation comes from current membership roles and enabled modules. Read-only committee shells omit write permissions. Edit controls remount when their optimistic version changes; booking acknowledgement resets when the date, rules version or slot changes.
- Tenancy (P18) uses the existing role shells: resident/owner requests and private detail, administrator/committee schedule and administrator private detail, and a status-only guard schedule. Lists use shared responsive tables, status filters and exact-total pagination. Committee and guard views load no tenant selectors or private details. Disabled, denied, suspended/read-only, loading, empty, filtered-empty and error states remain distinct.
- Move forms choose an existing tenant/invitation, configured unit label, society-local future window, agreement expiry and optional existing amenity booking. Proofs are private, immutable PDF/JPG/PNG up to 5 MiB; rental agreement is mandatory, police proof only when enabled, and government ID copies are prohibited. The detail page separates owner consent, scheduling approval and confirmed actual completion; access changes only on completion. Consequential decisions require confirmation, rejection/cancellation requires a reason, dues states never describe disabled Billing as cleared, and issued NOCs and immutable history remain available to authorised readers.
- Proof controls show upload and attachment as separate states, retain recoverable errors and reference IDs, allow retry/removal before attachment, and ignore cancelled or superseded upload results. Private links are requested on demand and removed after their returned lifetime, never embedded permanently in list data.
- Development-only fixtures exercise these controls with synthetic in-memory state. Tenancy injects all actions and keeps default file transport in memory; automated tests explicitly opt into intercepted HTTP and block unmatched hosted requests or real Server Actions. Browser checks cover 320/390/768/1280-pixel reflow, accessibility, lost-response retries, exact pagination, stale-proof recovery, consent/completion separation, dues/NOC failures, preserved AMC history and amenity fee/rules/time snapshots.

### 12.9 Documents, parking and emergency SOS (P19–P21)

- **Documents (P19):** residents open `/documents` to browse folders they may see and their unit's documents, including read-only tenancy NOCs when Tenancy is on. Each download is requested on demand, audited and opened through a short-lived link. Residents see only the current version. Admins use `/admin/documents` to add, rename and archive folders, set each folder's audience (all residents, owners only, committee and admins), publish folder or unit documents (all occupants or owners only), add versions and archive or restore documents and versions; committee members get the same view read-only with version history. Files are PDF/JPG/PNG up to 5 MB; nothing is deleted.
- **Parking (P20):** residents see allocated slots, linked directory vehicles, their waitlist position, visitor passes and wrong-parking reports at `/parking`. Vehicle links and passes appear only when Directory or Visitor is enabled. Admins manage slots, allocate in queue order (skipping requires a written reason), end allocations, resolve reports and set photo retention at `/admin/parking`; committee is read-only. Guards search a slot or vehicle number, see upcoming visitor passes and report wrong parking with an optional photo at `/guard/parking`. A reporter outside the matched unit never sees which unit matched.
- **Emergency SOS (P21):** `/sos` (labelled "Emergency" for residents), `/admin/sos` and `/guard/sos`. Every SOS screen starts with a warning banner titled **Not a replacement for emergency services** and a "Call 112" link, followed by the society's emergency contacts as call links. Raising is one large action with a category choice, the unit attached automatically and an optional short note, confirmed in a dialog. The raiser can cancel before acknowledgement. Responders acknowledge, post timestamped updates and close with a reason (a note is required for False alarm and Other). Read-only societies say to call an emergency number instead.
- **SOS alert banner:** a sticky red banner at the top of every app-shell screen while an alert addressed to the user is open, announced through a `role="alert"` heading. Each alert shows its title, status ("Waiting for a responder" or "A responder is on it"), time and note, with a visible **Respond** link for responders and **Seen — stop alert** (responders) or **Dismiss** (residents) buttons. Guard devices repeat a short alarm every 30 seconds with a visible **Mute/Unmute alert sound** toggle; if the browser blocks sound a **Turn on alert sound** button appears, and devices without audio show "Keep this screen in view". Sound is never the only signal.
- Development-only fixtures at `/fixtures/document`, `/fixtures/parking` and `/fixtures/sos` use synthetic in-memory data for browser and accessibility checks.

### 12.10 Vendors and purchase approvals (P24)

- **Workspace:** `/admin/vendors` (admins and committee; residents and guards never see it) lists purchase requests first, each with a status chip (Draft, Submitted, Approved, Rejected, Cancelled), the amount and the quote rule status such as "2 of 3 quotes", then a "New purchase request" form (title, description, estimated amount in rupees, optional category). The vendor list shows category, active state and the average rating with its count. Admins also see "Add a vendor" (name, category, contact person, phone, email, optional GSTIN checked against the Indian format, notes) and an "Approval settings" form for the quote threshold, quotes needed at or above it and approvals required (0–5); committee members see neither.
- **Vendor detail** (`/admin/vendors/[vendorId]`): contact details, an edit form and Active/Inactive toggle for admins, private documents (PDF/JPG/PNG up to 5 MB, opened through an audited short-lived link), ratings with the average, count and each comment, a 1–5 star form that updates the viewer's own rating, and "Quotes from this vendor".
- **Request detail** (`/admin/vendors/requests/[requestId]`): the quote rule panel says whether the rule is met ("1 of 3 quotes", "Quote rule overridden" with the reason) and offers admins an override form with a required reason. Changing the estimate, quotes or selection clears an override, and the panel shows the rule as unmet again. Drafts let the requester or an admin edit, add or remove quotes (vendor, amount, note, optional private file), select one quote, submit and cancel. Submitted requests lock their quotes and show approvals ("1 of 2 approvals"), **Approve** and **Reject** (a reason is required). When the viewer raised, submitted or overrode the request, the actions are replaced by the reason they cannot decide it; with 0 approvals required the panel says a different administrator must approve. Approved requests show an expense draft card (created, or the skip reason with **Retry the expense draft** for admins), and every request shows its history.
- Route states: loading skeleton, error with retry, module disabled, access denied and not found. Development-only fixture `/fixtures/vendor` covers each role, screen and scenario with synthetic in-memory data.

### 12.11 Guard patrol and incident log (P25)

- **Guard (`/guard/patrol`, phone-first, 56px targets):** sections in order are **Current round** (each due round with its finish time and the checkpoints still to scan; "No round is due right now" or, without schedules, "No patrol rounds are scheduled" while scanning still works), **Scan a checkpoint**, **Recent scans** (all guards, last 24 hours, "You" for the viewer), **Report an incident**, **Your recent incidents** and **Shift handover**. Guards never see checkpoint codes, schedule management, other guards' incidents or settings.
- **Scanning:** the camera starts only when the guard taps **Scan** and stops with **Stop camera** or after a successful read. When `BarcodeDetector` is unsupported or the camera is refused, a message says so and points to **Or type the checkpoint code**, which is always visible (six characters, case and spaces ignored). Success names the checkpoint; an unknown or inactive code says to check the code; a repeat scan in the same round is accepted without warning.
- **Incident form:** category, severity (Low, Medium, High, Critical, always shown as words), description, optional location and up to 3 JPG/PNG photos (5 MB each) with help text saying who can see them and when they are deleted. Saving High or Critical alerts administrators at once. Incidents show status chips (Open, Closed), and closed ones show the resolution.
- **Handover:** a note form and notes from the last 7 days with writer and time; another guard sees **Acknowledge** on notes that are not yet acknowledged, and acknowledged notes show who acknowledged them and when.
- **Admin (`/admin/patrol`):** **Missed checkpoints** first (checkpoint, schedule, round window and deadline; "No missed checkpoints." or a prompt to add a schedule), then **Rounds in progress**, **Incidents** (open first; photos through short-lived links, follow-up notes, **Add note** and **Close incident** with a required resolution), **Checkpoints** (name, location note, typed code in monospace, Active/Inactive, edit and a confirmed turn-off), **Schedules** (name, shift start and end, "a round every" N minutes or hours, grace minutes, checkpoint multi-select, Active/Inactive), **Recent scans**, **Shift handover notes** and **Photo retention** (30–365 days). Committee members see the same page with a **View only** banner and no forms or buttons.
- **QR sheet (`/admin/patrol/print`, admin only):** an A4 print layout of active checkpoints, one QR code (`homeish-patrol:<code>`, generated locally with `qrcode`) per tile with the checkpoint name and the typed code underneath; a **Print checkpoint sheet** button and the page controls are hidden when printing, and tiles never split across pages. With no active checkpoints it says there is nothing to print.
- Route states: loading skeleton, error with retry, module disabled and access denied. Development-only fixture `/fixtures/patrol` covers the guard, admin and committee views in ready, empty and each route state with synthetic in-memory data.

### 12.12 Utility metering (P26)

- **Resident (`/metering`):** **My meters** (each of the user's units' active meters with type, label, last approved reading and date, and "Waiting for review" when a reading is pending), **Send a reading** (meter, reading with up to 3 decimals, date defaulting to today, never in the future and after the last approved reading's day, a required JPG/PNG meter photo up to 5 MB (an upload older than 24 hours must be taken again), and a reason field that becomes required when the value is lower than the last reading, for example meter replaced), **Waiting for review**, **Reading history** (approved readings with consumption, "meter reset" with the reason for a lower reading, the billed amount with a **See your bills** link when billed, and "Not accepted" with the administrator's reason) and **Current rates**. When Billing is off a banner says usage is not billed right now. Without a linked unit the page shows "No unit linked to you yet".
- **Guard (`/guard/metering`, phone-first, 56px targets):** **Find a meter** by unit, label or serial, then **Meters** with the last reading and a quick entry form per meter (reading, date, optional photo, reason when lower); success says "Reading saved." and the guard's own **Recent readings** follow. Guards never see rates, charges or residents' photos.
- **Admin (`/admin/metering`):** **Readings to review** first (meter, unit, submitted value against the previous reading, the photo through a short-lived link, the resident's reason, **Approve** and **Reject** with a required reason), then **Record a reading**, **Meters** (add or edit type, unit or common area, label, serial, initial reading and Active/Inactive; type, scope and unit are fixed after creation), **Rates** (rupees per kWh, kL or SCM per type with recent history; changes apply to readings not yet billed), **Utility billing** (waiting-to-bill count with how many need a rate, billed count and total, no-charge count, last billed time, and the manual catch-up **Add usage to bills** with a bill date, explaining that monthly bill generation already adds a separate utility bill per unit; a "Billing is turned off" banner when Billing is disabled), **Usage by month** (last 6 months per meter with flags **Unusually high**, more than twice the previous 3-month average, and **No usage**, an occupied unit's meter that used nothing) and **Recent readings**. Committee members see the same page with a **View only** banner and no forms or buttons.
- Statuses are always words (Waiting for review, Approved, Rejected; To be billed, Billed, No charge), never colour alone. Route states: loading skeleton, error with retry, module disabled and access denied. Development-only fixture `/fixtures/metering` covers the resident, guard, admin and committee views in ready, empty and each route state with synthetic in-memory data.

### 12.13 Asset register (P28)

- **Workspace (`/admin/assets`, admin and committee):** **Asset Register** lists assets with category, location, status (Active, Under repair, Retired, always words) and the warranty state ("Under warranty until …", "Warranty ends soon, on …", "Warranty ended …"), with search and category, status and warranty filters; a note appears when only the first 1,000 assets are loaded. Admins see **Add an asset** and **Asset categories**; committee members see the same lists with no forms or buttons.
- **Detail (`/admin/assets/[assetId]`):** **Details**, **Annual maintenance contract** (shown only when AMC is enabled and linked) and **Maintenance history**, which merges manual entries and AMC visits newest first; admins also get **Record maintenance** and a confirmed **Remove entry** on manual entries.
- **Form (`/admin/assets/new`, `/admin/assets/[assetId]/edit`):** category, name, location, make, model, serial, supplier, purchase date and cost in rupees, warranty end, status, notes and, when AMC is enabled, the contract picker. With no categories the form says **Add a category first**. If the AMC setting changed after the form opened, saving asks the admin to reload.
- **Categories (`/admin/assets/categories`, admin):** add, rename and turn categories on or off.
- Route states: loading skeleton, error with retry, module disabled, access denied and not found. Development-only fixture `/fixtures/asset` covers admin and committee views with synthetic data.

### 12.14 Home-services directory (P31)

- **Resident (`/home-services`):** **Home services** lists approved providers by service type with the average stars as text ("4.5 out of 5 from 12 ratings"), search by name, area or notes and a type filter, and a tap-to-call phone link. A provider page shows **Contact**, the resident's own rating form (1–5 stars, optional comment, editable) and **Comments** without names. If an admin hid the resident's comment, **Your comment is hidden** explains that the stars still count. A note appears when the list was cut at 500.
- **Admin and committee (`/admin/home-services`):** **Awaiting approval** (committee suggestions, with **Approve** and **Reject** with a reason for admins), **Listed providers**, **Archived and not approved** and **Recent comments** with the rater's name. Admins see **Add a provider**, edit, archive and **Hide comment**/**Show comment**; committee members see **Suggest a provider** and a **Committee view** banner. A hidden comment shows "Comment hidden by an admin." to committee members.
- Route states: loading skeleton, error with retry, module disabled, access denied and not found. Development-only fixture `/fixtures/home-services` covers the resident, admin and committee views with synthetic data.

### 12.15 Service-request SLA escalation (P32)

- Request lists and details show an **Escalated to admins** or **Escalated to committee** chip (words, not colour alone) next to the overdue state, and the timeline shows the escalation entry. The requester never sees who was notified.
- The admin **Categories** tab adds "Escalate to committee after (days)" (1–30, default 2) to each category and an **SLA escalation** card ("Send escalations by": **In-app** or **In-app + email**) explaining that recipients always get an in-app notification and residents see only that the request was escalated.

### 12.16 Helpdesk additions (P49)

- **Priority:** the create form offers Critical, High, Medium and Low as a radio group with a one-line hint each (Medium preselected). Lists and detail show the priority as a word chip; admins get **Change priority** with a required reason.
- **Targets:** the admin **Categories** tab replaces "SLA hours" with four "days" inputs per category (empty means no target), and the **SLA escalation** card adds "Committee wait is set" **Per category** / **Per priority** with four day inputs when per priority is chosen.
- **On Hold:** admins see **Put on hold** (reason required, shown to the requester) and **Release hold**. Held requests show an **On hold · N days** chip instead of the overdue state, and the requester sees the reason on the detail page and timeline.
- **Feedback:** after closing, the rating form asks for Resolution quality, Response speed and Staff behaviour (1–5 each, optional as a set) and the overall rating. Admins see a follow-up control (Not needed/Needed/Done).
- **Logging for a unit:** admins and housekeeping supervisors get **Log a request** with unit or common area and **How it arrived** (Walk-in, Phone, WhatsApp, Email, Helpdesk app, Daily rounds). The form has no photo upload. Supervisors stay on the form after saving because they cannot open request detail. The source shows on admin lists and detail only.
- **Escalation responses:** escalated requests show an **Escalation response** card to admins (and committee for committee-level escalations) with status, note, responder and days to respond.
- **Vendor picker:** when Vendors is enabled, the assign form adds **Choose a vendor** above the free-text name and phone fields. The blacklist warning follows P47.1.
- **Report tab:** tables first, with simple bars as an addition, for resolution %, on-time %, average days by category, priority and month, open load per assignee, monthly volume with closing backlog and repeat issues. Committee members do not see unit-level repeats or written comments.
- **Daily checks:** `/guard/rounds` and `/housekeeping/rounds` are phone-first lists of today's points with **OK** and **Issue** buttons (56px targets); Issue asks for a note and offers raising a new request, linking an open common-area request, or only recording the issue. Done points show who checked them and when. Admins manage points and see the OK rate under **Daily checks**.
- Route states follow 9.3. The development fixtures `/fixtures/service-requests` and `/fixtures/service-requests-admin` cover the priority radio group and the new escalation settings with synthetic data; hold, feedback, report and daily-check states are covered by unit and database tests.

### 12.17 Accounts additions (P39)

- **Cash and bank book:** when one account is selected, rows show the **Balance** after each entry; every row shows its **Voucher** (`RV/2026-27/12`). Reversals stay as their own rows. CSV and PDF exports include the voucher.
- **Reconciliation (`/admin/expenses/reconciliation`):** choose a bank account, then **Statement items** (date, reference, party, in/out, amount, status chip Unmatched/Matched/Cancelled, an **Older than 30 days** chip) and **Book entries not yet matched**. Admins add items, match an item to an entry with the same amount and direction, or cancel with a reason; committee members get a **View only** banner. A note says differences are never posted automatically.
- **Petty cash:** setup (admin) marks the cash account as petty cash and picks the custodian from active members; changing the custodian asks for the handover count. `/petty-cash` shows the book amount, **Record a count** (date, counted amount in rupees, note), counts with the difference as signed words ("₹120 short", "₹40 over") and custodian history. A non-admin custodian sees only this page, reached from a **Petty cash** link in their navigation (a tile on the guard home); admins and committee use the Accounts tabs, and committee members read without recording.
- **Report:** the period report adds **Net surplus or deficit** per month and **Financial year to date (not a balance)**.

### 12.18 Vendor, contract and AMC additions (P47; D-71 approved for Batch 2 implementation)

- `/admin/vendors` adds **Contracts**, **Agency checks**, **Work orders** and **Bills owed** views. Admins manage the records; committee members get read-only views. The existing P24 purchase-request and approval behavior is unchanged.
- Vendor details add optional PAN in the standard 10-character Indian format (stored uppercase), payment terms from 0 to 365 days (0 means due immediately; blank uses the five-day bill default) and onboarded date. Blacklisted status requires a reason and is audited; a clear warning appears for new purchase requests and service-request assignments, but the action is not blocked. PAN is visible only to admins.
- General contracts remain separate from AMCs. Contract and AMC lists show Upcoming, Active, Due Soon, Urgent or Expired using admin-editable 60-day and 30-day windows by default; a terminated contract shows **Terminated**. Contracts show **Auto-renews** as a label, the notice deadline when notice days are set, and **Renew** and **End early** actions for admins. Admins edit the windows on the AMC page; committee members can view but not change them. Existing 60/30/7 reminder behavior remains unchanged.
- `/admin/amc` includes an admin-only expiry-window form showing Due Soon (default 60 days) and Urgent (default 30 days). Save rejects zero, out-of-range values and any Urgent value that is not shorter than Due Soon; committee members see the current values without edit controls.
- AMC service schedules allow 1–12 visits per year, spaced by `round(365 / services per year)` days from the latest logged visit, and an optional asset category picked from the asset register. Before the first visit, show the schedule as unscheduled rather than implying it is overdue.
- Agency checks show sanctioned and actual staff-days, shortfall, contracted amount, deduction, payable and bill-raised variance. The deduction uses the contract's per-missing-day rate, capped at contracted amount; when no rate is configured, an admin enters a deduction and reason, still capped at contracted amount. The contract's defaults pre-fill a new check. Editing a saved check asks for a reason. Label the check as a record only; it creates no bill or payment.
- Work orders require an approved P24 purchase request and show the per-society yearly number, status, optional due date, completion date and derived delay/days open (delay shows "—" without a due date). Only the allowed next statuses are offered (Issued also offers Completed); cancelling asks for a reason.
- Bills owed show invoice date, due date, effective terms, linked P16 payments, partial balance and separate payment-status and due-state chips. Use saved vendor terms or a five-day fallback at creation and retain the effective terms with the bill. **Due Soon** appears in the seven days through the due date; **Overdue** begins the next day. A partly paid overdue bill shows **Partly paid** and **Overdue**. There is no manual Paid action. **Link payment** lists eligible cash-book entries with their payee and unlinked amount; a reversed payment stays listed as **Reversed – not counted**. **Unlink** on a counting payment asks for a reason, and the payment stays listed as **Unlinked – not counted** with that reason. Edit is offered only before a payment counts; **Cancel bill** asks for a reason.
- The vendor list shows a summary strip with society totals; each vendor page shows the same figures for that vendor. Every figure links to its source view.
- Empty, disabled, denied, loading and error states follow Section 9.3. All amounts use existing rupee/paise input and display patterns.

### 12.19 Dues and arrears additions (P38; D-71 approved for P38.2–P38.4)

- Existing admin Billing pages add **Payment plans**, **Recovery follow-ups** and **Collection efficiency**. Admins manage the records; committee members view them.
- Payment plans show the selected bills and their remaining-balance snapshot, down-payment and equal monthly installment terms, and progress derived from confirmed allocations for payments dated on or after the plan date and confirmed after plan creation. Apply confirmed amounts to the down payment and then installments in order; the final installment absorbs paise rounding. A bill can belong to only one non-cancelled plan. Admins can edit terms and remarks, but must cancel a plan with a required reason to change its bill set; cancelled records remain visible and their bills can be replanned. A visible note says a plan is an estimate, has no in-app approval step, and does not change bills, fees, reminders, allocations or balances. Show the authoritative unit-ledger due separately.
- Recovery actions use fixed action and outcome choices, with an optional active same-society admin assignee, next-action date and open/closed state. Follow-up status is derived from the next-action date. They are never presented as proof of legal service; the screen does not record legal notices or send messages.
- The as-of report shows its date, confirmed payments allocated to bills due by then, and billed amount after approved waivers. Payments count only when both `paid_on` and `confirmed_at` are on or before the as-of date; advance or unallocated credit is excluded. The report is read-only and separate from the existing BIL-11/P27 collection metric.
- Interest is not shown or calculated until separate accountant/legal review approves the rate and rules.

### 12.20 Core toolkit additions (P35; D-71 approved 2026-11-20)

- A **Society profile** page (`/admin/society-profile`) holds the reference profile. Name, address, city, contact email and contact phone appear from the existing society details (edited where they are today, not on this page); the profile adds the new reference fields and chairman, secretary and treasurer names and mobiles. Empty values show **Not added**, never 0. Admins can edit; committee members see ordinary fields, including office-bearer names. Society PAN, bank identifiers and office-bearer mobile numbers are not shown to committee. Bank details show bank name, last four account digits and IFSC only.
- An advisory **Setup checklist** shows Filled, Missing, Optional or Not applicable per field and per-section completion. Required fields: name, society type, registration number and date, address, city, state, PIN, official email, phone and financial-year start; registration authority, statutory members and auditor are required only for a Co-operative housing society. It never blocks any action.
- The **Capability adoption** view (`/admin/adoption`) lists one row per Homeish module with status (Not started, Exploring, In use, Mastered), priority (High, Medium, Low), responsible owner, review date and notes. It clearly says that entries do not enable modules or track product usage; admins edit and committee members view.
- **Action plans** (`/admin/action-plans`) are separate from meeting action items. A society can have many named plans; admins and committee members create, edit and see all of them, and a new plan may start from the editable sample plan (Foundation, Systems, Growth). Task owners can be any active member; an owner who is not an admin or committee member sees only their own assigned tasks, read-only, on **My tasks** (`/action-plans`; admins and committee opening it go to `/admin/action-plans`). Assigning a task sends the owner an in-app notification that opens `/action-plans`; there are no overdue alerts. A task linked to a meeting action cannot be marked done here; it is completed from the meeting. The weekly timeline and status summaries use the approved date/status rules.
- Task labels use **Responsible person** and **Work held up** with contextual Hindi, not property ownership or denied-entry wording. Admins alone see **Remove task**: enter a reason and confirm that history stays saved and linked meeting actions stay unchanged. Removed tasks disappear from lists/timeline/summaries; there is no restoration UI. Plan/task create and edit forms leave an accessible success banner outside the closed form.
- **Help** (`/help`, every signed-in role) has about 25 app-authored articles, searchable and filtered by role and enabled module. Articles are shown in Hindi only when Hindi is available to the society, otherwise in English. It contains no personal notes and never describes unavailable functions as active.
- **Letters** (`/admin/letters`, admins and committee members) offer the 11 P35.13 types. A letter opens pre-filled from records the user can already see, its text can be edited, and the user previews it and then downloads an English PDF; the screen says the letter is not sent or saved. Dues reminders and final notices use neutral, factual wording with no penalties or legal threats. Other statutory or rights-affecting wording stays unavailable until separately approved.
- Route states follow Section 9.3. Private source files retain their existing download and access rules.

### 12.21 Communication additions (P53; D-71 approved 2026-11-20)

- **Notice drafts and scheduling:** **When to post** offers **Publish now**, **Save as a draft** and **Schedule for a date and time**. Schedule uses required **Posting day** and **Posting time** shared controls in India time, allowing later today. A missing date shows inline feedback and a form alert; future-time and expiry-after-posting rules are checked by the form and server, never saving an incomplete schedule as a draft. The hint explains automatic publication on access after the chosen time and daily catch-up/possibly delayed alerts. Scheduled labels show date and time. `/admin/notices` has a **Planned** tab listing drafts and schedules. A planned detail shows **Publish now**, **Edit notice** and **Withdraw notice** ("It will not be posted."); withdrawn drafts move to the archive. Late already-expired schedules retain their original times in the archive without an alert. Published editing offers no posting choices.
- **Planning details:** admin/committee notice detail shows Draft, Scheduled, Posted or Removed and the official fields (prepared by, notice board location, optional priority, next action/date). Admins alone edit/save them; committee members see the official read-only plan and a **Propose planning details** form on any notice. A hint says an admin must accept before official fields change. **Planning proposals** lists the latest 100 submissions with proposer, fields and Pending review/Accepted/Rejected. Admins confirm **Accept proposal** or **Reject proposal**; acceptance refuses a changed official baseline rather than overwriting it. Pending/rejected proposals leave official fields unchanged. Neither official fields nor proposals reach residents. A next action date without an action shows validation feedback.
- **Contact log** (`/admin/contact-log`, admins and committee members) explains its purpose and privacy/three-year retention rules. Filter links (All, Open, Closed; Open includes follow-ups) sit above the latest 200 entries, with an empty state ("No contacts logged"). Admin-only **Add contact** opens the inline date/type/channel/direction/unit/summary/handler/status/follow-up/linked-request form; **Update** edits an entry in place. Committee members have neither control and see a read-only banner. Entries retain the existing labels and **Follow-up overdue** chip. A successful save closes the form but keeps an accessible **Contact saved.** banner at screen level.
- **Communication dashboard** (`/admin/communication`, admins and committee members) shows one month with **Previous month**, a month picker with **Show**, and **Next month** (hidden for the current month). Sections: Notices (Posted, Removed, Planned now), Meetings, Events, SOS, Service requests (Received, Resolved, Average days to resolve) and Contact log (Contacts logged, Contacts closed, Open now, Follow-up overdue). Each figure has a one-line definition, and a banner says figures count Homeish records only and sections for switched-off modules are hidden.
- Route states follow Section 9.3. Fixtures: `/fixtures/notices` (drafts, scheduling and planning) and `/fixtures/communication` (contact log and dashboard).

---

## 13. Iconography and Imagery

- One icon library, line style, 1.5px stroke, 24px default (20px in chips, 28px on guard tiles). No filled/line mixing.
- Icons accompany text; icon-only controls always have accessible names and tooltips (desktop). Decorative icons are hidden from assistive tech.
- No stock illustrations. Empty states use a single line icon. Photos appear only as user-provided content (visitor, parcel, request, society logo).
- Society logo: optional, shown in top bar (max 32px high) and on printed bills; default is the society's name as text in `heading` weight.
- Do not use emoji in the UI.

---

## 14. Accessibility Requirements

Target: **WCAG 2.2 AA** for all resident, guard, admin and developer journeys.

| Area           | Requirement                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure      | Semantic landmarks (header, nav, main), skip-to-content link, one H1 per page, logical heading order                                                                                              |
| Keyboard       | Every function operable by keyboard; logical order; visible 2px focus ring never clipped or hidden under sticky bars; no keyboard traps except intentional modal containment                      |
| Targets        | 48×48px minimum (project standard), ≥ 8px spacing; guard 56px                                                                                                                                     |
| Contrast       | Section 2.4; verify rendered states including tints, selected rows, disabled-but-informational text, and focus ring                                                                               |
| Colour         | Never the only means of conveying state; each status has an icon and text (4.4)                                                                                                                   |
| Text           | 200% zoom and 320px reflow without loss; no information at < 12px; instructions never at `micro`                                                                                                  |
| Forms          | Programmatic labels; errors and help associated via `aria-describedby`; required state exposed; autocomplete attributes (`tel`, `one-time-code`, `name`); input types and `inputmode` appropriate |
| Live regions   | Polite for progress, success, visitor status updates; assertive only for blocking errors; do not announce timers every second; do not move focus unexpectedly                                     |
| Dialogs        | Accessible name and description; initial focus on Cancel for destructive dialogs; focus returns to trigger; Escape closes and cancels safely                                                      |
| Tables         | Real table semantics; `scope` headers; `aria-sort`; stacked mobile rows keep label-value association and reading order; scrollable regions are focusable and labelled                             |
| Images         | Meaningful alt text for visitor/parcel photos ("Photo of visitor"); decorative images empty alt; no text in images                                                                                |
| Motion         | Honour reduced motion (8.1); no flashing content                                                                                                                                                  |
| Time-based     | No timeouts without warning; session-expiry notice precedes loss of unsaved form data where feasible                                                                                              |
| Language       | `lang` attribute set; ready for Indic scripts (font fallback, no fixed-width text containers that clip longer strings)                                                                            |
| Plain language | Reading level suitable for non-technical and older users; avoid jargon and abbreviations on resident screens (spell out "Annual Maintenance Contract" on first use)                               |
| Guard context  | Test outdoors-brightness contrast, gloved/one-handed use, and low-end device performance                                                                                                          |

Process: automated checks (axe or equivalent) on every page in CI do **not** replace manual keyboard, screen-reader (TalkBack and VoiceOver) and zoom passes, which are part of module UAT (PRD NFR-16).

For P33, use the active interface language for shared controls, accessible labels, validation and action feedback, including feedback already visible when the language changes. Keep user-written content and identifiers untouched. The language switch preserves the current screen and drafts; confirm before switching an edited form, including an SOS draft. Prefilled controls are not edits merely because they appear after the page loads. Keep English-only stored messages and output documents explicitly identified. Automated Hindi fixture checks cover 320px reflow and a 200% zoom simulation at an effective 320px layout; physical-device, screen-reader and owner Hindi review remain separate acceptance work.

---

## 15. Design Acceptance Checklist (per module release)

- [ ] Uses only tokens defined here; no raw colours, sizes or ad-hoc components.
- [ ] Each screen has loading, empty (and filtered-empty), error and permission states implemented.
- [ ] Every status uses the Section 4.4 chip mapping.
- [ ] Module disabled → no nav item, no card, no layout gap, stale-link page shown.
- [ ] Verified at 320, 390, 768, 1280, 1440 and 200% text with no page-level horizontal scroll.
- [ ] Targets ≥ 48px (guard ≥ 56px); focus ring visible everywhere.
- [ ] Contrast verified on rendered pages (Section 2.4).
- [ ] Forms: labels, inline errors, error summary, preserved input, no double submit.
- [ ] Money and destructive actions use confirm dialog or result screen, never toast.
- [ ] Errors show a reference ID and are logged (LOG-1, LOG-2).
- [ ] Keyboard and screen-reader pass completed; reduced motion honoured.
- [ ] Tested on a low-end Android device and on iOS Safari.
- [ ] Copy reviewed for plain language and consistent terminology.

---

## 16. Terminology (UI vocabulary, use consistently)

| Use                                                    | Do not use                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| Visitor, Pre-Approve, Allow, Deny, Check In, Check Out | Guest pass, Admit, Reject (for visitors), Log in/out of visitors |
| Delivery, Leave at Gate                                | Courier, Drop                                                    |
| Dues, Bill, Pay Now, Receipt, Fine, Waive              | Invoice (resident side), Penalty, Forgive                        |
| Service request, Common area, My unit                  | Ticket, Complaint (in UI labels), Public area                    |
| Unit, Block                                            | Flat/Tower (unless the society config sets a label; see DD-05)   |
| Resident, Admin, Committee, Guard                      | User (in resident/guard UI), Operator                            |
| Society                                                | Community, Tenant (reserved for developer docs)                  |
| Reference ID                                           | Error code, Trace ID                                             |

---

## 17. Assumptions Register (Design)

| ID    | Assumption                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| DA-01 | All times are shown in the society timezone; zone label appears only for dues and deadlines when the device zone differs     |
| DA-02 | Deep links from notifications open the item, and Back returns to that module's list                                          |
| DA-03 | Required fields are labelled "(required)"; optional marked "(optional)" only in mostly-required forms                        |
| DA-04 | Residents understand "Awaiting confirmation" as "the admin has not yet checked the bank statement"; copy states this plainly |
| DA-05 | Guard devices are Android phones/tablets with a camera; guard console runs as the same web app (PRD D-23)                    |
| DA-06 | A single logo and default product name are acceptable until branding is decided (PRD D-01)                                   |
| DA-07 | The product serves English only in MVP, with UI strings externalised                                                         |
| DA-08 | Charts and graphs are not required in MVP; dashboards use stat tiles and lists                                               |

---

## 18. Public website and environment entries

Approved 2026-11-09: the bare product host is a marketing website, separate from society sign-in. It reuses the shared cool background, ink, blue, Nunito, Quicksand and selected logo direction. H1/H2 implementation was authorised on 2026-11-15 (PRD 4.0.1, D-49); the shared typography and palette were amended on 2026-11-20. Do not invent customer counts, testimonials, availability, contact details or paid pricing.

Website-only tokens: `marketing-display` = 40px mobile / 64px expanded, weight 700, line height 1.1; `content-marketing` = 1200px. All other website values reuse existing tokens. Navigation wraps on phones; links and controls have 48px minimum targets; provide a skip link.

**Homepage composition:**

1. Wrapping brand/header navigation, with society address and sign-in in separately labelled utility navigation.
2. Committee-first hero: "A clearer day for your committee. A calmer day for everyone.", resident benefits, explicit testing/onboarding limits, disabled **Try demo**, **Demo coming soon**, and an original synthetic payment-details screenshot.
3. A short boundaries summary: society-scoped access, role permissions and synthetic public examples, without certifications or unsupported guarantees.
4. Nine **Released for testing** module descriptions (P5-P8, P11-P15), explicitly not live-society availability.
5. Separate **In development** expenses/directory descriptions: locally checked, not released to beta.
6. Committee, admin, resident and guard benefits.
7. A two-image static gallery from the existing development-only service-request and amenity fixtures; the payment-details screenshot appears once in the hero. Identify every image as synthetic; captions explain the workflow and important limits, including payment submission versus confirmation.
8. A separate **Planned modules** section for P18-P33, grouped by roadmap wave, with no release dates or implication of availability.
9. Future owner-led setup steps, existing-society address form, native expandable FAQs, repeated disabled demo action and the existing privacy-policy footer.

**Demo state (D-49):** both **Try demo** buttons use the shared Button's native disabled state and an adjacent readable **Demo coming soon** note. Neither is an anchor, has a demo URL or opens an inline sample. The FAQ explains the deferral. No temporary contact/enquiry action replaces it. Separate demo setup and connection wait until product readiness and a separately authorised, verified rollout.

**Screenshots:** use local assets `public/homeish-billing-preview.jpg`, `public/homeish-service-request-preview.jpg` and `public/homeish-amenity-preview.jpg`. Capture only invented fixture data, exclude development chrome and focused input outlines, and include no names, phones, vehicles or resident directory. Use static image imports with Next Image, intrinsic dimensions, responsive sizes and meaningful alternative text; only the hero image loads eagerly. The three source JPEGs total 128,943 bytes before responsive optimisation. Do not add a carousel, animation, lightbox, external embed or tracking service. **Owner approved the delivered copy and all three assets on 2026-11-15.**

**States and access:** homepage copy is server-rendered and needs no authenticated data, loading spinner, empty-result state or permission request. Static image dimensions reserve space during loading; meaningful alt text and captions retain the explanation if an image cannot load. Unexpected page-render failures keep the existing app error boundary. FAQs work with native keyboard interaction; the skip link focuses `main`. The existing society form keeps its validation/error state and exact-host destination rules. Automated checks passed for 320/390/768/1280px reflow, axe, keyboard/visible focus, native FAQ disclosure, reduced motion and actual image decoding. Real-device TalkBack/VoiceOver, 200% zoom/enlarged text, low-end Android and iPhone Safari acceptance remain pending; these are not implied by owner copy/asset approval or automated evidence.

The existing demo-host illustration remains labelled synthetic, with browser-memory interactions, manual reset and an automatic reset every 15 minutes while open. It is not a visitor module or a connected database; its presence in code is not proof of a hosted demo. No real society entry is provisioned by this refresh. An active society host shows the society name and a sign-in link. The reserved Maplewood host shows only "Maplewood is not open yet" with a link back to the website, no form, button or sign-in. Unconfigured society hosts return 404. Beta stays testing-only, never production society data. Non-marketing hosts are not indexed.

### 18.1 Out of Scope (Design)

- Dark theme (DD-01), per-society colour theming or white-labelling beyond logo and name
- Illustrations, mascots, onboarding carousels
- Swipe/long-press gesture actions, drag-and-drop interactions
- Animated charts, data-visualisation library
- Native-app-specific design (platform widgets) unless PRD D-23 changes
- Regional-language typographic tuning and RTL support
- Design for hardware displays (gate kiosk, intercom)

---

## 19. Component and Token Inventory (for build tracking)

**Tokens:** colour (2.1, 2.2), typography (3.2), spacing (4.1), radius/border/elevation (4.2), motion (8.1), breakpoints (4.5), containers (4.5).

**Components (build order aligned to PRD module release):**

1. **Foundation (MVP-0):** Button, IconButton, TextInput (+Phone, OTP, Amount, Search), Select/Combobox/UnitPicker, Checkbox/Radio/OptionCard/Switch, Chip/Badge, Card, ListItem, StatTile, Table (+stacked mobile), Pagination, FilterBar, Tabs/Segmented, Dialog/Sheet/ConfirmDialog, Banner, Toast, ErrorSummary, ErrorPanel (reference ID), EmptyState, Skeleton, Spinner, TopBar, BottomTabs, Sidebar, SocietySwitcher, Timeline, Avatar, ModuleToggleRow, LogDetailPanel, FileUpload, DateTimePicker, Stepper/Progress.
2. **Visitor/Delivery (MVP-1/2):** GateActionTile, VisitorApprovalCard, GuardWaitingPanel, CodeDisplay.
3. **Billing (MVP-3):** AmountDueHero, LedgerRow, ReceiptView (print layout), BillGenerationStepper.
4. **Service Requests (MVP-4):** CommentThread/Composer, RatingInput.
5. **P2 modules:** Attendance calendar/list (staff), StockTransaction row (housekeeping), ExpiryStatusRow (AMC), NoticeItem, SlotPicker (amenity). Each reuses foundation components; new composites need an entry here first.

---

## 20. Decisions Requiring Your Approval

| ID    | Decision                                                                                                      | Recommendation                                                                                           | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| DD-01 | Light theme only in MVP (dark mode later)                                                                     | **Approved 2026-11-09:** light theme only; dark mode may be revisited after MVP                          | Closed   |
| DD-02 | Typeface and user preference                                                                                  | **Amended 2026-11-20:** Nunito body + Quicksand headings; retain the account-saved device-default option | Closed   |
| DD-03 | Guard alert sound/haptic on resident decision, with mute                                                      | **Approved 2026-11-09:** brief alert with a global mute setting                                          | Closed   |
| DD-04 | "Help" screen exposing a copyable session/request ID on every role                                            | **Approved 2026-11-09:** copyable ID available from Help throughout the app                              | Closed   |
| DD-05 | Society-configurable unit terminology                                                                         | **Approved 2026-11-09:** custom text, 1–24 letters or spaces; defaults to "Unit"                         | Closed   |
| DD-06 | Brand colour (`#1E4E8C` blue) and the "Gate Register" direction                                               | **Amended 2026-11-20:** retain blue and clear records; use a cool background and softer corners          | Closed   |
| DD-07 | Product logo/mark (product name Homeish confirmed in PRD D-01)                                                | **Approved 2026-11-09:** Homeish wordmark paired with the roof-and-entry mark from logo concept 15       | Closed   |
| DD-08 | Bottom tab bar for residents/admin on phones vs. hamburger drawer                                             | **Approved 2026-11-09:** bottom tabs on phones                                                           | Closed   |
| DD-09 | Confirmation for developer high-impact actions (suspend/archive society, disabling module with pending items) | **Approved 2026-11-09:** standard dialog stating the consequence; no typed confirmation                  | Closed   |
