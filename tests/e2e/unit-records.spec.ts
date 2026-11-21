// Verify Unit 360 measured areas and placing a unit on a building layout spot.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

const unitId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';

async function blockServerActions(page: Page) {
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
}

test('measured-area fields share a row on desktop and stack on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/fixtures/unit-records');
  await page.evaluate(() => document.fonts.ready);
  const area = page.getByRole('region', { name: 'Measured area' });
  const carpet = area.getByRole('textbox', { name: 'Carpet area (sq ft)' });
  const builtUp = area.getByRole('textbox', { name: 'Built-up area (sq ft)' });
  const outdoor = area.getByRole('textbox', {
    name: 'Balcony or terrace (sq ft)',
  });
  const fieldPositions = () =>
    Promise.all(
      [carpet, builtUp, outdoor].map((field) =>
        field.locator('..').boundingBox(),
      ),
    );
  const [first, second, third] = await fieldPositions();
  expect(first!.x).toBeLessThan(second!.x);
  expect(second!.x).toBeLessThan(third!.x);
  expect(first!.y).toBeCloseTo(second!.y, 0);
  expect(second!.y).toBeCloseTo(third!.y, 0);
  const balconyLabel = area.locator('label[for="unit-area-outdoor"]');
  expect(
    await balconyLabel.evaluate((label) => {
      const text = label.ownerDocument.createRange();
      text.selectNodeContents(label);
      return text.getClientRects().length;
    }),
  ).toBe(1);

  await page.setViewportSize({ width: 320, height: 900 });
  const [top, middle, bottom] = await fieldPositions();
  expect(top!.x).toBeCloseTo(middle!.x, 0);
  expect(middle!.x).toBeCloseTo(bottom!.x, 0);
  expect(top!.y).toBeLessThan(middle!.y);
  expect(middle!.y).toBeLessThan(bottom!.y);
});

test('an admin places the unit on a free spot and only free spots can be chosen', async ({
  page,
}) => {
  await blockServerActions(page);
  await page.goto('/fixtures/unit-records');
  const card = page.getByRole('region', { name: 'Place in building layout' });
  await expect(
    card.getByText('Current spot: Tower A, Floor 1, spot 1'),
  ).toBeVisible();
  await expect(
    card.getByRole('button', {
      name: 'Current spot: Floor 1, spot 1: Unit 101',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    card.getByRole('button', { name: 'Floor 3, spot 2: Unit 302' }),
  ).toBeDisabled();
  await expect(
    card.getByRole('button', { name: 'Floor 2, spot 3: Gym' }),
  ).toBeDisabled();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }

  await card
    .getByRole('button', {
      name: 'Place here: Floor 3, spot 1: Free unit spot',
    })
    .click();
  const confirm = page.getByRole('dialog', { name: 'Place unit here?' });
  await expect(confirm).toContainText('Tower A, Floor 3: Free unit spot');
  const submitted = page.waitForRequest((request) =>
    Boolean(request.headers()['next-action']),
  );
  await confirm.getByRole('button', { name: 'Place unit' }).click();
  expect((await submitted).postDataJSON()).toEqual([
    unitId,
    expect.any(String),
    {
      blockId: 'a1000000-0000-4000-8000-000000000001',
      spaceId: 'b2000000-0000-4000-8000-000000000004',
      version: '123456789012345678901234567890ab',
    },
  ]);

  await page.goto('/fixtures/unit-records?readOnly=1');
  await expect(
    card.getByText('Current spot: Tower A, Floor 1, spot 1'),
  ).toBeVisible();
  await expect(card.getByRole('button')).toHaveCount(0);
});
