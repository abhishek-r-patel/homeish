// Verify error reporting remains safe and best-effort when a log sink fails.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeErrorLog: vi.fn(),
  captureSentryException: vi.fn(),
}));

vi.mock('../../src/core/config/server-env', () => ({
  serverEnvironment: {
    server: { APP_VERSION: 'test-version' },
  },
}));
vi.mock('../../src/core/privileged', () => ({
  writeErrorLog: mocks.writeErrorLog,
}));
vi.mock('../../src/core/logging/sentry', () => ({
  captureSentryException: mocks.captureSentryException,
}));

import { logUnexpectedError } from '../../src/core/logging/error-logger';

describe('logUnexpectedError', () => {
  beforeEach(() => {
    mocks.writeErrorLog.mockReset().mockResolvedValue(undefined);
    mocks.captureSentryException.mockReset();
  });

  it('persists scrubbed context and returns a safe reference ID', async () => {
    const referenceId = await logUnexpectedError(
      new Error('password=hunter2 for resident@example.test'),
      {
        requestId: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
        route: '/api/private?token=secret',
        source: 'server',
      },
    );

    expect(referenceId).toMatch(/^ERR-[A-F0-9]{10}$/);
    expect(mocks.writeErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_id: referenceId,
        message: 'password=[REDACTED] for [REDACTED]',
        route: '/api/private',
        app_version: 'test-version',
      }),
    );
    expect(mocks.captureSentryException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ route: '/api/private' }),
    );
  });

  it('falls back to scrubbed platform context and never throws on sink failures', async () => {
    mocks.writeErrorLog.mockRejectedValue(
      new Error('database password=hunter2'),
    );
    mocks.captureSentryException.mockImplementation(() => {
      throw new Error('Sentry token=secret');
    });
    const platformError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const referenceId = await logUnexpectedError(
      new Error('OTP: 194208 for resident@example.test'),
      {
        requestId: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
        route: '/api/private?phone=9876543210',
        source: 'server',
      },
    );

    expect(referenceId).toMatch(/^ERR-[A-F0-9]{10}$/);
    expect(platformError).toHaveBeenCalledWith(
      'Homeish error-log write failed.',
      expect.objectContaining({
        message: 'OTP: [REDACTED] for [REDACTED]',
        route: '/api/private',
        requestId: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
      }),
    );
    expect(platformError).toHaveBeenCalledWith(
      'Homeish Sentry reporting failed.',
      expect.objectContaining({
        requestId: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
      }),
    );
    expect(platformError.mock.calls.flat().join(' ')).not.toContain('hunter2');
    expect(platformError.mock.calls.flat().join(' ')).not.toContain('194208');
    expect(platformError.mock.calls.flat().join(' ')).not.toContain(
      'resident@example.test',
    );
  });
});
