// Verify delivery pre-announcements stay unit-scoped, idempotent, audited and visible at the gate.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database delivery pre-announce', () => {
  it('lets unit occupants announce and cancel while guards list them', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const ids: Record<string, string> = {};
        for (const name of [
          'admin',
          'resident',
          'other',
          'guard',
          'outsider',
        ]) {
          ids[name] = await newAuthUser(client, `${name}@example.test`);
          await client.query(
            `insert into public.profiles (id, email, full_name)
             values ($1, $2, $3)`,
            [ids[name], `${name}@example.test`, name],
          );
        }
        const [societyId, otherSocietyId] = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Announce Society', $1), ('Other Society', $2)
             returning id`,
            [ids.admin, ids.outsider],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           select society_id, module_key, true, '{}'::jsonb
           from unnest($1::uuid[]) as society_id
           cross join unnest(ARRAY['core', 'delivery']) as module_key`,
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
              ids.admin,
              ids.resident,
              ids.other,
              ids.guard,
              otherSocietyId,
              ids.outsider,
            ],
          )
        ).rows;
        const [unitId, otherUnitId] = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, number, created_by)
             values ($1, '1A', $2), ($1, '1B', $2) returning id`,
            [societyId, ids.admin],
          )
        ).rows.map(({ id }) => id);
        const membershipOf = (userId: string) =>
          memberships.find((row) => row.user_id === userId)!.id;
        await client.query(
          `insert into public.unit_occupants (
             society_id, unit_id, membership_id, relationship, is_primary,
             is_approver, status, created_by
           )
           values ($1, $2, $3, 'tenant', false, false, 'active', $4),
                  ($1, $5, $6, 'owner', true, true, 'active', $4)`,
          [
            societyId,
            unitId,
            membershipOf(ids.resident!),
            ids.admin,
            otherUnitId,
            membershipOf(ids.other!),
          ],
        );
        return {
          ...(ids as Record<
            'admin' | 'resident' | 'other' | 'guard' | 'outsider',
            string
          >),
          societyId: societyId!,
          otherSocietyId: otherSocietyId!,
          unitId: unitId!,
        };
      });

      const asUser = <T>(
        sub: string,
        run: (
          query: (
            sql: string,
            params: unknown[],
          ) => Promise<{ rows: Record<string, unknown>[] }>,
        ) => Promise<T>,
      ) =>
        database.asRole(
          'authenticated',
          { sub },
          (client) => run((sql, params) => client.query(sql, params)),
          { commit: true },
        );
      const createSql = `select * from public.delivery_pre_announce_create(
        $1, $2, $3, now() + interval '1 hour', now() + interval '3 hours',
        $4, 'announce-trace')`;
      const clientRequestId = '6f1b8a5e-3a8c-4a59-9a43-2d0a3f3c1b11';

      const created = await asUser(fixture.resident, async (query) => {
        const args = [
          fixture.societyId,
          fixture.unitId,
          ' Amazon ',
          clientRequestId,
        ];
        const first = (await query(createSql, args)).rows[0]!;
        const retry = (await query(createSql, args)).rows[0]!;
        return { first, retry };
      });
      expect(created.first.platform).toBe('Amazon');
      expect(created.first.status).toBe('expected');
      expect(created.retry.id).toBe(created.first.id);

      const refusals: [string, unknown[]][] = [
        [
          fixture.other,
          [fixture.societyId, fixture.unitId, 'Zepto', crypto.randomUUID()],
        ],
        [
          fixture.guard,
          [fixture.societyId, fixture.unitId, 'Zepto', crypto.randomUUID()],
        ],
        [
          fixture.admin,
          [fixture.societyId, fixture.unitId, 'Zepto', crypto.randomUUID()],
        ],
        [
          fixture.outsider,
          [fixture.societyId, fixture.unitId, 'Zepto', crypto.randomUUID()],
        ],
        [
          fixture.outsider,
          [
            fixture.otherSocietyId,
            fixture.unitId,
            'Zepto',
            crypto.randomUUID(),
          ],
        ],
      ];
      for (const [user, args] of refusals) {
        const error = await dbError(
          asUser(user, (query) => query(createSql, args)),
        );
        expect(error.code).toBe('42501');
      }
      const invalid = await dbError(
        asUser(fixture.resident, (query) =>
          query(
            `select * from public.delivery_pre_announce_create(
               $1, $2, 'Swiggy', now() + interval '2 hours', now() + interval '1 hour',
               $3, 'announce-bad')`,
            [fixture.societyId, fixture.unitId, crypto.randomUUID()],
          ),
        ),
      );
      expect(invalid.code).toBe('22023');

      const guardList = await asUser(fixture.guard, (query) =>
        query(`select * from public.delivery_pre_announce_list($1)`, [
          fixture.societyId,
        ]),
      );
      expect(guardList.rows.map((row) => row.id)).toEqual([created.first.id]);
      const residentList = await asUser(fixture.resident, (query) =>
        query(`select * from public.delivery_pre_announce_list($1, $2)`, [
          fixture.societyId,
          fixture.unitId,
        ]),
      );
      expect(residentList.rows).toHaveLength(1);
      for (const args of [
        [fixture.societyId, null],
        [fixture.societyId, fixture.unitId],
      ]) {
        const error = await dbError(
          asUser(fixture.other, (query) =>
            query(
              `select * from public.delivery_pre_announce_list($1, $2)`,
              args,
            ),
          ),
        );
        expect(error.code).toBe('42501');
      }
      const outsiderVisible = await asUser(fixture.outsider, (query) =>
        query(`select id from public.delivery_pre_announcements`, []),
      );
      expect(outsiderVisible.rows).toHaveLength(0);
      const otherVisible = await asUser(fixture.other, (query) =>
        query(`select id from public.delivery_pre_announcements`, []),
      );
      expect(otherVisible.rows).toHaveLength(0);

      const otherCancel = await dbError(
        asUser(fixture.other, (query) =>
          query(
            `select * from public.delivery_pre_announce_cancel($1, $2, 'cancel-x')`,
            [fixture.societyId, created.first.id],
          ),
        ),
      );
      expect(otherCancel.code).toBe('P0002');
      const cancelled = await asUser(fixture.resident, async (query) => {
        const sql = `select * from public.delivery_pre_announce_cancel($1, $2, 'cancel-1')`;
        const args = [fixture.societyId, created.first.id];
        const first = (await query(sql, args)).rows[0]!;
        const retry = (await query(sql, args)).rows[0]!;
        const list = await query(
          `select * from public.delivery_pre_announce_list($1, $2)`,
          [fixture.societyId, fixture.unitId],
        );
        return { first, retry, listed: list.rows };
      });
      expect(cancelled.first.status).toBe('cancelled');
      expect(cancelled.retry.cancelled_at).toEqual(
        cancelled.first.cancelled_at,
      );
      expect(cancelled.listed).toHaveLength(0);

      const audit = await database.asSuperuser((client) =>
        client.query<{ action: string }>(
          `select action from public.audit_logs
           where society_id = $1 and entity_type = 'delivery_pre_announcement'
           order by id`,
          [fixture.societyId],
        ),
      );
      expect(audit.rows.map(({ action }) => action)).toEqual([
        'delivery.pre_announce.create',
        'delivery.pre_announce.cancel',
      ]);

      await database.asSuperuser((client) =>
        client.query(
          `insert into public.delivery_pre_announcements (
             society_id, unit_id, platform, expected_from, expected_to,
             client_request_id, created_by
           )
           select $1, $2, 'Shop ' || n, now(), now() + interval '2 hours',
             gen_random_uuid(), $3
           from generate_series(1, 20) as n`,
          [fixture.societyId, fixture.unitId, fixture.resident],
        ),
      );
      const capped = await dbError(
        asUser(fixture.resident, (query) =>
          query(createSql, [
            fixture.societyId,
            fixture.unitId,
            'Blinkit',
            crypto.randomUUID(),
          ]),
        ),
      );
      expect(capped.code).toBe('54000');

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = false
           where society_id = $1 and module_key = 'delivery'`,
          [fixture.societyId],
        ),
      );
      const disabled = await dbError(
        asUser(fixture.guard, (query) =>
          query(`select * from public.delivery_pre_announce_list($1)`, [
            fixture.societyId,
          ]),
        ),
      );
      expect(disabled.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
