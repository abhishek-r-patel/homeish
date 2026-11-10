// Verify registration lookups stay private and rate-limit failures are closed.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  lookupRegistrationSociety: vi.fn(),
  sendNotificationPushesForRequest: vi.fn(),
  buildRequestContext: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/privileged', () => ({
  lookupRegistrationSociety: mocks.lookupRegistrationSociety,
}));
vi.mock('../../src/core/privileged/notification-delivery', () => ({
  sendNotificationPushesForRequest: mocks.sendNotificationPushesForRequest,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));

import { AppError } from '../../src/core/errors';
import {
  lookupSociety,
  submitRegistration,
} from '../../src/core/registration/operations';

const requestId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const societyLookup = {
  societyName: 'Oak Grove',
  units: [
    {
      id: '98eb3bcf-8678-4a46-8652-48b3862a36f8',
      number: '101',
      blockName: 'A',
    },
  ],
};

describe('society-code registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.sendNotificationPushesForRequest.mockResolvedValue({
      failed: 0,
      pruned: 0,
      sent: 0,
    });
    mocks.lookupRegistrationSociety.mockResolvedValue(societyLookup);
    mocks.rpc.mockResolvedValue({
      data: 'c0d55fc3-0751-4b79-86c1-5b3e25942392',
      error: null,
    });
    mocks.buildRequestContext.mockResolvedValue({
      userId: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
      db: { rpc: mocks.rpc },
    });
  });

  it('returns only the society and unit picker data for an exact code', async () => {
    await expect(
      lookupSociety('abcdefgh', '198.51.100.4', requestId),
    ).resolves.toEqual(societyLookup);
    expect(mocks.enforceRateLimit.mock.calls).toEqual([
      ['registrationLookupIpHourly', '198.51.100.4', requestId],
      ['registrationLookupIpDaily', '198.51.100.4', requestId],
    ]);
    expect(mocks.lookupRegistrationSociety).toHaveBeenCalledWith('ABCDEFGH');
  });

  it('returns no society data for invalid or unknown codes', async () => {
    mocks.lookupRegistrationSociety.mockResolvedValue(null);

    await expect(
      lookupSociety('ABCDEFG0', '198.51.100.4', requestId),
    ).resolves.toBeNull();
    expect(mocks.lookupRegistrationSociety).not.toHaveBeenCalled();
    await expect(
      lookupSociety('ABCDEFG2', '198.51.100.4', requestId),
    ).resolves.toBeNull();
  });

  it('fails closed before any society lookup when a lookup limit is unavailable', async () => {
    mocks.enforceRateLimit.mockRejectedValue(
      new AppError('RATE_LIMITED', { retryAfterSeconds: 3600 }),
    );

    await expect(
      lookupSociety('ABCDEFG2', '198.51.100.4', requestId),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(mocks.lookupRegistrationSociety).not.toHaveBeenCalled();
  });

  it('submits a pending registration through the authenticated SQL operation', async () => {
    await expect(
      submitRegistration(
        {
          joinCode: 'ABCDEFG2',
          unitId: '98eb3bcf-8678-4a46-8652-48b3862a36f8',
          fullName: 'Resident Name',
          relationship: 'tenant',
        },
        requestId,
      ),
    ).resolves.toBe('c0d55fc3-0751-4b79-86c1-5b3e25942392');
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'registrationSubmitEmailDaily',
      '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
      requestId,
    );
    expect(mocks.rpc).toHaveBeenCalledWith('submit_society_registration', {
      p_join_code: 'ABCDEFG2',
      p_unit_id: '98eb3bcf-8678-4a46-8652-48b3862a36f8',
      p_full_name: 'Resident Name',
      p_relationship: 'tenant',
      p_request_id: requestId,
    });
    expect(mocks.sendNotificationPushesForRequest).toHaveBeenCalledWith(
      requestId,
    );
    expect(
      mocks.sendNotificationPushesForRequest.mock.invocationCallOrder[0],
    ).toBeGreaterThan(mocks.rpc.mock.invocationCallOrder[0] ?? 0);
  });

  it('does not dispatch a push when registration creation fails', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate membership' },
    });

    await expect(
      submitRegistration(
        {
          joinCode: 'ABCDEFG2',
          unitId: '98eb3bcf-8678-4a46-8652-48b3862a36f8',
          fullName: 'Resident Name',
          relationship: 'tenant',
        },
        requestId,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mocks.sendNotificationPushesForRequest).not.toHaveBeenCalled();
  });
});
