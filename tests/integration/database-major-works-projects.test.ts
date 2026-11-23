// Verify P50.1 role access, project lifecycle, budget modes and spend caps.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
import {
  majorWorksAdminListSchema,
  majorWorksResidentListSchema,
  majorWorksSummarySchema,
} from '../../src/core/major-works/validation';

describe.skipIf(!hasDatabase)('database major works projects', () => {
  it('keeps approval external and Accounts-linked spend authoritative', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(client, `works-${role}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `works-${role}@example.test`, `Works ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['Major Works Society', users.get('admin')],
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
          `insert into public.module_configs(
             society_id,module_key,enabled,settings
           ) values
             ($1,'core',true,'{}'),
             ($1,'expense',true,'{}'),
             ($1,'major_works',true,'{"consent_method":"poll"}')`,
          [society],
        );
        const account = (
          await client.query<{ id: string }>(
            `insert into public.expense_accounts(
               society_id,name,account_type,opening_balance_paise,opening_on,created_by
             ) values($1,'Works bank','bank',1000000,'2026-04-01',$2)
             returning id`,
            [society, users.get('admin')],
          )
        ).rows[0]!.id;
        const category = (
          await client.query<{ id: string }>(
            `insert into public.expense_categories(society_id,name,created_by)
             values($1,'Major repairs',$2) returning id`,
            [society, users.get('admin')],
          )
        ).rows[0]!.id;
        const expense = (
          await client.query<{ id: string }>(
            `insert into public.expenses(
               society_id,account_id,category_id,spent_on,payee,amount_paise,
               payment_mode,approval_required,status,client_request_id,created_by
             ) values(
               $1,$2,$3,'2026-05-10','Synthetic contractor',100000,
               'bank',false,'posted',$4,$5
             ) returning id`,
            [
              society,
              account,
              category,
              crypto.randomUUID(),
              users.get('admin'),
            ],
          )
        ).rows[0]!.id;
        const entry = (
          await client.query<{ id: string }>(
            `insert into public.expense_book_entries(
               society_id,account_id,entry_date,direction,amount_paise,source,
               expense_id,category_id,counterparty,created_by
             ) values(
               $1,$2,'2026-05-10','out',100000,'expense',$4,$3,
               'Synthetic contractor',$5
             ) returning id`,
            [society, account, category, expense, users.get('admin')],
          )
        ).rows[0]!.id;
        const fund = (
          await client.query<{ id: string }>(
            `insert into public.expense_funds(
               society_id,name,created_by
             ) values($1,'Repair fund',$2) returning id`,
            [society, users.get('admin')],
          )
        ).rows[0]!.id;
        const work = (
          await client.query<{ id: string }>(
            `insert into public.expense_fund_works(
               society_id,fund_id,title,sanctioned_amount_paise,sanctioned_on,
               external_reference,created_by
             ) values(
               $1,$2,'Sanctioned lift work',500000,'2026-05-01',
               'SYNTHETIC-RESOLUTION',$3
             ) returning id`,
            [society, fund, users.get('admin')],
          )
        ).rows[0]!.id;
        return { society, users, entry, work };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const resident = fixture.users.get('resident')!;
      const projectRequest = crypto.randomUUID();
      const project = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ id: string }>(
            `select public.major_works_project_save(
               $1,null,'Lift modernization','Block A','lifts','high',700000,
               '2026-06-01','2026-07-31',null,null,10,
               'Synthetic project',null,null,$2,'works-create'
             ) as id`,
            [fixture.society, projectRequest],
          ),
        { commit: true },
      );
      const projectId = project.rows[0]!.id;
      const loaded = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_projects_list($1) as data',
            [fixture.society],
          ),
      );
      const list = majorWorksAdminListSchema.parse(loaded.rows[0]!.data);
      expect(list.can_manage).toBe(false);
      expect(list.projects[0]).toMatchObject({
        id: projectId,
        status: 'planned',
        budget_source: 'typed',
        typed_budget_paise: 0,
      });

      const residentLoaded = await database.asRole(
        'authenticated',
        { sub: resident },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_resident_projects_get($1) as data',
            [fixture.society],
          ),
      );
      expect(
        majorWorksResidentListSchema.parse(residentLoaded.rows[0]!.data)
          .projects[0],
      ).toEqual({
        id: projectId,
        title: 'Lift modernization',
        location: 'Block A',
        status: 'planned',
        progress_percent: 10,
        planned_start_on: '2026-06-01',
        planned_end_on: '2026-07-31',
      });
      expect(
        await dbError(
          database.asRole('authenticated', { sub: resident }, (client) =>
            client.query('select public.major_works_projects_list($1)', [
              fixture.society,
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      expect(
        await dbError(
          database.asRole('authenticated', { sub: committee }, (client) =>
            client.query(
              `select public.major_works_project_status_set(
                 $1,$2,'quoting',null,null,null,null,$3,$4,'works-status-committee'
               )`,
              [
                fixture.society,
                projectId,
                list.projects[0]!.updated_at,
                crypto.randomUUID(),
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
            `select public.major_works_project_status_set(
               $1,$2,'quoting',null,null,null,null,$3,$4,'works-quoting'
             )`,
            [
              fixture.society,
              projectId,
              list.projects[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const afterQuoting = await database.asSuperuser((client) =>
        client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at
           from public.major_works_projects where id=$1`,
          [projectId],
        ),
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_project_budget_set(
               $1,$2,'typed',200000,null,$3,$4,'works-budget'
             )`,
            [
              fixture.society,
              projectId,
              afterQuoting.rows[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const tag = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ id: string }>(
            `select public.major_works_spend_tag_save(
               $1,$2,$3,40000,$4,'works-tag'
             ) as id`,
            [fixture.society, projectId, fixture.entry, crypto.randomUUID()],
          ),
        { commit: true },
      );
      expect(
        await dbError(
          database.asRole('authenticated', { sub: admin }, (client) =>
            client.query(
              `select public.major_works_spend_tag_save(
                 $1,$2,$3,70000,$4,'works-tag-over'
               )`,
              [fixture.society, projectId, fixture.entry, crypto.randomUUID()],
            ),
          ),
        ),
      ).toMatchObject({ code: '23514' });
      const tagged = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_projects_list($1) as data',
            [fixture.society],
          ),
      );
      expect(
        majorWorksAdminListSchema.parse(tagged.rows[0]!.data).projects[0]
          ?.spend_paise,
      ).toBe(40_000);
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_spend_tag_remove(
               $1,$2,'Tag entered for a different project',$3,'works-tag-remove'
             )`,
            [fixture.society, tag.rows[0]!.id, crypto.randomUUID()],
          ),
        { commit: true },
      );

      const afterTag = await database.asSuperuser((client) =>
        client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at
           from public.major_works_projects where id=$1`,
          [projectId],
        ),
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_project_budget_set(
               $1,$2,'sanctioned_work',200000,$3,$4,$5,'works-budget-linked'
             )`,
            [
              fixture.society,
              projectId,
              fixture.work,
              afterTag.rows[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const linked = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_projects_list($1) as data',
            [fixture.society],
          ),
      );
      expect(
        majorWorksAdminListSchema.parse(linked.rows[0]!.data).projects[0],
      ).toMatchObject({
        budget_source: 'sanctioned_work',
        budget_paise: 500_000,
        spend_paise: 0,
      });
      const summary = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_summary_get($1) as data',
            [fixture.society],
          ),
      );
      expect(
        majorWorksSummarySchema.parse(summary.rows[0]!.data).projects[0],
      ).toMatchObject({
        id: projectId,
        status: 'quoting',
        budget_paise: 500_000,
        delayed: true,
      });
    } finally {
      await database.drop();
    }
  });
});
