---
name: homeish-design-audit
description: Audit and tidy one Homeish screen against docs/DESIGN.md, one pass at a time with before/after screenshots (spacing, colour, icons, type, borders and shadows, motion). Use when asked to clean up, polish or de-clutter a screen in this repository, or make it look less generic.
---

# Homeish design audit

[docs/DESIGN.md](../../../docs/DESIGN.md) ("The Gate Register") and the tokens in `src/styles/` are the standard. Generic "clean UI" advice does not override them: Homeish uses a 4px spacing scale, Nunito body with Quicksand headings, and short ease-out motion with no bouncing or animated numbers. Keep copy, data, layout structure and behaviour unchanged. Do not commit or push.

## 1. Set up

- Read [AGENTS.md](../../../AGENTS.md), [docs/AGENTS.md](../../../docs/AGENTS.md) section 06, DESIGN sections 1–4, 8, 13 and 14, and [docs/ACCESSIBILITY_CHECKLIST.md](../../../docs/ACCESSIBILITY_CHECKLIST.md).
- Run `git status`. If DESIGN.md has uncommitted edits, use the working copy and say so.
- Ask the user which screen to audit if they did not say.

## 2. Screenshot (synthetic data only)

- Use the screen's development-only fixture under `src/app/fixtures/` (for example `/fixtures/admin-home`), run with `npm run dev`. If there is no fixture, ask before using any other data; never use live or real people's data.
- Take before screenshots at 360px and 1280px wide, using the browser tools or Playwright.
- Save the screenshots in the session workspace, not the repository.

## 3. Audit

List deviations from DESIGN, each with file and line, grouped into these passes:

1. **Spacing (DESIGN 4.1):** values off `space-1`…`space-8`, gaps that differ from the context table, arbitrary Tailwind values.
2. **Colour (DESIGN 2):** raw hex values, colours outside the palette, gradients or glow, status shown by colour alone.
3. **Icons (DESIGN 13, 4.4):**
   - emoji anywhere in the UI;
   - a second icon library, or filled and line icons mixed;
   - sizes other than 24px (20px in chips, 28px on guard tiles);
   - icon-only controls without an accessible name.
4. **Type (DESIGN 3):** font families, sizes or weights outside the type scale.
5. **Borders and shadows (DESIGN 4.2):**
   - borders other than 1px `rule` or `rule-strong`;
   - radii other than `radius-sm`, `radius-md` or `radius-lg`;
   - shadows on cards or sections (`shadow-overlay` is for floating layers only).
6. **Motion (DESIGN 8):**
   - durations outside `motion-fast`, `motion-base` or `motion-slow`, or the wrong easing;
   - looping, bouncing or celebratory effects, or animated amounts or counts;
   - reduced motion not honoured.

## 4. Fix one pass at a time

- Apply only one pass, using existing tokens and shared components from `src/components/ui/`.
- Take after screenshots at both widths. Show the before/after pair with a short list of changes, then wait for the user's OK before the next pass.
- If a needed token is missing, propose a DESIGN change first (docs/AGENTS.md section 06). Do not add a one-off value.
- Never add a dependency, such as an animation library, without approval.

## 5. Verify and report

- Run `npm run lint`, `npm run typecheck` and the screen's unit tests, then its e2e spec with `npx playwright test tests/e2e/<screen>.spec.ts`. Also run `tests/e2e/accessibility.spec.ts` if it covers the screen.
- Report:
  - the changes made in each pass;
  - deviations left unfixed;
  - any DESIGN questions.
