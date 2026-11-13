// Verify duplicate-submission races on create RPCs return the original record instead of a conflict.
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { retryOnceOnDuplicate } from '../../src/core/db/retry-on-duplicate';
import type { RequestContext } from '../../src/core/tenancy/request-context';

vi.mock('server-only', () => ({}));

const duplicate = () =>
  new Error('Database operation failed.', {
    cause: { code: '23505', message: 'duplicate key' },
  });

describe('retryOnceOnDuplicate', () => {
  it('retries once after a unique violation and returns the retry result', async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(duplicate())
      .mockResolvedValueOnce('original-id');
    await expect(retryOnceOnDuplicate(run)).resolves.toBe('original-id');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const failure = new Error('denied', { cause: { code: '42501' } });
    const run = vi.fn<() => Promise<string>>().mockRejectedValue(failure);
    await expect(retryOnceOnDuplicate(run)).rejects.toBe(failure);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('propagates a second unique violation', async () => {
    const second = duplicate();
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(duplicate())
      .mockRejectedValueOnce(second);
    await expect(retryOnceOnDuplicate(run)).rejects.toBe(second);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('serviceRequestRpc duplicate retry', () => {
  const contextWith = (rpc: ReturnType<typeof vi.fn>) =>
    ({ db: { rpc } }) as unknown as RequestContext;

  it('returns the original request when the create call lost the race', async () => {
    const { serviceRequestRpc } =
      await import('../../src/core/service-requests/queries');
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      })
      .mockResolvedValueOnce({ data: { id: 'original-id' }, error: null });
    await expect(
      serviceRequestRpc(
        contextWith(rpc),
        'request_create',
        {},
        z.object({ id: z.string() }),
        { retryOnDuplicate: true },
      ),
    ).resolves.toEqual({ id: 'original-id' });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('keeps mapping duplicates to conflicts when retry is not requested', async () => {
    const { serviceRequestRpc } =
      await import('../../src/core/service-requests/queries');
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key', hint: 'stale_record' },
    });
    await expect(
      serviceRequestRpc(contextWith(rpc), 'request_assign', {}, z.unknown()),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
