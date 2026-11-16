// Exercise the committee analytics dashboard and settings journey against synthetic fixture data.
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

function collectionRows(page: Page) {
  return page
    .getByRole('region', { name: 'Collection trend table' })
    .locator('tbody tr');
}

test('committee changes the trend range and switches money to the financial year', async ({
  page,
}) => {
  await page.goto('/fixtures/analytics');
  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Analytics' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveCount(0);
  await expect(collectionRows(page)).toHaveCount(12);
  await expectNoViolations(page);

  const trendRange = page.getByRole('navigation', { name: 'Trend range' });
  await trendRange.getByRole('link', { name: 'Last 3 months' }).click();
  await expect(page).toHaveURL(/months=3/);
  await expect(
    trendRange.getByRole('link', { name: 'Last 3 months' }),
  ).toHaveAttribute('aria-current', 'true');
  await expect(collectionRows(page)).toHaveCount(3);

  const moneyRange = page.getByRole('navigation', { name: 'Money range' });
  await moneyRange.getByRole('link', { name: /This financial year/ }).click();
  await expect(page).toHaveURL(/money=fy/);
  await expect(
    moneyRange.getByRole('link', { name: /This financial year/ }),
  ).toHaveAttribute('aria-current', 'true');
  // Money trends follow the financial year (Apr–Nov) while other trends keep the 3-month range.
  await expect(collectionRows(page)).toHaveCount(8);
  await expect(
    page.locator('#analytics-service_request-sla tbody tr'),
  ).toHaveCount(3);
  await expect(page.getByText(/FY 2026–27 to date/).first()).toBeVisible();
  await expect(page.getByText('₹12,45,000').first()).toBeVisible();
  await expectNoViolations(page);
});

test('administrator sees exports and the empty state links to settings', async ({
  page,
}) => {
  await page.goto('/fixtures/analytics?months=6&money=months');
  await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveAttribute(
    'href',
    '/api/analytics/export?format=csv&months=6&money=months',
  );
  await expect(page.getByRole('link', { name: 'Export PDF' })).toHaveAttribute(
    'href',
    '/api/analytics/export?format=pdf&months=6&money=months',
  );
  await expect(
    page.getByText('This figure is not available right now. Try again later.'),
  ).toBeVisible();

  await page.getByLabel('Fixture screen').selectOption('empty');
  await expect(
    page.getByRole('heading', { name: 'No analytics selected' }),
  ).toBeVisible();
  await expectNoViolations(page);
  await page.getByRole('link', { name: 'Choose analytics' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Analytics settings' }),
  ).toBeVisible();
});

test('administrator selects, deselects and restores default analytics', async ({
  page,
}) => {
  await page.goto('/fixtures/analytics?screen=settings');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Analytics settings' }),
  ).toBeVisible();
  await expect(page.getByText('6 figures selected')).toBeVisible();
  await expectNoViolations(page);

  const members = page.getByRole('checkbox', { name: /^Member sign-ups/ });
  const collection = page.getByRole('checkbox', { name: /^Collection trend/ });
  const parking = page.getByRole('checkbox', { name: /^Parking occupancy/ });
  await expect(parking).toBeDisabled();
  await expect(parking).toBeChecked();
  // The styled box covers the native input, so click the visible label like a person would.
  const toggle = (name: string) =>
    page
      .locator('label', {
        has: page.getByRole('checkbox', { name: new RegExp(`^${name}`) }),
      })
      .click();

  await toggle('Member sign-ups');
  await toggle('Collection trend');
  await expect(page.getByText('6 figures selected')).toBeVisible();
  await expect(members).toBeChecked();
  await expect(collection).not.toBeChecked();

  await page.getByRole('button', { name: 'Restore defaults' }).click();
  await expect(members).not.toBeChecked();
  await expect(collection).toBeChecked();
  await expect(parking).toBeChecked();

  await toggle('Member sign-ups');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Analytics settings saved.' }),
  ).toBeVisible();
  await expect(page.getByText('7 figures selected')).toBeVisible();
});

test('a stale settings save asks the administrator to reload', async ({
  page,
}) => {
  await page.goto('/fixtures/analytics?screen=settings-conflict');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Settings changed. Reload and try again.' }),
  ).toBeVisible();
});

test('committee members cannot open analytics settings', async ({ page }) => {
  await page.goto('/fixtures/analytics?screen=settings');
  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(
    page.getByRole('heading', { name: 'You do not have access to this page' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Only society administrators can change analytics settings.',
    ),
  ).toBeVisible();
  await expectNoViolations(page);
});
