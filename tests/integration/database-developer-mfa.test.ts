// Verify developer helpers require a recent MFA record for the current auth session.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database developer MFA sessions', () => {
  it('binds developer access to the verified and unexpired auth session', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const developerId = await newAuthUser(client, 'developer@example.test');
        const memberId = await newAuthUser(client, 'member@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'developer@example.test', 'Developer'),
             ($2, 'member@example.test', 'Member')`,
          [developerId, memberId],
        );
        await client.query(
          'insert into public.developers (user_id) values ($1)',
          [developerId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Developer Test Society', $1) returning id`,
            [developerId],
          )
        ).rows[0]?.id;
        if (!societyId) throw new Error('Could not create the test society.');
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin', 'resident'], 'active')`,
          [societyId, developerId],
        );
        const sessions = await Promise.all(
          ['valid', 'expired', 'other-user'].map(async (name) => {
            const result = await client.query<{ id: string }>(
              `insert into auth.sessions (user_id, created_at)
               values ($1, $2) returning id`,
              [
                name === 'other-user' ? memberId : developerId,
                name === 'expired'
                  ? new Date(Date.now() - 5 * 60 * 60_000)
                  : new Date(),
              ],
            );
            const id = result.rows[0]?.id;
            if (!id) throw new Error(`Could not create the ${name} session.`);
            return id;
          }),
        );
        return { developerId, memberId, societyId, sessionIds: sessions };
      });

      const noSecondFactor = await dbError(
        database.asRole(
          'authenticated',
          {
            sub: fixture.developerId,
            session_id: fixture.sessionIds[0],
            aal: 'aal1',
          },
          (client) => client.query('select public.record_developer_mfa()'),
        ),
      );
      expect(noSecondFactor.code).toBe('42501');

      const nonDeveloper = await dbError(
        database.asRole(
          'authenticated',
          {
            sub: fixture.memberId,
            session_id: fixture.sessionIds[2],
            aal: 'aal2',
          },
          (client) => client.query('select public.record_developer_mfa()'),
        ),
      );
      expect(nonDeveloper.code).toBe('42501');

      const expiredSession = await dbError(
        database.asRole(
          'authenticated',
          {
            sub: fixture.developerId,
            session_id: fixture.sessionIds[1],
            aal: 'aal2',
          },
          (client) => client.query('select public.record_developer_mfa()'),
        ),
      );
      expect(expiredSession.code).toBe('28000');

      const recorded = await database.asRole(
        'authenticated',
        {
          sub: fixture.developerId,
          session_id: fixture.sessionIds[0],
          aal: 'aal2',
        },
        (client) =>
          client.query<{ record_developer_mfa: string }>(
            'select public.record_developer_mfa()',
          ),
        { commit: true },
      );
      expect(
        Date.parse(recorded.rows[0]?.record_developer_mfa ?? ''),
      ).toBeGreaterThan(Date.now() + 2 * 60 * 60_000);

      const validAccess = await database.asRole(
        'authenticated',
        {
          sub: fixture.developerId,
          session_id: fixture.sessionIds[0],
          aal: 'aal2',
        },
        (client) =>
          client.query<{
            is_developer_account: boolean;
            mfa_verified: boolean;
            is_developer: boolean;
            is_member: boolean;
            has_admin_role: boolean;
          }>(
            `select
               (select is_developer_account from public.session_developer_access()) as is_developer_account,
               (select mfa_verified from public.session_developer_access()) as mfa_verified,
               private.is_developer() as is_developer,
               private.is_member($1) as is_member,
               private.has_role($1, ARRAY['admin']::text[]) as has_admin_role`,
            [fixture.societyId],
          ),
      );
      expect(validAccess.rows[0]).toEqual({
        is_developer_account: true,
        mfa_verified: true,
        is_developer: true,
        is_member: true,
        has_admin_role: true,
      });

      const wrongSession = await database.asRole(
        'authenticated',
        {
          sub: fixture.developerId,
          session_id: fixture.sessionIds[1],
          aal: 'aal2',
        },
        (client) =>
          client.query<{ is_developer: boolean }>(
            'select private.is_developer() as is_developer',
          ),
      );
      expect(wrongSession.rows[0]?.is_developer).toBe(false);

      await database.asSuperuser((client) =>
        client.query(
          `update private.developer_mfa_sessions
           set mfa_verified_at = now() - interval '16 minutes'
           where session_id = $1`,
          [fixture.sessionIds[0]],
        ),
      );
      const staleAccess = await database.asRole(
        'authenticated',
        {
          sub: fixture.developerId,
          session_id: fixture.sessionIds[0],
          aal: 'aal2',
        },
        (client) =>
          client.query<{ mfa_verified: boolean }>(
            'select mfa_verified from public.session_developer_access()',
          ),
      );
      expect(staleAccess.rows[0]?.mfa_verified).toBe(false);

      const directTableRead = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.developerId },
          (client) =>
            client.query('select * from private.developer_mfa_sessions'),
        ),
      );
      expect(directTableRead.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
