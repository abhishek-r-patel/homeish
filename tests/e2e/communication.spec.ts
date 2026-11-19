// Verify logging, following up and closing member contacts, and the monthly communication figures.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('admin logs a contact, sees the overdue follow-up and closes it', async ({
  page,
}) => {
  await page.goto('/fixtures/communication');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Contact log' }),
  ).toBeVisible();

  const overdue = page.getByRole('listitem', {
    name: 'Contact on 12 Nov 2026',
  });
  await expect(overdue).toContainText('Follow-up overdue');
  await expect(overdue).toContainText('Lift noise (Open)');

  await page.getByRole('button', { name: 'Add contact' }).click();
  await page.getByLabel('Contact type').selectOption('query');
  await page.getByLabel('Unit').selectOption({ label: 'B-204' });
  await page
    .getByLabel('Summary')
    .fill('Asked when the water tank is cleaned.');
  await page.getByLabel('Status').selectOption('follow_up');
  await page.getByRole('button', { name: 'Add contact' }).last().click();
  await expect(page.getByText('Choose a follow-up date.')).toBeVisible();

  await page.getByLabel('Follow-up date').fill('2026-11-25');
  await page.getByRole('button', { name: 'Add contact' }).last().click();

  // The form closes on save; the new entry in the list is the confirmation.
  const added = page.getByRole('listitem', { name: 'Contact on 20 Nov 2026' });
  await expect(added).toContainText('B-204');
  await expect(added).toContainText('Follow-up');
  await expect(added).not.toContainText('Follow-up overdue');

  await overdue.getByRole('button', { name: 'Update' }).click();
  await overdue.getByLabel('Status').selectOption('closed');
  await overdue.getByRole('button', { name: 'Save contact' }).click();
  await expect(overdue).toContainText('Closed');
  await expect(overdue).not.toContainText('Follow-up overdue');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('the dashboard shows each figure with its definition and hides switched-off modules', async ({
  page,
}) => {
  await page.goto('/fixtures/communication');
  const notices = page.getByRole('region', { name: 'Notices' });
  await expect(notices).toContainText('Posted');
  await expect(notices).toContainText(
    'Drafts and scheduled notices waiting to be posted.',
  );
  await expect(
    page.getByRole('region', { name: 'Service requests' }),
  ).toContainText('2.5');
  await expect(page.getByRole('region', { name: 'Events' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Open now/ })).toHaveAttribute(
    'href',
    '/admin/contact-log?status=open',
  );
  await expect(page.getByRole('link', { name: 'Next month' })).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Previous month' }),
  ).toHaveAttribute('href', '/admin/communication?month=2026-10');
});
