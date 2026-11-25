// Verify composing a pinned block notice with an attachment, drafts, scheduling, planning details and the board, accessibly.
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
  await expect(page.getByText('Will reach 6 people in 4 flats')).toBeVisible();

  await page.getByLabel('Title').fill('Lift maintenance');
  await page
    .getByLabel('Notice', { exact: true })
    .fill('The lifts in your block will be serviced on Saturday.');
  await page.getByLabel('Residents of chosen blocks').check();
  await expect(
    page.getByText('The reach count will appear after an audience is chosen.'),
  ).toBeVisible();

  // Choosing blocks is required for a block notice.
  await page.getByRole('button', { name: 'Publish notice' }).click();
  await expect(
    page.getByRole('region', { name: 'New notice' }).getByRole('alert'),
  ).toContainText('Choose at least one block.');

  await page.getByLabel('A', { exact: true }).check();
  await expect(page.getByText('Will reach 2 people in 1 flats')).toBeVisible();
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

test('manager saves a draft, schedules a notice and keeps planning details private', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/fixtures/notices');
  const items = page
    .getByRole('region', { name: 'Current notices' })
    .locator('li');

  await page.getByLabel('Title').fill('Garden clean-up');
  await page
    .getByLabel('Notice', { exact: true })
    .fill('Volunteers meet at the garden gate.');
  await page.getByLabel('Save as a draft').check();
  await expect(
    page.getByText('Residents do not see the notice until it is posted.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(
    page.getByText('The draft was saved.', { exact: true }),
  ).toBeVisible();
  await expect(items.last()).toContainText('Draft');

  await page.getByLabel('Schedule for a date and time').check();
  await page.getByRole('button', { name: 'Schedule notice' }).click();
  const postingDay = page.getByRole('textbox', {
    name: 'Posting day (required)',
  });

  await expect(
    page.getByText('Choose a posting date and time.').first(),
  ).toBeVisible();
  await expect(postingDay).toHaveAttribute('aria-invalid', 'true');
  await postingDay.fill('2030-01-15');
  await page.getByLabel('Hour (required)', { exact: true }).selectOption('10');
  await page
    .getByLabel('Minute (required)', { exact: true })
    .selectOption('30');
  await page.getByRole('button', { name: 'Schedule notice' }).click();
  await expect(
    page.getByText('The notice was scheduled.', { exact: true }),
  ).toBeVisible();
  await expect(items.last()).toContainText('Scheduled');
  await expect(items.last()).toContainText(/Posts on .*2030/);
  await expect(items.last()).toContainText('10:30');

  const planning = page.getByRole('region', { name: 'Planning details' });
  await planning.getByLabel('Next action date (optional)').fill('2026-12-01');
  await planning.getByRole('button', { name: 'Save planning details' }).click();
  await expect(
    planning.getByText('Describe the next action for this date.'),
  ).toBeVisible();
  await planning
    .getByLabel('Notice board location (optional)')
    .fill('Lift lobby of Block A');
  await planning
    .getByLabel('Next action (optional)')
    .fill('Take down the paper copy');
  await planning.getByRole('button', { name: 'Save planning details' }).click();
  await expect(
    planning.getByText('The planning details were saved.', { exact: true }),
  ).toBeVisible();
  // The board in this fixture is the resident view, which never shows planning details.
  await expect(items.first()).not.toContainText('Lift lobby of Block A');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('committee proposes planning details and an admin accepts them', async ({
  page,
}) => {
  await page.goto('/fixtures/notices');
  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(
    page.getByRole('button', { name: 'Save planning details' }),
  ).toHaveCount(0);
  const form = page.getByRole('region', {
    name: 'Propose planning details',
    exact: true,
  });
  await form
    .getByLabel('Notice board location (optional)')
    .fill('Garden board');
  await form.getByRole('button', { name: 'Propose planning details' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Planning proposal submitted.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Official planning details' }),
  ).toContainText('Not set');
  await expect(
    page.getByRole('button', { name: 'Accept proposal' }),
  ).toHaveCount(0);
  await page.getByLabel('Fixture role').selectOption('admin');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Accept proposal' }).click();
  await expect(
    page.getByRole('region', { name: 'Official planning details' }),
  ).toContainText('Garden board');
  await expect(
    page
      .getByRole('region', { name: 'Planning details', exact: true })
      .getByLabel('Notice board location (optional)'),
  ).toHaveValue('Garden board');
  await expect(
    page.getByRole('status').filter({
      hasText: 'Proposal accepted. The official planning details were updated.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Planning proposals' }),
  ).toContainText('Accepted');
  await expect(
    page.getByRole('button', { name: 'Accept proposal' }),
  ).toHaveCount(0);
});
