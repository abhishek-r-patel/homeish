// Verify account setup, threshold approval, reversals, vouchers, bank reconciliation,
// petty-cash counts, mobile layout and accessibility.
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

test('book entries carry vouchers, statement items match or cancel and petty cash counts show differences', async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/fixtures/expense');
  const setup = page.getByRole('region', { name: 'Add account' });
  await setup.getByLabel('Account name').fill('Main bank');
  await setup.getByLabel('Opening balance').fill('100000');
  await setup.getByRole('button', { name: 'Add account' }).click();
  const record = page.getByRole('region', { name: 'Record expense' });
  await record.getByLabel('Paid to').fill('Plumber');
  await record.getByLabel('Amount', { exact: false }).first().fill('1000');
  await record.getByLabel('Payment mode').selectOption('bank');
  await record.getByRole('button', { name: 'Record expense' }).click();
  const book = page.getByRole('region', { name: 'Book' });
  await expect(book.getByText(/^Voucher PV\/\d{4}-\d{2}\/1$/)).toBeVisible();

  const reconciliation = page.getByRole('region', { name: 'Reconciliation' });
  await reconciliation.getByLabel('Money').selectOption('out');
  await reconciliation.getByLabel('Amount', { exact: false }).fill('1000');
  await reconciliation.getByLabel('Reference').fill('UTR-1');
  await reconciliation
    .getByRole('button', { name: 'Add statement item' })
    .click();
  const items = reconciliation.getByRole('listitem');
  await expect(items.first()).toContainText('Rs. 1000.00: unmatched');
  await items.first().getByRole('button', { name: 'Match' }).click();
  await expect(items.first()).toContainText(/Matched to PV\/\d{4}-\d{2}\/1/);

  await reconciliation.getByLabel('Money').selectOption('in');
  await reconciliation.getByLabel('Amount', { exact: false }).fill('500');
  await reconciliation
    .getByRole('button', { name: 'Add statement item' })
    .click();
  await expect(items.nth(1)).toContainText('Rs. 500.00: unmatched');
  await expect(items.nth(1).getByRole('button', { name: 'Match' })).toHaveCount(
    0,
  );
  await items.nth(1).getByLabel('Reason for cancelling').fill('Bank error');
  await items.nth(1).getByRole('button', { name: 'Cancel item' }).click();
  await expect(items.nth(1)).toContainText('Cancelled: Bank error');

  const petty = page.getByRole('region', { name: 'Petty cash' });
  await petty
    .getByLabel('Custodian')
    .selectOption({ label: 'Synthetic Guard' });
  await petty.getByRole('button', { name: 'Set custodian' }).click();
  await expect(petty).toContainText('Custodian: Synthetic Guard');
  await petty.getByLabel('Cash counted').fill('4880');
  await petty.getByRole('button', { name: 'Record count' }).click();
  await expect(petty.getByRole('listitem').first()).toHaveText(
    'Count (routine): Rs. 120.00 short',
  );
  await petty
    .getByLabel('Custodian')
    .selectOption({ label: 'Synthetic Resident' });
  await petty.getByLabel('Handover count').fill('5000');
  await petty.getByRole('button', { name: 'Change custodian' }).click();
  await expect(petty).toContainText('Custodian: Synthetic Resident');
  await expect(petty.getByRole('listitem').first()).toHaveText(
    'Count (handover): Matches the book',
  );

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
