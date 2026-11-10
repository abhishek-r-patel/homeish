// Verify the client-error route enforces origin, size, schema and safe responses.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/core/errors';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  logUnexpectedError: vi.fn(),
}));

vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/logging/error-logger', () => ({
  logUnexpectedError: mocks.logUnexpectedError,
}));

import { POST } from '../../src/app/api/client-errors/route';

const requestId = '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0';
const referenceId = 'ERR-A1B2C3D4E5';

function makeRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request('https://homeish.test/api/client-errors', {
    method: 'POST',
    headers: {
      origin: 'https://homeish.test',
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-vercel-forwarded-for': '198.51.100.4',
      ...headers,
    },
    body,
  });
}

describe('/api/client-errors', () => {
  beforeEach(() => {
    mocks.enforceRateLimit.mockReset().mockResolvedValue(undefined);
    mocks.logUnexpectedError.mockReset().mockResolvedValue(referenceId);
  });

  it('rate limits, stores the report and returns its reference ID', async () => {
    const response = await POST(
      makeRequest(
        JSON.stringify({
          message: 'A client failure',
          stack: 'Error: A client failure',
          route: '/dashboard?token=private',
          device: { userAgent: 'Homeish Test Browser', platform: 'Test OS' },
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe(requestId);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'clientErrorsMinute',
      '198.51.100.4',
      requestId,
    );
    expect(mocks.logUnexpectedError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A client failure',
        stack: 'Error: A client failure',
      }),
      expect.objectContaining({
        requestId,
        route: '/dashboard',
        source: 'client',
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { referenceId },
    });
  });

  it('rejects missing or foreign origins without logging a client error', async () => {
    const requests = [
      new Request('https://homeish.test/api/client-errors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      makeRequest('{}', { origin: 'https://untrusted.test' }),
    ];
    for (const request of requests) {
      const response = await POST(request);
      expect(response.status).toBe(403);
      expect(mocks.logUnexpectedError).not.toHaveBeenCalled();
    }
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it('rejects non-JSON, oversized and unknown-field reports', async () => {
    const nonJson = await POST(
      makeRequest('not json', { 'content-type': 'text/plain' }),
    );
    expect(nonJson.status).toBe(400);

    const oversized = await POST(
      makeRequest(JSON.stringify({ message: 'x'.repeat(9_000), route: '/' })),
    );
    expect(oversized.status).toBe(400);

    const unknownField = await POST(
      makeRequest(
        JSON.stringify({ message: 'oops', route: '/', token: 'secret' }),
      ),
    );
    expect(unknownField.status).toBe(400);
    expect(mocks.logUnexpectedError).not.toHaveBeenCalled();
  });

  it('returns a retry header when rate limited', async () => {
    mocks.enforceRateLimit.mockRejectedValue(
      new AppError('RATE_LIMITED', { retryAfterSeconds: 30 }),
    );

    const response = await POST(
      makeRequest(JSON.stringify({ message: 'oops', route: '/' })),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(mocks.logUnexpectedError).not.toHaveBeenCalled();
  });
});
