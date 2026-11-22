// Verify P41 statements, audit tracking, AGM drafts, tenant isolation and roles.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
import {
  expenseAgmDraftSchema,
  expenseAuditSchema,
  expenseFinancialPositionSchema,
  expenseMultiYearSchema,
  expenseStatementsSchema,
} from '../../src/core/expense/validation';

describe.skipIf(!hasDatabase)('database expense financial reports', () => {
  it('keeps read-only statements authoritative and audit/AGM edits permanent', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(client, `p41-${role}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `p41-${role}@example.test`, `P41 ${role}`],
          );
          users.set(role, id);
        }
        const societies = await client.query<{ id: string }>(
          `insert into public.societies(name,created_by)
           values('P41 Society A',$1),('P41 Society B',$1) returning id`,
          [users.get('admin')],
        );
        const societyA = societies.rows[0]!.id;
        const societyB = societies.rows[1]!.id;
        for (const role of ['admin', 'committee', 'resident']) {
          await client.query(
            `insert into public.memberships(society_id,user_id,roles,status)
             values($1,$2,$3,'active')`,
            [societyA, users.get(role), [role]],
          );
        }
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array['admin']::text[],'active')`,
          [societyB, users.get('admin')],
        );
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled,settings)
           values($1,'core',true,'{}'),($1,'expense',true,'{}'),
                  ($2,'core',true,'{}'),($2,'expense',true,'{}')`,
          [societyA, societyB],
        );
        const accounts = await client.query<{
          id: string;
          account_type: string;
        }>(
          `insert into public.expense_accounts(
             society_id,name,account_type,opening_balance_paise,opening_on,created_by
           ) values
             ($1,'Cash','cash',100000,'2026-04-01',$2),
             ($1,'Primary bank','bank',200000,'2026-04-01',$2),
             ($1,'Deposit account','deposit',50000,'2026-06-01',$2)
           returning id,account_type`,
          [societyA, users.get('admin')],
        );
        const category = (
          await client.query<{ id: string }>(
            `insert into public.expense_categories(society_id,name,created_by)
             values($1,'P41 test repairs',$2) returning id`,
            [societyA, users.get('admin')],
          )
        ).rows[0]!.id;
        const today = (
          await client.query<{ today: string }>(
            'select private.housekeeping_local_date($1)::text as today',
            [societyA],
          )
        ).rows[0]!.today;
        return {
          societyA,
          societyB,
          users,
          today,
          cashId: accounts.rows.find(
            (account) => account.account_type === 'cash',
          )!.id,
          bankId: accounts.rows.find(
            (account) => account.account_type === 'bank',
          )!.id,
          depositId: accounts.rows.find(
            (account) => account.account_type === 'deposit',
          )!.id,
          category,
        };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const resident = fixture.users.get('resident')!;

      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_income_record(
               $1,$2,$3,'donation',$4,$5,null,null,$6,$7
             )`,
            [
              fixture.societyA,
              fixture.bankId,
              '2026-05-10',
              'Synthetic payer',
              30000,
              crypto.randomUUID(),
              'p41-income',
            ],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_record(
               $1,$2,$3,'2026-05-15',$4,$5,'bank',null,null,null,$6,$7
             )`,
            [
              fixture.societyA,
              fixture.bankId,
              fixture.category,
              'Synthetic repair',
              20000,
              crypto.randomUUID(),
              'p41-expense',
            ],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_transfer_record(
               $1,$2,$3,'2026-06-10',10000,null,null,$4,$5
             )`,
            [
              fixture.societyA,
              fixture.bankId,
              fixture.depositId,
              crypto.randomUUID(),
              'p41-transfer',
            ],
          ),
        { commit: true },
      );

      const statement = await database.asRole(
        'authenticated',
        { sub: committee },
        async (client) => {
          const result = await client.query<{
            report: Record<string, unknown>;
          }>('select public.expense_statements($1,$2,$3) as report', [
            fixture.societyA,
            '2026-04-01',
            '2026-06-30',
          ]);
          return result.rows[0]!.report;
        },
      );
      expect(statement).toMatchObject({
        opening_money_paise: 0,
        accounts_added_opening_paise: 350000,
        receipts_paise: 30000,
        payments_paise: 20000,
        closing_money_paise: 360000,
        identity_matches: true,
      });
      expenseStatementsSchema.parse(statement);
      const position = await database.asRole(
        'authenticated',
        { sub: committee },
        async (client) =>
          (
            await client.query<{ report: unknown }>(
              'select public.expense_financial_position($1,$2) as report',
              [fixture.societyA, fixture.today],
            )
          ).rows[0]!.report,
      );
      const parsedPosition = expenseFinancialPositionSchema.parse(position);
      expect(parsedPosition.accounts).toHaveLength(2);
      expect(parsedPosition.accounts_total_paise).toBe(300000);
      const comparison = await database.asRole(
        'authenticated',
        { sub: committee },
        async (client) =>
          (
            await client.query<{ report: unknown }>(
              'select public.expense_multi_year($1) as report',
              [fixture.societyA],
            )
          ).rows[0]!.report,
      );
      expenseMultiYearSchema.parse(comparison);
      expect(
        await dbError(
          database.asRole('authenticated', { sub: resident }, (client) =>
            client.query('select public.expense_statements($1,$2,$3)', [
              fixture.societyA,
              '2026-04-01',
              '2026-06-30',
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      expect(
        await dbError(
          database.asRole('authenticated', { sub: committee }, (client) =>
            client.query('select public.expense_statements($1,$2,$3)', [
              fixture.societyB,
              '2026-04-01',
              '2026-06-30',
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });

      expect(
        await dbError(
          database.asRole('authenticated', { sub: committee }, (client) =>
            client.query(
              'select public.expense_audit_warning_acknowledge($1,true,$2,$3)',
              [fixture.societyA, crypto.randomUUID(), 'p41-committee-ack'],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      const ackId = crypto.randomUUID();
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            'select public.expense_audit_warning_acknowledge($1,true,$2,$3)',
            [fixture.societyA, ackId, 'p41-ack'],
          ),
        { commit: true },
      );
      const yearRequest = crypto.randomUUID();
      const yearId = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.expense_audit_year_save(
               $1,null,'2026-04-01','Synthetic Auditor','Synthetic Firm',
               '2026-04-20','AGM/2026/1',null,null,null,null,null,null,null,$2,$3
             ) as id`,
            [fixture.societyA, yearRequest, 'p41-year'],
          );
          return result.rows[0]!.id;
        },
        { commit: true },
      );
      const repeatYearId = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.expense_audit_year_save(
               $1,null,'2026-04-01','Synthetic Auditor','Synthetic Firm',
               '2026-04-20','AGM/2026/1',null,null,null,null,null,null,null,$2,$3
             ) as id`,
            [fixture.societyA, yearRequest, 'p41-year-repeat'],
          );
          return result.rows[0]!.id;
        },
        { commit: true },
      );
      expect(repeatYearId).toBe(yearId);

      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_audit_query_save(
             $1,null,$2,1,'2026-05-01','Repairs','Show source proof',$3,
             '2026-05-20',null,null,null,$4,$5
           )`,
            [
              fixture.societyA,
              yearId,
              committee,
              crypto.randomUUID(),
              'p41-query',
            ],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_audit_objection_save(
             $1,null,$2,'Opening balance needs review',$3,'2026-05-30',
             'Reviewed against bank statement','2026-05-28',null,null,$4,$5
           )`,
            [
              fixture.societyA,
              yearId,
              committee,
              crypto.randomUUID(),
              'p41-objection',
            ],
          ),
        { commit: true },
      );
      const draftId = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.expense_agm_draft_save(
               $1,null,'2026-04-01',$2::jsonb,null,$3,$4
             ) as id`,
            [
              fixture.societyA,
              JSON.stringify([
                { title: 'Treasurer note', body: 'Synthetic draft note.' },
              ]),
              crypto.randomUUID(),
              'p41-agm-draft',
            ],
          );
          return result.rows[0]!.id;
        },
        { commit: true },
      );
      expect(draftId).toMatch(/^[0-9a-f-]{36}$/);

      const audit = await database.asRole(
        'authenticated',
        { sub: committee },
        async (client) => {
          const result = await client.query<{
            report: Record<string, unknown>;
          }>('select public.expense_audit_get($1,$2) as report', [
            fixture.societyA,
            '2026-04-01',
          ]);
          return result.rows[0]!.report as {
            queries: unknown[];
            objections: unknown[];
            revisions: unknown[];
            checks: unknown[];
          };
        },
      );
      expect(audit.queries).toHaveLength(1);
      expect(audit.objections).toHaveLength(1);
      expect(audit.revisions).toHaveLength(3);
      expect(audit.checks).toHaveLength(4);
      expenseAuditSchema.parse(audit);
      const agm = await database.asRole(
        'authenticated',
        { sub: committee },
        async (client) =>
          (
            await client.query<{ report: unknown }>(
              'select public.expense_agm_draft($1,$2) as report',
              [fixture.societyA, '2026-04-01'],
            )
          ).rows[0]!.report,
      );
      expenseAgmDraftSchema.parse(agm);
      expect(
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              'delete from public.expense_audit_years where society_id=$1',
              [fixture.societyA],
            ),
          ),
        ),
      ).toMatchObject({ code: '55000' });
      for (const table of [
        'expense_audit_acknowledgements',
        'expense_audit_years',
        'expense_audit_queries',
        'expense_audit_objections',
        'expense_audit_revisions',
        'expense_agm_drafts',
      ]) {
        expect(
          await dbError(
            database.asRole('authenticated', { sub: admin }, (client) =>
              client.query(`select * from public.${table}`),
            ),
          ),
        ).not.toBeNull();
      }
    } finally {
      await database.drop();
    }
  });
});
