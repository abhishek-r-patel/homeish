// Verify P59 change-history undo and synthetic role preview accessibly.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('shows redacted history and confirms an allowed undo', async ({
  page,
}) => {
  await page.goto('/fixtures/p59');
  await expect(
    page.getByRole('heading', { name: 'P59 synthetic admin preview' }),
  ).toBeVisible();
  await expect(page.getByText('billing.settings.update')).toBeVisible();
  await expect(page.getByText('Private operational reason')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Undo this setting change?',
  });
  await dialog.getByRole('button', { name: 'Undo change' }).click();
  await expect(page.getByText('The setting change was undone.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('role preview changes from the real role registry and stays inert', async ({
  page,
}) => {
  await page.goto('/fixtures/p59');
  const picker = page.getByLabel('Preview role');
  await picker.selectOption('guard');
  await expect(page.getByLabel('Guard picture')).toHaveAttribute('inert', '');
  await expect(page.getByLabel('Guard accessible preview')).toContainText(
    'Visitors',
  );
  await picker.selectOption('committee');
  await expect(page.getByLabel('Committee member picture')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('developer sees no audit rows until a society is chosen', async ({
  page,
}) => {
  await page.goto('/fixtures/p59-developer');
  await page.getByLabel('Committee can see change history').check();
  await page.getByRole('button', { name: 'Save history access' }).click();
  await expect(
    page.getByText('Committee members can now see change history.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Choose one society' }),
  ).toBeVisible();
  await expect(page.getByText(/No audit entries are shown/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
