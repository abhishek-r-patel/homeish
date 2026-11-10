// Verify registration decisions dispatch only their committed request's push notifications.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  buildRequestContext: vi.fn(),
  invokeUntypedRpc: vi.fn(),
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
  approveSocietyRegistration,
  rejectSocietyRegistration,
} from '../../src/core/members/operations';

const membershipId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const requestId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const societyId = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';

describe('registration decision push delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildRequestContext.mockResolvedValue({
      db: {},
      societyId,
    });
    mocks.invokeUntypedRpc.mockResolvedValue(undefined);
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
