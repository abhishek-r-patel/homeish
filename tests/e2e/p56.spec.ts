import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('switches flats and completes the atomic import stepper accessibly', async ({
  page,
}) => {
  await page.goto('/fixtures/p56');
  await page.locator('summary[aria-label^="Choose place:"]').click();
  await page.getByRole('button', { name: 'B-202 · My home' }).click();
  await expect(page.getByText('Showing B-202 · My home')).toBeVisible();

  await page.getByLabel('Vehicles CSV file').setInputFiles({
    name: 'vehicles.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'block,unit,email,vehicle_type,registration_number,tag_number\n',
    ),
  });
  await page.getByRole('button', { name: 'Check rows' }).click();
  await expect(page.getByText('1 rows checked · 0 issues')).toBeVisible();
  await page.getByRole('button', { name: 'Save all' }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm CSV import' });
  await dialog.getByRole('button', { name: 'Save all rows' }).click();
  await expect(page.getByText('1 rows were saved together.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
