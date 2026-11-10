// Verify subscription routes validate origins and delegate ownership to RLS RPCs.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  enforceRateLimit: vi.fn(),
  logUnexpectedError: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/logging/error-logger', () => ({
  logUnexpectedError: mocks.logUnexpectedError,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

import { DELETE, POST } from '../../src/app/api/push/subscriptions/route';

function request(
  method: 'DELETE' | 'POST',
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request('https://homeish.test/api/push/subscriptions', {
    method,
    headers: {
      'content-type': 'application/json',
      origin: 'https://homeish.test',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('/api/push/subscriptions', () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ data: null, error: null });
    mocks.enforceRateLimit.mockReset().mockResolvedValue(undefined);
    mocks.logUnexpectedError.mockReset().mockResolvedValue('reference-id');
    mocks.buildRequestContext.mockReset().mockResolvedValue({
      db: { rpc: mocks.rpc },
      userId: '4a696d6f-774c-41d1-ae47-6254d4a8f4cf',
    });
  });

  it('stores the browser keys using the authenticated registration RPC', async () => {
    const response = await POST(
      request('POST', {
        endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-token',
        keys: {
          auth: 'abcdefghijklmnopqrstuv',
          p256dh: 'a'.repeat(87),
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('register_push_subscription', {
      p_endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-token',
      p_p256dh: 'a'.repeat(87),
      p_auth_secret: 'abcdefghijklmnopqrstuv',
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'pushSubscriptionsUserHourly',
      '4a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      expect.any(String),
    );
  });

  it('deletes only the signed-in user endpoint using the authenticated RPC', async () => {
    const response = await DELETE(
      request('DELETE', {
        endpoint: 'https://push.services.mozilla.com/device-token',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('delete_push_subscription', {
      p_endpoint: 'https://push.services.mozilla.com/device-token',
    });
  });

  it('rejects untrusted endpoints and cross-origin requests before persistence', async () => {
    const invalidEndpointResponse = await POST(
      request('POST', {
        endpoint: 'https://attacker.example.test/receive',
        keys: { auth: 'abcdefghijklmnopqrstuv', p256dh: 'a'.repeat(87) },
      }),
    );
    const crossOriginResponse = await POST(
      request(
        'POST',
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-token',
          keys: { auth: 'abcdefghijklmnopqrstuv', p256dh: 'a'.repeat(87) },
        },
        { origin: 'https://attacker.example.test' },
      ),
    );

    expect(invalidEndpointResponse.status).toBe(400);
    expect(crossOriginResponse.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.buildRequestContext).not.toHaveBeenCalled();
  });
});
