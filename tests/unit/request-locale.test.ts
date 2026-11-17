// Verify account language is isolated from device cookies and society availability gates.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/core/errors';
import { LANGUAGE_PREFERENCE_COOKIE } from '../../src/core/i18n/locale';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  getCookie: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: mocks.getCookie }),
}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));

import { getRequestLocale } from '../../src/core/i18n/request-locale';

describe('request language resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCookie.mockReturnValue({ value: 'hi' });
  });

  it.each([
    { languagePreference: 'hi', isHindiEnabled: true, expected: 'hi' },
    { languagePreference: 'hi', isHindiEnabled: false, expected: 'en' },
    { languagePreference: 'en', isHindiEnabled: true, expected: 'en' },
  ])(
    'uses the account preference and effective gate: $expected',
    async ({ languagePreference, isHindiEnabled, expected }) => {
      mocks.buildRequestContext.mockResolvedValue({
        languagePreference,
        isHindiEnabled,
      });
      await expect(getRequestLocale()).resolves.toBe(expected);
      expect(mocks.getCookie).not.toHaveBeenCalled();
    },
  );

  it('re-resolves availability when the same account changes societies or roles', async () => {
    for (const [role, isHindiEnabled, expected] of [
      ['resident', true, 'hi'],
      ['guard', false, 'en'],
      ['admin', true, 'hi'],
    ]) {
      mocks.buildRequestContext.mockResolvedValue({
        languagePreference: 'hi',
        roles: [role],
        isHindiEnabled,
      });
      await expect(getRequestLocale()).resolves.toBe(expected);
    }
    expect(mocks.getCookie).not.toHaveBeenCalled();
  });

  it.each(['UNAUTHENTICATED', 'SESSION_EXPIRED'] as const)(
    'uses the separate device cookie only for %s',
    async (code) => {
      mocks.buildRequestContext.mockRejectedValue(new AppError(code));
      await expect(getRequestLocale()).resolves.toBe('hi');
      expect(mocks.getCookie).toHaveBeenCalledWith(LANGUAGE_PREFERENCE_COOKIE);
      mocks.getCookie.mockReturnValue({ value: 'unsupported' });
      await expect(getRequestLocale()).resolves.toBe('en');
    },
  );

  it('does not turn a permission or connection failure into a signed-out language fallback', async () => {
    const error = new AppError('FORBIDDEN');
    mocks.buildRequestContext.mockRejectedValue(error);
    await expect(getRequestLocale()).rejects.toBe(error);
    expect(mocks.getCookie).not.toHaveBeenCalled();
  });
});
