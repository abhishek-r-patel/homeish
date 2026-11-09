// Verify membership access, role helpers and current society/module state.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database memberships', () => {
  it('uses active memberships, roles, module configuration and society status', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const userId = await newAuthUser(client);
        await client.query(
          'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
          [userId, `${userId}@example.test`, 'Test Admin'],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Membership Society', $1) returning id`,
            [userId],
          )
        ).rows[0]?.id;
        if (!societyId) {
          throw new Error('Could not create the fixture society.');
        }
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin', 'resident'], 'active')`,
          [societyId, userId],
        );
        return { societyId, userId };
      });

      const helpers = await database.asRole(
        'authenticated',
        { sub: fixture.userId },
        (client) =>
          client.query<{
            member: boolean;
            admin: boolean;
            guard: boolean;
            core: boolean;
            visitor: boolean;
            writable: boolean;
          }>(
            `select
               private.is_member($1) as member,
               private.has_role($1, ARRAY['admin']::text[]) as admin,
               private.has_role($1, ARRAY['guard']::text[]) as guard,
               private.module_enabled($1, 'core') as core,
               private.module_enabled($1, 'visitor') as visitor,
               private.society_writable($1) as writable`,
            [fixture.societyId],
          ),
      );
      expect(helpers.rows[0]).toEqual({
        member: true,
        admin: true,
        guard: false,
        core: true,
        visitor: false,
        writable: true,
      });

      await database.asSuperuser((client) =>
        client.query(
          `insert into public.module_configs (society_id, module_key, enabled)
           values ($1, 'visitor', true)`,
          [fixture.societyId],
        ),
      );
      await database.asSuperuser((client) =>
        client.query(
          `update public.societies set status = 'suspended' where id = $1`,
          [fixture.societyId],
        ),
      );

      const changedState = await database.asRole(
        'authenticated',
        { sub: fixture.userId },
        (client) =>
          client.query<{ visitor: boolean; writable: boolean }>(
            `select
               private.module_enabled($1, 'visitor') as visitor,
               private.society_writable($1) as writable`,
            [fixture.societyId],
          ),
      );
      expect(changedState.rows[0]).toEqual({
        visitor: true,
        writable: false,
      });
    } finally {
      await database.drop();
    }
  });

  it('limits membership reads to self or society managers', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client);
        const residentId = await newAuthUser(client);
        const otherId = await newAuthUser(client);
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, $2, 'Admin'), ($3, $4, 'Resident'), ($5, $6, 'Other')`,
          [
            adminId,
            `${adminId}@example.test`,
            residentId,
            `${residentId}@example.test`,
            otherId,
            `${otherId}@example.test`,
          ],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('First Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]?.id;
        const otherSocietyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Other Society', $1) returning id`,
            [otherId],
          )
        ).rows[0]?.id;
        if (!societyId || !otherSocietyId) {
          throw new Error('Could not create the fixture societies.');
        }
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin'], 'active'),
             ($1, $3, ARRAY['resident'], 'active'),
             ($4, $5, ARRAY['admin'], 'active')`,
          [societyId, adminId, residentId, otherSocietyId, otherId],
        );
        return { adminId, residentId, otherId, societyId };
      });

      const adminRows = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query<{ user_id: string }>(
            'select user_id from public.memberships order by user_id',
          ),
      );
      expect(adminRows.rows.map((row) => row.user_id)).toEqual(
        [fixture.adminId, fixture.residentId].sort(),
      );

      const residentRows = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ user_id: string }>(
            'select user_id from public.memberships',
          ),
      );
      expect(residentRows.rows).toEqual([{ user_id: fixture.residentId }]);

      const anonymousRead = await dbError(
        database.asRole('anon', null, (client) =>
          client.query('select user_id from public.memberships'),
        ),
      );
      expect(anonymousRead.code).toBe('42501');

      const writeAttempt = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query(
            `update public.memberships set status = 'deactivated'
             where user_id = $1`,
            [fixture.residentId],
          ),
        ),
      );
      expect(writeAttempt.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('rejects invalid roles, status, missing identity and duplicate invitations', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const userId = await newAuthUser(client);
        await client.query(
          'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
          [userId, `${userId}@example.test`, 'Test Admin'],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Constraint Society', $1) returning id`,
            [userId],
          )
        ).rows[0]?.id;
        if (!societyId) {
          throw new Error('Could not create the fixture society.');
        }
        return { societyId };
      });

      for (const [roles, status] of [
        ['{}', 'active'],
        ['{owner}', 'active'],
        ['{resident}', 'pending'],
      ]) {
        const error = await dbError(
          database.asSuperuser((client) =>
            client.query(
              `insert into public.memberships (society_id, invited_email, roles, status)
               values ($1, 'invite@example.test', $2::text[], $3)`,
              [fixture.societyId, roles, status],
            ),
          ),
        );
        expect(error.code).toBe('23514');
      }

      const missingIdentity = await dbError(
        database.asSuperuser((client) =>
          client.query(
            `insert into public.memberships (society_id, roles)
             values ($1, ARRAY['resident'])`,
            [fixture.societyId],
          ),
        ),
      );
      expect(missingIdentity.code).toBe('23514');

      await database.asSuperuser((client) =>
        client.query(
          `insert into public.memberships
             (society_id, invited_email, roles, status)
           values ($1, 'invite@example.test', ARRAY['resident'], 'invited')`,
          [fixture.societyId],
        ),
      );
      const duplicateInvite = await dbError(
        database.asSuperuser((client) =>
          client.query(
            `insert into public.memberships
               (society_id, invited_email, roles, status)
             values ($1, 'INVITE@example.test', ARRAY['resident'], 'invited')`,
            [fixture.societyId],
          ),
        ),
      );
      expect(duplicateInvite.code).toBe('23505');
    } finally {
      await database.drop();
    }
  });
});
