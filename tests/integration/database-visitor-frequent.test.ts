// Verify frequent visitors stay unit-scoped, capped, audited and pre-approvable.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database frequent visitors', () => {
  it('saves, lists, caps, removes and pre-approves only for unit occupants', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'admin@example.test');
        const residentId = await newAuthUser(client, 'resident@example.test');
        const otherId = await newAuthUser(client, 'other@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'admin@example.test', 'Admin'),
                  ($2, 'resident@example.test', 'Resident'),
                  ($3, 'other@example.test', 'Other')`,
          [adminId, residentId, otherId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Frequent Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           values ($1, 'core', true, '{}'::jsonb),
                  ($1, 'visitor', true, '{}'::jsonb)`,
          [societyId],
        );
        const memberships = (
          await client.query<{ id: string; user_id: string }>(
            `insert into public.memberships (society_id, user_id, roles, status)
             values ($1, $2, ARRAY['admin']::text[], 'active'),
                    ($1, $3, ARRAY['resident']::text[], 'active'),
                    ($1, $4, ARRAY['resident']::text[], 'active')
             returning id, user_id`,
            [societyId, adminId, residentId, otherId],
          )
        ).rows;
        const [unitId, otherUnitId] = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, number, created_by)
             values ($1, '1A', $2), ($1, '1B', $2) returning id`,
            [societyId, adminId],
          )
        ).rows.map(({ id }) => id);
        const membershipOf = (userId: string) =>
          memberships.find((row) => row.user_id === userId)!.id;
        await client.query(
          `insert into public.unit_occupants (
             society_id, unit_id, membership_id, relationship, is_primary,
             is_approver, status, created_by
           )
           values ($1, $2, $3, 'owner', true, true, 'active', $4),
                  ($1, $5, $6, 'owner', true, true, 'active', $4)`,
          [
            societyId,
            unitId,
            membershipOf(residentId),
            adminId,
            otherUnitId,
            membershipOf(otherId),
          ],
        );
        const outsiderId = await newAuthUser(client, 'outsider@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'outsider@example.test', 'Outsider')`,
          [outsiderId],
        );
        const otherSocietyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Other Society', $1) returning id`,
            [outsiderId],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           values ($1, 'core', true, '{}'::jsonb),
                  ($1, 'visitor', true, '{}'::jsonb)`,
          [otherSocietyId],
        );
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['resident']::text[], 'active')`,
          [otherSocietyId, outsiderId],
        );
        return {
          adminId,
          residentId,
          otherId,
          outsiderId,
          otherSocietyId,
          societyId,
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

      const saved = await asUser(fixture.residentId, async (query) => {
        const first = await query(
          `select * from public.visitor_frequent_save($1, $2, ' Asha Maid ', 'mh 12 ab 1234', 'freq-save-1')`,
          [fixture.societyId, fixture.unitId],
        );
        const again = await query(
          `select * from public.visitor_frequent_save($1, $2, 'asha maid', null, 'freq-save-2')`,
          [fixture.societyId, fixture.unitId],
        );
        return { first: first.rows[0]!, again: again.rows[0]! };
      });
      expect(saved.first.visitor_name).toBe('Asha Maid');
      expect(saved.first.vehicle_no).toBe('MH12AB1234');
      expect(saved.again.id).toBe(saved.first.id);
      expect(saved.again.vehicle_no).toBeNull();

      const otherList = await dbError(
        asUser(fixture.otherId, (query) =>
          query(`select * from public.visitor_frequent_list($1, $2)`, [
            fixture.societyId,
            fixture.unitId,
          ]),
        ),
      );
      expect(otherList.code).toBe('42501');
      const otherVisible = await asUser(fixture.otherId, (query) =>
        query(`select id from public.visitor_frequent_visitors`, []),
      );
      expect(otherVisible.rows).toHaveLength(0);
      for (const sql of [
        `select public.visitor_frequent_remove($1, $2, 'freq-x')`,
        `select * from public.visitor_frequent_pre_approve($1, $2, now(), now() + interval '2 hours', 'freq-x')`,
      ]) {
        const error = await dbError(
          asUser(fixture.otherId, (query) =>
            query(sql, [fixture.societyId, saved.first.id]),
          ),
        );
        expect(error.code).toBe('P0002');
      }
      for (const societyId of [fixture.societyId, fixture.otherSocietyId]) {
        const crossSociety = await dbError(
          asUser(fixture.outsiderId, (query) =>
            query(
              `select * from public.visitor_frequent_save($1, $2, 'Intruder', null, 'freq-cross')`,
              [societyId, fixture.unitId],
            ),
          ),
        );
        expect(crossSociety.code).toBe('42501');
      }
      const outsiderVisible = await asUser(fixture.outsiderId, (query) =>
        query(`select id from public.visitor_frequent_visitors`, []),
      );
      expect(outsiderVisible.rows).toHaveLength(0);
      const adminSave = await dbError(
        asUser(fixture.adminId, (query) =>
          query(
            `select * from public.visitor_frequent_save($1, $2, 'Driver', null, 'freq-admin')`,
            [fixture.societyId, fixture.unitId],
          ),
        ),
      );
      expect(adminSave.code).toBe('42501');

      const approvals = await asUser(fixture.residentId, async (query) => {
        const args = [fixture.societyId, saved.first.id];
        const sql = `select * from public.visitor_frequent_pre_approve($1, $2, now(), now() + interval '2 hours', 'freq-approve-1')`;
        const first = (await query(sql, args)).rows[0]!;
        const retry = (await query(sql, args)).rows[0]!;
        const list = await query(
          `select * from public.visitor_frequent_list($1, $2)`,
          [fixture.societyId, fixture.unitId],
        );
        return { first, retry, listed: list.rows[0]! };
      });
      expect(approvals.first.visitor_name).toBe('asha maid');
      expect(approvals.first.unit_id).toBe(fixture.unitId);
      expect(approvals.first.status).toBe('active');
      expect(approvals.first.code).toMatch(/^[0-9]{6}$/);
      expect(approvals.retry.id).toBe(approvals.first.id);
      expect(approvals.listed.last_used_at).not.toBeNull();
      const invalidWindow = await dbError(
        asUser(fixture.residentId, (query) =>
          query(
            `select * from public.visitor_frequent_pre_approve($1, $2, now(), now() - interval '1 hour', 'freq-bad')`,
            [fixture.societyId, saved.first.id],
          ),
        ),
      );
      expect(invalidWindow.code).toBe('22023');

      await database.asSuperuser((client) =>
        client.query(
          `insert into public.visitor_frequent_visitors (society_id, unit_id, visitor_name, created_by)
           select $1, $2, 'Visitor ' || n, $3 from generate_series(1, 49) as n`,
          [fixture.societyId, fixture.unitId, fixture.residentId],
        ),
      );
      const capped = await dbError(
        asUser(fixture.residentId, (query) =>
          query(
            `select * from public.visitor_frequent_save($1, $2, 'One Too Many', null, 'freq-cap')`,
            [fixture.societyId, fixture.unitId],
          ),
        ),
      );
      expect(capped.code).toBe('54000');

      await asUser(fixture.residentId, (query) =>
        query(`select public.visitor_frequent_remove($1, $2, 'freq-remove')`, [
          fixture.societyId,
          saved.first.id,
        ]),
      );
      const audit = await database.asSuperuser((client) =>
        client.query<{ action: string }>(
          `select action from public.audit_logs
           where society_id = $1 and entity_type = 'visitor_frequent_visitor'
           order by id`,
          [fixture.societyId],
        ),
      );
      expect(audit.rows.map(({ action }) => action)).toEqual([
        'visitor.frequent.save',
        'visitor.frequent.save',
        'visitor.frequent.pre_approve',
        'visitor.frequent.remove',
      ]);

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = false
           where society_id = $1 and module_key = 'visitor'`,
          [fixture.societyId],
        ),
      );
      const disabled = await dbError(
        asUser(fixture.residentId, (query) =>
          query(`select * from public.visitor_frequent_list($1, $2)`, [
            fixture.societyId,
            fixture.unitId,
          ]),
        ),
      );
      expect(disabled.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
