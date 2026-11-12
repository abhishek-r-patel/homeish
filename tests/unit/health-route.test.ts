// Verify the health endpoint reports availability without exposing failures.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkDatabaseHealth: vi.fn(),
  checkDailyJobHealth: vi.fn(),
}));

vi.mock('@/core/privileged', () => ({
  checkDatabaseHealth: mocks.checkDatabaseHealth,
  checkDailyJobHealth: mocks.checkDailyJobHealth,
}));

import { GET } from '../../src/app/api/health/route';

describe('/api/health', () => {
  beforeEach(() => {
    mocks.checkDatabaseHealth.mockReset().mockResolvedValue(undefined);
    mocks.checkDailyJobHealth.mockReset().mockResolvedValue(undefined);
  });

  it('returns a cache-disabled success when database and daily jobs are healthy', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(mocks.checkDailyJobHealth).toHaveBeenCalledOnce();
  });

  it('returns unavailable when daily jobs are stale', async () => {
    mocks.checkDailyJobHealth.mockRejectedValue(
      new Error('Daily jobs have not completed within the last 36 hours.'),
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
