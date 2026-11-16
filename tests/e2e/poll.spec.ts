// Exercise the representative ballot and read-only committee journeys with synthetic actions.
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

test('resident reviews and submits a private ballot without exposing its choice', async ({
  page,
}) => {
  await page.goto('/fixtures/poll');
  await page.getByLabel('Fixture screen').selectOption('private-ballot');
  await expect(
    page.getByRole('heading', { name: 'Committee chair election' }),
  ).toBeVisible();

  const candidate = page.getByRole('radio', {
    name: 'Synthetic Candidate A',
  });
  await page.getByText('Synthetic Candidate A', { exact: true }).click();
  await expect(candidate).toBeChecked();
  await page.getByRole('button', { name: 'Review ballot' }).click();
  await expect(
    page.getByRole('heading', { name: 'Review private ballot for unit A-101' }),
  ).toBeVisible();
  await expect(page.getByRole('list')).toContainText('Synthetic Candidate A');
  await expectNoViolations(page);

  const dialogPromise = page.waitForEvent('dialog');
  const submitPromise = page
    .getByRole('button', { name: 'Confirm and submit ballot' })
    .click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe(
    'Submit this private ballot? You cannot change it after submission.',
  );
  await dialog.accept();
  await submitPromise;

  const acknowledgement = page.getByText(
    'Synthetic action complete. Nothing was saved.',
    { exact: true },
  );
  await expect(acknowledgement).toBeVisible();
  await expect(acknowledgement).not.toContainText('Synthetic Candidate A');
});

test('administrator edits a poll draft and committee members cannot manage it', async ({
  page,
}) => {
  await page.goto('/fixtures/poll');
  await page.getByLabel('Fixture role').selectOption('admin');
  await page.getByLabel('Fixture screen').selectOption('admin-editor');
  await expect(
    page.getByRole('heading', { name: 'Edit poll draft' }),
  ).toBeVisible();
  await expectNoViolations(page);

  await page.getByLabel('Poll title').fill('Updated synthetic election');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(
    page.getByText('Synthetic action complete. Nothing was saved.', {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByLabel('Fixture role').selectOption('committee');
  await page.getByLabel('Fixture screen').selectOption('admin-readiness');
  await expect(
    page.getByRole('heading', { name: 'Committee view' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open voting now' }),
  ).toHaveCount(0);
  await expectNoViolations(page);
});
