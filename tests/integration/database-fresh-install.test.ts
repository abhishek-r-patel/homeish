// Verify the fresh install: it refuses non-empty databases, wipes testdb-like state and recovers from a failed migration.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installFresh, readMigrations } from '../../scripts/fresh-install.mjs';
import {
  createTestDatabase,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const LOCAL_RUNNER = join(
  process.cwd(),
  'scripts',
  'test-integration-local.ps1',
);

// Names, grants, policies and buckets the migrations create; reinstalling must reproduce them exactly.
async function catalog(database: TestDatabase) {
  return database.asDeployment(async (client) =>
    (
      await client.query<{ item: string }>(
        `select item from (
             select format('rel %s.%s %s %s', n.nspname, c.relname, c.relkind,
               coalesce(c.relacl::text, '')) as item
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname in ('public', 'private')
             union all
             select format('fn %s %s', p.oid::regprocedure, coalesce(p.proacl::text, ''))
             from pg_proc p
             where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
             union all
             select format('policy %s.%s.%s %s %s', schemaname, tablename, policyname,
               coalesce(qual, ''), coalesce(with_check, ''))
             from pg_policies where schemaname in ('public', 'storage')
             union all
             select format('trigger %s.%s', tgrelid::regclass, tgname)
             from pg_trigger where not tgisinternal
             union all
             select format('bucket %s %s %s', id, file_size_limit, allowed_mime_types)
             from storage.buckets
           ) as everything order by item`,
      )
    ).rows.map(({ item }) => item),
  );
}

async function counts(database: TestDatabase) {
  return database.asDeployment(
    async (client) =>
      (
        await client.query<{
          users: string;
          societies: string | null;
          history: string | null;
        }>(
          `select (select count(*) from auth.users)::text as users,
             case when to_regclass('public.societies') is null then null
               else (select count(*) from public.societies)::text end as societies,
             case when to_regclass('supabase_migrations.schema_migrations') is null
               then null
               else (select count(*) from supabase_migrations.schema_migrations)::text
             end as history`,
        )
      ).rows[0]!,
  );
}

// Mirror testdb: existing data, a login, migration history and the CLI's history table.
async function seedExistingState(database: TestDatabase) {
  await database.asDeployment(async (client) => {
    const owner = await newAuthUser(client);
    await client.query(
      `insert into public.profiles (id, email, full_name) values ($1, $2, 'Synthetic admin')`,
      [owner, `${owner}@example.test`],
    );
    await client.query(
      `insert into public.societies (name, created_by) values ('Synthetic society', $1)`,
      [owner],
    );
    await client.query('create schema supabase_migrations');
    await client.query(
      `create table supabase_migrations.schema_migrations (
         version text primary key, statements text[], name text
       )`,
    );
    await client.query(
      `insert into supabase_migrations.schema_migrations (version, name, statements)
       values ('20261109224000', 'core_database_foundation', '{}')`,
    );
  });
}

describe.skipIf(!hasDatabase)('database fresh install', () => {
  it.runIf(
    process.platform === 'win32' &&
      new URL(process.env.INTEGRATION_DATABASE_URL ?? 'postgres://localhost')
        .port === '54329',
  )('refuses to use another server when its test port is occupied', () => {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        LOCAL_RUNNER,
        '--help',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 90_000,
        env: process.env,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr.replace(/\s+/g, ' ')).toContain(
      'The temporary PostgreSQL server did not start.',
    );
    expect(result.stdout).not.toContain('Usage: vitest');
  });

  it('wipes existing state and reproduces the migrated schema', async () => {
    const migrations = readMigrations(MIGRATIONS);
    const database = await createTestDatabase();
    let reference: TestDatabase | undefined;
    try {
      reference = await createTestDatabase();
      await seedExistingState(database);
      const before = await counts(database);

      await expect(
        database.asDeployment((client) =>
          installFresh(client, migrations, { wipe: false }),
        ),
      ).rejects.toThrow(/not empty.*nothing was changed/i);
      expect(await counts(database)).toEqual(before);

      await database.asDeployment(async (client) => {
        await client.query(
          `insert into storage.objects (bucket_id, name) values ('society-assets', 'synthetic/logo.png')`,
        );
      });
      await expect(
        database.asDeployment((client) =>
          installFresh(client, migrations, { wipe: true }),
        ),
      ).rejects.toThrow(/wiping testdb.*nothing was changed/i);
      expect(await counts(database)).toEqual(before);
      await database.asDeployment((client) =>
        client.query('delete from storage.objects'),
      );

      const failing = [
        ...migrations,
        {
          file: '29991231000000_core_injected_failure.sql',
          version: '29991231000000',
          name: 'core_injected_failure',
          sql: 'select 1 / 0;',
        },
      ];
      // Each migration commits on its own, so a late failure keeps earlier ones and a wiped rerun recovers.
      await expect(
        database.asDeployment((client) =>
          installFresh(client, failing, { wipe: true }),
        ),
      ).rejects.toThrow(
        new RegExp(
          `core_injected_failure.*rolled back.*${migrations.length} of ${failing.length}.*--wipe-testdb`,
        ),
      );
      expect(await counts(database)).toEqual({
        users: '0',
        societies: '0',
        history: String(migrations.length),
      });

      await database.asDeployment((client) =>
        installFresh(client, migrations, { wipe: true }),
      );
      expect(await counts(database)).toEqual({
        users: '0',
        societies: '0',
        history: String(migrations.length),
      });
      expect(await catalog(database)).toEqual(await catalog(reference));
      const history = await database.asDeployment(
        async (client) =>
          (
            await client.query<{ version: string; name: string }>(
              `select version, name from supabase_migrations.schema_migrations
               order by version`,
            )
          ).rows,
      );
      expect(history).toEqual(
        migrations.map(({ version, name }) => ({ version, name })),
      );

      await expect(
        database.asDeployment((client) =>
          installFresh(client, migrations, { wipe: false }),
        ),
      ).rejects.toThrow(/not empty/);
    } finally {
      try {
        if (reference) await reference.drop();
      } finally {
        await database.drop();
      }
    }
  });
});
