// Verify the email-code auth operations keep eligibility, attempts and sessions server-side.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUserSupabaseClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  finishAuthCodeAttempt: vi.fn(),
  hashRateLimitIdentifier: vi.fn(),
  hasSignInAccess: vi.fn(),
  ensureAuthUserForSignIn: vi.fn(),
  logUnexpectedError: vi.fn(),
  reserveAuthCodeAttempt: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  startAuthCodeChallenge: vi.fn(),
  verifyOtp: vi.fn(),
  rpc: vi.fn(),
  deleteCookie: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ delete: mocks.deleteCookie }),
}));
vi.mock('../../src/core/db/server-client', () => ({
  ACTIVE_SOCIETY_COOKIE: 'homeish-active-society',
  createUserSupabaseClient: mocks.createUserSupabaseClient,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  hashRateLimitIdentifier: mocks.hashRateLimitIdentifier,
}));
vi.mock('../../src/core/logging/error-logger', () => ({
  logUnexpectedError: mocks.logUnexpectedError,
}));
vi.mock('../../src/core/privileged', () => ({
  ensureAuthUserForSignIn: mocks.ensureAuthUserForSignIn,
  finishAuthCodeAttempt: mocks.finishAuthCodeAttempt,
  hasSignInAccess: mocks.hasSignInAccess,
  reserveAuthCodeAttempt: mocks.reserveAuthCodeAttempt,
  startAuthCodeChallenge: mocks.startAuthCodeChallenge,
}));

import { AppError } from '../../src/core/errors';
import { requestCode, signOut, verifyCode } from '../../src/core/auth';

const context = {
  requestId: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
  ipAddress: '198.51.100.4',
};
const challengeId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';

const client = {
  auth: {
    signInWithOtp: mocks.signInWithOtp,
    signOut: mocks.signOut,
    verifyOtp: mocks.verifyOtp,
  },
  rpc: mocks.rpc,
};

describe('email-code authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUserSupabaseClient.mockResolvedValue({
      client,
      activeSocietyId: null,
    });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.finishAuthCodeAttempt.mockResolvedValue(true);
    mocks.hashRateLimitIdentifier.mockResolvedValue(
      'auth:challenge:email:' + 'a'.repeat(64),
    );
    mocks.hasSignInAccess.mockResolvedValue(true);
    mocks.ensureAuthUserForSignIn.mockResolvedValue(undefined);
    mocks.logUnexpectedError.mockResolvedValue('ERR-A1B2C3D4E5');
    mocks.reserveAuthCodeAttempt.mockResolvedValue({
      status: 'reserved',
      challengeId,
      retryAfterSeconds: 0,
    });
    mocks.signInWithOtp.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.startAuthCodeChallenge.mockResolvedValue(challengeId);
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { access_token: 'test' }, user: { id: 'test-user' } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: 1, error: null });
  });

  it('returns the same generic response for eligible and unknown emails', async () => {
    mocks.hasSignInAccess
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const unknown = await requestCode(
      { email: 'unknown@example.test', purpose: 'signin' },
      context,
    );
    const eligible = await requestCode(
      { email: 'invitee@example.test', purpose: 'signin' },
      context,
    );

    expect(unknown).toEqual(eligible);
    expect(unknown.message).toBe(
      'If this email is registered, a code has been sent.',
    );
    expect(mocks.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'invitee@example.test',
      options: { shouldCreateUser: false },
    });
  });

  it('only provisions an account after the invitation check succeeds', async () => {
    mocks.hasSignInAccess.mockResolvedValue(false);

    await requestCode(
      { email: 'unknown@example.test', purpose: 'signin' },
      context,
    );

    expect(mocks.ensureAuthUserForSignIn).not.toHaveBeenCalled();
    expect(mocks.startAuthCodeChallenge).not.toHaveBeenCalled();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('keeps delivery failures generic and logs them without exposing eligibility', async () => {
    const deliveryError = { code: 'over_email_send_rate_limit' };
    mocks.signInWithOtp.mockResolvedValue({ error: deliveryError });

    const response = await requestCode(
      { email: 'invitee@example.test', purpose: 'signin' },
      context,
    );

    expect(response.message).toBe(
      'If this email is registered, a code has been sent.',
    );
    expect(mocks.logUnexpectedError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        requestId: context.requestId,
        route: 'auth.requestCode',
        source: 'server',
      }),
    );
  });

  it('keeps registration requests generic until a registration flow authorizes them', async () => {
    const response = await requestCode(
      { email: 'resident@example.test', purpose: 'register' },
      context,
    );

    expect(response.message).toBe(
      'If this email is registered, a code has been sent.',
    );
    expect(mocks.hasSignInAccess).not.toHaveBeenCalled();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('enforces email and IP policies for code requests and verification', async () => {
    await requestCode(
      { email: 'invitee@example.test', purpose: 'signin' },
      context,
    );
    await verifyCode(
      { email: 'invitee@example.test', code: '123456' },
      context,
    );

    expect(mocks.enforceRateLimit.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'authRequestCodeEmailCooldown',
          'invitee@example.test:signin',
          context.requestId,
        ],
        [
          'authRequestCodeEmailHourly',
          'invitee@example.test:signin',
          context.requestId,
        ],
        ['authRequestCodeIpHourly', context.ipAddress, context.requestId],
        [
          'authVerifyCodeEmailHourly',
          'invitee@example.test',
          context.requestId,
        ],
        ['authVerifyCodeIpHourly', context.ipAddress, context.requestId],
      ]),
    );
  });

  it('locks a code after five incorrect attempts', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { status: 400, code: 'otp_expired' },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        verifyCode({ email: 'invitee@example.test', code: '123456' }, context),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    }

    mocks.reserveAuthCodeAttempt.mockResolvedValue({
      status: 'locked',
      challengeId,
      retryAfterSeconds: 120,
    });
    await expect(
      verifyCode({ email: 'invitee@example.test', code: '123456' }, context),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 120,
    });

    expect(mocks.verifyOtp).toHaveBeenCalledTimes(5);
    expect(mocks.finishAuthCodeAttempt).toHaveBeenCalledTimes(5);
    expect(mocks.finishAuthCodeAttempt).toHaveBeenCalledWith(challengeId, {
      failed: true,
      succeeded: false,
    });
  });

  it('consumes a successful code exactly once and claims invited memberships', async () => {
    mocks.reserveAuthCodeAttempt
      .mockResolvedValueOnce({
        status: 'reserved',
        challengeId,
        retryAfterSeconds: 0,
      })
      .mockResolvedValueOnce({
        status: 'invalid',
        challengeId: null,
        retryAfterSeconds: 0,
      });

    await expect(
      verifyCode({ email: 'invitee@example.test', code: '123456' }, context),
    ).resolves.toBeUndefined();
    await expect(
      verifyCode({ email: 'invitee@example.test', code: '123456' }, context),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    expect(mocks.finishAuthCodeAttempt).toHaveBeenCalledWith(challengeId, {
      failed: false,
      succeeded: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('claim_memberships');
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('clears the session if membership claiming fails after code verification', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error('Membership claim failed.'),
    });

    await expect(
      verifyCode({ email: 'invitee@example.test', code: '123456' }, context),
    ).rejects.toThrow('Could not claim the invited memberships.');

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.deleteCookie).toHaveBeenCalledWith('homeish-active-society');
  });

  it('does not verify a code when the challenge store is unavailable', async () => {
    mocks.reserveAuthCodeAttempt.mockRejectedValue(
      new Error('Challenge database unavailable.'),
    );

    await expect(
      verifyCode({ email: 'invitee@example.test', code: '123456' }, context),
    ).rejects.toThrow('Challenge database unavailable.');

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it('validates input and signs out from the current device', async () => {
    await expect(
      requestCode({ email: 'not-an-email', purpose: 'signin' }, context),
    ).rejects.toBeInstanceOf(AppError);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();

    await signOut();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.deleteCookie).toHaveBeenCalledWith('homeish-active-society');
  });
});
