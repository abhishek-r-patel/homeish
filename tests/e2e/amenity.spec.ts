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
