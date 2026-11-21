// Verify admin-home sections, role differences, unavailable states and Hindi copy with synthetic data.
import { expect, test } from './fixtures';

test('shows today, the next meeting, items needing attention and both activity lists', async ({
  page,
}) => {
  await page.goto('/fixtures/admin-home');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const today = page.getByRole('region', { name: 'Today' });
  await expect(today.getByRole('listitem')).toHaveCount(6);
  await expect(
    today.getByRole('link', { name: /Still inside/ }),
  ).toHaveAttribute('href', '/admin/visitors?status=checked_in');
  await expect(today.getByRole('link', { name: /Outstanding/ })).toContainText(
    '₹12,500.00',
  );
  await expect(
    page
      .getByRole('region', { name: 'Next meeting' })
      .getByRole('link', { name: /Annual general meeting/ }),
  ).toHaveAttribute('href', /\/admin\/meetings\/b1d55fc3/);
  const attention = page.getByRole('region', { name: 'Needs attention' });
  await expect(
    attention.getByRole('link', { name: /AMC contracts ending soon/ }),
  ).toHaveAttribute('href', '/admin/amc?status=urgent');
  await expect(
    attention.getByRole('link', { name: /Payments to confirm/ }),
  ).toHaveAttribute('href', '/admin/billing?tab=payments');
  await expect(attention).toContainText('1 out of stock');
  const activity = page.getByRole('region', { name: 'Society activity' });
  await expect(activity.getByRole('listitem')).toHaveCount(3);
  await expect(
    activity.getByRole('link', { name: /New registration/ }),
  ).toHaveAttribute('href', '/admin/members');
  const actions = page.getByRole('region', { name: 'Admin actions' });
  await expect(actions.getByRole('listitem')).toHaveCount(2);
  await expect(actions).toContainText('Payment confirmed');
  await expect(actions).toContainText('Committee');
});

test('hides the admin actions feed from committee members', async ({
  page,
}) => {
  await page.goto('/fixtures/admin-home?state=committee');
  await expect(
    page.getByRole('region', { name: 'Society activity' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Admin actions' })).toHaveCount(
    0,
  );
});

test('marks failed sections unavailable with a retry instead of showing zero', async ({
  page,
}) => {
  await page.goto('/fixtures/admin-home?state=unavailable');
  const today = page.getByRole('region', { name: 'Today' });
  await expect(
    today.getByRole('link', { name: /Open requests.*Unavailable/ }),
  ).toHaveAttribute('href', '/admin');
  await expect(
    today.getByRole('link', { name: /Visitors today/ }),
  ).toContainText('12');
  for (const name of ['Next meeting', 'Society activity', 'Admin actions']) {
    await expect(
      page.getByRole('region', { name }).getByRole('link', { name: 'Retry' }),
    ).toBeVisible();
  }
  await expect(
    page
      .getByRole('region', { name: 'Needs attention' })
      .getByRole('link', { name: 'Retry' }),
  ).toHaveCount(2);
});

test('explains empty, suspended and loading states', async ({ page }) => {
  await page.goto('/fixtures/admin-home?state=empty');
  await expect(page.getByText('No meeting scheduled')).toBeVisible();
  await expect(page.getByText('No recent activity')).toBeVisible();
  await expect(page.getByText('No admin actions this week')).toBeVisible();
  await expect(page.getByRole('link', { name: /Visitors today/ })).toHaveCount(
    0,
  );
  await page.goto('/fixtures/admin-home?state=suspended');
  await expect(
    page.getByText('This society is suspended. The dashboard is read-only.'),
  ).toBeVisible();
  await page.goto('/fixtures/admin-home?state=loading');
  await expect(
    page.getByRole('status', { name: 'Loading dashboard' }),
  ).toBeVisible();
});

test('translates the dashboard into Hindi', async ({ page }) => {
  await page.goto('/fixtures/admin-home?locale=hi');
  await expect(page.getByRole('heading', { name: 'डैशबोर्ड' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'ध्यान देने योग्य' }),
  ).toBeVisible();
  await expect(page.getByText('भुगतान की पुष्टि हुई')).toBeVisible();
});
