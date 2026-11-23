// Verify P40.9 estimate math, retry safety, access and archive history.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
import { expenseRepairForecastSchema } from '../../src/core/expense/repair-forecast-validation';

describe.skipIf(!hasDatabase)('database expense repair forecast', () => {
  it('keeps estimates read-only, idempotent and permanently archived', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(client, `forecast-${role}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `forecast-${role}@example.test`, `Forecast ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['Forecast Society', users.get('admin')],
          )
        ).rows[0]!.id;
        for (const role of ['admin', 'committee', 'resident']) {
          await client.query(
            `insert into public.memberships(society_id,user_id,roles,status)
             values($1,$2,$3,'active')`,
            [society, users.get(role), [role]],
          );
        }
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled,settings)
           values($1,'core',true,'{}'),($1,'expense',true,'{}')`,
          [society],
        );
        return { society, users };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const resident = fixture.users.get('resident')!;
      const initial = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ forecast: unknown }>(
            `select public.expense_repair_forecast_get($1,false) as forecast`,
            [fixture.society],
          ),
      );
      const forecast = expenseRepairForecastSchema.parse(
        initial.rows[0]!.forecast,
      );
      const currentYear = forecast.years[0]!.financial_year;
      const createRequest = crypto.randomUUID();
      const item = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ id: string }>(
            `select public.expense_repair_forecast_item_save(
               $1,null,'Lift replacement','lifts',null,3,$2,100000,1000,
               'Synthetic estimate',null,$3,$4
             ) as id`,
            [fixture.society, currentYear, createRequest, 'forecast-create'],
          ),
        { commit: true },
      );
      const itemId = item.rows[0]!.id;
      const repeated = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ id: string }>(
            `select public.expense_repair_forecast_item_save(
               $1,null,'Lift replacement','lifts',null,3,$2,100000,1000,
               'Synthetic estimate',null,$3,$4
             ) as id`,
            [
              fixture.society,
              currentYear,
              createRequest,
              'forecast-create-retry',
            ],
          ),
        { commit: true },
      );
      expect(repeated.rows[0]!.id).toBe(itemId);
      expect(
        await dbError(
          database.asRole('authenticated', { sub: admin }, (client) =>
            client.query(
              `select public.expense_repair_forecast_item_save(
                 $1,null,'Changed retry payload','lifts',null,3,$2,100000,1000,
                 'Synthetic estimate',null,$3,$4
               )`,
              [
                fixture.society,
                currentYear,
                createRequest,
                'forecast-changed-retry',
              ],
            ),
          ),
        ),
      ).toMatchObject({ code: '23505' });

      const loaded = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ forecast: unknown }>(
            `select public.expense_repair_forecast_get($1,false) as forecast`,
            [fixture.society],
          ),
      );
      const parsed = expenseRepairForecastSchema.parse(
        loaded.rows[0]!.forecast,
      );
      expect(parsed.can_manage).toBe(false);
      expect(parsed.fund_balance_available).toBe(false);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0]!.years.map((year) => year.amount_paise)).toEqual([
        100_000, 0, 0, 133_100, 0, 0, 177_200, 0, 0, 235_800,
      ]);
      expect(parsed.years[3]!.total_paise).toBe(133_100);
      expect(
        await dbError(
          database.asRole('authenticated', { sub: resident }, (client) =>
            client.query(
              'select public.expense_repair_forecast_get($1,false)',
              [fixture.society],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      expect(
        await dbError(
          database.asRole('authenticated', { sub: committee }, (client) =>
            client.query(
              `select public.expense_repair_forecast_item_save(
                 $1,$2,'Changed','lifts',null,3,$3,100000,1000,
                 null,$4,$5,$6
               )`,
              [
                fixture.society,
                itemId,
                currentYear,
                parsed.items[0]!.updated_at,
                crypto.randomUUID(),
                'forecast-committee',
              ],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });

      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_repair_forecast_item_archive(
               $1,$2,true,'Replaced by a different plan',$3,$4,$5
             )`,
            [
              fixture.society,
              itemId,
              parsed.items[0]!.updated_at,
              crypto.randomUUID(),
              'forecast-archive',
            ],
          ),
        { commit: true },
      );
      const withArchived = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ forecast: unknown }>(
            `select public.expense_repair_forecast_get($1,true) as forecast`,
            [fixture.society],
          ),
      );
      const archived = expenseRepairForecastSchema.parse(
        withArchived.rows[0]!.forecast,
      );
      expect(archived.items[0]).toMatchObject({
        id: itemId,
        archive_reason: 'Replaced by a different plan',
      });
      const revisions = await database.asSuperuser((client) =>
        client.query(
          `select action from public.expense_repair_forecast_item_revisions
           where society_id=$1 and item_id=$2 order by changed_at`,
          [fixture.society, itemId],
        ),
      );
      expect(revisions.rows.map((row) => row.action)).toEqual([
        'create',
        'archive',
      ]);
      expect(
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              'delete from public.expense_repair_forecast_item_revisions where item_id=$1',
              [itemId],
            ),
          ),
        ),
      ).toMatchObject({ code: '55000' });
    } finally {
      await database.drop();
    }
  });
});
