// Opt-in (PERF_ANALYTICS=1) timing of the full analytics dashboard on a 500-unit society with a year of data.
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { ANALYTICS_METRICS } from '../../src/core/analytics/catalogue';
import { createTestDatabase, hasDatabase } from './support/database';
import {
  createAnalyticsFixture,
  dashboard,
  enableModules,
  setMetrics,
} from './support/analytics-fixtures';

const TARGET_MS = 2000;

describe.skipIf(!hasDatabase || process.env.PERF_ANALYTICS !== '1')(
  'analytics dashboard performance',
  () => {
    it(`returns all metrics for a busy society in under ${TARGET_MS} ms`, async () => {
      const database = await createTestDatabase();
      try {
        const { a } = await createAnalyticsFixture(database);
        const modules = await database.asSuperuser(async (client) =>
          (
            await client.query<{ key: string }>(
              'select key from public.modules order by key',
            )
          ).rows.map((row) => row.key),
        );
        await enableModules(database, a.id, modules);
        await setMetrics(
          database,
          a,
          ANALYTICS_METRICS.map((metric) => metric.key),
        );

        const account = crypto.randomUUID();
        // Values are generated UUIDs, never caller input, so they are inlined into the seeding script.
        const seed = `
          create temp table perf_today as select private.analytics_today('${a.id}') as t;
          create temp table perf_people as
            select n, gen_random_uuid() as user_id from generate_series(1, 500) as n;
          insert into auth.users (id, email)
            select user_id, 'perf-' || n || '@example.test' from perf_people;
          insert into public.profiles (id, email, full_name)
            select user_id, 'perf-' || n || '@example.test', 'Perf ' || n from perf_people;
          insert into public.memberships (society_id, user_id, roles, status)
            select '${a.id}', user_id, array['resident'], 'active' from perf_people;
          insert into public.units (society_id, block_id, number, created_by)
            select '${a.id}', case when n % 2 = 0 then '${a.blockIds[0]}' else '${a.blockIds[1]}' end::uuid,
              'P' || n, '${a.users.admin}'
            from generate_series(1, 500) as n;
          insert into public.unit_occupants (society_id, unit_id, membership_id, relationship, status, created_by)
            select '${a.id}', unit.id, membership.id, 'owner', 'active', '${a.users.admin}'
            from perf_people as person
            join public.units as unit on unit.society_id = '${a.id}' and unit.number = 'P' || person.n
            join public.memberships as membership
              on membership.society_id = '${a.id}' and membership.user_id = person.user_id;

          insert into public.billing_bills (
            society_id, unit_id, kind, title, period_start, due_date, total_paise, paid_paise, waived_paise, created_by)
            select '${a.id}', unit.id, 'regular', 'Maintenance', month.start, month.start + 14, 250000,
              case when random() < 0.8 then 250000 else 0 end, 0, '${a.users.admin}'
            from public.units as unit
            cross join (
              select (date_trunc('month', t) - make_interval(months => k))::date as start
              from perf_today, generate_series(0, 11) as k
            ) as month
            where unit.society_id = '${a.id}';
          insert into public.billing_payments (
            society_id, unit_id, amount_paise, mode, source, paid_on, status, submitted_by, confirmed_by,
            confirmed_at, receipt_no, client_request_id, created_by)
            select '${a.id}', bill.unit_id, bill.paid_paise, 'cash', 'admin_recorded',
              least(bill.period_start + 10, current_date), 'confirmed', '${a.users.admin}', '${a.users.admin}', now(),
              'R-2026-' || lpad((row_number() over ())::text, 6, '0'), gen_random_uuid(), '${a.users.admin}'
            from public.billing_bills as bill
            where bill.society_id = '${a.id}' and bill.paid_paise > 0;

          insert into public.expense_accounts (id, society_id, name, account_type, opening_on, created_by)
            select '${account}', '${a.id}', 'Bank', 'bank', t - 400, '${a.users.admin}' from perf_today;
          create temp table perf_expenses as
            select n, gen_random_uuid() as id, t - (n % 360) as day, 1000 + n as amount, category.id as category_id
            from perf_today, generate_series(1, 1200) as n
            cross join lateral (
              select id from public.expense_categories where society_id = '${a.id}'
              order by name offset n % 10 limit 1
            ) as category;
          insert into public.expenses (
            id, society_id, account_id, category_id, spent_on, payee, amount_paise, payment_mode,
            approval_required, status, client_request_id, created_by)
            select id, '${a.id}', '${account}', category_id, day, 'Vendor', amount, 'cash', false, 'posted',
              gen_random_uuid(), '${a.users.admin}'
            from perf_expenses;
          insert into public.expense_book_entries (
            society_id, account_id, entry_date, direction, amount_paise, source, expense_id, category_id,
            counterparty, created_by)
            select '${a.id}', '${account}', day, 'out', amount, 'expense', id, category_id, 'Vendor', '${a.users.admin}'
            from perf_expenses;
          insert into public.expense_book_entries (
            society_id, account_id, entry_date, direction, amount_paise, source, income_kind, counterparty,
            client_request_id, created_by)
            select '${a.id}', '${account}', t - (n % 360), 'in', 5000 + n, 'income', 'donation', 'Donor',
              gen_random_uuid(), '${a.users.admin}'
            from perf_today, generate_series(1, 600) as n;

          insert into public.service_request_categories (society_id, name, sla_hours)
            select '${a.id}', 'Perf category ' || n, 48 from generate_series(1, 5) as n;
          insert into public.service_requests (
            society_id, category_id, location_type, description, status, created_by, created_at, sla_due_at,
            resolved_at, client_request_id)
            select '${a.id}', category.id, 'common_area', 'Synthetic request',
              case when n % 10 = 0 then 'open' else 'resolved' end, '${a.users.resident}', created, created + interval '48 hours',
              case when n % 10 = 0 then null else created + make_interval(hours => n % 96) end, gen_random_uuid()
            from generate_series(1, 6000) as n
            cross join lateral (select now() - make_interval(hours => 100 + n % 8000) as created) as instant
            cross join lateral (
              select id from public.service_request_categories where society_id = '${a.id}'
              order by name offset n % 5 limit 1
            ) as category;

          insert into public.amenities (id, society_id, name, capacity, created_by, updated_by, client_request_id)
            values ('${crypto.randomUUID()}', '${a.id}', 'Clubhouse', 50, '${a.users.admin}', '${a.users.admin}', gen_random_uuid()),
                   ('${crypto.randomUUID()}', '${a.id}', 'Pool', 50, '${a.users.admin}', '${a.users.admin}', gen_random_uuid());
          insert into public.amenity_slots (society_id, amenity_id, weekday, starts_local, ends_local)
            select '${a.id}', id, 0, '10:00', '11:00' from public.amenities where society_id = '${a.id}';
          insert into public.amenity_bookings (
            society_id, amenity_id, slot_id, unit_id, booked_by, starts_at, ends_at, amenity_name, capacity,
            guest_count, fee_paise, rules_snapshot, rules_accepted, status, cancelled_at, cancelled_by,
            cancel_reason, client_request_id)
            select '${a.id}', slot.amenity_id, slot.id, unit.id, '${a.users.resident}', start_at, start_at + interval '1 hour',
              amenity.name, 50, 1, 0, '', false, case when n % 7 = 0 then 'cancelled' else 'confirmed' end,
              case when n % 7 = 0 then now() end, case when n % 7 = 0 then '${a.users.resident}'::uuid end,
              case when n % 7 = 0 then 'Plans changed' end, gen_random_uuid()
            from generate_series(1, 3000) as n
            cross join lateral (select now() - make_interval(hours => 2 * n + 2) as start_at) as instant
            join public.amenity_slots as slot on slot.society_id = '${a.id}'
            join public.amenities as amenity on amenity.id = slot.amenity_id
            join public.units as unit on unit.society_id = '${a.id}' and unit.number = 'P' || (1 + n % 500);

          insert into public.visitor_entries (
            society_id, unit_id, visitor_name, purpose, status, checked_in_at, checked_out_at,
            handled_by_guard_id, created_by)
            select '${a.id}', unit.id, 'Synthetic visitor', 'guest', 'checked_out', checked_in,
              checked_in + interval '1 hour', '${a.guardRosterId}', '${a.users.guard}'
            from generate_series(1, 30000) as n
            cross join lateral (select now() - make_interval(mins => n * 17) as checked_in) as instant
            join public.units as unit on unit.society_id = '${a.id}' and unit.number = 'P' || (1 + n % 500);
          insert into public.delivery_entries (
            society_id, unit_id, company, delivery_type, status, client_request_id, handled_by_guard_id,
            created_by, created_at, decision_source, decided_at, received_at, collected_at, collected_by)
            select '${a.id}', unit.id, 'Courier', 'parcel', 'collected', gen_random_uuid(), '${a.guardRosterId}',
              '${a.users.guard}', created, 'resident', created, created, created + interval '1 hour', '${a.users.resident}'
            from generate_series(1, 20000) as n
            cross join lateral (select now() - make_interval(mins => n * 25) as created) as instant
            join public.units as unit on unit.society_id = '${a.id}' and unit.number = 'P' || (1 + n % 500);

          create temp table perf_notices as
            select gen_random_uuid() as id, now() - make_interval(hours => n * 70) as created
            from generate_series(1, 120) as n;
          insert into public.notices (id, society_id, title, body, audience, created_by, created_at, client_request_id)
            select id, '${a.id}', 'Synthetic notice', 'Body', 'all', '${a.users.admin}', created, gen_random_uuid()
            from perf_notices;
          insert into public.notice_reads (society_id, notice_id, user_id)
            select '${a.id}', notice.id, person.user_id
            from perf_notices as notice join perf_people as person on person.n <= 200;

          insert into public.staff_members (society_id, staff_type, full_name, phone, job_role, created_by)
            select '${a.id}', case when n <= 25 then 'society' else 'domestic' end, 'Staff ' || n, '98765' || lpad(n::text, 5, '0'),
              'Cleaner', '${a.users.admin}'
            from generate_series(1, 30) as n;
          insert into public.staff_shift_attendance (society_id, staff_id, attendance_date, status, marked_by)
            select '${a.id}', staff.id, t - k, case when k % 9 = 0 then 'absent' when k % 13 = 0 then 'leave' else 'present' end,
              '${a.users.admin}'
            from perf_today, generate_series(0, 364) as k
            join public.staff_members as staff on staff.society_id = '${a.id}' and staff.staff_type = 'society';

          insert into public.housekeeping_items (society_id, name, unit_of_measure, category, minimum_stock, created_by, updated_by)
            select '${a.id}', 'Item ' || n, 'litre', 'cleaning', 10, '${a.users.admin}', '${a.users.admin}'
            from generate_series(1, 20) as n;
          insert into public.housekeeping_transactions (
            society_id, item_id, kind, quantity, effective_date, purpose, created_by, client_request_id)
            select '${a.id}', item.id, 'in', 1000, t - 365, null, '${a.users.admin}', gen_random_uuid()
            from perf_today, public.housekeeping_items as item where item.society_id = '${a.id}';
          insert into public.housekeeping_transactions (
            society_id, item_id, kind, quantity, effective_date, purpose, created_by, client_request_id)
            select '${a.id}', item.id, 'out', -1, t - 2 * k, 'Daily cleaning', '${a.users.admin}', gen_random_uuid()
            from perf_today, generate_series(0, 179) as k, public.housekeeping_items as item
            where item.society_id = '${a.id}';

          insert into public.amc_contracts (
            society_id, asset_label, vendor_name, vendor_contact, start_date, end_date, cost_paise,
            payment_terms, visit_frequency, created_by, updated_by, client_request_id)
            select '${a.id}', 'Asset ' || n, 'Vendor', 'vendor@example.test', t - 300, t + 3 * n, 0, '', 'Monthly',
              '${a.users.admin}', '${a.users.admin}', gen_random_uuid()
            from perf_today, generate_series(1, 20) as n;
          insert into public.amc_visits (
            society_id, contract_id, visit_date, summary, technician, created_by, updated_by, client_request_id)
            select '${a.id}', contract.id, t - 30 * k, 'Routine service', 'Technician', '${a.users.admin}',
              '${a.users.admin}', gen_random_uuid()
            from perf_today, generate_series(0, 11) as k, public.amc_contracts as contract
            where contract.society_id = '${a.id}';

          insert into public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, created_at)
            select '${a.id}', '${a.users.resident}', 'resident', 'document.download', 'document',
              gen_random_uuid()::text, now() - make_interval(mins => n * 100)
            from generate_series(1, 5000) as n;

          insert into public.patrol_schedules (
            society_id, name, shift_start, shift_end, interval_minutes, grace_minutes, effective_from,
            client_request_id, created_by)
            values ('${a.id}', 'Night', '22:00', '06:00', 60, 10, now() - interval '400 days', gen_random_uuid(),
              '${a.users.admin}');
          insert into public.patrol_checkpoints (society_id, code, name, client_request_id, created_by, created_at)
            select '${a.id}', 'PATRL' || substr('ABCDEFGHJK', n, 1), 'Checkpoint ' || n, gen_random_uuid(),
              '${a.users.admin}', now() - interval '400 days'
            from generate_series(1, 10) as n;
          insert into public.patrol_schedule_checkpoints (society_id, schedule_id, checkpoint_id, created_by, created_at)
            select '${a.id}', schedule.id, checkpoint.id, '${a.users.admin}', now() - interval '400 days'
            from public.patrol_schedules as schedule
            join public.patrol_checkpoints as checkpoint on checkpoint.society_id = schedule.society_id
            where schedule.society_id = '${a.id}';
          insert into public.patrol_scans (society_id, checkpoint_id, method, scanned_at, scanned_by, client_request_id)
            select '${a.id}', checkpoint.id, 'qr', scanned, '${a.users.guard}', gen_random_uuid()
            from perf_today, generate_series(1, 364) as k, generate_series(0, 7) as round_index,
              public.patrol_checkpoints as checkpoint
            cross join lateral (
              select ((t - k)::timestamp + time '22:00' + make_interval(hours => round_index, mins => 5))
                at time zone 'Asia/Kolkata' as scanned
            ) as instant
            where checkpoint.society_id = '${a.id}' and (k + round_index) % 11 <> 0;
          analyze;
        `;
        await database.asSuperuser((client) => client.query(seed));

        const timings: number[] = [];
        let metricCount = 0;
        for (let run = 0; run < 4; run += 1) {
          const started = performance.now();
          const result = await dashboard(database, a.users.committee, a.id);
          const elapsed = performance.now() - started;
          metricCount = result.metrics.length;
          // The first call warms caches and plans; it is not counted.
          if (run > 0) timings.push(elapsed);
        }
        timings.sort((left, right) => left - right);
        const median = timings[1]!;
        console.info(
          `analytics_dashboard (12 months, ${metricCount} metrics): median ${median.toFixed(0)} ms ` +
            `of ${timings.map((value) => value.toFixed(0)).join(', ')} ms`,
        );
        expect(metricCount).toBe(ANALYTICS_METRICS.length);
        expect(median).toBeLessThan(TARGET_MS);
      } finally {
        await database.drop();
      }
    });
  },
);
