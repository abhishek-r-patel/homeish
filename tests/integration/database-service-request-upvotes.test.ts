// Verify common-area request upvotes are one per resident, removable, counted, audited and society-isolated.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

type User = 'admin' | 'resident' | 'neighbour' | 'guard' | 'outsider';

describe.skipIf(!hasDatabase)('database service request upvotes', () => {
  it('counts one vote per resident and lets admins sort by votes', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = {} as Record<User, string>;
        for (const name of [
          'admin',
          'resident',
          'neighbour',
          'guard',
          'outsider',
        ] as const) {
          users[name] = await newAuthUser(
            client,
            `upvote-${name}@example.test`,
          );
          await client.query(
            `insert into public.profiles (id, email, full_name)
             values ($1, $2, $3)`,
            [users[name], `upvote-${name}@example.test`, name],
          );
        }
        const [societyId, otherSocietyId] = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Upvote Society', $1), ('Other Upvote Society', $2)
             returning id`,
            [users.admin, users.outsider],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           select society_id, module_key, true, '{}'::jsonb
           from unnest($1::uuid[]) as society_id
           cross join unnest(ARRAY['core', 'service_request']) as module_key`,
          [[societyId, otherSocietyId]],
        );
        const memberships = (
          await client.query<{ id: string; user_id: string }>(
            `insert into public.memberships (society_id, user_id, roles, status)
             values ($1, $2, ARRAY['admin']::text[], 'active'),
                    ($1, $3, ARRAY['resident']::text[], 'active'),
                    ($1, $4, ARRAY['resident']::text[], 'active'),
                    ($1, $5, ARRAY['guard']::text[], 'active'),
                    ($6, $7, ARRAY['resident']::text[], 'active')
             returning id, user_id`,
            [
              societyId,
              users.admin,
              users.resident,
              users.neighbour,
              users.guard,
              otherSocietyId,
              users.outsider,
            ],
          )
        ).rows;
        const unitId = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, number, created_by)
             values ($1, 'UV-1', $2) returning id`,
            [societyId, users.admin],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.unit_occupants
             (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
           values ($1, $2, $3, 'owner', true, 'active', $4)`,
          [
            societyId,
            unitId,
            memberships.find(({ user_id }) => user_id === users.resident)!.id,
            users.admin,
          ],
        );
        const categoryId = (
          await client.query<{ id: string }>(
            `select id from public.service_request_categories
             where society_id = $1 and name = 'Plumbing'`,
            [societyId],
          )
        ).rows[0]!.id;
        return {
          users,
          societyId: societyId!,
          otherSocietyId: otherSocietyId!,
          unitId,
          categoryId,
        };
      });

      const asUser = <T>(
        user: User,
        run: (
          query: (
            sql: string,
            params: unknown[],
          ) => Promise<{ rows: Record<string, unknown>[] }>,
        ) => Promise<T>,
      ) =>
        database.asRole(
          'authenticated',
          { sub: fixture.users[user] },
          (client) => run((sql, params) => client.query(sql, params)),
          { commit: true },
        );
      const createRequest = async (common: boolean) =>
        (
          await asUser('resident', (query) =>
            query(
              `select (public.request_create(
                 $1, $2, $3, $4, 'Synthetic lobby light', 'normal', '[]'::jsonb,
                 $5::uuid, 'upvote-create'
               )).id`,
              [
                fixture.societyId,
                fixture.categoryId,
                common ? 'common_area' : 'unit',
                common ? null : fixture.unitId,
                crypto.randomUUID(),
              ],
            ),
          )
        ).rows[0]!.id as string;
      const olderCommon = await createRequest(true);
      const newerCommon = await createRequest(true);
      const unitRequest = await createRequest(false);
      const setVote = (user: User, requestId: string, upvoted: boolean) =>
        asUser(
          user,
          async (query) =>
            (
              await query(
                `select public.request_upvote_set($1, $2, $3, 'upvote-trace') as result`,
                [fixture.societyId, requestId, upvoted],
              )
            ).rows[0]!.result as {
              upvote_count: number;
              has_upvoted: boolean;
            },
        );

      expect(await setVote('resident', olderCommon, true)).toMatchObject({
        upvote_count: 1,
        has_upvoted: true,
      });
      expect(await setVote('resident', olderCommon, true)).toMatchObject({
        upvote_count: 1,
        has_upvoted: true,
      });
      expect(await setVote('neighbour', olderCommon, true)).toMatchObject({
        upvote_count: 2,
        has_upvoted: true,
      });
      expect(await setVote('neighbour', olderCommon, false)).toMatchObject({
        upvote_count: 1,
        has_upvoted: false,
      });
      expect(await setVote('neighbour', olderCommon, false)).toMatchObject({
        upvote_count: 1,
        has_upvoted: false,
      });

      const unitVote = await dbError(setVote('resident', unitRequest, true));
      expect(unitVote.code).toBe('P0002');
      for (const user of ['admin', 'guard', 'outsider'] as const) {
        const error = await dbError(setVote(user, olderCommon, true));
        expect(error.code).toBe('42501');
      }
      const crossSociety = await dbError(
        asUser('outsider', (query) =>
          query(
            `select public.request_upvote_set($1, $2, true, 'upvote-cross')`,
            [fixture.otherSocietyId, olderCommon],
          ),
        ),
      );
      expect(crossSociety.code).toBe('P0002');
      const outsiderVotes = await asUser('outsider', (query) =>
        query(`select request_id from public.service_request_upvotes`, []),
      );
      expect(outsiderVotes.rows).toHaveLength(0);
      const neighbourVotes = await asUser('neighbour', (query) =>
        query(`select user_id from public.service_request_upvotes`, []),
      );
      expect(neighbourVotes.rows).toHaveLength(0);

      const listOrder = (user: User, sort?: string) =>
        asUser(user, async (query) => {
          const result = (
            await query(
              sort
                ? `select public.request_list($1, p_sort => $2) as result`
                : `select public.request_list($1) as result`,
              sort ? [fixture.societyId, sort] : [fixture.societyId],
            )
          ).rows[0]!.result as {
            id: string;
            upvote_count: number;
            has_upvoted: boolean;
          }[];
          return result.filter(({ id }) => id !== unitRequest);
        });
      const defaultOrder = await listOrder('admin');
      expect(defaultOrder.map(({ id }) => id)).toEqual([
        newerCommon,
        olderCommon,
      ]);
      const byVotes = await listOrder('admin', 'votes');
      expect(byVotes.map(({ id }) => id)).toEqual([olderCommon, newerCommon]);
      expect(byVotes[0]).toMatchObject({ upvote_count: 1, has_upvoted: false });
      const residentView = await listOrder('resident');
      expect(residentView.find(({ id }) => id === olderCommon)).toMatchObject({
        upvote_count: 1,
        has_upvoted: true,
      });
      const invalidSort = await dbError(listOrder('admin', 'popular'));
      expect(invalidSort.code).toBe('22023');

      const detail = await asUser(
        'resident',
        async (query) =>
          (
            await query(`select public.request_get($1, $2) as result`, [
              fixture.societyId,
              olderCommon,
            ])
          ).rows[0]!.result as { request: Record<string, unknown> },
      );
      expect(detail.request).toMatchObject({
        upvote_count: 1,
        has_upvoted: true,
      });
      expect(detail.request).not.toHaveProperty('request_id');

      await database.asSuperuser((client) =>
        client.query(
          `update public.service_requests set status = 'rejected',
             reject_reason = 'Synthetic duplicate'
           where society_id = $1 and id = $2`,
          [fixture.societyId, newerCommon],
        ),
      );
      const closedVote = await dbError(setVote('resident', newerCommon, true));
      expect(closedVote.code).toBe('23514');

      const audit = await database.asSuperuser((client) =>
        client.query<{ action: string }>(
          `select action from public.audit_logs
           where society_id = $1 and action like 'service_request.upvote%'
           order by id`,
          [fixture.societyId],
        ),
      );
      expect(audit.rows.map(({ action }) => action)).toEqual([
        'service_request.upvote',
        'service_request.upvote',
        'service_request.upvote_remove',
      ]);

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = false
           where society_id = $1 and module_key = 'service_request'`,
          [fixture.societyId],
        ),
      );
      const disabled = await dbError(setVote('resident', olderCommon, false));
      expect(disabled.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
