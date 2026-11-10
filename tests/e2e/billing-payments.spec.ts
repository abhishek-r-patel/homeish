// Check synthetic UPI payment submission, admin review, upload failures and download denial.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'PUT, OPTIONS',
  'access-control-allow-headers': 'content-type, x-upsert',
};

const screenshot = {
  name: 'synthetic-payment.png',
  mimeType: 'image/png',
  buffer: Buffer.from('synthetic image content'),
};

async function storageOrigin(page: Page) {
  const origin = await page.locator('main').getAttribute('data-storage-origin');
  if (!origin) throw new Error('The fixture did not expose a storage origin.');
  return origin;
}

async function mockUpload(page: Page, origin: string, putStatus = 200) {
  await page.route('**/api/files/upload-url', (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          path: 'synthetic/payment-proof.png',
          signedUrl: `${origin}/storage/v1/object/upload/sign/payment-proofs/synthetic?token=fixture`,
        },
      },
    }),
  );
  await page.route(`${origin}/storage/v1/object/upload/sign/**`, (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : putStatus,
      headers: corsHeaders,
      body: '',
    }),
  );
}

test('resident pays by UPI and an admin confirms with a corrected amount', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/fixtures/billing-payments');
  await expect(
    page.getByRole('heading', { name: 'Pay maintenance', exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 900 });

  await page.getByRole('button', { name: 'Copy UPI ID', exact: true }).click();
  await expect(page.getByText('UPI ID copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'homeish-fixture@example',
  );

  const amount = page.getByLabel('Amount paid');
  await expect(amount).toHaveValue('2500.00');
  const payLink = page.getByRole('link', {
    name: 'Pay with UPI App',
    exact: true,
  });
  await expect(payLink).toHaveAttribute('href', /^upi:\/\/pay\?.*am=2500\.00/);
  await amount.fill('1200');
  await expect(payLink).toHaveAttribute('href', /am=1200\.00/);
  await expect(payLink).toHaveAttribute('href', /pa=homeish-fixture%40example/);

  const reference = page.getByLabel('UPI reference number');
  await reference.fill('utr-4455 66ab');
  await expect(reference).toHaveValue('UTR445566AB');

  await mockUpload(page, await storageOrigin(page));
  await page.locator('input[type="file"]').first().setInputFiles(screenshot);
  await expect(
    page.getByRole('progressbar', {
      name: `Upload progress for ${screenshot.name}`,
    }),
  ).toHaveJSProperty('value', 100);

  await page
    .getByRole('button', { name: 'Submit Payment Details', exact: true })
    .click();
  await expect(reference).toHaveValue('');

  const queue = page.getByRole('list', {
    name: 'Payments awaiting confirmation',
  });
  const submitted = queue.getByRole('listitem').filter({
    hasText: 'UTR445566AB',
  });
  await expect(submitted).toContainText('Rs. 1200.00');
  await expect(submitted.getByText(/^Waiting \d+ days?$/)).toHaveCount(0);
  await expect(
    queue
      .getByRole('listitem')
      .filter({ hasText: 'OLDREF123456' })
      .getByText('Waiting 10 days', { exact: true }),
  ).toBeVisible();

  await submitted.getByRole('button', { name: 'Confirm', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Confirm payment',
    exact: true,
  });
  await dialog.getByLabel('Corrected amount (optional)').fill('1150');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog
    .getByRole('button', { name: 'Confirm Payment', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText(
      'Confirmed UTR445566AB for Rs. 1150.00 · receipt RCPT-FIX-0001',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(queue.getByText('UTR445566AB')).toHaveCount(0);
});

test('admin rejection requires a reason and committee members only view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/fixtures/billing-payments');
  const stale = page
    .getByRole('list', { name: 'Payments awaiting confirmation' })
    .getByRole('listitem')
    .filter({ hasText: 'OLDREF123456' });
  await stale.getByRole('button', { name: 'Reject', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Reject payment',
    exact: true,
  });
  const rejectButton = dialog.getByRole('button', {
    name: 'Reject Payment',
    exact: true,
  });
  await expect(rejectButton).toBeDisabled();
  await dialog.getByLabel('Reason').fill('Reference not found in statement');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await rejectButton.click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText('Rejected OLDREF123456: Reference not found in statement', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('No payments are waiting for confirmation.', {
      exact: true,
    }),
  ).toBeVisible();

  await page.goto('/fixtures/billing-payments?role=committee');
  await expect(page.getByText('OLDREF123456')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Reject', exact: true }),
  ).toHaveCount(0);
});

test('resubmission shows the rejection reason and failures stay visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/fixtures/billing-payments?resubmit=1&fail=submit');
  await expect(
    page.getByText('The UPI reference did not match the bank statement.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('UPI reference number').fill('UTR987654');
  await page
    .getByRole('button', { name: 'Submit Payment Details', exact: true })
    .click();
  await expect(
    page.getByText('The synthetic payment could not be submitted.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Reference: fixture-reference', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('UPI reference number')).toHaveValue(
    'UTR987654',
  );

  await page.goto('/fixtures/billing-payments');
  await page.getByLabel('UPI reference number').fill('ABC');
  await page
    .getByRole('button', { name: 'Submit Payment Details', exact: true })
    .click();
  await expect(
    page.getByText('Enter 6 to 30 letters or numbers.').first(),
  ).toBeVisible();
  await page.getByLabel('UPI reference number').fill('OLDREF123456');
  await page
    .getByRole('button', { name: 'Submit Payment Details', exact: true })
    .click();
  await expect(
    page.getByText('This UPI reference has already been submitted.', {
      exact: true,
    }),
  ).toBeVisible();
});

test('failed screenshot uploads are explicit and can be retried', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/fixtures/billing-payments');
  const origin = await storageOrigin(page);
  let issueFailures = 1;
  await page.route('**/api/files/upload-url', async (route) => {
    if (issueFailures > 0) {
      issueFailures -= 1;
      await route.fulfill({
        status: 500,
        json: { ok: false, error: { code: 'INTEGRATION_FAILED' } },
      });
      return;
    }
    await route.fallback();
  });
  await page.locator('input[type="file"]').first().setInputFiles(screenshot);
  await expect(
    page
      .getByText(
        'The screenshot upload link could not be issued. Retry, or submit without a screenshot.',
        { exact: true },
      )
      .last(),
  ).toBeVisible();

  await page.unroute('**/api/files/upload-url');
  await mockUpload(page, origin, 500);
  await page
    .getByRole('button', { name: `Retry ${screenshot.name}`, exact: true })
    .click();
  await expect(
    page
      .getByText('The screenshot could not be uploaded. Retry.', {
        exact: true,
      })
      .last(),
  ).toBeVisible();

  await page.unroute('**/api/files/upload-url');
  await page.unroute(`${origin}/storage/v1/object/upload/sign/**`);
  await mockUpload(page, origin);
  await page
    .getByRole('button', { name: `Retry ${screenshot.name}`, exact: true })
    .click();
  await expect(
    page.getByRole('progressbar', {
      name: `Upload progress for ${screenshot.name}`,
    }),
  ).toHaveJSProperty('value', 100);
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('bill PDF and receipt downloads deny anonymous requests without details', async ({
  request,
}) => {
  const id = '7c4b2a1e-0d9f-4e8c-b7a6-5f4e3d2c1b0a';
  for (const path of [
    `/api/billing/bills/${id}`,
    `/api/billing/receipts/${id}`,
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.text();
    expect(body).not.toMatch(/stack|at \w+ \(|supabase|postgres/i);
    expect(JSON.parse(body)).toMatchObject({ ok: false });
  }
});
