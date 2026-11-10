// Verify authentication challenge reservations are private, expiring and single use.
import { describe, expect, it } from 'vitest';
import { createTestDatabase, dbError, hasDatabase } from './support/database';

describe.skipIf(!hasDatabase)('database auth code challenges', () => {
  it('invalidates a code after five failures and starts fresh for a new code', async () => {
    const database = await createTestDatabase();
    try {
      const emailKey = `auth:challenge:email:${'a'.repeat(64)}`;
      const state = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const started = await client.query<{
            start_auth_code_challenge: string;
          }>('select public.start_auth_code_challenge($1)', [emailKey]);
          const firstChallenge = started.rows[0]?.start_auth_code_challenge;
          if (!firstChallenge) {
            throw new Error('The first auth challenge was not created.');
          }

          for (let attempt = 0; attempt < 5; attempt += 1) {
            const reserved = await client.query<{
              status: string;
              challenge_id: string | null;
            }>('select * from public.reserve_auth_code_attempt($1)', [
              emailKey,
            ]);
            expect(reserved.rows[0]).toMatchObject({
              status: 'reserved',
              challenge_id: firstChallenge,
            });
            const finished = await client.query<{
              finish_auth_code_attempt: boolean;
            }>(`select public.finish_auth_code_attempt($1, true, false)`, [
              firstChallenge,
            ]);
            expect(finished.rows[0]?.finish_auth_code_attempt).toBe(true);
          }

          const locked = await client.query<{
            status: string;
            challenge_id: string | null;
          }>('select * from public.reserve_auth_code_attempt($1)', [emailKey]);
          const nextChallenge = await client.query<{
            start_auth_code_challenge: string;
          }>('select public.start_auth_code_challenge($1)', [emailKey]);
          const reset = await client.query<{
            status: string;
            challenge_id: string | null;
          }>('select * from public.reserve_auth_code_attempt($1)', [emailKey]);

          return {
            firstChallenge,
            locked: locked.rows[0],
            nextChallenge: nextChallenge.rows[0]?.start_auth_code_challenge,
            reset: reset.rows[0],
          };
        },
        { commit: true },
      );

      expect(state.locked).toMatchObject({
        status: 'locked',
        challenge_id: state.firstChallenge,
      });
      expect(state.nextChallenge).not.toBe(state.firstChallenge);
      expect(state.reset).toMatchObject({
        status: 'reserved',
        challenge_id: state.nextChallenge,
      });
    } finally {
      await database.drop();
    }
  });

  it('does not expose challenge state or functions to API roles', async () => {
    const database = await createTestDatabase();
    try {
      const anonymousTableRead = await dbError(
        database.asRole('anon', null, (client) =>
          client.query('select * from public.auth_code_challenges'),
        ),
      );
      expect(anonymousTableRead.code).toBe('42501');

      const authenticatedFunctionCall = await dbError(
        database.asRole(
          'authenticated',
          { sub: '00000000-0000-0000-0000-000000000001' },
          (client) =>
            client.query(
              `select public.start_auth_code_challenge(
                'auth:challenge:email:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
              )`,
            ),
        ),
      );
      expect(authenticatedFunctionCall.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
