// Verify daily-job freshness uses completed task runs and the 36-hour threshold.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
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
  let trialSocietyId = '';

  beforeAll(async () => {
    database = await createTestDatabase();
    const societyIds = await db().asSuperuser(async (client) => {
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
      const trialResult = await client.query<{ id: string }>(
        `insert into public.societies (name, status, created_by)
         values ($1, 'trial', $2)
         returning id`,
        ['Daily Job Trial Test Society', userId],
      );
      await client.query(
        `insert into public.societies (name, status, created_by)
         values ($1, 'suspended', $2)`,
        ['Daily Job Suspended Test Society', userId],
      );
      return {
        active: result.rows[0]?.id ?? '',
        trial: trialResult.rows[0]?.id ?? '',
      };
    });
    societyId = societyIds.active;
    trialSocietyId = societyIds.trial;
    if (!societyId || !trialSocietyId) {
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

  it('limits service-role discovery to active and trial society IDs', async () => {
    const result = await db().asRole('service_role', null, (client) =>
      client.query<{ id: string }>(
        'select id from public.daily_job_societies()',
      ),
    );
    expect(result.rows.map(({ id }) => id).sort()).toEqual(
      [societyId, trialSocietyId].sort(),
    );

    const directTableError = await dbError(
      db().asRole('service_role', null, (client) =>
        client.query('select id from public.societies'),
      ),
    );
    expect(directTableError.code).toBe('42501');

    const authenticatedError = await dbError(
      db().asRole('authenticated', null, (client) =>
        client.query('select * from public.daily_job_societies()'),
      ),
    );
    expect(authenticatedError.code).toBe('42501');
  });

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
      missingTaskCount: (SOCIETY_JOBS.length - 1) * 2 + 1,
    });

    await db().asSuperuser((client) =>
      client.query(
        `insert into public.job_run_keys
          (society_id, job_name, period_key, completed_at)
         select society_id, job_name, '2026-11-10', now()
         from unnest($1::uuid[]) as societies(society_id)
         cross join unnest($2::text[]) as jobs(job_name)`,
        [[societyId, trialSocietyId], SOCIETY_JOBS],
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
