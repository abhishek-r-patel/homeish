// Verify the health endpoint reports availability without exposing failures.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkDatabaseHealth: vi.fn(),
}));

vi.mock('@/core/privileged', () => ({
  checkDatabaseHealth: mocks.checkDatabaseHealth,
}));

import { GET } from '../../src/app/api/health/route';

describe('/api/health', () => {
  beforeEach(() => {
    mocks.checkDatabaseHealth.mockReset().mockResolvedValue(undefined);
  });

  it('returns a cache-disabled success when the database responds', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('returns only an unavailable status when the database check fails', async () => {
    mocks.checkDatabaseHealth.mockRejectedValue(
      new Error('Database connection contains private details.'),
    );
    const platformError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unavailable',
    });
    expect(platformError).toHaveBeenCalledWith('Homeish health check failed.');
    expect(platformError.mock.calls.flat().join(' ')).not.toContain(
      'private details',
    );
  });
});
