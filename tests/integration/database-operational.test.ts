// Verify operational tables enforce private writes, bounded fields and retention indexes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('operational database tables', () => {
  let database: TestDatabase | undefined;
  let societyId = '';
  let userId = '';

  beforeAll(async () => {
    database = await createTestDatabase();
    const fixture = await db().asSuperuser(async (client) => {
      const id = await newAuthUser(client);
      await client.query(
        'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
        [id, `${id}@example.test`, 'Test Admin'],
      );
      const society = await client.query<{ id: string }>(
        'insert into public.societies (name, created_by) values ($1, $2) returning id',
        ['Operational Test Society', id],
      );
      return { userId: id, societyId: society.rows[0]?.id ?? '' };
    });
    userId = fixture.userId;
    societyId = fixture.societyId;
    if (!societyId) {
      throw new Error('The operational test society was not created.');
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

  it('enables RLS and installs policies on all operational tables', async () => {
    const result = await db().asSuperuser((client) =>
      client.query<{
        table_name: string;
        rls_enabled: boolean;
        policies: number;
      }>(`
        select
          relation.relname as table_name,
          relation.relrowsecurity as rls_enabled,
          count(policy.polname)::integer as policies
        from pg_class as relation
        join pg_namespace as namespace on namespace.oid = relation.relnamespace
        left join pg_policy as policy on policy.polrelid = relation.oid
        where namespace.nspname = 'public'
          and relation.relname in (
            'audit_logs', 'error_logs', 'jobs', 'job_run_keys', 'rate_limits'
          )
        group by relation.relname, relation.relrowsecurity
        order by relation.relname
      `),
    );

    expect(result.rows).toHaveLength(5);
    for (const table of result.rows) {
      expect(table.rls_enabled).toBe(true);
      expect(table.policies).toBeGreaterThan(0);
    }
  });

  it('lets the privileged writer insert audit entries but rejects later mutation', async () => {
    await db().asRole(
      'service_role',
      null,
      (client) =>
        client.query(
          `insert into public.audit_logs
            (society_id, actor_id, actor_role, action, entity_type)
           values ($1, $2, 'admin', 'society.update', 'society')
          `,
          [societyId, userId],
        ),
      { commit: true },
    );
    const id = await db().asSuperuser(async (client) => {
      const result = await client.query<{ id: string }>(
        `select id from public.audit_logs
         where society_id = $1 and action = 'society.update'`,
        [societyId],
      );
      return result.rows[0]?.id;
    });
    expect(id).toBeDefined();

    const updateError = await dbError(
      db().asSuperuser((client) =>
        client.query('update public.audit_logs set action = $1 where id = $2', [
          'society.delete',
          id,
        ]),
      ),
    );
    expect(updateError.code).toBe('55000');

    const deleteError = await dbError(
      db().asSuperuser((client) =>
        client.query('delete from public.audit_logs where id = $1', [id]),
      ),
    );
    expect(deleteError.code).toBe('55000');
  });

  it('allows the privileged writer to insert errors but limits developer updates to resolution fields', async () => {
    const id = '00000000-0000-0000-0000-000000000123';
    await db().asRole(
      'service_role',
      null,
      (client) =>
        client.query(
          `insert into public.error_logs
            (id, reference_id, society_id, user_id, source, severity, message)
           values ($1, 'REF-TEST-01', $2, $3, 'server', 'error', 'Safe test message')`,
          [id, societyId, userId],
        ),
      { commit: true },
    );

    const changed = await db().asRole(
      'authenticated',
      { sub: userId },
      (client) =>
        client.query(
          "update public.error_logs set status = 'resolved' where id = $1",
          [id],
        ),
    );
    expect(changed.rowCount).toBe(0);

    const immutableError = await dbError(
      db().asSuperuser((client) =>
        client.query(
          "update public.error_logs set message = 'Changed' where id = $1",
          [id],
        ),
      ),
    );
    expect(immutableError.code).toBe('55000');
  });

  it('keeps rate limits and job run keys inaccessible to API roles', async () => {
    await db().asRole(
      'service_role',
      null,
      async (client) => {
        await client.query(
          'insert into public.job_run_keys (society_id, job_name, period_key) values ($1, $2, $3)',
          [societyId, 'daily_purge', '2026-11-09'],
        );
        await client.query(
          'insert into public.rate_limits (key, window_start, count) values ($1, now(), 1)',
          ['login:email:hash'],
        );
        await client.query(
          `insert into public.jobs (society_id, created_by, type)
           values ($1, $2, 'csv_import_units')`,
          [societyId, userId],
        );
      },
      { commit: true },
    );

    for (const table of [
      'job_run_keys',
      'rate_limits',
      'auth_code_challenges',
    ]) {
      const error = await dbError(
        db().asRole('authenticated', { sub: userId }, (client) =>
          client.query(`select * from public.${table}`),
        ),
      );
      expect(error.code).toBe('42501');
    }

    const jobVisibility = await db().asRole(
      'authenticated',
      { sub: userId },
      (client) => client.query('select id from public.jobs'),
    );
    expect(jobVisibility.rowCount).toBe(0);
  });
});
