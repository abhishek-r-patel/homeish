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

test('P41 audit warning and AGM draft forms stay usable on phones', async ({
  page,
}) => {
  await page.goto('/fixtures/expense');
  const p41 = page.getByRole('region', { name: 'P41 audit and AGM' });
  await p41.getByRole('checkbox', { name: /I understand the warning/ }).check();
  await p41.getByRole('button', { name: 'Acknowledge and continue' }).click();
  await expect(p41.getByRole('status')).toContainText('Warning acknowledged');

  await p41.getByText('Audit year', { exact: true }).click();
  const auditYear = p41
    .locator('details')
    .filter({ hasText: 'Audit year' })
    .first();
  await auditYear.getByLabel('Auditor name').fill('Synthetic Auditor');
  await auditYear.getByLabel('Firm').fill('Synthetic Firm');
  await auditYear.getByLabel('Appointment date').fill('2026-04-20');
  await auditYear
    .getByLabel('Appointment decision reference')
    .fill('AGM/2026/1');
  await auditYear.getByRole('button', { name: 'Start audit year' }).click();
  await expect(auditYear.getByRole('status')).toContainText('Audit year saved');

  await p41.getByRole('button', { name: /Add written section/ }).click();
  await p41.getByLabel('Title (required)').fill('Treasurer note');
  await p41.getByLabel('Text (required)').fill('Synthetic AGM draft text.');
  await p41.getByRole('button', { name: 'Create AGM draft' }).click();
  await expect(
    p41.getByRole('status').filter({ hasText: 'AGM draft' }),
  ).toContainText('AGM draft saved');

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('P42 category, mapping and savings controls stay usable on phones', async ({
  page,
}) => {
  await page.goto('/fixtures/expense-p42');
  const category = page.getByRole('region', {
    name: 'Category reporting details',
  });
  await category.getByLabel('Reporting group').fill('Maintenance');
  await category.getByLabel('Owner').selectOption({
    label: 'Synthetic Committee',
  });
  await category
    .getByRole('button', { name: 'Save reporting details' })
    .click();
  await expect(category.getByRole('status')).toContainText(
    'Category details saved',
  );

  const mapping = page.getByRole('region', { name: 'Vendor mapping' });
  await mapping.getByRole('button', { name: 'Confirm mapping' }).click();
  await expect(mapping.getByRole('status')).toContainText(
    'Payee mapped to vendor',
  );

  const savings = page.getByRole('region', { name: 'Savings controls' });
  await savings.getByRole('button', { name: 'Save initiative' }).click();
  await expect(
    savings.getByRole('status').filter({ hasText: 'Savings initiative' }),
  ).toContainText('Savings initiative saved');
  await savings.getByLabel('Status').selectOption('approved');
  await savings.getByRole('button', { name: 'Change status' }).click();
  await expect(
    savings.getByRole('status').filter({ hasText: 'Savings status' }),
  ).toContainText('Savings status changed');
  await savings.getByLabel('Realised saving').fill('250');
  await savings.getByLabel('Evidence note').fill('Synthetic invoice saving');
  await savings
    .getByLabel('Source record (optional)')
    .selectOption('entry:00000000-0000-4000-8000-000000000106');
  await savings.getByRole('button', { name: 'Add evidence' }).click();
  await expect(
    savings.getByRole('status').filter({ hasText: 'Savings evidence' }),
  ).toContainText('Savings evidence added');

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('fund opening requires acknowledgement and stays within the Accounts total', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/fixtures/expense');
  const funds = page.getByRole('region', { name: 'Funds' });
  await funds.getByLabel('Fund name').fill('Major repairs');
  await funds.getByRole('button', { name: 'Add fund' }).click();
  const activate = funds.getByRole('button', {
    name: 'Activate fund tracking',
  });
  await expect(activate).toBeDisabled();
  await funds.getByLabel('Major repairs').fill('100000.01');
  const acknowledgement = funds.getByRole('checkbox', {
    name: /Fund tracking allocates the existing Accounts total/,
  });
  await acknowledgement.locator('..').click();
  await expect(acknowledgement).toBeChecked();
  await expect(activate).toBeDisabled();
  await funds.getByLabel('Major repairs').fill('40000');
  await expect(activate).toBeEnabled();
  await activate.click();
  await expect(funds).toContainText('Fund tracking is active.');
  const suggestion = funds.getByRole('checkbox', { name: /RV\// });
  await suggestion.locator('..').click();
  await expect(suggestion).toBeChecked();
  await funds
    .getByRole('button', { name: 'Confirm selected suggestions' })
    .click();
  await expect(funds).toContainText('Confirmed allocation: Major repairs');
  const allocationCorrection = funds.getByRole('region', {
    name: 'Allocation correction',
  });
  await allocationCorrection.getByLabel('Major repairs').fill('30000');
  await allocationCorrection
    .getByLabel('Reason')
    .fill('Bank reconciliation corrected');
  await allocationCorrection
    .getByRole('button', { name: 'Save correction' })
    .click();
  await expect(allocationCorrection.getByRole('status')).toContainText(
    'Fund allocation corrected.',
  );
  await funds.getByRole('button', { name: 'Simulate opening review' }).click();
  const openingReview = funds.getByRole('region', { name: 'Opening review' });
  await expect(openingReview).toContainText('Opening needs review');
  await openingReview.getByLabel('Major repairs').fill('45000');
  await openingReview.getByLabel('Reason').fill('Opening reviewed after entry');
  await openingReview
    .getByRole('button', { name: 'Re-confirm opening' })
    .click();
  await expect(openingReview).toHaveCount(0);

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('own-account transfers pair and reverse without becoming income or expense', async ({
  page,
}) => {
  await page.goto('/fixtures/expense');
  const setup = page.getByRole('region', { name: 'Add account' });
  await setup.getByLabel('Account name').fill('Main bank');
  await setup.getByLabel('Opening balance').fill('100000');
  await setup.getByRole('button', { name: 'Add account' }).click();
  await setup.getByLabel('Account name').fill('Fixed deposit');
  await setup.getByLabel('Account type').selectOption('deposit');
  await setup.getByLabel('Opening balance').fill('0');
  await setup.getByRole('button', { name: 'Add account' }).click();

  const transfer = page.getByRole('region', { name: 'Transfer' });
  await transfer
    .getByLabel('From account')
    .selectOption({ label: 'Main bank (Bank)' });
  await transfer
    .getByLabel('To account')
    .selectOption({ label: 'Fixed deposit (Deposit)' });
  await transfer.getByLabel('Amount', { exact: false }).fill('25000');
  await transfer.getByRole('button', { name: 'Record transfer' }).click();
  await expect(transfer).toContainText('Main bank to Fixed deposit');

  const balances = page.getByRole('region', { name: 'Balances' });
  await expect(balances).toContainText('Main bank balance: Rs. 75000.00');
  await expect(balances).toContainText('Fixed deposit balance: Rs. 25000.00');
  await transfer.getByLabel('Reason').fill('Deposit cancelled');
  await transfer
    .getByRole('button', { name: 'Reverse both transfer entries' })
    .click();
  await expect(balances).toContainText('Main bank balance: Rs. 100000.00');
  await expect(balances).toContainText('Fixed deposit balance: Rs. 0.00');

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
