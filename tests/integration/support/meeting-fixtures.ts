// Shared synthetic actors, units and RPC helpers for the meeting database contracts.
import type { Client } from 'pg';
import { dbError, type TestDatabase } from './database';

export const MEETING_ACTORS = [
  'admin',
  'committee',
  'committee2',
  'committeeInactive',
  'owner',
  'tenant',
  'family',
  'formerOwner',
  'owner2',
  'owner3',
  'resident',
  'guard',
  'hkSupervisor',
  'outsider',
  'foreignAdmin',
] as const;

export type MeetingActor = (typeof MEETING_ACTORS)[number];
export type MeetingType = 'agm' | 'sgm' | 'committee';

export interface MeetingUnitSeed {
  id: string;
  blockId: string;
  label: string;
  floor: number | null;
}

export interface MeetingFixture {
  database: TestDatabase;
  societyId: string;
  foreignSocietyId: string;
  actors: Record<MeetingActor, string>;
  memberships: Record<MeetingActor, string>;
  names: Record<MeetingActor, string>;
  blocks: { A: string; B: string };
  /** A-101 (owner, tenant, family, ended former owner), A-201 (owner2), B-101 (owner3). */
  units: {
    a101: MeetingUnitSeed;
    a201: MeetingUnitSeed;
    b101: MeetingUnitSeed;
  };
  /** Inactive unit that must never be invited. */
  inactiveUnitId: string;
  foreignUnitId: string;
}

export interface MeetingInput {
  meetingType: MeetingType;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  venue: string | null;
  onlineUrl: string | null;
  agenda: { title: string; description: string | null }[];
  invitees: {
    scope: 'default' | 'custom';
    unitIds?: string[];
    membershipIds?: string[];
  };
}

interface ActorSeed {
  actor: MeetingActor;
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  society: 'home' | 'foreign';
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

function roleFor(actor: MeetingActor): string {
  switch (actor) {
    case 'admin':
    case 'foreignAdmin':
      return 'admin';
    case 'committee':
    case 'committee2':
    case 'committeeInactive':
      return 'committee';
    case 'guard':
      return 'guard';
    case 'hkSupervisor':
      return 'hk_supervisor';
    default:
      return 'resident';
  }
}

export async function createMeetingFixture(
  database: TestDatabase,
): Promise<MeetingFixture> {
  const actors = {} as Record<MeetingActor, string>;
  const memberships = {} as Record<MeetingActor, string>;
  const names = {} as Record<MeetingActor, string>;

  const seeded = await database.asSuperuser(async (client) => {
    const seeds: ActorSeed[] = MEETING_ACTORS.map((actor) => ({
      actor,
      userId: crypto.randomUUID(),
      email: `meeting-${actor.toLowerCase()}@example.test`,
      name: `Synthetic meeting ${actor}`,
      role: roleFor(actor),
      status: actor === 'committeeInactive' ? 'deactivated' : 'active',
      society:
        actor === 'foreignAdmin' || actor === 'outsider' ? 'foreign' : 'home',
    }));
    for (const seed of seeds) {
      actors[seed.actor] = seed.userId;
      names[seed.actor] = seed.name;
    }
    await insertRows(
      client,
      'auth.users',
      ['id', 'email'],
      seeds.map(({ userId, email }) => [userId, email]),
    );
    await insertRows(
      client,
      'public.profiles',
      ['id', 'email', 'full_name'],
      seeds.map(({ userId, email, name }) => [userId, email, name]),
    );
    const home = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by)
         values('Synthetic Meeting Society',$1) returning id`,
        [actors.admin],
      )
    ).rows[0]!.id;
    const foreign = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by)
         values('Synthetic Other Meeting Society',$1) returning id`,
        [actors.foreignAdmin],
      )
    ).rows[0]!.id;
    await insertRows(
      client,
      'public.memberships',
      ['society_id', 'user_id', 'roles', 'status'],
      seeds.map((seed) => [
        seed.society === 'home' ? home : foreign,
        seed.userId,
        [seed.role],
        seed.status,
      ]),
    );
    const membershipRows = await client.query<{ id: string; user_id: string }>(
      `select id,user_id from public.memberships
       where society_id=$1 or society_id=$2`,
      [home, foreign],
    );
    for (const row of membershipRows.rows) {
      const actor = seeds.find((seed) => seed.userId === row.user_id)?.actor;
      if (actor) memberships[actor] = row.id;
    }
    await insertRows(
      client,
      'public.module_configs',
      ['society_id', 'module_key', 'enabled', 'settings'],
      [
        [home, 'core', true, {}],
        [home, 'meeting', true, {}],
        [home, 'poll', true, {}],
        [home, 'document', true, {}],
        [foreign, 'core', true, {}],
        [foreign, 'meeting', true, {}],
        [foreign, 'poll', true, {}],
        [foreign, 'document', true, {}],
      ],
    );
    const blockRows = await client.query<{ id: string; name: 'A' | 'B' }>(
      `insert into public.blocks(society_id,name,created_by)
       values($1,'A',$2),($1,'B',$2) returning id,name`,
      [home, actors.admin],
    );
    const blocks = {
      A: blockRows.rows.find((row) => row.name === 'A')!.id,
      B: blockRows.rows.find((row) => row.name === 'B')!.id,
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
    const find = (block: string, number: string) =>
      unitRows.rows.find(
        (row) => row.block_id === block && row.number === number,
      )!.id;
    const units = {
      a101: {
        id: find(blocks.A, '101'),
        blockId: blocks.A,
        label: 'A-101',
        floor: 1,
      },
      a201: {
        id: find(blocks.A, '201'),
        blockId: blocks.A,
        label: 'A-201',
        floor: 2,
      },
      b101: {
        id: find(blocks.B, '101'),
        blockId: blocks.B,
        label: 'B-101',
        floor: 1,
      },
    };
    const inactiveUnitId = find(blocks.B, '999');
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
        [
          home,
          units.a101.id,
          memberships.owner,
          'owner',
          true,
          'active',
          '2024-01-01',
          null,
          actors.admin,
        ],
        [
          home,
          units.a101.id,
          memberships.tenant,
          'tenant',
          false,
          'active',
          '2025-01-01',
          null,
          actors.admin,
        ],
        [
          home,
          units.a101.id,
          memberships.family,
          'family',
          false,
          'active',
          '2025-01-01',
          null,
          actors.admin,
        ],
        [
          home,
          units.a101.id,
          memberships.formerOwner,
          'owner',
          false,
          'ended',
          '2020-01-01',
          '2023-01-01',
          actors.admin,
        ],
        [
          home,
          units.a201.id,
          memberships.owner2,
          'owner',
          true,
          'active',
          '2024-01-01',
          null,
          actors.admin,
        ],
        [
          home,
          units.b101.id,
          memberships.owner3,
          'owner',
          true,
          'active',
          '2024-01-01',
          null,
          actors.admin,
        ],
        [
          foreign,
          foreignUnitId,
          memberships.outsider,
          'owner',
          true,
          'active',
          '2024-01-01',
          null,
          actors.foreignAdmin,
        ],
      ],
    );
    return { home, foreign, blocks, units, inactiveUnitId, foreignUnitId };
  });

  return {
    database,
    societyId: seeded.home,
    foreignSocietyId: seeded.foreign,
    actors,
    memberships,
    names,
    blocks: seeded.blocks,
    units: seeded.units,
    inactiveUnitId: seeded.inactiveUnitId,
    foreignUnitId: seeded.foreignUnitId,
  };
}

export function requestId(label = 'meeting'): string {
  return `test-${label}-${crypto.randomUUID()}`;
}

export function asMeetingUser<T>(
  fixture: MeetingFixture,
  userId: string,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  return fixture.database.asRole('authenticated', { sub: userId }, run, {
    commit: true,
  });
}

export async function callMeeting(
  fixture: MeetingFixture,
  actor: MeetingActor,
  name: string,
  args: unknown[],
): Promise<Record<string, unknown>> {
  const parameters = args.map((_, index) => `$${index + 1}`).join(',');
  const result = await asMeetingUser(fixture, fixture.actors[actor], (client) =>
    client.query<{ value: unknown }>(
      `select public.${name}(${parameters}) as value`,
      args,
    ),
  );
  return meetingObject(result.rows[0]?.value);
}

export async function callMeetingService(
  fixture: MeetingFixture,
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
  return meetingObject(result.rows[0]?.value);
}

export function meetingObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Meeting RPC returned a non-object result.');
  }
  return value as Record<string, unknown>;
}

export function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected a JSON array from a meeting RPC.');
  }
  return value.map(meetingObject);
}

export async function databaseTimestamp(
  fixture: MeetingFixture,
  expression: string,
): Promise<string> {
  if (!/^[\w\s+:'-]+$/.test(expression)) {
    throw new Error('Unsafe timestamp expression for a meeting fixture.');
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

export async function meetingInput(
  fixture: MeetingFixture,
  overrides: Partial<MeetingInput> = {},
): Promise<MeetingInput> {
  const startsAt =
    overrides.startsAt ??
    (await databaseTimestamp(fixture, "+ interval '20 days'"));
  return {
    meetingType: 'agm',
    title: 'Synthetic annual general meeting',
    description: 'Synthetic agenda for testing.',
    startsAt,
    endsAt: new Date(
      new Date(startsAt).getTime() + 2 * 3_600_000,
    ).toISOString(),
    venue: 'Clubhouse',
    onlineUrl: null,
    agenda: [{ title: 'Accounts', description: null }],
    invitees: { scope: 'default' },
    ...overrides,
  };
}

export async function createMeeting(
  fixture: MeetingFixture,
  overrides: Partial<MeetingInput> = {},
): Promise<{ meetingId: string; version: number }> {
  const created = await callMeeting(fixture, 'admin', 'meeting_create', [
    fixture.societyId,
    crypto.randomUUID(),
    await meetingInput(fixture, overrides),
    requestId('create'),
  ]);
  if (
    typeof created.meetingId !== 'string' ||
    typeof created.version !== 'number'
  ) {
    throw new Error('meeting_create returned an invalid shape.');
  }
  return { meetingId: created.meetingId, version: created.version };
}

export async function meetingVersion(
  fixture: MeetingFixture,
  meetingId: string,
): Promise<number> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<{ version: number }>(
      'select version from public.meetings where society_id=$1 and id=$2',
      [fixture.societyId, meetingId],
    ),
  );
  const version = result.rows[0]?.version;
  if (typeof version !== 'number') throw new Error('Meeting not found.');
  return version;
}

export async function createScheduledMeeting(
  fixture: MeetingFixture,
  overrides: Partial<MeetingInput> = {},
  scheduleRequestId = requestId('schedule'),
): Promise<{
  meetingId: string;
  version: number;
  schedule: Record<string, unknown>;
}> {
  const created = await createMeeting(fixture, overrides);
  const schedule = await callMeeting(fixture, 'admin', 'meeting_schedule', [
    fixture.societyId,
    created.meetingId,
    created.version,
    scheduleRequestId,
  ]);
  return {
    meetingId: created.meetingId,
    version: await meetingVersion(fixture, created.meetingId),
    schedule,
  };
}

/**
 * Moves a scheduled meeting's start and end relative to the database clock. Scheduling refuses past
 * starts, so tests reach the check-in and "held" windows by shifting time directly with triggers off.
 */
export async function moveMeetingTimes(
  fixture: MeetingFixture,
  meetingId: string,
  startOffsetMinutes: number,
  durationMinutes = 120,
): Promise<void> {
  await fixture.database.asSuperuser(async (client) => {
    await client.query('begin');
    try {
      await client.query("set local session_replication_role = 'replica'");
      await client.query(
        `update public.meetings
         set starts_at = clock_timestamp() + make_interval(mins => $3::int),
             ends_at = clock_timestamp() + make_interval(mins => $3::int + $4::int)
         where society_id=$1 and id=$2`,
        [fixture.societyId, meetingId, startOffsetMinutes, durationMinutes],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

/** Creates, schedules, moves the start into the past and marks the meeting held. */
export async function createHeldMeeting(
  fixture: MeetingFixture,
  overrides: Partial<MeetingInput> = {},
): Promise<{ meetingId: string; version: number }> {
  const scheduled = await createScheduledMeeting(fixture, overrides);
  await moveMeetingTimes(fixture, scheduled.meetingId, -10);
  await callMeeting(fixture, 'admin', 'meeting_mark_held', [
    fixture.societyId,
    scheduled.meetingId,
    scheduled.version,
    requestId('held'),
  ]);
  return {
    meetingId: scheduled.meetingId,
    version: await meetingVersion(fixture, scheduled.meetingId),
  };
}

export async function setModule(
  fixture: MeetingFixture,
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

export async function updateMeetingSettings(
  fixture: MeetingFixture,
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return callMeeting(fixture, 'admin', 'meeting_settings_update', [
    fixture.societyId,
    settings,
    requestId('settings'),
  ]);
}

export interface NotificationRow {
  user_id: string;
  entity_type: string | null;
  entity_id: string | null;
}

export async function notificationsFor(
  fixture: MeetingFixture,
  request: string,
): Promise<NotificationRow[]> {
  const result = await fixture.database.asSuperuser((client) =>
    client.query<NotificationRow>(
      `select user_id,entity_type,entity_id::text as entity_id
       from public.notifications where request_id=$1 order by user_id`,
      [request],
    ),
  );
  return result.rows;
}

export async function auditActionsFor(
  fixture: MeetingFixture,
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

export async function createPollVote(
  fixture: MeetingFixture,
  actor: 'admin' | 'foreignAdmin' = 'admin',
): Promise<{ voteId: string; revision: number }> {
  const societyId =
    actor === 'admin' ? fixture.societyId : fixture.foreignSocietyId;
  const created = await callMeeting(fixture, actor, 'poll_draft_create', [
    societyId,
    crypto.randomUUID(),
    'public',
  ]);
  const voteId = created.voteId as string;
  const saved = await callMeeting(fixture, actor, 'poll_draft_save', [
    societyId,
    voteId,
    created.revision,
    {
      title: 'Synthetic resolution poll',
      instructions: null,
      opensAt: null,
      closesAt: await databaseTimestamp(fixture, "+ interval '2 days'"),
      selectionMode: 'single',
      selectionLimit: 1,
      tenantVotingOverride: null,
      blockIds: [],
      options: [{ label: 'For' }, { label: 'Against' }, { label: 'Abstain' }],
      offices: [],
    },
  ]);
  return { voteId, revision: saved.revision as number };
}

export async function createDocumentRow(
  fixture: MeetingFixture,
  society: 'home' | 'foreign' = 'home',
): Promise<string> {
  const societyId =
    society === 'home' ? fixture.societyId : fixture.foreignSocietyId;
  const creator =
    society === 'home' ? fixture.actors.admin : fixture.actors.foreignAdmin;
  return fixture.database.asSuperuser(async (client) => {
    const folder = (
      await client.query<{ id: string }>(
        `insert into public.document_folders(society_id,name,audience,created_by)
         values($1,$2,'all_residents',$3) returning id`,
        [
          societyId,
          `Synthetic minutes ${crypto.randomUUID().slice(0, 8)}`,
          creator,
        ],
      )
    ).rows[0]!.id;
    return (
      await client.query<{ id: string }>(
        `insert into public.documents(society_id,folder_id,title,client_request_id,created_by)
         values($1,$2,'Synthetic minutes copy',gen_random_uuid(),$3) returning id`,
        [societyId, folder, creator],
      )
    ).rows[0]!.id;
  });
}

export async function errorFor(action: Promise<unknown>) {
  return dbError(action);
}

export async function expectDomainError(
  action: Promise<unknown>,
  key: string,
): Promise<void> {
  const error = await dbError(action);
  if (error.code !== 'P0001' || !error.message.includes(key)) {
    throw new Error(
      `Expected P0001 ${key}, received ${error.code ?? 'no code'}: ${error.message}`,
    );
  }
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
