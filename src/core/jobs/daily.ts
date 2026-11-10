// Run registered daily work once per society and IST calendar day.
import { logUnexpectedError } from '../logging/error-logger';
import { claimDailyJobRun, listDailyJobSocieties } from '../privileged';
import { createRequestId } from '../errors';

export interface DailyJobTask {
  name: string;
  run: (societyId: string, periodKey: string) => Promise<void>;
}

export interface DailyJobCount {
  job: string;
  succeeded: number;
  skipped: number;
  failed: number;
}

export const dailyJobTasks: readonly DailyJobTask[] = [];

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
        count.succeeded += 1;
      } catch (error) {
        count.failed += 1;
        await logUnexpectedError(error, {
          requestId,
          route: '/api/jobs/daily',
          source: 'job',
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
