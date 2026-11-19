// Verify SLA escalation timing, idempotency, routing, privacy and tenant isolation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type RunResult = {
  admin: number;
  committee: number;
  emails: Array<{
    email: string;
    name: string | null;
    level: 'admin' | 'committee';
    request_id: string;
    request_label: string;
  }>;
};

const indiaToday = `(now() at time zone 'Asia/Kolkata')::date`;
const none = { admin: 0, committee: 0, emails: [] };

describe.skipIf(!hasDatabase)('database service request escalation', () => {
  let database: TestDatabase;
  let founderId: string;
  let societyId: string;
  let otherSocietyId: string;
  let quietSocietyId: string;
  let suspendedSocietyId: string;
  let categoryIds: Record<string, string>;
  let adminId: string;
  let committeeId: string;
  let residentId: string;
  let otherAdminIds: string[];
  let counter = 0;

  async function createSociety(name: string) {
    return database.asSuperuser(async (client) => {
      const id = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by) values ($1, $2)
           returning id`,
          [name, founderId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'),
                ($1, 'service_request', true, '{"auto_close_days":3}')`,
        [id],
      );
      categoryIds[id] = (
        await client.query<{ id: string }>(
          `select id from public.service_request_categories
           where society_id = $1 and name = 'Electrical'`,
          [id],
        )
      ).rows[0]!.id;
      return id;
    });
  }

  async function addMember(
    society: string,
    role: 'admin' | 'committee' | 'resident',
    label: string,
  ) {
    return database.asSuperuser(async (client) => {
      const email = `escalation-${label}@example.test`;
      const userId = await newAuthUser(client, email);
      await client.query(
        `insert into public.profiles (id, email, full_name) values ($1, $2, $3)`,
        [userId, email, `Synthetic ${label}`],
      );
      await client.query(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, ARRAY[$3]::text[], 'active')`,
        [society, userId, role],
      );
      return userId;
    });
  }

  async function insertRequest(
    society: string,
    slaDue: string,
    status = 'open',
  ) {
    counter += 1;
    const clientRequestId = `00000000-0000-4000-9100-${String(counter).padStart(12, '0')}`;
    return database.asSuperuser(
      async (client) =>
        (
          await client.query<{ id: string }>(
            `insert into public.service_requests (
               society_id, created_by, category_id, location_type, description,
               status, sla_due_at, resolved_at, closed_at, reject_reason,
               client_request_id
             )
             values (
               $1, $2, $3, 'common_area', 'Synthetic lobby light', $4,
               ${slaDue},
               case when $4 in ('resolved', 'closed') then now() end,
               case when $4 = 'closed' then now() end,
               case when $4 = 'rejected' then 'Synthetic reason' end,
               $5::uuid
             )
             returning id`,
            [
              society,
              residentId,
              categoryIds[society],
              status,
              clientRequestId,
            ],
          )
        ).rows[0]!.id,
    );
  }

  const runSql = `select public.request_escalation_run(
     $1, ${indiaToday} + $2::integer, 'escalation-integration'
   ) as result`;

  function run(society: string, dayOffset = 0) {
    return database.asRole(
      'service_role',
      {},
      async (client) =>
        (
          await client.query<{ result: RunResult }>(runSql, [
            society,
            dayOffset,
          ])
        ).rows[0]!.result,
      { commit: true },
    );
  }

  function levels(requestId: string) {
    return database.asSuperuser(async (client) =>
      (
        await client.query<{ level: string; recipient_count: number }>(
          `select level, recipient_count from public.service_request_escalations
           where request_id = $1 order by created_at, level`,
          [requestId],
        )
      ).rows.map(({ level, recipient_count }) => ({
        level,
        recipient_count,
      })),
    );
  }

  function backdateAdminStep(requestId: string, days: number) {
    return database.asSuperuser((client) =>
      client.query(
        `update public.service_request_escalations
         set escalated_on = ${indiaToday} - $2::integer
         where request_id = $1 and level = 'admin'`,
        [requestId, days],
      ),
    );
  }

  function setStatus(requestId: string, status: 'resolved' | 'reopened') {
    return database.asSuperuser((client) =>
      client.query(
        `update public.service_requests
         set status = $2,
             resolved_at = case when $2 = 'resolved' then now() end,
             sla_due_at = now() - interval '1 minute'
         where id = $1`,
        [requestId, status],
      ),
    );
  }

  function notificationCount(userId: string, requestId: string) {
    return database.asSuperuser(
      async (client) =>
        (
          await client.query<{ count: number }>(
            `select count(*)::integer as count from public.notifications
             where user_id = $1 and entity_id = $2
               and type = 'service_request_escalated'`,
            [userId, requestId],
          )
        ).rows[0]!.count,
    );
  }

  function saveSettings(
    userId: string,
    society: string,
    delivery: string,
    expectedUpdatedAt: string | null,
  ) {
    return database.asRole(
      'authenticated',
      { sub: userId },
      async (client) =>
        (
          await client.query<{
            result: { delivery: string; updated_at: string };
          }>(
            `select public.request_escalation_settings_save(
               $1, $2, $3::timestamptz, 'escalation-integration'
             ) as result`,
            [society, delivery, expectedUpdatedAt],
          )
        ).rows[0]!.result,
      { commit: true },
    );
  }

  function listAs(userId: string) {
    return database.asRole(
      'authenticated',
      { sub: userId },
      async (client) =>
        (
          await client.query<{
            result: Array<{ id: string; escalation_level: string }>;
          }>(
            `select public.request_list(
               $1, null, null, null, null, null, null, 100, 0, 'default'
             ) as result`,
            [societyId],
          )
        ).rows[0]!.result,
    );
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    categoryIds = {};
    founderId = await database.asSuperuser(async (client) => {
      const id = await newAuthUser(client, 'escalation-founder@example.test');
      await client.query(
        `insert into public.profiles (id, email, full_name)
         values ($1, 'escalation-founder@example.test', 'Synthetic founder')`,
        [id],
      );
      return id;
    });
    societyId = await createSociety('Escalation Society');
    otherSocietyId = await createSociety('Other Escalation Society');
    quietSocietyId = await createSociety('No Committee Society');
    suspendedSocietyId = await createSociety('Suspended Escalation Society');
    adminId = await addMember(societyId, 'admin', 'admin');
    committeeId = await addMember(societyId, 'committee', 'committee');
    residentId = await addMember(societyId, 'resident', 'resident');
    otherAdminIds = [];
    for (let index = 0; index < 11; index += 1) {
      otherAdminIds.push(
        await addMember(otherSocietyId, 'admin', `other-admin-${index}`),
      );
    }
    await addMember(quietSocietyId, 'admin', 'quiet-admin');
    await addMember(suspendedSocietyId, 'admin', 'suspended-admin');
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('only allows the service role to run escalation', async () => {
    const error = await dbError(
      database.asRole('authenticated', { sub: adminId }, (client) =>
        client.query(runSql, [societyId, 0]),
      ),
    );
    expect(error.code).toBe('42501');
  });

  it('accepts only yesterday or today in India as the run date', async () => {
    for (const offset of [-2, 1]) {
      expect((await dbError(run(societyId, offset))).code).toBe('22023');
    }
    expect(await run(societyId, -1)).toEqual(none);
  });

  it('escalates to admins once the SLA passes, then to the committee after N days', async () => {
    const overdue = await insertRequest(
      societyId,
      `now() - interval '1 minute'`,
    );
    const notDue = await insertRequest(societyId, `now() + interval '1 hour'`);

    // Yesterday's cut-off is midnight India time, before this SLA passed.
    expect(await run(societyId, -1)).toEqual(none);
    expect(await run(societyId)).toEqual({
      admin: 1,
      committee: 0,
      emails: [],
    });
    expect(await levels(overdue)).toEqual([
      { level: 'admin', recipient_count: 1 },
    ]);
    expect(await levels(notDue)).toEqual([]);
    expect(await notificationCount(adminId, overdue)).toBe(1);
    expect(await notificationCount(committeeId, overdue)).toBe(0);
    expect(await notificationCount(residentId, overdue)).toBe(0);

    expect(await run(societyId)).toEqual(none);
    expect(await notificationCount(adminId, overdue)).toBe(1);
    const events = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ count: number }>(
            `select count(*)::integer as count from public.service_request_events
             where request_id = $1 and event_type = 'escalated'`,
            [overdue],
          )
        ).rows[0]!.count,
    );
    expect(events).toBe(1);

    // Default interval is 2 days from the admin escalation date.
    await backdateAdminStep(overdue, 1);
    expect(await run(societyId)).toEqual(none);
    await backdateAdminStep(overdue, 2);
    expect(await run(societyId)).toEqual({
      admin: 0,
      committee: 1,
      emails: [],
    });
    expect(await run(societyId)).toEqual(none);
    expect(await levels(overdue)).toEqual([
      { level: 'admin', recipient_count: 1 },
      { level: 'committee', recipient_count: 1 },
    ]);
    expect(await notificationCount(committeeId, overdue)).toBe(1);
    expect(await notificationCount(adminId, overdue)).toBe(1);

    await database.asSuperuser((client) =>
      client.query(
        `update public.service_requests set sla_due_at = null where id = $1`,
        [notDue],
      ),
    );
  });

  it('shows the escalation without naming recipients and lists the level for residents', async () => {
    const requestId = await insertRequest(
      societyId,
      `now() - interval '2 hours'`,
    );
    await run(societyId);

    const detail = await database.asRole(
      'authenticated',
      { sub: residentId },
      async (client) =>
        (
          await client.query<{
            result: {
              request: { escalation_level: string };
              events: Array<{
                event_type: string;
                note: string | null;
                created_by: string | null;
              }>;
            };
          }>(`select public.request_get($1, $2) as result`, [
            societyId,
            requestId,
          ])
        ).rows[0]!.result,
    );
    expect(detail.request.escalation_level).toBe('admin');
    const escalated = detail.events.filter(
      ({ event_type }) => event_type === 'escalated',
    );
    expect(escalated).toHaveLength(1);
    expect(escalated[0]).toMatchObject({
      note: 'Escalated to the society admins',
      created_by: null,
    });
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('Synthetic admin');
    expect(serialized).not.toContain('escalation-admin@example.test');

    for (const userId of [adminId, residentId]) {
      const list = await listAs(userId);
      expect(list.find(({ id }) => id === requestId)?.escalation_level).toBe(
        'admin',
      );
      expect(list.every(({ escalation_level }) => escalation_level)).toBe(true);
    }

    const direct = await dbError(
      database.asRole('authenticated', { sub: adminId }, (client) =>
        client.query(`select * from public.service_request_escalations`),
      ),
    );
    expect(direct.code).toBe('42501');
  });

  it('never escalates finished requests and never repeats the admin step after reopening', async () => {
    const finished = await Promise.all(
      (['resolved', 'closed', 'rejected'] as const).map((status) =>
        insertRequest(societyId, `now() - interval '3 days'`, status),
      ),
    );
    const reopened = await insertRequest(societyId, `now() - interval '1 day'`);
    await run(societyId);
    await setStatus(reopened, 'resolved');
    await backdateAdminStep(reopened, 5);
    expect(await run(societyId)).toEqual(none);

    await setStatus(reopened, 'reopened');
    await backdateAdminStep(reopened, 0);
    expect(await run(societyId)).toEqual(none);

    for (const requestId of finished) {
      expect(await levels(requestId)).toEqual([]);
    }
    expect(await levels(reopened)).toEqual([
      { level: 'admin', recipient_count: 1 },
    ]);
    expect(await notificationCount(adminId, reopened)).toBe(1);
  });

  it('uses the per-category committee interval', async () => {
    const categoryId = categoryIds[societyId]!;
    const save = (days: number | null) =>
      database.asRole(
        'authenticated',
        { sub: adminId },
        async (client) => {
          const current = await client.query<{ updated_at: string }>(
            `select updated_at::text as updated_at
             from public.service_request_categories where id = $1`,
            [categoryId],
          );
          return (
            await client.query<{
              result: { committee_escalation_days: number };
            }>(
              `select to_jsonb(public.request_category_save(
                 $1, $2, 'Electrical', 4, 20, true, $3::timestamptz,
                 'escalation-integration', $4
               )) as result`,
              [societyId, categoryId, current.rows[0]!.updated_at, days],
            )
          ).rows[0]!.result;
        },
        { commit: true },
      );

    for (const invalid of [0, 31]) {
      expect((await dbError(save(invalid))).code).toBe('22023');
    }
    expect((await save(5)).committee_escalation_days).toBe(5);
    expect((await save(null)).committee_escalation_days).toBe(5);
    await save(1);
    // Societies created after P49 start per priority; the later settings test needs no row.
    await database.asSuperuser((client) =>
      client.query(
        `insert into public.service_request_escalation_settings (
           society_id, committee_wait_mode
         ) values ($1, 'per_category')`,
        [societyId],
      ),
    );

    try {
      const requestId = await insertRequest(
        societyId,
        `now() - interval '5 minutes'`,
      );
      await run(societyId);
      expect(await levels(requestId)).toHaveLength(1);
      await backdateAdminStep(requestId, 1);
      await run(societyId);
      expect((await levels(requestId)).map(({ level }) => level)).toEqual([
        'admin',
        'committee',
      ]);
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `delete from public.service_request_escalation_settings
           where society_id = $1`,
          [societyId],
        ),
      );
    }
  });

  it('records one escalation per level when two runs overlap', async () => {
    const requestId = await insertRequest(
      societyId,
      `now() - interval '5 minutes'`,
    );
    const [first, second] = await database.asRole(
      'service_role',
      {},
      async (client) => {
        const held = (
          await client.query<{ result: RunResult }>(runSql, [societyId, 0])
        ).rows[0]!.result;
        // The first run still holds its row locks here.
        const overlapping = await run(societyId);
        return [held, overlapping];
      },
      { commit: true },
    );
    expect(first.admin).toBe(1);
    expect(second).toEqual(none);
    expect(await run(societyId)).toEqual(none);
    expect(await levels(requestId)).toEqual([
      { level: 'admin', recipient_count: 1 },
    ]);
  });

  it('validates settings and always sends in-app alongside email', async () => {
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: residentId }, (client) =>
            client.query(`select public.request_escalation_settings_get($1)`, [
              societyId,
            ]),
          ),
        )
      ).code,
    ).toBe('42501');
    expect(
      (await dbError(saveSettings(committeeId, societyId, 'in_app', null)))
        .code,
    ).toBe('42501');
    for (const invalid of ['email', 'both', 'sms']) {
      expect(
        (await dbError(saveSettings(adminId, societyId, invalid, null))).code,
      ).toBe('22023');
    }
    expect(
      (
        await dbError(
          saveSettings(adminId, otherSocietyId, 'in_app_email', null),
        )
      ).code,
    ).toBe('42501');

    const saved = await saveSettings(adminId, societyId, 'in_app_email', null);
    expect(saved.delivery).toBe('in_app_email');
    const stale = await dbError(
      saveSettings(adminId, societyId, 'in_app', '2000-01-01T00:00:00Z'),
    );
    expect(stale.code).toBe('23505');

    const read = await database.asRole(
      'authenticated',
      { sub: adminId },
      async (client) =>
        (
          await client.query<{ result: { delivery: string } }>(
            `select public.request_escalation_settings_get($1) as result`,
            [societyId],
          )
        ).rows[0]!.result,
    );
    expect(read.delivery).toBe('in_app_email');

    const requestId = await insertRequest(
      societyId,
      `now() - interval '10 minutes'`,
    );
    const result = await run(societyId);
    expect(result.admin).toBe(1);
    expect(result.emails).toEqual([
      expect.objectContaining({
        email: 'escalation-admin@example.test',
        level: 'admin',
        request_id: requestId,
        request_label: 'Electrical · Common area',
      }),
    ]);
    expect(await notificationCount(adminId, requestId)).toBe(1);

    await saveSettings(adminId, societyId, 'in_app', saved.updated_at);
    const inAppOnly = await insertRequest(
      societyId,
      `now() - interval '10 minutes'`,
    );
    expect((await run(societyId)).emails).toEqual([]);
    expect(await notificationCount(adminId, inAppOnly)).toBe(1);
  });

  it('keeps societies isolated and caps recipients', async () => {
    const otherRequest = await insertRequest(
      otherSocietyId,
      `now() - interval '1 hour'`,
    );
    await run(societyId);
    expect(await levels(otherRequest)).toEqual([]);

    expect(await run(otherSocietyId)).toEqual({
      admin: 1,
      committee: 0,
      emails: [],
    });
    expect(await levels(otherRequest)).toEqual([
      { level: 'admin', recipient_count: 10 },
    ]);
    const notified = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ user_id: string; society_id: string }>(
            `select user_id, society_id from public.notifications
             where entity_id = $1 and type = 'service_request_escalated'`,
            [otherRequest],
          )
        ).rows,
    );
    expect(notified).toHaveLength(10);
    expect(
      notified.every(
        ({ user_id, society_id }) =>
          society_id === otherSocietyId && otherAdminIds.includes(user_id),
      ),
    ).toBe(true);
    expect(await notificationCount(adminId, otherRequest)).toBe(0);
  });

  it('records a committee step with no recipients when there is no committee', async () => {
    const requestId = await insertRequest(
      quietSocietyId,
      `now() - interval '1 hour'`,
    );
    await run(quietSocietyId);
    await backdateAdminStep(requestId, 2);
    expect(await run(quietSocietyId)).toEqual({
      admin: 0,
      committee: 1,
      emails: [],
    });
    expect(await levels(requestId)).toEqual([
      { level: 'admin', recipient_count: 1 },
      { level: 'committee', recipient_count: 0 },
    ]);
    expect(await run(quietSocietyId)).toEqual(none);
  });

  it('does nothing for suspended societies', async () => {
    const requestId = await insertRequest(
      suspendedSocietyId,
      `now() - interval '1 hour'`,
    );
    await database.asSuperuser((client) =>
      client.query(
        `update public.societies set status = 'suspended' where id = $1`,
        [suspendedSocietyId],
      ),
    );
    expect(await run(suspendedSocietyId)).toEqual(none);
    expect(await levels(requestId)).toEqual([]);
  });

  it('does nothing while the module is disabled', async () => {
    const requestId = await insertRequest(
      societyId,
      `now() - interval '1 hour'`,
    );
    await database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled = false
         where society_id = $1 and module_key = 'service_request'`,
        [societyId],
      ),
    );
    try {
      expect(await run(societyId)).toEqual(none);
      expect(await levels(requestId)).toEqual([]);
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = true
           where society_id = $1 and module_key = 'service_request'`,
          [societyId],
        ),
      );
    }
  });

  it('lets retention delete old closed requests that were escalated', async () => {
    const requestId = await insertRequest(
      societyId,
      `now() - interval '1 hour'`,
    );
    await run(societyId);
    expect(await levels(requestId)).toHaveLength(1);
    await database.asSuperuser((client) =>
      client.query(
        `update public.service_requests
         set status = 'closed',
             resolved_at = now() - interval '3 years',
             closed_at = now() - interval '3 years'
         where id = $1`,
        [requestId],
      ),
    );

    await database.asRole(
      'service_role',
      {},
      (client) =>
        client.query(
          `select public.housekeeping_retention_run(
             ${indiaToday}, 'escalation-retention'
           )`,
        ),
      { commit: true },
    );

    const remaining = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ requests: number; escalations: number }>(
            `select
               (select count(*)::integer from public.service_requests
                where id = $1) as requests,
               (select count(*)::integer from public.service_request_escalations
                where request_id = $1) as escalations`,
            [requestId],
          )
        ).rows[0]!,
    );
    expect(remaining).toEqual({ requests: 0, escalations: 0 });
  });
});
