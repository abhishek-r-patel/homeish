// Verify auth Server Actions derive request context and return safe action states.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/core/errors';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  logUnexpectedError: vi.fn(),
  requestCode: vi.fn(),
  verifyCode: vi.fn(),
  signOut: vi.fn(),
  switchSociety: vi.fn(),
  safeReturnPath: vi.fn((candidate: unknown) =>
    typeof candidate === 'string' ? candidate : null,
  ),
  developerSignIn: vi.fn(),
  developerVerifyMfa: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('../../src/core/auth', () => ({
  requestCode: mocks.requestCode,
  safeReturnPath: mocks.safeReturnPath,
  verifyCode: mocks.verifyCode,
  signOut: mocks.signOut,
}));
vi.mock('../../src/core/tenancy/session', () => ({
  switchSociety: mocks.switchSociety,
}));
vi.mock('../../src/core/auth/developer', () => ({
  developerSignIn: mocks.developerSignIn,
  developerVerifyMfa: mocks.developerVerifyMfa,
}));
vi.mock('../../src/core/logging/error-logger', () => ({
  logUnexpectedError: mocks.logUnexpectedError,
}));

import {
  requestCodeAction,
  developerSignInAction,
  developerVerifyMfaAction,
  signOutAction,
  verifyCodeAction,
} from '../../src/app/(auth)/actions';

const requestId = '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0';

function makeFormData(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe('auth Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(
      new Headers({
        'x-request-id': requestId,
        'x-vercel-forwarded-for': '198.51.100.10',
        'x-forwarded-for': '198.51.100.20, 198.51.100.30',
      }),
    );
    mocks.logUnexpectedError.mockResolvedValue('ERR-A1B2C3D4E5');
    mocks.requestCode.mockResolvedValue({
      message: 'If this email is registered, a code has been sent.',
    });
    mocks.verifyCode.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.developerSignIn.mockResolvedValue({ step: 'verify' });
    mocks.developerVerifyMfa.mockResolvedValue(undefined);
  });

  it('passes validated form values and host-derived context to requestCode', async () => {
    const formData = makeFormData({
      email: 'member@example.test',
      purpose: 'signin',
    });

    await expect(requestCodeAction(formData)).resolves.toEqual({
      ok: true,
      message: 'If this email is registered, a code has been sent.',
    });
    expect(mocks.requestCode).toHaveBeenCalledWith(
      { email: 'member@example.test', purpose: 'signin' },
      { requestId, ipAddress: '198.51.100.10' },
    );
  });

  it('returns expected application errors without logging sensitive form values', async () => {
    mocks.verifyCode.mockRejectedValue(
      new AppError('UNAUTHENTICATED', { message: 'That code is invalid.' }),
    );

    await expect(
      verifyCodeAction(
        makeFormData({ email: 'member@example.test', code: '123456' }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'That code is invalid.',
    });
    expect(mocks.logUnexpectedError).not.toHaveBeenCalled();
  });

  it('logs unexpected failures with a reference ID and returns a safe error', async () => {
    mocks.signOut.mockRejectedValue(new Error('Auth service unavailable.'));

    await expect(signOutAction()).resolves.toMatchObject({
      ok: false,
      code: 'INTERNAL_ERROR',
      referenceId: 'ERR-A1B2C3D4E5',
    });
    expect(mocks.logUnexpectedError).toHaveBeenCalledWith(expect.any(Error), {
      requestId,
      route: 'auth.signOut',
      source: 'server',
    });
  });

  it('passes developer password sign-in through the bounded server action', async () => {
    const formData = makeFormData({
      email: 'dev@example.test',
      password: 'developer-password',
    });

    await expect(developerSignInAction(formData)).resolves.toEqual({
      ok: true,
      developer: { step: 'verify' },
    });
    expect(mocks.developerSignIn).toHaveBeenCalledWith(
      { email: 'dev@example.test', password: 'developer-password' },
      { requestId, ipAddress: '198.51.100.10' },
    );
  });

  it('returns only a fixed destination after developer MFA verification', async () => {
    await expect(
      developerVerifyMfaAction(makeFormData({ code: '123456' })),
    ).resolves.toEqual({ ok: true, redirectTo: '/developer' });
    expect(mocks.developerVerifyMfa).toHaveBeenCalledWith(
      { code: '123456' },
      { requestId, ipAddress: '198.51.100.10' },
    );
  });
});
