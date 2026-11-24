// Verify resident-home authorization, enabled modules and database response validation.
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/core/db/database.types';
import type { RequestContext } from '../../src/core/tenancy/request-context';

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: vi.fn(),
}));

import { getResidentHome } from '../../src/core/home/operations';
import { buildRequestContext } from '../../src/core/tenancy/request-context';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const unitId = '7a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const snapshot = {
  resident_name: 'Synthetic Resident',
  timezone: 'Asia/Kolkata',
  unit_label: 'Flat',
  units: [{ id: unitId, number: 'A-101' }],
  pending_visitors: 1,
  pending_deliveries: 0,
  server_now: '2026-11-20T08:00:00Z',
  next_response_at: '2026-11-20T08:05:00Z',
  activity: [],
};
const fetchMock = vi.fn<typeof fetch>();
let context: RequestContext;

function urlOf(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

describe('resident home', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (request) => {
      if (urlOf(request).endsWith('/rpc/resident_home_get')) {
        return Response.json(snapshot);
      }
      if (urlOf(request).endsWith('/rpc/billing_resident_outstanding')) {
        return Response.json([
          {
            unit_id: unitId,
            outstanding_paise: '9007199254740993',
            next_due_date: '2026-11-30',
          },
        ]);
      }
      if (urlOf(request).endsWith('/rpc/person_workspace_preferences_get')) {
        return Response.json([]);
      }
      if (urlOf(request).endsWith('/rpc/workspace_quick_action_defaults_get')) {
        return Response.json(['visitor.preapprove', 'billing.view']);
      }
      if (urlOf(request).endsWith('/rpc/workspace_coming_up_get')) {
        return Response.json([]);
      }
      if (urlOf(request).endsWith('/rpc/resident_dashboard_graph_get')) {
        return Response.json(
          Array.from({ length: 6 }, (_, index) => ({
            month_start: `2026-${String(index + 6).padStart(2, '0')}-01`,
            amount: 0,
            has_data: false,
          })),
        );
      }
      throw new Error('Unexpected synthetic request.');
    });
    context = {
      db: createClient<Database>(
        'https://home-fixture.example.test',
        'synthetic-public-key',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
          global: { fetch: fetchMock },
        },
      ),
      enabledModules: new Set(['core', 'visitor', 'billing']),
      isDeveloper: false,
      isDeveloperAccount: false,
      isHindiEnabled: false,
      languagePreference: 'en',
      memberships: [{ societyId, roles: ['resident', 'admin'] }],
      mfaVerified: false,
      requestId: 'home-query-test',
      roles: ['resident', 'admin'],
      societyId,
      societyStatus: 'active',
      userId: societyId,
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
    vi.mocked(buildRequestContext).mockResolvedValue(context);
  });

  it('returns exact totals and resident-only shortcuts for a multi-role user', async () => {
    const result = await getResidentHome();
    expect(result.outstanding?.[0]?.outstanding_paise).toBe('9007199254740993');
    expect(result.shortcuts.map(({ href }) => href)).toContain('/visitors');
    expect(result.shortcuts.map(({ href }) => href)).toContain('/bills');
    expect(
      result.shortcuts.every(({ href }) => !href.startsWith('/admin')),
    ).toBe(true);
    expect(result.suspended).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('does not request or imply a balance when billing is disabled', async () => {
    context.enabledModules = new Set(['core', 'visitor']);
    const result = await getResidentHome();
    expect(result.outstanding).toBeNull();
    expect(result.shortcuts.some(({ href }) => href === '/bills')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('denies non-residents before querying household data', async () => {
    context.roles = ['guard'];
    await expect(getResidentHome()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed or unavailable household data instead of showing an empty home', async () => {
    context.enabledModules = new Set(['core']);
    fetchMock.mockResolvedValueOnce(
      Response.json({ ...snapshot, pending_visitors: -1 }),
    );
    await expect(getResidentHome()).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { code: '42501', message: 'Synthetic denied request' },
        { status: 403 },
      ),
    );
    await expect(getResidentHome()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
