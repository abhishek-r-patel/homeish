// Verify fixed-window policy selection, hashed identities and failure modes.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeRateLimitKey: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/config/server-env', () => ({
  serverEnvironment: {
    server: { RATE_LIMIT_HASH_SALT: 's'.repeat(32) },
  },
}));
vi.mock('../../src/core/privileged', () => ({
  consumeRateLimitKey: mocks.consumeRateLimitKey,
}));

import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
} from '../../src/core/rate-limit';

const requestId = '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0';

describe('rate-limit service', () => {
  beforeEach(() => {
    mocks.consumeRateLimitKey.mockReset().mockResolvedValue({
      allowed: true,
      count: 1,
      retry_after_seconds: 30,
    });
  });

  it('uses the documented policy constants and hashes identifiers before storage', async () => {
    expect(RATE_LIMIT_POLICIES.authRequestCodeEmailCooldown).toMatchObject({
      limit: 1,
      windowSeconds: 30,
      failureMode: 'closed',
    });
    expect(RATE_LIMIT_POLICIES.registrationLookupIpDaily).toMatchObject({
      limit: 30,
      windowSeconds: 86400,
      failureMode: 'closed',
    });
    expect(RATE_LIMIT_POLICIES.otherWritesUserMinute).toMatchObject({
      limit: 120,
      windowSeconds: 60,
      failureMode: 'open',
    });

    await enforceRateLimit(
      'authRequestCodeEmailCooldown',
      'resident@example.test',
      requestId,
    );

    const [key, limit, windowSeconds] =
      mocks.consumeRateLimitKey.mock.calls[0] ?? [];
    expect(key).toMatch(/^login:email-purpose:cooldown:[a-f0-9]{64}$/);
    expect(key).not.toContain('resident@example.test');
    expect(limit).toBe(1);
    expect(windowSeconds).toBe(30);
  });

  it('returns a retryable rate-limit error after the counter exceeds its limit', async () => {
    mocks.consumeRateLimitKey.mockResolvedValue({
      allowed: false,
      count: 6,
      retry_after_seconds: 23,
    });

    await expect(
      enforceRateLimit(
        'authRequestCodeEmailHourly',
        'user@example.test',
        requestId,
      ),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 23,
    });
  });

  it('fails closed for security-sensitive limits and logs no identity', async () => {
    mocks.consumeRateLimitKey.mockRejectedValue(
      new Error('Database connection failed.'),
    );
    const platformError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      enforceRateLimit('authVerifyCodeIpHourly', '192.0.2.42', requestId),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 3600,
    });
    expect(platformError).toHaveBeenCalledWith(
      'Homeish rate-limit store unavailable.',
      expect.objectContaining({
        policy: 'authVerifyCodeIpHourly',
        failureMode: 'closed',
      }),
    );
    expect(platformError.mock.calls.flat().join(' ')).not.toContain(
      '192.0.2.42',
    );
  });

  it('fails open for ordinary limits and logs the degraded path', async () => {
    mocks.consumeRateLimitKey.mockRejectedValue(
      new Error('Database connection failed.'),
    );
    const platformError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      enforceRateLimit('otherWritesUserMinute', 'user-secret-id', requestId),
    ).resolves.toBeUndefined();
    expect(platformError).toHaveBeenCalledWith(
      'Homeish rate-limit store unavailable.',
      expect.objectContaining({
        policy: 'otherWritesUserMinute',
        failureMode: 'open',
      }),
    );
    expect(platformError.mock.calls.flat().join(' ')).not.toContain(
      'user-secret-id',
    );
  });

  it('rejects empty identities instead of sharing an unbounded bucket', async () => {
    await expect(
      enforceRateLimit('otherWritesUserMinute', ' ', requestId),
    ).rejects.toThrow('Rate-limit identity must be a non-empty short string.');
    expect(mocks.consumeRateLimitKey).not.toHaveBeenCalled();
  });
});
