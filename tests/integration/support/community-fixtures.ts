// Shared synthetic actors, flats and RPC helpers for the community (P29) database contracts.
import type { Client } from 'pg';
import { dbError, type TestDatabase } from './database';

export const COMMUNITY_ACTORS = [
  'admin',
  'committee',
  'committeeResident',
  'owner',
  'tenant',
  'family',
  'owner2',
  'multi',
  'owner3',
  'owner4',
  'formerOwner',
  'unhoused',
  'guard',
  'hkSupervisor',
  'outsider',
  'foreignAdmin',
] as const;

export type CommunityActor = (typeof COMMUNITY_ACTORS)[number];
export type TargetType = 'post' | 'listing' | 'reply';
export type ListingType = 'sale' | 'give_away' | 'wanted' | 'lost' | 'found';

export interface CommunityUnit {
  id: string;
  label: string;
}

export interface CommunityFixture {
  database: TestDatabase;
  societyId: string;
  foreignSocietyId: string;
  actors: Record<CommunityActor, string>;
  names: Record<CommunityActor, string>;
  memberships: Record<CommunityActor, string>;
  /**
   * A-101: owner, tenant, family (+ ended formerOwner). A-201: owner2 + multi.
   * A-301: committeeResident. B-101: owner3 + multi. B-201: owner4.
   */
  units: {
    a101: CommunityUnit;
    a201: CommunityUnit;
    a301: CommunityUnit;
    b101: CommunityUnit;
    b201: CommunityUnit;
  };
}

export interface ListingInput {
  listingType: ListingType;
  title: string;
  description: string | null;
  pricePaise: number | null;
  contactPhone: string | null;
}

function rolesFor(actor: CommunityActor): string[] {
  switch (actor) {
    case 'admin':
    case 'foreignAdmin':
      return ['admin'];
    case 'committee':
      return ['committee'];
    case 'committeeResident':
      return ['committee', 'resident'];
    case 'guard':
      return ['guard'];
    case 'hkSupervisor':
      return ['hk_supervisor'];
    default:
      return ['resident'];
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

/** A fresh pair of societies; safe to call more than once per database. */
export async function createCommunityFixture(
  database: TestDatabase,
): Promise<CommunityFixture> {
  const tag = crypto.randomUUID().slice(0, 8);
  const actors = {} as Record<CommunityActor, string>;
  const names = {} as Record<CommunityActor, string>;
  const memberships = {} as Record<CommunityActor, string>;

  const seeded = await database.asSuperuser(async (client) => {
    const seeds = COMMUNITY_ACTORS.map((actor) => ({
      actor,
      userId: crypto.randomUUID(),
      email: `community-${tag}-${actor.toLowerCase()}@example.test`,
      name: `Synthetic community ${actor}`,
      roles: rolesFor(actor),
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
         values('Synthetic Community Society',$1) returning id`,
        [actors.admin],
      )
    ).rows[0]!.id;
    const foreign = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by)
         values('Synthetic Other Community Society',$1) returning id`,
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
        seed.roles,
        'active',
      ]),
    );
    const membershipRows = await client.query<{ id: string; user_id: string }>(
      'select id,user_id from public.memberships where society_id=$1 or society_id=$2',
      [home, foreign],
    );
    for (const seed of seeds) {
      memberships[seed.actor] = membershipRows.rows.find(
        (row) => row.user_id === seed.userId,
      )!.id;
    }
    await insertRows(
      client,
      'public.module_configs',
      ['society_id', 'module_key', 'enabled', 'settings'],
      [
        [home, 'core', true, {}],
        [home, 'community', true, {}],
        [foreign, 'core', true, {}],
        [foreign, 'community', true, {}],
      ],
    );
    const blockRows = await client.query<{ id: string; name: string }>(
      `insert into public.blocks(society_id,name,active,created_by)
       values($1,'A',true,$2),($1,'B',true,$2) returning id,name`,
      [home, actors.admin],
    );
    const blockA = blockRows.rows.find((row) => row.name === 'A')!.id;
    const blockB = blockRows.rows.find((row) => row.name === 'B')!.id;
    const unitRows = await client.query<{
      id: string;
      number: string;
      block_id: string;
    }>(
      `insert into public.units(society_id,block_id,number,floor,active,created_by)
       values($1,$2,'101',1,true,$4),($1,$2,'201',2,true,$4),($1,$2,'301',3,true,$4),
             ($1,$3,'101',1,true,$4),($1,$3,'201',2,true,$4)
       returning id,number,block_id`,
      [home, blockA, blockB, actors.admin],
    );
    const unit = (block: string, number: string, label: string) => ({
      id: unitRows.rows.find(
        (row) => row.block_id === block && row.number === number,
      )!.id,
      label,
    });
    const units = {
      a101: unit(blockA, '101', 'A-101'),
      a201: unit(blockA, '201', 'A-201'),
      a301: unit(blockA, '301', 'A-301'),
      b101: unit(blockB, '101', 'B-101'),
      b201: unit(blockB, '201', 'B-201'),
    };
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
      actor: CommunityActor,
      relationship: 'owner' | 'tenant' | 'family',
      primary: boolean,
      ended = false,
    ) => [
      society,
      unitId,
      memberships[actor],
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
        occupant(home, units.a101.id, 'owner', 'owner', true),
        occupant(home, units.a101.id, 'tenant', 'tenant', false),
        occupant(home, units.a101.id, 'family', 'family', false),
        occupant(home, units.a101.id, 'formerOwner', 'owner', false, true),
        occupant(home, units.a201.id, 'owner2', 'owner', true),
        occupant(home, units.a201.id, 'multi', 'family', false),
        occupant(home, units.a301.id, 'committeeResident', 'owner', true),
        occupant(home, units.b101.id, 'owner3', 'owner', true),
        occupant(home, units.b101.id, 'multi', 'family', false),
        occupant(home, units.b201.id, 'owner4', 'owner', true),
        occupant(foreign, foreignUnitId, 'outsider', 'owner', true),
      ],
    );
    return { home, foreign, units };
  });

  return {
    database,
    societyId: seeded.home,
    foreignSocietyId: seeded.foreign,
    actors,
    names,
    memberships,
    units: seeded.units,
  };
}

/**
 * Adds `count` active resident owners (one flat each, block `Z…`) and `adminCount` extra admins,
 * for fan-out cap checks. Returns the new resident user ids.
 */
export async function addBulkMembers(
  fixture: CommunityFixture,
  count: number,
  adminCount = 0,
): Promise<{ residents: string[]; admins: string[] }> {
  const tag = crypto.randomUUID().slice(0, 8);
  return fixture.database.asSuperuser(async (client) => {
    await client.query('begin');
    try {
      await client.query(
        `create temp table bulk_people on commit drop as
         select gen_random_uuid() as id, g, g > $1 as is_admin
         from generate_series(1, $1::int + $2::int) g`,
        [count, adminCount],
      );
      await client.query(
        `insert into auth.users(id,email)
         select id, 'community-bulk-' || $1 || '-' || g || '@example.test' from bulk_people`,
        [tag],
      );
      await client.query(
        `insert into public.profiles(id,email,full_name)
         select id, 'community-bulk-' || $1 || '-' || g || '@example.test',
                'Synthetic bulk neighbour ' || g from bulk_people`,
        [tag],
      );
      await client.query(
        `insert into public.memberships(society_id,user_id,roles,status)
         select $1, id, case when is_admin then array['admin'] else array['resident'] end, 'active'
         from bulk_people`,
        [fixture.societyId],
      );
      const block = (
        await client.query<{ id: string }>(
          `insert into public.blocks(society_id,name,active,created_by)
           values($1,$2,true,$3) returning id`,
          [fixture.societyId, `Z${tag}`, fixture.actors.admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.units(society_id,block_id,number,floor,active,created_by)
         select $1, $2, g::text, 1, true, $3 from bulk_people where not is_admin`,
        [fixture.societyId, block, fixture.actors.admin],
      );
      await client.query(
        `insert into public.unit_occupants
           (society_id,unit_id,membership_id,relationship,is_primary,status,started_at,ended_at,created_by)
         select $1, unit.id, membership.id, 'owner', true, 'active', '2024-01-01', null, $3
         from bulk_people person
         join public.memberships membership
           on membership.society_id = $1 and membership.user_id = person.id
         join public.units unit
           on unit.society_id = $1 and unit.block_id = $2 and unit.number = person.g::text
         where not person.is_admin`,
        [fixture.societyId, block, fixture.actors.admin],
      );
      const people = await client.query<{ id: string; is_admin: boolean }>(
        'select id::text as id, is_admin from bulk_people order by g',
      );
      await client.query('commit');
      return {
        residents: people.rows
          .filter((row) => !row.is_admin)
          .map((row) => row.id),
        admins: people.rows.filter((row) => row.is_admin).map((row) => row.id),
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

export function requestId(label = 'community'): string {
  return `test-${label}-${crypto.randomUUID()}`;
}

export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(
      `Community RPC returned a non-object result: ${JSON.stringify(value)}`,
    );
  }
  return value as Record<string, unknown>;
}

export function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected a JSON array, received ${JSON.stringify(value)}`);
  }
  return value.map(asObject);
}

/** Calls `public.<name>` as any authenticated user id, committing the request; returns the raw value. */
export async function callRawAs(
  fixture: CommunityFixture,
  userId: string,
  name: string,
  args: unknown[],
): Promise<unknown> {
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
  return result.rows[0]?.value;
}

export async function callAs(
  fixture: CommunityFixture,
  userId: string,
  name: string,
  args: unknown[],
): Promise<Record<string, unknown>> {
  return asObject(await callRawAs(fixture, userId, name, args));
}

export function call(
  fixture: CommunityFixture,
  actor: CommunityActor,
  name: string,
  args: unknown[],
): Promise<Record<string, unknown>> {
  return callAs(fixture, fixture.actors[actor], name, args);
}

export function callRaw(
  fixture: CommunityFixture,
  actor: CommunityActor,
  name: string,
  args: unknown[],
): Promise<unknown> {
  return callRawAs(fixture, fixture.actors[actor], name, args);
}

export async function callService(
  database: TestDatabase,
  name: string,
  args: unknown[],
): Promise<Record<string, unknown>> {
  const parameters = args.map((_, index) => `$${index + 1}`).join(',');
  const result = await database.asRole(
    'service_role',
    {},
    (client) =>
      client.query<{ value: unknown }>(
        `select public.${name}(${parameters}) as value`,
        args,
      ),
    { commit: true },
  );
  return asObject(result.rows[0]?.value);
}

/** Accepts either a set-returning `(bucket, path)` function or a single jsonb array result. */
export async function retentionFiles(
  database: TestDatabase,
  today: string,
): Promise<{ bucket: string; path: string }[]> {
  const result = await database.asRole('service_role', {}, (client) =>
    client.query<Record<string, unknown>>(
      'select * from public.community_retention_files_list($1::date)',
      [today],
    ),
  );
  const rows = result.rows;
  if (rows.length === 1 && Array.isArray(Object.values(rows[0]!)[0])) {
    return records(Object.values(rows[0]!)[0]).map((row) => ({
      bucket: String(row.bucket),
      path: String(row.path),
    }));
  }
  return rows.map((row) => ({
    bucket: String(row.bucket),
    path: String(row.path),
  }));
}

/** Society-local (Asia/Kolkata) date as YYYY-MM-DD. */
export function societyToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(),
  );
}

export async function setModule(
  fixture: CommunityFixture,
  enabled: boolean,
  societyId = fixture.societyId,
): Promise<void> {
  await fixture.database.asSuperuser((client) =>
    client.query(
      `insert into public.module_configs(society_id,module_key,enabled,settings)
       values($1,'community',$2,'{}'::jsonb)
       on conflict (society_id,module_key) do update set enabled=excluded.enabled`,
      [societyId, enabled],
    ),
  );
}

/** Runs a superuser statement with triggers off, for backdating protected rows. */
export async function withReplicaRole(
  database: TestDatabase,
  sql: string,
  values: unknown[],
): Promise<void> {
  await database.asSuperuser(async (client) => {
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

export async function query<T extends Record<string, unknown>>(
  database: TestDatabase,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await database.asSuperuser((client) =>
    client.query<T>(sql, values),
  );
  return result.rows;
}

// ---------- groups ----------

export async function saveGroup(
  fixture: CommunityFixture,
  name: string,
  description: string | null = null,
  groupId: string | null = null,
  expectedVersion: number | null = null,
  actor: CommunityActor = 'admin',
): Promise<{ groupId: string; version: number }> {
  const saved = await call(fixture, actor, 'community_group_save', [
    fixture.societyId,
    groupId,
    expectedVersion,
    name,
    description,
    requestId('group-save'),
  ]);
  if (typeof saved.groupId !== 'string' || typeof saved.version !== 'number') {
    throw new Error(`community_group_save shape: ${JSON.stringify(saved)}`);
  }
  return { groupId: saved.groupId, version: saved.version };
}

export function joinGroup(
  fixture: CommunityFixture,
  actor: CommunityActor,
  groupId: string,
): Promise<Record<string, unknown>> {
  return call(fixture, actor, 'community_group_join', [
    fixture.societyId,
    groupId,
    requestId('join'),
  ]);
}

export function leaveGroup(
  fixture: CommunityFixture,
  actor: CommunityActor,
  groupId: string,
): Promise<Record<string, unknown>> {
  return call(fixture, actor, 'community_group_leave', [
    fixture.societyId,
    groupId,
    requestId('leave'),
  ]);
}

export async function groupVersion(
  fixture: CommunityFixture,
  groupId: string,
): Promise<number> {
  const rows = await query<{ version: number }>(
    fixture.database,
    'select version from public.community_groups where society_id=$1 and id=$2',
    [fixture.societyId, groupId],
  );
  return rows[0]!.version;
}

/** Creates a group and has every listed actor join it. */
export async function groupWithMembers(
  fixture: CommunityFixture,
  members: CommunityActor[],
  name = `Synthetic group ${crypto.randomUUID().slice(0, 8)}`,
): Promise<string> {
  const { groupId } = await saveGroup(fixture, name, 'Synthetic description');
  for (const member of members) await joinGroup(fixture, member, groupId);
  return groupId;
}

// ---------- photos ----------

export async function uploadPathFor(
  fixture: CommunityFixture,
  actor: CommunityActor,
  contentType = 'image/jpeg',
  sizeBytes = 2048,
): Promise<string> {
  const path = await callRaw(fixture, actor, 'community_photo_upload_path', [
    fixture.societyId,
    contentType,
    sizeBytes,
  ]);
  if (typeof path !== 'string') {
    throw new Error(`community_photo_upload_path returned ${String(path)}`);
  }
  return path;
}

/** Inserts the storage object as the uploader, so storage policies are exercised. */
export async function insertStorageObject(
  fixture: CommunityFixture,
  userId: string,
  path: string,
  contentType = 'image/jpeg',
  sizeBytes = 2048,
): Promise<void> {
  await fixture.database.asRole(
    'authenticated',
    { sub: userId },
    (client) =>
      client.query(
        `insert into storage.objects(bucket_id,name,owner,metadata)
         values('community-photos',$1,$2,$3)`,
        [path, userId, { mimetype: contentType, size: sizeBytes }],
      ),
    { commit: true },
  );
}

export async function uploadPhoto(
  fixture: CommunityFixture,
  actor: CommunityActor,
  contentType = 'image/jpeg',
): Promise<string> {
  const path = await uploadPathFor(fixture, actor, contentType);
  await insertStorageObject(fixture, fixture.actors[actor], path, contentType);
  return path;
}

export async function uploadPhotos(
  fixture: CommunityFixture,
  actor: CommunityActor,
  count: number,
): Promise<string[]> {
  const paths: string[] = [];
  for (let index = 0; index < count; index += 1) {
    paths.push(await uploadPhoto(fixture, actor));
  }
  return paths;
}

export async function storagePaths(database: TestDatabase): Promise<string[]> {
  const rows = await query<{ name: string }>(
    database,
    `select name from storage.objects where bucket_id='community-photos' order by name`,
  );
  return rows.map((row) => row.name);
}

export async function photoAccess(
  fixture: CommunityFixture,
  actor: CommunityActor,
  path: string,
): Promise<unknown> {
  return callRaw(fixture, actor, 'community_photo_access', [
    fixture.societyId,
    path,
  ]);
}

// ---------- posts ----------

export async function createPost(
  fixture: CommunityFixture,
  actor: CommunityActor,
  groupId: string,
  body = 'Synthetic community post body',
  photoPaths: string[] = [],
  clientRequestId: string = crypto.randomUUID(),
  request = requestId('post-create'),
): Promise<string> {
  const created = await call(fixture, actor, 'community_post_create', [
    fixture.societyId,
    groupId,
    clientRequestId,
    body,
    photoPaths,
    request,
  ]);
  if (typeof created.postId !== 'string') {
    throw new Error(`community_post_create shape: ${JSON.stringify(created)}`);
  }
  return created.postId;
}

export function moderate(
  fixture: CommunityFixture,
  targetType: TargetType,
  targetId: string,
  action: 'approve' | 'reject' | 'remove' | 'restore',
  reason: string | null = null,
  request = requestId(`moderate-${action}`),
  actor: CommunityActor = 'admin',
): Promise<Record<string, unknown>> {
  return call(fixture, actor, 'community_moderate', [
    fixture.societyId,
    targetType,
    targetId,
    action,
    reason,
    request,
  ]);
}

export async function approvedPost(
  fixture: CommunityFixture,
  actor: CommunityActor,
  groupId: string,
  body = 'Synthetic approved post body',
  photoPaths: string[] = [],
): Promise<string> {
  const postId = await createPost(fixture, actor, groupId, body, photoPaths);
  await moderate(fixture, 'post', postId, 'approve');
  return postId;
}

export function getPost(
  fixture: CommunityFixture,
  actor: CommunityActor,
  postId: string,
): Promise<Record<string, unknown>> {
  return call(fixture, actor, 'community_post_get', [
    fixture.societyId,
    postId,
  ]);
}

export async function feed(
  fixture: CommunityFixture,
  actor: CommunityActor,
  groupId: string,
  limit = 50,
  offset = 0,
): Promise<{
  items: Record<string, unknown>[];
  total: number;
  raw: Record<string, unknown>;
}> {
  const raw = await call(fixture, actor, 'community_group_feed', [
    fixture.societyId,
    groupId,
    limit,
    offset,
  ]);
  return { items: records(raw.items), total: Number(raw.total), raw };
}

export async function rowVersion(
  fixture: CommunityFixture,
  table: 'community_posts' | 'community_listings',
  id: string,
): Promise<number> {
  const rows = await query<{ version: number }>(
    fixture.database,
    `select version from public.${table} where society_id=$1 and id=$2`,
    [fixture.societyId, id],
  );
  if (rows.length === 0) throw new Error(`${table} ${id} not found.`);
  return rows[0]!.version;
}

export async function rowStatus(
  database: TestDatabase,
  table:
    | 'community_posts'
    | 'community_listings'
    | 'community_replies'
    | 'community_reports',
  id: string,
): Promise<string | undefined> {
  const rows = await query<{ status: string }>(
    database,
    `select status from public.${table} where id=$1`,
    [id],
  );
  return rows[0]?.status;
}

// ---------- listings ----------

export function listingInput(
  overrides: Partial<ListingInput> = {},
): ListingInput {
  return {
    listingType: 'sale',
    title: 'Synthetic study table',
    description: 'Synthetic description of a gently used table.',
    pricePaise: 150_000,
    contactPhone: '+91 98000 00000',
    ...overrides,
  };
}

export async function createListing(
  fixture: CommunityFixture,
  actor: CommunityActor,
  overrides: Partial<ListingInput> = {},
  photoPaths: string[] = [],
  clientRequestId: string = crypto.randomUUID(),
  request = requestId('listing-create'),
): Promise<string> {
  const created = await call(fixture, actor, 'community_listing_create', [
    fixture.societyId,
    clientRequestId,
    listingInput(overrides),
    photoPaths,
    request,
  ]);
  if (typeof created.listingId !== 'string') {
    throw new Error(
      `community_listing_create shape: ${JSON.stringify(created)}`,
    );
  }
  return created.listingId;
}

export async function approvedListing(
  fixture: CommunityFixture,
  actor: CommunityActor,
  overrides: Partial<ListingInput> = {},
  photoPaths: string[] = [],
  approveRequest = requestId('listing-approve'),
): Promise<string> {
  const listingId = await createListing(fixture, actor, overrides, photoPaths);
  await moderate(
    fixture,
    'listing',
    listingId,
    'approve',
    null,
    approveRequest,
  );
  return listingId;
}

export function getListing(
  fixture: CommunityFixture,
  actor: CommunityActor,
  listingId: string,
): Promise<Record<string, unknown>> {
  return call(fixture, actor, 'community_listing_get', [
    fixture.societyId,
    listingId,
  ]);
}

export async function marketplace(
  fixture: CommunityFixture,
  actor: CommunityActor,
  type: ListingType | null = null,
  search: string | null = null,
  limit = 100,
  offset = 0,
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const raw = await call(fixture, actor, 'community_marketplace', [
    fixture.societyId,
    type,
    search,
    limit,
    offset,
  ]);
  return { items: records(raw.items), total: Number(raw.total) };
}

// ---------- replies, reports, mutes ----------

export async function createReply(
  fixture: CommunityFixture,
  actor: CommunityActor,
  targetType: 'post' | 'listing',
  targetId: string,
  body = 'Synthetic reply body',
  clientRequestId: string = crypto.randomUUID(),
  request = requestId('reply'),
): Promise<string> {
  const created = await call(fixture, actor, 'community_reply_create', [
    fixture.societyId,
    targetType,
    targetId,
    clientRequestId,
    body,
    request,
  ]);
  if (typeof created.replyId !== 'string') {
    throw new Error(`community_reply_create shape: ${JSON.stringify(created)}`);
  }
  return created.replyId;
}

export function report(
  fixture: CommunityFixture,
  actor: CommunityActor,
  targetType: TargetType,
  targetId: string,
  reason = 'spam',
  note: string | null = null,
  request = requestId('report'),
): Promise<Record<string, unknown>> {
  return call(fixture, actor, 'community_report', [
    fixture.societyId,
    targetType,
    targetId,
    reason,
    note,
    request,
  ]);
}

export function mute(
  fixture: CommunityFixture,
  target: CommunityActor,
  duration: '7d' | '30d' | 'until_lifted',
  reason = 'Synthetic mute reason',
  request = requestId('mute'),
  actor: CommunityActor = 'admin',
): Promise<Record<string, unknown>> {
  return call(fixture, actor, 'community_mute', [
    fixture.societyId,
    fixture.memberships[target],
    duration,
    reason,
    request,
  ]);
}

export function unmute(
  fixture: CommunityFixture,
  target: CommunityActor,
  request = requestId('unmute'),
  actor: CommunityActor = 'admin',
): Promise<Record<string, unknown>> {
  return call(fixture, actor, 'community_unmute', [
    fixture.societyId,
    fixture.memberships[target],
    request,
  ]);
}

export async function adminQueue(
  fixture: CommunityFixture,
  queue: 'pending' | 'hidden' | 'reported' | 'removed',
  actor: CommunityActor = 'admin',
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const raw = await call(fixture, actor, 'community_admin_queue', [
    fixture.societyId,
    queue,
    100,
    0,
  ]);
  return { items: records(raw.items), total: Number(raw.total) };
}

// ---------- notifications and audit ----------

export interface NotificationRow {
  user_id: string;
  entity_type: string | null;
  entity_id: string | null;
  [key: string]: unknown;
}

export async function notificationsFor(
  database: TestDatabase,
  request: string,
): Promise<NotificationRow[]> {
  return query<NotificationRow>(
    database,
    `select user_id::text as user_id,entity_type,entity_id::text as entity_id
     from public.notifications where request_id=$1 order by user_id`,
    [request],
  );
}

export async function auditRows(
  database: TestDatabase,
  request: string,
): Promise<{ action: string; after: unknown; before: unknown }[]> {
  return query<{ action: string; after: unknown; before: unknown }>(
    database,
    'select action,"after","before" from public.audit_logs where request_id=$1 order by id',
    [request],
  );
}

// ---------- error assertions ----------

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
  code: string | string[],
): Promise<void> {
  const allowed = Array.isArray(code) ? code : [code];
  const error = await dbError(action);
  if (!allowed.includes(error.code ?? '')) {
    throw new Error(
      `Expected SQLSTATE ${allowed.join('/')}, received ${error.code ?? 'no code'}: ${error.message}`,
    );
  }
}
