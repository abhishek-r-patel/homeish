// Verify the approved P58 group-page status lines and omission rules.
import { describe, expect, it } from 'vitest';
import { getAdminGroupStatus } from '../../src/core/home/group-status';
import type { AdminHomeSnapshot } from '../../src/core/home/admin-validation';

function snapshot(
  overrides: Partial<AdminHomeSnapshot> = {},
): AdminHomeSnapshot {
  return {
    timezone: 'Asia/Kolkata',
    server_now: '2026-11-25T10:00:00+05:30',
    visitors: { status: 'ok', today: 3, inside: 2 },
    requests: null,
    billing: {
      status: 'ok',
      collected_month_paise: '4200000',
      outstanding_paise: '1200000',
      overdue_units: 0,
      pending_payments: 0,
    },
    amc: null,
    stock: null,
    tenancy: null,
    registrations: null,
    meeting: null,
    activity: {
      status: 'ok',
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'notice_published',
          title: 'Water shutdown',
          unit_number: null,
          occurred_at: '2026-11-24T10:00:00+05:30',
        },
      ],
    },
    ...overrides,
  };
}

describe('admin group status lines', () => {
  it('formats the three approved P58 facts', () => {
    const value = snapshot();
    expect(getAdminGroupStatus('/admin/billing', value)).toBe(
      'Rs. 42000.00 collected this month',
    );
    expect(getAdminGroupStatus('/admin/visitors', value)).toBe(
      '2 visitors inside now',
    );
    expect(getAdminGroupStatus('/admin/notices', value)).toBe(
      'Last notice posted 1 day ago',
    );
  });

  it('omits a line when its source is unavailable or not in P58', () => {
    const value = snapshot({
      billing: { status: 'unavailable' },
      activity: null,
    });
    expect(getAdminGroupStatus('/admin/billing', value)).toBeNull();
    expect(getAdminGroupStatus('/admin/notices', value)).toBeNull();
    expect(getAdminGroupStatus('/admin/requests', value)).toBeNull();
  });
});
