// Ensure role shells never fetch private moving details or selectors for status-only screens.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/core/errors';
import type {
  TenancyPage,
  TenancyWorkspace,
} from '../../src/core/tenancy/moves/validation';

const mocks = vi.hoisted(() => ({
  workspace: vi.fn<(includeTargets?: boolean) => Promise<TenancyWorkspace>>(),
  list: vi.fn<() => Promise<TenancyPage>>(),
  detail: vi.fn(),
  progress: vi.fn(),
  handovers: vi.fn(),
  handoverDetail: vi.fn(),
  unitHandovers: vi.fn(),
  routeState: vi.fn(() => null),
  workspaceView: vi.fn(() => null),
  moveView: vi.fn(() => null),
}));
vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/moves/operations', () => ({
  getTenancyWorkspace: mocks.workspace,
  listTenancyMoves: mocks.list,
  getTenancyMove: mocks.detail,
  getTenancyMoveProgress: mocks.progress,
}));
vi.mock('../../src/core/tenancy/transfers/operations', () => ({
  listClearanceHandovers: mocks.handovers,
  getClearanceHandover: mocks.handoverDetail,
}));
vi.mock('../../src/core/structure/handover-operations', () => ({
  getUnitHandoverWorkspace: mocks.unitHandovers,
}));
vi.mock('../../src/components/tenancy/workspace', () => ({
  TenancyRouteState: mocks.routeState,
  TenancyWorkspaceView: mocks.workspaceView,
  TenancyMoveView: mocks.moveView,
}));
import {
  TenancyDetailPage,
  TenancyIndexPage,
} from '../../src/components/tenancy/server-pages';

const moveId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const workspace: TenancyWorkspace = {
  today: '2026-11-15',
  timezone: 'Asia/Kolkata',
  unit_label: 'Flat',
  can_manage: false,
  can_create: false,
  can_write: true,
  police_verification_required: false,
  amenity_enabled: false,
  units: [],
  tenants: [],
  occupancies: [],
  bookings: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.workspace.mockResolvedValue(workspace);
  mocks.list.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
  mocks.progress.mockResolvedValue({
    move_id: moveId,
    version: 3,
    steps: [],
    verification_tracking_enabled: false,
    verification: { status: null, checked_on: null, reference: null },
    agreement: { type: null, starts_on: null, expires_on: null },
  });
  mocks.handovers.mockResolvedValue({
    items: [],
    total: 0,
    limit: 25,
    offset: 0,
  });
  mocks.unitHandovers.mockResolvedValue({
    can_manage: false,
    today: '2026-11-15',
    template: { items: [], version: 0, updated_at: null },
    parties: [],
    moves: [],
    transfer_cases: [],
    readings: [],
    handovers: [],
  });
});

describe('moving screen boundaries', () => {
  it('does not fetch private administrative details for committee members, including an owner with a resident capability', async () => {
    mocks.workspace.mockResolvedValue({ ...workspace, can_create: true });
    const result = await TenancyDetailPage({
      audience: 'management',
      baseHref: '/admin/tenancy',
      params: Promise.resolve({ id: moveId }),
    });
    expect(result).toMatchObject({
      type: mocks.routeState,
      props: { kind: 'denied' },
    });
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.workspace).toHaveBeenCalledExactlyOnceWith(false);
  });

  it.each(['guard', 'management'] as const)(
    'loads no private selector data for the %s schedule',
    async (audience) => {
      mocks.workspace.mockResolvedValue({
        ...workspace,
        can_create: audience === 'management',
      });
      const result = await TenancyIndexPage({
        audience,
        baseHref: audience === 'guard' ? '/guard/tenancy' : '/admin/tenancy',
        searchParams: Promise.resolve({
          status: 'approved',
          limit: '10',
          offset: '20',
        }),
      });
      expect(result).toMatchObject({
        type: mocks.workspaceView,
        props: { audience, status: 'approved' },
      });
      expect(mocks.workspace).toHaveBeenCalledExactlyOnceWith(false);
      expect(mocks.detail).not.toHaveBeenCalled();
      expect(mocks.list).toHaveBeenCalledWith({
        status: 'approved',
        limit: 10,
        offset: 20,
      });
    },
  );

  it('loads scoped create choices only after writable resident access is confirmed', async () => {
    mocks.workspace.mockResolvedValue({ ...workspace, can_create: true });
    await TenancyIndexPage({
      audience: 'resident',
      baseHref: '/tenancy',
      searchParams: Promise.resolve({}),
    });
    expect(mocks.workspace.mock.calls).toEqual([[false], [true]]);
    mocks.workspace
      .mockClear()
      .mockResolvedValue({ ...workspace, can_create: true, can_write: false });
    await TenancyIndexPage({
      audience: 'resident',
      baseHref: '/tenancy',
      searchParams: Promise.resolve({}),
    });
    expect(mocks.workspace).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('authorises even malformed filters and never turns a disabled module into an empty schedule', async () => {
    mocks.workspace.mockRejectedValue(new AppError('MODULE_DISABLED'));
    const result = await TenancyIndexPage({
      audience: 'resident',
      baseHref: '/tenancy',
      searchParams: Promise.resolve({ limit: '11' }),
    });
    expect(result).toMatchObject({
      type: mocks.routeState,
      props: { kind: 'disabled' },
    });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('rejects invalid filters and identifiers without issuing the corresponding data reads', async () => {
    const result = await TenancyIndexPage({
      audience: 'resident',
      baseHref: '/tenancy',
      searchParams: Promise.resolve({ offset: '-1' }),
    });
    expect(result).toMatchObject({ props: { kind: 'invalid_filters' } });
    expect(mocks.list).not.toHaveBeenCalled();
    await TenancyDetailPage({
      audience: 'resident',
      baseHref: '/tenancy',
      params: Promise.resolve({ id: 'invalid' }),
    });
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('preserves unexpected failures for the shared reference-ID error boundary', async () => {
    const error = new Error('Synthetic database failure');
    mocks.workspace.mockRejectedValue(error);
    await expect(
      TenancyDetailPage({
        audience: 'resident',
        baseHref: '/tenancy',
        params: Promise.resolve({ id: moveId }),
      }),
    ).rejects.toBe(error);
  });
});
