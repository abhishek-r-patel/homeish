// Shared synthetic actors, units, ledger and RPC helpers for the event (P30) database contracts.
import type { Client } from 'pg';
import { dbError, type TestDatabase } from './database';

export const EVENT_ACTORS = [
  'admin',
  'committee',
  'owner',
  'tenant',
  'family',
  'formerOwner',
  'owner2',
  'owner3',
  'multi',
  'dormant',
  'unhoused',
  'guard',
  'hkSupervisor',
  'outsider',
  'foreignAdmin',
] as const;

export type EventActor = (typeof EVENT_ACTORS)[number];
export type ContributionType = 'none' | 'per_unit' | 'per_head';

export const BULK_UNIT_COUNT = 10;

export interface EventUnitSeed {
  id: string;
  blockId: string;
  label: string;
}

export interface BulkResident {
  userId: string;
  unitId: string;
  label: string;
}

export interface EventFixture {
  database: TestDatabase;
  societyId: string;
  foreignSocietyId: string;
  actors: Record<EventActor, string>;
  names: Record<EventActor, string>;
  /** A, B and C are active; D is inactive (no units). */
  blocks: { A: string; B: string; C: string; D: string };
  /**
   * A-101: owner, tenant, family (+ ended formerOwner). A-201: owner2 + multi.
   * B-101: owner3 + multi. B-999: inactive unit occupied by dormant.
   */
  units: {
    a101: EventUnitSeed;
    a201: EventUnitSeed;
    b101: EventUnitSeed;
    b999: EventUnitSeed;
  };
  /** Block C: one active owner per unit, used for parallel RSVPs. */
  bulk: BulkResident[];
  foreignUnitId: string;
}

export interface EventInput {
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  rsvpDeadline: string | null;
  capacity: number | null;
  maxPerUnit: number | null;
  contributionType: ContributionType;
  contributionPaise: number;
  audience: { scope: 'all' | 'blocks'; blockIds?: string[] };
}

function roleFor(actor: EventActor): string {
  switch (actor) {
    case 'admin':
    case 'foreignAdmin':
      return 'admin';
    case 'committee':
      return 'committee';
    case 'guard':
      return 'guard';
    case 'hkSupervisor':
      return 'hk_supervisor';
    default:
      return 'resident';
  }
}

function placeholders(rowCount: number, columnCount: number): string {
  return Array.from({ length: rowCount }, (_, row) => {
    const values = Array.from(
      { length: columnCount },
      (_, column) => `$${row * columnCount + column + 1}`,
    );
    return `(${values.join(',')})`;
  }).join(',');
}

async function insertRows(
  client: Client,
  table: string,
  columns: string[],
  rows: unknown[][],
): Promise<void> {
  if (rows.length === 0) return;
  await client.query(
    `insert into ${table} (${columns.join(',')}) values ${placeholders(rows.length, columns.length)}`,
    rows.flat(),
  );
}

export async function createEventFixture(
  database: TestDatabase,
): Promise<EventFixture> {
  const actors = {} as Record<EventActor, string>;
  const names = {} as Record<EventActor, string>;
  const bulkUsers = Array.from({ length: BULK_UNIT_COUNT }, (_, index) => ({
    userId: crypto.randomUUID(),
    email: `event-bulk-${index}@example.test`,
    name: `Synthetic event neighbour ${index}`,
  }));

  const seeded = await database.asSuperuser(async (client) => {
    const seeds = EVENT_ACTORS.map((actor) => ({
      actor,
      userId: crypto.randomUUID(),
      email: `event-${actor.toLowerCase()}@example.test`,
      name: `Synthetic event ${actor}`,
      role: roleFor(actor),
      society:
        actor === 'foreignAdmin' || actor === 'outsider' ? 'foreign' : 'home',
    }));
    for (const seed of seeds) {
      actors[seed.actor] = seed.userId;
      names[seed.actor] = seed.name;
    }
    const people = [
      ...seeds.map(({ userId, email, name }) => ({ userId, email, name })),
      ...bulkUsers,
    ];
    await insertRows(
      client,
      'auth.users',
      ['id', 'email'],
      people.map(({ userId, email }) => [userId, email]),
    );
    await insertRows(
      client,
      'public.profiles',
      ['id', 'email', 'full_name'],
      people.map(({ userId, email, name }) => [userId, email, name]),
    );
    const home = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by)
         values('Synthetic Event Society',$1) returning id`,
        [actors.admin],
      )
    ).rows[0]!.id;
    const foreign = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by)
         values('Synthetic Other Event Society',$1) returning id`,
        [actors.foreignAdmin],
      )
    ).rows[0]!.id;
    await insertRows(
      client,
      'public.memberships',
      ['society_id', 'user_id', 'roles', 'status'],
      [
        ...seeds.map((seed) => [
          seed.society === 'home' ? home : foreign,
          seed.userId,
          [seed.role],
          'active',
        ]),
        ...bulkUsers.map((user) => [home, user.userId, ['resident'], 'active']),
      ],
    );
    const membershipRows = await client.query<{ id: string; user_id: string }>(
      'select id,user_id from public.memberships where society_id=$1 or society_id=$2',
      [home, foreign],
    );
    const membershipOf = (userId: string) =>
      membershipRows.rows.find((row) => row.user_id === userId)!.id;
    await insertRows(
      client,
      'public.module_configs',
      ['society_id', 'module_key', 'enabled', 'settings'],
      [
        [home, 'core', true, {}],
        [home, 'event', true, {}],
        [home, 'billing', true, {}],
        [foreign, 'core', true, {}],
        [foreign, 'event', true, {}],
        [foreign, 'billing', true, {}],
      ],
    );
    const blockRows = await client.query<{ id: string; name: string }>(
      `insert into public.blocks(society_id,name,active,created_by)
       values($1,'A',true,$2),($1,'B',true,$2),($1,'C',true,$2),($1,'D',false,$2)
       returning id,name`,
      [home, actors.admin],
    );
    const blockId = (name: string) =>
      blockRows.rows.find((row) => row.name === name)!.id;
    const blocks = {
      A: blockId('A'),
      B: blockId('B'),
      C: blockId('C'),
      D: blockId('D'),
    };
    const unitRows = await client.query<{
      id: string;
      number: string;
      block_id: string;
    }>(
      `insert into public.units(society_id,block_id,number,floor,active,created_by)
       values($1,$2,'101',1,true,$4),($1,$2,'201',2,true,$4),
             ($1,$3,'101',1,true,$4),($1,$3,'999',9,false,$4)
       returning id,number,block_id`,
      [home, blocks.A, blocks.B, actors.admin],
    );
    const unit = (block: string, number: string, label: string) => ({
      id: unitRows.rows.find(
        (row) => row.block_id === block && row.number === number,
      )!.id,
      blockId: block,
      label,
    });
    const units = {
      a101: unit(blocks.A, '101', 'A-101'),
      a201: unit(blocks.A, '201', 'A-201'),
      b101: unit(blocks.B, '101', 'B-101'),
      b999: unit(blocks.B, '999', 'B-999'),
    };
    const bulk: BulkResident[] = [];
    for (const [index, user] of bulkUsers.entries()) {
      const number = String(100 + index + 1);
      const id = (
        await client.query<{ id: string }>(
          `insert into public.units(society_id,block_id,number,floor,active,created_by)
           values($1,$2,$3,1,true,$4) returning id`,
          [home, blocks.C, number, actors.admin],
        )
      ).rows[0]!.id;
      bulk.push({ userId: user.userId, unitId: id, label: `C-${number}` });
    }
    const foreignBlock = (
      await client.query<{ id: string }>(
        `insert into public.blocks(society_id,name,created_by)
         values($1,'F',$2) returning id`,
        [foreign, actors.foreignAdmin],
      )
    ).rows[0]!.id;
    const foreignUnitId = (
      await client.query<{ id: string }>(
        `insert into public.units(society_id,block_id,number,floor,created_by)
         values($1,$2,'101',1,$3) returning id`,
        [foreign, foreignBlock, actors.foreignAdmin],
      )
    ).rows[0]!.id;
    const occupant = (
      society: string,
      unitId: string,
      userId: string,
      relationship: 'owner' | 'tenant' | 'family',
      primary: boolean,
      ended = false,
    ) => [
      society,
      unitId,
      membershipOf(userId),
      relationship,
      primary,
      ended ? 'ended' : 'active',
      ended ? '2020-01-01' : '2024-01-01',
      ended ? '2023-01-01' : null,
      society === home ? actors.admin : actors.foreignAdmin,
    ];
    await insertRows(
      client,
      'public.unit_occupants',
      [
        'society_id',
        'unit_id',
        'membership_id',
        'relationship',
        'is_primary',
        'status',
        'started_at',
        'ended_at',
        'created_by',
      ],
      [
        occupant(home, units.a101.id, actors.owner, 'owner', true),
        occupant(home, units.a101.id, actors.tenant, 'tenant', false),
        occupant(home, units.a101.id, actors.family, 'family', false),
        occupant(home, units.a101.id, actors.formerOwner, 'owner', false, true),
        occupant(home, units.a201.id, actors.owner2, 'owner', true),
        occupant(home, units.a201.id, actors.multi, 'family', false),
        occupant(home, units.b101.id, actors.owner3, 'owner', true),
        occupant(home, units.b101.id, actors.multi, 'family', false),
        occupant(home, units.b999.id, actors.dormant, 'owner', true),
        ...bulk.map((resident) =>
          occupant(home, resident.unitId, resident.userId, 'owner', true),
        ),
        occupant(foreign, foreignUnitId, actors.outsider, 'owner', true),
      ],
    );
    return { home, foreign, blocks, units, bulk, foreignUnitId };
  });

  return {
    database,
    societyId: seeded.home,
    foreignSocietyId: seeded.foreign,
    actors,
    names,
    blocks: seeded.blocks,
    units: seeded.units,
    bulk: seeded.bulk,
    foreignUnitId: seeded.foreignUnitId,
  };
}

export function requestId(label = 'event'): string {
  return `test-${label}-${crypto.randomUUID()}`;
}

export function eventObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Event RPC returned a non-object result.');
  }
  return value as Record<string, unknown>;
}

export function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected a JSON array from an event RPC.');
  }
  return value.map(eventObject);
}

/** Calls `public.<name>` as any authenticated user id, committing the request. */
export async function callEventAs(
  fixture: EventFixture,
  userId: string,
  name: string,
  args: unknown[],
): Promise<Record<string, unknown>> {
  const parameters = args.map((_, index) => `$${index + 1}`).join(',');
  const result = await fixture.database.asRole(
    'authenticated',
    { sub: userId },
    (client) =>
      client.query<{ value: unknown }>(
        `select public.${name}(${parameters}) as value`,
        args,
      ),
    { commit: true },
  );
  return eventObject(result.rows[0]?.value);
}

export function callEvent(
  fixture: EventFixture,
  actor: EventActor,
  name: string,
  args: unknown[],
): Promise<Record<string, unknown>> {
  return callEventAs(fixture, fixture.actors[actor], name, args);
}

export async function callEventService(
  fixture: EventFixture,
  name: string,
  args: unknown[],
): Promise<Record<string, unknown>> {
  const parameters = args.map((_, index) => `$${index + 1}`).join(',');
  const result = await fixture.database.asRole(
    'service_role',
    {},
    (client) =>
      client.query<{ value: unknown }>(
        `select public.${name}(${parameters}) as value`,
        args,
      ),
    { commit: true },
  );
  return eventObject(result.rows[0]?.value);
}

export async function databaseTimestamp(
  fixture: EventFixture,
  expression: string,
): Promise<string> {
  if (!/^[\w\s+:'-]+$/.test(expression)) {
    throw new Error('Unsafe timestamp expression for an event fixture.');
  }
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{ value: string }>(
      `select (clock_timestamp() ${expression})::text as value`,
    ),
  );
  const value = result.rows[0]?.value;
  if (!value) throw new Error('Could not read the database clock.');
  return new Date(value).toISOString();
}

/** Noon of society-local (Asia/Kolkata) tomorrow, as read from the database clock. */
export async function societyTomorrowNoon(
  fixture: EventFixture,
): Promise<string> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{ value: string }>(
      `select ((((now() at time zone 'Asia/Kolkata')::date + 1) + time '12:00')
        at time zone 'Asia/Kolkata')::text as value`,
    ),
  );
  return new Date(result.rows[0]!.value).toISOString();
}

export async function eventInput(
  fixture: EventFixture,
  overrides: Partial<EventInput> = {},
): Promise<EventInput> {
  const startsAt =
    overrides.startsAt ??
    (await databaseTimestamp(fixture, "+ interval '20 days'"));
  return {
    title: 'Synthetic Diwali get-together',
    description: 'Synthetic description for testing.',
    venue: 'Clubhouse lawn',
    startsAt,
    endsAt: new Date(
      new Date(startsAt).getTime() + 3 * 3_600_000,
    ).toISOString(),
    rsvpDeadline: null,
    capacity: null,
    maxPerUnit: null,
    contributionType: 'none',
    contributionPaise: 0,
    audience: { scope: 'all' },
    ...overrides,
  };
}

/** The stored event as a full `p_event` payload, so updates replace only the overridden fields. */
export async function storedEventInput(
  fixture: EventFixture,
  eventId: string,
  overrides: Partial<EventInput> = {},
): Promise<EventInput> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{
      title: string;
      description: string | null;
      venue: string | null;
      starts_at: Date;
      ends_at: Date;
      rsvp_deadline: Date | null;
      capacity: number | null;
      max_per_unit: number | null;
      contribution_type: ContributionType;
      contribution_paise: string;
      audience_scope: 'all' | 'blocks';
      block_ids: string[];
    }>(
      `select event.title,event.description,event.venue,event.starts_at,event.ends_at,
              event.rsvp_deadline,event.capacity,event.max_per_unit,event.contribution_type,
              event.contribution_paise::text as contribution_paise,event.audience_scope,
              coalesce(array(select audience.block_id::text from public.event_audience_blocks audience
                where audience.society_id=event.society_id and audience.event_id=event.id),'{}') as block_ids
       from public.events event where event.society_id=$1 and event.id=$2`,
      [fixture.societyId, eventId],
    ),
  );
  const row = result.rows[0];
  if (!row) throw new Error('Event not found.');
  return {
    title: row.title,
    description: row.description,
    venue: row.venue,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    rsvpDeadline: row.rsvp_deadline?.toISOString() ?? null,
    capacity: row.capacity,
    maxPerUnit: row.max_per_unit,
    contributionType: row.contribution_type,
    contributionPaise: Number(row.contribution_paise),
    audience:
      row.audience_scope === 'all'
        ? { scope: 'all' }
        : { scope: 'blocks', blockIds: row.block_ids },
    ...overrides,
  };
}

/** Full-replace update built from the stored event plus overrides, at the current version. */
export async function updateEvent(
  fixture: EventFixture,
  eventId: string,
  overrides: Partial<EventInput> = {},
  request = requestId('update'),
  actor: EventActor = 'admin',
): Promise<Record<string, unknown>> {
  return callEvent(fixture, actor, 'event_update', [
    fixture.societyId,
    eventId,
    await eventVersion(fixture, eventId),
    await storedEventInput(fixture, eventId, overrides),
    request,
  ]);
}

export async function createEvent(
  fixture: EventFixture,
  overrides: Partial<EventInput> = {},
  actor: EventActor = 'admin',
): Promise<{ eventId: string; version: number }> {
  const created = await callEvent(fixture, actor, 'event_create', [
    fixture.societyId,
    crypto.randomUUID(),
    await eventInput(fixture, overrides),
    requestId('create'),
  ]);
  if (
    typeof created.eventId !== 'string' ||
    typeof created.version !== 'number'
  ) {
    throw new Error('event_create returned an invalid shape.');
  }
  return { eventId: created.eventId, version: created.version };
}

export async function eventVersion(
  fixture: EventFixture,
  eventId: string,
): Promise<number> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{ version: number }>(
      'select version from public.events where society_id=$1 and id=$2',
      [fixture.societyId, eventId],
    ),
  );
  const version = result.rows[0]?.version;
  if (typeof version !== 'number') throw new Error('Event not found.');
  return version;
}

export async function createPublishedEvent(
  fixture: EventFixture,
  overrides: Partial<EventInput> = {},
  publishRequestId = requestId('publish'),
  actor: EventActor = 'admin',
): Promise<{
  eventId: string;
  version: number;
  publish: Record<string, unknown>;
}> {
  const created = await createEvent(fixture, overrides, actor);
  const publish = await callEvent(fixture, actor, 'event_publish', [
    fixture.societyId,
    created.eventId,
    created.version,
    publishRequestId,
  ]);
  return {
    eventId: created.eventId,
    version: await eventVersion(fixture, created.eventId),
    publish,
  };
}

/** Sets or changes one unit's RSVP as the given occupant. */
export function setRsvpAs(
  fixture: EventFixture,
  userId: string,
  eventId: string,
  unitId: string,
  status: 'going' | 'not_going',
  headcount: number,
  expectedVersion: number | null,
  request = requestId('rsvp'),
): Promise<Record<string, unknown>> {
  return callEventAs(fixture, userId, 'event_rsvp_set', [
    fixture.societyId,
    eventId,
    unitId,
    status,
    headcount,
    expectedVersion,
    request,
  ]);
}

export function setRsvp(
  fixture: EventFixture,
  actor: EventActor,
  eventId: string,
  unitId: string,
  status: 'going' | 'not_going',
  headcount: number,
  expectedVersion: number | null,
  request = requestId('rsvp'),
): Promise<Record<string, unknown>> {
  return setRsvpAs(
    fixture,
    fixture.actors[actor],
    eventId,
    unitId,
    status,
    headcount,
    expectedVersion,
    request,
  );
}

export async function cancelEvent(
  fixture: EventFixture,
  eventId: string,
  reason = 'Synthetic cancellation reason',
  request = requestId('cancel'),
  actor: EventActor = 'admin',
): Promise<Record<string, unknown>> {
  return callEvent(fixture, actor, 'event_cancel', [
    fixture.societyId,
    eventId,
    await eventVersion(fixture, eventId),
    reason,
    request,
  ]);
}

export interface RsvpRow {
  id: string;
  status: string;
  headcount: number;
  version: number;
}

export async function rsvpRow(
  fixture: EventFixture,
  eventId: string,
  unitId: string,
): Promise<RsvpRow | undefined> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<RsvpRow>(
      `select id,status,headcount,version from public.event_rsvps
       where society_id=$1 and event_id=$2 and unit_id=$3`,
      [fixture.societyId, eventId, unitId],
    ),
  );
  return result.rows[0];
}

export interface ChargeRow {
  unit_id: string;
  direction: 'debit' | 'credit';
  amount_paise: number;
  reason: string;
  ledger_entry_id: string;
}

export async function chargeRows(
  fixture: EventFixture,
  eventId: string,
  unitId?: string,
): Promise<ChargeRow[]> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<ChargeRow>(
      `select unit_id,direction,amount_paise::int as amount_paise,reason,
              ledger_entry_id::text as ledger_entry_id
       from public.event_rsvp_charges
       where society_id=$1 and event_id=$2 and ($3::uuid is null or unit_id=$3)
       order by id`,
      [fixture.societyId, eventId, unitId ?? null],
    ),
  );
  return result.rows;
}

export interface LedgerRow {
  id: string;
  kind: string;
  direction: 'debit' | 'credit';
  amount_paise: number;
  reason: string | null;
}

/** Ledger entries linked to this event's charge rows, optionally for one unit. */
export async function ledgerRowsForEvent(
  fixture: EventFixture,
  eventId: string,
  unitId?: string,
): Promise<LedgerRow[]> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<LedgerRow>(
      `select ledger.id::text as id,ledger.kind,ledger.direction,
              ledger.amount_paise::int as amount_paise,ledger.reason
       from public.billing_ledger_entries ledger
       join public.event_rsvp_charges charge
         on charge.society_id=ledger.society_id and charge.ledger_entry_id=ledger.id
       where charge.society_id=$1 and charge.event_id=$2 and ($3::uuid is null or charge.unit_id=$3)
       order by ledger.id`,
      [fixture.societyId, eventId, unitId ?? null],
    ),
  );
  return result.rows;
}

/** Net (debits − credits) of every ledger entry on the unit. */
export async function unitLedgerNet(
  fixture: EventFixture,
  unitId: string,
): Promise<number> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{ net: string | null }>(
      `select sum(case direction when 'debit' then amount_paise else -amount_paise end)::text as net
       from public.billing_ledger_entries where society_id=$1 and unit_id=$2`,
      [fixture.societyId, unitId],
    ),
  );
  return Number(result.rows[0]?.net ?? 0);
}

export function netOf(rows: { direction: string; amount_paise: number }[]) {
  return rows.reduce(
    (sum, row) =>
      sum + (row.direction === 'debit' ? row.amount_paise : -row.amount_paise),
    0,
  );
}

async function withReplicaRole(
  fixture: EventFixture,
  sql: string,
  values: unknown[],
): Promise<void> {
  await fixture.database.asSuperuser(async (client) => {
    await client.query('begin');
    try {
      await client.query("set local session_replication_role = 'replica'");
      await client.query(sql, values);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

/**
 * Moves an event's start and end relative to the database clock with triggers off, because the
 * RPCs refuse past starts. Any deadline is cleared so it never ends up after the new start.
 */
export async function moveEventTimes(
  fixture: EventFixture,
  eventId: string,
  startOffsetMinutes: number,
  durationMinutes = 180,
): Promise<void> {
  await withReplicaRole(
    fixture,
    `update public.events
     set rsvp_deadline = null,
         starts_at = clock_timestamp() + make_interval(mins => $3::int),
         ends_at = clock_timestamp() + make_interval(mins => $3::int + $4::int)
     where society_id=$1 and id=$2`,
    [fixture.societyId, eventId, startOffsetMinutes, durationMinutes],
  );
}

/** Puts the RSVP deadline in the past while the event itself stays in the future. */
export async function passEventDeadline(
  fixture: EventFixture,
  eventId: string,
): Promise<void> {
  await withReplicaRole(
    fixture,
    `update public.events set rsvp_deadline = clock_timestamp() - interval '1 minute'
     where society_id=$1 and id=$2`,
    [fixture.societyId, eventId],
  );
}

export async function setModule(
  fixture: EventFixture,
  moduleKey: string,
  enabled: boolean,
  societyId = fixture.societyId,
): Promise<void> {
  await fixture.database.asSuperuser((client) =>
    client.query(
      `insert into public.module_configs(society_id,module_key,enabled,settings)
       values($1,$2,$3,'{}'::jsonb)
       on conflict (society_id,module_key) do update set enabled=excluded.enabled`,
      [societyId, moduleKey, enabled],
    ),
  );
}

export async function notifiedUsers(
  fixture: EventFixture,
  request: string,
): Promise<
  { user_id: string; entity_type: string | null; entity_id: string | null }[]
> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{
      user_id: string;
      entity_type: string | null;
      entity_id: string | null;
    }>(
      `select user_id,entity_type,entity_id::text as entity_id
       from public.notifications where request_id=$1 order by user_id`,
      [request],
    ),
  );
  return result.rows;
}

export async function auditActionsFor(
  fixture: EventFixture,
  request: string,
): Promise<string[]> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{ action: string }>(
      'select action from public.audit_logs where request_id=$1 order by id',
      [request],
    ),
  );
  return result.rows.map((row) => row.action);
}

export async function expectDomainError(
  action: Promise<unknown>,
  key: string,
): Promise<{ detail: string | undefined }> {
  const error = await dbError(action);
  if (error.code !== 'P0001' || !error.message.includes(key)) {
    throw new Error(
      `Expected P0001 ${key}, received ${error.code ?? 'no code'}: ${error.message}`,
    );
  }
  return { detail: error.detail };
}

export async function expectCode(
  action: Promise<unknown>,
  code: string,
): Promise<void> {
  const error = await dbError(action);
  if (error.code !== code) {
    throw new Error(
      `Expected SQLSTATE ${code}, received ${error.code ?? 'no code'}: ${error.message}`,
    );
  }
}

export function sortedIds(ids: string[]): string[] {
  return [...ids].sort();
}
