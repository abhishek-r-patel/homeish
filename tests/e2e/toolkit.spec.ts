// Verify the P35 society profile checklist, adoption tracker, action-plan workspace and "My tasks" with synthetic fixtures.
import { expect, test, type Page } from './fixtures';

async function openScreen(page: Page, screen: string, role = 'admin') {
  await page.goto('/fixtures/toolkit');
  await page.getByLabel('Fixture role').selectOption(role);
  await page.getByLabel('Fixture screen').selectOption(screen);
}

function tile(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..');
}

test('society profile shows the advisory checklist and hides restricted fields from committee', async ({
  page,
}) => {
  await openScreen(page, 'profile');
  await expect(
    page.getByText('10 of 11 required fields filled', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Advisory only. Missing details never block anything in Homeish.',
    ),
  ).toBeVisible();
  await expect(page.getByText('ABCDE1234F', { exact: true })).toBeVisible();
  await expect(page.getByText('Not added').first()).toBeVisible();

  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('PIN code').fill('0123');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Enter a 6-digit PIN code.')).toBeVisible();
  await page.getByLabel('PIN code').fill('400002');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(
    page.getByText('Society profile saved. (synthetic, nothing saved)'),
  ).toBeVisible();

  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(page.getByText('ABCDE1234F', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit profile' })).toHaveCount(
    0,
  );
  await expect(
    page.getByText(
      'Society PAN, bank details and office-bearer mobile numbers are shown to admins only.',
    ),
  ).toBeVisible();
});

test('adoption tracker summarises modules and saves an admin edit without toggling modules', async ({
  page,
}) => {
  await openScreen(page, 'adoption');
  await expect(tile(page, 'In use or mastered')).toContainText('1');
  await expect(tile(page, 'Review due')).toContainText('1');
  await expect(tile(page, 'High priority, not started')).toContainText('1');
  const amenity = page.getByRole('listitem', { name: 'Amenity Booking' });
  await expect(amenity.getByText('Module is off')).toBeVisible();

  await amenity.getByRole('button', { name: 'Edit' }).click();
  await amenity.getByLabel('Status').selectOption('exploring');
  await amenity
    .getByLabel('Owner')
    .selectOption({ label: 'Ravi Shah · A-204' });
  await expect(
    amenity.getByLabel('Owner').locator('option', { hasText: 'Meera Iyer' }),
  ).toHaveCount(0);
  await amenity.getByRole('button', { name: 'Save adoption' }).click();
  await expect(
    amenity.getByText('Adoption saved. (synthetic, nothing saved)'),
  ).toBeVisible();

  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
});

test('action plans show summaries, a weekly timeline and protect linked meeting actions', async ({
  page,
}) => {
  await openScreen(page, 'plans');
  await expect(tile(page, 'Overdue')).toContainText('1');
  await expect(tile(page, 'Overall progress')).toContainText('45%');
  await expect(tile(page, 'Due in next 7 days')).toContainText('1');

  const linked = page.getByRole('listitem', {
    name: 'Check fire-safety equipment and emergency contacts',
  });
  await expect(linked).toContainText('Upcoming');
  await linked.getByRole('button', { name: 'Edit task' }).click();
  await expect(
    linked.getByLabel('Status').locator('option[value="done"]'),
  ).toBeDisabled();
  await linked.getByLabel('Linked meeting action').selectOption('');
  await expect(
    linked.getByLabel('Status').locator('option[value="done"]'),
  ).toBeEnabled();

  await page.getByRole('button', { name: 'Weekly timeline' }).click();
  await expect(
    page.getByText('Week 2', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText('Week 13', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Add task' }).click();
  const form = page.locator('form').filter({ hasText: 'Start day' }).last();
  await form.getByLabel('Title').fill('Collect insurance quotes');
  await form.getByLabel('Start day').fill('20');
  await form.getByLabel('End day').fill('10');
  await form.getByRole('button', { name: 'Add task' }).click();
  await expect(
    form.getByText('The end day must be on or after the start day.'),
  ).toBeVisible();
  await form.getByLabel('End day').fill('30');
  await form.getByRole('button', { name: 'Add task' }).click();
  await expect(form).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Task saved.' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'New plan' }).click();
  await page.getByRole('button', { name: 'Create from sample' }).click();
  await expect(
    page.getByRole('button', { name: 'Create from sample' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Plan created.' }),
  ).toBeVisible();
});

test('admin removes a task with a reason and confirmation; committee cannot remove it', async ({
  page,
}) => {
  await openScreen(page, 'plans', 'committee');
  await expect(
    page.getByRole('button', { name: 'Remove task', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Fixture role').selectOption('admin');
  const task = page.getByRole('listitem', {
    name: 'Check fire-safety equipment and emergency contacts',
  });
  await task.getByRole('button', { name: 'Remove task', exact: true }).click();
  await task.getByLabel('Reason for removal').fill('Duplicate planning task');
  page.once('dialog', (dialog) => dialog.dismiss());
  await task.getByRole('button', { name: 'Remove task', exact: true }).click();
  await expect(task).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await task.getByRole('button', { name: 'Remove task', exact: true }).click();
  await expect(task).toHaveCount(0);
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Task removed. Its history is retained.' }),
  ).toBeVisible();
});

test('my tasks is read-only and lists only the member’s own tasks', async ({
  page,
}) => {
  await openScreen(page, 'my_tasks', 'resident');
  await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible();
  await expect(
    page.getByText('Check fire-safety equipment and emergency contacts'),
  ).toBeVisible();
  await expect(
    page.getByText('Review maintenance charge heads and due dates'),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit task' })).toHaveCount(0);

  await page.getByLabel('Fixture scenario').selectOption('empty');
  await expect(page.getByText('No tasks assigned to you')).toBeVisible();
});
