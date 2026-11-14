// Verify request defaults, tenant visibility, transitions and notification transactions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Role =
  'admin' | 'resident' | 'neighbour' | 'worker' | 'committee' | 'guard';

describe.skipIf(!hasDatabase)('database service requests', () => {
  let database: TestDatabase;
  let societyId: string;
  let otherSocietyId: string;
  let unitId: string;
  let neighbourUnitId: string;
  let categoryId: string;
  let memberships: Record<Role, string>;
  let users: Record<Role, string>;
  let requestCounter = 0;

  function id() {
    requestCounter += 1;
    return `00000000-0000-4000-9000-${String(requestCounter).padStart(12, '0')}`;
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      users = {} as Record<Role, string>;
      memberships = {} as Record<Role, string>;
      for (const role of [
        'admin',
        'resident',
        'neighbour',
        'worker',
        'committee',
        'guard',
      ] as const) {
        const email = `service-requests-${role}@example.test`;
        users[role] = await newAuthUser(client, email);
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, $2, $3)`,
          [users[role], email, `Synthetic ${role}`],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Service Request Society', $1) returning id`,
          [users.admin],
        )
      ).rows[0]!.id;
      otherSocietyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Other Request Society', $1) returning id`,
          [users.admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'),
                ($1, 'service_request', true, '{"auto_close_days":3}'),
                ($2, 'core', true, '{}'),
                ($2, 'service_request', true, '{"auto_close_days":3}')`,
        [societyId, otherSocietyId],
      );
      for (const role of [
        'admin',
        'resident',
        'neighbour',
        'worker',
        'committee',
        'guard',
      ] as const) {
        memberships[role] = (
          await client.query<{ id: string }>(
            `insert into public.memberships (society_id, user_id, roles, status)
             values ($1, $2, ARRAY[$3]::text[], 'active') returning id`,
            [
              societyId,
              users[role],
              role === 'admin'
                ? 'admin'
                : role === 'committee'
                  ? 'committee'
                  : role === 'guard'
                    ? 'guard'
                    : 'resident',
            ],
          )
        ).rows[0]!.id;
      }
      const units = await client.query<{ id: string; number: string }>(
        `insert into public.units (society_id, number, created_by, updated_by)
         values ($1, 'SR-101', $2, $2), ($1, 'SR-102', $2, $2)
         returning id, number`,
        [societyId, users.admin],
      );
      unitId = units.rows.find(({ number }) => number === 'SR-101')!.id;
      neighbourUnitId = units.rows.find(
        ({ number }) => number === 'SR-102',
      )!.id;
      await client.query(
        `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
         values ($1, $2, $3, 'owner', true, 'active', $5),
                ($1, $4, $6, 'owner', true, 'active', $5)`,
        [
          societyId,
          unitId,
          memberships.resident,
          neighbourUnitId,
          users.admin,
          memberships.neighbour,
        ],
      );
      categoryId = (
        await client.query<{ id: string }>(
          `select id from public.service_request_categories
           where society_id = $1 and name = 'Plumbing'`,
          [societyId],
        )
      ).rows[0]!.id;
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('aggregates the dashboard by individual request category', async () => {
    await createRequest('resident');
    const dashboard = await database.asRole(
      'authenticated',
      { sub: users.admin },
      async (client) =>
        (
          await client.query<{
            result: {
              total_open: number;
              by_status: Record<string, number>;
              by_category: Array<{
                category_id: string;
                category: string;
                total: number;
              }>;
            };
          }>(`select public.request_dashboard($1) as result`, [societyId])
        ).rows[0]!.result,
    );

    expect(dashboard.total_open).toBe(1);
    expect(dashboard.by_status).toEqual({ open: 1 });
    expect(dashboard.by_category).toHaveLength(8);
    expect(
      dashboard.by_category.find(
        (category) => category.category_id === categoryId,
      ),
    ).toMatchObject({ category: 'Plumbing', total: 1 });
  });

  function uploadPhoto(role: Role, path: string) {
    return database.asRole('authenticated', { sub: users[role] }, (client) =>
      client.query(
        `insert into storage.objects (bucket_id, name)
           values ('request-files', $1)`,
        [path],
      ),
    );
  }

  async function createRequest(
    role: 'resident' | 'admin',
    values: {
      locationType?: 'unit' | 'common_area';
      clientRequestId?: string;
      attachments?: {
        path: string;
        content_type: string;
        size_bytes: number;
      }[];
    } = {},
  ) {
    const requestId = values.clientRequestId ?? id();
    return database.asRole(
      'authenticated',
      { sub: users[role] },
      async (client) =>
        (
          await client.query<{ id: string; status: string }>(
            `select (public.request_create(
              $1, $2, $3, $4, 'Synthetic leaking tap', 'normal', $5::jsonb,
              $6::uuid, 'request-integration'
            )).*`,
            [
              societyId,
              categoryId,
              values.locationType ?? 'unit',
              values.locationType === 'common_area' ? null : unitId,
              JSON.stringify(values.attachments ?? []),
              requestId,
            ],
          )
        ).rows[0]!,
      { commit: true },
    );
  }

  async function statusAs(userId: string, requestId: string, status: string) {
    return database.asRole(
      'authenticated',
      { sub: userId },
      async (client) =>
        (
          await client.query<{ status: string }>(
            `select (public.request_update_status(
              $1, $2, $3, 'request-integration'
            )).status`,
            [societyId, requestId, status],
          )
        ).rows[0]!.status,
      { commit: true },
    );
  }

  it('seeds default categories and only exposes requests allowed by unit and common-area rules', async () => {
    const categoryNames = await database.asRole(
      'authenticated',
      { sub: users.resident },
      async (client) =>
        (
          await client.query<{ name: string }>(
            `select name from public.service_request_categories
             where society_id = $1 order by sort_order`,
            [societyId],
          )
        ).rows.map(({ name }) => name),
    );
    expect(categoryNames).toEqual([
      'Plumbing',
      'Electrical',
      'Lift',
      'Cleaning',
      'Security',
      'Parking',
      'Noise',
      'Other',
    ]);

    const own = await createRequest('resident');
    const common = await createRequest('resident', {
      locationType: 'common_area',
    });
    const visible = await database.asRole(
      'authenticated',
      { sub: users.neighbour },
      async (client) => ({
        own: await client.query(
          `select id from public.service_requests where id = $1`,
          [own.id],
        ),
        common: await client.query(
          `select id from public.service_requests where id = $1`,
          [common.id],
        ),
        otherSocietyCategories: await client.query(
          `select id from public.service_request_categories where society_id = $1`,
          [otherSocietyId],
        ),
      }),
    );
    expect(visible.own.rows).toHaveLength(0);
    expect(visible.common.rows).toHaveLength(1);
    expect(visible.otherSocietyCategories.rows).toHaveLength(0);
    const listed = await database.asRole(
      'authenticated',
      { sub: users.neighbour },
      async (client) =>
        (
          await client.query<{ result: unknown }>(
            `select public.request_list(
              $1, null, null, null, null, null, null, 50, 0
            ) as result`,
            [societyId],
          )
        ).rows[0]!.result,
    );
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: common.id,
          category_name: 'Plumbing',
          location_type: 'common_area',
          is_overdue: false,
        }),
      ]),
    );
    expect(listed).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: own.id })]),
    );
    const detail = await database.asRole(
      'authenticated',
      { sub: users.neighbour },
      async (client) =>
        (
          await client.query<{ result: { request: { id: string } } }>(
            `select public.request_get($1, $2) as result`,
            [societyId, common.id],
          )
        ).rows[0]!.result,
    );
    expect(detail.request.id).toBe(common.id);
    expect(detail.request).toMatchObject({
      category_name: 'Plumbing',
      requester_name: 'Synthetic resident',
    });

    const guardVisible = await database.asRole(
      'authenticated',
      { sub: users.guard },
      async (client) => ({
        requests: await client.query(
          `select id from public.service_requests where id = $1`,
          [common.id],
        ),
        categories: await client.query(
          `select id from public.service_request_categories where society_id = $1`,
          [societyId],
        ),
      }),
    );
    expect(guardVisible.requests.rows).toHaveLength(0);
    expect(guardVisible.categories.rows).toHaveLength(0);

    const commentError = await dbError(
      database.asRole(
        'authenticated',
        { sub: users.neighbour },
        (client) =>
          client.query(
            `select public.request_add_comment(
              $1, $2, 'Not my request', $3::uuid, 'request-integration'
            )`,
            [societyId, common.id, id()],
          ),
        { commit: true },
      ),
    );
    expect(commentError).toMatchObject({ code: '42501' });
  });

  it('is idempotent and attaches at most three owner-scoped photos', async () => {
    const clientRequestId = id();
    const path = `${societyId}/${users.resident}/requests/${clientRequestId}/${id()}.jpg`;
    const attachments = [
      { path, content_type: 'image/jpeg', size_bytes: 4096 },
    ];
    const first = await createRequest('resident', {
      clientRequestId,
      attachments,
    });
    const duplicate = await createRequest('resident', {
      clientRequestId,
      attachments,
    });
    expect(duplicate.id).toBe(first.id);

    const rows = await database.asSuperuser(
      async (client) =>
        (
          await client.query(
            `select storage_path from public.service_request_attachments
           where request_id = $1`,
            [first.id],
          )
        ).rows,
    );
    expect(rows).toEqual([{ storage_path: path }]);

    const tooMany = await dbError(
      database.asRole(
        'authenticated',
        { sub: users.resident },
        (client) =>
          client.query(
            `select public.request_create(
              $1, $2, 'unit', $3, 'Too many photos', 'normal',
              $4::jsonb, $5::uuid, 'request-integration'
            )`,
            [
              societyId,
              categoryId,
              unitId,
              JSON.stringify(
                [1, 2, 3, 4].map(() => ({
                  path: `${societyId}/${users.resident}/requests/${id()}/${id()}.png`,
                  content_type: 'image/png',
                  size_bytes: 1024,
                })),
              ),
              id(),
            ],
          ),
        { commit: true },
      ),
    );
    expect(tooMany).toMatchObject({ code: '22023' });
  });

  it('enforces assignment, valid transitions, resident confirmation, ratings and reopen window', async () => {
    const request = await createRequest('resident');
    const assignment = await database.asRole(
      'authenticated',
      { sub: users.admin },
      async (client) =>
        (
          await client.query<{ status: string }>(
            `select (public.request_assign(
              $1, $2, $3, null, null, 'Assigned to worker', 'request-integration'
            )).status`,
            [societyId, request.id, memberships.worker],
          )
        ).rows[0]!.status,
      { commit: true },
    );
    expect(assignment).toBe('assigned');
    await expect(
      statusAs(users.worker, request.id, 'in_progress'),
    ).resolves.toBe('in_progress');
    await expect(statusAs(users.worker, request.id, 'resolved')).resolves.toBe(
      'resolved',
    );

    const close = await database.asRole(
      'authenticated',
      { sub: users.resident },
      async (client) =>
        (
          await client.query<{ status: string }>(
            `select (public.request_confirm_close(
              $1, $2, 'request-integration'
            )).status`,
            [societyId, request.id],
          )
        ).rows[0]!.status,
      { commit: true },
    );
    expect(close).toBe('closed');

    await database.asRole(
      'authenticated',
      { sub: users.resident },
      (client) =>
        client.query(
          `select public.request_rate(
            $1, $2, 5, 'Resolved promptly', 'request-integration'
          )`,
          [societyId, request.id],
        ),
      { commit: true },
    );
    const duplicateRating = await dbError(
      database.asRole(
        'authenticated',
        { sub: users.resident },
        (client) =>
          client.query(
            `select public.request_rate(
              $1, $2, 4, null, 'request-integration'
            )`,
            [societyId, request.id],
          ),
        { commit: true },
      ),
    );
    expect(duplicateRating).toMatchObject({ code: '23505' });

    await database.asRole(
      'authenticated',
      { sub: users.resident },
      (client) =>
        client.query(
          `select public.request_reopen(
            $1, $2, 'The leak returned', 'request-integration'
          )`,
          [societyId, request.id],
        ),
      { commit: true },
    );
    const state = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ status: string; rating: number | null }>(
            `select status, rating from public.service_requests where id = $1`,
            [request.id],
          )
        ).rows[0]!,
    );
    expect(state).toEqual({ status: 'reopened', rating: null });
  });

  it('notifies administrators and requesters transactionally and auto-closes resolved requests', async () => {
    const request = await createRequest('resident');
    await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query(
          `select public.request_assign(
            $1, $2, null, 'Synthetic Plumbing Co.', '+919999000000',
            null, 'request-integration'
          )`,
          [societyId, request.id],
        ),
      { commit: true },
    );
    await statusAs(users.admin, request.id, 'in_progress');
    await statusAs(users.admin, request.id, 'resolved');
    await database.asSuperuser((client) =>
      client.query(
        `update public.service_requests
         set resolved_at = now() - interval '4 days'
         where id = $1`,
        [request.id],
      ),
    );
    const count = await database.asRole(
      'service_role',
      {},
      async (client) =>
        (
          await client.query<{ count: number }>(
            `select public.request_auto_close_run(
              $1, current_date, 'request-integration'
            )::integer as count`,
            [societyId],
          )
        ).rows[0]!.count,
      { commit: true },
    );
    expect(count).toBe(1);

    const result = await database.asSuperuser(async (client) => ({
      request: (
        await client.query<{ status: string }>(
          `select status from public.service_requests where id = $1`,
          [request.id],
        )
      ).rows[0],
      eventTypes: (
        await client.query<{ event_type: string }>(
          `select event_type from public.service_request_events
           where request_id = $1 order by created_at`,
          [request.id],
        )
      ).rows.map(({ event_type }) => event_type),
      notificationCount: (
        await client.query<{ count: string }>(
          `select count(*) from public.notifications
           where society_id = $1 and entity_id = $2`,
          [societyId, request.id],
        )
      ).rows[0]!.count,
    }));
    expect(result.request?.status).toBe('closed');
    expect(result.eventTypes).toEqual([
      'created',
      'assigned',
      'status_changed',
      'status_changed',
      'auto_closed',
    ]);
    expect(Number(result.notificationCount)).toBeGreaterThanOrEqual(4);
  });

  it('restricts request photo uploads to an authorized requester-owned path', async () => {
    const path = `${societyId}/${users.resident}/requests/${id()}/${id()}.jpg`;
    expect((await uploadPhoto('resident', path)).rowCount).toBe(1);

    const otherOwner = await dbError(
      uploadPhoto(
        'resident',
        `${societyId}/${users.worker}/requests/${id()}/${id()}.jpg`,
      ),
    );
    expect(otherOwner).toMatchObject({ code: '42501' });

    const guard = await dbError(
      uploadPhoto(
        'guard',
        `${societyId}/${users.guard}/requests/${id()}/${id()}.jpg`,
      ),
    );
    expect(guard).toMatchObject({ code: '42501' });

    const crossSociety = await dbError(
      uploadPhoto(
        'resident',
        `${otherSocietyId}/${users.resident}/requests/${id()}/${id()}.jpg`,
      ),
    );
    expect(crossSociety).toMatchObject({ code: '42501' });
  });

  it('lets only the uploader read a photo before it is attached', async () => {
    const path = `${societyId}/${users.resident}/requests/${id()}/${id()}.jpg`;
    await database.asSuperuser((client) =>
      client.query(
        `insert into storage.objects (bucket_id, name)
           values ('request-files', $1)`,
        [path],
      ),
    );
    const visibleTo = (role: Role) =>
      database.asRole('authenticated', { sub: users[role] }, async (client) =>
        Number(
          (
            await client.query<{ count: string }>(
              `select count(*) from storage.objects
               where bucket_id = 'request-files' and name = $1`,
              [path],
            )
          ).rows[0]!.count,
        ),
      );
    expect(await visibleTo('resident')).toBe(1);
    expect(await visibleTo('neighbour')).toBe(0);
    expect(await visibleTo('worker')).toBe(0);
  });

  it('blocks writes when the society is suspended or the module is disabled', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `update public.societies set status = 'suspended' where id = $1`,
        [societyId],
      ),
    );
    const suspended = await dbError(
      database.asRole(
        'authenticated',
        { sub: users.resident },
        (client) =>
          client.query(
            `select public.request_create(
              $1, $2, 'unit', $3, 'Blocked while suspended', 'normal',
              '[]'::jsonb, $4::uuid, 'request-integration'
            )`,
            [societyId, categoryId, unitId, id()],
          ),
        { commit: true },
      ),
    );
    expect(suspended).toMatchObject({ code: '42501' });
    const suspendedPhoto = await dbError(
      uploadPhoto(
        'resident',
        `${societyId}/${users.resident}/requests/${id()}/${id()}.jpg`,
      ),
    );
    expect(suspendedPhoto).toMatchObject({ code: '42501' });
    await database.asSuperuser(async (client) => {
      await client.query(
        `update public.societies set status = 'active' where id = $1`,
        [societyId],
      );
      await client.query(
        `update public.module_configs set enabled = false
         where society_id = $1 and module_key = 'service_request'`,
        [societyId],
      );
    });
    const disabled = await dbError(
      database.asRole(
        'authenticated',
        { sub: users.resident },
        (client) =>
          client.query(
            `select public.request_create(
              $1, $2, 'unit', $3, 'Blocked while disabled', 'normal',
              '[]'::jsonb, $4::uuid, 'request-integration'
            )`,
            [societyId, categoryId, unitId, id()],
          ),
        { commit: true },
      ),
    );
    expect(disabled).toMatchObject({ code: '42501' });
    const disabledPhoto = await dbError(
      uploadPhoto(
        'resident',
        `${societyId}/${users.resident}/requests/${id()}/${id()}.jpg`,
      ),
    );
    expect(disabledPhoto).toMatchObject({ code: '42501' });
  });
});
