// Verify the monthly collection report, the dues follow-up list and the meeting summary with synthetic data.
import { expect, test } from './fixtures';

test('shows monthly collection with totals, a blank percent for unbilled months and an admin-only CSV', async ({
  page,
}) => {
  await page.goto('/fixtures/admin-reports?view=collection');
  const report = page.getByRole('region', { name: 'Monthly collection' });
  await expect(report.getByText('Rs. 95000.00').first()).toBeVisible();
  await expect(report.getByText('94.7%').first()).toBeVisible();
  const table = report.getByRole('table', { name: 'Monthly collection' });
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByRole('row').last()).toContainText('—');
  await expect(
    report.getByRole('link', { name: 'This financial year' }),
  ).toHaveAttribute('href', /period=fy/);
  await expect(
    report.getByRole('link', { name: 'Last 12 months' }),
  ).toHaveAttribute('aria-current', 'true');
  await expect(
    report.getByRole('link', { name: 'Download monthly collection CSV' }),
  ).toHaveAttribute('href', '/api/billing/monthly-collection?period=12m');

  await page.goto('/fixtures/admin-reports?view=collection&state=committee');
  await expect(
    page.getByRole('link', { name: 'Download monthly collection CSV' }),
  ).toHaveCount(0);
});

test('lists units with unpaid dues and asks before downloading contact details', async ({
  page,
}) => {
  await page.goto('/fixtures/admin-reports?view=follow-up');
  await expect(
    page.getByText('Purpose: dues follow-up by the admin.', { exact: false }),
  ).toBeVisible();
  const table = page.getByRole('table', { name: 'Dues follow-up' });
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByRole('link', { name: 'A-101' })).toHaveAttribute(
    'href',
    /\/admin\/billing\/units\/4b1f6a0e/,
  );
  await expect(table).toContainText('A payment is awaiting confirmation');
  await expect(table).toContainText('No active owner or tenant');

  await page
    .getByRole('button', { name: 'Download follow-up list CSV' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Download contact details?',
  });
  await expect(dialog).toContainText('Keep it private');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);

  await page.goto('/fixtures/admin-reports?view=follow-up&state=empty');
  await expect(page.getByText('No unpaid dues')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download follow-up list CSV' }),
  ).toHaveCount(0);
});

test('summarises meetings and lists open action items by person without ranking', async ({
  page,
}) => {
  await page.goto('/fixtures/admin-reports?view=meeting');
  await expect(
    page.getByRole('heading', { name: 'Meeting summary' }),
  ).toBeVisible();
  await expect(page.getByText('62.5%')).toBeVisible();
  const owners = page.getByRole('table', {
    name: 'Open action items by person',
  });
  await expect(owners.getByRole('row')).toHaveCount(3);
  await expect(owners.getByRole('row').nth(1)).toContainText('Ravi Shah');

  await page.goto('/fixtures/admin-reports?view=meeting&state=empty');
  await expect(page.getByText('No open action items')).toBeVisible();
  await expect(page.getByText('Not available')).toBeVisible();
});

test('translates the new reports into Hindi', async ({ page }) => {
  await page.goto('/fixtures/admin-reports?view=meeting&locale=hi');
  await expect(page.getByRole('heading', { name: 'बैठक सारांश' })).toBeVisible();
  await page.goto('/fixtures/admin-reports?view=collection&locale=hi');
  await expect(page.getByRole('heading', { name: 'मासिक वसूली' })).toBeVisible();
});
