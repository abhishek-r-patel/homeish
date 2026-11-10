// Verify auth email confirmation creates and synchronizes application profiles.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database profile sync', () => {
  it('creates profiles only for confirmed email identities and preserves profile data', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const userId = await newAuthUser(client, 'member@example.test');
        const unverifiedId = await newAuthUser(
          client,
          'unverified@example.test',
        );
        const beforeConfirmation = await client.query(
          'select id from public.profiles where id = $1',
          [userId],
        );
        expect(beforeConfirmation.rows).toEqual([]);

        await client.query(
          `update auth.users set email_confirmed_at = now() where id = $1`,
          [userId],
        );
        return { userId, unverifiedId };
      });

      const createdProfile = await database.asSuperuser((client) =>
        client.query<{
          email: string;
          full_name: string;
          status: string;
        }>(
          `select email::text, full_name, status
           from public.profiles
           where id = $1`,
          [fixture.userId],
        ),
      );
      expect(createdProfile.rows).toEqual([
        {
          email: 'member@example.test',
          full_name: 'Homeish member',
          status: 'active',
        },
      ]);

      const unverifiedProfile = await database.asSuperuser((client) =>
        client.query('select id from public.profiles where id = $1', [
          fixture.unverifiedId,
        ]),
      );
      expect(unverifiedProfile.rows).toEqual([]);

      await database.asSuperuser(async (client) => {
        await client.query(
          `update public.profiles
           set full_name = 'Member Name', status = 'disabled'
           where id = $1`,
          [fixture.userId],
        );
        await client.query(
          `update auth.users
           set email = 'member.updated@example.test'
           where id = $1`,
          [fixture.userId],
        );
      });

      const synchronizedProfile = await database.asSuperuser((client) =>
        client.query<{
          email: string;
          full_name: string;
          status: string;
        }>(
          `select email::text, full_name, status
           from public.profiles
           where id = $1`,
          [fixture.userId],
        ),
      );
      expect(synchronizedProfile.rows).toEqual([
        {
          email: 'member.updated@example.test',
          full_name: 'Member Name',
          status: 'disabled',
        },
      ]);
    } finally {
      await database.drop();
    }
  });
});
