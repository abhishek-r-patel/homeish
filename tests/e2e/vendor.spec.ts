// Verify vendor PAN privacy, warning-only blacklist behavior and the P47 registers.
import { expect, test } from './fixtures';

const blacklistedVendorId = 'fad55fc3-0751-4b79-86c1-5b3e25942392';

test('vendor PAN is visible only to an administrator', async ({ page }) => {
  await page.goto('/fixtures/vendor');
  await page.getByLabel('Fixture screen').selectOption('vendor');
  await expect(page.getByText('ABCDE1234F', { exact: true })).toBeVisible();

  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(page.getByText('ABCDE1234F', { exact: true })).toHaveCount(0);
});

test('vendor registers show contracts, checks, work orders and bills owed', async ({
  page,
}) => {
  await page.goto('/fixtures/vendor');
  const summary = page.getByRole('region', { name: 'Vendor summary' });
  await expect(summary.getByText('Bills owed', { exact: true })).toBeVisible();
  await expect(
    summary.getByRole('link', { name: /Renewals due/ }),
  ).toHaveAttribute('href', '#contracts');

  const contracts = page.locator('#contracts');
  await expect(
    contracts.getByRole('paragraph').filter({
      hasText: /^Security staff, 4 guards$/,
    }),
  ).toBeVisible();
  await expect(contracts.getByText(/Urgent$/)).toBeVisible();
  await expect(
    page.getByText(
      'Monthly staff-day checks. Record only; creates no bill or payment.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.locator('#work-orders').getByText(/Delay: —$/),
  ).toBeVisible();

  const bills = page.locator('#bills');
  await expect(bills.getByText(/Partly paid$/).first()).toBeVisible();
  await expect(bills.getByText(/Overdue$/).first()).toBeVisible();
  await expect(
    bills.getByText('Unlinked – not counted: Linked to the wrong bill.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    bills.getByText('Reversed – not counted', { exact: true }),
  ).toBeVisible();

  await contracts.getByText('Add a contract', { exact: true }).click();
  const addForm = contracts.locator('details[open]');
  await addForm.getByLabel('Vendor').selectOption({ index: 1 });
  await addForm.getByLabel('Scope').fill('Garden upkeep');
  await addForm.getByLabel('End date').fill('2027-11-19');
  await addForm.getByLabel('Annual value').fill('60000');
  await addForm.getByLabel('Payment frequency').selectOption('monthly');
  await addForm.getByRole('button', { name: 'Add contract' }).click();
  await expect(
    page.getByText('Contract saved. (synthetic, nothing saved)', {
      exact: true,
    }),
  ).toBeVisible();
});

test('committee members read vendor registers without write controls', async ({
  page,
}) => {
  await page.goto('/fixtures/vendor');
  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(
    page
      .locator('#contracts')
      .getByRole('paragraph')
      .filter({ hasText: /^Security staff, 4 guards$/ }),
  ).toBeVisible();
  for (const label of [
    'Add a contract',
    'Add an agency check',
    'Issue a work order',
    'Add a bill',
  ])
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
});

test('a failed register load shows a retry panel and keeps the other views', async ({
  page,
}) => {
  await page.goto('/fixtures/vendor');
  await page.getByLabel('Fixture scenario').selectOption('register_error');
  const contracts = page.locator('#contracts');
  await expect(contracts.getByRole('link', { name: 'Retry' })).toBeVisible();
  await expect(
    page.locator('#bills').getByText('INV-1042', { exact: false }).first(),
  ).toBeVisible();
});

test('a blacklisted vendor can still be quoted after its warning', async ({
  page,
}) => {
  await page.goto('/fixtures/vendor');
  await page.getByLabel('Fixture screen').selectOption('request');
  await page.getByLabel('Fixture scenario').selectOption('draft_rule_unmet');
  await page.getByLabel('Vendor').selectOption(blacklistedVendorId);

  await expect(
    page.getByText(
      'This quote can still be added, but review the blacklist reason before continuing.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Repeated missed appointments.', { exact: true }),
  ).toBeVisible();

  const addQuote = page.getByRole('button', { name: 'Add quote' });
  await expect(addQuote).toBeEnabled();
  await page.getByLabel('Quoted amount').fill('1400');
  await addQuote.click();
  await expect(
    page.getByText('Quote added. (synthetic, nothing saved)', { exact: true }),
  ).toBeVisible();
});
