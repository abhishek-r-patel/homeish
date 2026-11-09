// Browser checks for marketing, synthetic interactions and host boundaries.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('loads the root route with no automated accessibility violations', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'A calmer day, from gate to home.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Explore The Demo' }),
  ).toHaveAttribute('href', 'http://demo.localhost:3000');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('marketing fits a phone and society-address validation is explicit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page
    .getByLabel('Society address name', { exact: true })
    .fill('https://bad.test');
  await page.getByRole('button', { name: 'Open Society' }).click();
  await expect(page.locator('#society-error')).toContainText(
    'not a full website URL',
  );
  await page
    .getByLabel('Society address name', { exact: true })
    .fill('maplewood');
  await page.getByRole('button', { name: 'Open Society' }).click();
  await expect(page).toHaveURL('http://maplewood.localhost:3000/');
  await expect(
    page.getByRole('heading', { name: 'Maplewood is not open yet' }),
  ).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
});

test('demo interactions are synthetic and reset manually and periodically', async ({
  page,
}) => {
  await page.clock.install();
  const response = await page.goto('http://demo.localhost:3000');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(
    page.getByRole('heading', { name: 'Meet your sample society' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Allow Sample Visitor' }).click();
  await expect(page.getByRole('status')).toHaveText('Sample visitor allowed');
  await page.getByRole('button', { name: 'Reset Demo' }).click();
  await page.getByRole('button', { name: 'Deny Sample Visitor' }).click();
  await expect(page.getByRole('status')).toHaveText('Sample visitor denied');
  await page.clock.fastForward(15 * 60 * 1000);
  await expect(page.getByRole('status')).toHaveText(
    'Awaiting your sample decision',
  );
  await expect(
    page.getByText('The synthetic example was automatically reset.'),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('rejects unconfigured hosts and beta on the shared deployment', async ({
  request,
}) => {
  for (const host of [
    'unknown.homeish.vercel.app',
    'beta.homeish.vercel.app',
  ]) {
    const response = await request.get('/', { headers: { Host: host } });
    expect(response.status()).toBe(404);
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  }
  const maplewood = await request.get('/', {
    headers: { Host: 'maplewood.homeish.vercel.app' },
  });
  expect(maplewood.status()).toBe(200);
  expect(maplewood.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(await maplewood.text()).toContain('Maplewood is not open yet');
  const demo = await request.get('/', {
    headers: {
      Host: 'demo.homeish.vercel.app',
      'x-homeish-surface': 'maplewood',
    },
  });
  expect(await demo.text()).toContain('Meet your sample society');
  expect(await demo.text()).not.toContain('Maplewood is not open yet');
  const blockedLogin = await request.get('/login', {
    headers: { Host: 'maplewood.homeish.vercel.app' },
  });
  expect(blockedLogin.status()).toBe(404);
});
