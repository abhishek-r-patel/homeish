// Verify guard PIN secrecy, identification lockout, and unit contact scope.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database guards', () => {
  it('stores only hashed PINs, limits failures, and denies API reads of the hash', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'admin@example.test');
        const guardId = await newAuthUser(client, 'guard@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'admin@example.test', 'Admin'),
                  ($2, 'guard@example.test', 'Guard')`,
          [adminId, guardId],
        );
        const society = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Guard Society', $1) returning id`,
          [adminId],
        );
        const societyId = society.rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled)
           values ($1, 'core', true)
           on conflict (society_id, module_key) do nothing`,
          [societyId],
        );
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active'),
                  ($1, $3, ARRAY['guard']::text[], 'active')`,
          [societyId, adminId, guardId],
        );
        const membership = await client.query<{ id: string }>(
          `select id from public.memberships
           where society_id = $1 and user_id = $2`,
          [societyId, guardId],
        );
        const membershipId = membership.rows[0]?.id;
        if (!membershipId) throw new Error('Guard membership was not created.');
        return { adminId, guardId, societyId, membershipId };
      });

      const rosterId = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.admin_add_guard($1, 'Night Guard', $2, 'guard-add') as id`,
            [fixture.societyId, fixture.membershipId],
          );
          const id = result.rows[0]?.id;
          if (!id) throw new Error('Guard roster entry was not created.');
          await client.query(
            `select public.admin_set_guard_pin($1, $2, '1234', 'guard-pin')`,
            [fixture.societyId, id],
          );
          await client.query(
            `select public.admin_update_gate_settings($1, 'shared', 'pin', 'gate-settings')`,
            [fixture.societyId],
          );
          return id;
        },
        { commit: true },
      );

      const stored = await database.asSuperuser((client) =>
        client.query<{ pin_hash: string }>(
          'select pin_hash from public.guard_roster where id = $1',
          [rosterId],
        ),
      );
      expect(stored.rows[0]?.pin_hash).toMatch(/^\$2/);
      expect(stored.rows[0]?.pin_hash).not.toBe('1234');

      for (const role of ['anon', 'authenticated', 'service_role'] as const) {
        const denied = await dbError(
          database.asRole(
            role,
            role === 'authenticated' ? { sub: fixture.guardId } : null,
            (client) =>
              client.query(
                'select pin_hash from public.guard_roster where id = $1',
                [rosterId],
              ),
          ),
        );
        expect(denied.code).toBe('42501');
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await database.asRole(
          'authenticated',
          { sub: fixture.guardId },
          (client) =>
            client.query<{
              guard_id: string | null;
              locked: boolean;
              retry_after_seconds: number;
            }>('select * from public.guard_identify($1, $2, $3)', [
              fixture.societyId,
              rosterId,
              '9999',
            ]),
          { commit: true },
        );
        expect(result.rows[0]?.guard_id).toBeNull();
        expect(result.rows[0]?.locked).toBe(attempt === 4);
        if (attempt === 4) {
          expect(result.rows[0]?.retry_after_seconds).toBeGreaterThan(880);
          expect(result.rows[0]?.retry_after_seconds).toBeLessThanOrEqual(900);
        }
      }

      const locked = await database.asRole(
        'authenticated',
        { sub: fixture.guardId },
        (client) =>
          client.query<{
            guard_id: string | null;
            locked: boolean;
            retry_after_seconds: number;
          }>('select * from public.guard_identify($1, $2, $3)', [
            fixture.societyId,
            rosterId,
            '1234',
          ]),
      );
      expect(locked.rows[0]).toMatchObject({ guard_id: null, locked: true });
      expect(locked.rows[0]?.retry_after_seconds).toBeGreaterThan(880);
      expect(locked.rows[0]?.retry_after_seconds).toBeLessThanOrEqual(900);

      const audit = await database.asSuperuser((client) =>
        client.query<{ before: unknown; after: unknown }>(
          `select "before", "after" from public.audit_logs
           where entity_id = $1 and action = 'guards.set_pin'`,
          [rosterId],
        ),
      );
      expect(JSON.stringify(audit.rows)).not.toContain('1234');
      expect(JSON.stringify(audit.rows)).not.toContain('$2');

      await database.asSuperuser((client) =>
        client.query(
          `update public.rate_limits
           set window_start = now() - interval '16 minutes'
           where key like 'guard-pin:%'`,
        ),
      );
      const unlocked = await database.asRole(
        'authenticated',
        { sub: fixture.guardId },
        (client) =>
          client.query<{ guard_id: string | null; locked: boolean }>(
            'select * from public.guard_identify($1, $2, $3)',
            [fixture.societyId, rosterId, '1234'],
          ),
      );
      expect(unlocked.rows[0]).toMatchObject({
        guard_id: rosterId,
        locked: false,
      });
    } finally {
      await database.drop();
    }
  });

  it('resolves individual guards and returns only active unit approvers', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'manager@example.test');
        const guardUserId = await newAuthUser(client, 'gate@example.test');
        const residentId = await newAuthUser(client, 'resident@example.test');
        const familyId = await newAuthUser(client, 'family@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name, phone)
           values ($1, 'manager@example.test', 'Manager', '+919876543210'),
                  ($2, 'gate@example.test', 'Gate', '+919876543211'),
                  ($3, 'resident@example.test', 'Resident', '+919876543212'),
                  ($4, 'family@example.test', 'Family', '+919876543213')`,
          [adminId, guardUserId, residentId, familyId],
        );
        const society = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Contact Society', $1) returning id`,
          [adminId],
        );
        const societyId = society.rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled)
           values ($1, 'core', true)
           on conflict (society_id, module_key) do nothing`,
          [societyId],
        );
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin']::text[], 'active'),
             ($1, $3, ARRAY['guard']::text[], 'active'),
             ($1, $4, ARRAY['resident']::text[], 'active'),
             ($1, $5, ARRAY['resident']::text[], 'active')`,
          [societyId, adminId, guardUserId, residentId, familyId],
        );
        const memberships = await client.query<{
          id: string;
          user_id: string;
        }>(`select id, user_id from public.memberships where society_id = $1`, [
          societyId,
        ]);
        const membershipIds = new Map(
          memberships.rows.map((row) => [row.user_id, row.id]),
        );
        const unit = await client.query<{ id: string }>(
          `insert into public.units (society_id, number, created_by)
           values ($1, '101', $2) returning id`,
          [societyId, adminId],
        );
        const unitId = unit.rows[0]?.id;
        const guardMembership = membershipIds.get(guardUserId);
        const residentMembership = membershipIds.get(residentId);
        const familyMembership = membershipIds.get(familyId);
        if (
          !unitId ||
          !guardMembership ||
          !residentMembership ||
          !familyMembership
        ) {
          throw new Error('Guard contact fixtures were not created.');
        }
        await client.query(
          `insert into public.unit_occupants (
             society_id, unit_id, membership_id, relationship,
             is_primary, is_approver, status, created_by
           )
           values
             ($1, $2, $3, 'owner', true, true, 'active', $4),
             ($1, $2, $5, 'family', false, false, 'active', $4)`,
          [societyId, unitId, residentMembership, adminId, familyMembership],
        );
        return { adminId, guardUserId, societyId, guardMembership, unitId };
      });

      const rosterId = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.admin_add_guard($1, 'Gate Guard', $2, 'individual-add') as id`,
            [fixture.societyId, fixture.guardMembership],
          );
          return result.rows[0]?.id;
        },
        { commit: true },
      );
      if (!rosterId) throw new Error('Individual guard was not created.');

      const identified = await database.asRole(
        'authenticated',
        { sub: fixture.guardUserId },
        (client) =>
          client.query<{ guard_id: string; guard_name: string }>(
            'select * from public.guard_identify($1, null, null)',
            [fixture.societyId],
          ),
      );
      expect(identified.rows).toEqual([
        {
          guard_id: rosterId,
          guard_name: 'Gate Guard',
          locked: false,
          retry_after_seconds: 0,
        },
      ]);

      const contacts = await database.asRole(
        'authenticated',
        { sub: fixture.guardUserId },
        (client) =>
          client.query<{ full_name: string; phone: string }>(
            'select * from public.guard_unit_contacts($1)',
            [fixture.unitId],
          ),
      );
      expect(contacts.rows).toEqual([
        { full_name: 'Resident', phone: '+919876543212' },
      ]);
    } finally {
      await database.drop();
    }
  });
});
