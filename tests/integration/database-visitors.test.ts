// Verify visitor lifecycle transactions and role- and unit-scoped access.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database visitors', () => {
  it('creates one request, accepts the first approver response, and checks in/out', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'admin@example.test');
        const guardId = await newAuthUser(client, 'guard@example.test');
        const residentId = await newAuthUser(client, 'resident@example.test');
        const otherResidentId = await newAuthUser(
          client,
          'other-resident@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'admin@example.test', 'Admin'),
                  ($2, 'guard@example.test', 'Guard'),
                  ($3, 'resident@example.test', 'Resident'),
                  ($4, 'other-resident@example.test', 'Other Resident')`,
          [adminId, guardId, residentId, otherResidentId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Visitor Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           values ($1, 'core', true, '{}'::jsonb),
                  ($1, 'visitor', true, '{"approval_timeout_minutes":3}'::jsonb)`,
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
             values ($1, '1A', $2), ($1, '1B', $2)
             returning id`,
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
        const residentMembership = memberships.rows.find(
          (row) => row.user_id === residentId,
        )?.id;
        const otherMembership = memberships.rows.find(
          (row) => row.user_id === otherResidentId,
        )?.id;
        if (
          !unitIds[0] ||
          !unitIds[1] ||
          !residentMembership ||
          !otherMembership
        ) {
          throw new Error('Visitor fixtures were not created.');
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
            residentMembership,
            adminId,
            unitIds[1],
            otherMembership,
          ],
        );
        const guardRosterId = (
          await client.query<{ id: string }>(
            `insert into public.guard_roster (society_id, name, created_by)
             values ($1, 'Gate Guard', $2) returning id`,
            [societyId, adminId],
          )
        ).rows[0]?.id;
        if (!guardRosterId) throw new Error('Guard fixture was not created.');
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
            `select * from public.visitor_create_entry(
              $1, $2, $3, $4, 'Test Visitor', null, 'guest', 1,
              null, null, $5, 'visitor-direct-call'
            )`,
            [
              fixture.guardId,
              fixture.societyId,
              fixture.unitId,
              fixture.guardRosterId,
              '5e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
            ],
          ),
        ),
      );
      expect(directCall.code).toBe('42501');

      const entryId = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const first = await client.query<{ id: string; status: string }>(
            `select id, status
             from public.visitor_create_entry(
               $1, $2, $3, $4, 'Test Visitor', '+919876543210', 'guest', 1,
               null, null, $5, 'visitor-create'
             )`,
            [
              fixture.guardId,
              fixture.societyId,
              fixture.unitId,
              fixture.guardRosterId,
              '5e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
            ],
          );
          const repeated = await client.query<{ id: string }>(
            `select id
             from public.visitor_create_entry(
               $1, $2, $3, $4, 'Test Visitor', '+919876543210', 'guest', 1,
               null, null, $5, 'visitor-retry'
             )`,
            [
              fixture.guardId,
              fixture.societyId,
              fixture.unitId,
              fixture.guardRosterId,
              '5e4d44d0-76a7-45e8-bfa8-83b8e3f8637a',
            ],
          );
          expect(first.rows[0]?.status).toBe('pending');
          expect(repeated.rows[0]?.id).toBe(first.rows[0]?.id);
          return first.rows[0]?.id;
        },
        { commit: true },
      );
      if (!entryId) throw new Error('Visitor entry was not created.');
      const notifications = await database.asSuperuser((client) =>
        client.query<{ count: string }>(
          `select count(*)::text as count from public.notifications
           where user_id = $1 and type = 'visitor_pending'`,
          [fixture.residentId],
        ),
      );
      expect(notifications.rows[0]?.count).toBe('1');

      const hidden = await database.asRole(
        'authenticated',
        { sub: fixture.otherResidentId },
        (client) =>
          client.query('select id from public.visitor_entries where id = $1', [
            entryId,
          ]),
      );
      expect(hidden.rows).toHaveLength(0);

      const hiddenPhone = await dbError(
        database.asRole('authenticated', { sub: fixture.guardId }, (client) =>
          client.query(
            'select visitor_phone from public.visitor_entries where id = $1',
            [entryId],
          ),
        ),
      );
      expect(hiddenPhone.code).toBe('42501');

      const directPreApprovalRead = await dbError(
        database.asRole('authenticated', { sub: fixture.guardId }, (client) =>
          client.query('select id from public.visitor_pre_approvals limit 1'),
        ),
      );
      expect(directPreApprovalRead.code).toBe('42501');

      await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query(
            `select (public.visitor_decide($1, true, 'visitor-approve')).id`,
            [entryId],
          ),
        { commit: true },
      );
      const lateDecision = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.residentId },
          (client) =>
            client.query(
              `select (public.visitor_decide($1, false, 'visitor-deny')).id`,
              [entryId],
            ),
        ),
      );
      expect(lateDecision.code).toBe('23505');

      await database.asRole(
        'service_role',
        null,
        async (client) => {
          await client.query(
            `select (public.visitor_check_in($1, $2, $3, 'visitor-check-in')).id`,
            [fixture.guardId, entryId, fixture.guardRosterId],
          );
          await client.query(
            `select (public.visitor_check_out($1, $2, $3, 'visitor-check-out')).id`,
            [fixture.guardId, entryId, fixture.guardRosterId],
          );
          const finalState = await client.query<{ status: string }>(
            'select status from public.visitor_entries where id = $1',
            [entryId],
          );
          expect(finalState.rows[0]?.status).toBe('checked_out');
        },
        { commit: true },
      );

      const forbiddenUnit = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.residentId },
          (client) =>
            client.query(
              `select * from public.visitor_pre_approval_create(
              $1, 'Other Unit Visitor', now(), now() + interval '1 hour',
              null, 'visitor-preapproval-forbidden'
            )`,
              [fixture.otherUnitId],
            ),
        ),
      );
      expect(forbiddenUnit.code).toBe('42501');

      const code = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        async (client) => {
          const result = await client.query<{ code: string }>(
            `select (public.visitor_pre_approval_create(
              $1, 'Pre-approved Guest', now(), now() + interval '1 hour',
              null, 'visitor-preapproval-create'
            )).code as code`,
            [fixture.unitId],
          );
          return result.rows[0]?.code;
        },
        { commit: true },
      );
      expect(code).toMatch(/^[0-9]{6}$/);

      const validatedCode = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ reason: string; visitor_name: string }>(
            `select reason, visitor_name
             from public.visitor_pre_approval_validate(
               $1, $2, $3, 'visitor-preapproval-validate'
             )`,
            [fixture.guardId, fixture.societyId, code],
          ),
      );
      expect(validatedCode.rows[0]).toMatchObject({
        reason: 'valid',
        visitor_name: 'Pre-approved Guest',
      });

      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `select public.visitor_update_settings(
              $1,
              '{"approval_timeout_minutes":5,"overstay_hours":10,
                "photo_required":true,"guard_override_allowed":true,
                "phone_required":true}'::jsonb,
              'visitor-settings-update'
            )`,
            [fixture.societyId],
          ),
        { commit: true },
      );
      const savedSettings = await database.asSuperuser((client) =>
        client.query<{ settings: Record<string, unknown> }>(
          `select settings from public.module_configs
           where society_id = $1 and module_key = 'visitor'`,
          [fixture.societyId],
        ),
      );
      expect(savedSettings.rows[0]?.settings).toMatchObject({
        approval_timeout_minutes: 5,
        overstay_hours: 10,
        photo_required: true,
        guard_override_allowed: true,
        phone_required: true,
      });

      const blacklistId = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.visitor_blacklist_add(
              $1, '+919876500000', 'Blocked Visitor', 'Test reason',
              'visitor-blacklist-add'
            ) as id`,
            [fixture.societyId],
          );
          return result.rows[0]?.id;
        },
        { commit: true },
      );
      expect(blacklistId).toBeTruthy();
      const adminBlacklist = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query<{ phone: string }>(
            'select phone from public.visitor_list_blacklist($1)',
            [fixture.societyId],
          ),
      );
      expect(adminBlacklist.rows[0]?.phone).toBe('+919876500000');
      const guardBlacklist = await database.asRole(
        'authenticated',
        { sub: fixture.guardId },
        (client) =>
          client.query<{ phone: string }>(
            'select phone from public.visitor_list_blacklist($1)',
            [fixture.societyId],
          ),
      );
      expect(guardBlacklist.rows[0]?.phone).toBe('••••0000');

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = false
           where society_id = $1 and module_key = 'visitor'`,
          [fixture.societyId],
        ),
      );
      const disabledRead = await dbError(
        database.asRole('authenticated', { sub: fixture.guardId }, (client) =>
          client.query(
            `select * from public.visitor_list_entries($1, null, 'all')`,
            [fixture.societyId],
          ),
        ),
      );
      expect(disabledRead.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
