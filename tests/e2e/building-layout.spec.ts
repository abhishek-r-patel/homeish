// Verify the building layout designer for admins and its read-only view for committee members.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

const path = '/fixtures/building-layout-designer';

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

test('committee members can open spots but cannot edit the layout', async ({
  page,
}) => {
  await page.goto(`${path}?role=committee`);
  const card = page.getByRole('region', { name: 'Building layout' });
  await expect(
    card.getByText('4 floors · 1 basements · 2 units placed · 9 free spots'),
  ).toBeVisible();
  await expect(card.getByRole('button', { name: 'Edit layout' })).toHaveCount(
    0,
  );
  await card.getByRole('button', { name: 'Floor 1, spot 1: Unit 101' }).click();
  const dialog = page.getByRole('dialog', { name: 'Floor 1 · spot 1' });
  await expect(dialog).toContainText(
    'You can view this layout but not change it.',
  );
  await expect(dialog.getByRole('link', { name: 'Open Unit 360' })).toHaveCount(
    0,
  );
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
});

test('an admin edits floors and spots on the drawing and saves the layout', async ({
  page,
}) => {
  await blockServerActions(page);
  await page.goto(path);
  const card = page.getByRole('region', { name: 'Building layout' });
  await card.getByRole('button', { name: 'Floor 1, spot 1: Unit 101' }).click();
  const placed = page.getByRole('dialog', { name: 'Floor 1 · spot 1' });
  await expect(
    placed.getByRole('link', { name: 'Open Unit 360' }),
  ).toHaveAttribute(
    'href',
    '/admin/structure/units/c0d55fc3-0751-4b79-86c1-5b3e25942392',
  );
  await placed.getByRole('button', { name: 'Done' }).click();

  await card.getByRole('button', { name: 'Edit layout' }).click();
  await card.getByRole('button', { name: 'Add new floor on top' }).click();
  await expect(card.getByRole('status')).toHaveText('Floor added.');
  await card
    .getByRole('button', { name: 'Add new unit spot to Floor 5' })
    .click();
  await expect(
    card.getByRole('button', { name: 'Edit Floor 5, spot 4: Free unit spot' }),
  ).toBeVisible();

  await card
    .getByRole('button', { name: 'Edit Floor 1, spot 1: Unit 101' })
    .click();
  const spot = page.getByRole('dialog', { name: 'Floor 1 · spot 1' });
  await spot.getByRole('button', { name: 'Remove spot' }).click();
  await expect(spot.getByRole('alert')).toHaveText(
    'Unit 101 is placed here. Move it in Unit 360 first.',
  );
  await spot.getByRole('button', { name: 'Done' }).click();

  await card.getByRole('button', { name: 'Edit Floor 2, spot 3: Gym' }).click();
  const gym = page.getByRole('dialog', { name: 'Floor 2 · spot 3' });
  await gym
    .getByRole('combobox', { name: 'Space type' })
    .selectOption({ label: 'Shop / commercial' });
  await expect(
    gym.getByRole('textbox', { name: 'Name shown on the layout' }),
  ).toHaveValue('Gym');
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await gym.getByRole('button', { name: 'Done' }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1280);

  const submitted = page.waitForRequest((request) =>
    Boolean(request.headers()['next-action']),
  );
  await card.getByRole('button', { name: 'Save building' }).click();
  const [blockId, requestKey, payload] = (await submitted).postDataJSON();
  expect(blockId).toBe('a1000000-0000-4000-8000-000000000001');
  expect(requestKey).toEqual(expect.any(String));
  expect(payload).toMatchObject({
    name: 'Tower A',
    version: '123456789012345678901234567890ab',
  });
  expect(payload.floors[0]).toMatchObject({ level: 5, whole: false });
  expect(payload.floors[0].spaces).toHaveLength(4);
  expect(payload.floors[3].spaces[2]).toMatchObject({
    kind: 'shop',
    name: 'Gym',
  });
});

test('an admin drafts a new building from the empty state', async ({
  page,
}) => {
  await blockServerActions(page);
  await page.goto(`${path}?empty=1`);
  const card = page.getByRole('region', { name: 'Building layout' });
  await expect(
    card.getByText('No buildings yet. Add one to start.'),
  ).toBeVisible();
  await card.getByRole('button', { name: 'Add building' }).click();
  const setup = page.getByRole('dialog', { name: 'Add building' });
  await setup.getByRole('spinbutton', { name: 'Floors (0–99)' }).fill('2');
  await setup.getByRole('button', { name: 'Create draft layout' }).click();
  await expect(
    card.getByRole('textbox', { name: 'Building name' }),
  ).toHaveValue('Building 1');
  await expect(
    card.getByRole('button', {
      name: 'Edit Ground, whole floor: Parking',
      exact: true,
    }),
  ).toHaveText('Parking');
  await card.getByRole('button', { name: 'Edit Ground', exact: true }).click();
  const ground = page.getByRole('dialog', { name: 'Ground' });
  await expect(
    ground.getByRole('textbox', { name: 'Name shown on the layout' }),
  ).toHaveAttribute('placeholder', 'Parking');
  await ground
    .getByRole('textbox', { name: 'Name shown on the layout' })
    .fill('parking');
  await ground.getByRole('button', { name: 'Done' }).click();
  await expect(
    card.getByRole('button', {
      name: 'Edit Ground, whole floor: Parking',
      exact: true,
    }),
  ).toHaveText('Parking');
  const submitted = page.waitForRequest((request) =>
    Boolean(request.headers()['next-action']),
  );
  await card.getByRole('button', { name: 'Save building' }).click();
  const [blockId, , payload] = (await submitted).postDataJSON();
  expect(blockId).toBeNull();
  expect(payload.version).toBeNull();
  expect(payload.floors.map(({ level }: { level: number }) => level)).toEqual([
    2, 1, 0,
  ]);
});
