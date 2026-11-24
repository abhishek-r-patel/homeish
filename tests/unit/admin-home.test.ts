// Verify admin-home authorization, the admin-only actions feed and its label coverage.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/core/db/database.types';
import type { RequestContext } from '../../src/core/tenancy/request-context';

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: vi.fn(),
}));
vi.mock('../../src/core/billing/collection-operations', () => ({
  getBillingMonthlyCollection: vi.fn(),
}));
vi.mock('../../src/core/home/workspace-operations', () => ({
  getConfiguredQuickActions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../src/core/home/dashboard-reads', () => ({
  getComingUp: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../src/core/tenancy/workspace-settings', () => ({
  getManagingBodyName: vi.fn().mockResolvedValue('Association'),
}));

import { getAdminHome } from '../../src/core/home/admin-operations';
import {
  ADMIN_ACTION_LABELS,
  ADMIN_ACTIVITY_LABELS,
  adminActionLabel,
} from '../../src/core/home/admin-presentation';
import { HINDI_MESSAGES } from '../../src/core/i18n/messages';
import { buildRequestContext } from '../../src/core/tenancy/request-context';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const snapshot = {
  timezone: 'Asia/Kolkata',
  server_now: '2026-11-20T08:00:00Z',
  visitors: { status: 'ok', today: 2, inside: 1 },
  requests: { status: 'unavailable' },
  billing: null,
  amc: null,
  stock: null,
  tenancy: null,
  registrations: { status: 'ok', pending: 0 },
  meeting: null,
  activity: { status: 'ok', items: [] },
};
const action = {
  id: '42',
  action: 'notice.publish',
  actor_role: 'committee',
  created_at: '2026-11-20T07:00:00Z',
};
const fetchMock = vi.fn<typeof fetch>();
let context: RequestContext;
let actionsResponse: () => Response;

function urlOf(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

describe('admin home', () => {
  beforeEach(() => {
    actionsResponse = () => Response.json([action]);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (request) => {
      if (urlOf(request).endsWith('/rpc/admin_home_get')) {
        return Response.json(snapshot);
      }
      if (urlOf(request).endsWith('/rpc/admin_home_admin_actions')) {
        return actionsResponse();
      }
      throw new Error('Unexpected synthetic request.');
    });
    context = {
      db: createClient<Database>(
        'https://admin-home.example.test',
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
      enabledModules: new Set(['core', 'visitor']),
      isDeveloper: false,
      isDeveloperAccount: false,
      isHindiEnabled: false,
      languagePreference: 'en',
      memberships: [{ societyId, roles: ['admin'] }],
      mfaVerified: false,
      requestId: 'admin-home-test',
      roles: ['admin'],
      societyId,
      societyStatus: 'active',
      userId: societyId,
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
    vi.mocked(buildRequestContext).mockResolvedValue(context);
  });

  it('loads the sections and the admin actions feed for an admin', async () => {
    const result = await getAdminHome();
    expect(result.snapshot.visitors).toEqual(snapshot.visitors);
    expect(result.snapshot.requests).toEqual({ status: 'unavailable' });
    expect(result.actions).toEqual({ status: 'ok', items: [action] });
  });

  it('never requests the admin actions feed for a committee member', async () => {
    context.roles = ['committee'];
    const result = await getAdminHome();
    expect(result.actions).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('keeps the dashboard when only the admin actions feed fails', async () => {
    actionsResponse = () =>
      Response.json({ code: '57014', message: 'Synthetic' }, { status: 500 });
    const result = await getAdminHome();
    expect(result.snapshot.visitors).toEqual(snapshot.visitors);
    expect(result.actions).toEqual({ status: 'unavailable' });
  });

  it('denies housekeeping supervisors and residents before querying', async () => {
    for (const roles of [['hk_supervisor'], ['resident']] as const) {
      context.roles = [...roles];
      await expect(getAdminHome()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed dashboard data instead of showing zeros', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ ...snapshot, visitors: { status: 'ok', today: -1 } }),
    );
    await expect(getAdminHome()).rejects.toThrow();
  });

  it('labels exactly the actions the database allow-list returns', () => {
    const sql = readFileSync(
      resolve('supabase/migrations/20261127090000_core_admin_home.sql'),
      'utf8',
    );
    const list = /allowed constant text\[\] := ARRAY\[([^\]]+)\]/.exec(
      sql,
    )![1]!;
    const allowed = [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(Object.keys(ADMIN_ACTION_LABELS).sort()).toEqual(allowed.sort());
  });

  it('has a Hindi translation for every label built from a map', () => {
    const labels = [
      ...Object.values(ADMIN_ACTION_LABELS),
      ...Object.values(ADMIN_ACTIVITY_LABELS),
      adminActionLabel('unknown.action'),
    ];
    expect(
      labels.filter((label) => !Object.hasOwn(HINDI_MESSAGES, label)),
    ).toEqual([]);
  });
});
