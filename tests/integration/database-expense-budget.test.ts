// Verify P42.5 draft, approval, copy and permanent change rules.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
const budgetResultSchema = z
  .object({
    budget: z
      .object({
        id: z.uuid(),
        status: z.enum(['draft', 'approved']),
      })
      .nullable(),
    changes: z.array(
      z.object({
        id: z.uuid(),
        pair_id: z.uuid().nullable(),
        voided_at: z.string().nullable(),
      }),
    ),
    current_plan: z.array(
      z.object({
        category_id: z.uuid().nullable(),
        original_paise: z.number(),
        current_paise: z.number(),
      }),
    ),
    settings: z.object({ updated_at: z.string() }),
  })
  .passthrough();
const budgetReportSchema = z
  .object({
    approved: z.boolean(),
    months: z.array(z.object({}).passthrough()),
    cash_flow: z.array(z.object({}).passthrough()),
    summary: z.array(
      z.object({
        category_id: z.uuid().nullable(),
        current_paise: z.number(),
        actual_to_date_paise: z.number(),
        burn_rate_bp: z.number().nullable(),
        warning: z.enum(['on_track', 'watch', 'over_plan']).nullable(),
        projected_year_end_paise: z.number().nullable(),
        projected_overrun_paise: z.number().nullable(),
        projection_available: z.boolean(),
      }),
    ),
  })
  .passthrough();
const residentSummarySchema = z
  .object({
    shared: z.boolean(),
    rows: z.array(z.object({}).passthrough()),
  })
  .passthrough();
const copyPreviewSchema = z.object({
  lines: z.array(
    z.object({
      income_type: z
        .enum(['billing', 'donation', 'interest', 'other'])
        .nullable(),
      annual_paise: z.number(),
    }),
  ),
});

describe.skipIf(!hasDatabase)('database expense budgets', () => {
  it('locks approved plans and retains paired change history', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(client, `budget-${role}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `budget-${role}@example.test`, `Budget ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['Budget Society', users.get('admin')],
          )
        ).rows[0]!.id;
        for (const role of ['admin', 'committee', 'resident']) {
          await client.query(
            `insert into public.memberships(society_id,user_id,roles,status)
             values($1,$2,$3,'active')`,
            [society, users.get(role), [role]],
          );
        }
        const residentMembership = (
          await client.query<{ id: string }>(
            `select id from public.memberships
             where society_id=$1 and user_id=$2`,
            [society, users.get('resident')],
          )
        ).rows[0]!.id;
        const unit = (
          await client.query<{ id: string }>(
            `insert into public.units(society_id,number,created_by)
             values($1,'B-101',$2) returning id`,
            [society, users.get('admin')],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.unit_occupants(
             society_id,unit_id,membership_id,relationship,status,created_by
           ) values($1,$2,$3,'owner','active',$4)`,
          [society, unit, residentMembership, users.get('admin')],
        );
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled,settings)
           values($1,'core',true,'{}'),($1,'expense',true,'{}')`,
          [society],
        );
        await client.query(
          `insert into public.module_setting_access
             (society_id, module_key, setting_key, admin_can_edit)
           values
             ($1, 'expense', 'budget_forecast_method', true),
             ($1, 'expense', 'budget_watch_percent', true),
             ($1, 'expense', 'budget_resident_summary', true)
           on conflict (society_id, module_key, setting_key)
           do update set admin_can_edit = true`,
          [society],
        );
        const categories = await client.query<{ id: string; name: string }>(
          `insert into public.expense_categories(society_id,name,created_by)
           values($1,'Budget repairs',$2),($1,'Budget power',$2),
             ($1,'Budget future',$2) returning id,name`,
          [society, users.get('admin')],
        );
        const account = (
          await client.query<{ id: string }>(
            `insert into public.expense_accounts(
               society_id,name,account_type,opening_balance_paise,opening_on,created_by
             ) values($1,'Budget Bank','bank',10000000,'2025-04-01',$2)
             returning id`,
            [society, users.get('admin')],
          )
        ).rows[0]!.id;
        return {
          society,
          account,
          users,
          repairs: categories.rows.find((row) => row.name === 'Budget repairs')!
            .id,
          power: categories.rows.find((row) => row.name === 'Budget power')!.id,
          future: categories.rows.find((row) => row.name === 'Budget future')!
            .id,
        };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const resident = fixture.users.get('resident')!;
      const saveClient = crypto.randomUUID();
      const lines = [
        {
          category_id: fixture.repairs,
          income_type: null,
          phasing: 'equal_monthly',
          annual_paise: 12000,
          month_paise: Array.from({ length: 12 }, () => 1000),
        },
        {
          category_id: fixture.power,
          income_type: null,
          phasing: 'equal_monthly',
          annual_paise: 24000,
          month_paise: Array.from({ length: 12 }, () => 2000),
        },
        {
          category_id: fixture.future,
          income_type: null,
          phasing: 'custom',
          annual_paise: 12000,
          month_paise: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12000],
        },
        {
          category_id: null,
          income_type: 'billing',
          phasing: 'equal_monthly',
          annual_paise: 6000,
          month_paise: Array.from({ length: 12 }, () => 500),
        },
      ];
      const budgetId = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.expense_budget_save_draft(
                 $1,2026,$2::jsonb,null,null,null,$3,$4
               ) as id`,
              [
                fixture.society,
                JSON.stringify(lines),
                saveClient,
                'budget-save',
              ],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      const replayed = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.expense_budget_save_draft(
                 $1,2026,$2::jsonb,null,null,null,$3,$4
               ) as id`,
              [
                fixture.society,
                JSON.stringify(lines),
                saveClient,
                'budget-replay',
              ],
            )
          ).rows[0]!.id,
      );
      expect(replayed).toBe(budgetId);

      const readable = await database.asRole(
        'authenticated',
        { sub: committee },
        async (client) =>
          (
            await client.query<{ budget: unknown }>(
              'select public.expense_budget_get($1,2026) as budget',
              [fixture.society],
            )
          ).rows[0]!.budget,
      );
      const draft = budgetResultSchema.parse(readable);
      expect(draft.budget).toMatchObject({ id: budgetId, status: 'draft' });
      expect(draft.current_plan.length).toBeGreaterThanOrEqual(16);
      expect(
        draft.current_plan.find((head) => head.category_id === fixture.repairs),
      ).toMatchObject({
        original_paise: 12000,
        current_paise: 12000,
      });
      expect(
        await dbError(
          database.asRole('authenticated', { sub: resident }, (client) =>
            client.query('select public.expense_budget_get($1,2026)', [
              fixture.society,
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });

      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_budget_approve(
               $1,$2,'committee','2026-11-01',null,null,
               'Budget approved for testing',1,$3,$4
             )`,
            [fixture.society, budgetId, crypto.randomUUID(), 'budget-approve'],
          ),
        { commit: true },
      );
      expect(
        await dbError(
          database.asRole('authenticated', { sub: admin }, (client) =>
            client.query(
              `select public.expense_budget_save_draft(
                 $1,2026,$2::jsonb,null,null,2,$3,$4
               )`,
              [
                fixture.society,
                JSON.stringify(lines),
                crypto.randomUUID(),
                'budget-locked',
              ],
            ),
          ),
        ),
      ).toMatchObject({ code: '55000' });

      const increase = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.expense_budget_change_record(
                 $1,$2,'increase',$3,null,null,null,6000,10,
                 'Approved mid-year increase','committee','2026-11-01',
                 null,null,'Increase note',2,$4,$5
               ) as id`,
              [
                fixture.society,
                budgetId,
                fixture.repairs,
                crypto.randomUUID(),
                'budget-increase',
              ],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      expect(increase).toMatch(/^[0-9a-f-]{36}$/);
      expect(
        await dbError(
          database.asRole('authenticated', { sub: admin }, (client) =>
            client.query(
              `select public.expense_budget_change_record(
                 $1,$2,'decrease',$3,null,null,null,15000,1,
                 'Invalid decrease','committee','2026-11-01',
                 null,null,null,3,$4,$5
               )`,
              [
                fixture.society,
                budgetId,
                fixture.repairs,
                crypto.randomUUID(),
                'budget-decrease',
              ],
            ),
          ),
        ),
      ).toMatchObject({ code: '23514' });

      const moveId = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.expense_budget_change_record(
                 $1,$2,'move',$3,null,$4,null,12000,1,
                 'Move between repair heads','committee','2026-11-01',
                 null,null,'Paired move',3,$5,$6
               ) as id`,
              [
                fixture.society,
                budgetId,
                fixture.repairs,
                fixture.power,
                crypto.randomUUID(),
                'budget-move',
              ],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_budget_change_void(
               $1,$2,'Move entered in error',4,$3,$4
             )`,
            [fixture.society, moveId, crypto.randomUUID(), 'budget-move-void'],
          ),
        { commit: true },
      );
      const approved = budgetResultSchema.parse(
        await database.asRole(
          'authenticated',
          { sub: committee },
          async (client) =>
            (
              await client.query<{ budget: unknown }>(
                'select public.expense_budget_get($1,2026) as budget',
                [fixture.society],
              )
            ).rows[0]!.budget,
        ),
      );
      const pair = approved.changes.find(
        (change) => change.id === moveId,
      )?.pair_id;
      expect(pair).toBeTruthy();
      expect(
        approved.changes.filter((change) => change.pair_id === pair),
      ).toHaveLength(2);
      expect(
        approved.changes
          .filter((change) => change.pair_id === pair)
          .every((change) => change.voided_at !== null),
      ).toBe(true);
      expect(
        approved.current_plan.find(
          (head) => head.category_id === fixture.repairs,
        )?.current_paise,
      ).toBe(18000);

      const boundary = await database.asSuperuser(async (client) => {
        const result = await client.query<{
          below: Record<string, unknown>;
          watch: Record<string, unknown>;
          full: Record<string, unknown>;
          over: Record<string, unknown>;
          extreme: Record<string, unknown>;
        }>(
          `select
             private.expense_budget_warning_row(
               '{"kind":"spending","budgeted":true,"current_paise":12000,
                 "plan_to_date_paise":10000,"actual_to_date_paise":8999}',
               90,false
             ) as below,
             private.expense_budget_warning_row(
               '{"kind":"spending","budgeted":true,"current_paise":12000,
                 "plan_to_date_paise":10000,"actual_to_date_paise":9000}',
               90,false
             ) as watch,
             private.expense_budget_warning_row(
               '{"kind":"spending","budgeted":true,"current_paise":12000,
                 "plan_to_date_paise":10000,"actual_to_date_paise":10000}',
               90,false
             ) as full,
             private.expense_budget_warning_row(
               '{"kind":"spending","budgeted":true,"current_paise":12000,
                 "plan_to_date_paise":10000,"actual_to_date_paise":10001}',
               90,false
             ) as over,
             private.expense_budget_warning_row(
               '{"kind":"spending","budgeted":true,"current_paise":999999999999999,
                 "plan_to_date_paise":100,
                 "actual_to_date_paise":9007199254740991}',
               90,false
             ) as extreme`,
        );
        return result.rows[0]!;
      });
      expect(boundary.below).toMatchObject({ warning: 'on_track' });
      expect(boundary.watch).toMatchObject({ warning: 'watch' });
      expect(boundary.full).toMatchObject({ warning: 'watch' });
      expect(boundary.over).toMatchObject({ warning: 'over_plan' });
      expect(boundary.extreme).toMatchObject({ warning: 'over_plan' });
      expect(Number.isFinite(boundary.extreme.burn_rate_bp as number)).toBe(
        true,
      );

      for (const [categoryId, amount, trace] of [
        [fixture.repairs, 7200, 'budget-warning-repairs'],
        [fixture.power, 17600, 'budget-warning-power'],
      ] as const) {
        await database.asRole(
          'authenticated',
          { sub: admin },
          (client) =>
            client.query(
              `select public.expense_record(
                 $1,$2,$3,'2026-11-10','Budget warning actual',$4,
                 'bank',null,null,null,$5,$6
               )`,
              [
                fixture.society,
                fixture.account,
                categoryId,
                amount,
                crypto.randomUUID(),
                trace,
              ],
            ),
          { commit: true },
        );
      }

      const report = budgetReportSchema.parse(
        await database.asRole(
          'authenticated',
          { sub: committee },
          async (client) =>
            (
              await client.query<{ report: unknown }>(
                'select public.expense_budget_report($1,2026,$2) as report',
                [fixture.society, '2026-11-23'],
              )
            ).rows[0]!.report,
        ),
      );
      expect(report.approved).toBe(true);
      expect(report.months).toHaveLength(12);
      expect(report.cash_flow).toHaveLength(12);
      expect(
        report.summary.find((row) => row.category_id === fixture.repairs),
      ).toMatchObject({
        current_paise: 18000,
        actual_to_date_paise: 7200,
        burn_rate_bp: 9000,
        warning: 'watch',
        projected_year_end_paise: 16200,
        projected_overrun_paise: null,
        projection_available: true,
      });
      expect(
        report.summary.find((row) => row.category_id === fixture.power),
      ).toMatchObject({
        burn_rate_bp: 11000,
        warning: 'over_plan',
        projected_year_end_paise: 26400,
        projected_overrun_paise: 2400,
        projection_available: true,
      });
      expect(
        report.summary.find((row) => row.category_id === fixture.future),
      ).toMatchObject({
        burn_rate_bp: null,
        warning: null,
        projected_year_end_paise: null,
        projected_overrun_paise: null,
        projection_available: false,
      });

      const residentSummary = residentSummarySchema.parse(
        await database.asRole(
          'authenticated',
          { sub: resident },
          async (client) =>
            (
              await client.query<{ summary: unknown }>(
                `select public.expense_budget_resident_summary(
                   $1,2026
                 ) as summary`,
                [fixture.society],
              )
            ).rows[0]!.summary,
        ),
      );
      expect(residentSummary.shared).toBe(true);
      expect(residentSummary.rows.length).toBeGreaterThanOrEqual(16);

      const settingsUpdatedAt = approved.budget
        ? (approved.settings.updated_at as string)
        : null;
      expect(settingsUpdatedAt).not.toBeNull();
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_budget_settings_update(
               $1,'average_3_months',90,false,$2,$3
             )`,
            [fixture.society, settingsUpdatedAt, 'budget-settings'],
          ),
        { commit: true },
      );
      const hiddenSummary = residentSummarySchema.parse(
        await database.asRole(
          'authenticated',
          { sub: resident },
          async (client) =>
            (
              await client.query<{ summary: unknown }>(
                'select public.expense_budget_resident_summary($1,2026) as summary',
                [fixture.society],
              )
            ).rows[0]!.summary,
        ),
      );
      expect(hiddenSummary.shared).toBe(false);
      expect(hiddenSummary.rows).toEqual([]);

      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_income_record(
               $1,$2,'2025-05-10','donation','Synthetic donor',
               100000,null,null,$3,$4
             )`,
            [
              fixture.society,
              fixture.account,
              crypto.randomUUID(),
              'budget-copy-income',
            ],
          ),
        { commit: true },
      );
      const preview = copyPreviewSchema.parse(
        await database.asRole(
          'authenticated',
          { sub: committee },
          async (client) =>
            (
              await client.query<{ preview: unknown }>(
                'select public.expense_budget_copy_preview($1,2026,750) as preview',
                [fixture.society],
              )
            ).rows[0]!.preview,
        ),
      );
      expect(
        preview.lines.find((line) => line.income_type === 'donation')
          ?.annual_paise,
      ).toBe(107500);
    } finally {
      await database.drop();
    }
  });
});
