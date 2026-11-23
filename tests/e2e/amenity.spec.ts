// Verify rules acknowledgement, immutable fee snapshots and full-credit cancellation controls.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
test('amenity bookings retain accepted rules and fees when an administrator changes the schedule', async ({
  page,
}) => {
  await page.goto('/fixtures/amenity');
  page.on('dialog', (dialog) => void dialog.accept());
  const definition = page.getByRole('region', { name: 'Amenity definition' });
  await definition.getByLabel('Amenity name').fill('Hall');
  await definition.getByLabel('Maximum guests per booking').fill('4');
  await definition.getByLabel('Fee per booking').fill('123.45');
  await definition
    .getByLabel('Refundable deposit in rupees (0 to turn off)')
    .fill('500');
  await definition
    .getByLabel('Require the full deposit before confirmation')
    .check();
  await definition
    .getByLabel('Amenity rules', { exact: true })
    .fill('No shoes');
  await definition
    .getByRole('button', { name: 'Add amenity', exact: true })
    .click();
  const resident = page.getByRole('region', { name: 'Resident booking' });
  await resident.getByLabel('Guest count').fill('2');
  await resident
    .getByRole('button', { name: 'Confirm exclusive booking' })
    .click();
  await expect(
    page.getByText('Ledger entries: 0', { exact: true }),
  ).toBeVisible();
  await resident.getByLabel('I acknowledge the current amenity rules').check();
  await resident
    .getByRole('button', { name: 'Confirm exclusive booking' })
    .click();
  await expect(
    page.getByText('Status: confirmed', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Ledger balance: Rs. 123.45', { exact: true }),
  ).toBeVisible();
  await definition.getByLabel('Fee per booking').fill('0');
  await definition
    .getByLabel('Amenity rules', { exact: true })
    .fill('New rules');
  await definition.getByLabel('Slot end (society local time)').fill('11:00');
  await definition
    .getByRole('button', { name: 'Save amenity', exact: true })
    .click();
  await expect(
    page.getByText('Snapshot fee: Rs. 123.45', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Accepted rules: No shoes', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Snapshot time: 09:00 to 10:00', { exact: true }),
  ).toBeVisible();
  const adminCancel = page.getByRole('region', {
    name: 'Administrator cancellation',
  });
  await adminCancel
    .getByLabel('Administrator cancellation reason')
    .fill('Maintenance closure');
  await adminCancel
    .getByRole('button', { name: 'Cancel booking', exact: true })
    .click();
  await expect(
    page.getByText('Status: cancelled', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Ledger entries: 2', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Ledger balance: Rs. 0.00', { exact: true }),
  ).toBeVisible();
  await expect(
    resident.getByLabel('I acknowledge the current amenity rules'),
  ).not.toBeChecked();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('P52 calendar and facility controls preserve privacy and source boundaries', async ({
  page,
}) => {
  await page.goto('/fixtures/amenity');

  await expect(
    page.getByText('Synthetic Resident', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Occupied; identity is not available in this calendar.'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Data-integrity warning: this booking overlaps another confirmed booking. Existing booking rules were not changed.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Previous month' }),
  ).toHaveAttribute('href', '/fixtures/amenity?month=2026-10');

  await page
    .getByLabel('Resident calendar identity')
    .selectOption('booker_name_and_unit');
  await page
    .getByRole('button', { name: 'Save amenity calendar visibility' })
    .click();
  await expect(page.getByText(/Calendar visibility saved:/)).toBeVisible();
  await page
    .getByLabel('Booking confirmation when a deposit is configured')
    .selectOption('immediate');
  await page
    .getByRole('button', { name: 'Save deposit confirmation policy' })
    .click();
  await expect(
    page.getByText('Amenity deposit confirmation policy saved.'),
  ).toBeVisible();

  await page
    .getByLabel('Existing source')
    .selectOption(`asset:${'9a696d6f-774c-41d1-ae47-6254d4a8f4cf'}`);
  await page.getByLabel('Activity').selectOption('issue');
  await page.getByLabel('Event time').fill('2026-11-22T10:00');
  await page.getByRole('button', { name: 'Record facility activity' }).click();
  await expect(page.getByText('Facility activity recorded.')).toBeVisible();

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
