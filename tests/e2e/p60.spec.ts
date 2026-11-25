// Verify P60 reports, updates, resident visibility and five-slot phone navigation.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('shows P60 manager work and the same quick-create sheet from the phone bar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/fixtures/p60');
  await expect(
    page.getByRole('heading', { name: 'P60 synthetic workspace' }),
  ).toBeVisible();

  const reports = page.getByRole('region', { name: 'Report hub example' });
  await expect(
    reports.getByRole('heading', { name: 'Billing reports' }),
  ).toBeVisible();
  await expect(
    reports.getByRole('heading', { name: 'Dues follow-up' }),
  ).toBeVisible();

  const bottom = page.locator('nav.fixed.bottom-0');
  await expect(bottom.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Visitors' })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Bills' })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Requests' })).toHaveCount(0);
  await expect(bottom.getByRole('button', { name: 'New' })).toBeVisible();
  await expect(bottom.getByRole('button', { name: 'More' })).toBeVisible();
  await bottom.getByRole('button', { name: 'New' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Quick create' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Pre-approve a guest' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByText('CSV imports are ready')).toBeVisible();
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await expect(page.getByText('Release note marked read.')).toBeVisible();

  await page.getByRole('button', { name: 'Save resident visibility' }).click();
  await expect(page.getByText('Resident visibility saved.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('admin compact navigation keeps three direct tabs and New', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/fixtures/p60');
  await page.getByRole('button', { name: 'Admin shell' }).click();
  const bottom = page.locator('nav.fixed.bottom-0');
  await expect(bottom.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Visitors' })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Billing' })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Requests' })).toHaveCount(0);
  await expect(bottom.getByRole('button', { name: 'New' })).toBeVisible();
  await expect(bottom.getByRole('button', { name: 'More' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('developer writes release notes and sees counts only', async ({
  page,
}) => {
  await page.goto('/fixtures/p60-developer');
  await expect(
    page.getByRole('heading', { name: 'P60 developer workspace' }),
  ).toBeVisible();
  await page.getByLabel('Title').fill('Visitor filters improved');
  await page
    .getByLabel('Release note (required)', { exact: true })
    .fill('The gate list is quicker to scan.');
  await page.getByRole('button', { name: 'Save release note' }).click();
  await expect(page.getByText('Release note saved.')).toBeVisible();
  await expect(page.getByRole('cell', { name: '42' })).toHaveCount(2);
  await expect(page.getByText('Synthetic Society')).toBeVisible();
  await expect(page.getByText(/phone|email|flat number/i)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
