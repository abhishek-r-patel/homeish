// Verify resident-home states, localization and typography with synthetic data.
import { expect, test } from './fixtures';

test('shows household actions, exact dues and the five latest updates', async ({
  page,
}) => {
  await page.goto('/fixtures/home');
  await expect(
    page.getByRole('heading', { name: 'Hello Synthetic Resident' }),
  ).toBeVisible();
  await expect(page.getByText('Flat A-101')).toBeVisible();
  await expect(page.getByText('Updated 1:30 pm')).toBeVisible();
  await expect(page.getByText('₹12,500.00')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /1 visitor needs your response/ }),
  ).toHaveAttribute('href', '/visitors');
  await expect(
    page.getByRole('link', { name: /2 deliveries need your response/ }),
  ).toHaveAttribute('href', '/deliveries');
  const activity = page.getByRole('region', { name: 'Recent activity' });
  await expect(activity.getByRole('listitem')).toHaveCount(5);
  await expect(
    activity.getByRole('link', { name: /Plumbing/ }),
  ).toHaveAttribute('href', /\/requests\//);
});

test('does not advertise disabled modules or invent a balance', async ({
  page,
}) => {
  await page.goto('/fixtures/home?state=disabled');
  await expect(
    page.getByRole('heading', { name: 'Action needed' }),
  ).toHaveCount(0);
  await expect(page.getByText('Amount due')).toHaveCount(0);
  const shortcuts = page.getByRole('region', { name: 'Quick actions' });
  await expect(shortcuts.getByRole('link', { name: 'Requests' })).toBeVisible();
  await expect(shortcuts.getByRole('link', { name: 'Bills' })).toHaveCount(0);
  await expect(shortcuts.getByRole('link', { name: 'Visitors' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('region', { name: 'Recent activity' }),
  ).not.toContainText('Synthetic parcel');
});

test('explains empty, unlinked and suspended states', async ({ page }) => {
  await page.goto('/fixtures/home?state=empty');
  await expect(
    page.getByRole('heading', { name: 'Action needed' }),
  ).toHaveCount(0);
  await expect(page.getByText('No activity yet')).toBeVisible();
  await page.goto('/fixtures/home?state=no-unit');
  await expect(page.getByText('No active unit linked')).toBeVisible();
  await expect(page.getByText('You are all paid up.')).toHaveCount(0);
  await page.goto('/fixtures/home?state=suspended');
  await expect(
    page.getByText('This society is suspended. Home information is read-only.'),
  ).toBeVisible();
  await expect(page.getByText('₹12,500.00')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /needs your response/ }),
  ).toHaveCount(0);
});

test('translates new home copy and preserves the Hindi font', async ({
  page,
}) => {
  await page.goto('/fixtures/home?locale=hi');
  await expect(
    page.getByRole('heading', { name: 'आपकी कार्रवाई ज़रूरी है' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'हाल की गतिविधि' }),
  ).toBeVisible();
  await expect(page.getByText('1 आगंतुक के लिए आपका जवाब चाहिए')).toBeVisible();
  await expect(page.locator('[lang="hi"]').first()).toHaveCSS(
    'font-family',
    /Noto Sans Devanagari/,
  );
});

test('loads the chosen local fonts with aligned financial digits', async ({
  page,
}) => {
  await page.goto('/fixtures/home');
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const body = getComputedStyle(document.body).fontFamily;
    const heading = getComputedStyle(document.querySelector('h1')!).fontFamily;
    const node = document.createElement('span');
    node.style.cssText =
      "position:absolute;font:32px 'Nunito Variable';font-variant-numeric:tabular-nums";
    document.body.append(node);
    const widths = Array.from('0123456789', (digit) => {
      node.textContent = digit;
      return node.getBoundingClientRect().width;
    });
    node.remove();
    return { body, heading, widths };
  });
  expect(fonts.body).toContain('Nunito Variable');
  expect(fonts.heading).toContain('Quicksand Variable');
  expect(Math.max(...fonts.widths) - Math.min(...fonts.widths)).toBeLessThan(
    0.1,
  );
});

test('warns when the device goes offline', async ({ context, page }) => {
  await page.goto('/fixtures/home?live=1');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(
    page.getByText(
      'Connection lost. Home may be out of date until you reconnect.',
    ),
  ).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(
    page.getByText(
      'Connection lost. Home may be out of date until you reconnect.',
    ),
  ).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  const refreshed = page.waitForRequest(
    (request) => {
      const url = new URL(request.url());
      return url.pathname === '/fixtures/home' && url.searchParams.has('_rsc');
    },
    { timeout: 3_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await refreshed;
});

test('shows the connection warning if already offline on first load', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
  });
  await page.goto('/fixtures/home?live=1');
  await expect(
    page.getByText(
      'Connection lost. Home may be out of date until you reconnect.',
    ),
  ).toBeVisible();
});
