import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Role = 'admin' | 'committee' | 'resident' | 'guard';

describe.skipIf(!hasDatabase)(
  'database billing fines, late fees and reports',
  () => {
    let database: TestDatabase;
    let societyId: string;
    let unitA: string;
    let unitB: string;
    let users: Record<Role, string>;
    let chargeId: string;
    let period: string;
    let today: string;
    let regularBillA: string;
    let regularBillB: string;

    const as = <T>(
      role: Role,
      fn: (client: Client) => Promise<T>,
      commit = true,
    ) => database.asRole('authenticated', { sub: users[role] }, fn, { commit });
    const asService = <T>(fn: (client: Client) => Promise<T>) =>
      database.asRole('service_role', null, fn, { commit: true });

    async function one<T>(client: Client, sql: string, args: unknown[]) {
      const result = await client.query<{ result: T }>(sql, args);
      return result.rows[0]!.result;
    }

    async function notificationCount(type: string, userId: string) {
      return database.asSuperuser(async (client) => {
        const result = await client.query<{ count: string }>(
          `select count(*) from public.notifications
         where society_id = $1 and user_id = $2 and type = $3`,
          [societyId, userId, type],
        );
        return Number(result.rows[0]!.count);
      });
    }

    beforeAll(async () => {
      database = await createTestDatabase();
      await database.asSuperuser(async (client) => {
        users = {} as typeof users;
        for (const role of [
          'admin',
          'committee',
          'resident',
          'guard',
        ] as const) {
          const email = `billing-fines-${role}@example.test`;
          const id = await newAuthUser(client, email);
          users[role] = id;
          await client.query(
            `insert into public.profiles (id, email, full_name)
           values ($1, $2, $3)`,
            [id, email, `Billing ${role}`],
          );
        }
        societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
           values ('Billing Fines Society', $1) returning id`,
            [users.admin],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'),
           ($1, 'billing', true, '{"grace_days": 5, "rounding": "rupee"}')`,
          [societyId],
        );
        let residentMembershipId = '';
        for (const role of Object.keys(users) as Role[]) {
          const membership = await client.query<{ id: string }>(
            `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY[$3]::text[], 'active') returning id`,
            [societyId, users[role], role],
          );
          if (role === 'resident')
            residentMembershipId = membership.rows[0]!.id;
        }
        const units = await client.query<{ id: string; number: string }>(
          `insert into public.units (society_id, number, created_by, updated_by)
         values ($1, 'A-1', $2, $2), ($1, 'B-1', $2, $2)
         returning id, number`,
          [societyId, users.admin],
        );
        unitA = units.rows.find((row) => row.number === 'A-1')!.id;
        unitB = units.rows.find((row) => row.number === 'B-1')!.id;
        await client.query(
          `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
         values ($1, $2, $3, 'owner', true, 'active', $4)`,
          [societyId, unitA, residentMembershipId, users.admin],
        );
        const dates = await client.query<{ period: string; today: string }>(
          `select to_char(date_trunc('month', current_date) - interval '2 months',
             'YYYY-MM-DD') as period,
           to_char((now() AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD')
             as today`,
        );
        period = dates.rows[0]!.period;
        today = dates.rows[0]!.today;
      });
      chargeId = await as('admin', async (client) =>
        one<string>(
          client,
          `select (public.billing_charge_save(
          $1, null, 'Monthly', 'fixed', 10000, true, null, 'fines-charge'
        )).id as result`,
          [societyId],
        ),
      );
      const preview = await as(
        'admin',
        (client) =>
          one<{ preview_hash: string }>(
            client,
            `select public.billing_bills_preview(
            $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb
          ) as result`,
            [societyId, period, [unitA, unitB], [chargeId]],
          ),
        false,
      );
      await as('admin', (client) =>
        client.query(
          `select public.billing_bills_generate(
          $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb, $5, 'fines-generate'
        )`,
          [societyId, period, [unitA, unitB], [chargeId], preview.preview_hash],
        ),
      );
      await database.asSuperuser(async (client) => {
        const bills = await client.query<{ id: string; unit_id: string }>(
          `select id, unit_id from public.billing_bills where society_id = $1`,
          [societyId],
        );
        regularBillA = bills.rows.find((row) => row.unit_id === unitA)!.id;
        regularBillB = bills.rows.find((row) => row.unit_id === unitB)!.id;
      });
    });

    afterAll(async () => {
      await database?.drop();
    });

    async function addFine(amount: number, reason: string) {
      return as('admin', (client) =>
        one<Record<string, unknown>>(
          client,
          `select public.billing_fine_add(
          $1, $2, $3, $4, $5::date, 'fine-add'
        ) as result`,
          [societyId, unitA, amount, reason, today],
        ),
      );
    }

    it('adds audited fines for administrators only', async () => {
      const forbidden = await dbError(
        as('resident', (client) =>
          client.query(
            `select public.billing_fine_add($1, $2, 500, 'Noise', $3::date, 'x')`,
            [societyId, unitA, today],
          ),
        ),
      );
      expect(forbidden.code).toBe('42501');
      const invalid = await dbError(
        as('admin', (client) =>
          client.query(
            `select public.billing_fine_add($1, $2, 500, ' ', $3::date, 'x')`,
            [societyId, unitA, today],
          ),
        ),
      );
      expect(invalid.code).toBe('22023');
      const future = await dbError(
        as('admin', (client) =>
          client.query(
            `select public.billing_fine_add(
            $1, $2, 500, 'Parking', $3::date + 1, 'x'
          )`,
            [societyId, unitA, today],
          ),
        ),
      );
      expect(future.code).toBe('22023');

      const fine = await addFine(2500, 'Parking violation');
      expect(fine).toMatchObject({
        kind: 'fine',
        title: 'Parking violation',
        total_paise: 2500,
        due_date: today,
        status: 'due',
        created_by: users.admin,
      });
      await database.asSuperuser(async (client) => {
        const ledger = await client.query(
          `select kind, direction, amount_paise from public.billing_ledger_entries
         where society_id = $1 and bill_id = $2`,
          [societyId, fine.id],
        );
        expect(ledger.rows).toEqual([
          { kind: 'bill', direction: 'debit', amount_paise: '2500' },
        ]);
        const lines = await client.query(
          `select charge_type_id, amount_paise from public.billing_bill_lines
         where bill_id = $1`,
          [fine.id],
        );
        expect(lines.rows).toEqual([
          { charge_type_id: null, amount_paise: '2500' },
        ]);
        const audit = await client.query(
          `select reason from public.audit_logs
         where action = 'billing.fine.add' and entity_id = $1`,
          [fine.id],
        );
        expect(audit.rows).toEqual([{ reason: 'Parking violation' }]);
      });
      expect(
        await notificationCount('billing_fine_added', users.resident),
      ).toBe(1);
    });

    it('waives part of a bill and cancels only unpaid bills', async () => {
      const waived = await as('admin', (client) =>
        one<Record<string, unknown>>(
          client,
          `select public.billing_bill_waive(
          $1, $2, 4000, 'Hardship relief', false, 'waive-1'
        ) as result`,
          [societyId, regularBillA],
        ),
      );
      expect(waived).toMatchObject({
        waived_paise: 4000,
        status: 'partially_paid',
        outstanding_paise: 6000,
      });
      const tooMuch = await dbError(
        as('admin', (client) =>
          client.query(
            `select public.billing_bill_waive($1, $2, 6001, 'Too much', false, 'x')`,
            [societyId, regularBillA],
          ),
        ),
      );
      expect(tooMuch.code).toBe('22023');
      const committee = await dbError(
        as('committee', (client) =>
          client.query(
            `select public.billing_bill_waive($1, $2, null, 'Nope', false, 'x')`,
            [societyId, regularBillA],
          ),
        ),
      );
      expect(committee.code).toBe('42501');

      const unpaidFine = await addFine(1500, 'Unpaid fine');
      const cancelled = await as('admin', (client) =>
        one<Record<string, unknown>>(
          client,
          `select public.billing_bill_waive(
          $1, $2, null, 'Raised in error', true, 'cancel-1'
        ) as result`,
          [societyId, unpaidFine.id],
        ),
      );
      expect(cancelled).toMatchObject({
        status: 'cancelled',
        waived_paise: 1500,
        cancel_reason: 'Raised in error',
        outstanding_paise: 0,
      });

      await as('admin', (client) =>
        client.query(
          `select public.billing_payment_record(
          $1, $2, 7000, 'cash', null, current_date, gen_random_uuid(), 'record-1'
        )`,
          [societyId, unitA],
        ),
      );
      const paidFine = await database.asSuperuser(async (client) => {
        const result = await client.query<{ id: string; paid_paise: string }>(
          `select id, paid_paise from public.billing_bills
         where society_id = $1 and kind = 'fine' and cancelled_at is null`,
          [societyId],
        );
        return result.rows[0]!;
      });
      expect(paidFine.paid_paise).toBe('1000');
      const notUnpaid = await dbError(
        as('admin', (client) =>
          client.query(
            `select public.billing_bill_waive($1, $2, null, 'Cancel', true, 'x')`,
            [societyId, paidFine.id],
          ),
        ),
      );
      expect(notUnpaid).toMatchObject({
        code: '23505',
        message: 'Only unpaid bills can be cancelled.',
      });
      expect(
        await notificationCount('billing_bill_waived', users.resident),
      ).toBe(2);
      await database.asSuperuser(async (client) => {
        const ledger = await client.query(
          `select amount_paise, reason from public.billing_ledger_entries
         where society_id = $1 and kind = 'waiver' order by id`,
          [societyId],
        );
        expect(ledger.rows).toEqual([
          { amount_paise: '4000', reason: 'Hardship relief' },
          { amount_paise: '1500', reason: 'Raised in error' },
        ]);
      });
    });

    it('charges one late fee per overdue bill and month without compounding', async () => {
      const denied = await dbError(
        as('admin', (client) =>
          client.query(
            `select public.billing_late_fees_run($1, $2::date, 'x')`,
            [societyId, today],
          ),
        ),
      );
      expect(denied.code).toBe('42501');
      const disabled = await asService((client) =>
        one<Record<string, unknown>>(
          client,
          `select public.billing_late_fees_run($1, $2::date + 3, 'late-0') as result`,
          [societyId, today],
        ),
      );
      expect(disabled).toEqual({ charged_count: 0, total_paise: '0' });

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs
         set settings = settings || '{"late_fee": {"type": "flat", "value": 5000}}'
         where society_id = $1 and module_key = 'billing'`,
          [societyId],
        ),
      );
      const first = await asService((client) =>
        one<Record<string, unknown>>(
          client,
          `select public.billing_late_fees_run($1, $2::date + 3, 'late-1') as result`,
          [societyId, today],
        ),
      );
      expect(first).toEqual({ charged_count: 1, total_paise: '5000' });
      const repeat = await asService((client) =>
        one<Record<string, unknown>>(
          client,
          `select public.billing_late_fees_run($1, $2::date + 3, 'late-2') as result`,
          [societyId, today],
        ),
      );
      expect(repeat).toEqual({ charged_count: 0, total_paise: '0' });

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs
         set settings = settings || '{"late_fee": {"type": "percent", "value": 2.5}}'
         where society_id = $1 and module_key = 'billing'`,
          [societyId],
        ),
      );
      const nextMonth = await asService((client) =>
        one<Record<string, unknown>>(
          client,
          `select public.billing_late_fees_run($1, $2::date + 34, 'late-3') as result`,
          [societyId, today],
        ),
      );
      // B-1's bill: 2.5% of 10000 rounds to 300; A-1's fine: 2.5% of 1500 rounds to 0.
      expect(nextMonth).toEqual({ charged_count: 1, total_paise: '300' });

      await database.asSuperuser(async (client) => {
        const fees = await client.query<{
          related_bill_id: string;
          total_paise: string;
          created_by: string | null;
        }>(
          `select related_bill_id, total_paise, created_by
         from public.billing_bills
         where society_id = $1 and kind = 'late_fee'
         order by period_start`,
          [societyId],
        );
        expect(fees.rows).toEqual([
          {
            related_bill_id: regularBillB,
            total_paise: '5000',
            created_by: null,
          },
          {
            related_bill_id: regularBillB,
            total_paise: '300',
            created_by: null,
          },
        ]);
        const audit = await client.query(
          `select actor_id, actor_role from public.audit_logs
         where action = 'billing.late_fees.apply'`,
        );
        expect(audit.rows).toHaveLength(2);
        expect(audit.rows[0]).toEqual({ actor_id: null, actor_role: 'system' });
      });
    });

    it('sends due, on-due and overdue reminders to unit occupants', async () => {
      await asService((client) =>
        client.query(
          `select public.billing_reminders_run($1, $2::date - 3, 'remind-1')`,
          [societyId, today],
        ),
      );
      expect(
        await notificationCount('billing_reminder_before_due', users.resident),
      ).toBe(1);
      await asService((client) =>
        client.query(
          `select public.billing_reminders_run($1, $2::date, 'remind-2')`,
          [societyId, today],
        ),
      );
      expect(
        await notificationCount('billing_reminder_on_due', users.resident),
      ).toBe(1);
      await asService((client) =>
        client.query(
          `select public.billing_reminders_run($1, $2::date + 7, 'remind-3')`,
          [societyId, today],
        ),
      );
      expect(
        await notificationCount('billing_reminder_overdue', users.resident),
      ).toBe(1);
      const body = await database.asSuperuser(async (client) => {
        const result = await client.query<{ body: string }>(
          `select body from public.notifications
         where type = 'billing_reminder_overdue' and user_id = $1`,
          [users.resident],
        );
        return result.rows[0]!.body;
      });
      expect(body).toMatch(/^Rs\. 15\.00 was due on /);
    });

    it('alerts administrators once when a submission becomes stale', async () => {
      await database.asSuperuser((client) =>
        client.query(
          `insert into public.billing_payments (
          society_id, unit_id, amount_paise, mode, source, reference, paid_on,
          status, submitted_by, client_request_id, created_by, created_at
        ) values (
          $1, $2, 1000, 'upi', 'resident_submitted', 'UTR123456', $3::date - 3,
          'awaiting_confirmation', $4, gen_random_uuid(), $4, now() - interval '3 days'
        )`,
          [societyId, unitA, today, users.resident],
        ),
      );
      const result = await asService((client) =>
        one<Record<string, number>>(
          client,
          `select public.billing_stale_payments_run($1, $2::date, 'stale-1') as result`,
          [societyId, today],
        ),
      );
      expect(result).toEqual({ stale_count: 1, notification_count: 1 });
      expect(
        await notificationCount('billing_payments_stale', users.admin),
      ).toBe(1);
      expect(
        await notificationCount('billing_payments_stale', users.committee),
      ).toBe(0);
    });

    it('summarises collections for administrators and committee', async () => {
      const dashboard = await as(
        'committee',
        (client) =>
          one<Record<string, unknown>>(
            client,
            `select public.billing_dashboard($1, $2::date, $3::date + 60) as result`,
            [societyId, period, today],
          ),
        false,
      );
      expect(dashboard).toMatchObject({
        billed_paise: '27800',
        collected_paise: '7000',
        waived_paise: '4000',
        outstanding_paise: '16800',
        received_paise: '7000',
        collection_percent: 29.4,
      });
      expect(dashboard.top_defaulters).toEqual([
        expect.objectContaining({ unit_number: 'B-1', overdue_paise: '10000' }),
      ]);
      const denied = await dbError(
        as(
          'resident',
          (client) =>
            client.query(
              `select public.billing_dashboard($1, $2::date, $2::date)`,
              [societyId, today],
            ),
          false,
        ),
      );
      expect(denied.code).toBe('42501');
    });

    it('exports audited formula-ready report jobs', async () => {
      const exported = await as('committee', (client) =>
        one<{ job_id: string; row_count: number }>(
          client,
          `select public.billing_report_export(
          $1, 'dues_by_unit', $2::date, $3::date + 60, 'export-1'
        ) as result`,
          [societyId, period, today],
        ),
      );
      expect(exported.row_count).toBe(2);
      const job = await as(
        'admin',
        (client) =>
          one<{ summary: { columns: string[]; rows: unknown[][] } }>(
            client,
            `select public.export_job_get($1) as result`,
            [exported.job_id],
          ),
        false,
      );
      expect(job.summary.columns[0]).toBe('Unit');
      expect(job.summary.rows[0]).toEqual([
        'A-1',
        2,
        '125.00',
        '70.00',
        '40.00',
        '15.00',
        today,
      ]);
      const hidden = await dbError(
        as(
          'resident',
          (client) =>
            client.query(`select public.export_job_get($1)`, [exported.job_id]),
          false,
        ),
      );
      expect(hidden.code).toBe('P0002');
      for (const report of ['collections', 'defaulters']) {
        const result = await as('admin', (client) =>
          one<{ row_count: number }>(
            client,
            `select public.billing_report_export(
            $1, $2, $3::date, $4::date, 'export-2'
          ) as result`,
            [societyId, report, period, today],
          ),
        );
        expect(result.row_count).toBe(1);
      }
      await database.asSuperuser(async (client) => {
        const audit = await client.query(
          `select actor_role from public.audit_logs
         where action = 'billing.reports.export' order by id`,
        );
        expect(audit.rows.map((row) => row.actor_role)).toEqual([
          'committee',
          'admin',
          'admin',
        ]);
      });
    });

    it('returns receipts to occupants and staff only', async () => {
      const paymentId = await database.asSuperuser(async (client) => {
        const result = await client.query<{ id: string }>(
          `select id from public.billing_payments
         where society_id = $1 and status = 'confirmed'`,
          [societyId],
        );
        return result.rows[0]!.id;
      });
      const receipt = await as(
        'resident',
        (client) =>
          one<Record<string, unknown>>(
            client,
            `select public.billing_receipt_get($1, $2) as result`,
            [societyId, paymentId],
          ),
        false,
      );
      expect(receipt).toMatchObject({
        amount_paise: 7000,
        unit_number: 'A-1',
        society_name: 'Billing Fines Society',
        payer_name: null,
      });
      expect(receipt.receipt_no).toMatch(/^R-\d{4}-000001$/);
      expect(receipt.allocations).toHaveLength(2);
      const guard = await dbError(
        as(
          'guard',
          (client) =>
            client.query(`select public.billing_receipt_get($1, $2)`, [
              societyId,
              paymentId,
            ]),
          false,
        ),
      );
      expect(guard.code).toBe('42501');
      const recipients = await asService((client) =>
        one<{ email: string }[]>(
          client,
          `select public.billing_receipt_email_recipients($1, $2) as result`,
          [societyId, paymentId],
        ),
      );
      expect(recipients).toEqual([
        {
          email: 'billing-fines-resident@example.test',
          name: 'Billing resident',
        },
      ]);
    });

    it('includes unit details on bill detail and list', async () => {
      const bill = await as(
        'resident',
        (client) =>
          one<Record<string, unknown>>(
            client,
            `select public.billing_bill_get($1, $2) as result`,
            [societyId, regularBillA],
          ),
        false,
      );
      expect(bill).toMatchObject({
        unit_number: 'A-1',
        society_name: 'Billing Fines Society',
      });
      const list = await as(
        'admin',
        (client) =>
          one<{ unit_number: string }[]>(
            client,
            `select public.billing_bills_list($1, 100, 0) as result`,
            [societyId],
          ),
        false,
      );
      expect(new Set(list.map((item) => item.unit_number))).toEqual(
        new Set(['A-1', 'B-1']),
      );
    });
  },
);
