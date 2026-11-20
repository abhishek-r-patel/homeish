// Verify the Unit 360 floor list, invalid edit feedback and read-only state.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('floor schematic has accessible lists and rejects an incomplete position', async ({
  page,
}) => {
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (
      request.headers()['next-action'] ||
      new URL(request.url()).hostname !== '127.0.0.1'
    ) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto('/fixtures/unit-records');
  const schematic = page.getByRole('region', { name: 'Floor schematic' });
  await expect(schematic.getByText('Row 1, column 1')).toBeVisible();
  await expect(schematic.getByRole('link', { name: '302' })).toHaveCount(1);
  await schematic.getByRole('spinbutton', { name: 'Map column' }).fill('');
  await schematic.getByRole('button', { name: 'Save Unit Position' }).click();
  await expect(schematic.getByRole('alert')).toContainText(
    'Enter both map coordinates, or clear both.',
  );
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.goto('/fixtures/unit-records?readOnly=1');
  await expect(schematic.getByText('Row 1, column 1')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(0);
});
