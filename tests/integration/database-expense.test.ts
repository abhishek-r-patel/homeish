// Verify P16 expense storage, approvals, append-only books, month close and billing income,
// and P39 vouchers, running balances, net flow, bank reconciliation and petty cash.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database expense foundation', () => {
  it('enforces tenant keys, draft constraints and denies every API role direct access', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const userId = await newAuthUser(client, 'expense-admin@example.test');
        await client.query(
          `insert into public.profiles(id,email,full_name)
           values($1,'expense-admin@example.test','Synthetic Expense Admin')`,
          [userId],
        );
        const societies = await client.query<{ id: string }>(
          `insert into public.societies(name,created_by)
           values('Expense Society A',$1),('Expense Society B',$1) returning id`,
          [userId],
        );
        const societyA = societies.rows[0]!.id;
        const societyB = societies.rows[1]!.id;
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array['admin']::text[],'active')`,
          [societyA, userId],
        );
        const accounts = await client.query<{ id: string; society_id: string }>(
          `insert into public.expense_accounts(
            society_id,name,account_type,opening_balance_paise,opening_on,created_by
          ) values($1,'Cash','cash',100000,'2026-04-01',$3),
                  ($1,'Primary bank','bank',200000,'2026-04-01',$3),
                  ($1,'Second bank','bank',0,'2026-04-01',$3),
                  ($2,'Other society bank','bank',0,'2026-04-01',$3)
          returning id,society_id`,
          [societyA, societyB, userId],
        );
        const categories = await client.query<{
          id: string;
          society_id: string;
        }>(
          `insert into public.expense_categories(society_id,name,created_by)
           values($1,'Repairs',$3),($2,'Repairs',$3) returning id,society_id`,
          [societyA, societyB, userId],
        );
        return {
          userId,
          societyA,
          societyB,
          accountA: accounts.rows.find(
            ({ society_id }) => society_id === societyA,
          )!.id,
          accountB: accounts.rows.find(
            ({ society_id }) => society_id === societyB,
          )!.id,
          categoryA: categories.rows.find(
            ({ society_id }) => society_id === societyA,
          )!.id,
          categoryB: categories.rows.find(
            ({ society_id }) => society_id === societyB,
          )!.id,
        };
      });
      const createDraft = (
        accountId: string,
        categoryId: string,
        amount: number,
        requestId = crypto.randomUUID(),
      ) =>
        database.asSuperuser((client) =>
          client.query(
            `insert into public.expenses(
          society_id,account_id,category_id,spent_on,payee,amount_paise,
          payment_mode,approval_required,status,client_request_id,created_by
        ) values($1,$2,$3,'2026-11-15','Synthetic Vendor',$4,'cash',false,'posted',$5,$6)`,
            [
              fixture.societyA,
              accountId,
              categoryId,
              amount,
              requestId,
              fixture.userId,
            ],
          ),
        );
      const requestId = crypto.randomUUID();
      await createDraft(fixture.accountA, fixture.categoryA, 12500, requestId);
      expect(
        await dbError(
          createDraft(fixture.accountA, fixture.categoryA, 12500, requestId),
        ),
      ).toMatchObject({ code: '23505' });
      expect(
        await dbError(createDraft(fixture.accountB, fixture.categoryA, 12500)),
      ).toMatchObject({ code: '23503' });
      expect(
        await dbError(createDraft(fixture.accountA, fixture.categoryB, 12500)),
      ).toMatchObject({ code: '23503' });
      expect(
        await dbError(createDraft(fixture.accountA, fixture.categoryA, 0)),
      ).toMatchObject({ code: '23514' });
      expect(
        await dbError(createDraft(fixture.accountA, fixture.categoryA, -1)),
      ).toMatchObject({ code: '23514' });
      expect(
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              `insert into public.expense_accounts(
          society_id,name,account_type,opening_on,created_by
        ) values($1,'Second cash','cash','2026-04-01',$2)`,
              [fixture.societyA, fixture.userId],
            ),
          ),
        ),
      ).toMatchObject({ code: '23505' });
      expect(
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              `insert into public.expense_categories(society_id,name,created_by)
         values($1,'repairs',$2)`,
              [fixture.societyA, fixture.userId],
            ),
          ),
        ),
      ).toMatchObject({ code: '23505' });

      for (const role of ['anon', 'authenticated', 'service_role'] as const) {
        for (const table of [
          'expense_accounts',
          'expense_categories',
          'expenses',
          'expense_book_entries',
          'expense_month_locks',
          'expense_funds',
          'expense_fund_openings',
          'expense_fund_opening_allocations',
          'expense_fund_mappings',
          'expense_fund_entry_allocations',
          'expense_fixed_deposits',
          'expense_fund_interest_records',
          'expense_fund_transfer_rules',
          'expense_fund_transfers',
          'expense_fund_corpus_records',
          'expense_fund_receipt_links',
          'expense_fund_works',
          'expense_fund_work_links',
        ]) {
          expect(
            await dbError(
              database.asRole(role, { sub: fixture.userId }, (client) =>
                client.query(`select * from public.${table}`),
              ),
            ),
          ).toMatchObject({ code: '42501' });
          expect(
            await dbError(
              database.asRole(role, { sub: fixture.userId }, (client) =>
                client.query(`delete from public.${table} where false`),
              ),
            ),
          ).toMatchObject({ code: '42501' });
        }
      }
    } finally {
      await database.drop();
    }
  });

  it('sets up and activates society funds from a closed, non-negative Accounts opening', async () => {
    const db = await createTestDatabase();
    try {
      const fixture = await db.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        const roles: Record<string, string[]> = {
          admin: ['admin'],
          committee: ['committee'],
          resident: ['resident'],
        };
        for (const [key, allowed] of Object.entries(roles)) {
          const userId = await newAuthUser(client, `fund-${key}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [userId, `fund-${key}@example.test`, `Fund ${key}`],
          );
          users.set(key, userId);
          void allowed;
        }
        const societies = await client.query<{ id: string }>(
          "insert into public.societies(name,created_by) values('Fund Society A',$1),('Fund Society B',$1) returning id",
          [users.get('admin')],
        );
        const societyA = societies.rows[0]!.id;
        const societyB = societies.rows[1]!.id;
        for (const [key, allowed] of Object.entries(roles)) {
          await client.query(
            "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,$3,'active')",
            [societyA, users.get(key), allowed],
          );
        }
        await client.query(
          "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,array['admin']::text[],'active')",
          [societyB, users.get('admin')],
        );
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled,settings)
           values($1,'core',true,'{}'),($1,'expense',true,'{}'),
                  ($2,'core',true,'{}'),($2,'expense',true,'{}')`,
          [societyA, societyB],
        );
        const accountA = (
          await client.query<{ id: string }>(
            `insert into public.expense_accounts(
               society_id,name,account_type,opening_balance_paise,opening_on,created_by
             ) values($1,'Fund bank','bank',100000,$2,$3) returning id`,
            [
              societyA,
              (
                await client.query<{ previous_month: string }>(
                  `select (date_trunc('month', private.housekeeping_local_date($1))
                    - interval '1 month')::date::text as previous_month`,
                  [societyA],
                )
              ).rows[0]!.previous_month,
              users.get('admin'),
            ],
          )
        ).rows[0]!.id;
        const dates = (
          await client.query<{
            today: string;
            month_start: string;
            previous_month: string;
          }>(
            `select private.housekeeping_local_date($1)::text as today,
              date_trunc('month', private.housekeeping_local_date($1))::date::text as month_start,
              (date_trunc('month', private.housekeeping_local_date($1))
                - interval '1 month')::date::text as previous_month`,
            [societyA],
          )
        ).rows[0]!;
        const accountB = (
          await client.query<{ id: string }>(
            `insert into public.expense_accounts(
               society_id,name,account_type,opening_balance_paise,opening_on,created_by
             ) values($1,'Overdrawn bank','bank',-10000,$2,$3) returning id`,
            [societyB, dates.previous_month, users.get('admin')],
          )
        ).rows[0]!.id;
        const unitA = (
          await client.query<{ id: string }>(
            "insert into public.units(society_id,number,created_by) values($1,'F-101',$2) returning id",
            [societyA, users.get('admin')],
          )
        ).rows[0]!.id;
        return {
          users,
          societyA,
          societyB,
          accountA,
          accountB,
          unitA,
          ...dates,
        };
      });
      const as = <T>(
        key: string,
        query: Parameters<typeof db.asSuperuser<T>>[0],
        commit = true,
      ) =>
        db.asRole('authenticated', { sub: fixture.users.get(key)! }, query, {
          commit,
        });
      const call = async <T = unknown>(
        key: string,
        sql: string,
        params: unknown[] = [],
      ) =>
        (
          await as(key, (client) =>
            client.query<{ result: T }>(`select ${sql} as result`, params),
          )
        ).rows[0]!.result;
      const code = async (promise: Promise<unknown>) =>
        (await dbError(promise)).code;
      const saveFund = (
        key: string,
        society: string,
        name: string,
        fundId: string | null = null,
        active = true,
        updatedAt: string | null = null,
      ) =>
        call<string>(
          key,
          "public.expense_fund_save($1,$2,$3,$4,$5,'fund-test')",
          [society, fundId, name, active, updatedAt],
        );
      const activate = (
        key: string,
        society: string,
        cutover: string,
        allocations: { fund_id: string; amount_paise: number }[],
        acknowledged: boolean,
        requestId = crypto.randomUUID(),
      ) =>
        call<string>(
          key,
          "public.expense_funds_activate($1,$2,$3::jsonb,$4,$5,'fund-test')",
          [
            society,
            cutover,
            JSON.stringify(allocations),
            acknowledged,
            requestId,
          ],
        );

      const reserve = await saveFund('admin', fixture.societyA, 'Reserve fund');
      const operationsFund = await saveFund(
        'admin',
        fixture.societyA,
        'Operations fund',
      );
      const billingCharges = await db.asSuperuser(async (client) => {
        const result = await client.query<{ id: string; name: string }>(
          `insert into public.billing_charge_types(
             society_id,name,method,amount_paise,active,created_by,updated_by
           ) values($1,'Maintenance','fixed',6001,true,$2,$2),
                    ($1,'Repairs','fixed',3999,true,$2,$2)
           returning id,name`,
          [fixture.societyA, fixture.users.get('admin')],
        );
        return result.rows;
      });
      await call(
        'admin',
        "public.expense_fund_mapping_save($1,'billing_charge',$2,null,$3,null,'fund-test')",
        [fixture.societyA, billingCharges[0]!.id, reserve],
      );
      await call(
        'admin',
        "public.expense_fund_mapping_save($1,'billing_charge',$2,null,$3,null,'fund-test')",
        [fixture.societyA, billingCharges[1]!.id, operationsFund],
      );
      const billingBreakdown = await call<{
        months: number;
        funds: { fund_id: string | null; preview_paise: string }[];
      }>(
        'admin',
        'public.expense_billing_estimate_breakdown($1,$2::jsonb,12)',
        [
          fixture.societyA,
          JSON.stringify([
            { charge_type_id: billingCharges[0]!.id, amount_paise: 6001 },
            { charge_type_id: billingCharges[1]!.id, amount_paise: 3999 },
          ]),
        ],
      );
      expect(billingBreakdown.months).toBe(12);
      expect(
        Object.fromEntries(
          billingBreakdown.funds.map(({ fund_id, preview_paise }) => [
            fund_id,
            preview_paise,
          ]),
        ),
      ).toEqual({
        [reserve]: '72012',
        [operationsFund]: '47988',
      });
      const otherFund = await saveFund(
        'admin',
        fixture.societyB,
        'Other reserve',
      );
      expect(await saveFund('admin', fixture.societyA, 'Reserve fund')).toBe(
        reserve,
      );
      expect(
        await code(saveFund('committee', fixture.societyA, 'Committee fund')),
      ).toBe('42501');
      for (const role of ['anon', 'authenticated', 'service_role'] as const) {
        for (const table of [
          'expense_funds',
          'expense_fund_openings',
          'expense_fund_opening_allocations',
        ]) {
          expect(
            await dbError(
              db.asRole(role, { sub: fixture.users.get('admin') }, (client) =>
                client.query(`select * from public.${table}`),
              ),
            ),
          ).toMatchObject({ code: '42501' });
        }
      }
      expect(
        await code(
          call('resident', 'public.expense_funds_workspace($1,null)', [
            fixture.societyA,
          ]),
        ),
      ).toBe('42501');
      const readable = await call<{
        can_manage: boolean;
        funds: { id: string }[];
      }>('committee', 'public.expense_funds_workspace($1,null)', [
        fixture.societyA,
      ]);
      expect(readable).toMatchObject({
        can_manage: false,
      });
      expect(readable.funds.some(({ id }) => id === reserve)).toBe(true);

      await call(
        'admin',
        "public.expense_income_record($1,$2,$3,'donation','Synthetic member',5000,null,null,$4,'fund-test')",
        [
          fixture.societyA,
          fixture.accountA,
          fixture.previous_month,
          crypto.randomUUID(),
        ],
      );
      const beforeClose = await call<{
        eligible_cutovers: string[];
        preview: null;
      }>('admin', 'public.expense_funds_workspace($1,$2)', [
        fixture.societyA,
        fixture.month_start,
      ]);
      expect(beforeClose).toMatchObject({
        eligible_cutovers: [],
        preview: null,
      });
      expect(
        await code(
          activate(
            'admin',
            fixture.societyA,
            fixture.month_start,
            [{ fund_id: reserve, amount_paise: 40000 }],
            true,
          ),
        ),
      ).toBe('23514');
      await call('admin', "public.expense_month_close($1,$2,'fund-test')", [
        fixture.societyA,
        fixture.previous_month,
      ]);
      const preview = await call<{
        preview: {
          accounts_total_paise: number;
          previous_month_closed: boolean;
        };
      }>('admin', 'public.expense_funds_workspace($1,$2)', [
        fixture.societyA,
        fixture.month_start,
      ]);
      expect(preview.preview).toEqual({
        cutover_on: fixture.month_start,
        as_of: new Date(
          new Date(`${fixture.month_start}T00:00:00Z`).getTime() - 86_400_000,
        )
          .toISOString()
          .slice(0, 10),
        accounts_total_paise: 105000,
        previous_month_closed: true,
      });
      expect(
        await code(
          activate(
            'admin',
            fixture.societyA,
            `${fixture.month_start.slice(0, 8)}02`,
            [{ fund_id: reserve, amount_paise: 40000 }],
            true,
          ),
        ),
      ).toBe('22023');
      expect(
        await code(
          activate(
            'admin',
            fixture.societyA,
            fixture.month_start,
            [{ fund_id: reserve, amount_paise: 40000 }],
            false,
          ),
        ),
      ).toBe('22023');
      expect(
        await code(
          activate(
            'admin',
            fixture.societyA,
            fixture.month_start,
            [{ fund_id: otherFund, amount_paise: 0 }],
            true,
          ),
        ),
      ).toBe('22023');
      expect(
        await code(
          activate(
            'admin',
            fixture.societyA,
            fixture.month_start,
            [{ fund_id: reserve, amount_paise: 105001 }],
            true,
          ),
        ),
      ).toBe('23514');

      const activationRequest = crypto.randomUUID();
      const allocations = [{ fund_id: reserve, amount_paise: 40000 }];
      const activated = await Promise.all([
        activate(
          'admin',
          fixture.societyA,
          fixture.month_start,
          allocations,
          true,
          activationRequest,
        ),
        activate(
          'admin',
          fixture.societyA,
          fixture.month_start,
          allocations,
          true,
          activationRequest,
        ),
      ]);
      expect(activated[0]).toBe(activated[1]);
      expect(
        await activate(
          'admin',
          fixture.societyA,
          fixture.month_start,
          allocations,
          true,
          activationRequest,
        ),
      ).toBe(activated[0]);
      const incomeEntry = await call<string>(
        'admin',
        "public.expense_income_record($1,$2,$3,'donation','Synthetic member',10000,null,null,$4,'fund-test')",
        [
          fixture.societyA,
          fixture.accountA,
          fixture.month_start,
          crypto.randomUUID(),
        ],
      );
      const opening = await call<{
        opening: {
          accounts_total_paise: number;
          allocated_total_paise: number;
          unallocated_paise: number;
        };
      }>('admin', 'public.expense_funds_workspace($1,null)', [
        fixture.societyA,
      ]);
      expect(opening.opening).toMatchObject({
        accounts_total_paise: 105000,
        allocated_total_paise: 40000,
        unallocated_paise: 65000,
      });
      await call(
        'admin',
        "public.expense_fund_mapping_save($1,'income_kind',null,'donation',$2,null,'fund-test')",
        [fixture.societyA, reserve],
      );
      const unconfirmed = await call<{
        balances: { fund_id: string; balance_paise: number }[];
        unallocated_paise: number;
        entries: {
          entry_id: string;
          suggested_fund_id: string | null;
          allocations: unknown[];
        }[];
      }>('admin', 'public.expense_funds_activity($1,50,0)', [fixture.societyA]);
      expect(unconfirmed.unallocated_paise).toBe(75000);
      expect(
        unconfirmed.balances.find(({ fund_id }) => fund_id === reserve),
      ).toMatchObject({ balance_paise: 40000 });
      expect(
        unconfirmed.entries.find(({ entry_id }) => entry_id === incomeEntry),
      ).toMatchObject({ suggested_fund_id: reserve, allocations: [] });
      const confirmationItems = [
        {
          entry_id: incomeEntry,
          allocations: [
            { fund_id: reserve, amount_paise: 6000 },
            { fund_id: null, amount_paise: 4000 },
          ],
        },
      ];
      const allocationResult = await call<{
        confirmed_count: number;
        skipped: unknown[];
      }>(
        'admin',
        "public.expense_fund_allocations_confirm($1,$2::jsonb,$3,'fund-test')",
        [
          fixture.societyA,
          JSON.stringify([
            {
              entry_id: incomeEntry,
              allocations: [{ fund_id: reserve, amount_paise: 9000 }],
            },
          ]),
          crypto.randomUUID(),
        ],
      ).then(
        (value) => value,
        (error) => {
          expect((error as { code?: string }).code).toBe('23514');
          return null;
        },
      );
      expect(allocationResult).toBeNull();
      const allocationRows = await db.asSuperuser((client) =>
        client.query(
          'select count(*)::integer as count from public.expense_fund_entry_allocations where entry_id=$1',
          [incomeEntry],
        ),
      );
      expect(allocationRows.rows[0]!.count).toBe(0);
      const allocationRequest = crypto.randomUUID();
      const confirmed = await call<{
        confirmed_count: number;
        skipped: unknown[];
      }>(
        'admin',
        "public.expense_fund_allocations_confirm($1,$2::jsonb,$3,'fund-test')",
        [
          fixture.societyA,
          JSON.stringify(confirmationItems),
          allocationRequest,
        ],
      );
      expect(confirmed).toEqual({ confirmed_count: 1, skipped: [] });
      expect(
        await call(
          'admin',
          "public.expense_fund_allocations_confirm($1,$2::jsonb,$3,'fund-test')",
          [
            fixture.societyA,
            JSON.stringify(confirmationItems),
            allocationRequest,
          ],
        ),
      ).toEqual(confirmed);
      const allocated = await call<{
        balances: { fund_id: string; balance_paise: number }[];
        unallocated_paise: number;
      }>('admin', 'public.expense_funds_activity($1,50,0)', [fixture.societyA]);
      expect(
        allocated.balances.find(({ fund_id }) => fund_id === reserve),
      ).toMatchObject({ balance_paise: 46000 });
      expect(allocated.unallocated_paise).toBe(69000);
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_allocations_confirm($1,$2::jsonb,$3,'fund-test')",
            [
              fixture.societyA,
              JSON.stringify(confirmationItems),
              crypto.randomUUID(),
            ],
          ),
        ),
      ).toBe('23505');
      const reversedIncome = await call<string>(
        'admin',
        "public.expense_entry_reverse($1,$2,$3,'Allocation test reversal',$4,'fund-test')",
        [fixture.societyA, incomeEntry, fixture.today, crypto.randomUUID()],
      );
      const reversalActivity = await call<{
        entries: {
          entry_id: string;
          allocations: { fund_id: string | null; amount_paise: number }[];
        }[];
        balances: { fund_id: string; balance_paise: number }[];
        unallocated_paise: number;
      }>('admin', 'public.expense_funds_activity($1,50,0)', [fixture.societyA]);
      expect(
        reversalActivity.entries.find(
          ({ entry_id }) => entry_id === reversedIncome,
        )?.allocations,
      ).toEqual([
        { fund_id: reserve, amount_paise: 6000, fund_name: 'Reserve fund' },
        { fund_id: null, amount_paise: 4000, fund_name: null },
      ]);
      expect(reversalActivity.unallocated_paise).toBe(65000);
      expect(
        reversalActivity.balances.find(({ fund_id }) => fund_id === reserve),
      ).toMatchObject({ balance_paise: 40000 });
      const correctionRequest = crypto.randomUUID();
      const correctionItems = [
        { fund_id: reserve, amount_paise: 3000 },
        { fund_id: null, amount_paise: 7000 },
      ];
      const correctionVersion = await call<string>(
        'admin',
        "public.expense_fund_allocation_correct($1,$2,$3::jsonb,'Reclassified donation',$4,'fund-test')",
        [
          fixture.societyA,
          incomeEntry,
          JSON.stringify(correctionItems),
          correctionRequest,
        ],
      );
      expect(
        await call(
          'admin',
          "public.expense_fund_allocation_correct($1,$2,$3::jsonb,'Reclassified donation',$4,'fund-test')",
          [
            fixture.societyA,
            incomeEntry,
            JSON.stringify(correctionItems),
            correctionRequest,
          ],
        ),
      ).toBe(correctionVersion);
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_allocation_correct($1,$2,$3::jsonb,'Wrong target',$4,'fund-test')",
            [
              fixture.societyA,
              reversedIncome,
              JSON.stringify(correctionItems),
              crypto.randomUUID(),
            ],
          ),
        ),
      ).toBe('22023');
      const correctedActivity = await call<{
        entries: {
          entry_id: string;
          allocations: { fund_id: string | null; amount_paise: number }[];
        }[];
      }>('admin', 'public.expense_funds_activity($1,50,0)', [fixture.societyA]);
      expect(
        correctedActivity.entries.find(
          ({ entry_id }) => entry_id === reversedIncome,
        )?.allocations,
      ).toEqual([
        { fund_id: reserve, amount_paise: 3000, fund_name: 'Reserve fund' },
        { fund_id: null, amount_paise: 7000, fund_name: null },
      ]);

      const closedEntry = await call<string>(
        'admin',
        "public.expense_income_record($1,$2,$3,'donation','Synthetic member',2000,null,null,$4,'fund-test')",
        [
          fixture.societyA,
          fixture.accountA,
          fixture.today,
          crypto.randomUUID(),
        ],
      );
      await db.asSuperuser((client) =>
        client.query(
          `insert into public.expense_month_locks(society_id,month,locked_by)
           values($1,$2,$3)`,
          [fixture.societyA, fixture.month_start, fixture.users.get('admin')],
        ),
      );
      const skipped = await call<{
        confirmed_count: number;
        skipped: unknown[];
      }>(
        'admin',
        "public.expense_fund_allocations_confirm($1,$2::jsonb,$3,'fund-test')",
        [
          fixture.societyA,
          JSON.stringify([
            {
              entry_id: closedEntry,
              allocations: [{ fund_id: reserve, amount_paise: 2000 }],
            },
          ]),
          crypto.randomUUID(),
        ],
      );
      expect(skipped).toEqual({
        confirmed_count: 0,
        skipped: [
          { entry_id: closedEntry, voucher: null, reason: 'month_closed' },
        ],
      });
      await call(
        'admin',
        "public.expense_month_reopen($1,$2,'P40 test completed','fund-test')",
        [fixture.societyA, fixture.month_start],
      ).then(
        () => undefined,
        () => undefined,
      );
      await call(
        'admin',
        "public.expense_month_reopen($1,$2,'Review opening','fund-test')",
        [fixture.societyA, fixture.previous_month],
      );
      await call(
        'admin',
        "public.expense_income_record($1,$2,$3,'donation','Backdated member',1000,null,null,$4,'fund-test')",
        [
          fixture.societyA,
          fixture.accountA,
          fixture.previous_month,
          crypto.randomUUID(),
        ],
      );
      const openingNeedsReview = await call<{
        opening: {
          review_required: boolean;
          review_reasons: string[];
          current_accounts_total_paise: number;
        };
      }>('admin', 'public.expense_funds_workspace($1,null)', [
        fixture.societyA,
      ]);
      expect(openingNeedsReview.opening).toMatchObject({
        review_required: true,
        current_accounts_total_paise: 106000,
      });
      expect(openingNeedsReview.opening.review_reasons).toEqual(
        expect.arrayContaining([
          'previous_month_reopened',
          'accounts_total_changed',
          'backdated_entry_added',
        ]),
      );
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_opening_correct($1,$2::jsonb,'Reconfirm corrected opening',$3,'fund-test')",
            [
              fixture.societyA,
              JSON.stringify([{ fund_id: reserve, amount_paise: 40000 }]),
              crypto.randomUUID(),
            ],
          ),
        ),
      ).toBe('23514');
      await call('admin', "public.expense_month_close($1,$2,'fund-test')", [
        fixture.societyA,
        fixture.previous_month,
      ]);
      const openingCorrection = crypto.randomUUID();
      const openingCorrectionVersion = await call<string>(
        'admin',
        "public.expense_fund_opening_correct($1,$2::jsonb,'Reconfirm corrected opening',$3,'fund-test')",
        [
          fixture.societyA,
          JSON.stringify([{ fund_id: reserve, amount_paise: 40000 }]),
          openingCorrection,
        ],
      );
      expect(
        await call(
          'admin',
          "public.expense_fund_opening_correct($1,$2::jsonb,'Reconfirm corrected opening',$3,'fund-test')",
          [
            fixture.societyA,
            JSON.stringify([{ fund_id: reserve, amount_paise: 40000 }]),
            openingCorrection,
          ],
        ),
      ).toBe(openingCorrectionVersion);
      const reviewedOpening = await call<{
        opening: {
          accounts_total_paise: number;
          review_required: boolean;
          review_reasons: string[];
        };
      }>('admin', 'public.expense_funds_workspace($1,null)', [
        fixture.societyA,
      ]);
      expect(reviewedOpening.opening).toMatchObject({
        accounts_total_paise: 106000,
        review_required: false,
        review_reasons: [],
      });
      const fundRule = await call<string>(
        'admin',
        "public.expense_fund_transfer_rule_save($1,null,$2,$3,true,null,'fund-test')",
        [fixture.societyA, reserve, operationsFund],
      );
      expect(fundRule).toBeTruthy();
      expect(
        await code(
          call(
            'committee',
            "public.expense_fund_transfer_rule_save($1,null,$2,$3,true,null,'fund-test')",
            [fixture.societyA, reserve, operationsFund],
          ),
        ),
      ).toBe('42501');
      const fundTransferItems = [
        fixture.societyA,
        reserve,
        operationsFund,
        fixture.today,
      ];
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_transfer_record($1,$2,$3,$4,50000,'Move reserve','Resolution-1',$5,'fund-test')",
            [...fundTransferItems, crypto.randomUUID()],
          ),
        ),
      ).toBe('23514');
      const fundTransferRequest = crypto.randomUUID();
      const fundTransfer = await call<string>(
        'admin',
        "public.expense_fund_transfer_record($1,$2,$3,$4,10000,'Move reserve','Resolution-1',$5,'fund-test')",
        [...fundTransferItems, fundTransferRequest],
      );
      expect(
        await call(
          'admin',
          "public.expense_fund_transfer_record($1,$2,$3,$4,10000,'Move reserve','Resolution-1',$5,'fund-test')",
          [...fundTransferItems, fundTransferRequest],
        ),
      ).toBe(fundTransfer);
      const transferBalances = await call<{
        balances: { fund_id: string; balance_paise: number }[];
      }>('admin', 'public.expense_funds_activity_transfers($1,50,0)', [
        fixture.societyA,
      ]);
      expect(
        transferBalances.balances.find(({ fund_id }) => fund_id === reserve),
      ).toMatchObject({ balance_paise: 30000 });
      expect(
        transferBalances.balances.find(
          ({ fund_id }) => fund_id === operationsFund,
        ),
      ).toMatchObject({ balance_paise: 10000 });
      const fundReverseRequest = crypto.randomUUID();
      const fundReversal = await call<string>(
        'admin',
        "public.expense_fund_transfer_reverse($1,$2,$3,'Reference mistake',$4,'fund-test')",
        [fixture.societyA, fundTransfer, fixture.today, fundReverseRequest],
      );
      expect(fundReversal).not.toBe(fundTransfer);
      expect(
        await call(
          'admin',
          "public.expense_fund_transfer_reverse($1,$2,$3,'Reference mistake',$4,'fund-test')",
          [fixture.societyA, fundTransfer, fixture.today, fundReverseRequest],
        ),
      ).toBe(fundReversal);
      const billingCollection = await db.asSuperuser(async (client) => {
        const bill = (
          await client.query<{ id: string }>(
            `insert into public.billing_bills(
               society_id,unit_id,title,period_start,due_date,total_paise,
               paid_paise,created_by
             ) values($1,$2,'November dues',$3,$4,10000,5003,$5)
             returning id`,
            [
              fixture.societyA,
              fixture.unitA,
              fixture.month_start,
              fixture.today,
              fixture.users.get('admin'),
            ],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.billing_bill_lines(
             society_id,bill_id,unit_id,period_start,charge_type_id,
             description,amount_paise,created_by
           ) values($1,$2,$3,$4,$5,'Maintenance',6001,$7),
                    ($1,$2,$3,$4,$6,'Repairs',3999,$7)`,
          [
            fixture.societyA,
            bill,
            fixture.unitA,
            fixture.month_start,
            billingCharges[0]!.id,
            billingCharges[1]!.id,
            fixture.users.get('admin'),
          ],
        );
        const payment = (
          await client.query<{ id: string }>(
            `insert into public.billing_payments(
               society_id,unit_id,amount_paise,mode,source,paid_on,status,
               submitted_by,confirmed_by,confirmed_at,receipt_no,
               client_request_id,created_by
             ) values($1,$2,5003,'cash','admin_recorded',$3,'confirmed',
               $4,$4,now(),'R-2026-000777',$5,$4) returning id`,
            [
              fixture.societyA,
              fixture.unitA,
              fixture.today,
              fixture.users.get('admin'),
              crypto.randomUUID(),
            ],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.billing_payment_allocations(
             society_id,payment_id,bill_id,unit_id,amount_paise
           ) values($1,$2,$3,$4,5003)`,
          [fixture.societyA, payment, bill, fixture.unitA],
        );
        const entry = (
          await client.query<{ id: string }>(
            `insert into public.expense_book_entries(
               society_id,account_id,entry_date,direction,amount_paise,
               source,billing_payment_id,counterparty,created_by
             ) values($1,$2,$3,'in',5003,'billing_payment',$4,
               'F-101', $5) returning id`,
            [
              fixture.societyA,
              fixture.accountA,
              fixture.today,
              payment,
              fixture.users.get('admin'),
            ],
          )
        ).rows[0]!.id;
        return { entry };
      });
      const billingSuggestions = await call<
        {
          entry_id: string;
          allocations: {
            fund_id: string | null;
            amount_paise: number;
          }[];
        }[]
      >('admin', 'public.expense_billing_collection_suggestions($1,200)', [
        fixture.societyA,
      ]);
      const billingAllocation = billingSuggestions.find(
        ({ entry_id }) => entry_id === billingCollection.entry,
      );
      expect(
        Object.fromEntries(
          billingAllocation!.allocations.map(({ fund_id, amount_paise }) => [
            fund_id ?? 'unallocated',
            amount_paise,
          ]),
        ),
      ).toEqual({
        [operationsFund]: 2000,
        [reserve]: 3002,
        unallocated: 1,
      });
      await call(
        'admin',
        "public.expense_fund_allocations_confirm($1,$2::jsonb,$3,'fund-test')",
        [
          fixture.societyA,
          JSON.stringify([
            {
              entry_id: billingCollection.entry,
              allocations: billingAllocation!.allocations.map(
                ({ fund_id, amount_paise }) => ({
                  fund_id,
                  amount_paise,
                }),
              ),
            },
          ]),
          crypto.randomUUID(),
        ],
      );
      const corpusRecord = await call<string>(
        'admin',
        `public.expense_fund_corpus_save(
          $1,null,$2,$3,'Membership corpus event',$4,10000,0,null,
          'Resolution-3',null,'fund-test'
        )`,
        [fixture.societyA, fixture.unitA, reserve, fixture.today],
      );
      const corpusReceiptRequest = crypto.randomUUID();
      await call(
        'admin',
        "public.expense_fund_receipt_link($1,$2,$3,3000,$4,'fund-test')",
        [
          fixture.societyA,
          corpusRecord,
          billingCollection.entry,
          corpusReceiptRequest,
        ],
      );
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_receipt_link($1,$2,$3,3,$4,'fund-test')",
            [
              fixture.societyA,
              corpusRecord,
              billingCollection.entry,
              crypto.randomUUID(),
            ],
          ),
        ),
      ).toBe('23514');
      await call(
        'admin',
        "public.expense_fund_receipt_link($1,$2,$3,2,$4,'fund-test')",
        [
          fixture.societyA,
          corpusRecord,
          billingCollection.entry,
          crypto.randomUUID(),
        ],
      );
      const corpusList = await call<{
        records: {
          id: string;
          linked_receipts_paise: number;
          remaining_paise: number;
        }[];
      }>('committee', 'public.expense_fund_corpus_list($1)', [
        fixture.societyA,
      ]);
      expect(
        corpusList.records.find(({ id }) => id === corpusRecord),
      ).toMatchObject({
        linked_receipts_paise: 3002,
        remaining_paise: 6998,
      });
      const corpusVersion = (
        await db.asSuperuser((client) =>
          client.query<{ updated_at: string }>(
            'select updated_at::text from public.expense_fund_corpus_records where id=$1',
            [corpusRecord],
          ),
        )
      ).rows[0]!.updated_at;
      expect(
        await code(
          call(
            'admin',
            `public.expense_fund_corpus_save(
              $1,$2,$3,$4,'Membership corpus event',$5,3000,0,null,
              'Resolution-3',$6,'fund-test'
            )`,
            [
              fixture.societyA,
              corpusRecord,
              fixture.unitA,
              reserve,
              fixture.today,
              corpusVersion,
            ],
          ),
        ),
      ).toBe('23514');
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_allocation_correct($1,$2,$3::jsonb,'Move linked receipt',$4,'fund-test')",
            [
              fixture.societyA,
              billingCollection.entry,
              JSON.stringify([
                {
                  fund_id: operationsFund,
                  amount_paise: 5002,
                },
                { fund_id: null, amount_paise: 1 },
              ]),
              crypto.randomUUID(),
            ],
          ),
        ),
      ).toBe('23514');
      const workCategory = await call<{
        categories: { id: string; name: string }[];
      }>('admin', 'public.expense_workspace($1)', [fixture.societyA]);
      const repairsCategory = workCategory.categories.find(
        ({ name }) => name === 'Repairs',
      )!.id;
      const workExpense = await call<{ id: string }>(
        'admin',
        `public.expense_record(
          $1,$2,$3,$4,'Lift vendor',5000,'bank',null,null,null,$5,'fund-test'
        )`,
        [
          fixture.societyA,
          fixture.accountA,
          repairsCategory,
          fixture.today,
          crypto.randomUUID(),
        ],
      );
      const workExpenseEntry = (
        await db.asSuperuser((client) =>
          client.query<{ id: string }>(
            'select id from public.expense_book_entries where expense_id=$1',
            [workExpense.id],
          ),
        )
      ).rows[0]!.id;
      await call(
        'admin',
        "public.expense_fund_allocations_confirm($1,$2::jsonb,$3,'fund-test')",
        [
          fixture.societyA,
          JSON.stringify([
            {
              entry_id: workExpenseEntry,
              allocations: [{ fund_id: reserve, amount_paise: 5000 }],
            },
          ]),
          crypto.randomUUID(),
        ],
      );
      const resolutionId = await db.asSuperuser(async (client) => {
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled,settings)
           values($1,'meeting',true,'{}')`,
          [fixture.societyA],
        );
        const meeting = (
          await client.query<{ id: string }>(
            `insert into public.meetings(
               society_id,meeting_type,status,title,client_request_id,created_by
             ) values($1,'committee','draft','Repair sanction','work-meeting',$2)
             returning id`,
            [fixture.societyA, fixture.users.get('admin')],
          )
        ).rows[0]!.id;
        const resolution = (
          await client.query<{ id: string }>(
            `insert into public.meeting_resolutions(
               society_id,meeting_id,position,title,outcome,created_by,updated_by
             ) values($1,$2,1,'Approve lift repair','passed',$3,$3)
             returning id`,
            [fixture.societyA, meeting, fixture.users.get('admin')],
          )
        ).rows[0]!.id;
        return resolution;
      });
      const sanctionedWork = await call<string>(
        'admin',
        `public.expense_fund_work_save(
          $1,null,$2,'Lift repair',20000,$3,null,$4,null,null,'fund-test'
        )`,
        [fixture.societyA, reserve, fixture.today, resolutionId],
      );
      const workLink = await call<string>(
        'admin',
        "public.expense_fund_work_link($1,$2,$3,5000,$4,'fund-test')",
        [
          fixture.societyA,
          sanctionedWork,
          workExpenseEntry,
          crypto.randomUUID(),
        ],
      );
      expect(workLink).toBeTruthy();
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_work_link($1,$2,$3,1,$4,'fund-test')",
            [
              fixture.societyA,
              sanctionedWork,
              workExpenseEntry,
              crypto.randomUUID(),
            ],
          ),
        ),
      ).toBe('23514');
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_allocation_correct($1,$2,$3::jsonb,'Move linked expense',$4,'fund-test')",
            [
              fixture.societyA,
              workExpenseEntry,
              JSON.stringify([{ fund_id: operationsFund, amount_paise: 5000 }]),
              crypto.randomUUID(),
            ],
          ),
        ),
      ).toBe('23514');
      const works = await call<{
        works: {
          id: string;
          utilized_paise: number;
          authority_status: string;
        }[];
      }>('committee', 'public.expense_fund_works_list($1)', [fixture.societyA]);
      expect(works.works.find(({ id }) => id === sanctionedWork)).toMatchObject(
        { utilized_paise: 5000, authority_status: 'current' },
      );
      await db.asSuperuser((client) =>
        client.query(
          `update public.meeting_resolutions
           set outcome='deferred',version=version+1,updated_by=$2
           where id=$1`,
          [resolutionId, fixture.users.get('admin')],
        ),
      );
      const changedWorks = await call<{
        works: { id: string; authority_status: string }[];
      }>('admin', 'public.expense_fund_works_list($1)', [fixture.societyA]);
      expect(
        changedWorks.works.find(({ id }) => id === sanctionedWork),
      ).toMatchObject({ authority_status: 'changed' });
      const fundReport = await call<{
        accounts_total_paise: number;
        named_funds_total_paise: number;
        unallocated_paise: number;
        funds: { months: unknown[] }[];
      }>('admin', 'public.expense_fund_report($1,$2,$3)', [
        fixture.societyA,
        fixture.previous_month,
        fixture.today,
      ]);
      expect(
        fundReport.named_funds_total_paise + fundReport.unallocated_paise,
      ).toBe(fundReport.accounts_total_paise);
      expect(fundReport.funds.every(({ months }) => months.length > 0)).toBe(
        true,
      );
      expect(
        await dbError(
          db.asSuperuser((client) =>
            client.query(
              'update public.expense_fund_openings set accounts_total_paise=0',
            ),
          ),
        ),
      ).toMatchObject({ code: '55000' });
      expect(
        await dbError(
          db.asSuperuser((client) =>
            client.query(
              'update public.expense_fund_entry_allocations set amount_paise=1',
            ),
          ),
        ),
      ).toMatchObject({ code: '55000' });
      expect(
        await dbError(
          db.asSuperuser((client) =>
            client.query('delete from public.expense_fund_opening_allocations'),
          ),
        ),
      ).toMatchObject({ code: '55000' });

      const savedFund = await call<{
        funds: { id: string; updated_at: string }[];
      }>('admin', 'public.expense_funds_workspace($1,null)', [
        fixture.societyA,
      ]);
      const fundVersion = savedFund.funds.find(
        ({ id }) => id === reserve,
      )!.updated_at;
      await saveFund(
        'admin',
        fixture.societyA,
        'Reserve fund',
        reserve,
        false,
        fundVersion,
      );
      expect(
        await code(
          call(
            'admin',
            "public.expense_fund_transfer_record($1,$2,$3,$4,100,'Inactive pair','Resolution-1',$5,'fund-test')",
            [
              fixture.societyA,
              reserve,
              operationsFund,
              fixture.today,
              crypto.randomUUID(),
            ],
          ),
        ),
      ).toBe('23514');
      await call('admin', "public.expense_month_close($1,$2,'fund-test')", [
        fixture.societyB,
        fixture.previous_month,
      ]);
      expect(
        await code(
          activate(
            'admin',
            fixture.societyB,
            fixture.month_start,
            [{ fund_id: otherFund, amount_paise: 0 }],
            true,
          ),
        ),
      ).toBe('23514');
      await db.asSuperuser(async (client) => {
        await client.query(
          `insert into public.expense_accounts(
             society_id,name,account_type,opening_balance_paise,opening_on,created_by
           ) values($1,'Large bank 1','bank',9007199254740991,$2,$3),
                    ($1,'Large bank 2','bank',9007199254740991,$2,$3)`,
          [
            fixture.societyB,
            fixture.previous_month,
            fixture.users.get('admin'),
          ],
        );
      });
      expect(
        await code(
          call('admin', 'public.expense_funds_workspace($1,$2)', [
            fixture.societyB,
            fixture.month_start,
          ]),
        ),
      ).toBe('22023');
      await db.asSuperuser((client) =>
        client.query(
          "update public.module_configs set enabled=false where society_id=$1 and module_key='expense'",
          [fixture.societyA],
        ),
      );
      expect(
        await code(
          call('admin', 'public.expense_funds_workspace($1,null)', [
            fixture.societyA,
          ]),
        ),
      ).toBe('42501');
    } finally {
      await db.drop();
    }
  });

  it('posts, approves, reverses, closes months and books billing income through RPCs only', async () => {
    const db = await createTestDatabase();
    try {
      const fixture = await db.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        const roles: Record<string, string[]> = {
          admin: ['admin'],
          chair: ['admin', 'committee'],
          committee: ['committee'],
          resident: ['resident'],
          guard: ['guard'],
        };
        for (const key of Object.keys(roles)) {
          const id = await newAuthUser(client, `expense-${key}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `expense-${key}@example.test`, `Expense ${key}`],
          );
          users.set(key, id);
        }
        const societies = await client.query<{ id: string }>(
          "insert into public.societies(name,created_by) values('Expense workflow A',$1),('Expense workflow B',$1) returning id",
          [users.get('admin')],
        );
        const societyId = societies.rows[0]!.id;
        const otherSocietyId = societies.rows[1]!.id;
        for (const [key, id] of users)
          await client.query(
            "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,$3,'active')",
            [societyId, id, roles[key]],
          );
        await client.query(
          "insert into public.module_configs(society_id,module_key,enabled,settings) values($1,'core',true,'{}'),($1,'billing',true,'{}'),($1,'expense',true,'{}'),($2,'core',true,'{}'),($2,'expense',true,'{}')",
          [societyId, otherSocietyId],
        );
        const dates = (
          await client.query<{
            today: string;
            month_start: string;
            previous_month: string;
          }>(
            `select private.housekeeping_local_date($1)::text as today,
              date_trunc('month', private.housekeeping_local_date($1))::date::text as month_start,
              (date_trunc('month', private.housekeeping_local_date($1)) - interval '1 month')::date::text as previous_month`,
            [societyId],
          )
        ).rows[0]!;
        const unitId = (
          await client.query<{ id: string }>(
            "insert into public.units(society_id,number,created_by) values($1,'A-101',$2) returning id",
            [societyId, users.get('admin')],
          )
        ).rows[0]!.id;
        const receiptPath = `${societyId}/${users.get('admin')}/expense/${crypto.randomUUID()}.pdf`;
        const strangerPath = `${societyId}/${users.get('chair')}/expense/${crypto.randomUUID()}.pdf`;
        await client.query(
          `insert into storage.objects(bucket_id,name,metadata)
           values('expense-files',$1,'{"size":50,"mimetype":"application/pdf"}'),
                 ('expense-files',$2,'{"size":50,"mimetype":"application/pdf"}')`,
          [receiptPath, strangerPath],
        );
        return {
          users,
          societyId,
          otherSocietyId,
          unitId,
          receiptPath,
          strangerPath,
          ...dates,
        };
      });
      const as = <T>(
        key: string,
        query: Parameters<typeof db.asSuperuser<T>>[0],
      ) =>
        db.asRole('authenticated', { sub: fixture.users.get(key)! }, query, {
          commit: true,
        });
      const call = async <T = unknown>(
        key: string,
        sql: string,
        params: unknown[] = [],
      ) =>
        (
          await as(key, (client) =>
            client.query<{ result: T }>(`select ${sql} as result`, params),
          )
        ).rows[0]!.result;
      const code = async (promise: Promise<unknown>) =>
        (await dbError(promise)).code;
      const society = fixture.societyId;
      type Workspace = {
        can_manage: boolean;
        can_approve: boolean;
        settings: { updated_at: string; approval_threshold_paise: number };
        accounts: {
          id: string;
          name: string;
          balance_paise: number;
          updated_at: string;
        }[];
        categories: { id: string; name: string }[];
      };
      const workspace = (key = 'admin') =>
        call<Workspace>(key, 'public.expense_workspace($1)', [society]);

      const initial = await workspace();
      expect(initial.categories.map(({ name }) => name)).toHaveLength(10);
      expect(initial.settings.approval_threshold_paise).toBe(5000000);
      const committeeView = await workspace('committee');
      expect(committeeView).toMatchObject({
        can_manage: false,
        can_approve: true,
      });
      for (const key of ['resident', 'guard'])
        expect(await code(workspace(key))).toBe('42501');
      expect(
        await code(
          call('admin', 'public.expense_workspace($1)', [
            fixture.otherSocietyId,
          ]),
        ),
      ).toBe('42501');
      const repairs = initial.categories.find(
        ({ name }) => name === 'Repairs',
      )!.id;

      const saveAccount = (
        key: string,
        name: string,
        type: string,
        opening: number,
      ) =>
        call<string>(
          key,
          "public.expense_account_save($1,null,$2,$3,$4,$5,true,null,'expense-test')",
          [society, name, type, opening, fixture.previous_month],
        );
      const cash = await saveAccount('admin', 'Cash box', 'cash', 100000);
      expect(await saveAccount('admin', 'Cash box', 'cash', 100000)).toBe(cash);
      const bank = await saveAccount('admin', 'Main bank', 'bank', 0);
      expect(await code(saveAccount('committee', 'Bank 2', 'bank', 0))).toBe(
        '42501',
      );

      const updateSettings = (
        threshold: number,
        account: string | null,
        expected: string | null,
      ) =>
        call(
          'admin',
          "public.expense_settings_update($1,$2,$3,$4,'expense-test')",
          [society, threshold, account, expected],
        );
      const configured = await workspace();
      expect(
        await code(updateSettings(50000, cash, configured.settings.updated_at)),
      ).toBe('22023');
      expect(await code(updateSettings(50000, bank, null))).toBe('23505');
      await updateSettings(50000, bank, configured.settings.updated_at);
      expect(
        await code(
          db.asSuperuser((client) =>
            client.query(
              `update public.module_configs set settings='{"unknown":1}'
               where society_id=$1 and module_key='expense'`,
              [society],
            ),
          ),
        ),
      ).toBe('23514');

      const record = (
        key: string,
        account: string,
        amount: number,
        mode: string,
        retryId: string = crypto.randomUUID(),
        spentOn = fixture.today,
        receipt: string | null = null,
      ) =>
        call<{ id: string; status: string }>(
          key,
          "public.expense_record($1,$2,$3,$4,'Synthetic Vendor',$5,$6,null,null,$7,$8,'expense-test')",
          [society, account, repairs, spentOn, amount, mode, receipt, retryId],
        );
      expect(await code(record('admin', bank, 1000, 'cash'))).toBe('23514');
      expect(await code(record('admin', cash, 1000, 'upi'))).toBe('23514');
      expect(await code(record('committee', cash, 1000, 'cash'))).toBe('42501');
      const smallRetry = crypto.randomUUID();
      const small = await record('admin', cash, 20000, 'cash', smallRetry);
      expect(small.status).toBe('posted');
      expect(await record('admin', cash, 20000, 'cash', smallRetry)).toEqual(
        small,
      );
      expect(await code(record('admin', cash, 20001, 'cash', smallRetry))).toBe(
        '23505',
      );
      const large = await record(
        'admin',
        bank,
        60000,
        'upi',
        undefined,
        fixture.today,
        fixture.receiptPath,
      );
      expect(large.status).toBe('pending_approval');
      expect(
        await code(
          record(
            'admin',
            bank,
            100,
            'upi',
            undefined,
            fixture.today,
            fixture.strangerPath,
          ),
        ),
      ).toBe('42501');
      const chairs = await record('chair', bank, 70000, 'bank');
      const notified = await db.asSuperuser((client) =>
        client.query<{ user_id: string }>(
          "select user_id from public.notifications where type='expense_approval_needed' and entity_id=$1",
          [large.id],
        ),
      );
      expect(notified.rows.map(({ user_id }) => user_id).sort()).toEqual(
        [fixture.users.get('chair'), fixture.users.get('committee')].sort(),
      );
      expect(
        (
          await as('committee', (client) =>
            client.query(
              "select name from storage.objects where bucket_id='expense-files'",
            ),
          )
        ).rows,
      ).toEqual([{ name: fixture.receiptPath }]);

      const decide = (
        key: string,
        id: string,
        approve: boolean,
        note: string | null,
      ) =>
        call<{ status: string }>(
          key,
          "public.expense_decide($1,$2,$3,$4,'expense-test')",
          [society, id, approve, note],
        );
      expect(await code(decide('admin', large.id, true, null))).toBe('42501');
      expect(await code(decide('chair', chairs.id, true, null))).toBe('42501');
      expect(await code(decide('committee', chairs.id, false, ' '))).toBe(
        '22023',
      );
      expect((await decide('committee', large.id, true, null)).status).toBe(
        'posted',
      );
      expect((await decide('committee', large.id, true, null)).status).toBe(
        'posted',
      );
      expect(await code(decide('committee', large.id, false, 'No'))).toBe(
        '23505',
      );
      expect(
        (await decide('committee', chairs.id, false, 'Duplicate bill')).status,
      ).toBe('rejected');

      const incomeRetry = crypto.randomUUID();
      const income = (retryId: string, amount = 5000) =>
        call<string>(
          'admin',
          "public.expense_income_record($1,$2,$3,'donation','Synthetic donor',$4,null,null,$5,'expense-test')",
          [society, bank, fixture.today, amount, retryId],
        );
      const donation = await income(incomeRetry);
      expect(await income(incomeRetry)).toBe(donation);
      expect(await code(income(incomeRetry, 5001))).toBe('23505');

      const smallEntry = (
        await db.asSuperuser((client) =>
          client.query<{ id: string }>(
            'select id from public.expense_book_entries where expense_id=$1',
            [small.id],
          ),
        )
      ).rows[0]!.id;
      const reverse = (entry: string, retryId = crypto.randomUUID()) =>
        call<string>(
          'admin',
          "public.expense_entry_reverse($1,$2,$3,'Entered twice',$4,'expense-test')",
          [society, entry, fixture.today, retryId],
        );
      const reversalRetry = crypto.randomUUID();
      const reversal = await reverse(smallEntry, reversalRetry);
      expect(await reverse(smallEntry, reversalRetry)).toBe(reversal);
      expect(await code(reverse(smallEntry))).toBe('23505');
      expect(await code(reverse(reversal))).toBe('22023');
      for (const statement of [
        'update public.expense_book_entries set amount_paise=1 where id=$1',
        'delete from public.expense_book_entries where id=$1',
      ])
        expect(
          await code(
            db.asSuperuser((client) => client.query(statement, [reversal])),
          ),
        ).toBe('55000');

      await db.asSuperuser((client) =>
        client.query(
          `insert into public.billing_payments(
            society_id,unit_id,amount_paise,mode,source,paid_on,status,submitted_by,
            confirmed_by,confirmed_at,receipt_no,client_request_id,created_by
          ) values($1,$2,30000,'cash','admin_recorded',$3,'confirmed',$4,$4,now(),
            'R-2026-000001',$5,$4)`,
          [
            society,
            fixture.unitId,
            fixture.today,
            fixture.users.get('admin'),
            crypto.randomUUID(),
          ],
        ),
      );
      type Report = {
        income_paise: number;
        expense_paise: number;
        income_sources: { source: string; income_paise: number }[];
        balances: { account: string; balance_paise: number }[];
        outstanding_dues_paise: number | null;
      };
      const report = await call<Report>(
        'committee',
        'public.expense_report($1,$2,$3)',
        [society, fixture.previous_month, fixture.today],
      );
      expect(report).toMatchObject({
        income_paise: 35000,
        expense_paise: 60000,
        outstanding_dues_paise: 0,
      });
      expect(report.income_sources).toEqual([
        { source: 'billing', income_paise: 30000 },
        { source: 'donation', income_paise: 5000 },
      ]);
      expect(
        Object.fromEntries(
          report.balances.map(({ account, balance_paise }) => [
            account,
            balance_paise,
          ]),
        ),
      ).toEqual({ 'Cash box': 100000, 'Main bank': -25000 });
      const bankVersion = (await workspace()).accounts.find(
        ({ id }) => id === bank,
      )!.updated_at;
      expect(
        await code(
          call(
            'admin',
            "public.expense_account_save($1,$2,'Main bank','bank',0,$3,false,$4,'expense-test')",
            [society, bank, fixture.previous_month, bankVersion],
          ),
        ),
      ).toBe('22023');

      const close = (month: string) =>
        call('admin', "public.expense_month_close($1,$2,'expense-test')", [
          society,
          month,
        ]);
      expect(await code(close(fixture.month_start))).toBe('22023');
      await record(
        'admin',
        cash,
        1000,
        'cash',
        undefined,
        fixture.previous_month,
      );
      const pendingOld = await record(
        'admin',
        bank,
        90000,
        'bank',
        undefined,
        fixture.previous_month,
      );
      expect(await code(close(fixture.previous_month))).toBe('23514');
      await decide('committee', pendingOld.id, false, 'Not approved');
      await close(fixture.previous_month);
      await close(fixture.previous_month);
      expect(
        await code(
          record(
            'admin',
            cash,
            1000,
            'cash',
            undefined,
            fixture.previous_month,
          ),
        ),
      ).toBe('23514');
      expect(
        await code(
          call(
            'admin',
            "public.expense_month_reopen($1,$2,' ','expense-test')",
            [society, fixture.previous_month],
          ),
        ),
      ).toBe('22023');
      await call(
        'admin',
        "public.expense_month_reopen($1,$2,'Missed bill','expense-test')",
        [society, fixture.previous_month],
      );
      const audit = await db.asSuperuser((client) =>
        client.query<{ action: string }>(
          "select action from public.audit_logs where society_id=$1 and action like 'expense.month.%' order by created_at",
          [society],
        ),
      );
      expect(audit.rows.map(({ action }) => action)).toEqual([
        'expense.month.close',
        'expense.month.reopen',
      ]);
      const page = await call<{ total: number }>(
        'committee',
        'public.expense_entries_page($1,$2,$3,null,50,0)',
        [society, fixture.previous_month, fixture.today],
      );
      expect(page.total).toBe(6);
      const deposit = await saveAccount(
        'admin',
        'Fixed deposit account',
        'deposit',
        20000,
      );
      const fixedDepositFund = await call<string>(
        'admin',
        "public.expense_fund_save($1,null,'Fixed deposit fund',true,null,'expense-test')",
        [society],
      );
      const fixedDeposit = await call<string>(
        'admin',
        `public.expense_fixed_deposit_save(
          $1,null,null,$2,$3,'Synthetic bank','FD-PRIVATE',25000,7.25,
          $4,$5,27000,null,'expense-test'
        )`,
        [
          society,
          fixedDepositFund,
          deposit,
          fixture.previous_month,
          fixture.today,
        ],
      );
      const committeeDeposits = await call<{
        deposits: {
          id: string;
          reference: string | null;
          reconciliation_status: string;
          days_to_maturity: number;
          maturity_follow_up: boolean;
        }[];
      }>('committee', 'public.expense_fixed_deposits_list($1)', [society]);
      expect(
        committeeDeposits.deposits.find(({ id }) => id === fixedDeposit),
      ).toMatchObject({
        reference: null,
        reconciliation_status: 'difference',
        days_to_maturity: 0,
        maturity_follow_up: true,
      });
      expect(await code(record('admin', deposit, 1000, 'bank'))).toBe('23514');
      expect(
        await code(
          call(
            'admin',
            "public.expense_income_record($1,$2,$3,'donation','Synthetic bank',1000,null,null,$4,'expense-test')",
            [society, deposit, fixture.today, crypto.randomUUID()],
          ),
        ),
      ).toBe('23514');
      const transferRequest = crypto.randomUUID();
      const transferPair = await call<string>(
        'admin',
        "public.expense_transfer_record($1,$2,$3,$4,$5,'FD-1','Place fixed deposit',$6,'expense-test')",
        [society, bank, deposit, fixture.today, 5000, transferRequest],
      );
      expect(
        await call(
          'admin',
          "public.expense_transfer_record($1,$2,$3,$4,$5,'FD-1','Place fixed deposit',$6,'expense-test')",
          [society, bank, deposit, fixture.today, 5000, transferRequest],
        ),
      ).toBe(transferPair);
      const transferReport = await call<{
        income_paise: number;
        expense_paise: number;
        balances: { account: string; balance_paise: number }[];
      }>('admin', 'public.expense_report($1,$2,$3)', [
        society,
        fixture.previous_month,
        fixture.today,
      ]);
      expect(transferReport).toMatchObject({
        income_paise: 35000,
        expense_paise: 61000,
      });
      expect(
        Object.fromEntries(
          transferReport.balances.map(({ account, balance_paise }) => [
            account,
            balance_paise,
          ]),
        ),
      ).toMatchObject({
        'Main bank': -30000,
        'Fixed deposit account': 25000,
      });
      const matchedDeposits = await call<{
        deposits: {
          id: string;
          reconciliation_status: string;
          account_balance_paise: number;
        }[];
      }>('admin', 'public.expense_fixed_deposits_list($1)', [society]);
      expect(
        matchedDeposits.deposits.find(({ id }) => id === fixedDeposit),
      ).toMatchObject({
        reconciliation_status: 'matched',
        account_balance_paise: 25000,
      });
      const analyticsAfterTransfer = await db.asSuperuser((client) =>
        client.query<{ result: unknown }>(
          'select private.analytics_metric_expense_income_vs_expense($1,$2,$3) as result',
          [society, fixture.previous_month, fixture.today],
        ),
      );
      const reversedTransferRequest = crypto.randomUUID();
      expect(
        await call(
          'admin',
          "public.expense_transfer_reverse($1,$2,$3,'Deposit cancelled',$4,'expense-test')",
          [society, transferPair, fixture.today, reversedTransferRequest],
        ),
      ).toBe(transferPair);
      expect(
        await call(
          'admin',
          "public.expense_transfer_reverse($1,$2,$3,'Deposit cancelled',$4,'expense-test')",
          [society, transferPair, fixture.today, reversedTransferRequest],
        ),
      ).toBe(transferPair);
      const transferredRows = await call<{
        rows: {
          source: string;
          transfer_pair_id: string | null;
          transfer_account_name: string | null;
        }[];
      }>('admin', 'public.expense_entries_page($1,$2,$3,null,50,0)', [
        society,
        fixture.today,
        fixture.today,
      ]);
      expect(
        transferredRows.rows.filter(
          ({ transfer_pair_id }) => transfer_pair_id === transferPair,
        ),
      ).toHaveLength(4);
      const finalReport = await call<{
        income_paise: number;
        expense_paise: number;
        balances: { account: string; balance_paise: number }[];
      }>('admin', 'public.expense_report($1,$2,$3)', [
        society,
        fixture.previous_month,
        fixture.today,
      ]);
      expect(finalReport).toMatchObject({
        income_paise: 35000,
        expense_paise: 61000,
      });
      expect(
        Object.fromEntries(
          finalReport.balances.map(({ account, balance_paise }) => [
            account,
            balance_paise,
          ]),
        ),
      ).toMatchObject({
        'Main bank': -25000,
        'Fixed deposit account': 20000,
      });
      const analyticsAfterReversal = await db.asSuperuser((client) =>
        client.query<{ result: unknown }>(
          'select private.analytics_metric_expense_income_vs_expense($1,$2,$3) as result',
          [society, fixture.previous_month, fixture.today],
        ),
      );
      expect(analyticsAfterReversal.rows[0]!.result).toEqual(
        analyticsAfterTransfer.rows[0]!.result,
      );
      const nextMaturity = new Date(
        new Date(`${fixture.today}T00:00:00Z`).getTime() + 365 * 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
      const renewal = await call<string>(
        'admin',
        `public.expense_fixed_deposit_save(
          $1,null,$2,$3,$4,'Synthetic bank','FD-RENEWED',null,null,
          $5,$6,null,null,'expense-test'
        )`,
        [
          society,
          fixedDeposit,
          fixedDepositFund,
          deposit,
          fixture.today,
          nextMaturity,
        ],
      );
      expect(renewal).not.toBe(fixedDeposit);
      const maturityList = await call<{
        deposits: {
          id: string;
          maturity_follow_up: boolean;
        }[];
      }>('admin', 'public.expense_fixed_deposits_list($1)', [society]);
      expect(
        maturityList.deposits.find(({ id }) => id === fixedDeposit),
      ).toMatchObject({ maturity_follow_up: false });
      expect(
        maturityList.deposits.find(({ id }) => id === renewal),
      ).toMatchObject({ maturity_follow_up: false });
      const interestIncome = await call<string>(
        'admin',
        "public.expense_income_record($1,$2,$3,'interest','Synthetic bank',4000,'INT-1',null,$4,'expense-test')",
        [society, bank, fixture.today, crypto.randomUUID()],
      );
      const interestRecord = await call<string>(
        'admin',
        `public.expense_fund_interest_save(
          $1,null,$2,$3,$4,'Quarterly FD interest',$5,$6,
          5000,1000,4000,25000,'Bank certificate',null,'expense-test'
        )`,
        [
          society,
          fixedDepositFund,
          fixedDeposit,
          interestIncome,
          fixture.previous_month,
          fixture.today,
        ],
      );
      const interest = await call<{
        records: {
          id: string;
          net_interest_paise: number;
          credit_difference_paise: number;
          annualised_yield_percent: number;
        }[];
      }>('committee', 'public.expense_fund_interest_list($1)', [society]);
      expect(
        interest.records.find(({ id }) => id === interestRecord),
      ).toMatchObject({
        net_interest_paise: 4000,
        credit_difference_paise: 0,
      });
      expect(
        interest.records.find(({ id }) => id === interestRecord)
          ?.annualised_yield_percent,
      ).toBeGreaterThan(0);
      expect(
        await code(
          call(
            'admin',
            `public.expense_fund_interest_save(
              $1,null,$2,null,null,'Invalid TDS',$3,$4,
              1000,2000,null,null,null,null,'expense-test'
            )`,
            [society, fixedDepositFund, fixture.previous_month, fixture.today],
          ),
        ),
      ).toBe('22023');
    } finally {
      await db.drop();
    }
  });
  it('numbers vouchers, reconciles bank statements and tracks petty cash custody', async () => {
    const db = await createTestDatabase();
    try {
      const fixture = await db.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        const roles: Record<string, string[]> = {
          admin: ['admin'],
          committee: ['committee'],
          resident: ['resident'],
          guard: ['guard'],
        };
        for (const key of Object.keys(roles)) {
          const id = await newAuthUser(client, `p39-${key}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `p39-${key}@example.test`, `P39 ${key}`],
          );
          users.set(key, id);
        }
        const societyId = (
          await client.query<{ id: string }>(
            "insert into public.societies(name,created_by) values('P39 society',$1) returning id",
            [users.get('admin')],
          )
        ).rows[0]!.id;
        for (const [key, id] of users)
          await client.query(
            "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,$3,'active')",
            [societyId, id, roles[key]],
          );
        await client.query(
          "insert into public.module_configs(society_id,module_key,enabled,settings) values($1,'core',true,'{}'),($1,'expense',true,'{}')",
          [societyId],
        );
        const dates = (
          await client.query<{
            today: string;
            opening: string;
            last_year_day: string;
            old_day: string;
            future_day: string;
            year: number;
          }>(
            `with base as (
               select private.housekeeping_local_date($1) as today,
                 make_date(private.expense_financial_year(private.housekeeping_local_date($1)), 4, 1) as year_start
             )
             select today::text, (year_start - 30)::text as opening,
               (year_start - 10)::text as last_year_day, (today - 40)::text as old_day,
               (today + 1)::text as future_day,
               extract(year from year_start)::integer as year
             from base`,
            [societyId],
          )
        ).rows[0]!;
        return { users, societyId, ...dates };
      });
      const society = fixture.societyId;
      const call = async <T = unknown>(
        key: string,
        sql: string,
        params: unknown[] = [],
      ) =>
        (
          await db.asRole(
            'authenticated',
            { sub: fixture.users.get(key)! },
            (client) =>
              client.query<{ result: T }>(`select ${sql} as result`, params),
            { commit: true },
          )
        ).rows[0]!.result;
      const code = async (promise: Promise<unknown>) =>
        (await dbError(promise)).code;
      const label = (type: string, year: number, sequence: number) =>
        `${type}/${year}-${String((year + 1) % 100).padStart(2, '0')}/${sequence}`;

      const saveAccount = (name: string, type: string, opening: number) =>
        call<string>(
          'admin',
          "public.expense_account_save($1,null,$2,$3,$4,$5,true,null,'p39-test')",
          [society, name, type, opening, fixture.opening],
        );
      const cash = await saveAccount('Cash box', 'cash', 100000);
      const bank = await saveAccount('Main bank', 'bank', 50000);
      const income = (day: string, amount: number) =>
        call<string>(
          'admin',
          "public.expense_income_record($1,$2,$3,'donation','Synthetic donor',$4,null,null,$5,'p39-test')",
          [society, bank, day, amount, crypto.randomUUID()],
        );
      await income(fixture.last_year_day, 10000);
      await income(fixture.today, 20000);
      await income(fixture.today, 30000);
      const repairs = (
        await call<{ categories: { id: string; name: string }[] }>(
          'admin',
          'public.expense_workspace($1)',
          [society],
        )
      ).categories.find(({ name }) => name === 'Repairs')!.id;
      await call(
        'admin',
        "public.expense_record($1,$2,$3,$4,'Synthetic Vendor',7000,'upi',null,null,null,$5,'p39-test')",
        [society, bank, repairs, fixture.today, crypto.randomUUID()],
      );

      type Entry = {
        id: string;
        amount_paise: number;
        voucher_no: string;
        running_balance_paise: number | null;
      };
      const entries = async (account: string | null) =>
        (
          await call<{ rows: Entry[] }>(
            'committee',
            'public.expense_entries_page($1,$2,$3,$4,50,0)',
            [society, fixture.opening, fixture.today, account],
          )
        ).rows;
      const bankRows = await entries(bank);
      const byAmount = (amount: number) =>
        bankRows.find(({ amount_paise }) => amount_paise === amount)!;
      expect(byAmount(10000)).toMatchObject({
        voucher_no: label('RV', fixture.year - 1, 1),
        running_balance_paise: 60000,
      });
      expect(byAmount(20000).voucher_no).toBe(label('RV', fixture.year, 1));
      expect(byAmount(30000).voucher_no).toBe(label('RV', fixture.year, 2));
      expect(byAmount(7000).voucher_no).toBe(label('PV', fixture.year, 1));
      expect(bankRows[0]!.running_balance_paise).toBe(103000);
      expect(
        (await entries(null)).every(
          ({ running_balance_paise }) => running_balance_paise === null,
        ),
      ).toBe(true);
      expect(
        await code(
          db.asSuperuser((client) =>
            client.query(
              'delete from public.expense_vouchers where entry_id=$1',
              [byAmount(7000).id],
            ),
          ),
        ),
      ).toBe('55000');

      type Month = {
        month: string;
        net_paise: number;
        cumulative_net_paise: number;
      };
      const months = (
        await call<{ months: Month[] }>(
          'committee',
          'public.expense_report($1,$2,$3)',
          [society, fixture.last_year_day, fixture.today],
        )
      ).months;
      expect(months[0]).toMatchObject({
        net_paise: 10000,
        cumulative_net_paise: 10000,
      });
      expect(months[1]!.cumulative_net_paise).toBe(
        months.length === 2 ? 43000 : 0,
      );
      expect(months.at(-1)).toMatchObject({
        net_paise: 43000,
        cumulative_net_paise: 43000,
      });

      const recordItem = (
        key: string,
        account: string,
        direction: string,
        amount: number,
        retryId: string = crypto.randomUUID(),
        day = fixture.today,
      ) =>
        call<string>(
          key,
          "public.expense_statement_item_record($1,$2,$3,'UTR-1',' ',$4,$5,$6,'p39-test')",
          [society, account, day, direction, amount, retryId],
        );
      expect(await code(recordItem('admin', cash, 'in', 100))).toBe('22023');
      expect(await code(recordItem('committee', bank, 'in', 100))).toBe(
        '42501',
      );
      expect(
        await code(
          recordItem('admin', bank, 'in', 100, undefined, fixture.future_day),
        ),
      ).toBe('22023');
      const retryId = crypto.randomUUID();
      const itemA = await recordItem('admin', bank, 'in', 20000, retryId);
      expect(await recordItem('admin', bank, 'in', 20000, retryId)).toBe(itemA);
      expect(await code(recordItem('admin', bank, 'in', 20001, retryId))).toBe(
        '23505',
      );
      const itemB = await recordItem('admin', bank, 'out', 7000);
      const itemC = await recordItem(
        'admin',
        bank,
        'in',
        999,
        undefined,
        fixture.old_day,
      );
      const itemD = await recordItem('admin', bank, 'in', 20000);

      const match = (item: string, entry: string) =>
        call(
          'admin',
          "public.expense_statement_item_match($1,$2,$3,'p39-test')",
          [society, item, entry],
        );
      expect(await code(match(itemA, byAmount(7000).id))).toBe('22023');
      expect(await code(match(itemA, byAmount(30000).id))).toBe('22023');
      await match(itemA, byAmount(20000).id);
      await match(itemA, byAmount(20000).id);
      expect(await code(match(itemA, byAmount(10000).id))).toBe('23505');
      expect(await code(match(itemD, byAmount(20000).id))).toBe('23505');
      await match(itemB, byAmount(7000).id);

      type Reconciliation = {
        total: number;
        old_total: number;
        items: {
          id: string;
          status: string;
          is_old: boolean;
          matched_voucher_no: string | null;
          party: string | null;
        }[];
        unmatched_entries_total: number;
      };
      const reconciliation = (key: string, account = bank) =>
        call<Reconciliation>(
          key,
          'public.expense_reconciliation_page($1,$2,50,0)',
          [society, account],
        );
      const before = await reconciliation('committee');
      expect(before).toMatchObject({
        total: 4,
        old_total: 1,
        unmatched_entries_total: 2,
      });
      const itemOf = (page: Reconciliation, id: string) =>
        page.items.find((item) => item.id === id)!;
      expect(itemOf(before, itemC).is_old).toBe(true);
      expect(itemOf(before, itemA)).toMatchObject({
        status: 'matched',
        matched_voucher_no: label('RV', fixture.year, 1),
        party: null,
      });
      expect(await code(reconciliation('resident'))).toBe('42501');
      expect(await code(reconciliation('admin', cash))).toBe('22023');

      const cancel = (item: string, reason: string) =>
        call(
          'admin',
          "public.expense_statement_item_cancel($1,$2,$3,'p39-test')",
          [society, item, reason],
        );
      expect(await code(cancel(itemC, ' '))).toBe('22023');
      await cancel(itemC, 'Bank charge reversed');
      await cancel(itemC, 'Bank charge reversed');
      expect(await code(cancel(itemA, 'Wrong'))).toBe('23505');
      expect((await reconciliation('admin')).old_total).toBe(0);
      expect(
        await code(
          db.asSuperuser((client) =>
            client.query(
              'delete from public.expense_statement_items where id=$1',
              [itemD],
            ),
          ),
        ),
      ).toBe('55000');

      type PettyCash = {
        can_assign: boolean;
        can_record: boolean;
        is_custodian: boolean;
        book_paise: number | null;
        custodian: { user_id: string } | null;
        counts: { difference_paise: number; kind: string }[];
        history: {
          ended_at: string | null;
          handover_counted_paise: number | null;
          handover_book_paise: number | null;
        }[];
        cash_account: { id: string } | null;
        members: unknown[];
      };
      const view = (key: string) =>
        call<PettyCash>(key, 'public.expense_petty_cash_view($1)', [society]);
      const isCustodian = (key: string) =>
        call<boolean>(key, 'public.expense_petty_cash_custodian_check($1)', [
          society,
        ]);
      const assign = (
        key: string,
        account: string,
        custodian: string,
        handover: number | null,
        retry: string = crypto.randomUUID(),
      ) =>
        call<string>(
          key,
          "public.expense_petty_cash_assign($1,$2,$3,$4,'Handed over',$5,'p39-test')",
          [society, account, fixture.users.get(custodian), handover, retry],
        );
      const count = (
        key: string,
        amount: number,
        day = fixture.today,
        retry: string = crypto.randomUUID(),
      ) =>
        call<string>(
          key,
          "public.expense_cash_count_record($1,$2,$3,'Drawer',$4,'p39-test')",
          [society, day, amount, retry],
        );

      expect(await code(view('resident'))).toBe('42501');
      expect(await isCustodian('resident')).toBe(false);
      expect(await code(count('admin', 100000))).toBe('22023');
      expect(await code(assign('committee', cash, 'resident', null))).toBe(
        '42501',
      );
      expect(await code(assign('admin', bank, 'resident', null))).toBe('22023');
      const firstCustody = await assign('admin', cash, 'resident', null);
      expect(await assign('admin', cash, 'resident', null)).toBe(firstCustody);
      expect(await isCustodian('resident')).toBe(true);
      expect(await view('resident')).toMatchObject({
        can_assign: false,
        can_record: true,
        is_custodian: true,
        book_paise: 100000,
        cash_account: null,
        members: [],
      });

      const countRetry = crypto.randomUUID();
      const counted = await count('resident', 95000, fixture.today, countRetry);
      expect(await count('resident', 95000, fixture.today, countRetry)).toBe(
        counted,
      );
      expect(
        await code(count('resident', 95001, fixture.today, countRetry)),
      ).toBe('23505');
      expect(await code(count('resident', 1, fixture.future_day))).toBe(
        '22023',
      );
      expect(await code(count('guard', 1))).toBe('42501');
      expect((await view('committee')).counts[0]).toMatchObject({
        difference_paise: -5000,
        kind: 'routine',
      });
      const countAudit = await db.asSuperuser((client) =>
        client.query<{ actor_role: string; after: Record<string, unknown> }>(
          "select actor_role, after from public.audit_logs where action='expense.cash_count.record' and entity_id=$1",
          [counted],
        ),
      );
      expect(countAudit.rows[0]!.actor_role).toBe('custodian');
      expect(countAudit.rows[0]!.after).not.toHaveProperty('note');

      expect(await code(assign('admin', cash, 'guard', null))).toBe('22023');
      await assign('admin', cash, 'guard', 98000);
      expect(await code(view('resident'))).toBe('42501');
      const adminView = await view('admin');
      expect(adminView).toMatchObject({
        can_assign: true,
        custodian: { user_id: fixture.users.get('guard') },
        cash_account: { id: cash },
      });
      expect(adminView.members).toHaveLength(4);
      expect(adminView.history).toHaveLength(2);
      expect(adminView.history[0]).toMatchObject({
        ended_at: null,
        handover_counted_paise: 98000,
        handover_book_paise: 100000,
      });
      expect(adminView.history[1]!.ended_at).not.toBeNull();
      expect(adminView.counts.map(({ kind }) => kind)).toContain('handover');
      expect(
        await code(
          db.asSuperuser((client) =>
            client.query('delete from public.expense_cash_counts where id=$1', [
              counted,
            ]),
          ),
        ),
      ).toBe('55000');
    } finally {
      await db.drop();
    }
  });
});
