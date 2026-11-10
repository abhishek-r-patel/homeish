// Verify privileged daily-job discovery and atomic run-key claims.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  in: vi.fn(),
  upsert: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('../../src/core/privileged/server-client', () => ({
  privilegedClient: { from: mocks.from },
}));

import {
  claimDailyJobRun,
  listDailyJobSocieties,
} from '../../src/core/privileged/daily-jobs';

describe('privileged daily-job operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation((table: string) =>
      table === 'societies'
        ? { select: mocks.select, in: mocks.in }
        : { upsert: mocks.upsert },
    );
    mocks.select.mockReturnValue({ in: mocks.in });
    mocks.in.mockResolvedValue({
      data: [{ id: 'society-1' }],
      error: null,
    });
    mocks.upsert.mockReturnValue({
      select: () => ({ maybeSingle: mocks.maybeSingle }),
    });
    mocks.maybeSingle.mockResolvedValue({
      data: { society_id: 'society-1' },
      error: null,
    });
  });

  it('lists only trial and active societies', async () => {
    await expect(listDailyJobSocieties()).resolves.toEqual([
      { id: 'society-1' },
    ]);
    expect(mocks.from).toHaveBeenCalledWith('societies');
    expect(mocks.select).toHaveBeenCalledWith('id');
    expect(mocks.in).toHaveBeenCalledWith('status', ['trial', 'active']);
  });

  it('atomically inserts a composite run key and treats duplicates as unclaimed', async () => {
    await expect(
      claimDailyJobRun('society-1', 'core.reminders', '2026-11-10'),
    ).resolves.toBe(true);
    expect(mocks.from).toHaveBeenCalledWith('job_run_keys');
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        society_id: 'society-1',
        job_name: 'core.reminders',
        period_key: '2026-11-10',
      },
      {
        onConflict: 'society_id,job_name,period_key',
        ignoreDuplicates: true,
      },
    );

    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      claimDailyJobRun('society-1', 'core.reminders', '2026-11-10'),
    ).resolves.toBe(false);
  });
});
