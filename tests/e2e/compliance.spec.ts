// Check the factual register remains explicit, responsive and accessible.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('committee compliance register is read-only and non-certifying', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/fixtures/compliance');
  await expect(
    page.getByText('These records are not legal advice or certification.'),
  ).toBeVisible();
  await expect(
    page.getByText('Synthetic annual filing', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Add factual/ })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
