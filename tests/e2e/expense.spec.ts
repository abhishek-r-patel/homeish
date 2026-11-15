// Verify account setup, threshold approval, reversals, mobile layout and accessibility.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('expenses above the threshold wait for approval and posted entries reverse', async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/fixtures/expense');
  const setup = page.getByRole('region', { name: 'Add account' });
  await setup.getByLabel('Account name').fill('Main bank');
  await setup.getByLabel('Opening balance').fill('12.345');
  await setup.getByRole('button', { name: 'Add account' }).click();
  await expect(setup.getByRole('alert')).toContainText('two decimal places');
  await setup.getByLabel('Opening balance').fill('100000');
  await setup.getByRole('button', { name: 'Add account' }).click();
  const balances = page.getByRole('region', { name: 'Balances' });
  await expect(balances).toContainText('Main bank balance: Rs. 100000.00');

  const record = page.getByRole('region', { name: 'Record expense' });
  await record.getByLabel('Paid to').fill('Lift vendor');
  await record.getByLabel('Amount', { exact: false }).first().fill('60000');
  await record.getByLabel('Payment mode').selectOption('cash');
  await record.getByRole('button', { name: 'Record expense' }).click();
  await expect(record.getByRole('alert')).toContainText('cash account');
  await record.getByLabel('Payment mode').selectOption('bank');
  await record.getByRole('button', { name: 'Record expense' }).click();
  await expect(
    record.getByRole('status').filter({ hasText: 'Expense' }),
  ).toContainText('committee approval');
  const pending = page.getByRole('region', { name: 'Pending approval' });
  await expect(pending).toContainText('Pending: Lift vendor');
  await expect(balances).toContainText('Rs. 100000.00');
  await pending.getByRole('button', { name: 'Approve and post' }).click();
  await expect(balances).toContainText('Main bank balance: Rs. 40000.00');

  const book = page.getByRole('region', { name: 'Book' });
  await book.getByLabel('Reason').fill('Duplicate bill');
  await book.getByRole('button', { name: 'Record reversal' }).click();
  await expect(book).toContainText('Entry: Reversal of Paid Lift vendor');
  await expect(balances).toContainText('Main bank balance: Rs. 100000.00');

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
