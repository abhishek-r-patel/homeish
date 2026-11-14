// P10.2 accessibility sweep: WCAG 2.2 AA (axe), 200% zoom and 320px reflow and visible keyboard focus on every reachable screen.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

const screens = [
  '/',
  '/login',
  '/developer/login',
  '/privacy',
  '/fixtures/foundation',
  '/fixtures/billing',
  '/fixtures/billing?tab=payment-settings',
  '/fixtures/billing-payments',
  '/fixtures/service-requests',
  '/fixtures/service-requests-admin',
  '/fixtures/notices',
];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// 640px is a 1280px window at 200% zoom; 320px is the WCAG reflow width (DESIGN.md Section 14).
const REFLOW_WIDTHS = [640, 320];
const MAX_TAB_STOPS = 40;

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();
  expect(
    violations.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
}

for (const path of screens) {
  test.describe(path, () => {
    test('meets WCAG 2.2 AA, including colour contrast', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoViolations(page);
    });

    for (const width of REFLOW_WIDTHS) {
      test(`reflows at ${width}px without horizontal scrolling`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 400 });
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        await expectNoViolations(page);
      });
    }

    test('shows a visible focus indicator on every keyboard stop', async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const unfocusable: string[] = [];
      let stops = 0;
      for (; stops < MAX_TAB_STOPS; stops += 1) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null;
          if (!element || element === document.body) return null;
          const style = getComputedStyle(element);
          const outline =
            style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
          const ring = style.boxShadow !== 'none' && style.boxShadow !== '';
          const box = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute('aria-label') ??
              element.textContent?.trim().slice(0, 40) ??
              element.tagName,
            tag: element.tagName,
            visible: outline || ring,
            onScreen: box.width > 0 && box.height > 0,
          };
        });
        if (!focus) break;
        // The Next.js dev-tools overlay only exists in development builds.
        if (focus.tag === 'NEXTJS-PORTAL') continue;
        if (!focus.visible || !focus.onScreen) {
          unfocusable.push(`${focus.tag} "${focus.label}"`);
        }
      }
      expect(stops, 'the page has at least one keyboard stop').toBeGreaterThan(
        0,
      );
      expect(unfocusable).toEqual([]);
    });
  });
}
