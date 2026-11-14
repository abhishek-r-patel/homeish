// Verify fractional inventory entries, validation, retry safety and phone accessibility.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('inventory controls preserve exact quantities and safely retry a lost response', async ({
  page,
}) => {
  await page.goto('/fixtures/housekeeping');
  const definition = page.getByRole('region', { name: 'Item definition' });
  await definition
    .getByLabel('Item name (required)', { exact: true })
    .fill('Cleaning liquid');
  await definition.getByLabel('Unit of measure').fill('litres');
  await definition.getByLabel('Minimum stock level').fill('0.250');
  await definition.getByRole('button', { name: 'Add inventory item' }).click();
  await expect(definition.getByText('Inventory item saved.')).toBeVisible();
  const stock = page.getByRole('region', { name: 'Stock recording' });
  await stock.getByLabel('Quantity (required)', { exact: true }).fill('0.500');
  await stock.getByLabel('Simulate a lost response').check();
  await stock.getByRole('button', { name: 'Record stock transaction' }).click();
  await expect(stock.getByRole('alert')).toContainText(
    'Could not reach the server',
  );
  await expect(
    stock.getByText('Current stock: 0.500 litres', { exact: true }),
  ).toBeVisible();
  await stock.getByRole('button', { name: 'Record stock transaction' }).click();
  await expect(
    stock.getByText('Stock transaction recorded.', { exact: true }),
  ).toBeVisible();
  await expect(
    stock.getByText('Current stock: 0.500 litres', { exact: true }),
  ).toBeVisible();

  await stock.getByLabel('Transaction type').selectOption('out');
  await stock.getByLabel('Quantity (required)', { exact: true }).fill('1');
  await stock.getByLabel('Issued to / purpose').fill('Lobby cleaning');
  await stock.getByRole('button', { name: 'Record stock transaction' }).click();
  await expect(stock.getByRole('alert')).toContainText('make stock negative');
  await stock.getByLabel('Quantity (required)', { exact: true }).fill('0.100');
  await stock.getByRole('button', { name: 'Record stock transaction' }).click();
  await expect(
    stock.getByText('Current stock: 0.400 litres', { exact: true }),
  ).toBeVisible();
  await stock.getByLabel('Transaction type').selectOption('adjustment');
  await stock.getByLabel('Signed adjustment quantity').fill('-0.200');
  await stock
    .getByLabel('Adjustment reason')
    .fill('Correct receipt measurement');
  await stock.getByRole('button', { name: 'Record stock transaction' }).click();
  await expect(
    stock.getByText('Current stock: 0.200 litres', { exact: true }),
  ).toBeVisible();
  await expect(stock.getByText('Low stock', { exact: true })).toBeVisible();

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
