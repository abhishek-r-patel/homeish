// Committee analytics contracts: settings, dashboard access and ranges, export audit and catalogue parity.
import { describe, expect, it } from 'vitest';
import { ANALYTICS_METRICS } from '../../src/core/analytics/catalogue';
import { createTestDatabase, dbError, hasDatabase } from './support/database';
import {
  type AnalyticsFixture,
  createAnalyticsFixture,
  dashboard,
  enableModules,
  setMetrics,
} from './support/analytics-fixtures';

interface Settings {
  metrics: string[];
  isDefault: boolean;
  version: number;
  catalogue: { key: string; moduleEnabled: boolean }[];
}

const DEFAULT_METRICS = [
  'billing.dues_ageing',
  'billing.collection_trend',
  'expense.income_vs_expense',
  'service_request.sla',
  'amenity.usage',
  'visitor.trend',
];

describe.skipIf(!hasDatabase)('analytics foundation', () => {
  async function withFixture(
    run: (
      database: Awaited<ReturnType<typeof createTestDatabase>>,
      fixture: AnalyticsFixture,
    ) => Promise<void>,
  ): Promise<void> {
    const database = await createTestDatabase();
    try {
      await run(database, await createAnalyticsFixture(database));
    } finally {
      await database.drop();
    }
  }

  function settingsGet(
    database: Awaited<ReturnType<typeof createTestDatabase>>,
    userId: string,
    societyId: string,
  ): Promise<Settings> {
    return database.asRole('authenticated', { sub: userId }, async (client) => {
      const result = await client.query<{ data: Settings }>(
        'select public.analytics_settings_get($1) as data',
        [societyId],
      );
      return result.rows[0]!.data;
    });
  }

  function settingsUpdate(
    database: Awaited<ReturnType<typeof createTestDatabase>>,
    userId: string,
    societyId: string,
    keys: string[],
    version: number,
  ): Promise<Settings> {
    return database.asRole(
      'authenticated',
      { sub: userId },
      async (client) => {
        const result = await client.query<{ data: Settings }>(
          'select public.analytics_settings_update($1, $2::text[], $3, $4) as data',
          [societyId, keys, version, 'analytics-test'],
        );
        return result.rows[0]!.data;
      },
      { commit: true },
    );
  }

  it('reads defaults and updates settings with version checks', async () => {
    await withFixture(async (database, { a, b }) => {
      const initial = await settingsGet(database, a.users.committee, a.id);
      expect(initial).toMatchObject({
        metrics: DEFAULT_METRICS,
        isDefault: true,
        version: 0,
      });
      expect(initial.catalogue).toHaveLength(ANALYTICS_METRICS.length);

      const updated = await settingsUpdate(
        database,
        a.users.admin,
        a.id,
        ['visitor.trend', 'core.occupancy'],
        0,
      );
      // Stored in catalogue order regardless of the order sent.
      expect(updated).toMatchObject({
        metrics: ['core.occupancy', 'visitor.trend'],
        isDefault: false,
        version: 1,
      });
      expect(
        (await dbError(settingsUpdate(database, a.users.admin, a.id, [], 0)))
          .code,
      ).toBe('40001');
      expect(
        (await settingsUpdate(database, a.users.admin, a.id, [], 1)).metrics,
      ).toEqual([]);

      const audits = await database.asSuperuser((client) =>
        client.query<{ action: string; actor_id: string }>(
          `select action, actor_id from public.audit_logs
           where society_id = $1 and action like 'analytics.%' order by created_at`,
          [a.id],
        ),
      );
      expect(audits.rows).toEqual([
        { action: 'analytics.settings_update', actor_id: a.users.admin },
        { action: 'analytics.settings_update', actor_id: a.users.admin },
      ]);

      // The other society is untouched.
      expect((await settingsGet(database, b.users.admin, b.id)).isDefault).toBe(
        true,
      );
    });
  });

  it('rejects invalid keys and callers who may not change settings', async () => {
    await withFixture(async (database, { a, b, outsiderId }) => {
      for (const keys of [
        ['visitor.unknown'],
        ['visitor.trend', 'visitor.trend'],
      ]) {
        expect(
          (
            await dbError(
              settingsUpdate(database, a.users.admin, a.id, keys, 0),
            )
          ).code,
        ).toBe('22023');
      }
      for (const userId of [
        a.users.committee,
        a.users.resident,
        a.users.guard,
        outsiderId,
        b.users.admin,
      ]) {
        expect(
          (
            await dbError(
              settingsUpdate(database, userId, a.id, ['visitor.trend'], 0),
            )
          ).code,
        ).toBe('42501');
      }
      for (const userId of [a.users.resident, a.users.guard, outsiderId]) {
        expect((await dbError(settingsGet(database, userId, a.id))).code).toBe(
          '42501',
        );
      }

      await database.asSuperuser((client) =>
        client.query(
          `update public.societies set status = 'suspended' where id = $1`,
          [a.id],
        ),
      );
      expect(
        (
          await dbError(
            settingsUpdate(database, a.users.admin, a.id, ['visitor.trend'], 0),
          )
        ).code,
      ).toBe('42501');
      // A read-only society can still be viewed.
      expect((await settingsGet(database, a.users.admin, a.id)).version).toBe(
        0,
      );
      expect(
        (await dashboard(database, a.users.committee, a.id)).metrics,
      ).toBeDefined();

      await database.asSuperuser((client) =>
        client.query(
          `update public.societies set status = 'archived' where id = $1`,
          [a.id],
        ),
      );
      expect(
        (await dbError(settingsGet(database, a.users.admin, a.id))).code,
      ).toBe('42501');
      expect(
        (await dbError(dashboard(database, a.users.admin, a.id))).code,
      ).toBe('42501');
    });
  });

  it('allows only admins and committee to view the dashboard', async () => {
    await withFixture(async (database, { a, b, outsiderId }) => {
      for (const userId of [a.users.admin, a.users.committee]) {
        const result = await dashboard(database, userId, a.id);
        expect(result.timezone).toBe('Asia/Kolkata');
      }
      for (const userId of [
        a.users.guard,
        a.users.resident,
        a.users.hk_supervisor,
        outsiderId,
        b.users.admin,
      ]) {
        expect((await dbError(dashboard(database, userId, a.id))).code).toBe(
          '42501',
        );
      }
      for (const [months, range] of [
        [1, 'months'],
        [24, 'months'],
        [12, 'year'],
      ] as const) {
        expect(
          (
            await dbError(
              dashboard(database, a.users.admin, a.id, months, range),
            )
          ).code,
        ).toBe('22023');
      }
    });
  });

  it('omits metrics of disabled modules and applies the money range', async () => {
    await withFixture(async (database, { a }) => {
      await setMetrics(database, a, [
        'core.occupancy',
        'billing.dues_ageing',
        'billing.collection_trend',
        'visitor.trend',
      ]);
      const coreOnly = await dashboard(database, a.users.admin, a.id, 3);
      expect(coreOnly.metrics.map((metric) => metric.key)).toEqual([
        'core.occupancy',
      ]);

      await enableModules(database, a.id, ['billing', 'visitor']);
      const months = await dashboard(database, a.users.admin, a.id, 3);
      expect(months.metrics.map((metric) => metric.key)).toEqual([
        'core.occupancy',
        'billing.dues_ageing',
        'billing.collection_trend',
        'visitor.trend',
      ]);
      const monthStart = `${months.today.slice(0, 8)}01`;
      expect(months.from < monthStart).toBe(true);
      for (const metric of months.metrics) {
        expect(metric).toMatchObject({
          from: months.from,
          to: months.today,
          range: 'months',
        });
      }
      expect(
        months.metrics.find((metric) => metric.key === 'visitor.trend')!.points,
      ).toHaveLength(3);

      const fy = await dashboard(database, a.users.admin, a.id, 3, 'fy');
      expect(fy.fyFrom).toMatch(/^\d{4}-04-01$/);
      expect(fy.fyFrom <= fy.today).toBe(true);
      const byKey = new Map(fy.metrics.map((metric) => [metric.key, metric]));
      expect(byKey.get('billing.collection_trend')).toMatchObject({
        from: fy.fyFrom,
        range: 'fy',
      });
      expect(byKey.get('visitor.trend')).toMatchObject({
        from: fy.from,
        range: 'months',
      });
      expect(byKey.get('billing.dues_ageing')!.range).toBe('months');

      await enableModules(database, a.id, ['billing'], false);
      expect(
        (await dashboard(database, a.users.admin, a.id)).metrics.map(
          (metric) => metric.key,
        ),
      ).toEqual(['core.occupancy', 'visitor.trend']);
    });
  });

  it('audits exports for admins only', async () => {
    await withFixture(async (database, { a }) => {
      const record = (userId: string, format: string, commit = true) =>
        database.asRole(
          'authenticated',
          { sub: userId },
          (client) =>
            client.query(
              'select public.analytics_export_record($1, $2, 12, $3, $4)',
              [a.id, format, 'fy', 'export-test'],
            ),
          { commit },
        );
      await enableModules(database, a.id, ['billing', 'visitor']);
      await record(a.users.admin, 'pdf');
      expect((await dbError(record(a.users.committee, 'csv'))).code).toBe(
        '42501',
      );
      expect((await dbError(record(a.users.admin, 'xlsx'))).code).toBe('22023');
      const audits = await database.asSuperuser((client) =>
        client.query<{ action: string; actor_id: string; after: unknown }>(
          `select action, actor_id, "after" as after, request_id from public.audit_logs
           where society_id = $1 and action = 'analytics.export'`,
          [a.id],
        ),
      );
      expect(audits.rows).toEqual([
        {
          action: 'analytics.export',
          actor_id: a.users.admin,
          after: {
            format: 'pdf',
            months: 12,
            moneyRange: 'fy',
            // Only metrics whose module is on are exported, so only those are recorded.
            metrics: [
              'billing.dues_ageing',
              'billing.collection_trend',
              'visitor.trend',
            ],
          },
          request_id: 'export-test',
        },
      ]);
    });
  });

  it('keeps preferences and metric functions out of direct client reach', async () => {
    await withFixture(async (database, { a }) => {
      await setMetrics(database, a, ['core.occupancy']);
      expect(
        (
          await dbError(
            database.asRole('authenticated', { sub: a.users.admin }, (client) =>
              client.query('select * from public.analytics_preferences'),
            ),
          )
        ).code,
      ).toBe('42501');
      const callable = await database.asSuperuser((client) =>
        client.query<{ name: string }>(
          `select p.proname as name from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname like 'analytics\\_%'
             and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
               or has_function_privilege('anon', p.oid, 'EXECUTE')
               or has_function_privilege('service_role', p.oid, 'EXECUTE'))`,
        ),
      );
      expect(callable.rows).toEqual([]);
    });
  });

  it('matches the TypeScript catalogue and has a function per metric', async () => {
    const database = await createTestDatabase();
    try {
      const rows = await database.asSuperuser((client) =>
        client.query<{
          key: string;
          module: string;
          defaultOn: boolean;
          money: boolean;
          hasFunction: boolean;
        }>(
          `select metric_key as key, module_key as module, default_on as "defaultOn", money,
                  to_regprocedure(format('private.analytics_metric_%s(uuid, date, date)',
                    replace(metric_key, '.', '_'))) is not null as "hasFunction"
           from private.analytics_catalogue() order by sort_position`,
        ),
      );
      expect(
        rows.rows.map(({ key, module, defaultOn, money }) => ({
          key,
          module,
          defaultOn,
          money,
        })),
      ).toEqual(
        ANALYTICS_METRICS.map(({ key, module, defaultOn, money }) => ({
          key,
          module,
          defaultOn,
          money,
        })),
      );
      expect(rows.rows.filter((row) => !row.hasFunction)).toEqual([]);
    } finally {
      await database.drop();
    }
  });
});
