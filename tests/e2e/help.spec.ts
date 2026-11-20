// Verify help search, role filtering and module-aware articles on the synthetic help fixture.
import { expect, test } from './fixtures';

test('help search narrows articles and can be cleared', async ({ page }) => {
  await page.goto('/fixtures/help');
  const articles = page.getByRole('region', { name: 'Help articles' });
  const bills = articles.getByRole('heading', {
    name: 'How do I create maintenance bills?',
  });
  const notices = articles.getByRole('heading', {
    name: 'How do I publish a notice?',
  });
  await expect(bills).toBeVisible();
  await expect(notices).toBeVisible();

  await page.getByLabel('Search help').fill('maintenance bills');
  await expect(bills).toBeVisible();
  await expect(notices).toHaveCount(0);

  await page.getByLabel('Search help').fill('zzznomatch');
  await expect(page.getByText('No matching articles')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(bills).toBeVisible();
  await expect(notices).toBeVisible();
});

test('help follows the role and turned-off modules', async ({ page }) => {
  await page.goto('/fixtures/help');
  await page.getByLabel('Fixture role').selectOption('guard');
  const articles = page.getByRole('region', { name: 'Help articles' });
  const visitors = articles.getByRole('heading', {
    name: 'How do I log a visitor at the gate?',
  });
  await expect(visitors).toBeVisible();
  await expect(
    articles.getByRole('heading', {
      name: 'How do I create maintenance bills?',
    }),
  ).toHaveCount(0);

  await page.getByLabel('Fixture modules').selectOption('core');
  await expect(visitors).toHaveCount(0);
  await expect(
    articles.getByRole('heading', { name: 'How do I update my profile?' }),
  ).toBeVisible();
});
