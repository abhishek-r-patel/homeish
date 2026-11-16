// Verify the deadline RPC's committed-completion result maps to an expired conflict.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  invokeUntypedRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: mocks.invokeUntypedRpc,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/permissions/authorize', () => ({
  authorizeRequest: vi.fn(),
}));

import { ConflictError } from '../../src/core/errors';
import { extendPollDeadline } from '../../src/core/poll/operations';
import { pollDeadlineExtendResultSchema } from '../../src/core/poll/validation';

const voteId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const requestId = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const input = {
  voteId,
  closesAt: '2027-01-02T03:30:00Z',
  reason: 'More time requested',
};

describe('poll deadline extension result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildRequestContext.mockResolvedValue({
      societyId: voteId,
      userId: requestId,
      requestId,
      db: {},
    });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
  });

  it('accepts only the documented RPC outcomes', () => {
    expect(
      pollDeadlineExtendResultSchema.safeParse({
        voteId,
        closesAt: input.closesAt,
        outcome: 'extended',
      }).success,
    ).toBe(true);
    expect(
      pollDeadlineExtendResultSchema.safeParse({
        voteId,
        closesAt: input.closesAt,
        outcome: 'completed',
      }).success,
    ).toBe(true);
    expect(
      pollDeadlineExtendResultSchema.safeParse({
        voteId,
        closesAt: input.closesAt,
        outcome: 'unexpected',
      }).success,
    ).toBe(false);
  });

  it('returns an applied extension unchanged', async () => {
    const result = {
      voteId,
      closesAt: input.closesAt,
      outcome: 'extended',
    } as const;
    mocks.invokeUntypedRpc.mockResolvedValue(result);

    await expect(extendPollDeadline(input, requestId)).resolves.toEqual(result);
  });

  it('reports an expired conflict after committed completion', async () => {
    mocks.invokeUntypedRpc.mockResolvedValue({
      voteId,
      closesAt: '2026-01-02T03:30:00Z',
      outcome: 'completed',
    });

    await expect(extendPollDeadline(input, requestId)).rejects.toMatchObject({
      name: 'ConflictError',
      code: 'CONFLICT',
      reason: 'expired',
    } satisfies Partial<ConflictError>);
  });
});
