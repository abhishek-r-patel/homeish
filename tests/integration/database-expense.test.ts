// Verify P16 expense storage, approvals, append-only books, month close and billing income.
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
    } finally {
      await db.drop();
    }
  });
});
