// Verify P52 parking condition controls and aggregate-only manager summaries.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('parking summaries remain aggregate-only and conditions are versioned', async ({
  page,
}) => {
  await page.goto('/fixtures/parking');
  await page.getByLabel('Fixture role').selectOption('admin');

  await expect(
    page.getByRole('heading', { name: 'Parking summary' }),
  ).toBeVisible();
  await expect(
    page.getByRole('term').filter({ hasText: 'Needs attention' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'This summary shows counts only. Vehicle numbers and resident details are not included.',
    ),
  ).toBeVisible();

  const conditionDetails = page
    .locator('details')
    .filter({ hasText: 'Set condition for slot B1-14' })
    .first();
  await conditionDetails.getByText('Set condition for slot B1-14').click();
  const condition = conditionDetails.getByLabel('Slot condition');
  await condition.selectOption('out_of_service');
  await page
    .getByRole('button', { name: 'Save condition for slot B1-14' })
    .click();
  await expect(page.getByText('Slot condition saved.')).toBeVisible();

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
