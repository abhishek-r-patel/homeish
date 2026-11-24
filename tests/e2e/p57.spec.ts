// Verify P57 homepage evidence, contact options and enquiry form states.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('shows the refreshed homepage and saves a public enquiry accessibly', async ({
  page,
}) => {
  await page.goto('/fixtures/p57-homepage');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A clearer day for your committee. A calmer day for everyone.',
    }),
  ).toBeVisible();
  await expect(page.getByText('26 switchable feature modules')).toBeVisible();
  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: 'Talk to us', exact: true }),
  ).toHaveAttribute('href', 'mailto:hello@example.test');
  await expect(
    page.getByRole('region', {
      name: 'One app. The right view for every role.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('img')).toHaveCount(9);

  await page.getByLabel('Your name (required)').fill('Synthetic Sender');
  await page
    .getByLabel('Society name', { exact: true })
    .fill('Synthetic Society');
  await page.getByLabel('Email', { exact: true }).fill('sender@example.test');
  await page
    .getByLabel('What would you like to discuss?')
    .fill('Please contact our committee.');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(
    page.getByText('Thanks. Your enquiry was saved for the Homeish developer.'),
  ).toBeVisible();
  await expect(page.getByLabel('Your name (required)')).toHaveValue('');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('lets the developer configure the website and manage private enquiries', async ({
  page,
}) => {
  await page.goto('/fixtures/p57-developer');
  await page.getByLabel('Enquiries per network per hour').fill('8');
  await page.getByRole('button', { name: 'Save website settings' }).click();
  await expect(page.getByText('Website settings saved.')).toBeVisible();

  await page.getByRole('button', { name: 'Mark handled' }).click();
  await expect(page.getByText('Handled', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete enquiry' });
  await dialog.getByRole('button', { name: 'Delete enquiry' }).click();
  await expect(page.getByText('No website enquiries.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('hides an unset contact link and retains input when the limit is reached', async ({
  page,
}) => {
  await page.goto('/fixtures/p57-homepage?contact=none&state=limit');
  await expect(
    page.getByText('No public email is set; use the enquiry form below.'),
  ).toBeVisible();
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await page.getByLabel('Your name (required)').fill('Synthetic Sender');
  await page.getByLabel('Email', { exact: true }).fill('sender@example.test');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(
    page.getByText('Please wait before sending another enquiry.'),
  ).toBeVisible();
  await expect(page.getByLabel('Your name (required)')).toHaveValue(
    'Synthetic Sender',
  );
  await expect(page.getByText('Retry after 180 seconds.')).toBeVisible();
});
