// Verify P58 homepage additions and refresh-safe completion screens accessibly.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('shows the approved P58 homepage additions accessibly', async ({
  page,
}) => {
  await page.goto('/fixtures/p57-homepage');
  const problems = page.getByRole('region', {
    name: 'Problems Homeish solves.',
  });
  await expect(problems).toBeVisible();
  await expect(problems.getByText('Before', { exact: true })).toHaveCount(5);
  await expect(problems.getByText('With Homeish', { exact: true })).toHaveCount(
    5,
  );
  const day = page.getByRole('region', {
    name: 'One day in your society.',
  });
  await expect(day).toBeVisible();
  await expect(day.getByRole('img')).toHaveCount(5);
  await expect(
    page.getByText('Can our society change how a module works?'),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const scenario of [
  { kind: 'notice', title: 'Notice scheduled', button: 'View notice' },
  { kind: 'billing', title: 'Bills generated', button: 'View bills' },
] as const) {
  test(`${scenario.title} result stays safe to refresh and moves focus`, async ({
    page,
  }) => {
    await page.goto(`/fixtures/p58-complete?kind=${scenario.kind}`);
    const heading = page.getByRole('heading', {
      level: 1,
      name: scenario.title,
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(
      page.getByRole('navigation', { name: 'Next steps' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: scenario.button }),
    ).toBeVisible();
    await page.reload();
    await expect(heading).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
