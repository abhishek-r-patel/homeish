// Browser checks for marketing, synthetic interactions and host boundaries.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('explains homepage availability and keeps the unconfigured demo disabled', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A clearer day for your committee. A calmer day for everyone.',
    }),
  ).toBeVisible();
  const demoActions = page.getByRole('button', {
    name: 'Try demo',
    exact: true,
  });
  await expect(demoActions).toHaveCount(2);
  for (const action of await demoActions.all()) {
    await expect(action).toBeDisabled();
    await expect(action.locator('..')).toContainText('Demo coming soon');
  }
  await expect(page.locator('a[href*="demo."]')).toHaveCount(0);

  const testing = page.getByRole('region', {
    name: 'Features grouped the same way as the app.',
  });
  await expect(testing).toContainText('live activation are still separate');
  await expect(
    testing.getByText('Maintenance, Fines & Payments', { exact: true }),
  ).toBeVisible();
  const next = page.getByRole('region', { name: 'What comes next' });
  await expect(next).toContainText('Nothing here is usable yet.');
  await expect(next).toContainText('Connected role demos');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('loads synthetic screenshots and resolves every homepage section link', async ({
  page,
}) => {
  await page.goto('/');
  const gallery = page.getByRole('region', {
    name: 'A look at the new Homeish design.',
  });
  await expect(gallery).toContainText('not a connected demo');
  const previews = page.getByRole('main').getByRole('img');
  await expect(previews).toHaveCount(14);
  for (const preview of await previews.all()) {
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toHaveAttribute('alt', /^Synthetic /);
    await expect(preview).toHaveJSProperty('complete', true);
    expect(
      await preview.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);
  }

  for (const link of await page
    .getByRole('navigation')
    .locator('a[href^="#"]')
    .all()) {
    const target = await link.getAttribute('href');
    if (!target) throw new Error('The section link has no destination.');
    await link.click();
    await expect(page.locator(target)).toBeInViewport();
  }
  await expect(
    page.getByRole('navigation', { name: 'Society access' }).getByRole('link', {
      name: 'Sign in',
      exact: true,
    }),
  ).toHaveAttribute('href', '/login');
});

test('supports the skip link and keyboard FAQ use with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  const question = page.getByText('Why is Try demo unavailable?', {
    exact: true,
  });
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(question.locator('..')).toHaveAttribute('open', '');
  await expect(question.locator('..')).toContainText('button stays disabled');
  await page.keyboard.press('Space');
  await expect(question.locator('..')).not.toHaveAttribute('open', '');
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe('auto');
});

test('links the marketing footer to an accessible privacy policy', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Privacy policy' })
    .click();
  // The dev server compiles /privacy on first visit, which can exceed 5s under parallel load.
  await expect(page).toHaveURL('/privacy', { timeout: 20_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Privacy policy' }),
  ).toBeVisible();
  const googleSection = page.getByRole('region', { name: 'Google user data' });
  await expect(googleSection).toContainText('drive.file');
  await expect(googleSection).toContainText('Limited Use requirements');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('renders the email-code sign-in screen accessibly', async ({ page }) => {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: 'Welcome to Homeish' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send code' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('renders the isolated developer password and MFA screen accessibly', async ({
  page,
}) => {
  await page.goto('/developer/login');
  await expect(
    page.getByRole('heading', { name: 'Developer sign in' }),
  ).toBeVisible();
  await expect(page.getByLabel('Developer email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('returns an unauthenticated session to sign-in without an open redirect', async ({
  page,
}) => {
  await page.goto('/session');
  await expect(page).toHaveURL(/\/session-expired\?returnTo=%2Fsession$/);
  await expect(
    page.getByRole('heading', { name: 'Your session has ended' }),
  ).toBeVisible();

  await page.goto('/session-expired?returnTo=https%3A%2F%2Fattacker.test');
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/login?returnTo=%2Fsession',
  );
});

test('marketing reflows from phone to desktop and society-address errors stay explicit', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 900 });
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
  const societyPage = page.getByRole('main');
  await expect(societyPage.getByRole('button')).toHaveCount(0);
  await expect(societyPage.getByRole('textbox')).toHaveCount(0);
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
