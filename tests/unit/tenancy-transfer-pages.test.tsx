// Verify admin transfer pages remain target-free until permission is known.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenancyWorkspace } from '../../src/core/tenancy/moves/validation';

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  dues: vi.fn(),
  certificates: vi.fn(),
  acknowledgement: vi.fn(),
  view: vi.fn(() => null),
}));
vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/moves/operations', () => ({
  getTenancyWorkspace: mocks.workspace,
}));
vi.mock('../../src/core/tenancy/transfers/operations', () => ({
  listTransferCases: mocks.list,
  getTransferCase: mocks.detail,
  checkClearanceDues: mocks.dues,
  listTenancyCertificates: mocks.certificates,
  getClearanceAcknowledgement: mocks.acknowledgement,
}));
vi.mock('../../src/components/tenancy/transfer-workspace', () => ({
  TransferWorkspaceView: mocks.view,
  TenancyAdminTabs: vi.fn(() => null),
}));
vi.mock('../../src/components/tenancy/transfer-detail', () => ({
  TransferCaseView: vi.fn(() => null),
}));
vi.mock('../../src/components/tenancy/workspace', () => ({
  TenancyRouteState: vi.fn(() => null),
}));

import { TenancyTransferIndexPage } from '../../src/components/tenancy/transfer-pages';

const workspace: TenancyWorkspace = {
  today: '2026-11-22',
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
  mocks.list.mockResolvedValue({
    items: [],
    total: 0,
    limit: 25,
    offset: 0,
  });
  mocks.certificates.mockResolvedValue({
    items: [],
    total: 0,
    limit: 100,
    offset: 0,
  });
  mocks.acknowledgement.mockResolvedValue({
    acknowledged: true,
    acknowledged_at: '2026-11-22T10:00:00Z',
  });
});

describe('transfer page boundaries', () => {
  it('shows committee transfer metadata without private selector targets', async () => {
    const result = await TenancyTransferIndexPage({
      searchParams: Promise.resolve({}),
    });
    expect(result).toMatchObject({
      type: mocks.view,
      props: { mode: 'committee' },
    });
    expect(mocks.workspace).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('loads admin targets only after writable admin access is confirmed', async () => {
    mocks.workspace
      .mockResolvedValueOnce({ ...workspace, can_manage: true })
      .mockResolvedValueOnce({
        ...workspace,
        can_manage: true,
        units: [
          {
            id: 'e0d55fc3-0751-4b79-86c1-5b3e25942392',
            number: 'A-101',
          },
        ],
      });
    await TenancyTransferIndexPage({
      searchParams: Promise.resolve({ limit: '10', stage: 'received' }),
    });
    expect(mocks.workspace.mock.calls).toEqual([[false], [true]]);
    expect(mocks.acknowledgement).toHaveBeenCalledOnce();
    expect(mocks.list).toHaveBeenCalledWith({
      stage: 'received',
      limit: 10,
      offset: 0,
    });
  });

  it('loads a resident case detail only when explicitly requested in the existing route', async () => {
    const caseId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
    mocks.detail.mockResolvedValue({ case: { id: caseId } });
    await TenancyTransferIndexPage({
      resident: true,
      searchParams: Promise.resolve({ transferId: caseId }),
    });
    expect(mocks.detail).toHaveBeenCalledWith(caseId);
    expect(mocks.workspace).toHaveBeenCalledExactlyOnceWith(false);
    expect(mocks.dues).not.toHaveBeenCalled();
  });
});
