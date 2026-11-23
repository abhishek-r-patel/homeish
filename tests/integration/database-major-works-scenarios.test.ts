// Verify P50.3 what-if splits, missing areas and no finance-table writes.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  hasDatabase,
  newAuthUser,
} from './support/database';
import { majorWorksScenariosSchema } from '../../src/core/major-works/validation';

describe.skipIf(!hasDatabase)('database major works scenarios', () => {
  it('keeps calculations read-only and flags missing unit areas', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee']) {
          const id = await newAuthUser(
            client,
            `works-scenario-${role}@example.test`,
          );
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `works-scenario-${role}@example.test`, `Scenario ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['Scenario Society', users.get('admin')],
          )
        ).rows[0]!.id;
        for (const role of ['admin', 'committee']) {
          await client.query(
            `insert into public.memberships(society_id,user_id,roles,status)
             values($1,$2,$3,'active')`,
            [society, users.get(role), [role]],
          );
        }
        await client.query(
          `insert into public.module_configs(
             society_id,module_key,enabled,settings
           ) values
             ($1,'core',true,'{}'),
             ($1,'major_works',true,'{"consent_method":"poll"}')`,
          [society],
        );
        const project = (
          await client.query<{ id: string }>(
            `insert into public.major_works_projects(
               society_id,title,location,category,priority,estimate_paise,
               progress_percent,client_request_id,created_by
             ) values($1,'Scenario repair','Block A','structure','medium',
               1000000,0,$2,$3) returning id`,
            [society, crypto.randomUUID(), users.get('admin')],
          )
        ).rows[0]!.id;
        const units = await client.query<{ id: string; number: string }>(
          `insert into public.units(society_id,number,area_sqft,created_by)
           values
             ($1,'A-101',1000,$2),
             ($1,'A-102',2000,$2),
             ($1,'A-103',null,$2)
           returning id,number`,
          [society, users.get('admin')],
        );
        return { society, users, project, units: units.rows };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const financeCounts = await database.asSuperuser((client) =>
        client.query<{ entries: string; bills: string }>(
          `select
             (select count(*) from public.expense_book_entries where society_id=$1)::text as entries,
             (select count(*) from public.billing_bills where society_id=$1)::text as bills`,
          [fixture.society],
        ),
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_scenario_save(
               $1,null,$2,'Area scenario','typed',1000000,'none',null,null,
               'area',null,$3,'scenario-area'
             )`,
            [fixture.society, fixture.project, crypto.randomUUID()],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_scenario_save(
               $1,null,$2,'Equal scenario','typed',1000000,'none',null,null,
               'equal',null,$3,'scenario-equal'
             )`,
            [fixture.society, fixture.project, crypto.randomUUID()],
          ),
        { commit: true },
      );
      const listed = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_scenarios_list($1,$2) as data',
            [fixture.society, fixture.project],
          ),
      );
      const parsed = majorWorksScenariosSchema.parse(listed.rows[0]!.data);
      const area = parsed.scenarios.find(
        (scenario) => scenario.name === 'Area scenario',
      )!;
      const equal = parsed.scenarios.find(
        (scenario) => scenario.name === 'Equal scenario',
      )!;
      expect(area.complete).toBe(false);
      expect(area.missing_area_units.map((unit) => unit.unit_number)).toEqual([
        'A-103',
      ]);
      expect(area.shares).toEqual([]);
      expect(equal.complete).toBe(true);
      expect(equal.shares).toHaveLength(3);
      expect(
        equal.shares.reduce((total, share) => total + share.amount_paise, 0) +
          equal.rounding_difference_paise,
      ).toBe(equal.amount_paise);
      const after = await database.asSuperuser((client) =>
        client.query<{ entries: string; bills: string }>(
          `select
             (select count(*) from public.expense_book_entries where society_id=$1)::text as entries,
             (select count(*) from public.billing_bills where society_id=$1)::text as bills`,
          [fixture.society],
        ),
      );
      expect(after.rows[0]).toEqual(financeCounts.rows[0]);
    } finally {
      await database.drop();
    }
  });
});
