// Verify the P43.2 monthly collection report and the P43.3 admin dues follow-up list: month maths, roles and audit.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type MonthRow = {
  month: string;
  bill_count: number;
  billed_paise: string;
  waived_paise: string;
  net_billed_paise: string;
  collected_paise: string;
  collection_percent: number | null;
};
type FollowUpRow = {
  unit_number: string;
  name: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  outstanding_paise: string;
  oldest_due_date: string;
  months_overdue: number;
  last_payment_on: string | null;
  last_payment_paise: string | null;
  awaiting_confirmation: boolean;
};

describe.skipIf(!hasDatabase)(
  'database billing collection and follow-up',
  () => {
    let database: TestDatabase;
    let societyId: string;
    let otherSocietyId: string;
    const users: Record<string, string> = {};

    beforeAll(async () => {
      database = await createTestDatabase();
      await database.asSuperuser(async (client) => {
        for (const name of ['admin', 'committee', 'resident']) {
          const email = `collection-${name}@example.test`;
          users[name] = await newAuthUser(client, email);
          await client.query(
            `insert into public.profiles (id, email, full_name, phone) values ($1, $2, $3, '+919800000001')`,
            [users[name], email, `Synthetic ${name}`],
          );
        }
        const admin = users.admin!;
        const societies = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
         values ('Collection Society', $1), ('Other Collection Society', $1) returning id`,
          [admin],
        );
        [societyId, otherSocietyId] = societies.rows.map(({ id }) => id) as [
          string,
          string,
        ];
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
         select society, module_key, true, '{}'::jsonb
         from unnest(array[$1::uuid, $2::uuid]) as society,
              unnest(array['core', 'billing']) as module_key`,
          [societyId, otherSocietyId],
        );
        const memberships = await client.query<{ id: string; user_id: string }>(
          `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, array['admin']::text[], 'active'),
                ($1, $3, array['committee']::text[], 'active'),
                ($1, $4, array['resident']::text[], 'active'),
                ($5, $2, array['admin']::text[], 'active')
         returning id, user_id`,
          [societyId, admin, users.committee, users.resident, otherSocietyId],
        );
        const units = await client.query<{ id: string; number: string }>(
          `insert into public.units (society_id, number, created_by)
         values ($1, 'A-1', $3), ($1, 'A-2', $3), ($1, 'A-3', $3), ($2, 'Z-1', $3)
         returning id, number`,
          [societyId, otherSocietyId, admin],
        );
        const unit = (number: string) =>
          units.rows.find((row) => row.number === number)!.id;
        const residentMembership = memberships.rows.find(
          (row) => row.user_id === users.resident,
        )!.id;
        await client.query(
          `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
         values ($1, $2, $3, 'owner', true, 'active', $4)`,
          [societyId, unit('A-1'), residentMembership, admin],
        );
        const bills = await client.query<{ id: string; title: string }>(
          `insert into public.billing_bills
           (society_id, unit_id, kind, title, period_start, due_date, total_paise, paid_paise,
            waived_paise, related_bill_id, cancelled_at, cancelled_by, cancel_reason, created_by)
         values ($1, $2, 'regular', 'Jan dues', '2025-01-01', '2025-01-31', 10000, 4000, 1000,
                 null, null, null, null, $5),
                ($1, $2, 'fine', 'Jan fine', '2025-01-01', '2025-01-31', 2000, 0, 0,
                 null, null, null, null, $5),
                ($1, $2, 'regular', 'Cancelled', '2025-01-01', '2025-01-31', 3000, 0, 3000,
                 null, now(), $5, 'Raised twice', $5),
                ($1, $2, 'regular', 'Feb dues', '2025-02-01', '2025-02-28', 10000, 0, 0,
                 null, null, null, null, $5),
                ($1, $3, 'regular', 'Feb dues', '2025-02-01', '2025-02-28', 8000, 8000, 0,
                 null, null, null, null, $5),
                ($1, $4, 'regular', 'Feb dues', '2025-02-01', '2025-02-28', 6000, 0, 0,
                 null, null, null, null, $5),
                ($6, $7, 'regular', 'Other', '2025-01-01', '2025-01-31', 9000, 9000, 0,
                 null, null, null, null, $5)
         returning id, title`,
          [
            societyId,
            unit('A-1'),
            unit('A-2'),
            unit('A-3'),
            admin,
            otherSocietyId,
            unit('Z-1'),
          ],
        );
        const payments = await client.query<{ id: string; reference: string }>(
          `insert into public.billing_payments
           (society_id, unit_id, amount_paise, mode, source, reference, paid_on, status,
            submitted_by, confirmed_by, confirmed_at, receipt_no, client_request_id, created_by)
         values ($1, $2, 4000, 'upi', 'admin_recorded', 'COLLECT001', '2025-02-05', 'confirmed',
                 $4, $4, now(), 'R-2025-000001', gen_random_uuid(), $4),
                ($1, $3, 8000, 'upi', 'admin_recorded', 'COLLECT002', '2025-03-02', 'confirmed',
                 $4, $4, now(), 'R-2025-000002', gen_random_uuid(), $4),
                ($1, $2, 2000, 'upi', 'resident_submitted', 'COLLECT003', current_date,
                 'awaiting_confirmation', $5, null, null, null, gen_random_uuid(), $5),
                ($6, $7, 9000, 'upi', 'admin_recorded', 'COLLECT004', '2025-02-01', 'confirmed',
                 $4, $4, now(), 'R-2025-000003', gen_random_uuid(), $4)
         returning id, reference`,
          [
            societyId,
            unit('A-1'),
            unit('A-2'),
            admin,
            users.resident,
            otherSocietyId,
            unit('Z-1'),
          ],
        );
        const payment = (reference: string) =>
          payments.rows.find((row) => row.reference === reference)!.id;
        const billId = (title: string, index = 0) =>
          bills.rows.filter((row) => row.title === title)[index]!.id;
        await client.query(
          `insert into public.billing_payment_allocations
           (society_id, payment_id, bill_id, unit_id, amount_paise)
         values ($1, $2, $3, $4, 4000), ($1, $5, $6, $7, 8000), ($8, $9, $10, $11, 9000)`,
          [
            societyId,
            payment('COLLECT001'),
            billId('Jan dues'),
            unit('A-1'),
            payment('COLLECT002'),
            billId('Feb dues', 1),
            unit('A-2'),
            otherSocietyId,
            payment('COLLECT004'),
            billId('Other'),
            unit('Z-1'),
          ],
        );
      });
    });

    afterAll(async () => {
      await database?.drop();
    });

    function as<T>(
      userId: string,
      sql: string,
      params: unknown[],
      commit = false,
    ) {
      return database.asRole(
        'authenticated',
        { sub: userId },
        async (client) =>
          (await client.query<{ result: T }>(sql, params)).rows[0]!.result,
        { commit },
      );
    }
    const monthly = (userId: string, from = '2025-01-01', to = '2025-03-01') =>
      as<{ rows: MonthRow[] }>(
        userId,
        'select public.billing_monthly_collection($1, $2, $3) as result',
        [societyId, from, to],
      );
    const followUp = (userId: string, purpose = 'view', commit = false) =>
      as<{ today: string; rows: FollowUpRow[] }>(
        userId,
        'select public.billing_dues_follow_up($1, $2, $3) as result',
        [societyId, purpose, `request-${purpose}`],
        commit,
      );

    it('reports billed, waived and confirmed collections per bill month', async () => {
      const { rows } = await monthly(users.committee!);
      expect(rows).toEqual([
        {
          month: '2025-01-01',
          bill_count: 2,
          billed_paise: '12000',
          waived_paise: '1000',
          net_billed_paise: '11000',
          collected_paise: '4000',
          collection_percent: 36.4,
        },
        {
          month: '2025-02-01',
          bill_count: 3,
          billed_paise: '24000',
          waived_paise: '0',
          net_billed_paise: '24000',
          collected_paise: '8000',
          collection_percent: 33.3,
        },
        {
          month: '2025-03-01',
          bill_count: 0,
          billed_paise: '0',
          waived_paise: '0',
          net_billed_paise: '0',
          collected_paise: '0',
          collection_percent: null,
        },
      ]);
    });

    it('limits the monthly report to 24 months and to admins and committee', async () => {
      expect(
        await dbError(monthly(users.admin!, '2023-01-01', '2025-01-01')),
      ).toMatchObject({ code: '22023' });
      expect(await dbError(monthly(users.resident!))).toMatchObject({
        code: '42501',
      });
      expect(
        await dbError(
          as(
            users.committee!,
            'select public.billing_monthly_collection_export_record($1, $2, $3, $4) as result',
            [societyId, '2025-01-01', '2025-03-01', 'committee-export'],
          ),
        ),
      ).toMatchObject({ code: '42501' });
    });

    it('lists units with unpaid amounts and contacts for admins only', async () => {
      const { rows } = await followUp(users.admin!);
      expect(rows.map((row) => row.unit_number)).toEqual(['A-1', 'A-3']);
      expect(rows[0]).toMatchObject({
        name: 'Synthetic resident',
        relationship: 'owner',
        phone: '+919800000001',
        email: 'collection-resident@example.test',
        outstanding_paise: '17000',
        oldest_due_date: '2025-01-31',
        last_payment_on: '2025-02-05',
        last_payment_paise: '4000',
        awaiting_confirmation: true,
      });
      expect(rows[0]!.months_overdue).toBeGreaterThanOrEqual(12);
      expect(rows[1]).toMatchObject({
        name: null,
        phone: null,
        outstanding_paise: '6000',
        last_payment_on: null,
        awaiting_confirmation: false,
      });
      for (const user of [users.committee!, users.resident!]) {
        expect(await dbError(followUp(user))).toMatchObject({ code: '42501' });
      }
      expect(await dbError(followUp(users.admin!, 'share'))).toMatchObject({
        code: '22023',
      });
    });

    it('audits every follow-up view and export and the monthly export', async () => {
      await followUp(users.admin!, 'view', true);
      await followUp(users.admin!, 'export', true);
      await as(
        users.admin!,
        'select public.billing_monthly_collection_export_record($1, $2, $3, $4) as result',
        [societyId, '2025-01-15', '2025-03-01', 'monthly-export'],
        true,
      );
      const audit = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ action: string; after: unknown }>(
              `select action, "after" from public.audit_logs
             where society_id = $1 and action like 'billing.%' order by created_at, action`,
              [societyId],
            )
          ).rows,
      );
      expect(audit).toEqual(
        expect.arrayContaining([
          { action: 'billing.dues_follow_up.view', after: { row_count: 2 } },
          { action: 'billing.dues_follow_up.export', after: { row_count: 2 } },
          {
            action: 'billing.monthly_collection.export',
            after: { from_month: '2025-01-01', to_month: '2025-03-01' },
          },
        ]),
      );
    });
  },
);
