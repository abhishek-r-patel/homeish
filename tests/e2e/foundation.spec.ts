// Verify installable assets and browser interactions for the foundation fixture.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from './fixtures';

async function expectPopoverWithinViewport(
  popover: Locator,
  width: number,
  height: number,
) {
  await expect(async () => {
    const bounds = await popover.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
  }).toPass({ timeout: 5000 });
}

test('serves Homeish install metadata and icons', async ({ page, request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    display: 'standalone',
    name: 'Homeish',
    short_name: 'Homeish',
    start_url: '/',
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
    ]),
  );

  for (const size of [192, 512]) {
    const icon = await request.get(`/icons/homeish-${size}.png`);
    expect(icon.ok()).toBe(true);
    expect(icon.headers()['content-type']).toContain('image/png');
    const png = await icon.body();
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }

  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    /^\/icon\.svg/,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    /^\/apple-icon/,
  );
});

test('foundation fixture stays accessible and fits supported widths', async ({
  page,
}, testInfo) => {
  const hydrationErrors: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      message.text().includes('Hydration failed')
    ) {
      hydrationErrors.push(message.text());
    }
  });
  await page.goto('/fixtures/foundation');
  await expect(
    page.getByRole('heading', { name: 'Foundation Components Fixture' }),
  ).toBeVisible();

  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (width === 390 || width === 1280) {
      const screenshot = await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`foundation-${width}.png`),
      });
      expect(screenshot.byteLength).toBeGreaterThan(0);
    }
  }
  expect(hydrationErrors).toEqual([]);

  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    const textElements = Array.from(document.querySelectorAll('body *')).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const originalSizes = textElements.map(
      (element) =>
        [
          element,
          Number.parseFloat(getComputedStyle(element).fontSize),
        ] as const,
    );
    for (const [element, size] of originalSizes) {
      element.style.setProperty('font-size', `${size * 2}px`, 'important');
    }
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('foundation controls support keyboard, focus, calendar and file interactions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/fixtures/foundation');

  const dialogTrigger = page.getByRole('button', {
    name: 'Open Fixture Dialog',
  });
  await dialogTrigger.click();
  await expect(
    page.getByRole('dialog', { name: 'Fixture Dialog' }),
  ).toBeVisible();
  await expect(page.getByLabel('Dialog value')).toBeFocused();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialogTrigger).toBeFocused();

  const historyTab = page.getByRole('tab', { name: 'History' });
  await historyTab.focus();
  await page.keyboard.press('Enter');
  await expect(historyTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('History panel content.')).toBeVisible();

  const filtersTrigger = page.getByRole('button', { name: /^Filters/ });
  await filtersTrigger.click();
  const filterDialog = page.getByRole('dialog', { name: 'Filters' });
  await expect(filterDialog).toBeVisible();
  await expect(filterDialog).toHaveAttribute('aria-modal', 'false');
  await expect(
    page.getByRole('button', { name: 'Close filters' }),
  ).toBeFocused();
  await page.setViewportSize({ width: 768, height: 600 });
  await expectPopoverWithinViewport(filterDialog, 768, 600);
  await page.keyboard.press('Escape');
  await expect(filterDialog).not.toBeVisible();
  await expect(filtersTrigger).toBeFocused();

  await filtersTrigger.click();
  await expect(filterDialog).toBeVisible();
  await filterDialog.getByRole('button', { name: 'Apply filters' }).click();
  await expect(filterDialog).not.toBeVisible();
  await expect(filtersTrigger).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await filtersTrigger.click();
  const filterSheet = page.getByRole('dialog', { name: 'Filters' });
  await expect(filterSheet).toBeVisible();
  await expect(filterSheet).toHaveAttribute('aria-modal', 'true');
  await filterSheet.getByRole('button', { name: 'Apply filters' }).click();
  await expect(filterSheet).not.toBeVisible();
  await expect(filtersTrigger).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#fixture-date-picker-expanded').click();
  const calendar = page.getByRole('dialog', { name: 'Choose a date' });
  await calendar.getByRole('button', { name: /16 January 2026/ }).click();
  await expect(page.locator('#fixture-date-picker-value')).toContainText(
    '16 January 2026',
  );

  await page.locator('#fixture-upload').setInputFiles({
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('synthetic fixture'),
  });
  await expect(page.getByText('sample.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Remove sample.pdf' }).click();
  await expect(page.getByText('sample.pdf')).not.toBeVisible();
});

test('filter popovers stay within resized viewports with offscreen triggers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/fixtures/foundation');
  const filtersTrigger = page.getByRole('button', { name: /^Filters/ });
  await filtersTrigger.click();
  const filterDialog = page.getByRole('dialog', { name: 'Filters' });
  await expect(filterDialog).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Close filters' }),
  ).toBeFocused();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 768, height: 600 });
  await expect
    .poll(() =>
      filtersTrigger.evaluate((trigger) => trigger.getBoundingClientRect().top),
    )
    .toBeGreaterThan(600);
  await expectPopoverWithinViewport(filterDialog, 768, 600);
});
