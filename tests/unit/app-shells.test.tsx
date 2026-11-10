// Verify role shells render their responsive structure and route content.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/home',
}));

import {
  AdminShell,
  AuthShell,
  DeveloperShell,
  GuardShell,
  ResidentShell,
} from '../../src/components/app-shells';

describe('application shells', () => {
  it('renders resident bottom navigation and the expanded left rail', () => {
    const markup = renderToStaticMarkup(
      <ResidentShell>
        <h1>Resident content</h1>
      </ResidentShell>,
    );

    expect(markup).toContain('Resident content');
    expect(markup).toContain('aria-label="Primary navigation"');
    expect(markup).toContain('expanded:flex');
    expect(markup).toContain('expanded:hidden');
    expect(markup).toContain('aria-current="page"');
  });

  it('renders the admin collapsible rail and compact tab bar', () => {
    const markup = renderToStaticMarkup(
      <AdminShell>
        <h1>Admin content</h1>
      </AdminShell>,
    );

    expect(markup).toContain('Admin content');
    expect(markup).toContain('Expand navigation');
    expect(markup).toContain('medium:w-16');
    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Structure');
    expect(markup).toContain('Jobs');
    expect(markup).toContain('Operations');
  });

  it('limits compact tabs to four destinations plus More', () => {
    const markup = renderToStaticMarkup(
      <ResidentShell
        enabledModules={['visitor', 'billing', 'service_request', 'delivery']}
        permissionMaps={{
          billing: { 'bill:list': ['resident'] },
          delivery: { 'delivery:list': ['resident'] },
          service_request: { 'request:list': ['resident'] },
          visitor: { 'visitor:list': ['resident'] },
        }}
        unreadNotifications={101}
      >
        <h1>Resident content</h1>
      </ResidentShell>,
    );

    expect(markup).toContain('More');
    expect(markup).toContain('Deliveries');
    expect(markup).toContain('aria-label="Notifications, 101 unread"');
    expect(markup).toContain('99+');
  });

  it('keeps the guard frame focused on its action home without tabs', () => {
    const markup = renderToStaticMarkup(
      <GuardShell>
        <h1>Gate actions</h1>
      </GuardShell>,
    );

    expect(markup).toContain('Gate actions');
    expect(markup).toContain('max-w-content-narrow');
    expect(markup).not.toContain('aria-label="Primary navigation"');
  });

  it('renders the isolated dark developer shell and menu', () => {
    const markup = renderToStaticMarkup(
      <DeveloperShell>
        <h1>Developer content</h1>
      </DeveloperShell>,
    );

    expect(markup).toContain('Developer content');
    expect(markup).toContain('bg-dev-bar');
    expect(markup).toContain('Open developer navigation');
    expect(markup).toContain('Societies');
  });

  it('centers authentication content without adding a fake user session', () => {
    const markup = renderToStaticMarkup(
      <AuthShell>
        <h1>Sign In</h1>
      </AuthShell>,
    );

    expect(markup).toContain('Sign In');
    expect(markup).toContain('Homeish');
    expect(markup).toContain('max-w-content-narrow');
  });
});
