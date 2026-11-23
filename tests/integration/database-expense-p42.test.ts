// Verify P42 controls, vendor matching, permissions and permanent savings history.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
import {
  expenseSavingsDetailSchema,
  expenseVendorSpendSchema,
} from '../../src/core/expense/validation';

describe.skipIf(!hasDatabase)('database expense P42 controls', () => {
  it('keeps reporting authoritative and savings history permanent', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(client, `p42-${role}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `p42-${role}@example.test`, `P42 ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['P42 Society', users.get('admin')],
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
           values($1,'core',true,'{}'),($1,'expense',true,'{}'),
                  ($1,'vendor',true,'{}')`,
          [society],
        );
        const category = (
          await client.query<{ id: string }>(
            `insert into public.expense_categories(society_id,name,created_by)
             values($1,'P42 Repairs',$2) returning id`,
            [society, users.get('admin')],
          )
        ).rows[0]!.id;
        const account = (
          await client.query<{ id: string }>(
            `insert into public.expense_accounts(
               society_id,name,account_type,opening_balance_paise,opening_on,created_by
             ) values($1,'P42 Bank','bank',10000000,'2026-04-01',$2) returning id`,
            [society, users.get('admin')],
          )
        ).rows[0]!.id;
        const vendors = await client.query<{ id: string }>(
          `insert into public.vendors(
             society_id,name,category,client_request_id,created_by
           ) values
             ($1,'Linked P42 Vendor','Repairs',$2,$4),
             ($1,'Mapped P42 Vendor','Repairs',$3,$4)
           returning id`,
          [
            society,
            crypto.randomUUID(),
            crypto.randomUUID(),
            users.get('admin'),
          ],
        );
        return {
          society,
          users,
          category,
          account,
          linkedVendor: vendors.rows[0]!.id,
          mappedVendor: vendors.rows[1]!.id,
        };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const resident = fixture.users.get('resident')!;
      const categoryClient = crypto.randomUUID();

      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_category_details_save(
               $1,$2,'Maintenance','variable',$3,'Core reporting category',
               1,$4,$5
             )`,
            [
              fixture.society,
              fixture.category,
              committee,
              categoryClient,
              'p42-category',
            ],
          ),
        { commit: true },
      );
      const replayedCategory = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_category_details_save(
               $1,$2,'Maintenance','variable',$3,'Core reporting category',
               1,$4,$5
             ) as id`,
            [
              fixture.society,
              fixture.category,
              committee,
              categoryClient,
              'p42-category-repeat',
            ],
          ),
      );
      expect(replayedCategory.rows[0]!.id).toBe(fixture.category);
      expect(
        await dbError(
          database.asRole('authenticated', { sub: admin }, (client) =>
            client.query(
              `select public.expense_category_details_save(
                 $1,$2,'Different','fixed',null,null,1,$3,'p42-category-changed'
               )`,
              [fixture.society, fixture.category, categoryClient],
            ),
          ),
        ),
      ).toMatchObject({ code: '23505' });
      const workspace = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ workspace: Record<string, unknown> }>(
            'select public.expense_workspace($1) as workspace',
            [fixture.society],
          ),
      );
      expect(workspace.rows[0]!.workspace).toMatchObject({
        vendor_enabled: true,
        group_suggestions: ['Maintenance'],
      });

      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_record(
               $1,$2,$3,'2026-05-15','Synthetic P42 Payee',100000,
               'bank',null,null,null,$4,$5
             )`,
            [
              fixture.society,
              fixture.account,
              fixture.category,
              crypto.randomUUID(),
              'p42-expense',
            ],
          ),
        { commit: true },
      );
      const entry = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select entry.id from public.expense_book_entries entry
             where entry.society_id=$1 and entry.counterparty='Synthetic P42 Payee'`,
              [fixture.society],
            )
          ).rows[0]!.id,
      );
      await database.asSuperuser(async (client) => {
        const bill = (
          await client.query<{ id: string }>(
            `insert into public.vendor_bills(
               society_id,vendor_id,invoice_number,invoice_date,amount_paise,
               effective_terms_days,due_date,client_request_id,created_by,updated_by
             ) values($1,$2,'P42-INV','2026-05-10',60000,30,'2026-06-09',$3,$4,$4)
             returning id`,
            [fixture.society, fixture.linkedVendor, crypto.randomUUID(), admin],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.vendor_bill_payments(
             society_id,bill_id,entry_id,amount_paise,client_request_id,created_by
           ) values($1,$2,$3,60000,$4,$5)`,
          [fixture.society, bill, entry, crypto.randomUUID(), admin],
        );
      });
      const mappingClient = crypto.randomUUID();
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            'select public.expense_payee_mapping_save($1,$2,$3,$4,$5)',
            [
              fixture.society,
              ' Synthetic   P42 Payee ',
              fixture.mappedVendor,
              mappingClient,
              'p42-map',
            ],
          ),
        { commit: true },
      );
      const report = await database.asRole(
        'authenticated',
        { sub: committee },
        async (client) =>
          (
            await client.query<{ report: unknown }>(
              'select public.expense_vendor_spend_report($1,$2,$3,null,null,null) as report',
              [fixture.society, '2026-04-01', '2026-06-30'],
            )
          ).rows[0]!.report,
      );
      const parsedReport = expenseVendorSpendSchema.parse(report);
      expect(parsedReport.total_expense_paise).toBe(100000);
      expect(parsedReport.accounts_expense_paise).toBe(100000);
      expect(parsedReport.reconciles_to_accounts).toBe(true);
      expect(
        parsedReport.rows
          .map((row) => ({
            name: row.vendor_name,
            amount: row.total_paise,
          }))
          .sort((left, right) =>
            (left.name ?? '').localeCompare(right.name ?? ''),
          ),
      ).toEqual([
        { name: 'Linked P42 Vendor', amount: 60000 },
        { name: 'Mapped P42 Vendor', amount: 40000 },
      ]);
      expect(
        await dbError(
          database.asRole('authenticated', { sub: resident }, (client) =>
            client.query(
              'select public.expense_vendor_spend_report($1,$2,$3,null,null,null)',
              [fixture.society, '2026-04-01', '2026-06-30'],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });

      const savingsClient = crypto.randomUUID();
      const initiative = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.expense_savings_save(
                 $1,null,'P42 Energy saving','Synthetic evidence rule',
                 'energy_saving',$2,$3,$4,120000,25000,null,$5,$6
               ) as id`,
              [
                fixture.society,
                admin,
                fixture.category,
                fixture.linkedVendor,
                savingsClient,
                'p42-saving',
              ],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      expect(
        await dbError(
          database.asRole('authenticated', { sub: admin }, (client) =>
            client.query(
              `select public.expense_savings_save(
                 $1,null,'Changed retry title','Synthetic evidence rule',
                 'energy_saving',$2,$3,$4,120000,25000,null,$5,$6
               )`,
              [
                fixture.society,
                admin,
                fixture.category,
                fixture.linkedVendor,
                savingsClient,
                'p42-saving-changed',
              ],
            ),
          ),
        ),
      ).toMatchObject({ code: '23505' });
      const evidence = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.expense_savings_evidence_add(
                 $1,$2,25000,'2026-06-01','Synthetic evidence',null,null,null,
                 null,$3,$4
               ) as id`,
              [
                fixture.society,
                initiative,
                crypto.randomUUID(),
                'p42-evidence',
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
            `select public.expense_savings_status_change(
               $1,$2,'realised',null,1,$3,$4
             )`,
            [fixture.society, initiative, crypto.randomUUID(), 'p42-realised'],
          ),
        { commit: true },
      );
      expect(
        await dbError(
          database.asRole('authenticated', { sub: admin }, (client) =>
            client.query(
              'select public.expense_savings_evidence_void($1,$2,$3,$4,$5)',
              [
                fixture.society,
                evidence,
                'Wrong evidence',
                crypto.randomUUID(),
                'p42-void-blocked',
              ],
            ),
          ),
        ),
      ).toMatchObject({ code: '23514' });
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.expense_savings_status_change(
               $1,$2,'approved',null,2,$3,$4
             )`,
            [fixture.society, initiative, crypto.randomUUID(), 'p42-unrealise'],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            'select public.expense_savings_evidence_void($1,$2,$3,$4,$5)',
            [
              fixture.society,
              evidence,
              'Wrong evidence',
              crypto.randomUUID(),
              'p42-void',
            ],
          ),
        { commit: true },
      );
      const detail = await database.asRole(
        'authenticated',
        { sub: committee },
        async (client) =>
          (
            await client.query<{ detail: unknown }>(
              'select public.expense_savings_get($1,$2) as detail',
              [fixture.society, initiative],
            )
          ).rows[0]!.detail,
      );
      const parsedDetail = expenseSavingsDetailSchema.parse(detail);
      expect(parsedDetail.status).toBe('approved');
      expect(parsedDetail.realised_to_date_paise).toBe(0);
      expect(parsedDetail.evidence[0]).toMatchObject({
        voided_at: expect.any(String),
        void_reason: 'Wrong evidence',
      });
      expect(
        await dbError(
          database.asRole('authenticated', { sub: committee }, (client) =>
            client.query(
              'select public.expense_savings_evidence_void($1,$2,$3,$4,$5)',
              [
                fixture.society,
                evidence,
                'Committee attempt',
                crypto.randomUUID(),
                'p42-committee',
              ],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      expect(
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              'delete from public.expense_savings_evidence where id=$1',
              [evidence],
            ),
          ),
        ),
      ).toMatchObject({ code: '55000' });
    } finally {
      await database.drop();
    }
  });
});
