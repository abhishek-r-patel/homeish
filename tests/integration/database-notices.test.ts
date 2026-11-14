// Verify notice audiences, manager rights, read receipts, expiry archive, attachments and isolation.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

type User =
  'admin' | 'committee' | 'owner' | 'tenant' | 'family' | 'guard' | 'outsider';

type NoticeJson = {
  id: string;
  title: string;
  audience: string;
  pinned: boolean;
  status: string;
  edited_at: string | null;
  updated_at: string;
  expires_at: string | null;
  is_expired: boolean;
  has_read: boolean;
  read_count: number | null;
  audience_count?: number;
  can_manage: boolean;
  author_name: string;
  blocks: { id: string; name: string }[];
  attachment_path: string | null;
};

describe.skipIf(!hasDatabase)('database notice board', () => {
  it('targets audiences, tracks reads and archives withdrawn or expired notices', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = {} as Record<User, string>;
        for (const name of [
          'admin',
          'committee',
          'owner',
          'tenant',
          'family',
          'guard',
          'outsider',
        ] as const) {
          users[name] = await newAuthUser(
            client,
            `notice-${name}@example.test`,
          );
          await client.query(
            `insert into public.profiles (id, email, full_name)
             values ($1, $2, $3)`,
            [users[name], `notice-${name}@example.test`, `Notice ${name}`],
          );
        }
        const [societyId, otherSocietyId] = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Notice Society', $1), ('Other Notice Society', $2)
             returning id`,
            [users.admin, users.outsider],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           select society_id, module_key, true, '{}'::jsonb
           from unnest($1::uuid[]) as society_id
           cross join unnest(ARRAY['core', 'notice']) as module_key
           on conflict (society_id, module_key) do update set enabled = true`,
          [[societyId, otherSocietyId]],
        );
        const memberships = (
          await client.query<{ id: string; user_id: string }>(
            `insert into public.memberships (society_id, user_id, roles, status)
             values ($1, $2, ARRAY['admin']::text[], 'active'),
                    ($1, $3, ARRAY['committee', 'resident']::text[], 'active'),
                    ($1, $4, ARRAY['resident']::text[], 'active'),
                    ($1, $5, ARRAY['resident']::text[], 'active'),
                    ($1, $6, ARRAY['resident']::text[], 'active'),
                    ($1, $7, ARRAY['guard']::text[], 'active'),
                    ($8, $9, ARRAY['admin', 'resident']::text[], 'active')
             returning id, user_id`,
            [
              societyId,
              users.admin,
              users.committee,
              users.owner,
              users.tenant,
              users.family,
              users.guard,
              otherSocietyId,
              users.outsider,
            ],
          )
        ).rows;
        const membershipOf = (user: User) =>
          memberships.find(({ user_id }) => user_id === users[user])!.id;
        const [blockA, blockB] = (
          await client.query<{ id: string }>(
            `insert into public.blocks (society_id, name, created_by)
             values ($1, 'A', $2), ($1, 'B', $2) returning id`,
            [societyId, users.admin],
          )
        ).rows.map(({ id }) => id);
        const otherBlock = (
          await client.query<{ id: string }>(
            `insert into public.blocks (society_id, name, created_by)
             values ($1, 'X', $2) returning id`,
            [otherSocietyId, users.outsider],
          )
        ).rows[0]!.id;
        const [unitA, unitB] = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, block_id, number, created_by)
             values ($1, $2, '101', $4), ($1, $3, '201', $4) returning id`,
            [societyId, blockA, blockB, users.admin],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.unit_occupants
             (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
           values ($1, $2, $3, 'owner', true, 'active', $8),
                  ($1, $4, $5, 'tenant', true, 'active', $8),
                  ($1, $2, $6, 'family', false, 'active', $8),
                  ($1, $4, $7, 'owner', false, 'ended', $8)`,
          [
            societyId,
            unitA,
            membershipOf('owner'),
            unitB,
            membershipOf('tenant'),
            membershipOf('family'),
            membershipOf('committee'),
            users.admin,
          ],
        );
        return {
          users,
          societyId: societyId!,
          otherSocietyId: otherSocietyId!,
          blockA: blockA!,
          blockB: blockB!,
          otherBlock,
        };
      });

      const asUser = <T>(
        user: User,
        run: (
          query: (
            sql: string,
            params: unknown[],
          ) => Promise<{
            rows: Record<string, unknown>[];
            rowCount: number | null;
          }>,
        ) => Promise<T>,
      ) =>
        database.asRole(
          'authenticated',
          { sub: fixture.users[user] },
          (client) => run((sql, params) => client.query(sql, params)),
          { commit: true },
        );
      const createNotice = (
        user: User,
        input: {
          title: string;
          audience?: string;
          blocks?: string[];
          pinned?: boolean;
          expiresAt?: string | null;
          attachment?: Record<string, unknown> | null;
          clientRequestId?: string;
          societyId?: string;
        },
      ) =>
        asUser(
          user,
          async (query) =>
            (
              await query(
                `select public.notice_create(
                   $1, $2, 'Synthetic notice body', $3, $4::uuid[], $5, $6,
                   $7::jsonb, $8, 'notice-create'
                 ) as result`,
                [
                  input.societyId ?? fixture.societyId,
                  input.title,
                  input.audience ?? 'all',
                  input.blocks ?? [],
                  input.pinned ?? false,
                  input.expiresAt ?? null,
                  input.attachment ? JSON.stringify(input.attachment) : null,
                  input.clientRequestId ?? crypto.randomUUID(),
                ],
              )
            ).rows[0]!.result as NoticeJson,
        );
      const list = (user: User, view = 'current') =>
        asUser(
          user,
          async (query) =>
            (
              await query(`select public.notice_list($1, $2) as result`, [
                fixture.societyId,
                view,
              ])
            ).rows[0]!.result as NoticeJson[],
        );
      const get = (user: User, noticeId: string) =>
        asUser(
          user,
          async (query) =>
            (
              await query(`select public.notice_get($1, $2) as result`, [
                fixture.societyId,
                noticeId,
              ])
            ).rows[0]!.result as NoticeJson,
        );
      const notificationsFor = (noticeId: string) =>
        database.asSuperuser(
          async (client) =>
            (
              await client.query<{ user_id: string; read_at: string | null }>(
                `select user_id, read_at from public.notifications
               where entity_type = 'notice' and entity_id = $1
               order by user_id`,
                [noticeId],
              )
            ).rows,
        );
      const residentIds = (...names: User[]) =>
        names.map((name) => fixture.users[name]).sort();

      const clientRequestId = crypto.randomUUID();
      const everyone = await createNotice('admin', {
        title: 'Water shutdown',
        clientRequestId,
      });
      expect(everyone).toMatchObject({
        audience: 'all',
        status: 'published',
        can_manage: true,
        read_count: 0,
        author_name: 'Notice admin',
      });
      expect(everyone).not.toHaveProperty('client_request_id');
      const replay = await createNotice('admin', {
        title: 'Water shutdown',
        clientRequestId,
      });
      expect(replay.id).toBe(everyone.id);
      expect(
        (await notificationsFor(everyone.id)).map(({ user_id }) => user_id),
      ).toEqual(residentIds('committee', 'owner', 'tenant', 'family'));

      const blockNotice = await createNotice('committee', {
        title: 'Block B lift service',
        audience: 'blocks',
        blocks: [fixture.blockB],
      });
      expect(blockNotice.blocks).toEqual([{ id: fixture.blockB, name: 'B' }]);
      expect(
        (await notificationsFor(blockNotice.id)).map(({ user_id }) => user_id),
      ).toEqual(residentIds('tenant'));

      const ownersNotice = await createNotice('admin', {
        title: 'Owners AGM',
        audience: 'owners',
        pinned: true,
      });
      expect(
        (await notificationsFor(ownersNotice.id)).map(({ user_id }) => user_id),
      ).toEqual(residentIds('owner'));

      expect((await list('owner')).map(({ id }) => id)).toEqual([
        ownersNotice.id,
        everyone.id,
      ]);
      expect((await list('tenant')).map(({ id }) => id)).toEqual([
        blockNotice.id,
        everyone.id,
      ]);
      expect((await list('family')).map(({ id }) => id)).toEqual([everyone.id]);
      expect((await list('committee')).map(({ id }) => id)).toEqual([
        ownersNotice.id,
        blockNotice.id,
        everyone.id,
      ]);
      expect((await list('owner'))[0]).toMatchObject({
        read_count: null,
        can_manage: false,
      });

      for (const user of ['guard', 'outsider'] as const) {
        expect((await dbError(list(user))).code).toBe('42501');
      }
      expect((await dbError(list('owner', 'archive'))).code).toBe('42501');
      expect((await dbError(get('owner', blockNotice.id))).code).toBe('P0002');
      expect((await dbError(get('outsider', everyone.id))).code).toBe('P0002');
      const guardRows = await asUser('guard', (query) =>
        query(`select id from public.notices`, []),
      );
      expect(guardRows.rows).toHaveLength(0);
      const tenantRows = await asUser('tenant', (query) =>
        query(`select id from public.notices order by created_at`, []),
      );
      expect(tenantRows.rows.map(({ id }) => id)).toEqual([
        everyone.id,
        blockNotice.id,
      ]);
      const crossSociety = await dbError(
        createNotice('outsider', {
          title: 'Cross society blocks',
          audience: 'blocks',
          blocks: [fixture.blockA],
          societyId: fixture.otherSocietyId,
        }),
      );
      expect(crossSociety.code).toBe('22023');
      for (const user of ['owner', 'guard', 'outsider'] as const) {
        expect(
          (await dbError(createNotice(user, { title: 'Not allowed' }))).code,
        ).toBe('42501');
      }

      for (const invalid of [
        { title: ' ' },
        { title: 'No blocks', audience: 'blocks' },
        { title: 'Stray blocks', blocks: [fixture.blockA] },
        {
          title: 'Foreign block',
          audience: 'blocks',
          blocks: [fixture.otherBlock],
        },
        { title: 'Past expiry', expiresAt: '2000-01-01T00:00:00Z' },
        {
          title: 'Bad attachment',
          attachment: {
            path: `${fixture.otherSocietyId}/notices/${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`,
            content_type: 'application/pdf',
            size_bytes: '1000',
          },
        },
        {
          title: 'Wrong type',
          attachment: {
            path: `${fixture.societyId}/notices/${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`,
            content_type: 'image/png',
            size_bytes: '1000',
          },
        },
      ]) {
        expect((await dbError(createNotice('admin', invalid))).code).toBe(
          '22023',
        );
      }

      // Committee members manage only their own notices; admins manage all.
      const committeeWithdraw = await dbError(
        asUser('committee', (query) =>
          query(`select public.notice_withdraw($1, $2, 'notice-withdraw')`, [
            fixture.societyId,
            everyone.id,
          ]),
        ),
      );
      expect(committeeWithdraw.code).toBe('42501');
      expect((await get('committee', everyone.id)).can_manage).toBe(false);
      expect((await get('committee', blockNotice.id)).can_manage).toBe(true);

      const update = (
        user: User,
        notice: NoticeJson,
        expectedUpdatedAt = notice.updated_at,
      ) =>
        asUser(
          user,
          async (query) =>
            (
              await query(
                `select public.notice_update(
                   $1, $2, 'Block A and B lift service', 'Updated body',
                   'blocks', $3::uuid[], null, null, $4, 'notice-update'
                 ) as result`,
                [
                  fixture.societyId,
                  notice.id,
                  [fixture.blockA, fixture.blockB],
                  expectedUpdatedAt,
                ],
              )
            ).rows[0]!.result as NoticeJson,
        );
      const notificationCount = async () =>
        Number(
          (
            await database.asSuperuser((client) =>
              client.query<{ count: string }>(
                `select count(*) from public.notifications
                 where entity_type = 'notice'`,
              ),
            )
          ).rows[0]!.count,
        );
      const notificationsBeforeEdit = await notificationCount();
      const edited = await update('committee', blockNotice);
      expect(edited.edited_at).not.toBeNull();
      expect(edited.blocks.map(({ name }) => name)).toEqual(['A', 'B']);
      expect(await notificationCount()).toBe(notificationsBeforeEdit);
      expect((await list('owner')).map(({ id }) => id)).toContain(
        blockNotice.id,
      );
      expect((await dbError(update('committee', blockNotice))).code).toBe(
        '23505',
      );

      // Read receipts are aggregate-only and clear the matching in-app alert.
      const markRead = (user: User, noticeId: string) =>
        asUser(user, (query) =>
          query(`select public.notice_mark_read($1, $2)`, [
            fixture.societyId,
            noticeId,
          ]),
        );
      await markRead('owner', everyone.id);
      await markRead('owner', everyone.id);
      await markRead('tenant', everyone.id);
      // Managers outside the audience clear alerts without counting as readers.
      await markRead('admin', everyone.id);
      expect((await dbError(markRead('family', ownersNotice.id))).code).toBe(
        'P0002',
      );
      expect((await get('owner', everyone.id)).has_read).toBe(true);
      expect((await get('owner', everyone.id)).read_count).toBeNull();
      expect(await get('admin', everyone.id)).toMatchObject({
        read_count: 2,
        audience_count: 4,
      });
      expect(
        (await notificationsFor(everyone.id)).find(
          ({ user_id }) => user_id === fixture.users.owner,
        )?.read_at,
      ).not.toBeNull();
      const otherReads = await asUser('tenant', (query) =>
        query(`select user_id from public.notice_reads`, []),
      );
      expect(otherReads.rows).toEqual([{ user_id: fixture.users.tenant }]);

      const setPinned = (noticeId: string, pinned: boolean) =>
        asUser(
          'admin',
          async (query) =>
            (
              await query(
                `select public.notice_set_pinned($1, $2, $3, 'notice-pin') as result`,
                [fixture.societyId, noticeId, pinned],
              )
            ).rows[0]!.result as NoticeJson,
        );
      expect((await setPinned(everyone.id, true)).pinned).toBe(true);
      expect((await setPinned(everyone.id, true)).edited_at).toBeNull();
      expect((await list('family'))[0]!.pinned).toBe(true);

      // Expired notices leave the resident feed but stay in the manager archive.
      await database.asSuperuser((client) =>
        client.query(
          `update public.notices
           set created_at = now() - interval '2 days',
               expires_at = now() - interval '1 day'
           where id = $1`,
          [ownersNotice.id],
        ),
      );
      expect((await list('owner')).map(({ id }) => id)).not.toContain(
        ownersNotice.id,
      );
      expect((await dbError(get('owner', ownersNotice.id))).code).toBe('P0002');

      const withdrawn = await asUser(
        'admin',
        async (query) =>
          (
            await query(
              `select public.notice_withdraw($1, $2, 'notice-withdraw') as result`,
              [fixture.societyId, everyone.id],
            )
          ).rows[0]!.result as NoticeJson,
      );
      expect(withdrawn.status).toBe('withdrawn');
      expect((await list('family')).map(({ id }) => id)).toEqual([
        blockNotice.id,
      ]);
      const archive = await list('admin', 'archive');
      expect(archive.map(({ id }) => id).sort()).toEqual(
        [everyone.id, ownersNotice.id].sort(),
      );
      expect(archive.find(({ id }) => id === ownersNotice.id)?.is_expired).toBe(
        true,
      );
      expect(
        (await notificationsFor(everyone.id)).map(({ user_id }) => user_id),
      ).toEqual(residentIds('owner', 'tenant'));
      expect((await dbError(setPinned(everyone.id, false))).code).toBe('23505');
      expect((await dbError(update('admin', withdrawn))).code).toBe('23505');

      const audit = await database.asSuperuser((client) =>
        client.query<{ action: string }>(
          `select action from public.audit_logs
           where society_id = $1 and entity_type = 'notice' order by id`,
          [fixture.societyId],
        ),
      );
      expect(audit.rows.map(({ action }) => action)).toEqual([
        'notice.publish',
        'notice.publish',
        'notice.publish',
        'notice.update',
        'notice.pin',
        'notice.withdraw',
      ]);

      // Attachments: managers upload; residents read only files on notices they can see.
      const attachmentPath = (directory = crypto.randomUUID()) =>
        `${fixture.societyId}/notices/${directory}/${crypto.randomUUID()}.pdf`;
      const uploadAs = (user: User, path: string) =>
        asUser(user, (query) =>
          query(
            `insert into storage.objects (bucket_id, name)
             values ('notice-files', $1)`,
            [path],
          ),
        );
      const blockFile = attachmentPath();
      const unattachedFile = attachmentPath();
      await uploadAs('committee', blockFile);
      await uploadAs('admin', unattachedFile);
      expect((await dbError(uploadAs('owner', attachmentPath()))).code).toBe(
        '42501',
      );
      expect(
        (
          await dbError(
            uploadAs('admin', `${fixture.societyId}/notices/loose-file.pdf`),
          )
        ).code,
      ).toBe('42501');
      const withFile = await createNotice('committee', {
        title: 'Block A circular',
        audience: 'blocks',
        blocks: [fixture.blockA],
        attachment: {
          path: blockFile,
          content_type: 'application/pdf',
          size_bytes: '2048',
        },
      });
      expect(withFile.attachment_path).toBe(blockFile);
      const visibleFiles = (user: User) =>
        asUser(user, async (query) =>
          (
            await query(
              `select name from storage.objects
               where bucket_id = 'notice-files' order by name`,
              [],
            )
          ).rows.map(({ name }) => name),
        );
      expect(await visibleFiles('owner')).toEqual([blockFile]);
      expect(await visibleFiles('tenant')).toEqual([]);
      expect(await visibleFiles('guard')).toEqual([]);
      expect((await visibleFiles('admin')).sort()).toEqual(
        [blockFile, unattachedFile].sort(),
      );
      const duplicatePath = await dbError(
        createNotice('admin', {
          title: 'Same file again',
          attachment: {
            path: blockFile,
            content_type: 'application/pdf',
            size_bytes: '2048',
          },
        }),
      );
      expect(duplicatePath.code).toBe('23505');

      const deleteAs = (user: User, path: string) =>
        asUser(
          user,
          async (query) =>
            (
              await query(
                `delete from storage.objects
                 where bucket_id = 'notice-files' and name = $1`,
                [path],
              )
            ).rowCount,
        );
      expect(await deleteAs('owner', unattachedFile)).toBe(0);
      expect(await deleteAs('admin', blockFile)).toBe(0);
      expect(await deleteAs('committee', unattachedFile)).toBe(1);
      expect((await visibleFiles('admin')).sort()).toEqual([blockFile]);

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = false
           where society_id = $1 and module_key = 'notice'`,
          [fixture.societyId],
        ),
      );
      expect(
        (await dbError(createNotice('admin', { title: 'Off' }))).code,
      ).toBe('42501');
      expect((await dbError(list('admin'))).code).toBe('42501');
      expect(await visibleFiles('owner')).toEqual([]);
    } finally {
      await database.drop();
    }
  });
});
