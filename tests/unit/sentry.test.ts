// Verify Sentry receives only scrubbed error data and no request identity.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  withScope: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock('../../src/core/config/server-env', () => ({
  serverEnvironment: {
    public: { NEXT_PUBLIC_APP_ENV: 'local' },
    server: {
      APP_VERSION: 'test-version',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/123',
    },
  },
}));

import * as Sentry from '@sentry/nextjs';
import { initializeSentry } from '../../src/core/logging/sentry';

describe('Sentry adapter', () => {
  beforeEach(() => {
    vi.mocked(Sentry.init).mockClear();
    initializeSentry();
  });

  it('disables automatic sensitive data collection and strips PII from events', async () => {
    const email = ['resident', '@example.test'].join('');
    const password = ['pass', 'word=', 'sample-secret'].join('');
    const token = ['private', '-token'].join('');
    const options = vi.mocked(Sentry.init).mock.calls[0]?.[0];
    expect(options?.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    });

    const event = await options?.beforeSend?.(
      {
        type: undefined,
        message: `${password} for ${email}`,
        transaction: `/api/residents?email=${email}`,
        request: { url: `/api/residents?email=${email}` },
        user: { email },
        contexts: { custom: { otp: '194208' } },
        breadcrumbs: [{ message: `Authorization: Bearer ${token}` }],
        extra: { password },
        tags: {
          route: `/api/residents?email=${email}`,
          request_id: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
          ignored: 'private value',
        },
        exception: {
          values: [
            {
              type: 'Error',
              value: `token=${token}`,
              stacktrace: {
                frames: [
                  {
                    filename: email,
                    context_line: password,
                    vars: { otp: '194208' },
                  },
                ],
              },
            },
          ],
        },
      },
      {},
    );

    expect(event?.message).toContain('for [REDACTED]');
    expect(event?.transaction).toBe('/api/residents');
    expect(event?.tags).toEqual({
      route: '/api/residents',
      request_id: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
    });
    expect(event?.exception?.values?.[0]?.value).toContain('[REDACTED]');
    expect(
      event?.exception?.values?.[0]?.stacktrace?.frames?.[0],
    ).toMatchObject({
      filename: '[REDACTED]',
      context_line: undefined,
      vars: undefined,
    });
    expect(event?.request).toBeUndefined();
    expect(event?.user).toBeUndefined();
    expect(event?.contexts).toBeUndefined();
    expect(event?.breadcrumbs).toBeUndefined();
    expect(event?.extra).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain('sample-secret');
    expect(JSON.stringify(event)).not.toContain(token);
    expect(JSON.stringify(event)).not.toContain(email);
    expect(JSON.stringify(event)).not.toContain('194208');
  });
});
