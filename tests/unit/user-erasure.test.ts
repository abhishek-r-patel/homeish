// Verify auth deletion is retriable and only completes after profile anonymization.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invokeUntypedRpc: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: mocks.invokeUntypedRpc,
}));
vi.mock('../../src/core/privileged/server-client', () => ({
  privilegedClient: {
    auth: { admin: { deleteUser: mocks.deleteUser } },
  },
}));

import { runUserErasurePrivileged } from '../../src/core/privileged/user-erasure';

describe('user erasure privileged task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce({ authAccountPresent: true })
      .mockResolvedValueOnce({
        completed: true,
        profileStatus: 'anonymized',
      });
    mocks.deleteUser.mockResolvedValue({ error: null });
  });

  it('deletes the auth account between database preparation and completion', async () => {
    await expect(
      runUserErasurePrivileged('target-user', 'developer-user', 'request-123'),
    ).resolves.toBeUndefined();

    expect(mocks.invokeUntypedRpc).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'user_erasure_prepare',
      {
        p_user_id: 'target-user',
        p_actor_id: 'developer-user',
        p_request_id: 'request-123',
      },
    );
    expect(mocks.deleteUser).toHaveBeenCalledOnce();
    expect(mocks.deleteUser).toHaveBeenCalledWith('target-user');
    expect(mocks.invokeUntypedRpc).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'user_erasure_complete',
      {
        p_user_id: 'target-user',
        p_actor_id: 'developer-user',
        p_request_id: 'request-123',
      },
    );
    expect(mocks.invokeUntypedRpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteUser.mock.invocationCallOrder[0]!,
    );
    expect(mocks.deleteUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.invokeUntypedRpc.mock.invocationCallOrder[1]!,
    );
  });

  it('finishes a previous run when the auth account is already gone', async () => {
    mocks.invokeUntypedRpc.mockReset();
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce({ authAccountPresent: false })
      .mockResolvedValueOnce({
        completed: true,
        profileStatus: 'anonymized',
      });

    await expect(
      runUserErasurePrivileged(
        'target-user',
        'developer-user',
        'request-retry',
      ),
    ).resolves.toBeUndefined();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledTimes(2);
  });

  it('does not mark erasure complete when auth deletion fails', async () => {
    mocks.deleteUser.mockResolvedValueOnce({
      error: new Error('auth unavailable'),
    });

    await expect(
      runUserErasurePrivileged(
        'target-user',
        'developer-user',
        'request-failed',
      ),
    ).rejects.toThrow('Could not delete the auth account for user erasure.');
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledOnce();
  });
});
