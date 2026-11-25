// Verify P60 resident visibility, platform updates and counts-only usage.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

type Role = 'admin' | 'committee' | 'resident' | 'developer';

describe.skipIf(!hasDatabase)('database P60 more ways in', () => {
  it('enforces resident visibility, release-note privacy and developer usage access', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = {} as Record<Role, string>;
        for (const role of [
          'admin',
          'committee',
          'resident',
          'developer',
        ] as const) {
          users[role] = await newAuthUser(client, `p60-${role}@example.test`);
          await client.query(
            `insert into public.profiles (id, email, full_name)
             values ($1, $2, $3)`,
            [users[role], `p60-${role}@example.test`, `P60 ${role}`],
          );
        }
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P60 Society', $1) returning id`,
            [users.admin],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active'),
                  ($1, $3, ARRAY['committee']::text[], 'active'),
                  ($1, $4, ARRAY['resident']::text[], 'active')`,
          [societyId, users.admin, users.committee, users.resident],
        );
        await client.query(
          `insert into public.module_configs
             (society_id, module_key, enabled, residents_visible, settings)
           values
             ($1, 'core', true, true, '{}'::jsonb),
             ($1, 'visitor', true, true, '{}'::jsonb),
             ($1, 'notice', true, true, '{}'::jsonb)`,
          [societyId],
        );
        await client.query(
          `insert into public.developers (user_id) values ($1)`,
          [users.developer],
        );
        const sessionId = (
          await client.query<{ id: string }>(
            'insert into auth.sessions (user_id) values ($1) returning id',
            [users.developer],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into private.developer_mfa_sessions
             (session_id, user_id, session_expires_at, mfa_verified_at)
           values ($1, $2, now() + interval '1 hour', now())`,
          [sessionId, users.developer],
        );
        return { users, societyId, sessionId };
      });

      const asUser = (role: Role, sql: string, params: unknown[] = []) =>
        database.asRole(
          'authenticated',
          {
            sub: fixture.users[role],
            ...(role === 'developer'
              ? { aal: 'aal2', session_id: fixture.sessionId }
              : {}),
          },
          (client) => client.query(sql, params),
          { commit: true },
        );

      expect(
        (
          await asUser(
            'resident',
            `select private.module_enabled($1, 'visitor') as allowed`,
            [fixture.societyId],
          )
        ).rows[0]!.allowed,
      ).toBe(true);
      expect(
        (
          await dbError(
            asUser(
              'resident',
              `select * from public.visitor_list_entries(
                 $1, null, 'society'
               )`,
              [fixture.societyId],
            ),
          )
        ).code,
      ).toBe('42501');
      await expect(
        asUser(
          'admin',
          `select public.developer_resident_visibility_set(
             $1, 'visitor', false, 'p60-denied'
           )`,
          [fixture.societyId],
        ),
      ).rejects.toMatchObject({ code: '42501' });
      expect(
        (
          await dbError(
            asUser(
              'developer',
              `select public.developer_platform_update_save(
                 null, 'Unsafe link', 'Must stay local.', '/\\host.example',
                 true, null, 'p60-unsafe-link'
               )`,
            ),
          )
        ).code,
      ).toBe('22023');
      await asUser(
        'developer',
        `select public.developer_resident_visibility_set(
           $1, 'visitor', false, 'p60-hide'
         )`,
        [fixture.societyId],
      );
      expect(
        (
          await asUser(
            'resident',
            `select private.module_enabled($1, 'visitor') as allowed`,
            [fixture.societyId],
          )
        ).rows[0]!.allowed,
      ).toBe(false);
      expect(
        (
          await asUser(
            'admin',
            `select private.module_enabled($1, 'visitor') as allowed`,
            [fixture.societyId],
          )
        ).rows[0]!.allowed,
      ).toBe(true);

      const saved = await asUser(
        'developer',
        `select public.developer_platform_update_save(
           null, 'CSV imports available', 'Import a society file in one step.',
           '/admin/features', true, null, 'p60-update-create'
         ) as result`,
      );
      const updateId = (saved.rows[0]!.result as { id: string }).id;
      const withdrawVersion = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ updated_at: string }>(
              'select updated_at::text as updated_at from public.platform_updates where id = $1',
              [updateId],
            )
          ).rows[0]!.updated_at,
      );
      await asUser(
        'developer',
        `select public.developer_platform_update_withdraw(
           $1, $2::timestamptz, 'p60-withdraw'
         )`,
        [updateId, withdrawVersion],
      );
      const republishVersion = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ updated_at: string }>(
              'select updated_at::text as updated_at from public.platform_updates where id = $1',
              [updateId],
            )
          ).rows[0]!.updated_at,
      );
      await asUser(
        'developer',
        `select public.developer_platform_update_save(
           $1, 'CSV imports are ready', 'Import a society file in one step.',
           '/admin/features', true, $2::timestamptz, 'p60-republish'
         )`,
        [updateId, republishVersion],
      );
      const residentList = await dbError(
        asUser('resident', 'select public.platform_updates_get()'),
      );
      expect(residentList.code).toBe('42501');
      for (const role of ['admin', 'committee'] as const) {
        const rows = (
          await asUser(role, 'select public.platform_updates_get() as rows')
        ).rows[0]!.rows as Array<{ id: string; hasRead: boolean }>;
        expect(rows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: updateId, hasRead: false }),
          ]),
        );
      }
      await asUser('admin', 'select public.platform_update_mark_read($1)', [
        updateId,
      ]);
      const readRows = (
        await asUser('admin', 'select public.platform_updates_get() as rows')
      ).rows[0]!.rows as Array<{ id: string; hasRead: boolean }>;
      expect(readRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: updateId, hasRead: true }),
        ]),
      );

      expect(
        (
          await dbError(
            asUser('admin', 'select public.developer_usage_overview_get()'),
          )
        ).code,
      ).toBe('42501');
      const usage = (
        await asUser(
          'developer',
          'select public.developer_usage_overview_get() as rows',
        )
      ).rows[0]!.rows as Array<Record<string, unknown>>;
      expect(usage).toEqual([
        expect.objectContaining({
          societyId: fixture.societyId,
          societyName: 'P60 Society',
          peopleJoined: 3,
          visitors30d: 0,
          requests30d: 0,
          bills30d: 0,
          notices30d: 0,
          modulesOn: 2,
        }),
      ]);
      expect(Object.keys(usage[0]!)).not.toEqual(
        expect.arrayContaining(['names', 'phones', 'flats']),
      );
    } finally {
      await database.drop();
    }
  });
});
