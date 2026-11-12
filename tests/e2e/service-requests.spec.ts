// Verify resident request creation, photos, comments, close, rating and responsive access.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'PUT, OPTIONS',
  'access-control-allow-headers': 'content-type, x-upsert',
};

const photo = {
  name: 'request-photo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('synthetic request photo'),
};

async function storageOrigin(page: Page) {
  const origin = await page.locator('main').getAttribute('data-storage-origin');
  if (!origin) throw new Error('The fixture did not expose a storage origin.');
  return origin;
}

async function mockUpload(page: Page, origin: string) {
  await page.route('**/api/files/upload-url', async (route) => {
    const body = route.request().postDataJSON() as {
      bucket: string;
      requestId: string;
    };
    expect(body.bucket).toBe('request-files');
    await route.fulfill({
      json: {
        ok: true,
        data: {
          path: `4a696d6f-774c-41d1-ae47-6254d4a8f4cf/8a696d6f-774c-41d1-ae47-6254d4a8f4cf/requests/${body.requestId}/44a696d6-774c-41d1-ae47-6254d4a8f4cf.jpg`,
          signedUrl: `${origin}/storage/v1/object/upload/sign/request-files/fixture?token=fixture`,
        },
      },
    });
  });
  await page.route(`${origin}/storage/v1/object/upload/sign/**`, (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      headers: corsHeaders,
      body: '',
    }),
  );
}

test('resident submits a request and follows its lifecycle accessibly', async ({
  page,
}) => {
  await page.goto('/fixtures/service-requests');
  await expect(
    page.getByRole('heading', { name: 'Service requests', exact: true }),
  ).toBeVisible();

  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 900 });

  await page.getByLabel('Category').selectOption({ label: 'Plumbing' });
  await page.getByLabel('My unit').check();
  await page.locator('#request-unit').selectOption({ label: 'A · A-101' });
  await page
    .getByLabel('Describe the issue')
    .fill('The kitchen tap is leaking.');

  const origin = await storageOrigin(page);
  await mockUpload(page, origin);
  await page.getByLabel('Photos (optional, up to 3)').setInputFiles(photo);
  await expect(page.getByText('Request photos uploaded.')).toBeVisible();
  await expect(page.getByText('Photo attached')).toBeVisible();

  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(
    page.getByText('Your request was submitted.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('The kitchen tap is leaking.')).toBeVisible();

  await page.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(page.getByRole('region', { name: 'Plumbing' })).toContainText(
    'Resolved',
  );
  await page.getByRole('button', { name: 'Close request' }).click();
  await expect(page.getByRole('region', { name: 'Plumbing' })).toContainText(
    'Closed',
  );
  await page.getByLabel('Rating').selectOption('4');
  await page.getByRole('button', { name: 'Submit rating' }).click();
  await expect(page.getByText('Rated 4 stars.', { exact: true })).toBeVisible();

  await page.locator('#fixture-comment').fill('Thank you for fixing this.');
  await page.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.getByText('Thank you for fixing this.')).toBeVisible();
  await expect(
    page.getByText('Your comment was added.', { exact: true }),
  ).toBeVisible();
});

test('administrator creates a category accessibly', async ({ page }) => {
  await page.goto('/fixtures/service-requests-admin');

  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }

  await page.getByLabel('Name').first().fill('Electrical');
  await page.getByLabel('SLA target (hours, optional)').first().fill('12');
  await page.getByLabel('Display order').first().fill('1');
  await page.getByRole('button', { name: 'Add category' }).click();

  await expect(
    page.getByText('The request category was saved.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Electrical', exact: true }),
  ).toBeVisible();
});
