// Exercise the resident listing, reply and report journeys and the administrator review, removal and mute journeys with synthetic actions.
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

function formWith(page: Page, buttonName: string) {
  return page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: buttonName }) });
}

async function expectFormSuccess(page: Page, buttonName: string) {
  await expect(
    formWith(page, buttonName).getByText(SYNTHETIC_SUCCESS, { exact: true }),
  ).toBeVisible();
}

test('resident lists an item, replies to a listing and reports it', async ({
  page,
}) => {
  await page.goto('/fixtures/community');
  await page.getByLabel('Fixture screen').selectOption('listing-new');
  await expectNoViolations(page);

  await page.getByText('Free to a good home', { exact: true }).click();
  await expect(
    page.getByRole('radio', { name: 'Free to a good home' }),
  ).toBeChecked();
  await page.getByLabel('Title (required)').fill('Box of storybooks');
  await page
    .getByLabel('Description (optional)')
    .fill('Twenty picture books for ages 4 to 7.');
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expectFormSuccess(page, 'Send for review');

  await page.getByLabel('Fixture screen').selectOption('listing-pending');
  await expect(page.getByText('Awaiting review').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reply' })).toHaveCount(0);

  await page.getByLabel('Fixture screen').selectOption('listing');
  await expect(page.getByText('+91 98765 43210')).toBeVisible();
  await expectNoViolations(page);
  await page.getByLabel('Your reply').fill('Is the chair still available?');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expectFormSuccess(page, 'Send reply');

  const reportSummary = page.getByText('Report this listing', { exact: true });
  const report = page.locator('details').filter({ has: reportSummary });
  await reportSummary.click();
  await report.getByText('Looks like a scam', { exact: true }).click();
  await expect(
    report.getByRole('radio', { name: 'Looks like a scam' }),
  ).toBeChecked();
  await report.getByRole('button', { name: 'Send report' }).click();
  await expect(
    report.getByText(SYNTHETIC_SUCCESS, { exact: true }),
  ).toBeVisible();
});

test('administrator approves a listing, removes a hidden post and mutes its author', async ({
  page,
}) => {
  await page.goto('/fixtures/community');
  await page.getByLabel('Fixture role').selectOption('admin');
  await page.getByLabel('Fixture screen').selectOption('admin-queue');
  await expect(page.getByText('Study table with chair')).toBeVisible();
  await expectNoViolations(page);

  await page.getByLabel('Fixture screen').selectOption('admin-item-pending');
  await page.getByRole('button', { name: 'Approve listing' }).click();
  await expectFormSuccess(page, 'Approve listing');

  await page.getByLabel('Fixture screen').selectOption('admin-item-hidden');
  await expect(
    page.getByText('Posted the same message in three groups.'),
  ).toBeVisible();
  await expectNoViolations(page);

  await page
    .getByLabel('Why is it being removed?')
    .fill('Advertising is not allowed in groups.');
  const dialogPromise = page.waitForEvent('dialog');
  const clickPromise = page
    .getByRole('button', { name: 'Remove post' })
    .click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe(
    'Remove this post? Residents will no longer see it, and it is erased after 30 days.',
  );
  await dialog.accept();
  await clickPromise;
  await expectFormSuccess(page, 'Remove post');

  await page.getByText('30 days', { exact: true }).click();
  await expect(page.getByRole('radio', { name: '30 days' })).toBeChecked();
  await page
    .getByLabel('Reason (required)')
    .fill('Repeated advertising in groups.');
  await page.getByRole('button', { name: 'Mute Synthetic Resident C' }).click();
  await expectFormSuccess(page, 'Mute Synthetic Resident C');
});

test('a resident cannot open administrator screens', async ({ page }) => {
  await page.goto('/fixtures/community');
  await page.getByLabel('Fixture screen').selectOption('admin-queue');
  await expect(page.getByText('Study table with chair')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Approve/ })).toHaveCount(0);
});
