import { describe, expect, it } from 'vitest';
import { resolveQuickActions } from '../../src/core/home/quick-actions';

describe('dashboard quick actions', () => {
  it('filters switched-off modules and missing permissions in stored order', () => {
    expect(
      resolveQuickActions(
        'committee',
        ['billing', 'notice'],
        ['notice.create', 'billing.generate', 'billing.view'],
      ).map(({ key, href }) => ({ key, href })),
    ).toEqual([
      { key: 'notice.create', href: '/admin/notices/new' },
      { key: 'billing.view', href: '/admin/billing' },
    ]);
  });

  it('uses role-specific routes for one action key', () => {
    expect(
      resolveQuickActions('resident', ['billing'], ['billing.view'])[0]?.href,
    ).toBe('/bills');
    expect(
      resolveQuickActions('committee', ['billing'], ['billing.view'])[0]?.href,
    ).toBe('/admin/billing');
  });

  it('ignores unknown stored keys and preserves configured order', () => {
    expect(
      resolveQuickActions(
        'resident',
        ['billing', 'visitor', 'service_request'],
        ['unknown', 'request.create', 'visitor.preapprove', 'billing.view'],
      ).map(({ key }) => key),
    ).toEqual(['request.create', 'visitor.preapprove', 'billing.view']);
  });

  it('keeps the stored pin order and drops a pin that becomes unavailable', () => {
    expect(
      resolveQuickActions(
        'resident',
        ['billing', 'service_request'],
        ['request.create', 'visitor.preapprove', 'billing.view'],
      ).map(({ key }) => key),
    ).toEqual(['request.create', 'billing.view']);
  });
});
