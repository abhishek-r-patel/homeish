// Verify AMC contract validation, preserved renewals, visit corrections and accessibility.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
test('administrators renew AMC contracts without losing original visits', async ({
  page,
}) => {
  await page.goto('/fixtures/amc');
  const form = page.getByRole('region', { name: 'New contract' });
  await form.getByLabel('Asset / service label').fill('Lift');
  await form.getByLabel('Vendor name').fill('Fixture vendor');
  await form.getByLabel('Vendor contact').fill('Fixture contact');
  await form.getByLabel('Service visit frequency').fill('Quarterly');
  await form.getByLabel('Contract end').fill('2000-01-01');
  await form.getByRole('button', { name: 'Add AMC contract' }).click();
  await expect(form.getByRole('alert')).toContainText('must not precede');
  await form.getByLabel('Contract end').fill('2099-01-01');
  await form.getByRole('button', { name: 'Add AMC contract' }).click();
  const old = page.getByRole('region', { name: 'Original history' });
  await old.getByLabel('Visit summary').fill('Inspection');
  await old.getByLabel('Technician name').fill('Fixture technician');
  await old.getByRole('button', { name: 'Add service visit' }).click();
  await expect(
    old.getByText('Visit: Inspection', { exact: true }),
  ).toBeVisible();
  await old.getByLabel('Visit summary').first().fill('Corrected inspection');
  await old.getByRole('button', { name: 'Save visit correction' }).click();
  await expect(
    old.getByText('Visit: Corrected inspection', { exact: true }),
  ).toBeVisible();
  await old.getByLabel('Contract end').fill('2100-01-01');
  await old.getByRole('button', { name: 'Create successor contract' }).click();
  await expect(
    page.getByText('Contract history count: 2', { exact: true }),
  ).toBeVisible();
  await expect(
    old.getByText('Visit: Corrected inspection', { exact: true }),
  ).toBeVisible();
  await expect(
    old.getByText('Contract ending 2099-01-01', { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
