// Verify the privileged sign-in check exposes only its boolean result.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/privileged/server-client', () => ({
  privilegedClient: { rpc: mocks.rpc },
}));

import { hasSignInAccess } from '../../src/core/privileged/auth-invitations';

describe('sign-in invitation check', () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  });

  it('sends a trimmed email to the restricted database function', async () => {
    await expect(hasSignInAccess(' invitee@example.test ')).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('has_signin_access', {
      p_email: 'invitee@example.test',
    });
  });

  it('returns false for unknown emails without leaking membership data', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(hasSignInAccess('unknown@example.test')).resolves.toBe(false);
  });

  it('surfaces database errors and malformed results', async () => {
    const databaseError = new Error('Database unavailable.');
    mocks.rpc.mockResolvedValue({ data: null, error: databaseError });

    await expect(hasSignInAccess('invitee@example.test')).rejects.toMatchObject(
      {
        message: 'Sign-in access check is unavailable.',
        cause: databaseError,
      },
    );

    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(hasSignInAccess('invitee@example.test')).rejects.toThrow(
      'Sign-in access check returned no result.',
    );
  });
});
