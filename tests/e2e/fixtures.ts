// Shared Playwright test that fails whenever the browser reports a Content Security Policy violation.
import { expect, test as base } from '@playwright/test';

export * from '@playwright/test';

export const test = base.extend<{ cspGuard: void }>({
  cspGuard: [
    async ({ page }, use) => {
      const violations: string[] = [];
      page.on('console', (message) => {
        if (/Content Security Policy/i.test(message.text())) {
          violations.push(message.text());
        }
      });
      await use();
      expect(violations, 'Content Security Policy violations').toEqual([]);
    },
    { auto: true },
  ],
});
