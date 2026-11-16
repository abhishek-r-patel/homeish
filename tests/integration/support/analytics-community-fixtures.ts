// Synthetic societies, rows and metric helpers for the community analytics database contracts.
import type { Client } from 'pg';
import type { TestDatabase } from './database';

export const COMMUNITY_MODULES = [
  'core',
  'directory',
  'tenancy',
  'document',
  'parking',
  'sos',
  'vendor',
  'patrol',
  'metering',
  'asset',
  'home_services',
  'poll',
  'meeting',
] as const;

export const COMMUNITY_METRICS = [
  'directory.vehicles',
  'directory.pending_verification',
  'tenancy.moves',
  'tenancy.pending',
  'document.published',
  'document.downloads',
  'parking.occupancy',
  'parking.reports',
  'sos.alerts',
  'sos.response_time',
  'vendor.requests',
  'vendor.approved_spend',
  'patrol.completion',
  'patrol.incidents',
  'metering.consumption',
  'metering.pending_readings',
  'asset.by_category',
  'asset.warranty_expiring',
  'home_services.providers',
  'home_services.ratings',
  'poll.completed',
  'poll.turnout',
  'meeting.held',
  'meeting.attendance',
  'meeting.actions',
] as const;

export type CommunityMetric = (typeof COMMUNITY_METRICS)[number];

export interface CommunitySociety {
  id: string;
  adminId: string;
  adminMembershipId: string;
  residentId: string;
  residentMembershipId: string;
  blockId: string;
  /** Three active units. */
  unitIds: string[];
}

export interface CommunityFixture {
  database: TestDatabase;
  home: CommunitySociety;
  foreign: CommunitySociety;
  committeeId: string;
  guardId: string;
}

export interface MetricValue {
  kind: 'trend' | 'breakdown' | 'stat';
  unit: string;
  series: { key: string; label: string }[];
  points?: { period: string; values: Record<string, number | null> }[];
  items?: { label: string; values: Record<string, number | null> }[];
  values?: Record<string, number | null>;
}

async function newUser(client: Client, label: string): Promise<string> {
  const id = crypto.randomUUID();
  const email = `analytics-community-${label}-${id.slice(0, 8)}@example.test`;
  await client.query('insert into auth.users(id,email) values($1,$2)', [
    id,
    email,
  ]);
  await client.query(
    'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
    [id, email, `Synthetic ${label}`],
  );
  return id;
}

async function membership(
  client: Client,
  societyId: string,
  userId: string,
  role: string,
): Promise<string> {
  return (
    await client.query<{ id: string }>(
      `insert into public.memberships(society_id,user_id,roles,status)
       values($1,$2,$3,'active') returning id`,
      [societyId, userId, [role]],
    )
  ).rows[0]!.id;
}

async function seedSociety(
  client: Client,
  label: string,
): Promise<CommunitySociety> {
  const adminId = await newUser(client, `${label}-admin`);
  const residentId = await newUser(client, `${label}-resident`);
  const id = (
    await client.query<{ id: string }>(
      `insert into public.societies(name,created_by) values($1,$2) returning id`,
      [`Synthetic ${label} analytics society`, adminId],
    )
  ).rows[0]!.id;
  const adminMembershipId = await membership(client, id, adminId, 'admin');
  const residentMembershipId = await membership(
    client,
    id,
    residentId,
    'resident',
  );
  for (const moduleKey of COMMUNITY_MODULES) {
    await client.query(
      `insert into public.module_configs(society_id,module_key,enabled,settings)
       values($1,$2,true,'{}'::jsonb)`,
      [id, moduleKey],
    );
  }
  const blockId = (
    await client.query<{ id: string }>(
      `insert into public.blocks(society_id,name,created_by) values($1,'A',$2) returning id`,
      [id, adminId],
    )
  ).rows[0]!.id;
  const unitIds = (
    await client.query<{ id: string }>(
      `insert into public.units(society_id,block_id,number,floor,active,created_by)
       values($1,$2,'101',1,true,$3),($1,$2,'102',1,true,$3),($1,$2,'201',2,true,$3)
       returning id`,
      [id, blockId, adminId],
    )
  ).rows.map((row) => row.id);
  return {
    id,
    adminId,
    adminMembershipId,
    residentId,
    residentMembershipId,
    blockId,
    unitIds,
  };
}

export async function createCommunityFixture(
  database: TestDatabase,
): Promise<CommunityFixture> {
  return database.asSuperuser(async (client) => {
    const home = await seedSociety(client, 'home');
    const foreign = await seedSociety(client, 'foreign');
    const committeeId = await newUser(client, 'committee');
    await membership(client, home.id, committeeId, 'committee');
    const guardId = await newUser(client, 'guard');
    await membership(client, home.id, guardId, 'guard');
    return { database, home, foreign, committeeId, guardId };
  });
}

/**
 * Inserts synthetic rows directly with triggers off (including foreign-key triggers), so tests can place
 * records at exact instants and states that the module's own workflows would only reach over time.
 */
export async function seed(
  fixture: CommunityFixture,
  run: (client: Client) => Promise<void>,
): Promise<void> {
  await fixture.database.asSuperuser(async (client) => {
    await client.query('begin');
    try {
      await client.query("set local session_replication_role = 'replica'");
      await run(client);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

export async function insertRow(
  client: Client,
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const columns = Object.keys(values);
  const result = await client.query<{ id: string }>(
    `insert into public.${table}(${columns.join(',')})
     values(${columns.map((_, index) => `$${index + 1}`).join(',')}) returning id::text as id`,
    Object.values(values),
  );
  return result.rows[0]!.id;
}

/** Inserts into a table without an id column (link and snapshot tables). */
export async function insertLink(
  client: Client,
  table: string,
  values: Record<string, unknown>,
): Promise<void> {
  const columns = Object.keys(values);
  await client.query(
    `insert into public.${table}(${columns.join(',')})
     values(${columns.map((_, index) => `$${index + 1}`).join(',')})`,
    Object.values(values),
  );
}

/** Seeds the same rows into the home and the foreign society, so doubled totals reveal a leak. */
export async function seedBoth(
  fixture: CommunityFixture,
  run: (client: Client, society: CommunitySociety) => Promise<void>,
): Promise<void> {
  await seed(fixture, async (client) => {
    await run(client, fixture.home);
    await run(client, fixture.foreign);
  });
}
export async function societyToday(fixture: CommunityFixture): Promise<string> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{ today: string }>(
      'select private.analytics_today($1)::text as today',
      [fixture.home.id],
    ),
  );
  return result.rows[0]!.today;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function metric(
  fixture: CommunityFixture,
  key: CommunityMetric,
  from: string,
  to: string,
  societyId = fixture.home.id,
): Promise<MetricValue> {
  const name = `analytics_metric_${key.replace('.', '_')}`;
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{ value: MetricValue }>(
      `select private.${name}($1,$2::date,$3::date) as value`,
      [societyId, from, to],
    ),
  );
  return result.rows[0]!.value;
}

export function pointValues(
  value: MetricValue,
): Record<string, Record<string, number | null>> {
  return Object.fromEntries(
    (value.points ?? []).map((point) => [point.period, point.values]),
  );
}

export function itemValues(
  value: MetricValue,
): Record<string, Record<string, number | null>> {
  return Object.fromEntries(
    (value.items ?? []).map((item) => [item.label, item.values]),
  );
}
