// Verify composing a pinned block notice with an attachment, and the board, accessibly.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'PUT, OPTIONS',
  'access-control-allow-headers': 'content-type, x-upsert',
};

const attachment = {
  name: 'tank-schedule.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 synthetic notice attachment'),
};

async function mockUpload(page: Page) {
  const origin = await page.locator('main').getAttribute('data-storage-origin');
  if (!origin) throw new Error('The fixture did not expose a storage origin.');
  await page.route('**/api/files/upload-url', async (route) => {
    const body = route.request().postDataJSON() as {
      bucket: string;
      requestId: string;
    };
    expect(body.bucket).toBe('notice-files');
    await route.fulfill({
      json: {
        ok: true,
        data: {
          path: `4a696d6f-774c-41d1-ae47-6254d4a8f4cf/notices/${body.requestId}/44a696d6-774c-41d1-ae47-6254d4a8f4cf.pdf`,
          signedUrl: `${origin}/storage/v1/object/upload/sign/notice-files/fixture?token=fixture`,
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

test('manager publishes a pinned block notice that tops the board', async ({
  page,
}) => {
  await page.goto('/fixtures/notices');
  await expect(
    page.getByRole('heading', { name: 'Notice board', exact: true }),
  ).toBeVisible();

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 900 });

  await page.getByLabel('Title').fill('Lift maintenance');
  await page
    .getByLabel('Notice', { exact: true })
    .fill('The lifts in your block will be serviced on Saturday.');
  await page.getByLabel('Residents of chosen blocks').check();

  // Choosing blocks is required for a block notice.
  await page.getByRole('button', { name: 'Publish notice' }).click();
  await expect(
    page.getByRole('region', { name: 'New notice' }).getByRole('alert'),
  ).toContainText('Choose at least one block.');

  await page.getByLabel('A', { exact: true }).check();
  await page.getByLabel('Pin to the top as important').check();

  await mockUpload(page);
  await page
    .getByLabel('Attachment (optional: JPEG, PNG or PDF up to 5 MB)')
    .setInputFiles(attachment);
  await expect(page.getByText('Attachment uploaded.')).toBeVisible();
  await expect(page.getByText('tank-schedule.pdf')).toBeVisible();

  await page.getByRole('button', { name: 'Publish notice' }).click();
  await expect(
    page.getByText('The notice was published.', { exact: true }),
  ).toBeVisible();

  const items = page
    .getByRole('region', { name: 'Current notices' })
    .locator('li');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Lift maintenance');
  await expect(items.first()).toContainText('Pinned');
  await expect(items.first()).toContainText('New');
  await expect(items.first()).toContainText('Attachment');
  await expect(items.nth(1)).toContainText('Water tank cleaning');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
