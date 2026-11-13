// Check synthetic billing setup interactions, role visibility and phone accessibility.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('billing setup fits phones and remains accessible through charge editing', async ({
  page,
}) => {
  await page.goto('/fixtures/billing');
  await expect(
    page.getByRole('heading', { name: 'Billing setup', exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page
    .getByRole('button', { name: 'Add Charge Type', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Add charge type',
    exact: true,
  });
  await page.getByLabel('Charge name').fill('Area maintenance');
  await page.getByLabel('Calculation method').selectOption('per_sqft');
  await page.getByLabel('Rate per square foot (INR)').fill('1.25');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog
    .getByRole('button', { name: 'Create Charge Type', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText('Per square foot - INR 1.25', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit Area maintenance', exact: true })
    .click();
  await page.getByLabel('Active for future bill generation').uncheck();
  await page
    .getByRole('button', { name: 'Save Charge Type', exact: true })
    .click();
  await expect(page.getByText('Inactive', { exact: true })).toBeVisible();
});

test('payment changes require confirmation and retain a visible success outcome', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/fixtures/billing?tab=payment-settings');
  await page.getByLabel('Society UPI ID').fill('homeish-updated@example');
  await page.getByLabel('Payee name').fill('Updated Synthetic Society');
  await page
    .getByRole('button', { name: 'Review Payment Details', exact: true })
    .click();
  const confirmation = page.getByRole('dialog', {
    name: 'Change society payment details?',
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await expect(
    confirmation.getByText('homeish-updated@example', { exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await confirmation
    .getByRole('button', { name: 'Save Payment Details', exact: true })
    .click();
  await expect(confirmation).not.toBeVisible();
  await expect(
    page.getByText(
      'Synthetic payment details saved and the society team notified.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText('homeish-updated@example', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test('society admins can set per-society due day and rounding preferences', async ({
  page,
}) => {
  await page.goto('/fixtures/billing');
  await page.getByLabel('Monthly due date').selectOption('last_day');
  await page.getByLabel('Per-square-foot rounding').selectOption('paise');
  await page
    .getByRole('button', { name: 'Save Society Preferences', exact: true })
    .click();
  await expect(
    page.getByText('Synthetic society billing preferences saved.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Monthly due date')).toHaveValue('last_day');
  await expect(page.getByLabel('Per-square-foot rounding')).toHaveValue(
    'paise',
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('failed saves preserve input and unsaved tab changes require explicit discard', async ({
  page,
}) => {
  await page.goto('/fixtures/billing?tab=payment-settings&fail=payment');
  await page.getByLabel('Society UPI ID').fill('homeish-retry@example');
  await page
    .getByRole('button', { name: 'Review Payment Details', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save Payment Details', exact: true })
    .click();
  await expect(
    page.getByText('fixture-reference', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Society UPI ID')).toHaveValue(
    'homeish-retry@example',
  );
  await page.getByRole('tab', { name: 'Charge Types', exact: true }).click();
  const leave = page.getByRole('dialog', { name: 'Leave without saving?' });
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Society UPI ID')).toHaveValue(
    'homeish-retry@example',
  );
  await page.getByRole('tab', { name: 'Charge Types', exact: true }).click();
  await page
    .getByRole('button', { name: 'Leave Without Saving', exact: true })
    .click();
  await expect(
    page.getByRole('tab', { name: 'Charge Types', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('committee setup stays read-only across both tabs', async ({ page }) => {
  await page.goto('/fixtures/billing?role=committee');
  await expect(
    page.getByText(
      'Read-only access. Only administrators can change billing setup.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add Charge Type', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('tab', { name: 'Payment Settings', exact: true })
    .click();
  await expect(page.getByLabel('Society UPI ID')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Review Payment Details', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('homeish-fixture@example', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Monthly due date')).toHaveCount(0);
  await expect(page.getByLabel('Per-square-foot rounding')).toHaveCount(0);
  await expect(
    page.getByText('Day 10 of each month', { exact: true }),
  ).toBeVisible();
});

test('failed QR uploads are explicit and cannot be silently saved', async ({
  page,
}) => {
  await page.route('**/api/files/upload-url', (route) =>
    route.fulfill({
      status: 500,
      json: { ok: false, error: { code: 'INTEGRATION_FAILED' } },
    }),
  );
  await page.goto('/fixtures/billing?tab=payment-settings');
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'synthetic-qr.png',
      mimeType: 'image/png',
      buffer: Buffer.from('synthetic image content'),
    });
  await expect(
    page
      .getByText(
        'The QR image upload link could not be issued. Remove any unused upload and retry.',
        { exact: true },
      )
      .last(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Review Payment Details', exact: true }),
  ).toBeDisabled();
});
