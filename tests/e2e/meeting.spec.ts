// Exercise resident self check-in and the admin attendance-to-minutes journey with synthetic actions.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
}

const SYNTHETIC_SUCCESS = 'Synthetic action complete. Nothing was saved.';

test('resident checks their unit in to an open meeting', async ({ page }) => {
  await page.goto('/fixtures/meeting');
  await page.getByLabel('Fixture screen').selectOption('resident-check-in');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Annual general meeting 2026',
    }),
  ).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'Check in unit A-101' }).click();
  await expect(
    page.getByText(SYNTHETIC_SUCCESS, { exact: true }),
  ).toBeVisible();
});

test('administrator records a proxy, sees quorum and publishes minutes', async ({
  page,
}) => {
  await page.goto('/fixtures/meeting');
  await page.getByLabel('Fixture role').selectOption('admin');
  await page.getByLabel('Fixture screen').selectOption('admin-held');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Annual general meeting 2026',
    }),
  ).toBeVisible();
  await expect(page.getByText('Quorum met', { exact: true })).toBeVisible();
  await expectNoViolations(page);

  await page.getByLabel('Attendance for B-202').selectOption('proxy');
  await page.getByLabel('Proxy name for B-202').fill('Synthetic Neighbour');
  await page.getByRole('button', { name: 'Save attendance for B-202' }).click();
  await expect(
    page.getByText(SYNTHETIC_SUCCESS, { exact: true }).first(),
  ).toBeVisible();

  const dialogPromise = page.waitForEvent('dialog');
  const publishPromise = page
    .getByRole('button', { name: 'Publish minutes' })
    .click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe(
    'Publish these minutes? They cannot be changed afterwards and invitees will be notified.',
  );
  await dialog.accept();
  await publishPromise;
  await expect(
    page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Publish minutes' }) })
      .getByText(SYNTHETIC_SUCCESS, { exact: true }),
  ).toBeVisible();

  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(
    page.getByRole('button', { name: 'Publish minutes' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Save minutes draft' }),
  ).toBeVisible();
});
