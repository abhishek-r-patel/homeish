// Verify daily-job freshness uses completed task runs and the 36-hour threshold.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

const SOCIETY_JOBS = [
  'billing.late_fees',
  'billing.reminders',
  'billing.stale_payments',
  'visitor.expire',
  'service_request.auto_close',
  'housekeeping.retention',
];

describe.skipIf(!hasDatabase)('daily job health summary', () => {
  let database: TestDatabase | undefined;
  let societyId = '';

  beforeAll(async () => {
    database = await createTestDatabase();
    societyId = await db().asSuperuser(async (client) => {
      const userId = await newAuthUser(client);
      await client.query(
        'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
        [userId, `${userId}@example.test`, 'Daily Job Test Admin'],
      );
      const result = await client.query<{ id: string }>(
        `insert into public.societies (name, status, created_by)
         values ($1, 'active', $2)
         returning id`,
        ['Daily Job Health Test Society', userId],
      );
      return result.rows[0]?.id ?? '';
    });
    if (!societyId) {
      throw new Error('The daily-job test society was not created.');
    }
  });

  afterAll(async () => {
    await database?.drop();
  });

  function db(): TestDatabase {
    if (!database) {
      throw new Error('The test database was not created.');
    }
    return database;
  }

  async function getSummary(): Promise<{
    isFresh: boolean;
    missingTaskCount: number;
  }> {
    const result = await db().asSuperuser((client) =>
      client.query<{ summary: { isFresh: boolean; missingTaskCount: number } }>(
        'select public.daily_job_health_summary() as summary',
      ),
    );
    const summary = result.rows[0]?.summary;
    if (!summary) {
      throw new Error('The daily-job health summary was not returned.');
    }
    return summary;
  }

  it('reports missing and stale runs, and becomes healthy only after completion', async () => {
    await expect(getSummary()).resolves.toMatchObject({
      isFresh: false,
      missingTaskCount: SOCIETY_JOBS.length,
    });

    await db().asSuperuser((client) =>
      client.query(
        `insert into public.job_run_keys
          (society_id, job_name, period_key, completed_at)
         select $1, job_name, '2026-11-10', now()
          from unnest($2::text[]) as jobs(job_name)`,
        [societyId, SOCIETY_JOBS],
      ),
    );
    await expect(getSummary()).resolves.toMatchObject({
      isFresh: true,
      missingTaskCount: 0,
    });

    await db().asSuperuser((client) =>
      client.query(
        `update public.job_run_keys
         set completed_at = now() - interval '37 hours'
         where society_id = $1 and job_name = 'visitor.expire'`,
        [societyId],
      ),
    );
    await expect(getSummary()).resolves.toMatchObject({
      isFresh: false,
      missingTaskCount: 1,
    });
  });
});
