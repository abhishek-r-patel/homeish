// Verify P57 public enquiry validation, trap handling and save-before-email behavior.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../src/core/errors';

const mocks = vi.hoisted(() => ({
  client: { rpc: vi.fn() },
  invokeUntypedRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/db/server-client', () => ({
  createUserSupabaseClient: vi.fn().mockResolvedValue({
    client: mocks.client,
    activeSocietyId: null,
  }),
}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: mocks.invokeUntypedRpc,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/privileged', () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));
vi.mock('../../src/core/developer/console', () => ({
  requireDeveloperContext: vi.fn(),
}));

import { submitWebsiteEnquiry } from '../../src/core/website/enquiries';

const valid = {
  fullName: 'Synthetic Sender',
  societyName: 'Synthetic Society',
  city: 'Pune',
  flatCount: '120',
  email: 'sender@example.test',
  phone: '+919876543210',
  message: 'Please contact our committee.',
  trap: '',
};

describe('P57 website enquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce([
        { contact_email: 'developer@example.test', enquiry_hourly_limit: 7 },
      ])
      .mockResolvedValueOnce('a57ab6d1-0000-4000-8000-000000000001');
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.sendTransactionalEmail.mockResolvedValue({ sent: true });
  });

  it('uses the configured per-network limit and saves before email', async () => {
    await expect(
      submitWebsiteEnquiry(valid, '198.51.100.10', 'request-1'),
    ).resolves.toBeUndefined();
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'publicWebsiteEnquiryIpHourly',
      '198.51.100.10',
      'request-1',
      7,
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenNthCalledWith(
      2,
      mocks.client,
      'website_enquiry_create',
      expect.objectContaining({
        p_request_id: 'request-1',
        p_full_name: 'Synthetic Sender',
        p_flat_count: 120,
      }),
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledTimes(2);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  it('silently drops a filled trap without consuming rate or database writes', async () => {
    await expect(
      submitWebsiteEnquiry(
        { ...valid, trap: 'bot.example.test' },
        '198.51.100.11',
        'request-trap',
      ),
    ).resolves.toBeUndefined();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('keeps validation explicit when both email and phone are missing', async () => {
    await expect(
      submitWebsiteEnquiry(
        { ...valid, email: '', phone: '' },
        '198.51.100.12',
        'request-invalid',
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
  });

  it('does not undo a saved enquiry when email delivery fails', async () => {
    mocks.sendTransactionalEmail.mockResolvedValue({
      sent: false,
      reason: 'provider',
    });
    await expect(
      submitWebsiteEnquiry(valid, '198.51.100.13', 'request-email'),
    ).resolves.toBeUndefined();
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledTimes(2);
  });
});
