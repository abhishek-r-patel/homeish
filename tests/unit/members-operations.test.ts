// Verify registration decisions dispatch only their committed request's push notifications.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  buildRequestContext: vi.fn(),
  invokeUntypedRpc: vi.fn(),
  rpc: vi.fn(),
  sendNotificationPushesForRequest: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/permissions/authorize', () => ({
  authorizeRequest: mocks.authorizeRequest,
}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: mocks.invokeUntypedRpc,
}));
vi.mock('../../src/core/db/server-client', () => ({
  createUserSupabaseClient: vi.fn(),
}));
vi.mock('../../src/core/privileged/notification-delivery', () => ({
  sendNotificationPushesForRequest: mocks.sendNotificationPushesForRequest,
}));

import {
  assignOccupant,
  approveSocietyRegistration,
  rejectSocietyRegistration,
} from '../../src/core/members/operations';

const membershipId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const requestId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const societyId = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const unitId = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';

describe('membership operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildRequestContext.mockResolvedValue({
      db: {},
      societyId,
    });
    mocks.invokeUntypedRpc.mockResolvedValue(undefined);
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.sendNotificationPushesForRequest.mockResolvedValue({
      failed: 0,
      pruned: 0,
      sent: 0,
    });
  });

  it.each([
    ['approve', approveSocietyRegistration, 'approve_society_registration'],
    ['reject', rejectSocietyRegistration, 'reject_society_registration'],
  ] as const)(
    'dispatches notifications after a successful %s transaction',
    async (decision, operation, functionName) => {
      const formData = new FormData();
      formData.set('membershipId', membershipId);
      if (decision === 'reject') formData.set('reason', 'Not listed');

      await operation(formData, requestId);

      expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
        {},
        functionName,
        expect.objectContaining({
          p_society_id: societyId,
          p_membership_id: membershipId,
          p_request_id: requestId,
        }),
      );
      expect(mocks.sendNotificationPushesForRequest).toHaveBeenCalledWith(
        requestId,
      );
      expect(
        mocks.sendNotificationPushesForRequest.mock.invocationCallOrder[0],
      ).toBeGreaterThan(
        mocks.invokeUntypedRpc.mock.invocationCallOrder[0] ?? 0,
      );
    },
  );

  it('parses checked occupancy form fields as booleans', async () => {
    const formData = new FormData();
    formData.set('unitId', unitId);
    formData.set('membershipId', membershipId);
    formData.set('relationship', 'owner');
    formData.set('isPrimary', 'on');
    formData.set('isApprover', 'on');
    mocks.buildRequestContext.mockResolvedValueOnce({
      db: { rpc: mocks.rpc },
      societyId,
    });

    await assignOccupant(formData, requestId);

    expect(mocks.rpc).toHaveBeenCalledWith(
      'assign_unit_occupant',
      expect.objectContaining({
        p_is_primary: true,
        p_is_approver: true,
      }),
    );
  });

  it('treats omitted occupancy checkboxes as false', async () => {
    const formData = new FormData();
    formData.set('unitId', unitId);
    formData.set('membershipId', membershipId);
    formData.set('relationship', 'owner');
    mocks.buildRequestContext.mockResolvedValueOnce({
      db: { rpc: mocks.rpc },
      societyId,
    });

    await assignOccupant(formData, requestId);

    expect(mocks.rpc).toHaveBeenCalledWith(
      'assign_unit_occupant',
      expect.objectContaining({
        p_is_primary: false,
        p_is_approver: false,
      }),
    );
  });

  it('does not dispatch a push when the decision transaction fails', async () => {
    mocks.invokeUntypedRpc.mockRejectedValue(
      new Error('RPC failed.', { cause: { code: 'P0002' } }),
    );
    const formData = new FormData();
    formData.set('membershipId', membershipId);

    await expect(
      approveSocietyRegistration(formData, requestId),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.sendNotificationPushesForRequest).not.toHaveBeenCalled();
  });
});
