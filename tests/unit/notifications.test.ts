// Verify minimized push payloads, retry/prune behavior and Brevo safeguards.
import { describe, expect, it, vi } from 'vitest';
import {
  createTransactionalEmailSender,
  type TransactionalEmail,
} from '../../src/core/notifications/email';
import {
  createMinimalPushPayload,
  deliverPushToSubscriptions,
  isAllowedPushEndpoint,
} from '../../src/core/notifications/push';

const emailMessage: TransactionalEmail = {
  to: { email: 'resident@example.test', name: 'Resident' },
  subject: 'A new Homeish update',
  textContent: 'There is a new update in your inbox.',
};

const subscription = {
  id: 'subscription-id',
  endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-token',
  p256dh: 'public-device-key',
  auth_secret: 'private-device-auth-key',
};

describe('notification delivery adapters', () => {
  it('strips contact details and uses only allow-listed internal push links', () => {
    const payload = createMinimalPushPayload({
      title: 'Visitor for Resident at 9876543210',
      body: 'Contact resident@example.test about the arrival.',
      entity_type: 'visitor_entry',
      entity_id: 'cf25cc8a-00d9-4bf8-ac0f-f67eb3ef34cf',
    });

    expect(payload).toEqual({
      title: 'Visitor for Resident at',
      body: 'Contact about the arrival',
      url: '/visitors/cf25cc8a-00d9-4bf8-ac0f-f67eb3ef34cf',
    });
    expect(JSON.stringify(payload)).not.toContain('9876543210');
    expect(JSON.stringify(payload)).not.toContain('resident@example.test');
    expect(
      createMinimalPushPayload({
        title: 'Update',
        body: 'A new bill is due for ₹1,234.',
        entity_type: 'unknown',
        entity_id: 'cf25cc8a-00d9-4bf8-ac0f-f67eb3ef34cf',
      }),
    ).toEqual({
      title: 'Update',
      body: 'A new bill is due for',
      url: '/notifications',
    });
  });

  it('removes credentials, UPI identifiers, network addresses and money from push text', () => {
    const payload = createMinimalPushPayload({
      title: 'Update',
      body: 'OTP: 123456; UPI: resident@okaxis; amount ₹1,234; IP 192.168.1.25',
      entity_type: null,
      entity_id: null,
    });

    expect(payload.body).toBe('amount; IP');
    expect(JSON.stringify(payload)).not.toMatch(
      /123456|resident@okaxis|1,234|192\.168\.1\.25/,
    );
  });

  it('accepts known HTTPS push providers and rejects untrusted endpoints', () => {
    expect(
      isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/a-token'),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint('https://push.example.test/device-token'),
    ).toBe(false);
    expect(
      isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/a-token'),
    ).toBe(false);
    expect(
      isAllowedPushEndpoint('https://fcm.googleapis.com:8443/fcm/send/a-token'),
    ).toBe(false);
  });

  it('links UPI-detail change notifications to the admin payment settings without account data', () => {
    const payload = createMinimalPushPayload({
      title: 'Society payment details changed',
      body: 'Review Payment Settings before making or confirming a payment.',
      entity_type: 'billing_payment_details',
      entity_id: 'cf25cc8a-00d9-4bf8-ac0f-f67eb3ef34cf',
    });
    expect(payload.url).toBe('/admin/billing?tab=payment-settings');
    expect(payload.url).not.toContain('cf25cc8a');
  });

  it('retries transient push failures once and prunes gone subscriptions', async () => {
    const calls = new Map<string, number>();
    const pruned: string[] = [];
    const sentPayloads: string[] = [];
    const result = await deliverPushToSubscriptions(
      [
        subscription,
        {
          ...subscription,
          id: 'expired',
          endpoint: 'https://fcm.googleapis.com/expired',
        },
        {
          ...subscription,
          id: 'untrusted',
          endpoint: 'https://attacker.example.test/receive',
        },
        {
          ...subscription,
          id: 'bad',
          endpoint: 'https://fcm.googleapis.com/bad',
        },
      ],
      {
        title: 'Homeish',
        body: 'New update',
        url: '/notifications',
      },
      {
        async send(target, payload) {
          sentPayloads.push(JSON.stringify(payload));
          const count = (calls.get(target.id) ?? 0) + 1;
          calls.set(target.id, count);
          if (target.id === 'expired') {
            throw Object.assign(new Error('gone'), { statusCode: 410 });
          }
          if (target.id === 'bad') {
            throw Object.assign(new Error('invalid'), { statusCode: 400 });
          }
          if (count === 1) {
            throw Object.assign(new Error('temporary'), { statusCode: 503 });
          }
        },
        async prune(id) {
          pruned.push(id);
        },
        async markSuccessful() {},
        async sleep() {},
      },
    );

    expect(result).toEqual({ sent: 1, failed: 1, pruned: 2 });
    expect(calls.get(subscription.id)).toBe(2);
    expect(calls.get('expired')).toBe(1);
    expect(calls.has('untrusted')).toBe(false);
    expect(calls.get('bad')).toBe(1);
    expect(pruned).toEqual(['expired', 'untrusted']);
    expect(sentPayloads.join('')).not.toContain('private-device-auth-key');
    expect(sentPayloads.join('')).not.toContain('public-device-key');
  });

  it('retries email timeouts once and does not expose recipient or provider data in logs', async () => {
    const calls: RequestInit[] = [];
    const logger = vi.fn();
    const send = createTransactionalEmailSender({
      apiKey: 'secret-api-key',
      dailyQuota: 100,
      fromAddress: 'no-reply@example.test',
      reserveQuota: async () => ({
        sent_count: 1,
        allowed: true,
        should_alert: false,
      }),
      logger,
      fetcher: async (_input, init) => {
        calls.push(init ?? {});
        if (calls.length === 1) throw new DOMException('timeout', 'AbortError');
        return new Response(null, { status: 201 });
      },
    });

    await expect(send(emailMessage)).resolves.toEqual({ sent: true });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(logger).not.toHaveBeenCalled();
  });

  it('aborts each Brevo request at the configured timeout', async () => {
    const signals: AbortSignal[] = [];
    const fetcher: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!(signal instanceof AbortSignal)) {
          reject(new Error('Missing timeout signal.'));
          return;
        }
        signals.push(signal);
        signal.addEventListener('abort', () => {
          reject(new DOMException('timeout', 'AbortError'));
        });
      });
    const send = createTransactionalEmailSender({
      apiKey: 'secret-api-key',
      dailyQuota: 100,
      fromAddress: 'no-reply@example.test',
      reserveQuota: async () => ({
        sent_count: 1,
        allowed: true,
        should_alert: false,
      }),
      fetcher,
      timeoutMs: 1,
      logger: vi.fn(),
    });

    await expect(send(emailMessage)).resolves.toEqual({
      sent: false,
      reason: 'provider',
    });
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('does not retry permanent Brevo errors or log response details', async () => {
    const fetcher = vi.fn(
      async () => new Response('private response body', { status: 400 }),
    );
    const logger = vi.fn();
    const send = createTransactionalEmailSender({
      apiKey: 'secret-api-key',
      dailyQuota: 100,
      fromAddress: 'no-reply@example.test',
      reserveQuota: async () => ({
        sent_count: 1,
        allowed: true,
        should_alert: false,
      }),
      logger,
      fetcher,
    });

    await expect(send(emailMessage)).resolves.toEqual({
      sent: false,
      reason: 'provider',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      'private response body',
    );
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      'resident@example.test',
    );
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret-api-key');
  });

  it('alerts once at the configured threshold and holds sends over quota', async () => {
    const requests: RequestInit[] = [];
    const reserveQuota = vi
      .fn()
      .mockResolvedValueOnce({
        sent_count: 8,
        allowed: false,
        should_alert: true,
      })
      .mockResolvedValueOnce({
        sent_count: 9,
        allowed: true,
        should_alert: false,
      });
    const send = createTransactionalEmailSender({
      apiKey: 'secret-api-key',
      alertEmail: 'developer@example.test',
      dailyQuota: 10,
      fromAddress: 'no-reply@example.test',
      reserveQuota,
      fetcher: async (_input, init) => {
        requests.push(init ?? {});
        return new Response(null, { status: 201 });
      },
    });

    await expect(send(emailMessage)).resolves.toEqual({
      sent: false,
      reason: 'quota',
    });
    expect(requests).toHaveLength(1);
    expect(reserveQuota).toHaveBeenCalledTimes(2);
    expect(requests[0]?.body).toContain('reaching at least 80%');
    expect(requests[0]?.body).not.toContain('resident@example.test');
  });

  it('does not query quota or contact Brevo when the email is not configured', async () => {
    const reserveQuota = vi.fn();
    const fetcher = vi.fn();
    const send = createTransactionalEmailSender({
      reserveQuota,
      fetcher,
    });

    await expect(send(emailMessage)).resolves.toEqual({
      sent: false,
      reason: 'not_configured',
    });
    expect(reserveQuota).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
