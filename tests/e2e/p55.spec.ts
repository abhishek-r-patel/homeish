// Verify P55 feature list, calendar, developer onboarding and request controls.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('shows P55 feature, calendar and developer controls accessibly', async ({
  page,
}) => {
  await page.goto('/fixtures/p55');
  await expect(
    page.getByRole('heading', { name: 'Homeish features' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Visitor Management' }),
  ).toBeVisible();
  await expect(page.getByText('Need water readings').first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'November 2026' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Monthly meeting' }),
  ).toBeVisible();
  await expect(page.getByText('Agreed modules')).toBeVisible();
  await expect(page.getByText('Synthetic Society · metering')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
