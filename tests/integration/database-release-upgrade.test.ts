// Verify the one-time pre-launch upgrade, its migration history and rollback.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyPrelaunchUpgrade,
  PRELAUNCH_BASELINE as BASELINE,
  PRELAUNCH_LAST_MIGRATION as LAST_MIGRATION,
  PRELAUNCH_METADATA_ENV,
  readPrelaunchBatch,
} from '../../scripts/prelaunch-upgrade.mjs';
import {
  createTestDatabase,
  hasDatabase,
  migrationFiles,
  newAuthUser,
  type TestDatabase,
} from './support/database';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const CLI = join(
  process.cwd(),
  'node_modules',
  'supabase',
  'dist',
  'supabase.js',
);
const LOCAL_RUNNER = join(
  process.cwd(),
  'scripts',
  'test-integration-local.ps1',
);

type MigrationRecord = {
  version: string;
  name: string;
  statements: string[];
};

const version = (file: string) => file.slice(0, 14);
const throughRelease = () =>
  migrationFiles().filter((file) => version(file) <= LAST_MIGRATION);
const pendingFiles = () =>
  throughRelease().filter((file) => version(file) > BASELINE);

async function initialiseHistory(database: TestDatabase) {
  await database.asDeployment(async (client) => {
    await client.query('create schema supabase_migrations');
    await client.query(
      `create table supabase_migrations.schema_migrations (
         version text primary key, name text, statements text[]
       )`,
    );
    for (const file of throughRelease().filter(
      (item) => version(item) <= BASELINE,
    )) {
      await client.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ($1, $2, $3)`,
        [version(file), file.slice(15, -4), []],
      );
    }
  });
}

function runLocalCli(
  workspace: string,
  database: TestDatabase,
  args: string[],
) {
  const configured = process.env.INTEGRATION_DATABASE_URL;
  if (!configured) {
    throw new Error('INTEGRATION_DATABASE_URL is not set.');
  }
  const source = new URL(configured);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
    throw new Error('The migration probe requires a local database.');
  }
  const target = new URL('postgresql://localhost');
  target.hostname = source.hostname;
  target.port = source.port;
  target.username = 'postgres';
  target.pathname = `/${database.name}`;
  target.searchParams.set('sslmode', 'disable');
  const result = spawnSync(
    process.execPath,
    [CLI, ...args, `--remote=${target}`, `--workdir=${workspace}`, '--yes'],
    {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 90_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        HOME: workspace,
        USERPROFILE: workspace,
        SUPABASE_HOME: workspace,
        SUPABASE_TELEMETRY_DISABLED: '1',
        DO_NOT_TRACK: '1',
        NODE_ENV: 'test',
        CI: '1',
      },
    },
  );
  if (result.error) {
    throw result.error;
  }
  return result;
}

function runCheckedLocalCli(
  workspace: string,
  database: TestDatabase,
  args: string[],
) {
  const result = runLocalCli(workspace, database, args);
  if (result.status !== 0) {
    throw new Error(`Local Supabase CLI failed: ${result.stderr}`);
  }
  return result.stdout;
}

async function history(database: TestDatabase) {
  return database.asDeployment(
    async (client) =>
      (
        await client.query<MigrationRecord>(
          `select version, name, statements
           from supabase_migrations.schema_migrations
           where version > $1 order by version`,
          [BASELINE],
        )
      ).rows,
  );
}

function historyDigest(entry: MigrationRecord) {
  return {
    version: entry.version,
    name: entry.name,
    statementsHash: createHash('sha256')
      .update(JSON.stringify(entry.statements))
      .digest('hex'),
  };
}

describe.skipIf(!hasDatabase)('database pre-launch upgrade', () => {
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

  it('preserves existing records and rolls back all changes on a late failure', async () => {
    const database = await createTestDatabase({ throughMigration: BASELINE });
    let reference: TestDatabase | undefined;
    let workspace: string | undefined;
    try {
      reference = await createTestDatabase({ throughMigration: BASELINE });
      workspace = mkdtempSync(join(tmpdir(), 'homeish-release-probe-'));
      const migrationDirectory = join(workspace, 'supabase', 'migrations');
      mkdirSync(migrationDirectory, { recursive: true });
      for (const file of throughRelease()) {
        copyFileSync(join(MIGRATIONS, file), join(migrationDirectory, file));
      }

      runCheckedLocalCli(workspace, reference, ['migration', 'list']);
      expect(
        await reference.asDeployment(
          async (client) =>
            (
              await client.query<{ history: string | null }>(
                `select to_regnamespace('supabase_migrations')::text as history`,
              )
            ).rows[0]?.history,
        ),
      ).toBeNull();
      await initialiseHistory(database);
      await initialiseHistory(reference);
      const standardPush = runLocalCli(workspace, reference, [
        'db',
        'push',
        '--skip-vault',
      ]);
      const appliedByPush = await history(reference);
      if (standardPush.status !== 0) {
        expect(standardPush.stderr).toContain(
          'LOCK TABLE can only be used in transaction blocks',
        );
        expect(appliedByPush.map(({ version: applied }) => applied)).toEqual([
          '20261124100000',
        ]);
      } else {
        expect(appliedByPush).toHaveLength(14);
      }
      // Only the disposable reference uses repair to obtain the CLI's parsed metadata.
      runCheckedLocalCli(workspace, reference, [
        'migration',
        'repair',
        '--status',
        'applied',
        ...pendingFiles().map(version),
      ]);
      const records = await history(reference);
      expect(records.slice(0, appliedByPush.length).map(historyDigest)).toEqual(
        appliedByPush.map(historyDigest),
      );
      const migrations = readPrelaunchBatch(migrationDirectory);
      const alteredRecords = structuredClone(records);
      alteredRecords[0]!.statements.push('select 1');
      await expect(
        database.asDeployment((client) =>
          applyPrelaunchUpgrade(client, migrations, alteredRecords),
        ),
      ).rejects.toThrow('migration metadata does not match');
      const alteredMigrations = migrations.map((migration, index) =>
        index === migrations.length - 1
          ? { ...migration, sql: `${migration.sql}\n-- changed` }
          : migration,
      );
      await expect(
        database.asDeployment((client) =>
          applyPrelaunchUpgrade(client, alteredMigrations, records),
        ),
      ).rejects.toThrow('Migration files differ');
      expect(await history(database)).toEqual([]);

      await database.asDeployment((client) =>
        client.query(
          `insert into supabase_migrations.schema_migrations (version, name, statements)
           values ($1, $2, $3)`,
          ['99991231235959', 'synthetic_extra', []],
        ),
      );
      await expect(
        database.asDeployment((client) =>
          applyPrelaunchUpgrade(client, migrations, records),
        ),
      ).rejects.toThrow('history differs from the tested baseline');
      expect((await history(database)).map(({ version }) => version)).toEqual([
        '99991231235959',
      ]);
      await database.asDeployment((client) =>
        client.query(
          'delete from supabase_migrations.schema_migrations where version = $1',
          ['99991231235959'],
        ),
      );

      const calls: string[] = [];
      const uncertainClient = {
        async query(sql: string) {
          if (sql === 'COMMIT' || sql === 'ROLLBACK') calls.push(sql);
          if (sql.startsWith('SELECT version')) {
            return {
              rows: migrations
                .filter(({ version }) => version <= BASELINE)
                .map(({ version }) => ({ version })),
            };
          }
          if (sql === 'COMMIT') throw new Error('Synthetic lost response');
          return { command: sql, rows: [] };
        },
      };
      await expect(
        applyPrelaunchUpgrade(uncertainClient, migrations, records),
      ).rejects.toThrow('commit outcome is unknown');
      expect(calls).not.toContain('ROLLBACK');
      const failedRollbackClient = {
        async query(sql: string) {
          if (sql.startsWith('SELECT version')) return { rows: [] };
          if (sql === 'ROLLBACK') throw new Error('Synthetic lost connection');
          return { command: sql, rows: [] };
        },
      };
      await expect(
        applyPrelaunchUpgrade(failedRollbackClient, migrations, records),
      ).rejects.toThrow('rollback could not be confirmed');

      const fixture = await database.asSuperuser(async (client) => {
        const owner = await newAuthUser(client, 'release-owner@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'release-owner@example.test', 'Synthetic owner')`,
          [owner],
        );
        const society = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Synthetic upgrade society', $1) returning id`,
            [owner],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           values ($1, 'amc', true, '{"expiring_soon_days":15,"reminder_days":[90,30,7]}')
           on conflict (society_id, module_key)
           do update set enabled = excluded.enabled, settings = excluded.settings`,
          [society],
        );
        const category = (
          await client.query<{ id: string }>(
            `update public.service_request_categories set sla_hours = 50
             where society_id = $1 and name = 'Plumbing' returning id`,
            [society],
          )
        ).rows[0]!.id;
        const requests = (
          await client.query<{ id: string; priority: string }>(
            `insert into public.service_requests (
               society_id, created_by, category_id, location_type, description,
               priority, sla_due_at, client_request_id, updated_at
             )
             select $1, $2, $3, 'common_area', 'Synthetic request', priority,
               '2030-01-01T00:00:00Z', gen_random_uuid(), '2020-01-01T00:00:00Z'
             from unnest(ARRAY['urgent', 'normal']) as priority
             returning id, priority`,
            [society, owner, category],
          )
        ).rows;
        const staff = (
          await client.query<{ id: string }>(
            `insert into public.staff_members
               (society_id, staff_type, full_name, phone, job_role, created_by)
             values ($1, 'society', 'Synthetic staff', '0000000000', 'Cleaner', $2)
             returning id`,
            [society, owner],
          )
        ).rows[0]!.id;
        const amc = (
          await client.query<{ id: string }>(
            `insert into public.amc_contracts (
               society_id, asset_label, vendor_name, vendor_contact, start_date,
               end_date, cost_paise, payment_terms, visit_frequency,
               created_by, updated_by, client_request_id
             )
             values ($1, 'Synthetic lift', 'Synthetic vendor', 'Synthetic contact',
               '2025-01-01', '2035-01-01', 12345, 'Annual', 'Quarterly',
               $2, $2, gen_random_uuid()) returning id`,
            [society, owner],
          )
        ).rows[0]!.id;
        const notice = (
          await client.query<{ id: string }>(
            `insert into public.notices (
               society_id, created_by, title, body, client_request_id, created_at
             )
             values ($1, $2, 'Synthetic notice', 'Synthetic body',
               gen_random_uuid(), '2020-01-01T00:00:00Z') returning id`,
            [society, owner],
          )
        ).rows[0]!.id;
        const account = (
          await client.query<{ id: string }>(
            `insert into public.expense_accounts
               (society_id, name, account_type, opening_on, created_by)
             values ($1, 'Synthetic account', 'bank', '2020-01-01', $2)
             returning id`,
            [society, owner],
          )
        ).rows[0]!.id;
        const entry = (
          await client.query<{ id: string }>(
            `insert into public.expense_book_entries (
               society_id, account_id, entry_date, direction, amount_paise,
               source, income_kind, counterparty, client_request_id, created_by
             )
             values ($1, $2, '2025-06-01', 'in', 12345, 'income', 'other',
               'Synthetic counterparty', gen_random_uuid(), $3) returning id`,
            [society, account, owner],
          )
        ).rows[0]!.id;
        return { society, category, requests, staff, amc, notice, entry };
      });

      await database.asDeployment((client) =>
        client.query(`
          create function supabase_migrations.inject_release_failure()
          returns trigger language plpgsql as $$
          begin
            if new.version = '${LAST_MIGRATION}' then
              raise exception 'Synthetic late failure' using errcode = 'P0001';
            end if;
            return new;
          end $$;
          create trigger inject_release_failure
          before insert on supabase_migrations.schema_migrations
          for each row execute function supabase_migrations.inject_release_failure();
        `),
      );
      await expect(
        database.asDeployment((client) =>
          applyPrelaunchUpgrade(client, migrations, records),
        ),
      ).rejects.toThrow('transaction was rolled back');
      expect(await history(database)).toEqual([]);
      await database.asSuperuser(async (client) => {
        const before = await client.query<{
          priority: string;
          vouchers: string | null;
        }>(
          `select priority, to_regclass('public.expense_vouchers')::text as vouchers
           from public.service_requests where id = $1`,
          [fixture.requests[0]!.id],
        );
        expect(before.rows[0]).toEqual({
          priority: fixture.requests[0]!.priority,
          vouchers: null,
        });
      });

      await database.asDeployment((client) =>
        client.query(`
          drop trigger inject_release_failure on supabase_migrations.schema_migrations;
          drop function supabase_migrations.inject_release_failure();
        `),
      );
      await database.asDeployment((client) =>
        applyPrelaunchUpgrade(client, migrations, records),
      );
      expect((await history(database)).map(historyDigest)).toEqual(
        records.map(historyDigest),
      );
      await expect(
        database.asDeployment((client) =>
          applyPrelaunchUpgrade(client, migrations, records),
        ),
      ).rejects.toThrow('history differs from the tested baseline');
      expect((await history(database)).map(historyDigest)).toEqual(
        records.map(historyDigest),
      );
      expect(
        runCheckedLocalCli(workspace, database, [
          'db',
          'push',
          '--skip-vault',
          '--dry-run',
        ]),
      ).toContain('up to date');
      await database.asSuperuser(async (client) => {
        const requests = (
          await client.query<{
            id: string;
            priority: string;
            sla_due_at: Date;
            updated_at: Date;
          }>(
            `select id, priority, sla_due_at, updated_at
             from public.service_requests where society_id = $1`,
            [fixture.society],
          )
        ).rows;
        for (const original of fixture.requests) {
          const current = requests.find(({ id }) => id === original.id)!;
          expect(current.priority).toBe(
            original.priority === 'urgent' ? 'high' : 'medium',
          );
          expect(current.sla_due_at.toISOString()).toBe(
            '2030-01-01T00:00:00.000Z',
          );
          expect(current.updated_at.toISOString()).toBe(
            '2020-01-01T00:00:00.000Z',
          );
        }
        const targets = (
          await client.query<{ priority: string; target_days: number }>(
            `select priority, target_days from public.service_request_priority_targets
             where society_id = $1 and category_id = $2`,
            [fixture.society, fixture.category],
          )
        ).rows;
        expect(
          Object.fromEntries(
            targets.map(({ priority, target_days }) => [priority, target_days]),
          ),
        ).toEqual({ critical: 1, high: 2, medium: 3, low: 6 });
        expect(
          (
            await client.query(
              `select full_name, job_role, employment_status from public.staff_members
               where id = $1`,
              [fixture.staff],
            )
          ).rows[0],
        ).toEqual({
          full_name: 'Synthetic staff',
          job_role: 'Cleaner',
          employment_status: 'active',
        });
        expect(
          (
            await client.query(
              `select asset_label, cost_paise::text from public.amc_contracts where id = $1`,
              [fixture.amc],
            )
          ).rows[0],
        ).toEqual({ asset_label: 'Synthetic lift', cost_paise: '12345' });
        expect(
          (
            await client.query(
              `select status, title, published_at::text from public.notices where id = $1`,
              [fixture.notice],
            )
          ).rows[0],
        ).toEqual({
          status: 'published',
          title: 'Synthetic notice',
          published_at: '2020-01-01 00:00:00+00',
        });
        expect(
          (
            await client.query(
              `select voucher_type, financial_year, sequence from public.expense_vouchers
               where entry_id = $1`,
              [fixture.entry],
            )
          ).rows[0],
        ).toEqual({ voucher_type: 'rv', financial_year: 2025, sequence: 1 });
        expect(
          (
            await client.query(
              `select settings from public.module_configs
               where society_id = $1 and module_key = 'amc'`,
              [fixture.society],
            )
          ).rows[0]?.settings,
        ).toEqual({
          due_soon_days: 60,
          urgent_days: 15,
          reminder_days: [90, 30, 7],
        });
      });
      const metadataPath = process.env[PRELAUNCH_METADATA_ENV];
      if (metadataPath) {
        writeFileSync(metadataPath, JSON.stringify(records), {
          flag: 'wx',
          mode: 0o600,
        });
      }
    } finally {
      try {
        if (reference) await reference.drop();
      } finally {
        try {
          await database.drop();
        } finally {
          if (workspace) rmSync(workspace, { recursive: true, force: true });
        }
      }
    }
  });
});
