// Operations analytics metrics: exact figures on small seeded data, IST month buckets, isolation and empty shape.
import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { createTestDatabase, hasDatabase } from './support/database';
import {
  type AnalyticsMetricResult,
  type AnalyticsSociety,
  OPERATIONS_METRICS,
  OPERATIONS_MODULES,
  addMember,
  createAnalyticsFixture,
  createAnalyticsSociety,
  dashboard,
  enableModules,
  newUser,
  pickMetric,
  pointValues,
  setMetrics,
} from './support/analytics-fixtures';

interface Dates {
  today: string;
  m0: string;
  m1: string;
  m2: string;
  mOld: string;
  m13: string;
}

const IST = `'Asia/Kolkata'`;
// Society-local midnight of a date expression, as an instant.
const at = (day: string, hours = 0) =>
  `((${day})::timestamp AT TIME ZONE ${IST} + interval '${hours} hours')`;

async function societyDates(client: Client, societyId: string): Promise<Dates> {
  const result = await client.query<Dates>(
    `select t::text as today,
            date_trunc('month', t)::date::text as m0,
            (date_trunc('month', t) - interval '1 month')::date::text as m1,
            (date_trunc('month', t) - interval '2 months')::date::text as m2,
            date_trunc('month', t - 120)::date::text as "mOld",
            (date_trunc('month', t) - interval '13 months')::date::text as m13
     from (select private.analytics_today($1) as t) as today`,
    [societyId],
  );
  return result.rows[0]!;
}

async function id(
  client: Client,
  sql: string,
  params: unknown[],
): Promise<string> {
  return (await client.query<{ id: string }>(sql, params)).rows[0]!.id;
}

/** Seeds the same small data set into one society (dates relative to its local today). */
async function seedOperations(
  client: Client,
  s: AnalyticsSociety,
  d: Dates,
): Promise<void> {
  const admin = s.users.admin;
  const r0 = s.users.resident;
  const extra = [];
  for (const label of ['r1', 'r2', 'r3']) {
    const userId = await newUser(client, label);
    extra.push({
      userId,
      membershipId: await addMember(client, s.id, userId, ['resident']),
    });
  }
  const [r1, r2, r3] = extra as [
    (typeof extra)[0],
    (typeof extra)[0],
    (typeof extra)[0],
  ];
  const developer = await newUser(client, 'developer');
  await client.query('insert into public.developers (user_id) values ($1)', [
    developer,
  ]);
  await addMember(client, s.id, developer, ['admin']);

  // Units: u0, u1, u3 in block A, u2 in block B, u4 inactive.
  const units: string[] = [];
  for (const [number, block, active] of [
    ['101', 0, true],
    ['102', 0, true],
    ['201', 1, true],
    ['103', 0, true],
    ['104', 0, false],
  ] as const) {
    units.push(
      await id(
        client,
        `insert into public.units (society_id, block_id, number, active, created_by)
         values ($1, $2, $3, $4, $5) returning id`,
        [s.id, s.blockIds[block], number, active, admin],
      ),
    );
  }
  const [u0, u1, u2, , u4] = units as [string, string, string, string, string];
  for (const [unit, membership, relationship] of [
    [u0, s.memberships.resident, 'owner'],
    [u1, r1.membershipId, 'tenant'],
    [u1, r2.membershipId, 'owner'],
    [u2, r3.membershipId, 'family'],
    [u4, s.memberships.resident, 'owner'],
  ]) {
    await client.query(
      `insert into public.unit_occupants (society_id, unit_id, membership_id, relationship, status, created_by)
       values ($1, $2, $3, $4, 'active', $5)`,
      [s.id, unit, membership, relationship, admin],
    );
  }

  // Members: six joined two months ago, two last month; the developer is never counted.
  await client.query(
    `update public.memberships set joined_at = ${at('$2::date + 3', 12)} where society_id = $1`,
    [s.id, d.m2],
  );
  await client.query(
    `update public.memberships set joined_at = ${at('$2::date + 4', 12)}
     where society_id = $1 and user_id = any ($3::uuid[])`,
    [s.id, d.m1, [r1.userId, r2.userId, developer]],
  );

  // Billing.
  for (const [period, due, total, paid, waived, cancelled] of [
    ['m1', 5, 1000, 0, 0, false],
    ['m1', -10, 2000, 500, 0, false],
    ['m1', -10, 6000, 6000, 0, false],
    ['m1', -10, 800, 0, 800, false],
    ['m1', -10, 7000, 0, 7000, true],
    ['mOld', -45, 3000, 0, 0, false],
    ['mOld', -75, 4000, 0, 1000, false],
    ['mOld', -120, 5000, 0, 0, false],
  ] as const) {
    await client.query(
      `insert into public.billing_bills (
         society_id, unit_id, kind, title, period_start, due_date, total_paise, paid_paise, waived_paise,
         created_by, cancelled_at, cancelled_by, cancel_reason)
       values ($1, $2, 'regular', 'Maintenance', $3, $4::date + $5::integer, $6, $7, $8, $9,
         case when $10 then now() end, case when $10 then $9::uuid end, case when $10 then 'Duplicate' end)`,
      [
        s.id,
        u0,
        period === 'm1' ? d.m1 : d.mOld,
        d.today,
        due,
        total,
        paid,
        waived,
        admin,
        cancelled,
      ],
    );
  }
  const payment = (
    amount: number,
    paidOn: string,
    status: string,
    receipt: string | null,
  ) =>
    id(
      client,
      `insert into public.billing_payments (
         society_id, unit_id, amount_paise, mode, source, paid_on, status, submitted_by, confirmed_by,
         confirmed_at, rejected_at, reject_reason, receipt_no, client_request_id, created_by)
       values ($1, $2, $3, 'cash',
         case when $5 = 'confirmed' then 'admin_recorded' else 'resident_submitted' end, $4, $5, $6,
         case when $5 = 'confirmed' then $7::uuid end, case when $5 = 'confirmed' then now() end,
         case when $5 = 'rejected' then now() end, case when $5 = 'rejected' then 'Not received' end,
         $8, gen_random_uuid(), $6)
       returning id`,
      [s.id, u0, amount, paidOn, status, r0, admin, receipt],
    );
  const collected = await payment(
    2000,
    `${d.m1.slice(0, 8)}02`,
    'confirmed',
    'R-2026-000001',
  );
  await payment(999, `${d.m1.slice(0, 8)}02`, 'rejected', null);
  await payment(777, `${d.m1.slice(0, 8)}02`, 'awaiting_confirmation', null);
  await payment(500, `${d.m13.slice(0, 8)}02`, 'confirmed', 'R-2026-000002');

  // Expense book: categories are seeded when the module is enabled.
  const account = await id(
    client,
    `insert into public.expense_accounts (society_id, name, account_type, opening_on, created_by)
     values ($1, 'Bank', 'bank', $2::date - 30, $3) returning id`,
    [s.id, d.m13, admin],
  );
  const category = async (name: string) =>
    id(
      client,
      'select id from public.expense_categories where society_id = $1 and name = $2',
      [s.id, name],
    );
  const entry = (values: {
    day: string;
    direction: 'in' | 'out';
    amount: number;
    source: string;
    categoryId?: string;
    expenseId?: string;
    incomeKind?: string;
    paymentId?: string;
    reverses?: string;
  }) =>
    id(
      client,
      `insert into public.expense_book_entries (
         society_id, account_id, entry_date, direction, amount_paise, source, expense_id, category_id,
         income_kind, billing_payment_id, reverses_entry_id, counterparty, description, client_request_id,
         created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Synthetic', 'Synthetic entry',
         gen_random_uuid(), $12)
       returning id`,
      [
        s.id,
        account,
        values.day,
        values.direction,
        values.amount,
        values.source,
        values.expenseId ?? null,
        values.categoryId ?? null,
        values.incomeKind ?? null,
        values.paymentId ?? null,
        values.reverses ?? null,
        admin,
      ],
    );
  const spend = async (name: string, amount: number, day: string) => {
    const categoryId = await category(name);
    const expenseId = await id(
      client,
      `insert into public.expenses (
         society_id, account_id, category_id, spent_on, payee, amount_paise, payment_mode,
         approval_required, status, client_request_id, created_by)
       values ($1, $2, $3, $4, 'Vendor', $5, 'cash', false, 'posted', gen_random_uuid(), $6)
       returning id`,
      [s.id, account, categoryId, day, amount, admin],
    );
    const entryId = await entry({
      day,
      direction: 'out',
      amount,
      source: 'expense',
      categoryId,
      expenseId,
    });
    return { categoryId, entryId };
  };
  const day = (offset: number) =>
    `${d.m1.slice(0, 8)}${String(offset).padStart(2, '0')}`;
  await spend('Repairs', 5000, day(3));
  const utilities = await spend('Utilities', 3000, day(3));
  await entry({
    day: day(4),
    direction: 'in',
    amount: 1000,
    source: 'reversal',
    categoryId: utilities.categoryId,
    reverses: utilities.entryId,
  });
  const security = await spend('Security', 400, day(3));
  await entry({
    day: day(4),
    direction: 'in',
    amount: 400,
    source: 'reversal',
    categoryId: security.categoryId,
    reverses: security.entryId,
  });
  const donation = await entry({
    day: day(4),
    direction: 'in',
    amount: 7000,
    source: 'income',
    incomeKind: 'donation',
  });
  await entry({
    day: day(2),
    direction: 'in',
    amount: 2000,
    source: 'billing_payment',
    paymentId: collected,
  });
  await entry({
    day: day(5),
    direction: 'out',
    amount: 500,
    source: 'reversal',
    reverses: donation,
  });
  await spend('Repairs', 9999, `${d.m13.slice(0, 8)}02`);

  // Service requests (created at 06:00 local on the 2nd of last month).
  const plumbing = await id(
    client,
    `insert into public.service_request_categories (society_id, name, sla_hours)
     values ($1, 'Test plumbing', 24) returning id`,
    [s.id],
  );
  const lifts = await id(
    client,
    `insert into public.service_request_categories (society_id, name)
     values ($1, 'Test lifts') returning id`,
    [s.id],
  );
  const base = at(`'${day(2)}'::date`, 6);
  for (const [categoryId, status, resolvedDays, slaDays, created] of [
    [plumbing, 'resolved', 2, 3, base],
    [plumbing, 'closed', 4, 3, base],
    [lifts, 'resolved', 3, null, base],
    [plumbing, 'open', null, 3, base],
    [lifts, 'in_progress', null, null, base],
    [plumbing, 'reopened', null, 3, base],
    [plumbing, 'rejected', null, 3, base],
    [plumbing, 'resolved', 1, 3, at(`'${d.m13}'::date`, 6)],
  ] as const) {
    await client.query(
      `insert into public.service_requests (
         society_id, category_id, location_type, description, status, created_by, created_at, sla_due_at,
         resolved_at, closed_at, reject_reason, client_request_id)
       values ($1, $2, 'common_area', 'Synthetic request', $3, $4, ${created},
         ${created} + make_interval(days => $5::integer),
         ${created} + make_interval(days => $6::integer),
         case when $3 = 'closed' then ${created} + interval '5 days' end,
         case when $3 = 'rejected' then 'Duplicate' end, gen_random_uuid())`,
      [s.id, categoryId, status, r0, slaDays, resolvedDays],
    );
  }

  // Amenities.
  const amenity = async (name: string) => {
    const amenityId = await id(
      client,
      `insert into public.amenities (society_id, name, capacity, created_by, updated_by, client_request_id)
       values ($1, $2, 10, $3, $3, gen_random_uuid()) returning id`,
      [s.id, name, admin],
    );
    const slotId = await id(
      client,
      `insert into public.amenity_slots (society_id, amenity_id, weekday, starts_local, ends_local)
       values ($1, $2, 0, '10:00', '11:00') returning id`,
      [s.id, amenityId],
    );
    return { amenityId, slotId, name };
  };
  const clubhouse = await amenity('Clubhouse');
  const pool = await amenity('Pool');
  for (const [target, startDay, status] of [
    [clubhouse, day(2), 'confirmed'],
    [clubhouse, day(3), 'confirmed'],
    [clubhouse, day(2), 'cancelled'],
    [pool, day(2), 'confirmed'],
    [pool, `${d.m13.slice(0, 8)}02`, 'confirmed'],
  ] as const) {
    await client.query(
      `insert into public.amenity_bookings (
         society_id, amenity_id, slot_id, unit_id, booked_by, starts_at, ends_at, amenity_name, capacity,
         guest_count, fee_paise, rules_snapshot, rules_accepted, status, cancelled_at, cancelled_by,
         cancel_reason, client_request_id)
       values ($1, $2, $3, $4, $5, ${at('$6::date', 10)}, ${at('$6::date', 11)}, $7, 10, 1, 0, '', false,
         $8, case when $8 = 'cancelled' then now() end, case when $8 = 'cancelled' then $5::uuid end,
         case when $8 = 'cancelled' then 'Plans changed' end, gen_random_uuid())`,
      [
        s.id,
        target.amenityId,
        target.slotId,
        u0,
        r0,
        startDay,
        target.name,
        status,
      ],
    );
  }

  // Visitors: two at 10:00 local, one a minute before and one a minute after local midnight that starts
  // this month (both at 18:2x/18:3x UTC on the same UTC day).
  for (const [checkedIn, status] of [
    [at(`'${day(3)}'::date`, 10), 'checked_in'],
    [`${at(`'${day(3)}'::date`, 10)} + interval '30 minutes'`, 'checked_out'],
    [`${at(`'${d.m0}'::date`)} - interval '1 minute'`, 'checked_in'],
    [`${at(`'${d.m0}'::date`)} + interval '1 minute'`, 'checked_in'],
    ['null::timestamptz', 'pending'],
    [at(`'${d.m13}'::date`, 10), 'checked_in'],
  ] as const) {
    await client.query(
      `insert into public.visitor_entries (
         society_id, unit_id, visitor_name, purpose, status, checked_in_at, checked_out_at,
         handled_by_guard_id, created_by)
       values ($1, $2, 'Synthetic visitor', 'guest', $3, ${checkedIn},
         case when $3 = 'checked_out' then ${checkedIn} + interval '1 hour' end, $4, $5)`,
      [s.id, u0, status, s.guardRosterId, s.users.guard],
    );
  }

  // Deliveries.
  const created = at(`'${day(4)}'::date`, 12);
  for (const [status, createdAt, receivedAt] of [
    ['left_at_gate', created, `now() - interval '5 days'`],
    ['left_at_gate', 'now()', `now() - interval '1 hour'`],
    ['collected', created, created],
    ['pending_response', created, 'null'],
    ['pending_response', at(`'${d.m13}'::date`, 12), 'null'],
  ] as const) {
    await client.query(
      `insert into public.delivery_entries (
         society_id, unit_id, company, delivery_type, status, client_request_id, handled_by_guard_id,
         created_by, created_at, respond_by, decision_source, decided_at, received_at, collected_at,
         collected_by)
       values ($1, $2, 'Courier', 'parcel', $3, gen_random_uuid(), $4, $5, ${createdAt},
         case when $3 = 'pending_response' then ${createdAt} + interval '10 minutes' end,
         case when $3 <> 'pending_response' then 'resident' end,
         case when $3 <> 'pending_response' then ${createdAt} end,
         ${receivedAt},
         case when $3 = 'collected' then ${createdAt} + interval '1 hour' end,
         case when $3 = 'collected' then $6::uuid end)`,
      [s.id, u0, status, s.guardRosterId, s.users.guard, r0],
    );
  }

  // Staff.
  const staff = async (type: string, status: string) =>
    id(
      client,
      `insert into public.staff_members (society_id, staff_type, full_name, phone, job_role, status, created_by)
       values ($1, $2, 'Synthetic staff', '9876543210', 'Cleaner', $3, $4) returning id`,
      [s.id, type, status, admin],
    );
  const staffA = await staff('society', 'active');
  const staffB = await staff('society', 'active');
  await staff('domestic', 'active');
  await staff('society', 'blocked');
  for (const [staffId, attendanceDay, status] of [
    [staffA, day(1), 'present'],
    [staffA, day(2), 'present'],
    [staffA, day(3), 'absent'],
    [staffA, day(4), 'leave'],
    [staffB, day(1), 'present'],
    [staffA, `${d.m13.slice(0, 8)}02`, 'absent'],
  ]) {
    await client.query(
      `insert into public.staff_shift_attendance (society_id, staff_id, attendance_date, status, marked_by)
       values ($1, $2, $3, $4, $5)`,
      [s.id, staffId, attendanceDay, status, admin],
    );
  }

  // Housekeeping stock.
  const item = async (name: string, minimum: number, active = true) =>
    id(
      client,
      `insert into public.housekeeping_items (
         society_id, name, unit_of_measure, category, minimum_stock, active, created_by, updated_by)
       values ($1, $2, 'litre', 'cleaning', $3, $4, $5, $5) returning id`,
      [s.id, name, minimum, active, admin],
    );
  const itemA = await item('Floor cleaner', 5);
  const itemB = await item('Hand wash', 2);
  const itemC = await item('Mops', 1);
  await item('Retired item', 5, false);
  for (const [itemId, kind, quantity, effective] of [
    [itemA, 'in', 10, d.m2],
    [itemA, 'out', -3.5, day(2)],
    [itemA, 'out', -2, day(3)],
    [itemB, 'in', 5, d.m2],
    [itemB, 'out', -5, day(3)],
    [itemC, 'in', 20, d.m13],
    [itemC, 'out', -1, d.m13],
  ] as const) {
    await client.query(
      `insert into public.housekeeping_transactions (
         society_id, item_id, kind, quantity, effective_date, purpose, created_by, client_request_id)
       values ($1, $2, $3, $4, $5, case when $3 = 'out' then 'Daily cleaning' end, $6, gen_random_uuid())`,
      [s.id, itemId, kind, quantity, effective, admin],
    );
  }

  // AMC contracts relative to today; the 20-day contract is already renewed.
  const contract = (start: number, end: number, predecessor: string | null) =>
    id(
      client,
      `insert into public.amc_contracts (
         society_id, asset_label, vendor_name, vendor_contact, start_date, end_date, cost_paise,
         payment_terms, visit_frequency, predecessor_id, created_by, updated_by, client_request_id)
       values ($1, 'Lift', 'Vendor', 'vendor@example.test', $2::date + $3::integer, $2::date + $4::integer, 0,
         '', 'Quarterly', $5, $6, $6, gen_random_uuid())
       returning id`,
      [s.id, d.today, start, end, predecessor, admin],
    );
  const lift = await contract(-300, 10, null);
  await contract(-300, 45, null);
  const renewed = await contract(-300, 20, null);
  await contract(21, 400, renewed);
  await contract(-300, -1, null);
  await contract(-300, 90, null);
  for (const visitDay of [day(6), day(7), `${d.m2.slice(0, 8)}06`]) {
    await client.query(
      `insert into public.amc_visits (
         society_id, contract_id, visit_date, summary, technician, created_by, updated_by, client_request_id)
       values ($1, $2, $3, 'Routine service', 'Technician', $4, $4, gen_random_uuid())`,
      [s.id, lift, visitDay, admin],
    );
  }

  // Notices: residents are r0..r3; owners of active units are r0 and r2; block B holds only r3.
  const notice = (audience: string, createdAt: string, withdrawn = false) =>
    id(
      client,
      `insert into public.notices (
         society_id, title, body, audience, status, withdrawn_at, withdrawn_by, created_by, created_at,
         client_request_id)
       values ($1, 'Synthetic notice', 'Body', $2, $3, case when $3 = 'withdrawn' then now() end,
         case when $3 = 'withdrawn' then $4::uuid end, $4, ${createdAt}, gen_random_uuid())
       returning id`,
      [s.id, audience, withdrawn ? 'withdrawn' : 'published', admin],
    );
  const noticeAll = await notice('all', at(`'${day(3)}'::date`, 9));
  const noticeOwners = await notice('owners', at(`'${day(3)}'::date`, 9));
  const noticeBlock = await notice('blocks', at(`'${day(3)}'::date`, 9));
  const noticeWithdrawn = await notice('all', at(`'${day(3)}'::date`, 9), true);
  await notice('all', 'now()');
  await client.query(
    `insert into public.notice_blocks (society_id, notice_id, block_id) values ($1, $2, $3)`,
    [s.id, noticeBlock, s.blockIds[1]],
  );
  for (const [noticeId, userId] of [
    [noticeAll, r0],
    [noticeAll, r1.userId],
    [noticeOwners, r0],
    [noticeBlock, r3.userId],
    [noticeBlock, r0],
    [noticeWithdrawn, r0],
  ]) {
    await client.query(
      `insert into public.notice_reads (society_id, notice_id, user_id) values ($1, $2, $3)`,
      [s.id, noticeId, userId],
    );
  }
}

const sumPoints = (metric: AnalyticsMetricResult, key: string) =>
  (metric.points ?? []).reduce(
    (total, point) => total + Number(point.values[key] ?? 0),
    0,
  );

describe.skipIf(!hasDatabase)('analytics operations metrics', () => {
  it('computes every operations metric for one society only', async () => {
    const database = await createTestDatabase();
    try {
      const { a, b } = await createAnalyticsFixture(database);
      for (const society of [a, b]) {
        await enableModules(database, society.id, OPERATIONS_MODULES);
        await setMetrics(database, society, OPERATIONS_METRICS);
      }
      const dates = await database.asSuperuser(async (client) => {
        const d = await societyDates(client, a.id);
        // Identical data in B proves that A's figures never include another society.
        await seedOperations(client, a, d);
        await seedOperations(client, b, d);
        return d;
      });
      const p1 = dates.m1.slice(0, 7);
      const p2 = dates.m2.slice(0, 7);
      const p0 = dates.m0.slice(0, 7);
      const pOld = dates.mOld.slice(0, 7);

      const result = await dashboard(database, a.users.committee, a.id);
      expect(result.metrics.map((metric) => metric.key)).toEqual([
        ...OPERATIONS_METRICS,
      ]);
      const metric = (key: string) => pickMetric(result, key);
      for (const item of result.metrics) {
        if (item.kind === 'trend') {
          expect(item.points, item.key).toHaveLength(12);
          expect(item.points!.at(-1)!.period).toBe(p0);
        }
      }

      expect(metric('core.occupancy')).toMatchObject({
        kind: 'stat',
        unit: 'count',
        values: {
          occupied: 3,
          vacant: 1,
          owner_occupied: 2,
          tenant_occupied: 1,
        },
      });
      const members = metric('core.members_trend');
      expect(pointValues(members, p1)).toEqual({ new_members: 2 });
      expect(pointValues(members, p2)).toEqual({ new_members: 6 });
      expect(sumPoints(members, 'new_members')).toBe(8);

      expect(metric('billing.dues_ageing')).toMatchObject({
        kind: 'stat',
        unit: 'paise',
        values: {
          not_due: 1000,
          d0_30: 1500,
          d31_60: 3000,
          d61_90: 3000,
          d90_plus: 5000,
        },
      });
      const collection = metric('billing.collection_trend');
      expect(collection.unit).toBe('paise');
      expect(pointValues(collection, p1)).toEqual({
        billed: 9800,
        collected: 2000,
      });
      expect(pointValues(collection, pOld)).toEqual({
        billed: 12000,
        collected: 0,
      });
      expect(sumPoints(collection, 'billed')).toBe(21800);
      expect(sumPoints(collection, 'collected')).toBe(2000);
      const rate = metric('billing.collection_rate');
      expect(pointValues(rate, p1)).toEqual({ rate: 50 });
      expect(pointValues(rate, pOld)).toEqual({ rate: 0 });
      expect(pointValues(rate, p0)).toEqual({ rate: null });

      const money = metric('expense.income_vs_expense');
      expect(pointValues(money, p1)).toEqual({ income: 8500, expense: 7000 });
      expect(sumPoints(money, 'expense')).toBe(7000);
      expect(metric('expense.by_category').items).toEqual([
        { label: 'Repairs', values: { amount: 5000 } },
        { label: 'Utilities', values: { amount: 2000 } },
      ]);

      expect(pointValues(metric('service_request.sla'), p1)).toEqual({
        within_sla: 1,
        breached: 1,
      });
      expect(sumPoints(metric('service_request.sla'), 'breached')).toBe(1);
      expect(metric('service_request.open_by_category').items).toEqual([
        { label: 'Test plumbing', values: { open: 2 } },
        { label: 'Test lifts', values: { open: 1 } },
      ]);
      const resolution = metric('service_request.resolution_time');
      expect(resolution.unit).toBe('days');
      expect(pointValues(resolution, p1)).toEqual({ average_days: 3 });
      expect(pointValues(resolution, p2)).toEqual({ average_days: null });

      expect(metric('amenity.usage').items).toEqual([
        { label: 'Clubhouse', values: { bookings: 2 } },
        { label: 'Pool', values: { bookings: 1 } },
      ]);
      expect(pointValues(metric('amenity.cancellations'), p1)).toEqual({
        confirmed: 3,
        cancelled: 1,
      });

      // 23:59 local on the last day of last month counts there; 00:01 local counts this month.
      const visitors = metric('visitor.trend');
      expect(pointValues(visitors, p1)).toEqual({ entries: 3 });
      expect(pointValues(visitors, p0)).toEqual({ entries: 1 });
      const hours = metric('visitor.peak_hours').items!;
      expect(hours.map((item) => item.label)).toEqual(
        Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')),
      );
      expect(
        Object.fromEntries(
          hours
            .filter((item) => item.values.entries !== 0)
            .map((item) => [item.label, item.values.entries]),
        ),
      ).toEqual({ '00': 1, '10': 2, '23': 1 });

      expect(pointValues(metric('delivery.trend'), p1)).toEqual({
        received: 3,
      });
      expect(pointValues(metric('delivery.trend'), p0)).toEqual({
        received: 1,
      });
      expect(metric('delivery.uncollected').values).toEqual({
        waiting: 2,
        older_than_3_days: 1,
      });

      expect(pointValues(metric('staff.attendance_rate'), p1)).toEqual({
        rate: 75,
      });
      expect(metric('staff.active_by_type').items).toEqual([
        { label: 'Society staff', values: { staff: 2 } },
        { label: 'Domestic staff', values: { staff: 1 } },
      ]);

      const consumption = metric('housekeeping.consumption');
      expect(consumption.unit).toBe('quantity');
      expect(pointValues(consumption, p1)).toEqual({ issued: 10.5 });
      expect(sumPoints(consumption, 'issued')).toBe(10.5);
      expect(metric('housekeeping.low_stock').values).toEqual({
        low_stock: 2,
        out_of_stock: 1,
      });

      expect(metric('amc.expiring').values).toEqual({
        next_30_days: 1,
        next_60_days: 2,
      });
      expect(pointValues(metric('amc.visits'), p1)).toEqual({ completed: 2 });
      expect(pointValues(metric('amc.visits'), p2)).toEqual({ completed: 1 });

      expect(pointValues(metric('notice.published'), p1)).toEqual({
        published: 3,
      });
      expect(pointValues(metric('notice.published'), p0)).toEqual({
        published: 1,
      });
      expect(pointValues(metric('notice.read_rate'), p1)).toEqual({
        rate: 66.7,
      });
      expect(pointValues(metric('notice.read_rate'), p0)).toEqual({ rate: 0 });

      // The three-month view drops older months from trends but not from today's figures.
      const short = await dashboard(database, a.users.admin, a.id, 3);
      expect(pickMetric(short, 'billing.collection_trend').points).toHaveLength(
        3,
      );
      expect(pickMetric(short, 'billing.dues_ageing').values).toEqual(
        metric('billing.dues_ageing').values,
      );
      expect(pickMetric(short, 'amenity.usage').items).toEqual(
        metric('amenity.usage').items,
      );
    } finally {
      await database.drop();
    }
  });

  it('returns empty-shaped results for a society without data', async () => {
    const database = await createTestDatabase();
    try {
      const society = await database.asSuperuser((client) =>
        createAnalyticsSociety(client, 'Empty society'),
      );
      await enableModules(database, society.id, OPERATIONS_MODULES);
      await setMetrics(database, society, OPERATIONS_METRICS);
      const result = await dashboard(database, society.users.admin, society.id);
      expect(result.metrics).toHaveLength(OPERATIONS_METRICS.length);
      for (const item of result.metrics) {
        expect(item.series.length, item.key).toBeGreaterThan(0);
        if (item.kind === 'trend') {
          expect(item.points, item.key).toHaveLength(12);
          if (item.key === 'core.members_trend') continue;
          for (const point of item.points!) {
            for (const { key } of item.series) {
              expect([0, null], `${item.key} ${key}`).toContain(
                point.values[key],
              );
            }
          }
        } else if (item.kind === 'breakdown') {
          if (item.key === 'visitor.peak_hours') {
            expect(item.items).toHaveLength(24);
            expect(
              item.items!.every((entry) => entry.values.entries === 0),
            ).toBe(true);
          } else {
            expect(item.items, item.key).toEqual([]);
          }
        } else {
          expect(Object.keys(item.values!).sort(), item.key).toEqual(
            item.series.map(({ key }) => key).sort(),
          );
          expect(
            Object.values(item.values!).every((value) => value === 0),
            item.key,
          ).toBe(true);
        }
      }
      // Members created today are the only activity in an otherwise empty society.
      expect(
        pointValues(
          pickMetric(result, 'core.members_trend'),
          result.today.slice(0, 7),
        ),
      ).toEqual({ new_members: 5 });
    } finally {
      await database.drop();
    }
  });
});
