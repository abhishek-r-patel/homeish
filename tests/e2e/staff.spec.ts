// Verify resident registration, administrator review and privacy-limited gate attendance.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const residentId = '8a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const staffId = '6a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'PUT, OPTIONS',
  'access-control-allow-headers': 'content-type, x-upsert',
};

async function mockStaffPhotoUpload(page: Page) {
  const origin = await page.locator('main').getAttribute('data-storage-origin');
  if (!origin) throw new Error('The fixture did not expose a storage origin.');
  await page.route('**/api/files/upload-url', async (route) => {
    const body = route.request().postDataJSON() as { bucket: string };
    expect(body.bucket).toBe('staff-photos');
    await route.fulfill({
      json: {
        ok: true,
        data: {
          path: `${societyId}/${residentId}/staff/${staffId}.jpg`,
          signedUrl: `${origin}/storage/v1/object/upload/sign/staff-photos/fixture?token=fixture`,
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

test('resident, administrator and guard complete staff workflows accessibly', async ({
  page,
}) => {
  await page.goto('/fixtures/staff');
  await expect(
    page.getByRole('heading', { name: 'Staff workflows', exact: true }),
  ).toBeVisible();

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 900 });

  const resident = page.getByRole('region', { name: 'Resident registration' });
  await resident.getByLabel('Full name').fill('Fixture Domestic Staff');
  await resident.getByLabel('Phone number').fill('+911234567890');
  await resident
    .getByLabel('Role (for example, cook or electrician)')
    .fill('Cook');
  await mockStaffPhotoUpload(page);
  await resident
    .getByLabel('Staff photo (JPEG or PNG, up to 5 MB)')
    .setInputFiles({
      name: 'staff-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('synthetic staff photo'),
    });
  await expect(resident.getByText('Photo uploaded.')).toBeVisible();
  await resident
    .getByRole('button', { name: 'Submit staff registration' })
    .click();
  await expect(
    resident.getByText(
      'Staff registration submitted for administrator review.',
      { exact: true },
    ),
  ).toBeVisible();

  const review = page.getByRole('region', { name: 'Administrator review' });
  await review.getByRole('button', { name: 'Approve unit link' }).click();
  await expect(
    review.getByText('Resident registration approved.', { exact: true }),
  ).toBeVisible();

  const admin = page.getByRole('region', {
    name: 'Administrator management',
  });
  await admin.getByLabel('Full name').fill('Fixture Society Staff Updated');
  await admin.getByRole('button', { name: 'Save staff details' }).click();
  await expect(admin.getByText('Staff profile saved.')).toBeVisible();
  await admin.getByRole('button', { name: 'Save approval setting' }).click();
  await expect(admin.getByText('Approval setting saved.')).toBeVisible();
  await admin.getByLabel('Attendance').selectOption('leave');
  await admin
    .getByRole('button', { name: 'Save Fixture Society Staff attendance' })
    .click();
  await expect(admin.getByText('Shift status: leave')).toBeVisible();

  const gate = page.getByRole('region', { name: 'Guard gate controls' });
  await gate
    .getByRole('button', { name: 'Check in Fixture Domestic Staff' })
    .click();
  await expect(gate.getByText('Currently inside')).toBeVisible();
  await expect(gate.getByText('+911234567890')).toHaveCount(0);
  await expect(gate.getByText('1234')).toHaveCount(0);
  await gate
    .getByRole('button', { name: 'Record exit for Fixture Domestic Staff' })
    .click();
  await expect(
    gate.getByRole('button', { name: 'Check in Fixture Domestic Staff' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
