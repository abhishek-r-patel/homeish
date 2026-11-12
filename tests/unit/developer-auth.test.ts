// Verify developer password, authenticator enrollment and step-up flows.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUserSupabaseClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  clearLocalAuthSession: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  listFactors: vi.fn(),
  unenroll: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/db/server-client', () => ({
  createUserSupabaseClient: mocks.createUserSupabaseClient,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/auth', () => ({
  clearLocalAuthSession: mocks.clearLocalAuthSession,
}));

import {
  developerSignIn,
  developerVerifyMfa,
} from '../../src/core/auth/developer';

const context = {
  requestId: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
  ipAddress: '198.51.100.10',
};
const factorId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';

const client = {
  auth: {
    getUser: mocks.getUser,
    signInWithPassword: mocks.signInWithPassword,
    mfa: {
      listFactors: mocks.listFactors,
      unenroll: mocks.unenroll,
      enroll: mocks.enroll,
      challenge: mocks.challenge,
      verify: mocks.verify,
      getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
    },
  },
  rpc: mocks.rpc,
};

describe('developer authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUserSupabaseClient.mockResolvedValue({
      client,
      activeSocietyId: null,
    });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.clearLocalAuthSession.mockResolvedValue(undefined);
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'password-session' },
        user: { id: 'dev-user' },
      },
      error: null,
    });
    mocks.listFactors.mockResolvedValue({
      data: { all: [], totp: [] },
      error: null,
    });
    mocks.unenroll.mockResolvedValue({ error: null });
    mocks.enroll.mockResolvedValue({
      data: {
        id: factorId,
        type: 'totp',
        totp: {
          qr_code: 'data:image/svg+xml;utf-8,<svg/>',
          secret: 'TOTPSECRET',
          uri: 'otpauth://totp',
        },
      },
      error: null,
    });
    mocks.challenge.mockResolvedValue({
      data: { id: 'challenge-id' },
      error: null,
    });
    mocks.verify.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'dev-user' } },
      error: null,
    });
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2' },
      error: null,
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'session_developer_access') {
        return {
          data: [{ is_developer_account: true, mfa_verified: false }],
          error: null,
        };
      }
      if (name === 'record_developer_mfa') {
        return { data: '2026-11-10T12:00:00Z', error: null };
      }
      return { data: null, error: { message: 'Unexpected RPC.' } };
    });
  });

  it('only enrolls TOTP after password authentication confirms developer status', async () => {
    const result = await developerSignIn(
      { email: 'dev@example.test', password: 'strong-password' },
      context,
    );

    expect(result).toEqual({
      step: 'enroll',
      qrCode: 'data:image/svg+xml;utf-8,<svg/>',
      secret: 'TOTPSECRET',
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'developerAuthFailures',
      'dev@example.test:198.51.100.10',
      context.requestId,
    );
    expect(mocks.rpc).toHaveBeenCalledWith('session_developer_access');
  });

  it('ends a valid password session when the user is not a developer', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ is_developer_account: false, mfa_verified: false }],
      error: null,
    });

    await expect(
      developerSignIn(
        { email: 'member@example.test', password: 'correct-password' },
        context,
      ),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Email or password is not correct.',
    });
    expect(mocks.clearLocalAuthSession).toHaveBeenCalledWith(client);
    expect(mocks.enroll).not.toHaveBeenCalled();
  });

  it('challenges a verified TOTP factor and records the step-up session', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: factorId,
            factor_type: 'totp',
            status: 'verified',
          },
        ],
        totp: [{ id: factorId, factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    });

    await expect(
      developerSignIn(
        { email: 'dev@example.test', password: 'strong-password' },
        context,
      ),
    ).resolves.toEqual({ step: 'verify' });
    await developerVerifyMfa({ code: '123456' }, context);

    expect(mocks.challenge).toHaveBeenCalledWith({ factorId });
    expect(mocks.verify).toHaveBeenCalledWith({
      factorId,
      challengeId: 'challenge-id',
      code: '123456',
    });
    expect(mocks.getAuthenticatorAssuranceLevel).toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('record_developer_mfa');
  });

  it('rejects invalid authenticator codes without bypassing the challenge', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [{ id: factorId, factor_type: 'totp', status: 'verified' }],
        totp: [{ id: factorId, factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    });
    mocks.verify.mockResolvedValue({
      error: { code: 'mfa_verification_failed' },
    });

    await expect(
      developerVerifyMfa({ code: '000000' }, context),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'That authenticator code is invalid.',
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith('record_developer_mfa');
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'developerAuthFailures',
      'dev-user:198.51.100.10',
      context.requestId,
    );
  });

  it('fails closed if the provider does not establish AAL2', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [{ id: factorId, factor_type: 'totp', status: 'verified' }],
        totp: [{ id: factorId, factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    });
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    });

    await expect(
      developerVerifyMfa({ code: '123456' }, context),
    ).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
    expect(mocks.rpc).not.toHaveBeenCalledWith('record_developer_mfa');
  });
});
