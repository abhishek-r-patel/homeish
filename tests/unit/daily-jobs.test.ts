// Verify daily job period keys, task isolation, and run-key idempotency.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logUnexpectedError: vi.fn(),
  listDailyJobSocieties: vi.fn(),
  claimDailyJobRun: vi.fn(),
  completeDailyJobRun: vi.fn(),
  runBillingDailyTaskPrivileged: vi.fn(),
  runRetentionPrivileged: vi.fn(),
  runVisitorExpirationPrivileged: vi.fn(),
  runServiceRequestAutoClosePrivileged: vi.fn(),
}));

vi.mock('../../src/core/logging/error-logger', () => ({
  logUnexpectedError: mocks.logUnexpectedError,
}));
vi.mock('../../src/core/privileged', () => ({
  listDailyJobSocieties: mocks.listDailyJobSocieties,
  claimDailyJobRun: mocks.claimDailyJobRun,
  completeDailyJobRun: mocks.completeDailyJobRun,
  runBillingDailyTaskPrivileged: mocks.runBillingDailyTaskPrivileged,
  runRetentionPrivileged: mocks.runRetentionPrivileged,
  runVisitorExpirationPrivileged: mocks.runVisitorExpirationPrivileged,
  runServiceRequestAutoClosePrivileged:
    mocks.runServiceRequestAutoClosePrivileged,
}));

import {
  dailyJobTasks,
  dailyPeriodKey,
  runDailyJobs,
} from '../../src/core/jobs/daily';

describe('daily jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logUnexpectedError.mockResolvedValue('ERR-1234567890');
    mocks.listDailyJobSocieties.mockResolvedValue([
      { id: 'society-1' },
      { id: 'society-2' },
    ]);
    mocks.claimDailyJobRun.mockResolvedValue(true);
    mocks.completeDailyJobRun.mockResolvedValue(undefined);
  });

  it('uses the society operating day in IST', () => {
    expect(dailyPeriodKey(new Date('2026-11-09T18:31:00.000Z'))).toBe(
      '2026-11-10',
    );
    expect(dailyPeriodKey(new Date('2026-11-10T18:29:00.000Z'))).toBe(
      '2026-11-10',
    );
  });

  it('supports an empty task registry without querying the database', async () => {
    await expect(runDailyJobs({ tasks: [] })).resolves.toEqual([]);
    expect(mocks.listDailyJobSocieties).not.toHaveBeenCalled();
  });

  it('does no work when a task is called again with the same day key', async () => {
    mocks.claimDailyJobRun
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    const run = vi.fn().mockResolvedValue(undefined);

    const options = {
      now: new Date('2026-11-10T00:00:00.000Z'),
      tasks: [{ name: 'core.reminders', run }],
    };
    await expect(runDailyJobs(options)).resolves.toEqual([
      { job: 'core.reminders', succeeded: 2, skipped: 0, failed: 0 },
    ]);
    await expect(runDailyJobs(options)).resolves.toEqual([
      { job: 'core.reminders', succeeded: 0, skipped: 2, failed: 0 },
    ]);

    expect(mocks.claimDailyJobRun).toHaveBeenNthCalledWith(
      1,
      'society-1',
      'core.reminders',
      '2026-11-10',
    );
    expect(run).toHaveBeenCalledTimes(2);
    expect(mocks.claimDailyJobRun).toHaveBeenCalledTimes(4);
    expect(mocks.completeDailyJobRun).toHaveBeenCalledTimes(2);
  });

  it('continues other societies and tasks after a task failure', async () => {
    mocks.claimDailyJobRun.mockResolvedValue(true);
    const failure = new Error('task failed');
    const firstTask = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(undefined);
    const secondTask = vi.fn().mockResolvedValue(undefined);

    await expect(
      runDailyJobs({
        tasks: [
          { name: 'core.first', run: firstTask },
          { name: 'core.second', run: secondTask },
        ],
      }),
    ).resolves.toEqual([
      { job: 'core.first', succeeded: 1, skipped: 0, failed: 1 },
      { job: 'core.second', succeeded: 2, skipped: 0, failed: 0 },
    ]);

    expect(firstTask).toHaveBeenCalledTimes(2);
    expect(secondTask).toHaveBeenCalledTimes(2);
    expect(mocks.logUnexpectedError).toHaveBeenCalledTimes(1);
    expect(mocks.logUnexpectedError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ severity: 'critical' }),
    );
    expect(mocks.completeDailyJobRun).toHaveBeenCalledTimes(3);
  });

  it('marks a failed global task as critical', async () => {
    const failure = new Error('retention failed');
    const run = vi.fn().mockRejectedValue(failure);

    await expect(
      runDailyJobs({
        tasks: [{ name: 'housekeeping.retention', scope: 'global', run }],
      }),
    ).resolves.toEqual([
      { job: 'housekeeping.retention', succeeded: 0, skipped: 0, failed: 1 },
    ]);

    expect(mocks.logUnexpectedError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ severity: 'critical' }),
    );
  });

  it('runs global tasks once and uses the first society for run-key idempotency', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    await expect(
      runDailyJobs({
        now: new Date('2026-11-10T00:00:00.000Z'),
        tasks: [{ name: 'housekeeping.retention', scope: 'global', run }],
      }),
    ).resolves.toEqual([
      { job: 'housekeeping.retention', succeeded: 1, skipped: 0, failed: 0 },
    ]);

    expect(mocks.claimDailyJobRun).toHaveBeenCalledOnce();
    expect(mocks.claimDailyJobRun).toHaveBeenCalledWith(
      'society-1',
      'housekeeping.retention',
      '2026-11-10',
    );
    expect(run).toHaveBeenCalledOnce();
    expect(mocks.completeDailyJobRun).toHaveBeenCalledWith(
      'society-1',
      'housekeeping.retention',
      '2026-11-10',
    );
  });

  it('runs idempotent global retention even when there are no active societies', async () => {
    mocks.listDailyJobSocieties.mockResolvedValue([]);
    const run = vi.fn().mockResolvedValue(undefined);
    await expect(
      runDailyJobs({
        tasks: [{ name: 'housekeeping.retention', scope: 'global', run }],
      }),
    ).resolves.toEqual([
      { job: 'housekeeping.retention', succeeded: 1, skipped: 0, failed: 0 },
    ]);

    expect(mocks.claimDailyJobRun).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledOnce();
    expect(mocks.completeDailyJobRun).not.toHaveBeenCalled();
  });

  it('registers billing work before service request auto-close', async () => {
    mocks.claimDailyJobRun.mockResolvedValue(true);
    mocks.runBillingDailyTaskPrivileged.mockResolvedValue(undefined);
    expect(dailyJobTasks.map(({ name }) => name)).toEqual([
      'billing.late_fees',
      'billing.reminders',
      'billing.stale_payments',
      'visitor.expire',
      'service_request.auto_close',
      'housekeeping.retention',
    ]);

    await runDailyJobs({ now: new Date('2026-11-10T00:00:00.000Z') });

    expect(mocks.runBillingDailyTaskPrivileged.mock.calls).toEqual([
      ['billing.late_fees', 'society-1', '2026-11-10'],
      ['billing.late_fees', 'society-2', '2026-11-10'],
      ['billing.reminders', 'society-1', '2026-11-10'],
      ['billing.reminders', 'society-2', '2026-11-10'],
      ['billing.stale_payments', 'society-1', '2026-11-10'],
      ['billing.stale_payments', 'society-2', '2026-11-10'],
    ]);
    expect(mocks.runServiceRequestAutoClosePrivileged.mock.calls).toEqual([
      ['society-1', '2026-11-10'],
      ['society-2', '2026-11-10'],
    ]);
    expect(mocks.runVisitorExpirationPrivileged.mock.calls).toEqual([
      ['society-1'],
      ['society-2'],
    ]);
    expect(mocks.runRetentionPrivileged).toHaveBeenCalledWith('2026-11-10');
  });
});
