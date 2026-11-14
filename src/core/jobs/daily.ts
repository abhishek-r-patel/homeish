// Run registered daily work per society or globally for the IST calendar day.
import { logUnexpectedError } from '../logging/error-logger';
import {
  claimDailyJobRun,
  completeDailyJobRun,
  listDailyJobSocieties,
  runBillingDailyTaskPrivileged,
  runRetentionPrivileged,
  runServiceRequestAutoClosePrivileged,
  runVisitorExpirationPrivileged,
  runInventoryRemindersPrivileged,
  type BillingDailyTask,
} from '../privileged';
import { createRequestId } from '../errors';

export interface DailySocietyJobTask {
  name: string;
  scope?: 'society';
  run: (societyId: string, periodKey: string) => Promise<void>;
}

export interface DailyGlobalJobTask {
  name: string;
  scope: 'global';
  run: (periodKey: string) => Promise<void>;
}

export type DailyJobTask = DailySocietyJobTask | DailyGlobalJobTask;

export interface DailyJobCount {
  job: string;
  succeeded: number;
  skipped: number;
  failed: number;
}

function billingTask(name: BillingDailyTask): DailySocietyJobTask {
  return {
    name,
    run: async (societyId: string, periodKey: string) => {
      await runBillingDailyTaskPrivileged(name, societyId, periodKey);
    },
  };
}

// Late fees run before reminders so reminder totals include the new charge.
export const dailyJobTasks: readonly DailyJobTask[] = [
  billingTask('billing.late_fees'),
  billingTask('billing.reminders'),
  billingTask('billing.stale_payments'),
  {
    name: 'visitor.expire',
    run: async (societyId: string) => {
      await runVisitorExpirationPrivileged(societyId);
    },
  },
  {
    name: 'service_request.auto_close',
    run: async (societyId: string, periodKey: string) => {
      await runServiceRequestAutoClosePrivileged(societyId, periodKey);
    },
  },
  {
    name: 'housekeeping.low_stock',
    run: async (societyId: string) => {
      await runInventoryRemindersPrivileged(societyId);
    },
  },
  {
    name: 'housekeeping.retention',
    scope: 'global',
    run: async (periodKey) => {
      await runRetentionPrivileged(periodKey);
    },
  },
];

export function dailyPeriodKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export async function runDailyJobs(
  options: {
    tasks?: readonly DailyJobTask[];
    now?: Date;
    requestId?: string;
  } = {},
): Promise<DailyJobCount[]> {
  const tasks = options.tasks ?? dailyJobTasks;
  if (tasks.length === 0) return [];

  const societies = await listDailyJobSocieties();
  const periodKey = dailyPeriodKey(options.now ?? new Date());
  const requestId = options.requestId ?? createRequestId();
  const counts: DailyJobCount[] = [];

  for (const task of tasks) {
    const count: DailyJobCount = {
      job: task.name,
      succeeded: 0,
      skipped: 0,
      failed: 0,
    };
    if (task.scope === 'global') {
      try {
        const keySociety = societies[0];
        if (
          keySociety &&
          !(await claimDailyJobRun(keySociety.id, task.name, periodKey))
        ) {
          count.skipped = 1;
          counts.push(count);
          continue;
        }

        await task.run(periodKey);
        if (keySociety) {
          await completeDailyJobRun(keySociety.id, task.name, periodKey);
        }
        count.succeeded = 1;
      } catch (error) {
        count.failed = 1;
        await logUnexpectedError(error, {
          requestId,
          route: '/api/jobs/daily',
          source: 'job',
          severity: 'critical',
          moduleKey: task.name.split('.')[0],
        }).catch(() => {
          console.error('Homeish daily job failure could not be logged.', {
            requestId,
            job: task.name,
          });
        });
      }
      counts.push(count);
      continue;
    }

    for (const society of societies) {
      try {
        const claimed = await claimDailyJobRun(
          society.id,
          task.name,
          periodKey,
        );
        if (!claimed) {
          count.skipped += 1;
          continue;
        }

        await task.run(society.id, periodKey);
        await completeDailyJobRun(society.id, task.name, periodKey);
        count.succeeded += 1;
      } catch (error) {
        count.failed += 1;
        await logUnexpectedError(error, {
          requestId,
          route: '/api/jobs/daily',
          source: 'job',
          severity: 'critical',
          societyId: society.id,
          moduleKey: task.name.split('.')[0],
        }).catch(() => {
          console.error('Homeish daily job failure could not be logged.', {
            requestId,
            job: task.name,
          });
        });
      }
    }
    counts.push(count);
  }

  return counts;
}
