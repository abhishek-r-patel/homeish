// Verify the synthetic transfer tab warning, privacy projection and responsive states.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      request.headers()['next-action'] ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    ) {
      await route.abort('blockedbyclient');
    } else {
      await route.continue();
    }
  });
});

test('admin and committee see the transfer tracker without exposing party-private files', async ({
  page,
}) => {
  await page.goto('/fixtures/tenancy');
  await page.getByLabel('Fixture scenario').selectOption('transfers');
  await expect(
    page.getByRole('heading', { name: 'Transfer cases', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /not legal advice.*not proof of title transfer.*state act or bye-laws/i,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Acknowledge Warning', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Synthetic Buyer/)).toBeVisible();
  await page.getByLabel('Fixture role').selectOption('committee');
  await expect(
    page.getByText(
      /Buyer contact details, agreement files and certificate files are hidden/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Acknowledge Warning', exact: true }),
  ).toHaveCount(0);
});

test('transfer tab reflows and stays accessible at supported widths', async ({
  page,
}) => {
  await page.goto('/fixtures/tenancy');
  await page.getByLabel('Fixture scenario').selectOption('transfers');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
