// Shared synthetic actors, units and RPC helpers for the poll database contracts.
import type { Client } from 'pg';
import { dbError, type TestDatabase } from './database';

export const POLL_ACTORS = [
  'admin',
  'committee',
  'primary',
  'backup',
  'tenant',
  'family',
  'owner2',
  'guard',
  'outsider',
  'foreignAdmin',
] as const;

export type PollActor = (typeof POLL_ACTORS)[number];
export type PollVotingType = 'public' | 'private';

export interface PollUnit {
  id: string;
  blockId: string;
  label: string;
  representativeUserId: string;
  representativeMembershipId: string;
}

export interface PollFixture {
  database: TestDatabase;
  societyId: string;
  foreignSocietyId: string;
  actors: Record<PollActor, string>;
  memberships: Record<PollActor, string>;
  blocks: { A: string; B: string };
  units: PollUnit[];
  loadVoters: string[];
}

export interface PollDraft {
  title: string;
  instructions: string | null;
  opensAt: string | null;
  closesAt: string;
  selectionMode: 'single' | 'multiple';
  selectionLimit: number | null;
  tenantVotingOverride: boolean | null;
  blockIds: string[];
  options: { label: string }[];
  offices: { name: string; candidates: { name: string }[] }[];
}

interface ActorSeed {
  actor: PollActor;
  userId: string;
  email: string;
  name: string;
  role: string;
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
  const values = rows.flat();
  await client.query(
    `insert into ${table} (${columns.join(',')}) values ${placeholders(rows.length, columns.length)}`,
    values,
  );
}

export async function createPollFixture(
  database: TestDatabase,
  options: { unitCount?: number } = {},
): Promise<PollFixture> {
  const unitCount = options.unitCount ?? 2;
  const actors = {} as Record<PollActor, string>;
  const memberships = {} as Record<PollActor, string>;
  const loadVoters: string[] = [];

  const fixture = await database.asSuperuser(async (client) => {
    const actorSeeds: ActorSeed[] = POLL_ACTORS.map((actor) => ({
      actor,
      userId: crypto.randomUUID(),
      email: `poll-${actor}@example.test`,
      name: `Synthetic poll ${actor}`,
      role:
        actor === 'admin' || actor === 'foreignAdmin'
          ? 'admin'
          : actor === 'committee' || actor === 'guard'
            ? actor
            : 'resident',
      society: actor === 'foreignAdmin' ? 'foreign' : 'home',
    }));

    await insertRows(
      client,
      'auth.users',
      ['id', 'email'],
      actorSeeds.map(({ userId, email }) => [userId, email]),
    );
    await insertRows(
      client,
      'public.profiles',
      ['id', 'email', 'full_name'],
      actorSeeds.map(({ userId, email, name }) => [userId, email, name]),
    );

    const homeSociety = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by)
         values('Synthetic Poll Society',$1) returning id`,
        [actorSeeds.find((seed) => seed.actor === 'admin')!.userId],
      )
    ).rows[0]!;
    const otherSociety = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by)
         values('Synthetic Other Poll Society',$1) returning id`,
        [actorSeeds.find((seed) => seed.actor === 'foreignAdmin')!.userId],
      )
    ).rows[0]!;

    for (const seed of actorSeeds) actors[seed.actor] = seed.userId;
    await insertRows(
      client,
      'public.memberships',
      ['society_id', 'user_id', 'roles', 'status'],
      actorSeeds.map((seed) => [
        seed.society === 'home' ? homeSociety.id : otherSociety.id,
        seed.userId,
        [seed.role],
        'active',
      ]),
    );
    const actorMembershipRows = await client.query<{
      id: string;
      user_id: string;
    }>(
      `select id,user_id from public.memberships
       where society_id=$1 or society_id=$2`,
      [homeSociety.id, otherSociety.id],
    );
    for (const row of actorMembershipRows.rows) {
      const actor = actorSeeds.find(
        (seed) => seed.userId === row.user_id,
      )?.actor;
      if (actor) memberships[actor] = row.id;
    }

    await insertRows(
      client,
      'public.module_configs',
      ['society_id', 'module_key', 'enabled', 'settings'],
      [
        [homeSociety.id, 'core', true, {}],
        [homeSociety.id, 'poll', true, {}],
        [otherSociety.id, 'core', true, {}],
        [otherSociety.id, 'poll', true, {}],
      ],
    );

    const blockRows = await client.query<{ id: string; name: 'A' | 'B' }>(
      `insert into public.blocks(society_id,name,created_by)
       values($1,'A',$2),($1,'B',$2) returning id,name`,
      [homeSociety.id, actors.admin],
    );
    const blocks = {
      A: blockRows.rows.find((row) => row.name === 'A')!.id,
      B: blockRows.rows.find((row) => row.name === 'B')!.id,
    };

    if (unitCount > 2) {
      const generatedUsers = Array.from({ length: unitCount }, (_, index) => ({
        id: crypto.randomUUID(),
        email: `poll-load-voter-${index + 1}@example.test`,
        name: `Synthetic poll voter ${index + 1}`,
      }));
      await insertRows(
        client,
        'auth.users',
        ['id', 'email'],
        generatedUsers.map(({ id, email }) => [id, email]),
      );
      await insertRows(
        client,
        'public.profiles',
        ['id', 'email', 'full_name'],
        generatedUsers.map(({ id, email, name }) => [id, email, name]),
      );
      await insertRows(
        client,
        'public.memberships',
        ['society_id', 'user_id', 'roles', 'status'],
        generatedUsers.map(({ id }) => [
          homeSociety.id,
          id,
          ['resident'],
          'active',
        ]),
      );
      const generatedMemberships = await client.query<{
        id: string;
        user_id: string;
      }>(
        `select id,user_id from public.memberships where society_id=$1
         and user_id = any($2::uuid[])`,
        [homeSociety.id, generatedUsers.map(({ id }) => id)],
      );
      const membershipByUser = new Map(
        generatedMemberships.rows.map((row) => [row.user_id, row.id]),
      );
      const unitRows = await client.query<{ id: string; number: string }>(
        `insert into public.units(society_id,block_id,number,created_by)
         select $1,$2,n::text,$3 from generate_series(1,$4) as n
         returning id,number`,
        [homeSociety.id, blocks.A, actors.admin, unitCount],
      );
      const units = unitRows.rows
        .sort((left, right) => Number(left.number) - Number(right.number))
        .map((row, index) => {
          const user = generatedUsers[index]!;
          return {
            id: row.id,
            blockId: blocks.A,
            label: `A-${row.number}`,
            representativeUserId: user.id,
            representativeMembershipId: membershipByUser.get(user.id)!,
          };
        });
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
          'created_by',
        ],
        units.map((unit) => [
          homeSociety.id,
          unit.id,
          unit.representativeMembershipId,
          'owner',
          true,
          'active',
          actors.admin,
        ]),
      );
      loadVoters.push(...generatedUsers.map(({ id }) => id));
      return {
        societyId: homeSociety.id,
        foreignSocietyId: otherSociety.id,
        blocks,
        units,
      };
    }

    const unitRows = await client.query<{ id: string; block_id: string }>(
      `insert into public.units(society_id,block_id,number,created_by)
       values($1,$2,'101',$3),($1,$4,'201',$3) returning id,block_id`,
      [homeSociety.id, blocks.A, actors.admin, blocks.B],
    );
    const first = unitRows.rows.find((unit) => unit.block_id === blocks.A)!;
    const second = unitRows.rows.find((unit) => unit.block_id === blocks.B)!;
    const unitSeeds = [
      {
        id: first.id,
        blockId: blocks.A,
        label: 'A-101',
        actor: 'primary' as const,
      },
      {
        id: second.id,
        blockId: blocks.B,
        label: 'B-201',
        actor: 'owner2' as const,
      },
    ];
    const units: PollUnit[] = unitSeeds.map((unit) => ({
      id: unit.id,
      blockId: unit.blockId,
      label: unit.label,
      representativeUserId: actors[unit.actor],
      representativeMembershipId: memberships[unit.actor],
    }));
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
        'created_by',
      ],
      [
        [
          homeSociety.id,
          first.id,
          memberships.primary,
          'owner',
          true,
          'active',
          '2024-01-01',
          actors.admin,
        ],
        [
          homeSociety.id,
          first.id,
          memberships.backup,
          'owner',
          false,
          'active',
          '2023-01-01',
          actors.admin,
        ],
        [
          homeSociety.id,
          first.id,
          memberships.tenant,
          'tenant',
          false,
          'active',
          '2025-01-01',
          actors.admin,
        ],
        [
          homeSociety.id,
          first.id,
          memberships.family,
          'family',
          false,
          'active',
          '2025-01-01',
          actors.admin,
        ],
        [
          homeSociety.id,
          second.id,
          memberships.owner2,
          'owner',
          true,
          'active',
          '2024-01-01',
          actors.admin,
        ],
      ],
    );
    return {
      societyId: homeSociety.id,
      foreignSocietyId: otherSociety.id,
      blocks,
      units,
    };
  });

  return {
    database,
    societyId: fixture.societyId,
    foreignSocietyId: fixture.foreignSocietyId,
    actors,
    memberships,
    blocks: fixture.blocks,
    units: fixture.units,
    loadVoters,
  };
}

export function asPollActor<T>(
  fixture: PollFixture,
  actor: PollActor,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  return fixture.database.asRole(
    'authenticated',
    { sub: fixture.actors[actor] },
    run,
    { commit: true },
  );
}

export function asPollUser<T>(
  fixture: PollFixture,
  userId: string,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  return fixture.database.asRole('authenticated', { sub: userId }, run, {
    commit: true,
  });
}

export async function callPoll(
  fixture: PollFixture,
  actor: PollActor,
  name: string,
  args: unknown[],
): Promise<unknown> {
  return callPollUser(fixture, fixture.actors[actor], name, args);
}

export async function callPollUser(
  fixture: PollFixture,
  userId: string,
  name: string,
  args: unknown[],
): Promise<unknown> {
  const parameters = args.map((_, index) => `$${index + 1}`).join(',');
  const result = await asPollUser(fixture, userId, (client) =>
    client.query<{ value: unknown }>(
      `select public.${name}(${parameters}) as value`,
      args,
    ),
  );
  return result.rows[0]?.value;
}

export function pollObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Poll RPC returned a non-object result.');
  }
  return value as Record<string, unknown>;
}

export async function databaseTimestamp(
  fixture: PollFixture,
  expression: string,
): Promise<string> {
  if (!/^[\w\s+:'-]+$/.test(expression)) {
    throw new Error('Unsafe timestamp expression for a poll fixture.');
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

export async function publicPollDraft(
  fixture: PollFixture,
  overrides: Partial<PollDraft> = {},
): Promise<PollDraft> {
  return {
    title: 'Synthetic public poll',
    instructions: null,
    opensAt: null,
    closesAt: await databaseTimestamp(fixture, "+ interval '2 days'"),
    selectionMode: 'single',
    selectionLimit: 1,
    tenantVotingOverride: null,
    blockIds: [],
    options: [{ label: 'Option A' }, { label: 'Option B' }],
    offices: [],
    ...overrides,
  };
}

export async function privatePollDraft(
  fixture: PollFixture,
  overrides: Partial<PollDraft> = {},
): Promise<PollDraft> {
  return {
    title: 'Synthetic private election',
    instructions: 'Select a candidate or None of the above.',
    opensAt: null,
    closesAt: await databaseTimestamp(fixture, "+ interval '2 days'"),
    selectionMode: 'single',
    selectionLimit: 1,
    tenantVotingOverride: null,
    blockIds: [],
    options: [],
    offices: [
      {
        name: 'Chair',
        candidates: [{ name: 'Candidate A' }, { name: 'Candidate B' }],
      },
    ],
    ...overrides,
  };
}

export async function createPollDraft(
  fixture: PollFixture,
  votingType: PollVotingType,
  draft: PollDraft,
): Promise<{ voteId: string; revision: number }> {
  const created = pollObject(
    await callPoll(fixture, 'admin', 'poll_draft_create', [
      fixture.societyId,
      crypto.randomUUID(),
      votingType,
    ]),
  );
  const voteId = created.voteId;
  const revision = created.revision;
  if (typeof voteId !== 'string' || typeof revision !== 'number') {
    throw new Error('Poll draft creation returned an invalid shape.');
  }
  const saved = pollObject(
    await callPoll(fixture, 'admin', 'poll_draft_save', [
      fixture.societyId,
      voteId,
      revision,
      draft,
    ]),
  );
  const nextRevision = saved.revision;
  if (typeof nextRevision !== 'number') {
    throw new Error('Poll draft save returned an invalid revision.');
  }
  return { voteId, revision: nextRevision };
}

export async function errorFor(action: Promise<unknown>) {
  return dbError(action);
}
