// Verify directory pagination, mutation validation and guard lookup boundaries.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  buildRequestContext: vi.fn(),
  enforceRateLimit: vi.fn(),
  invokeUntypedRpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/permissions/authorize', () => ({
  authorizeRequest: mocks.authorizeRequest,
}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: mocks.invokeUntypedRpc,
}));

import {
  getDirectoryResidents,
  lookupDirectoryVehicle,
  saveDirectoryVehicle,
  setDirectoryVisibility,
} from '../../src/core/directory/operations';

const societyId = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const requestId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';

describe('directory operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildRequestContext.mockResolvedValue({
      db: {},
      roles: ['resident'],
      societyId,
    });
    mocks.invokeUntypedRpc.mockResolvedValue({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    });
  });

  it('requests a bounded resident page and validates the response', async () => {
    mocks.invokeUntypedRpc.mockResolvedValueOnce({
      items: [
        {
          membership_id: societyId,
          unit_id: societyId,
          full_name: 'Resident',
          unit_number: 'A-101',
          phone: null,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    });

    await expect(
      getDirectoryResidents({ search: ' Resident ', limit: 10, offset: 0 }),
    ).resolves.toEqual({
      items: [
        {
          membership_id: societyId,
          unit_id: societyId,
          full_name: 'Resident',
          unit_number: 'A-101',
          phone: null,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    });
    expect(mocks.authorizeRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        moduleKey: 'directory',
        permission: 'directory:list',
      }),
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      {},
      'directory_resident_list',
      {
        p_society_id: societyId,
        p_search: 'Resident',
        p_limit: 10,
        p_offset: 0,
      },
    );
  });

  it('rejects invalid page bounds before calling the database', async () => {
    await expect(
      getDirectoryResidents({ limit: 101, offset: 0 }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
  });

  it('rejects a page exceeding its declared database limit', async () => {
    const resident = {
      membership_id: societyId,
      unit_id: societyId,
      full_name: 'Synthetic Resident',
      unit_number: 'A-101',
      phone: null,
    };
    mocks.invokeUntypedRpc.mockResolvedValueOnce({
      items: [resident, resident],
      total: 2,
      limit: 1,
      offset: 0,
    });
    await expect(getDirectoryResidents({ limit: 1 })).rejects.toThrow(
      'Directory page items exceed the declared bounds.',
    );
  });

  it('does not perform a guard lookup after rate limiting rejects it', async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(new Error('Rate limited'));
    await expect(lookupDirectoryVehicle('MH01AB1234')).rejects.toThrow(
      'Rate limited',
    );
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
  });

  it('normalizes registration input before calling the save RPC', async () => {
    mocks.invokeUntypedRpc.mockResolvedValueOnce(requestId);

    await expect(
      saveDirectoryVehicle(
        {
          vehicleId: null,
          unitId: societyId,
          membershipId: null,
          vehicleType: 'car',
          registrationNumber: ' mh 01-ab-1234 ',
          tagNumber: '',
          clientRequestId: requestId,
        },
        requestId,
      ),
    ).resolves.toBe(requestId);

    expect(mocks.buildRequestContext).toHaveBeenCalledWith(requestId);
    expect(mocks.authorizeRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        moduleKey: 'directory',
        permission: 'directory:manage_household',
        write: true,
      }),
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      {},
      'directory_vehicle_save',
      expect.objectContaining({
        p_society_id: societyId,
        p_registration_number: 'MH01AB1234',
        p_tag_number: null,
      }),
    );
  });

  it('rejects invalid vehicle input before making a database call', async () => {
    await expect(
      saveDirectoryVehicle(
        {
          vehicleId: null,
          unitId: societyId,
          membershipId: null,
          vehicleType: 'car',
          registrationNumber: 'bad',
          tagNumber: null,
          clientRequestId: requestId,
        },
        requestId,
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: expect.objectContaining({
        registrationNumber: expect.any(String),
      }),
    });
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
  });

  it('limits vehicle lookup to guard-safe results and guard access', async () => {
    mocks.buildRequestContext.mockResolvedValueOnce({
      db: {},
      roles: ['guard'],
      societyId,
      userId: requestId,
      requestId,
    });
    mocks.invokeUntypedRpc.mockResolvedValueOnce([
      { vehicle_type: 'car', unit_number: 'A-101' },
    ]);

    await expect(lookupDirectoryVehicle('mh 01-ab-1234')).resolves.toEqual([
      { vehicle_type: 'car', unit_number: 'A-101' },
    ]);
    expect(mocks.authorizeRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        moduleKey: 'directory',
        permission: 'directory:lookup_vehicle',
      }),
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      {},
      'directory_guard_vehicle_lookup',
      {
        p_society_id: societyId,
        p_registration_number: 'MH01AB1234',
      },
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'otherWritesUserMinute',
      requestId,
      requestId,
    );
  });

  it('applies resident visibility settings using the active society', async () => {
    mocks.invokeUntypedRpc.mockResolvedValueOnce(null);
    await setDirectoryVisibility(
      { nameVisible: true, unitVisible: true, phoneVisible: false },
      requestId,
    );

    expect(mocks.authorizeRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        moduleKey: 'directory',
        permission: 'directory:manage_household',
        write: true,
      }),
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      {},
      'directory_set_visibility',
      {
        p_society_id: societyId,
        p_name_visible: true,
        p_unit_visible: true,
        p_phone_visible: false,
      },
    );
  });
});
