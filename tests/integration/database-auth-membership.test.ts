// Verify sign-in eligibility and first-sign-in membership claims in PostgreSQL.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database auth memberships', () => {
  it('exposes only a boolean sign-in check to the service role', async () => {
    const database = await createTestDatabase();
    try {
      await database.asSuperuser(async (client) => {
        const ownerId = await newAuthUser(client, 'owner@example.test');
        const activeId = await newAuthUser(client, 'active@example.test');
        const pendingId = await newAuthUser(client, 'pending@example.test');
        const disabledId = await newAuthUser(client, 'disabled@example.test');
        const deactivatedId = await newAuthUser(
          client,
          'deactivated@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name, status)
           values
             ($1, 'owner@example.test', 'Owner', 'active'),
             ($2, 'active@example.test', 'Active', 'active'),
             ($3, 'pending@example.test', 'Pending', 'active'),
             ($4, 'disabled@example.test', 'Disabled', 'disabled'),
             ($5, 'deactivated@example.test', 'Deactivated', 'active')`,
          [ownerId, activeId, pendingId, disabledId, deactivatedId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Auth Access Society', $1) returning id`,
            [ownerId],
          )
        ).rows[0]?.id;
        if (!societyId) {
          throw new Error('Could not create the fixture society.');
        }
        await client.query(
          `insert into public.memberships (society_id, user_id, invited_email, roles, status)
           values
             ($1, $2, null, ARRAY['resident'], 'active'),
             ($1, $3, null, ARRAY['resident'], 'pending_approval'),
             ($1, $4, null, ARRAY['resident'], 'active'),
             ($1, $5, null, ARRAY['resident'], 'deactivated'),
             ($1, null, 'Invitee@Example.test', ARRAY['resident'], 'invited')`,
          [societyId, activeId, pendingId, disabledId, deactivatedId],
        );
      });

      const eligibility = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ email: string; allowed: boolean }>(
            `select email, public.has_signin_access(email) as allowed
             from unnest($1::text[]) as candidates(email)`,
            [
              [
                ' INVITEE@example.test ',
                'active@example.test',
                'pending@example.test',
                'disabled@example.test',
                'deactivated@example.test',
                'unknown@example.test',
              ],
            ],
          ),
      );
      expect(
        Object.fromEntries(
          eligibility.rows.map(({ email, allowed }) => [
            email.trim().toLowerCase(),
            allowed,
          ]),
        ),
      ).toEqual({
        'invitee@example.test': true,
        'active@example.test': true,
        'pending@example.test': true,
        'disabled@example.test': false,
        'deactivated@example.test': false,
        'unknown@example.test': false,
      });

      const anonymousCall = await dbError(
        database.asRole('anon', null, (client) =>
          client.query(
            `select public.has_signin_access('invitee@example.test')`,
          ),
        ),
      );
      expect(anonymousCall.code).toBe('42501');

      const userCall = await dbError(
        database.asRole(
          'authenticated',
          { sub: '00000000-0000-0000-0000-000000000001' },
          (client) =>
            client.query(
              `select public.has_signin_access('invitee@example.test')`,
            ),
        ),
      );
      expect(userCall.code).toBe('42501');

      const invalidEmail = await dbError(
        database.asRole('service_role', null, (client) =>
          client.query(`select public.has_signin_access(' ')`),
        ),
      );
      expect(invalidEmail.code).toBe('22023');
    } finally {
      await database.drop();
    }
  });

  it('claims verified invitations without changing an existing society membership', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const userId = await newAuthUser(client, 'New.Member@example.test');
        const unverifiedId = await newAuthUser(
          client,
          'unverified@example.test',
        );
        await client.query(
          `update auth.users
           set email_confirmed_at = now()
           where id = $1`,
          [userId],
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'New.Member@example.test', 'New Member'),
                  ($2, 'unverified@example.test', 'Unverified')
           on conflict (id) do update set full_name = excluded.full_name`,
          [userId, unverifiedId],
        );
        const societies = await Promise.all(
          ['Claim Society', 'Existing Society'].map(async (name) => {
            const result = await client.query<{ id: string }>(
              `insert into public.societies (name, created_by)
               values ($1, $2) returning id`,
              [name, userId],
            );
            const societyId = result.rows[0]?.id;
            if (!societyId) {
              throw new Error(`Could not create ${name}.`);
            }
            return societyId;
          }),
        );
        await client.query(
          `insert into public.memberships
             (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['resident'], 'active')`,
          [societies[1], userId],
        );
        await client.query(
          `insert into public.memberships
             (society_id, invited_email, roles, status)
           values
             ($1, 'new.member@example.test', ARRAY['admin'], 'invited'),
             ($2, 'NEW.MEMBER@example.test', ARRAY['guard'], 'invited'),
             ($1, 'unverified@example.test', ARRAY['resident'], 'invited'),
             ($1, 'another@example.test', ARRAY['resident'], 'invited')`,
          societies,
        );
        return { societyIds: societies, userId, unverifiedId };
      });

      const claimed = await database.asRole(
        'authenticated',
        { sub: fixture.userId },
        (client) =>
          client.query<{ claim_memberships: number }>(
            'select public.claim_memberships()',
          ),
        { commit: true },
      );
      expect(claimed.rows[0]?.claim_memberships).toBe(1);

      const membershipState = await database.asSuperuser((client) =>
        client.query<{
          society_id: string;
          user_id: string | null;
          invited_email: string | null;
          roles: string[];
          status: string;
          joined_at: string | null;
        }>(
          `select society_id, user_id, invited_email, roles, status, joined_at
           from public.memberships
           where invited_email is not null or user_id = $1
           order by society_id, invited_email nulls first`,
          [fixture.userId],
        ),
      );
      expect(membershipState.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            society_id: fixture.societyIds[0],
            user_id: fixture.userId,
            invited_email: null,
            roles: ['admin'],
            status: 'active',
          }),
          expect.objectContaining({
            society_id: fixture.societyIds[1],
            user_id: null,
            invited_email: 'NEW.MEMBER@example.test',
            roles: ['guard'],
            status: 'invited',
            joined_at: null,
          }),
          expect.objectContaining({
            society_id: fixture.societyIds[0],
            user_id: null,
            invited_email: 'unverified@example.test',
            status: 'invited',
          }),
          expect.objectContaining({
            society_id: fixture.societyIds[0],
            user_id: null,
            invited_email: 'another@example.test',
            status: 'invited',
          }),
        ]),
      );
      const claimedMembership = membershipState.rows.find(
        ({ society_id, user_id }) =>
          society_id === fixture.societyIds[0] && user_id === fixture.userId,
      );
      expect(claimedMembership?.roles).toEqual(['admin']);
      expect(claimedMembership?.joined_at).not.toBeNull();

      const repeatedClaim = await database.asRole(
        'authenticated',
        { sub: fixture.userId },
        (client) =>
          client.query<{ claim_memberships: number }>(
            'select public.claim_memberships()',
          ),
      );
      expect(repeatedClaim.rows[0]?.claim_memberships).toBe(0);

      const unverifiedClaim = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.unverifiedId },
          (client) => client.query('select public.claim_memberships()'),
        ),
      );
      expect(unverifiedClaim.code).toBe('42501');

      const serviceCall = await dbError(
        database.asRole('service_role', null, (client) =>
          client.query('select public.claim_memberships()'),
        ),
      );
      expect(serviceCall.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
