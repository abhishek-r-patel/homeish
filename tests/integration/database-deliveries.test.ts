// Verify delivery decisions, idempotency, collection and society isolation.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database deliveries', () => {
  it('creates idempotently, records resident decisions, and marks collection', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(
          client,
          'delivery-admin@example.test',
        );
        const guardId = await newAuthUser(
          client,
          'delivery-guard@example.test',
        );
        const residentId = await newAuthUser(
          client,
          'delivery-resident@example.test',
        );
        const otherResidentId = await newAuthUser(
          client,
          'delivery-other-resident@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'delivery-admin@example.test', 'Admin'),
                  ($2, 'delivery-guard@example.test', 'Guard'),
                  ($3, 'delivery-resident@example.test', 'Resident'),
                  ($4, 'delivery-other-resident@example.test', 'Other Resident')`,
          [adminId, guardId, residentId, otherResidentId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Delivery Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]?.id;
        if (!societyId) throw new Error('Delivery society was not created.');
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           values ($1, 'core', true, '{}'::jsonb),
             ($1, 'delivery', true,
              '{"response_timeout_minutes":3,"uncollected_days":3,"leave_at_gate_enabled":true}'::jsonb)`,
          [societyId],
        );
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active'),
                  ($1, $3, ARRAY['guard']::text[], 'active'),
           ($1, $4, ARRAY['resident']::text[], 'active'),
           ($1, $5, ARRAY['resident']::text[], 'active')`,
          [societyId, adminId, guardId, residentId, otherResidentId],
        );
        const unitIds = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, number, created_by)
             values ($1, '1A', $2), ($1, '1B', $2) returning id`,
            [societyId, adminId],
          )
        ).rows.map(({ id }) => id);
        const memberships = await client.query<{
          id: string;
          user_id: string;
        }>(
          `select id, user_id from public.memberships
           where society_id = $1 and user_id = any($2::uuid[])`,
          [societyId, [residentId, otherResidentId]],
        );
        const residentMembershipId = memberships.rows.find(
          (membership) => membership.user_id === residentId,
        )?.id;
        const otherResidentMembershipId = memberships.rows.find(
          (membership) => membership.user_id === otherResidentId,
        )?.id;
        if (
          !unitIds[0] ||
          !unitIds[1] ||
          !residentMembershipId ||
          !otherResidentMembershipId
        ) {
          throw new Error('Delivery unit fixtures were not created.');
        }
        await client.query(
          `insert into public.unit_occupants (
             society_id, unit_id, membership_id, relationship, is_primary,
             is_approver, status, created_by
           )
           values ($1, $2, $3, 'owner', true, true, 'active', $4),
           ($1, $5, $6, 'owner', true, true, 'active', $4)`,
          [
            societyId,
            unitIds[0],
            residentMembershipId,
            adminId,
            unitIds[1],
            otherResidentMembershipId,
          ],
        );
        const guardRosterId = (
          await client.query<{ id: string }>(
            `insert into public.guard_roster (society_id, name, created_by)
             values ($1, 'Gate Guard', $2) returning id`,
            [societyId, adminId],
          )
        ).rows[0]?.id;
        if (!guardRosterId) throw new Error('Delivery guard was not created.');
        return {
          adminId,
          guardId,
          guardRosterId,
          otherResidentId,
          residentId,
          societyId,
          unitId: unitIds[0],
          otherUnitId: unitIds[1],
        };
      });

      const directCall = await dbError(
        database.asRole('authenticated', { sub: fixture.guardId }, (client) =>
          client.query(
            `select * from public.delivery_create_entry(
              $1, $2, $3, $4, 'Parcel Co', null, 'parcel', null, $5,
              'delivery-direct-call'
            )`,
            [
              fixture.guardId,
              fixture.societyId,
              fixture.unitId,
              fixture.guardRosterId,
              '9e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
            ],
          ),
        ),
      );
      expect(directCall.code).toBe('42501');

      const entryId = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const args = [
            fixture.guardId,
            fixture.societyId,
            fixture.unitId,
            fixture.guardRosterId,
            'Parcel Co',
            'Alex',
            'parcel',
            null,
            '9e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
          ];
          const first = await client.query<{ id: string; status: string }>(
            `select id, status
             from public.delivery_create_entry(
               $1, $2, $3, $4, $5, $6, $7, $8, $9, 'delivery-create'
             )`,
            args,
          );
          const repeated = await client.query<{ id: string }>(
            `select id
             from public.delivery_create_entry(
               $1, $2, $3, $4, $5, $6, $7, $8, $9, 'delivery-retry'
             )`,
            args,
          );
          expect(first.rows[0]?.status).toBe('pending_response');
          expect(repeated.rows[0]?.id).toBe(first.rows[0]?.id);
          return first.rows[0]?.id;
        },
        { commit: true },
      );
      if (!entryId) throw new Error('Delivery entry was not created.');
      const requestNotifications = await database.asSuperuser((client) =>
        client.query<{ count: string }>(
          `select count(*)::text as count from public.notifications
           where user_id = $1 and entity_id = $2
             and type = 'delivery_pending'`,
          [fixture.residentId, entryId],
        ),
      );
      expect(requestNotifications.rows[0]?.count).toBe('1');

      const hiddenFromOtherUnit = await database.asRole(
        'authenticated',
        { sub: fixture.otherResidentId },
        (client) =>
          client.query(`select id from public.delivery_entries where id = $1`, [
            entryId,
          ]),
      );
      expect(hiddenFromOtherUnit.rows).toHaveLength(0);
      const otherUnitDecision = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.otherResidentId },
          (client) =>
            client.query(
              `select (public.delivery_respond(
                $1, 'allowed', 'delivery-other-unit-response'
              )).id`,
              [entryId],
            ),
        ),
      );
      expect(otherUnitDecision.code).toBe('42501');

      await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query(
            `select (public.delivery_respond($1, 'left_at_gate', 'delivery-response')).id`,
            [entryId],
          ),
        { commit: true },
      );
      const responseNotifications = await database.asSuperuser((client) =>
        client.query<{ count: string }>(
          `select count(*)::text as count from public.notifications
           where user_id = $1 and entity_id = $2
             and type = 'delivery_decided'`,
          [fixture.guardId, entryId],
        ),
      );
      expect(responseNotifications.rows[0]?.count).toBe('1');
      const repeatedDecision = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.residentId },
          (client) =>
            client.query(
              `select (public.delivery_respond(
                $1, 'allowed', 'delivery-response-repeat'
              )).id`,
              [entryId],
            ),
        ),
      );
      expect(repeatedDecision.code).toBe('23505');
      await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query(
            `select (public.delivery_mark_collected_resident(
              $1, 'delivery-collection'
            )).id`,
            [entryId],
          ),
        { commit: true },
      );
      const collected = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ status: string; collected_by: string }>(
            `select status, collected_by
             from public.delivery_entries where id = $1`,
            [entryId],
          ),
      );
      expect(collected.rows[0]).toEqual({
        status: 'collected',
        collected_by: fixture.residentId,
      });

      await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query(
            `select (public.delivery_preference_set(
              $1, 'always_leave_at_gate', 'delivery-preference'
            )).rule`,
            [fixture.unitId],
          ),
        { commit: true },
      );
      const preferenceEntry = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const result = await client.query<{
            status: string;
            decision_source: string;
          }>(
            `select status, decision_source
             from public.delivery_create_entry(
               $1, $2, $3, $4, 'Grocery Co', null, 'grocery', null, $5,
               'delivery-preference-create'
             )`,
            [
              fixture.guardId,
              fixture.societyId,
              fixture.unitId,
              fixture.guardRosterId,
              '8e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
            ],
          );
          return result.rows[0];
        },
        { commit: true },
      );
      expect(preferenceEntry).toEqual({
        status: 'left_at_gate',
        decision_source: 'preference',
      });
      await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query(
            `select (public.delivery_preference_set(
              $1, 'always_allow', 'delivery-preference-allow'
            )).rule`,
            [fixture.unitId],
          ),
        { commit: true },
      );
      const autoAllowed = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const result = await client.query<{
            status: string;
            decision_source: string;
          }>(
            `select status, decision_source
             from public.delivery_create_entry(
               $1, $2, $3, $4, 'Food Co', null, 'food', null, $5,
               'delivery-preference-allow-create'
             )`,
            [
              fixture.guardId,
              fixture.societyId,
              fixture.unitId,
              fixture.guardRosterId,
              '6e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
            ],
          );
          return result.rows[0];
        },
        { commit: true },
      );
      expect(autoAllowed).toEqual({
        status: 'allowed',
        decision_source: 'preference',
      });
      await database.asSuperuser(async (client) => {
        await client.query(
          `update public.delivery_entries
           set received_at = now() - interval '2 days'
           where society_id = $1 and status = 'left_at_gate'`,
          [fixture.societyId],
        );
        await client.query(
          `update public.module_configs
           set settings = settings || '{"uncollected_days":1}'::jsonb
           where society_id = $1 and module_key = 'delivery'`,
          [fixture.societyId],
        );
      });
      const overdue = await database.asRole(
        'authenticated',
        { sub: fixture.guardId },
        (client) =>
          client.query<{ is_uncollected_overdue: boolean }>(
            `select is_uncollected_overdue
             from public.delivery_list_entries($1, null, 'uncollected')`,
            [fixture.societyId],
          ),
      );
      expect(overdue.rows[0]?.is_uncollected_overdue).toBe(true);
    } finally {
      await database.drop();
    }
  });

  it('allows a guard override only after the resident response window closes', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(
          client,
          'override-admin@example.test',
        );
        const guardId = await newAuthUser(
          client,
          'override-guard@example.test',
        );
        const residentId = await newAuthUser(
          client,
          'override-resident@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'override-admin@example.test', 'Admin'),
                  ($2, 'override-guard@example.test', 'Guard'),
                  ($3, 'override-resident@example.test', 'Resident')`,
          [adminId, guardId, residentId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Override Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]?.id;
        if (!societyId) throw new Error('Override society was not created.');
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           values ($1, 'core', true, '{}'::jsonb),
             ($1, 'delivery', true,
              '{"response_timeout_minutes":3,"uncollected_days":3,"leave_at_gate_enabled":true}'::jsonb)`,
          [societyId],
        );
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active'),
                  ($1, $3, ARRAY['guard']::text[], 'active'),
                  ($1, $4, ARRAY['resident']::text[], 'active')`,
          [societyId, adminId, guardId, residentId],
        );
        const unitId = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, number, created_by)
             values ($1, '2A', $2) returning id`,
            [societyId, adminId],
          )
        ).rows[0]?.id;
        const residentMembershipId = (
          await client.query<{ id: string }>(
            `select id from public.memberships
             where society_id = $1 and user_id = $2`,
            [societyId, residentId],
          )
        ).rows[0]?.id;
        if (!unitId || !residentMembershipId) {
          throw new Error('Override unit fixtures were not created.');
        }
        await client.query(
          `insert into public.unit_occupants (
             society_id, unit_id, membership_id, relationship, is_primary,
             is_approver, status, created_by
           )
           values ($1, $2, $3, 'owner', true, true, 'active', $4)`,
          [societyId, unitId, residentMembershipId, adminId],
        );
        const guardRosterId = (
          await client.query<{ id: string }>(
            `insert into public.guard_roster (society_id, name, created_by)
             values ($1, 'Gate Guard', $2) returning id`,
            [societyId, adminId],
          )
        ).rows[0]?.id;
        if (!guardRosterId) throw new Error('Override guard was not created.');
        return { adminId, guardId, guardRosterId, societyId, unitId };
      });
      const entryId = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select id from public.delivery_create_entry(
              $1, $2, $3, $4, 'Parcel Co', null, 'parcel', null, $5,
              'delivery-override-create'
            )`,
            [
              fixture.guardId,
              fixture.societyId,
              fixture.unitId,
              fixture.guardRosterId,
              '7e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
            ],
          );
          return result.rows[0]?.id;
        },
        { commit: true },
      );
      if (!entryId) throw new Error('Override delivery was not created.');
      await database.asSuperuser((client) =>
        client.query(
          `update public.delivery_entries
           set respond_by = now() - interval '1 minute'
           where id = $1`,
          [entryId],
        ),
      );
      const status = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const result = await client.query<{ status: string }>(
            `select status from public.delivery_override(
              $1, $2, $3, 'denied', 'Resident did not respond',
              'delivery-override'
            )`,
            [fixture.guardId, entryId, fixture.guardRosterId],
          );
          return result.rows[0]?.status;
        },
        { commit: true },
      );
      expect(status).toBe('denied');
      const closeableEntry = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select id from public.delivery_create_entry(
              $1, $2, $3, $4, 'Courier Co', null, 'parcel', null, $5,
              'delivery-close-create'
            )`,
            [
              fixture.guardId,
              fixture.societyId,
              fixture.unitId,
              fixture.guardRosterId,
              '3e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
            ],
          );
          return result.rows[0]?.id;
        },
        { commit: true },
      );
      if (!closeableEntry)
        throw new Error('Closeable delivery was not created.');
      await database.asSuperuser((client) =>
        client.query(
          `update public.delivery_entries
           set respond_by = now() - interval '1 minute'
           where id = $1`,
          [closeableEntry],
        ),
      );
      const closed = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const result = await client.query<{
            status: string;
            decision_source: string;
          }>(
            `select status, decision_source
             from public.delivery_override(
               $1, $2, $3, 'closed', 'No response; closing request',
               'delivery-close'
             )`,
            [fixture.guardId, closeableEntry, fixture.guardRosterId],
          );
          return result.rows[0];
        },
        { commit: true },
      );
      expect(closed).toEqual({
        status: 'closed',
        decision_source: 'guard_override',
      });
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = false
           where society_id = $1 and module_key = 'delivery'`,
          [fixture.societyId],
        ),
      );
      const disabledModule = await dbError(
        database.asRole('authenticated', { sub: fixture.guardId }, (client) =>
          client.query(
            `select * from public.delivery_list_entries($1, null, 'all')`,
            [fixture.societyId],
          ),
        ),
      );
      expect(disabledModule.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
