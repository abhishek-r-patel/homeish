// Verify scheduler authentication, safe failures, and daily job responses.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  secret: 'scheduled-secret' as string | undefined,
  logUnexpectedError: vi.fn(),
  runDailyJobs: vi.fn(),
}));

vi.mock('../../src/core/config/server-env', () => ({
  serverEnvironment: {
    server: {
      get CRON_SECRET() {
        return mocks.secret;
      },
    },
  },
}));
vi.mock('../../src/core/logging/error-logger', () => ({
  logUnexpectedError: mocks.logUnexpectedError,
}));
vi.mock('../../src/core/jobs/daily', () => ({
  runDailyJobs: mocks.runDailyJobs,
}));

import { GET, POST } from '../../src/app/api/jobs/daily/route';

describe('/api/jobs/daily', () => {
  beforeEach(() => {
    mocks.secret = 'scheduled-secret';
    mocks.logUnexpectedError.mockReset().mockResolvedValue('ERR-1234567890');
    mocks.runDailyJobs.mockReset().mockResolvedValue([]);
  });

  it('rejects missing and wrong bearer tokens, logs without exposing tokens', async () => {
    const requests = [
      new Request('https://homeish.test/api/jobs/daily', { method: 'POST' }),
      new Request('https://homeish.test/api/jobs/daily', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-token' },
      }),
    ];

    for (const request of requests) {
      const response = await POST(request);
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: { code: 'UNAUTHENTICATED' },
      });
    }

    expect(mocks.logUnexpectedError).toHaveBeenCalledTimes(2);
    expect(mocks.logUnexpectedError.mock.calls.flat().join(' ')).not.toContain(
      'wrong-token',
    );
    expect(mocks.runDailyJobs).not.toHaveBeenCalled();
  });

  it('rejects requests when no scheduler secret is configured', async () => {
    mocks.secret = undefined;
    const response = await POST(
      new Request('https://homeish.test/api/jobs/daily', {
        method: 'POST',
        headers: { authorization: 'Bearer scheduled-secret' },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.runDailyJobs).not.toHaveBeenCalled();
  });

  it('runs the daily task registry and returns only per-job counts', async () => {
    mocks.runDailyJobs.mockResolvedValue([
      { job: 'core.reminders', succeeded: 1, skipped: 2, failed: 0 },
    ]);
    const response = await POST(
      new Request('https://homeish.test/api/jobs/daily', {
        method: 'POST',
        headers: { authorization: 'Bearer scheduled-secret' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        jobs: [{ job: 'core.reminders', succeeded: 1, skipped: 2, failed: 0 }],
      },
    });
    expect(mocks.runDailyJobs).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });

  it('accepts authenticated GET requests from the Vercel scheduler', async () => {
    const response = await GET(
      new Request('https://homeish.test/api/jobs/daily', {
        method: 'GET',
        headers: { authorization: 'Bearer scheduled-secret' },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.runDailyJobs).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });

  it('logs a failed daily-job runner as critical', async () => {
    mocks.runDailyJobs.mockRejectedValue(new Error('society discovery failed'));
    const response = await GET(
      new Request('https://homeish.test/api/jobs/daily', {
        method: 'GET',
        headers: { authorization: 'Bearer scheduled-secret' },
      }),
    );

    expect(response.status).toBe(500);
    expect(mocks.logUnexpectedError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ severity: 'critical' }),
    );
  });
});
