// Opt-in P10.3 scale check: seed a 1,500-unit society and time the app's real queries (PERF_SCALE=1).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client, QueryResult } from 'pg';
import {
  createTestDatabase,
  hasDatabase,
  type ApiRole,
  type Claims,
  type TestDatabase,
} from './support/database';

const enabled = hasDatabase && process.env.PERF_SCALE === '1';
const explainSlow = process.env.PERF_EXPLAIN === '1';
const SLOW_MS = 100;
// Enough runs to pass PostgreSQL's switch from custom to generic plans
// (after five executions), which pooled app connections reach quickly.
const RUNS = 20;
// NFR-2 read target (p95 < 500 ms). Measured list p95s are mostly under 110 ms
// (docs/OPERATIONS.md), which leaves room for a busy test machine.
const LIST_MS = 500;
const DASHBOARD_MS = 500;
const GENERATION_MS = 10_000;
const JOB_MS = 30_000;

interface Fixture {
  society: string;
  otherSociety: string;
  admin: string;
  committee: string;
  guard: string;
  resident: string;
  residentUnit: string;
  hkSupervisor: string;
  hkMembership: string;
  developer: string;
  developerSession: string;
  otherAdmin: string;
  units: string[];
  charges: string[];
  requestId: string;
  categoryId: string;
}

interface Measurement {
  group: string;
  query: string;
  role: string;
  rows: number;
  medianMs: number;
  p95Ms: number;
  boundMs: number;
}

interface Case {
  query: string;
  role: string;
  sql: string;
  params?: unknown[];
  boundMs: number;
}

const counts = {
  units: 1_500,
  residents: 3_000,
  visitors: 300_000,
  deliveries: 100_000,
  serviceRequests: 20_000,
  notifications: 200_000,
  auditLogs: 200_000,
  errorLogs: 50_000,
};

// PostgREST wraps every table read in a CTE and aggregates the page to JSON;
// count=exact adds a second, unpaginated count over the same filters.
function rest(source: string, countSource?: string): string {
  const total = countSource
    ? `(select pg_catalog.count(*) from (${countSource}) _postgrest_count) as total, `
    : '';
  return `with pgrst_source as (${source})
    select ${total}coalesce(json_agg(_postgrest_t), '[]') as result
    from (select * from pgrst_source) _postgrest_t`;
}

function rowCount(result: QueryResult): number {
  const first = result.rows[0] as Record<string, unknown> | undefined;
  if (result.rows.length !== 1 || !first) return result.rowCount ?? 0;
  const value = first.result;
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return Number(value);
  if (value && typeof value === 'object') {
    const list = Object.values(value).find(Array.isArray);
    return Array.isArray(list) ? list.length : 1;
  }
  return 1;
}

// Nearest-rank percentile, rounded to 0.1 ms.
function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return Math.round(sorted[index]! * 10) / 10;
}

async function timeQuery(
  client: Client,
  sql: string,
  params: unknown[] = [],
): Promise<{ medianMs: number; p95Ms: number; rows: number }> {
  // One warm-up run fills plan caches like a pooled app connection would.
  await client.query(sql, params);
  const samples: number[] = [];
  let rows = 0;
  for (let run = 0; run < RUNS; run += 1) {
    const started = performance.now();
    const result = await client.query(sql, params);
    samples.push(performance.now() - started);
    rows = rowCount(result);
  }
  return {
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    rows,
  };
}

// auto_explain also captures plans of statements nested inside RPCs; the
// session user is a superuser, so the role is lifted only to load it.
async function explainPlans(
  client: Client,
  role: ApiRole,
  sql: string,
  params: unknown[] = [],
): Promise<string[]> {
  const plans: string[] = [];
  const onNotice = (notice: { message?: string }) => {
    if (notice.message?.includes('duration:')) plans.push(notice.message);
  };
  await client.query('set local role supabase_admin');
  await client.query(`load 'auto_explain'`);
  await client.query(`select
    set_config('auto_explain.log_min_duration', '${SLOW_MS / 5}', true),
    set_config('auto_explain.log_analyze', 'on', true),
    set_config('auto_explain.log_buffers', 'on', true),
    set_config('auto_explain.log_nested_statements', 'on', true),
    set_config('client_min_messages', 'log', true)`);
  await client.query(`set local role ${role}`);
  client.on('notice', onNotice);
  try {
    await client.query(sql, params);
  } finally {
    client.off('notice', onNotice);
    await client.query('set local role supabase_admin');
    await client.query(`select
      set_config('auto_explain.log_min_duration', '-1', true),
      set_config('client_min_messages', 'notice', true)`);
    await client.query(`set local role ${role}`);
  }
  return plans;
}

const SEED_SQL = [
  `create schema perf`,
  `create table perf.users (
     id uuid primary key default gen_random_uuid(),
     society_no int not null,
     kind text not null,
     n int not null,
     membership_id uuid,
     unique (society_no, kind, n)
   )`,
  `insert into perf.users (society_no, kind, n)
   select v.society_no, v.kind, n
   from (values
     (1, 'admin', 1), (1, 'committee', 2), (1, 'guard', 10),
     (1, 'hk_supervisor', 5), (1, 'resident', ${counts.residents}),
     (2, 'admin', 1), (2, 'guard', 2), (2, 'resident', 100),
     (0, 'developer', 1)
   ) as v(society_no, kind, total)
   cross join lateral generate_series(1, v.total) as n`,
  `insert into auth.users (id, email)
   select id, format('perf-%s-%s-%s@example.test', society_no, kind, n)
   from perf.users`,
  `insert into public.profiles (id, email, full_name, phone)
   select id, format('perf-%s-%s-%s@example.test', society_no, kind, n),
     initcap(replace(kind, '_', ' ')) || ' ' || n,
     '+91' || (7000000000 + row_number() over (order by society_no, kind, n))
   from perf.users`,
  `create table perf.societies (
     society_no int primary key,
     id uuid not null,
     admin_id uuid not null,
     unit_count int not null,
     guard_count int not null,
     resident_count int not null,
     visitor_count int not null,
     delivery_count int not null,
     request_count int not null,
     notification_count int not null
   )`,
  `with created as (
     insert into public.societies (name, created_by)
     select 'Perf Society ' || society_no, id
     from perf.users where kind = 'admin' order by society_no
     returning id, name, created_by
   )
   insert into perf.societies
   select v.society_no, created.id, created.created_by, v.unit_count,
     v.guard_count, v.resident_count, v.visitor_count, v.delivery_count,
     v.request_count, v.notification_count
   from created
   join (values
     (1, ${counts.units}, 10, ${counts.residents}, ${counts.visitors},
       ${counts.deliveries}, ${counts.serviceRequests}, ${counts.notifications}),
     (2, 50, 2, 100, 5000, 2000, 500, 5000)
   ) as v(society_no, unit_count, guard_count, resident_count, visitor_count,
     delivery_count, request_count, notification_count)
     on created.name = 'Perf Society ' || v.society_no`,
  `insert into public.module_configs (society_id, module_key, enabled, settings)
   select society.id, module.key, true,
     case when module.key = 'billing'
       then '{"grace_days": 5, "rounding": "rupee", "late_fee": {"type": "flat", "value": 5000}}'::jsonb
       else '{}'::jsonb end
   from perf.societies society
   cross join (values ('core'), ('visitor'), ('delivery'), ('billing'),
     ('service_request')) as module(key)
   on conflict (society_id, module_key)
     do update set enabled = true, settings = excluded.settings`,
  `with created as (
     insert into public.memberships (society_id, user_id, roles, status, joined_at)
     select society.id, member.id, array[member.kind], 'active',
       now() - interval '400 days'
     from perf.users member
     join perf.societies society using (society_no)
     returning id, user_id
   )
   update perf.users member set membership_id = created.id
   from created where created.user_id = member.id`,
  `create table perf.blocks (society_no int, idx int, id uuid,
     primary key (society_no, idx))`,
  `with created as (
     insert into public.blocks (society_id, name, created_by)
     select society.id, 'Block ' || chr(64 + block_no), society.admin_id
     from perf.societies society
     cross join lateral generate_series(1, society.unit_count / 150 + 1
       - (society.unit_count % 150 = 0)::int) as block_no
     returning id, society_id, name
   )
   insert into perf.blocks
   select society.society_no, ascii(right(created.name, 1)) - 64, created.id
   from created join perf.societies society on society.id = created.society_id`,
  `create table perf.units (society_no int, idx int, id uuid, area numeric,
     owner_id uuid, primary key (society_no, idx))`,
  `with created as (
     insert into public.units (society_id, block_id, number, area_sqft,
       created_by, updated_by)
     select society.id, block.id,
       chr(64 + block.idx) || '-' || (100 * ((n - 1) / 10 + 1) + (n - 1) % 10 + 1),
       600 + 150 * (n % 5), society.admin_id, society.admin_id
     from perf.blocks block
     join perf.societies society using (society_no)
     cross join lateral generate_series(1, least(150,
       society.unit_count - 150 * (block.idx - 1))) as n
     returning id, society_id, number, area_sqft
   )
   insert into perf.units (society_no, idx, id, area)
   select society.society_no,
     row_number() over (partition by society.society_no order by created.number),
     created.id, created.area_sqft
   from created join perf.societies society on society.id = created.society_id`,
  `insert into public.unit_occupants (society_id, unit_id, membership_id,
     relationship, is_primary, is_approver, status, created_by, started_at)
   select society.id, unit.id, resident.membership_id,
     case when resident.n % 2 = 1 then 'owner' else 'family' end,
     resident.n % 2 = 1, resident.n % 2 = 1, 'active', society.admin_id,
     current_date - 400
   from perf.users resident
   join perf.societies society using (society_no)
   join perf.units unit
     on unit.society_no = resident.society_no and unit.idx = (resident.n + 1) / 2
   where resident.kind = 'resident'`,
  `update perf.units unit set owner_id = resident.id
   from perf.users resident
   where resident.kind = 'resident' and resident.society_no = unit.society_no
     and resident.n % 2 = 1 and (resident.n + 1) / 2 = unit.idx`,
  `create table perf.guards (society_no int, idx int, id uuid, user_id uuid,
     primary key (society_no, idx))`,
  `with created as (
     insert into public.guard_roster (society_id, name, membership_id, created_by)
     select society.id, 'Guard ' || guard.n, guard.membership_id, society.admin_id
     from perf.users guard join perf.societies society using (society_no)
     where guard.kind = 'guard'
     returning id, membership_id
   )
   insert into perf.guards
   select guard.society_no, guard.n, created.id, guard.id
   from created join perf.users guard on guard.membership_id = created.membership_id`,
  // Visitors: newest first by g; a few waiting and inside, the rest decided or checked out.
  `insert into public.visitor_entries (society_id, created_at, updated_at,
     created_by, unit_id, visitor_name, visitor_phone, purpose, vehicle_no,
     source, client_request_id, status, respond_by, decision_source,
     decided_at, handled_by_guard_id, checked_in_at, checked_out_at,
     checked_out_by_guard_id)
   select society.id, v.ts, v.ts, guard.user_id, unit.id, 'Visitor ' || g,
     '98' || lpad((g % 100000000)::text, 8, '0'),
     (array['guest', 'cab', 'service', 'official', 'other'])[1 + g % 5],
     case when g % 4 = 0 then 'KA01AB' || lpad((g % 10000)::text, 4, '0') end,
     'walk_in', gen_random_uuid(), v.status,
     case when v.status = 'pending' then now() + interval '10 minutes'
       else v.ts + interval '5 minutes' end,
     case when v.status in ('denied', 'checked_in', 'checked_out')
       then 'resident' end,
     case when v.status in ('denied', 'checked_in', 'checked_out')
       then v.ts + interval '1 minute' end,
     guard.id,
     case when v.status in ('checked_in', 'checked_out')
       then v.ts + interval '2 minutes' end,
     case when v.status = 'checked_out' then v.ts + interval '90 minutes' end,
     case when v.status = 'checked_out' then guard.id end
   from perf.societies society
   cross join lateral generate_series(1, society.visitor_count) as g
   cross join lateral (
     select now() - (g::float8 / society.visitor_count) * interval '365 days' as ts,
       case when g <= 20 then 'pending' when g <= 60 then 'checked_in'
         when g % 20 = 0 then 'denied' when g % 20 = 1 then 'expired'
         else 'checked_out' end as status
   ) as v
   join perf.units unit on unit.society_no = society.society_no
     and unit.idx = 1 + (g::bigint * 7919) % society.unit_count
   join perf.guards guard on guard.society_no = society.society_no
     and guard.idx = 1 + g % society.guard_count`,
  `insert into public.delivery_entries (society_id, created_at, updated_at,
     created_by, unit_id, company, delivery_type, status, client_request_id,
     respond_by, decision_source, decided_at, handled_by_guard_id,
     received_at, collected_at, collected_by)
   select society.id, v.ts, v.ts, guard.user_id, unit.id,
     (array['Amazon', 'Flipkart', 'Swiggy', 'Zomato', 'BlueDart'])[1 + g % 5],
     (array['parcel', 'food', 'grocery', 'other'])[1 + g % 4],
     v.status, gen_random_uuid(),
     case when v.status = 'pending_response' then now() + interval '10 minutes'
       else v.ts + interval '5 minutes' end,
     case when v.status = 'pending_response' then null
       when v.status = 'left_at_gate' then 'preference' else 'resident' end,
     case when v.status <> 'pending_response' then v.ts + interval '1 minute' end,
     guard.id,
     case when v.status in ('left_at_gate', 'collected')
       then v.ts + interval '2 minutes' end,
     case when v.status = 'collected' then v.ts + interval '3 hours' end,
     case when v.status = 'collected' then unit.owner_id end
   from perf.societies society
   cross join lateral generate_series(1, society.delivery_count) as g
   cross join lateral (
     select now() - (g::float8 / society.delivery_count) * interval '365 days' as ts,
       case when g <= 15 then 'pending_response' when g <= 60 then 'left_at_gate'
         when g % 10 = 0 then 'denied' when g % 10 = 1 then 'allowed'
         else 'collected' end as status
   ) as v
   join perf.units unit on unit.society_no = society.society_no
     and unit.idx = 1 + (g::bigint * 7919) % society.unit_count
   join perf.guards guard on guard.society_no = society.society_no
     and guard.idx = 1 + g % society.guard_count`,
  `create table perf.charges (society_no int, name text, id uuid,
     primary key (society_no, name))`,
  `with created as (
     insert into public.billing_charge_types (society_id, name, method,
       amount_paise, created_by, updated_by)
     select society.id, charge.name, charge.method, charge.amount,
       society.admin_id, society.admin_id
     from perf.societies society
     cross join (values ('Maintenance', 'per_sqft', 300),
       ('Sinking Fund', 'fixed', 50000)) as charge(name, method, amount)
     returning id, society_id, name
   )
   insert into perf.charges
   select society.society_no, created.name, created.id
   from created join perf.societies society on society.id = created.society_id`,
  // Eleven past months are seeded directly; the current month is generated by the real RPC.
  `create table perf.bills as
   select gen_random_uuid() as id, society.society_no, society.id as society_id,
     society.admin_id, unit.id as unit_id, unit.owner_id, unit.idx, k,
     (date_trunc('month', current_date) - make_interval(months => k))::date
       as period_start,
     (round(300 * unit.area / 100) * 100)::bigint as maintenance,
     50000::bigint as sinking,
     (k >= 2 and unit.idx % 10 <> 0) or (k = 1 and unit.idx % 2 = 0) as paid
   from perf.societies society
   join perf.units unit using (society_no)
   cross join generate_series(1, 11) as k`,
  `insert into public.billing_bills (id, society_id, unit_id, kind, title,
     period_start, due_date, total_paise, paid_paise, created_at, created_by)
   select id, society_id, unit_id, 'regular',
     'Society charges - ' || to_char(period_start, 'Mon YYYY'), period_start,
     period_start + 9, maintenance + sinking,
     case when paid then maintenance + sinking else 0 end,
     period_start::timestamptz, admin_id
   from perf.bills`,
  `insert into public.billing_bill_lines (society_id, bill_id, unit_id,
     period_start, charge_type_id, description, amount_paise, created_at,
     created_by)
   select bill.society_id, bill.id, bill.unit_id, bill.period_start, charge.id,
     charge.name,
     case when charge.name = 'Maintenance' then bill.maintenance
       else bill.sinking end,
     bill.period_start::timestamptz, bill.admin_id
   from perf.bills bill
   join perf.charges charge using (society_no)`,
  `insert into public.billing_ledger_entries (society_id, unit_id, kind,
     direction, amount_paise, bill_id, created_at, created_by)
   select society_id, unit_id, 'bill', 'debit', maintenance + sinking, id,
     period_start::timestamptz, admin_id
   from perf.bills order by period_start, unit_id`,
  `create table perf.payments as
   select gen_random_uuid() as payment_id, bill.*,
     row_number() over (partition by society_no order by period_start, unit_id)
       as seq
   from perf.bills bill where paid`,
  `insert into public.billing_payments (id, society_id, unit_id, amount_paise,
     mode, source, reference, paid_on, status, submitted_by, confirmed_by,
     confirmed_at, receipt_no, client_request_id, created_at, created_by)
   select payment_id, society_id, unit_id, maintenance + sinking, 'upi',
     'resident_submitted', 'UPI' || lpad(seq::text, 12, '0'),
     least(period_start + 7, current_date), 'confirmed', owner_id, admin_id,
     period_start + interval '8 days',
     'R-' || to_char(period_start, 'YYYY') || '-' || lpad(seq::text, 6, '0'),
     gen_random_uuid(), period_start + interval '7 days', owner_id
   from perf.payments`,
  `insert into public.billing_payment_allocations (society_id, payment_id,
     bill_id, unit_id, amount_paise, created_at)
   select society_id, payment_id, id, unit_id, maintenance + sinking,
     period_start + interval '8 days'
   from perf.payments`,
  `insert into public.billing_ledger_entries (society_id, unit_id, kind,
     direction, amount_paise, payment_id, created_at, created_by)
   select society_id, unit_id, 'payment', 'credit', maintenance + sinking,
     payment_id, period_start + interval '8 days', admin_id
   from perf.payments order by period_start, unit_id`,
  // A small review queue of resident payments waiting for confirmation.
  `insert into public.billing_payments (society_id, unit_id, amount_paise,
     mode, source, reference, paid_on, status, submitted_by,
     client_request_id, created_at, created_by)
   select society_id, unit_id, maintenance + sinking, 'upi',
     'resident_submitted', 'PEND' || lpad(idx::text, 10, '0'),
     current_date - 5, 'awaiting_confirmation', owner_id, gen_random_uuid(),
     now() - interval '5 days', owner_id
   from perf.bills where k = 1 and not paid and idx % 10 = 1`,
  `create table perf.categories as
   select society.society_no, category.id,
     row_number() over (partition by society.society_no
       order by category.sort_order, category.name) as idx,
     count(*) over (partition by society.society_no) as total
   from public.service_request_categories category
   join perf.societies society on society.id = category.society_id`,
  `insert into public.service_requests (society_id, created_at, updated_at,
     created_by, category_id, location_type, unit_id, description, priority,
     status, assigned_membership_id, sla_due_at, resolved_at, closed_at,
     reject_reason, rating, client_request_id)
   select society.id, v.ts, v.ts, unit.owner_id, category.id,
     case when g % 5 = 0 then 'common_area' else 'unit' end,
     case when g % 5 = 0 then null else unit.id end,
     'Request ' || g || ': the kitchen tap is leaking.',
     case when g % 10 = 0 then 'urgent' else 'normal' end,
     v.status,
     case when v.status in ('assigned', 'in_progress', 'resolved', 'closed')
       then assignee.membership_id end,
     v.ts + case when g % 10 = 0 then interval '1 day' else interval '2 days' end,
     case when v.status in ('resolved', 'closed') then v.ts + interval '1 day' end,
     case when v.status = 'closed' then v.ts + interval '2 days' end,
     case when v.status = 'rejected' then 'Duplicate request' end,
     case when v.status = 'closed' and g % 3 = 0 then 4 end,
     gen_random_uuid()
   from perf.societies society
   cross join lateral generate_series(1, society.request_count) as g
   cross join lateral (
     select now() - (g::float8 / society.request_count) * interval '365 days' as ts,
       case when g::float8 / society.request_count <= 0.015 then 'open'
         when g::float8 / society.request_count <= 0.03 then 'assigned'
         when g::float8 / society.request_count <= 0.045 then 'in_progress'
         when g::float8 / society.request_count <= 0.055 then 'resolved'
         when g % 25 = 0 then 'rejected'
         else 'closed' end as status
   ) as v
   join perf.units unit on unit.society_no = society.society_no
     and unit.idx = 1 + (g::bigint * 7919) % society.unit_count
   join perf.categories category on category.society_no = society.society_no
     and category.idx = 1 + g % category.total
   left join perf.users assignee on assignee.society_no = society.society_no
     and assignee.kind = 'hk_supervisor' and assignee.n = 1 + g % 5`,
  `insert into public.service_request_events (society_id, created_at,
     created_by, request_id, event_type, from_status, to_status)
   select society_id, created_at, created_by, id, 'created', null, 'open'
   from public.service_requests
   union all
   select society_id, coalesce(closed_at, resolved_at, created_at + interval '1 hour'),
     created_by, id, 'status_changed', 'open', status
   from public.service_requests where status <> 'open'`,
  `insert into public.service_request_comments (society_id, created_at,
     created_by, request_id, body, client_request_id)
   select society_id, created_at + interval '2 hours', created_by, id,
     'Any update on this request?', gen_random_uuid()
   from public.service_requests
   where (extract(epoch from created_at)::bigint % 2) = 0`,
  `insert into public.notifications (society_id, user_id, type, title, body,
     entity_type, entity_id, read_at, created_at)
   select society.id, resident.id,
     (array['visitor_arrival', 'delivery_arrival', 'billing_bill_generated',
       'request_updated'])[1 + g % 4],
     'Notification ' || g, 'Something happened for your unit.', null, null,
     case when v.ts < now() - interval '7 days' then v.ts + interval '1 hour' end,
     v.ts
   from perf.societies society
   cross join lateral generate_series(1, society.notification_count) as g
   cross join lateral (
     select now() - (g::float8 / society.notification_count) * interval '365 days'
       as ts
   ) as v
   join perf.users resident on resident.society_no = society.society_no
     and resident.kind = 'resident'
     and resident.n = 1 + (g * 31) % society.resident_count`,
  `insert into public.audit_logs (society_id, actor_id, actor_role, action,
     entity_type, entity_id, "after", request_id, created_at)
   select case when g % 40 = 0 then null when g % 13 = 0 then other.id
       else main.id end,
     main.admin_id, 'admin',
     (array['visitor.entry.create', 'billing.payment.confirm',
       'membership.approve', 'request.status.change', 'delivery.override',
       'structure.unit.update'])[1 + g % 6],
     (array['visitor_entry', 'billing_payment', 'membership',
       'service_request', 'delivery_entry', 'unit'])[1 + g % 6],
     g::text, jsonb_build_object('n', g), 'perf-audit-' || g,
     now() - (g::float8 / ${counts.auditLogs}) * interval '365 days'
   from generate_series(1, ${counts.auditLogs}) as g
   cross join (select id, admin_id from perf.societies where society_no = 1) as main
   cross join (select id from perf.societies where society_no = 2) as other`,
  `insert into public.error_logs (reference_id, society_id, module_key, route,
     source, severity, message, request_id, status, created_at)
   select 'ERR' || lpad(g::text, 8, '0'),
     case g % 10 when 0 then null when 1 then other.id else main.id end,
     (array['core', 'visitor', 'delivery', 'billing', 'service_request'])[1 + g % 5],
     '/admin/perf', (array['server', 'client', 'job'])[1 + g % 3],
     (array['critical', 'error', 'warning', 'info'])[1 + g % 4],
     'Synthetic failure ' || g, 'perf-error-' || g, 'open',
     now() - (g::float8 / ${counts.errorLogs}) * interval '120 days'
   from generate_series(1, ${counts.errorLogs}) as g
   cross join (select id from perf.societies where society_no = 1) as main
   cross join (select id from perf.societies where society_no = 2) as other`,
  `insert into public.developers (user_id)
   select id from perf.users where kind = 'developer'`,
];

describe.skipIf(!enabled)('performance at target scale (P10.3)', () => {
  let database: TestDatabase;
  let fixture: Fixture;
  const results: Measurement[] = [];
  const seedTimings: { step: string; ms: number }[] = [];

  // Over-budget cases are collected so every case in a test is still measured;
  // each test then asserts with expectWithinBudget().
  const overBudget: string[] = [];
  const expectWithinBudget = () => expect(overBudget.splice(0)).toEqual([]);

  async function measure(
    group: string,
    role: ApiRole,
    claims: Claims | null,
    cases: Case[],
  ): Promise<void> {
    await database.asRole(role, claims, async (client) => {
      for (const item of cases) {
        const { medianMs, p95Ms, rows } = await timeQuery(
          client,
          item.sql,
          item.params,
        );
        results.push({
          group,
          query: item.query,
          role: item.role,
          rows,
          medianMs,
          p95Ms,
          boundMs: item.boundMs,
        });
        if (explainSlow && medianMs > SLOW_MS) {
          const plans = await explainPlans(client, role, item.sql, item.params);
          console.log(
            `P10.3 EXPLAIN ${item.query} (${item.role}, ${medianMs} ms)\n` +
              plans.join('\n'),
          );
        }
        if (p95Ms > item.boundMs) {
          overBudget.push(
            `${item.query} (${item.role}): p95 ${p95Ms} ms > ${item.boundMs} ms`,
          );
        }
      }
    });
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      for (const statement of SEED_SQL) {
        const started = performance.now();
        await client.query(statement);
        seedTimings.push({
          step: statement.replace(/\s+/g, ' ').slice(0, 60),
          ms: Math.round(performance.now() - started),
        });
      }
      await client.query('vacuum (analyze)');

      const one = async (sql: string) =>
        (await client.query<{ value: string }>(sql)).rows[0]!.value;
      const user = (society: number, kind: string, n = 1) =>
        one(
          `select id::text as value from perf.users
           where society_no = ${society} and kind = '${kind}' and n = ${n}`,
        );
      const developer = await user(0, 'developer');
      const developerSession = (
        await client.query<{ id: string }>(
          'insert into auth.sessions (user_id) values ($1) returning id',
          [developer],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into private.developer_mfa_sessions
           (session_id, user_id, session_expires_at, mfa_verified_at)
         values ($1, $2, now() + interval '1 day', now())`,
        [developerSession, developer],
      );
      fixture = {
        society: await one(
          'select id::text as value from perf.societies where society_no = 1',
        ),
        otherSociety: await one(
          'select id::text as value from perf.societies where society_no = 2',
        ),
        admin: await user(1, 'admin'),
        committee: await user(1, 'committee'),
        guard: await user(1, 'guard'),
        resident: await user(1, 'resident'),
        residentUnit: await one(
          'select id::text as value from perf.units where society_no = 1 and idx = 1',
        ),
        hkSupervisor: await user(1, 'hk_supervisor'),
        hkMembership: await one(
          `select membership_id::text as value from perf.users
           where society_no = 1 and kind = 'hk_supervisor' and n = 1`,
        ),
        developer,
        developerSession,
        otherAdmin: await user(2, 'admin'),
        units: (
          await client.query<{ id: string }>(
            'select id::text from perf.units where society_no = 1 order by idx',
          )
        ).rows.map((row) => row.id),
        charges: (
          await client.query<{ id: string }>(
            'select id::text from perf.charges where society_no = 1 order by name',
          )
        ).rows.map((row) => row.id),
        requestId: await one(
          `select request.id::text as value from public.service_requests request
           join perf.societies society on society.id = request.society_id
           where society.society_no = 1 order by request.created_at desc limit 1`,
        ),
        categoryId: await one(
          `select id::text as value from perf.categories
           where society_no = 1 and idx = 1`,
        ),
      };
    });
  }, 1_800_000);

  afterAll(async () => {
    if (results.length > 0) {
      console.log(
        'P10.3 seed steps (ms):\n' +
          seedTimings.map((step) => `${step.ms}\t${step.step}`).join('\n'),
      );
      console.table(
        results.map((row) => ({
          group: row.group,
          query: row.query,
          role: row.role,
          rows: row.rows,
          'median ms': row.medianMs,
          'p95 ms': row.p95Ms,
          'bound ms': row.boundMs,
        })),
      );
    }
    await database?.drop();
  }, 120_000);

  it('seeds the target-scale dataset with every tenant filter intact', async () => {
    const sizes = await database.asSuperuser(async (client) => {
      const result = await client.query<{ name: string; total: string }>(
        `select 'units' as name, count(*)::text as total from public.units
           where society_id = $1
         union all select 'memberships', count(*)::text from public.memberships
           where society_id = $1
         union all select 'unit_occupants', count(*)::text from public.unit_occupants
           where society_id = $1
         union all select 'visitor_entries', count(*)::text from public.visitor_entries
         union all select 'delivery_entries', count(*)::text from public.delivery_entries
         union all select 'billing_bills', count(*)::text from public.billing_bills
         union all select 'billing_bill_lines', count(*)::text from public.billing_bill_lines
         union all select 'billing_ledger_entries', count(*)::text
           from public.billing_ledger_entries
         union all select 'billing_payments', count(*)::text from public.billing_payments
         union all select 'service_requests', count(*)::text from public.service_requests
         union all select 'service_request_events', count(*)::text
           from public.service_request_events
         union all select 'service_request_comments', count(*)::text
           from public.service_request_comments
         union all select 'notifications', count(*)::text from public.notifications
         union all select 'audit_logs', count(*)::text from public.audit_logs
         union all select 'error_logs', count(*)::text from public.error_logs`,
        [fixture.society],
      );
      return Object.fromEntries(
        result.rows.map((row) => [row.name, Number(row.total)]),
      );
    });
    console.log('P10.3 dataset sizes', sizes);
    expect(sizes.units).toBe(counts.units);
    expect(sizes.unit_occupants).toBe(counts.residents);
    expect(sizes.visitor_entries).toBeGreaterThanOrEqual(counts.visitors);
    expect(sizes.audit_logs).toBe(counts.auditLogs);
  });

  it('generates one month of bills for 1,500 units', async () => {
    const period = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ period: string }>(
            `select to_char(date_trunc('month', current_date), 'YYYY-MM-DD') as period`,
          )
        ).rows[0]!.period,
    );
    const batches = [
      fixture.units.slice(0, 1000),
      fixture.units.slice(1000, counts.units),
    ];
    let totalMs = 0;
    let generated = 0;
    for (const [index, unitIds] of batches.entries()) {
      // Preview and generate are separate app requests, so time them separately.
      const previewStarted = performance.now();
      const preview = await database.asRole(
        'authenticated',
        { sub: fixture.admin },
        async (client) =>
          (
            await client.query<{ result: { preview_hash: string } }>(
              `select public.billing_bills_preview(
                 $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb) as result`,
              [fixture.society, period, unitIds, fixture.charges],
            )
          ).rows[0]!.result,
      );
      const previewMs = performance.now() - previewStarted;
      const generateStarted = performance.now();
      const result = await database.asRole(
        'authenticated',
        { sub: fixture.admin },
        async (client) =>
          (
            await client.query<{ result: { generated_bill_count: number } }>(
              `select public.billing_bills_generate(
                 $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb, $5, $6)
                 as result`,
              [
                fixture.society,
                period,
                unitIds,
                fixture.charges,
                preview.preview_hash,
                `perf-generate-${index}`,
              ],
            )
          ).rows[0]!.result,
        { commit: true },
      );
      const generateMs = performance.now() - generateStarted;
      generated += result.generated_bill_count;
      totalMs += previewMs + generateMs;
      for (const [query, ms] of [
        [`billing_bills_preview (${unitIds.length} units)`, previewMs],
        [`billing_bills_generate (${unitIds.length} units)`, generateMs],
      ] as const) {
        results.push({
          group: 'bill generation',
          query,
          role: 'admin',
          rows: unitIds.length,
          medianMs: Math.round(ms),
          p95Ms: Math.round(ms),
          boundMs: GENERATION_MS,
        });
      }
    }
    results.push({
      group: 'bill generation',
      query: 'preview + generate, 1,500 units',
      role: 'admin',
      rows: generated,
      medianMs: Math.round(totalMs),
      p95Ms: Math.round(totalMs),
      boundMs: GENERATION_MS,
    });
    expect(generated).toBe(counts.units);
    expect(totalMs).toBeLessThan(GENERATION_MS);
    await database.asSuperuser((client) => client.query('analyze'));
  }, 600_000);

  it('keeps visitor and delivery lists fast for guards, admins and residents', async () => {
    const lists = (fn: string, scopes: string[], role: string): Case[] =>
      scopes.map((scope) => ({
        query: `${fn}(${scope})`,
        role,
        sql: `select coalesce(json_agg(entry), '[]') as result
              from public.${fn}($1, null, $2) entry`,
        params: [fixture.society, scope],
        boundMs: LIST_MS,
      }));
    await measure('gate', 'authenticated', { sub: fixture.guard }, [
      ...lists('visitor_list_entries', ['waiting', 'inside', 'today'], 'guard'),
      ...lists(
        'delivery_list_entries',
        ['waiting', 'uncollected', 'today'],
        'guard',
      ),
    ]);
    await measure('gate', 'authenticated', { sub: fixture.admin }, [
      ...lists('visitor_list_entries', ['all'], 'admin'),
      ...lists('delivery_list_entries', ['all'], 'admin'),
    ]);
    await measure('gate', 'authenticated', { sub: fixture.resident }, [
      {
        query: 'unit_occupants own units (RLS)',
        role: 'resident',
        sql: rest(
          `select unit_occupants.unit_id from public.unit_occupants
           where society_id = $1 and status = 'active'`,
        ),
        params: [fixture.society],
        boundMs: LIST_MS,
      },
      {
        query: 'visitor_list_entries(all, own unit)',
        role: 'resident',
        sql: `select coalesce(json_agg(entry), '[]') as result
              from public.visitor_list_entries($1, $2, 'all') entry`,
        params: [fixture.society, fixture.residentUnit],
        boundMs: LIST_MS,
      },
      {
        query: 'delivery_list_entries(all, own unit)',
        role: 'resident',
        sql: `select coalesce(json_agg(entry), '[]') as result
              from public.delivery_list_entries($1, $2, 'all') entry`,
        params: [fixture.society, fixture.residentUnit],
        boundMs: LIST_MS,
      },
    ]);
    expectWithinBudget();
  }, 600_000);

  it('keeps the member and unit directory fast', async () => {
    await measure('directory', 'authenticated', { sub: fixture.admin }, [
      {
        query: 'list_society_members',
        role: 'admin',
        sql: `select coalesce(json_agg(member), '[]') as result
              from public.list_society_members($1) member`,
        params: [fixture.society],
        boundMs: LIST_MS,
      },
      {
        query: 'units active order by number (REST)',
        role: 'admin',
        sql: rest(
          `select units.id, units.number, units.block_id from public.units
           where society_id = $1 and active = true order by number`,
        ),
        params: [fixture.society],
        boundMs: LIST_MS,
      },
      {
        query: 'structure units (REST)',
        role: 'admin',
        sql: rest(
          `select units.id, units.block_id, units.number, units.floor,
             units.unit_type, units.area_sqft, units.active
           from public.units where society_id = $1 order by number`,
        ),
        params: [fixture.society],
        boundMs: LIST_MS,
      },
    ]);
    expectWithinBudget();
  }, 600_000);

  it('keeps billing lists, ledger, dashboard and reports fast', async () => {
    const yearStart = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ from: string; to: string; month: string }>(
            `select to_char(current_date - 365, 'YYYY-MM-DD') as from,
               to_char(current_date, 'YYYY-MM-DD') as to,
               to_char(date_trunc('month', current_date), 'YYYY-MM-DD') as month`,
          )
        ).rows[0]!,
    );
    const rpc = (
      query: string,
      sql: string,
      params: unknown[],
      boundMs = LIST_MS,
    ): Case => ({ query, role: 'admin', sql, params, boundMs });
    await measure('billing', 'authenticated', { sub: fixture.admin }, [
      rpc(
        'billing_bills_list(25, 0)',
        'select public.billing_bills_list($1, 25, 0) as result',
        [fixture.society],
      ),
      rpc(
        'billing_bills_list(100, 0)',
        'select public.billing_bills_list($1, 100, 0) as result',
        [fixture.society],
      ),
      rpc(
        'billing_bills_list(25, page 400)',
        'select public.billing_bills_list($1, 25, 9975) as result',
        [fixture.society],
      ),
      rpc(
        'billing_payments_list(25, 0)',
        'select public.billing_payments_list($1, 25, 0, null) as result',
        [fixture.society],
      ),
      rpc(
        'billing_payments_list(awaiting)',
        `select public.billing_payments_list($1, 100, 0,
           'awaiting_confirmation') as result`,
        [fixture.society],
      ),
      rpc(
        'billing_ledger_get(unit)',
        'select public.billing_ledger_get($1, $2) as result',
        [fixture.society, fixture.residentUnit],
      ),
      rpc(
        'billing_dashboard(month)',
        'select public.billing_dashboard($1, $2::date, $3::date) as result',
        [fixture.society, yearStart.month, yearStart.to],
        DASHBOARD_MS,
      ),
      rpc(
        'billing_dashboard(12 months)',
        'select public.billing_dashboard($1, $2::date, $3::date) as result',
        [fixture.society, yearStart.from, yearStart.to],
        DASHBOARD_MS,
      ),
      ...['dues_by_unit', 'collections', 'defaulters'].map((report) =>
        rpc(
          `billing_report_export(${report}, 12 months)`,
          `select public.billing_report_export($1, $2, $3::date, $4::date,
             'perf-report') as result`,
          [fixture.society, report, yearStart.from, yearStart.to],
          DASHBOARD_MS,
        ),
      ),
    ]);
    await measure('billing', 'authenticated', { sub: fixture.resident }, [
      {
        query: 'billing_bills_list(100, 0)',
        role: 'resident',
        sql: 'select public.billing_bills_list($1, 100, 0) as result',
        params: [fixture.society],
        boundMs: LIST_MS,
      },
      {
        query: 'billing_payments_list(100, 0)',
        role: 'resident',
        sql: 'select public.billing_payments_list($1, 100, 0, null) as result',
        params: [fixture.society],
        boundMs: LIST_MS,
      },
      {
        query: 'billing_ledger_get(own unit)',
        role: 'resident',
        sql: 'select public.billing_ledger_get($1, $2) as result',
        params: [fixture.society, fixture.residentUnit],
        boundMs: LIST_MS,
      },
      {
        query: 'unit_occupants + units!inner (REST)',
        role: 'resident',
        sql: rest(
          `select unit_occupants.unit_id, unit_occupants.membership_id,
             unit_occupants.status, row_to_json(units_1.*) as units
           from public.unit_occupants
           join lateral (select units.number from public.units
             where units.id = unit_occupants.unit_id) units_1 on true
           where unit_occupants.society_id = $1`,
        ),
        params: [fixture.society],
        boundMs: LIST_MS,
      },
    ]);
    expectWithinBudget();
  }, 600_000);

  it('keeps service request lists and the dashboard fast', async () => {
    const list = (
      query: string,
      role: string,
      args: string,
      params: unknown[],
    ): Case => ({
      query,
      role,
      sql: `select public.request_list($1${args}) as result`,
      params: [fixture.society, ...params],
      boundMs: LIST_MS,
    });
    await measure('requests', 'authenticated', { sub: fixture.admin }, [
      list('request_list(default)', 'admin', '', []),
      list('request_list(status=open)', 'admin', ", p_status => 'open'", []),
      list('request_list(category)', 'admin', ', p_category_id => $2', [
        fixture.categoryId,
      ]),
      list('request_list(page 20)', 'admin', ', p_offset => 950', []),
      list('request_list(sort=votes)', 'admin', ", p_sort => 'votes'", []),
      list('request_list(assignee)', 'admin', ', p_assignee_id => $2', [
        fixture.hkMembership,
      ]),
      {
        query: 'request_get',
        role: 'admin',
        sql: 'select public.request_get($1, $2) as result',
        params: [fixture.society, fixture.requestId],
        boundMs: LIST_MS,
      },
      {
        query: 'request_dashboard',
        role: 'admin',
        sql: 'select public.request_dashboard($1) as result',
        params: [fixture.society],
        boundMs: DASHBOARD_MS,
      },
    ]);
    await measure('requests', 'authenticated', { sub: fixture.resident }, [
      list('request_list(default)', 'resident', '', []),
    ]);
    expectWithinBudget();
  }, 600_000);

  it('keeps the notification inbox fast', async () => {
    await measure('notifications', 'authenticated', { sub: fixture.resident }, [
      {
        query: 'notifications latest 50 (REST)',
        role: 'resident',
        sql: rest(
          `select notifications.id, notifications.society_id,
             notifications.user_id, notifications.type, notifications.title,
             notifications.body, notifications.entity_type,
             notifications.entity_id, notifications.read_at,
             notifications.created_at
           from public.notifications where user_id = $1
           order by created_at desc limit 50`,
        ),
        params: [fixture.resident],
        boundMs: LIST_MS,
      },
      {
        query: 'notifications unread count (REST head)',
        role: 'resident',
        sql: `select pg_catalog.count(*) as result from public.notifications
              where user_id = $1 and read_at is null`,
        params: [fixture.resident],
        boundMs: LIST_MS,
      },
    ]);
    expectWithinBudget();
  }, 600_000);

  it('keeps developer and admin log viewers fast', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `update private.developer_mfa_sessions set mfa_verified_at = now()
         where session_id = $1`,
        [fixture.developerSession],
      ),
    );
    const page = (table: string, filter: string) =>
      rest(
        `select ${table}.* from public.${table} ${filter}
         order by created_at desc, id desc limit 25 offset 0`,
        `select 1 from public.${table} ${filter}`,
      );
    await measure(
      'developer',
      'authenticated',
      {
        sub: fixture.developer,
        session_id: fixture.developerSession,
        aal: 'aal2',
      },
      [
        {
          query: 'error_logs page 1 + exact count',
          role: 'developer',
          sql: page('error_logs', ''),
          boundMs: LIST_MS,
        },
        {
          query: 'error_logs society+severity + count',
          role: 'developer',
          sql: page(
            'error_logs',
            "where society_id = $1 and severity = 'critical'",
          ),
          params: [fixture.society],
          boundMs: LIST_MS,
        },
        {
          query: 'error_logs latest per society',
          role: 'developer',
          sql: rest(
            `select error_logs.created_at from public.error_logs
             where society_id = $1 order by created_at desc limit 1`,
          ),
          params: [fixture.society],
          boundMs: LIST_MS,
        },
        {
          query: 'audit_logs page 1 + exact count',
          role: 'developer',
          sql: page('audit_logs', ''),
          boundMs: LIST_MS,
        },
        {
          query: 'audit_logs society + count',
          role: 'developer',
          sql: page('audit_logs', 'where society_id = $1'),
          params: [fixture.society],
          boundMs: LIST_MS,
        },
      ],
    );
    expectWithinBudget();
  }, 600_000);

  it('keeps daily jobs within the cron budget on first and steady-state runs', async () => {
    const today = `(now() at time zone 'Asia/Kolkata')::date`;
    const jobs: { query: string; sql: string; params: unknown[] }[] = [
      {
        query: 'billing_late_fees_run',
        sql: `select public.billing_late_fees_run($1, ${today}, 'perf-late') as result`,
        params: [fixture.society],
      },
      {
        query: 'billing_reminders_run',
        sql: `select public.billing_reminders_run($1, ${today}, 'perf-remind') as result`,
        params: [fixture.society],
      },
      {
        query: 'billing_stale_payments_run',
        sql: `select public.billing_stale_payments_run($1, ${today}, 'perf-stale') as result`,
        params: [fixture.society],
      },
      {
        query: 'visitor_expire_run',
        sql: `select public.visitor_expire_run($1, 'perf-expire') as result`,
        params: [fixture.society],
      },
      {
        query: 'request_auto_close_run',
        sql: `select public.request_auto_close_run($1, ${today}, 'perf-close') as result`,
        params: [fixture.society],
      },
      {
        query: 'housekeeping_retention_files_list',
        sql: `select coalesce(json_agg(file), '[]') as result
              from public.housekeeping_retention_files_list(${today}) file`,
        params: [],
      },
      {
        query: 'housekeeping_retention_run',
        sql: `select public.housekeeping_retention_run(${today}, 'perf-retention') as result`,
        params: [],
      },
    ];
    const failures: string[] = [];
    // Each job runs twice in one rolled-back transaction: the first run does the
    // backlog for a year of data, the second is the normal daily steady state.
    await database.asRole('service_role', null, async (client) => {
      for (const job of jobs) {
        for (const pass of ['first run', 'steady state']) {
          const started = performance.now();
          const result = await client.query(job.sql, job.params);
          const ms = Math.round(performance.now() - started);
          results.push({
            group: 'daily jobs',
            query: `${job.query} (${pass})`,
            role: 'service_role',
            rows: rowCount(result),
            medianMs: ms,
            p95Ms: ms,
            boundMs: JOB_MS,
          });
          if (ms > JOB_MS) failures.push(`${job.query} ${pass}: ${ms} ms`);
        }
      }
    });
    expect(failures).toEqual([]);
  }, 600_000);
});
