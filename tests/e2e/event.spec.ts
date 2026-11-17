// Exercise the resident RSVP and administrator publish-and-cancel event journeys with synthetic actions.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
}

const SYNTHETIC_SUCCESS = 'Synthetic action complete. Nothing was saved.';

async function submitWithConfirm(
  page: Page,
  buttonName: string,
  expectedMessage: string,
) {
  const dialogPromise = page.waitForEvent('dialog');
  const clickPromise = page.getByRole('button', { name: buttonName }).click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe(expectedMessage);
  await dialog.accept();
  await clickPromise;
  await expect(
    page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: buttonName }) })
      .getByText(SYNTHETIC_SUCCESS, { exact: true }),
  ).toBeVisible();
}

test('resident changes their headcount, then says they are not going', async ({
  page,
}) => {
  await page.goto('/fixtures/event');
  await page.getByLabel('Fixture screen').selectOption('resident-open');
  await expect(
    page.getByRole('heading', { level: 1, name: 'New Year community dinner' }),
  ).toBeVisible();
  await expectNoViolations(page);

  await page.getByLabel('How many people are coming?').fill('3');
  await expect(
    page.getByText(
      '₹250.00 will be added to your flat’s bill (total ₹750.00 for this event).',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save RSVP for A-101' }).click();
  await expect(
    page.getByText(SYNTHETIC_SUCCESS, { exact: true }),
  ).toBeVisible();

  await page.getByText('Not going', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Not going' })).toBeChecked();
  await expect(page.getByLabel('How many people are coming?')).toHaveCount(0);
  await expect(
    page.getByText('₹500.00 will be credited back to your flat’s bill.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save RSVP for A-101' }).click();
  await expect(
    page.getByText(SYNTHETIC_SUCCESS, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'You cannot RSVP for this flat. Only people currently living in it can.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save RSVP for B-201' }),
  ).toHaveCount(0);
});

test('administrator publishes a draft, then cancels the event with a reason', async ({
  page,
}) => {
  await page.goto('/fixtures/event');
  await page.getByLabel('Fixture role').selectOption('admin');
  await page.getByLabel('Fixture screen').selectOption('admin-draft');
  await expect(
    page.getByRole('heading', { level: 1, name: 'New Year community dinner' }),
  ).toBeVisible();
  await expect(page.getByText('Tower A, Tower B')).toBeVisible();
  await expectNoViolations(page);

  await submitWithConfirm(
    page,
    'Publish and Notify',
    'Publish this event? Residents in the audience will be notified.',
  );

  await page.getByLabel('Fixture screen').selectOption('admin-published');
  await expect(page.getByText('People going')).toBeVisible();
  await expect(page.getByText('₹1250.00')).toBeVisible();
  await expectNoViolations(page);

  await page
    .getByLabel('Reason for cancelling')
    .fill('Heavy rain is forecast, so the lawn cannot be used.');
  await submitWithConfirm(
    page,
    'Cancel Event',
    'Cancel this event? Residents will be notified and every contribution will be credited back.',
  );
});

test('Hindi event UI preserves written content, formats dates and keeps form input', async ({
  page,
}) => {
  await page.goto('/fixtures/event');
  await page.getByLabel('Fixture screen').selectOption('resident-open');
  await page.getByLabel('How many people are coming?').fill('3');

  const confirmation = page.waitForEvent('dialog');
  const changing = page
    .getByRole('combobox', { name: 'Choose a language' })
    .selectOption('hi');
  const dialog = await confirmation;
  expect(dialog.message()).toContain('unsaved changes');
  await dialog.accept();
  await changing;

  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'New Year community dinner',
    }),
  ).toBeVisible();
  await expect(page.getByText('Clubhouse lawn', { exact: true })).toBeVisible();
  await expect(page.getByText(/दिस/).first()).toBeVisible();
  await expect(page.getByLabel('कितने लोग आ रहे हैं?')).toHaveValue('3');
  await expect(
    page.getByRole('button', { name: 'A-101 का आने का जवाब सहेजें' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'A-101 का आने का जवाब सहेजें' }).click();
  await expect(
    page.getByText('नमूना कार्रवाई पूरी हुई। कुछ भी नहीं सहेजा गया।', {
      exact: true,
    }),
  ).toBeVisible();
});
