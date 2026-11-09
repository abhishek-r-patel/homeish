// Browser smoke and automated accessibility check for the empty app shell.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('loads the root route with no automated accessibility violations', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Dwello' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
