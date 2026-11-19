// Synthetic societies, actors and dashboard helpers for the committee analytics database contracts.
import type { Client } from 'pg';
import type { TestDatabase } from './database';

export const ANALYTICS_ROLES = [
  'admin',
  'committee',
  'guard',
  'resident',
  'hk_supervisor',
] as const;

export type AnalyticsRole = (typeof ANALYTICS_ROLES)[number];

export const OPERATIONS_MODULES = [
  'billing',
  'expense',
  'service_request',
  'amenity',
  'visitor',
  'delivery',
  'staff',
  'housekeeping',
  'amc',
  'notice',
] as const;

export const OPERATIONS_METRICS = [
  'core.occupancy',
  'core.members_trend',
  'billing.dues_ageing',
  'billing.collection_trend',
  'billing.collection_rate',
  'expense.income_vs_expense',
  'expense.by_category',
  'service_request.sla',
  'service_request.open_by_category',
  'service_request.resolution_time',
  'amenity.usage',
  'amenity.cancellations',
  'visitor.trend',
  'visitor.peak_hours',
  'delivery.trend',
  'delivery.uncollected',
  'staff.attendance_rate',
  'staff.active_by_type',
  'housekeeping.consumption',
  'housekeeping.low_stock',
  'amc.expiring',
  'amc.expiry_bands',
  'amc.visits',
  'notice.published',
  'notice.read_rate',
] as const;

export type OperationsMetric = (typeof OPERATIONS_METRICS)[number];

export interface AnalyticsSociety {
  id: string;
  /** One user per role, each holding only that role. */
  users: Record<AnalyticsRole, string>;
  memberships: Record<AnalyticsRole, string>;
  guardRosterId: string;
  /** Blocks A and B. */
  blockIds: [string, string];
}

export interface AnalyticsFixture {
  a: AnalyticsSociety;
  b: AnalyticsSociety;
  /** Signed-up user with no membership anywhere. */
  outsiderId: string;
}

export interface AnalyticsSeries {
  key: string;
  label: string;
}

export interface AnalyticsMetricResult {
  key: string;
  module: string;
  kind: 'trend' | 'breakdown' | 'stat';
  unit: string;
  series: AnalyticsSeries[];
  points?: { period: string; values: Record<string, number | null> }[];
  items?: { label: string; values: Record<string, number | null> }[];
  values?: Record<string, number | null>;
  from: string;
  to: string;
  range: 'months' | 'fy';
}

export interface AnalyticsDashboard {
  today: string;
  timezone: string;
  months: number;
  moneyRange: 'months' | 'fy';
  from: string;
  fyFrom: string;
  generatedAt: string;
  metrics: AnalyticsMetricResult[];
}

export async function newUser(client: Client, label: string): Promise<string> {
  const id = crypto.randomUUID();
  const email = `analytics-${label}-${id.slice(0, 8)}@example.test`;
  await client.query('insert into auth.users (id, email) values ($1, $2)', [
    id,
    email,
  ]);
  await client.query(
    'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
    [id, email, `Synthetic ${label}`],
  );
  return id;
}

export async function addMember(
  client: Client,
  societyId: string,
  userId: string,
  roles: string[],
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into public.memberships (society_id, user_id, roles, status)
     values ($1, $2, $3::text[], 'active') returning id`,
    [societyId, userId, roles],
  );
  return result.rows[0]!.id;
}

export async function createAnalyticsSociety(
  client: Client,
  name: string,
): Promise<AnalyticsSociety> {
  const users = {} as Record<AnalyticsRole, string>;
  for (const role of ANALYTICS_ROLES) {
    users[role] = await newUser(client, role);
  }
  const society = await client.query<{ id: string }>(
    `insert into public.societies (name, created_by) values ($1, $2) returning id`,
    [name, users.admin],
  );
  const id = society.rows[0]!.id;
  const memberships = {} as Record<AnalyticsRole, string>;
  for (const role of ANALYTICS_ROLES) {
    memberships[role] = await addMember(client, id, users[role], [role]);
  }
  const roster = await client.query<{ id: string }>(
    `insert into public.guard_roster (society_id, name, membership_id, created_by)
     values ($1, 'Synthetic guard', $2, $3) returning id`,
    [id, memberships.guard, users.admin],
  );
  const blocks = await client.query<{ id: string }>(
    `insert into public.blocks (society_id, name, created_by)
     values ($1, 'A', $2), ($1, 'B', $2) returning id`,
    [id, users.admin],
  );
  return {
    id,
    users,
    memberships,
    guardRosterId: roster.rows[0]!.id,
    blockIds: [blocks.rows[0]!.id, blocks.rows[1]!.id],
  };
}

export async function createAnalyticsFixture(
  database: TestDatabase,
): Promise<AnalyticsFixture> {
  return database.asSuperuser(async (client) => ({
    a: await createAnalyticsSociety(client, 'Analytics Society A'),
    b: await createAnalyticsSociety(client, 'Analytics Society B'),
    outsiderId: await newUser(client, 'outsider'),
  }));
}

export async function enableModules(
  database: TestDatabase,
  societyId: string,
  moduleKeys: readonly string[],
  enabled = true,
): Promise<void> {
  await database.asSuperuser((client) =>
    client.query(
      `insert into public.module_configs (society_id, module_key, enabled, settings)
       select $1, key, $3,
              case when key = 'service_request' then '{"auto_close_days":3}'::jsonb else '{}'::jsonb end
       from unnest($2::text[]) as key
       on conflict (society_id, module_key) do update set enabled = excluded.enabled`,
      [societyId, moduleKeys, enabled],
    ),
  );
}

/** Stores the selected metrics directly (the settings RPC is covered by its own tests). */
export async function setMetrics(
  database: TestDatabase,
  society: AnalyticsSociety,
  metricKeys: readonly string[],
): Promise<void> {
  await database.asSuperuser((client) =>
    client.query(
      `insert into public.analytics_preferences (society_id, metric_keys, updated_by)
       values ($1, $2::text[], $3)
       on conflict (society_id) do update
       set metric_keys = excluded.metric_keys, version = analytics_preferences.version + 1`,
      [society.id, metricKeys, society.users.admin],
    ),
  );
}

export async function dashboard(
  database: TestDatabase,
  userId: string,
  societyId: string,
  months = 12,
  moneyRange = 'months',
): Promise<AnalyticsDashboard> {
  return database.asRole('authenticated', { sub: userId }, async (client) => {
    const result = await client.query<{ data: AnalyticsDashboard }>(
      'select public.analytics_dashboard($1, $2, $3) as data',
      [societyId, months, moneyRange],
    );
    return result.rows[0]!.data;
  });
}

export function pickMetric(
  result: AnalyticsDashboard,
  key: string,
): AnalyticsMetricResult {
  const metric = result.metrics.find((candidate) => candidate.key === key);
  if (!metric) throw new Error(`Metric ${key} is not in the dashboard.`);
  return metric;
}

/** Values of one trend point, failing the test when the period is missing. */
export function pointValues(
  metric: AnalyticsMetricResult,
  period: string,
): Record<string, number | null> {
  const point = metric.points?.find((candidate) => candidate.period === period);
  if (!point) throw new Error(`${metric.key} has no point for ${period}.`);
  return point.values;
}
