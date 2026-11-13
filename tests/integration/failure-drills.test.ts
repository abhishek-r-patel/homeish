// P10.4 failure drills: duplicate submissions and concurrent decisions racing on real PostgreSQL.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Fixture = {
  societyId: string;
  unitId: string;
  guardId: string;
  guardRosterId: string;
  firstResidentId: string;
  secondResidentId: string;
  categoryId: string;
};

// Lets the first transaction finish only once the second is provably blocked behind it.
async function waitForBlockedBackend(database: TestDatabase) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const blocked = await database.asSuperuser((client) =>
      client.query<{ count: string }>(
        `select count(*)::text as count from pg_stat_activity
         where datname = current_database() and wait_event_type = 'Lock'`,
      ),
    );
    if (blocked.rows[0]?.count !== '0') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('The competing transaction never blocked.');
}

async function race<T>(
  database: TestDatabase,
  first: (client: Client) => Promise<T>,
  second: () => Promise<T>,
  role: { name: 'authenticated' | 'service_role'; sub: string | null },
) {
  let startSecond!: () => void;
  const secondStarted = new Promise<void>((resolve) => {
    startSecond = resolve;
  });
  const winner = database.asRole(
    role.name,
    role.sub ? { sub: role.sub } : null,
    async (client) => {
      const result = await first(client);
      startSecond();
      await waitForBlockedBackend(database);
      return result;
    },
    { commit: true },
  );
  const loser = secondStarted.then(second);
  return Promise.allSettled([winner, loser]);
}

function errorCode(result: PromiseSettledResult<unknown>) {
  return result.status === 'rejected'
    ? (result.reason as { code?: string }).code
    : undefined;
}

describe.skipIf(!hasDatabase)('failure drills', () => {
  let database: TestDatabase;
  let fixture: Fixture;
  let counter = 0;
  const uuid = () =>
    `00000000-0000-4000-a000-${String(++counter).padStart(12, '0')}`;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await database.asSuperuser(async (client) => {
      const adminId = await newAuthUser(client, 'drill-admin@example.test');
      const guardId = await newAuthUser(client, 'drill-guard@example.test');
      const firstResidentId = await newAuthUser(client, 'drill-a@example.test');
      const secondResidentId = await newAuthUser(
        client,
        'drill-b@example.test',
      );
      await client.query(
        `insert into public.profiles (id, email, full_name)
         values ($1, 'drill-admin@example.test', 'Admin'),
                ($2, 'drill-guard@example.test', 'Guard'),
                ($3, 'drill-a@example.test', 'Resident A'),
                ($4, 'drill-b@example.test', 'Resident B')`,
        [adminId, guardId, firstResidentId, secondResidentId],
      );
      const societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Drill Society', $1) returning id`,
          [adminId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'), ($1, 'visitor', true, '{}'),
                ($1, 'delivery', true, '{}'), ($1, 'service_request', true, '{}')`,
        [societyId],
      );
      const memberships = await client.query<{ id: string; user_id: string }>(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, ARRAY['admin']::text[], 'active'),
                ($1, $3, ARRAY['guard']::text[], 'active'),
                ($1, $4, ARRAY['resident']::text[], 'active'),
                ($1, $5, ARRAY['resident']::text[], 'active')
         returning id, user_id`,
        [societyId, adminId, guardId, firstResidentId, secondResidentId],
      );
      const membershipOf = (userId: string) =>
        memberships.rows.find((row) => row.user_id === userId)!.id;
      const unitId = (
        await client.query<{ id: string }>(
          `insert into public.units (society_id, number, created_by)
           values ($1, 'DR-1', $2) returning id`,
          [societyId, adminId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.unit_occupants (
           society_id, unit_id, membership_id, relationship, is_primary,
           is_approver, status, created_by
         )
         values ($1, $2, $3, 'owner', true, true, 'active', $5),
                ($1, $2, $4, 'family', false, true, 'active', $5)`,
        [
          societyId,
          unitId,
          membershipOf(firstResidentId),
          membershipOf(secondResidentId),
          adminId,
        ],
      );
      const guardRosterId = (
        await client.query<{ id: string }>(
          `insert into public.guard_roster (society_id, name, created_by)
           values ($1, 'Drill Guard', $2) returning id`,
          [societyId, adminId],
        )
      ).rows[0]!.id;
      const categoryId = (
        await client.query<{ id: string }>(
          `select id from public.service_request_categories
           where society_id = $1 and name = 'Plumbing'`,
          [societyId],
        )
      ).rows[0]!.id;
      return {
        societyId,
        unitId,
        guardId,
        guardRosterId,
        firstResidentId,
        secondResidentId,
        categoryId,
      };
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  const createVisitor = (client: Client, clientRequestId: string) =>
    client
      .query<{ id: string }>(
        `select id from public.visitor_create_entry(
           $1, $2, $3, $4, 'Drill Visitor', null, 'guest', 1,
           null, null, $5, 'drill-visitor'
         )`,
        [
          fixture.guardId,
          fixture.societyId,
          fixture.unitId,
          fixture.guardRosterId,
          clientRequestId,
        ],
      )
      .then((result) => result.rows[0]!.id);

  const createDelivery = (client: Client, clientRequestId: string) =>
    client
      .query<{ id: string }>(
        `select id from public.delivery_create_entry(
           $1, $2, $3, $4, 'Parcel Co', null, 'parcel', null, $5,
           'drill-delivery'
         )`,
        [
          fixture.guardId,
          fixture.societyId,
          fixture.unitId,
          fixture.guardRosterId,
          clientRequestId,
        ],
      )
      .then((result) => result.rows[0]!.id);

  const createRequest = (client: Client, clientRequestId: string) =>
    client
      .query<{ id: string }>(
        `select (public.request_create(
           $1, $2, 'unit', $3, 'Drill leaking tap', 'normal', '[]'::jsonb,
           $4::uuid, 'drill-request'
         )).id`,
        [
          fixture.societyId,
          fixture.categoryId,
          fixture.unitId,
          clientRequestId,
        ],
      )
      .then((result) => result.rows[0]!.id);

  async function countRows(table: string, clientRequestId: string) {
    const result = await database.asSuperuser((client) =>
      client.query<{ count: string }>(
        `select count(*)::text as count from public.${table}
         where client_request_id = $1`,
        [clientRequestId],
      ),
    );
    return result.rows[0]?.count;
  }

  it.each([
    ['visitor_entries', 'service_role', createVisitor],
    ['delivery_entries', 'service_role', createDelivery],
    ['service_requests', 'authenticated', createRequest],
  ] as const)(
    'stores one %s row when the same submission races itself',
    async (table, roleName, create) => {
      const clientRequestId = uuid();
      const sub = roleName === 'authenticated' ? fixture.firstResidentId : null;
      const [winner, loser] = await race(
        database,
        (client) => create(client, clientRequestId),
        () =>
          database.asRole(
            roleName,
            sub ? { sub } : null,
            (client) => create(client, clientRequestId),
            { commit: true },
          ),
        { name: roleName, sub },
      );
      expect(winner.status).toBe('fulfilled');
      // The loser sees the unique key; the app retries and receives the original row.
      expect(errorCode(loser)).toBe('23505');
      expect(await countRows(table, clientRequestId)).toBe('1');

      const retried = await database.asRole(
        roleName,
        sub ? { sub } : null,
        (client) => create(client, clientRequestId),
      );
      expect(retried).toBe(
        winner.status === 'fulfilled' ? winner.value : undefined,
      );
    },
  );

  it('lets the first of two concurrent visitor decisions win', async () => {
    const entryId = await database.asRole(
      'service_role',
      null,
      (client) => createVisitor(client, uuid()),
      { commit: true },
    );
    const [winner, loser] = await race(
      database,
      (client) =>
        client.query(`select public.visitor_decide($1, true, 'drill-a')`, [
          entryId,
        ]),
      () =>
        database.asRole(
          'authenticated',
          { sub: fixture.secondResidentId },
          (client) =>
            client.query(`select public.visitor_decide($1, false, 'drill-b')`, [
              entryId,
            ]),
          { commit: true },
        ),
      { name: 'authenticated', sub: fixture.firstResidentId },
    );
    expect(winner.status).toBe('fulfilled');
    expect(errorCode(loser)).toBe('23505');
    const status = await database.asSuperuser((client) =>
      client.query<{ status: string }>(
        'select status from public.visitor_entries where id = $1',
        [entryId],
      ),
    );
    expect(status.rows[0]?.status).toBe('approved');
  });

  it('lets the first of two concurrent delivery responses win', async () => {
    const entryId = await database.asRole(
      'service_role',
      null,
      (client) => createDelivery(client, uuid()),
      { commit: true },
    );
    const [winner, loser] = await race(
      database,
      (client) =>
        client.query(
          `select public.delivery_respond($1, 'denied', 'drill-a')`,
          [entryId],
        ),
      () =>
        database.asRole(
          'authenticated',
          { sub: fixture.secondResidentId },
          (client) =>
            client.query(
              `select public.delivery_respond($1, 'allowed', 'drill-b')`,
              [entryId],
            ),
          { commit: true },
        ),
      { name: 'authenticated', sub: fixture.firstResidentId },
    );
    expect(winner.status).toBe('fulfilled');
    expect(errorCode(loser)).toBe('23505');
    const status = await database.asSuperuser((client) =>
      client.query<{ status: string }>(
        'select status from public.delivery_entries where id = $1',
        [entryId],
      ),
    );
    expect(status.rows[0]?.status).toBe('denied');
  });
});
