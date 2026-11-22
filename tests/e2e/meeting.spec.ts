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

test('administrator uses duration estimates and meeting agenda templates', async ({
  page,
}) => {
  await page.goto('/fixtures/meeting');
  await page.getByLabel('Fixture role').selectOption('admin');
  await page.getByLabel('Fixture screen').selectOption('admin-editor');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Edit meeting' }),
  ).toBeVisible();
  await expectNoViolations(page);

  const firstDuration = page
    .getByLabel('Duration in minutes (optional)')
    .first();
  await expect(firstDuration).toHaveValue('15');
  await firstDuration.fill('20');
  await expect(page.getByText(/^Estimated time:/).first()).toBeVisible();

  await page
    .getByLabel('Use an agenda template (optional)')
    .selectOption({ label: 'Annual meeting standard' });
  const applyPromise = page
    .getByRole('button', { name: 'Apply template' })
    .click();
  const replaceDialog = await page.waitForEvent('dialog');
  expect(replaceDialog.message()).toContain('Replace the current agenda?');
  await replaceDialog.accept();
  await applyPromise;
  const meetingForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save changes' }) });
  await expect(meetingForm.getByLabel('Agenda item 1 title')).toHaveValue(
    'Confirm the chair',
  );
  await expect(
    meetingForm.getByLabel('Duration in minutes (optional)').first(),
  ).toHaveValue('5');

  const templateForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Create template' }) });
  await templateForm.getByLabel('Template name').fill('Board standard');
  await templateForm.getByLabel('Agenda item 1 title').fill('Open meeting');
  await templateForm.getByRole('button', { name: 'Create template' }).click();
  await expect(
    page.getByText(SYNTHETIC_SUCCESS, { exact: true }),
  ).toBeVisible();
  for (const width of [640, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expectNoViolations(page);
  }
});
