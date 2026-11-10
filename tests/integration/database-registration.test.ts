// Verify registration isolation, join-code auditing, and approval decisions.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database society registration', () => {
  it('rotates and disables join codes without exposing a society directory', async () => {
    const database = await createTestDatabase({
      throughMigration: '20261110120000',
    });
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'join-admin@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'join-admin@example.test', 'Join Admin')`,
          [adminId],
        );
        const society = await client.query<{ id: string }>(
          `insert into public.societies (name, join_code, created_by)
           values ('Oak Grove', 'ABCDEFG2', $1) returning id`,
          [adminId],
        );
        const societyId = society.rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active')`,
          [societyId, adminId],
        );
        const block = await client.query<{ id: string }>(
          `insert into public.blocks (society_id, name, created_by)
           values ($1, 'East', $2) returning id`,
          [societyId, adminId],
        );
        const blockId = block.rows[0]?.id;
        if (!blockId) throw new Error('Block fixture was not created.');
        const unit = await client.query<{ id: string }>(
          `insert into public.units (society_id, block_id, number, created_by)
           values ($1, $2, '101', $3) returning id`,
          [societyId, blockId, adminId],
        );
        const unitId = unit.rows[0]?.id;
        if (!unitId) throw new Error('Unit fixture was not created.');
        return { adminId, societyId, unitId };
      });

      const rotatedCode = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ code: string }>(
            `select public.rotate_society_join_code($1, 'join-rotate') as code`,
            [fixture.societyId],
          );
          return result.rows[0]?.code;
        },
        { commit: true },
      );
      expect(rotatedCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      const displayedCode = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ code: string }>(
            'select public.get_society_join_code($1) as code',
            [fixture.societyId],
          );
          return result.rows[0]?.code;
        },
      );
      expect(displayedCode).toBe(rotatedCode);
      const directCodeRead = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query('select join_code from public.societies where id = $1', [
            fixture.societyId,
          ]),
        ),
      );
      expect(directCodeRead.code).toBe('42501');

      const lookup = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const valid = await client.query<{ result: unknown }>(
            'select public.lookup_registration_society($1) as result',
            [rotatedCode],
          );
          const invalid = await client.query<{ result: unknown }>(
            'select public.lookup_registration_society($1) as result',
            ['ZZZZZZZZ'],
          );
          return {
            valid: valid.rows[0]?.result,
            invalid: invalid.rows[0]?.result,
          };
        },
      );
      expect(lookup.valid).toEqual({
        societyName: 'Oak Grove',
        units: [{ id: fixture.unitId, number: '101', blockName: 'East' }],
      });
      expect(lookup.invalid).toBeNull();

      const anonymousLookup = await dbError(
        database.asRole('anon', null, (client) =>
          client.query('select public.lookup_registration_society($1)', [
            rotatedCode,
          ]),
        ),
      );
      expect(anonymousLookup).toMatchObject({ code: '42501' });

      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query('select public.disable_society_join_code($1, $2)', [
            fixture.societyId,
            'join-disable',
          ]),
        { commit: true },
      );
      const finalState = await database.asSuperuser(async (client) => {
        const society = await client.query<{ join_code: string | null }>(
          'select join_code from public.societies where id = $1',
          [fixture.societyId],
        );
        const audit = await client.query<{ action: string }>(
          `select action from public.audit_logs
           where society_id = $1
           order by id`,
          [fixture.societyId],
        );
        return { code: society.rows[0]?.join_code, actions: audit.rows };
      });
      expect(finalState.code).toBeNull();
      expect(finalState.actions).toEqual([
        { action: 'society.rotateJoinCode' },
        { action: 'society.disableJoinCode' },
      ]);
      const disabledLookup = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const result = await client.query<{ result: unknown }>(
            'select public.lookup_registration_society($1) as result',
            [rotatedCode],
          );
          return result.rows[0]?.result;
        },
      );
      expect(disabledLookup).toBeNull();
    } finally {
      await database.drop();
    }
  });

  it('activates approved applicants and denies rejected applicants immediately', async () => {
    const database = await createTestDatabase({
      throughMigration: '20261110120000',
    });
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(
          client,
          'registration-admin@example.test',
        );
        const approvedId = await newAuthUser(client, 'approved@example.test');
        const rejectedId = await newAuthUser(client, 'rejected@example.test');
        await client.query(
          `update auth.users set email_confirmed_at = now()
           where id = any($1::uuid[])`,
          [[adminId, approvedId, rejectedId]],
        );
        await client.query(
          `update public.profiles
           set full_name = case id
             when $1 then 'Registration Admin'
             when $2 then 'Approved Applicant'
             else 'Rejected Applicant'
           end
           where id = any($3::uuid[])`,
          [adminId, approvedId, [adminId, approvedId, rejectedId]],
        );
        const society = await client.query<{ id: string }>(
          `insert into public.societies (name, join_code, created_by)
           values ('Pine Court', 'ABCDEFG2', $1) returning id`,
          [adminId],
        );
        const societyId = society.rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active')`,
          [societyId, adminId],
        );
        const unit = await client.query<{ id: string }>(
          `insert into public.units (society_id, number, created_by)
           values ($1, '101', $2) returning id`,
          [societyId, adminId],
        );
        const unitId = unit.rows[0]?.id;
        if (!unitId) throw new Error('Unit fixture was not created.');
        return { adminId, approvedId, rejectedId, societyId, unitId };
      });

      const approvedMembership = await database.asRole(
        'authenticated',
        { sub: fixture.approvedId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.submit_society_registration(
               'ABCDEFG2', $1, 'Approved Applicant', 'owner', 'request-approved'
             ) as id`,
            [fixture.unitId],
          );
          return result.rows[0]?.id;
        },
        { commit: true },
      );
      const rejectedMembership = await database.asRole(
        'authenticated',
        { sub: fixture.rejectedId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.submit_society_registration(
               'ABCDEFG2', $1, 'Rejected Applicant', 'family', 'request-rejected'
             ) as id`,
            [fixture.unitId],
          );
          return result.rows[0]?.id;
        },
        { commit: true },
      );
      if (!approvedMembership || !rejectedMembership) {
        throw new Error('Registration requests were not created.');
      }

      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `select public.approve_society_registration($1, $2, 'approve-request')`,
            [fixture.societyId, approvedMembership],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `select public.reject_society_registration(
              $1, $2, 'Not listed on the ownership record', 'reject-request'
            )`,
            [fixture.societyId, rejectedMembership],
          ),
        { commit: true },
      );

      const records = await database.asSuperuser(async (client) => {
        const memberships = await client.query<{
          id: string;
          status: string;
          occupant_status: string;
        }>(
          `select membership.id, membership.status, occupant.status as occupant_status
           from public.memberships as membership
           join public.unit_occupants as occupant
             on occupant.membership_id = membership.id
           where membership.id = any($1::uuid[])
           order by membership.id`,
          [[approvedMembership, rejectedMembership]],
        );
        const notifications = await client.query<{
          entity_id: string;
          request_id: string | null;
          user_id: string;
        }>(
          `select entity_id, request_id, user_id from public.notifications
           where entity_id = any($1::uuid[])`,
          [[approvedMembership, rejectedMembership]],
        );
        const audit = await client.query<{ action: string }>(
          `select action from public.audit_logs
           where entity_id = any($1::text[])
           order by id`,
          [[approvedMembership, rejectedMembership]],
        );
        return {
          memberships: memberships.rows,
          notifications: notifications.rows,
          audit: audit.rows.map(({ action }) => action),
        };
      });
      expect(records.memberships).toEqual(
        expect.arrayContaining([
          {
            id: approvedMembership,
            status: 'active',
            occupant_status: 'active',
          },
          {
            id: rejectedMembership,
            status: 'deactivated',
            occupant_status: 'ended',
          },
        ]),
      );
      expect(records.notifications).toEqual(
        expect.arrayContaining([
          {
            entity_id: approvedMembership,
            request_id: 'request-approved',
            user_id: fixture.adminId,
          },
          {
            entity_id: rejectedMembership,
            request_id: 'request-rejected',
            user_id: fixture.adminId,
          },
          {
            entity_id: approvedMembership,
            request_id: 'approve-request',
            user_id: fixture.approvedId,
          },
          {
            entity_id: rejectedMembership,
            request_id: 'reject-request',
            user_id: fixture.rejectedId,
          },
          {
            entity_id: approvedMembership,
            request_id: 'approve-request',
            user_id: fixture.adminId,
          },
          {
            entity_id: rejectedMembership,
            request_id: 'reject-request',
            user_id: fixture.adminId,
          },
        ]),
      );
      expect(records.audit).toEqual([
        'registration.submit',
        'registration.submit',
        'members.approve',
        'members.reject',
      ]);

      await expect(
        database.asRole(
          'authenticated',
          { sub: fixture.rejectedId },
          async (client) => {
            const result = await client.query<{ is_member: boolean }>(
              'select private.is_member($1) as is_member',
              [fixture.societyId],
            );
            return result.rows[0]?.is_member;
          },
        ),
      ).resolves.toBe(false);
      await expect(
        database.asRole(
          'authenticated',
          { sub: fixture.approvedId },
          async (client) => {
            const result = await client.query<{ is_member: boolean }>(
              'select private.is_member($1) as is_member',
              [fixture.societyId],
            );
            return result.rows[0]?.is_member;
          },
        ),
      ).resolves.toBe(true);
    } finally {
      await database.drop();
    }
  });
});
