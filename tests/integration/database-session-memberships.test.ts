// Verify session summaries disclose only active and pending memberships for the caller.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database session memberships', () => {
  it('returns only the caller’s active and pending society summaries', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const userId = await newAuthUser(client, 'member@example.test');
        const otherUserId = await newAuthUser(client, 'other@example.test');
        const disabledUserId = await newAuthUser(
          client,
          'disabled@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name, status)
           values
             ($1, 'member@example.test', 'Member', 'active'),
             ($2, 'other@example.test', 'Other', 'active'),
             ($3, 'disabled@example.test', 'Disabled', 'disabled')`,
          [userId, otherUserId, disabledUserId],
        );
        const societies = await Promise.all(
          ['Active Society', 'Pending Society', 'Inactive Society'].map(
            async (name) => {
              const result = await client.query<{ id: string }>(
                `insert into public.societies (name, created_by)
                 values ($1, $2) returning id`,
                [name, userId],
              );
              const id = result.rows[0]?.id;
              if (!id) throw new Error(`Could not create ${name}.`);
              return id;
            },
          ),
        );
        await client.query(
          `insert into public.memberships
             (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['resident'], 'active'),
             ($3, $2, ARRAY['guard'], 'pending_approval'),
             ($4, $2, ARRAY['resident'], 'deactivated'),
             ($1, $5, ARRAY['admin'], 'active'),
             ($1, $6, ARRAY['resident'], 'active')`,
          [
            societies[0],
            userId,
            societies[1],
            societies[2],
            otherUserId,
            disabledUserId,
          ],
        );
        return { societyIds: societies, userId, otherUserId, disabledUserId };
      });

      const rows = await database.asRole(
        'authenticated',
        { sub: fixture.userId },
        (client) =>
          client.query<{
            society_id: string;
            society_name: string;
            membership_status: string;
            roles: string[];
          }>(
            `select society_id, society_name, membership_status, roles
             from public.session_memberships()
             order by society_name`,
          ),
      );
      expect(rows.rows).toEqual([
        {
          society_id: fixture.societyIds[0],
          society_name: 'Active Society',
          membership_status: 'active',
          roles: ['resident'],
        },
        {
          society_id: fixture.societyIds[1],
          society_name: 'Pending Society',
          membership_status: 'pending_approval',
          roles: ['guard'],
        },
      ]);

      const disabledRows = await database.asRole(
        'authenticated',
        { sub: fixture.disabledUserId },
        (client) => client.query('select * from public.session_memberships()'),
      );
      expect(disabledRows.rows).toEqual([]);

      const anonymousCall = await dbError(
        database.asRole('anon', null, (client) =>
          client.query('select * from public.session_memberships()'),
        ),
      );
      expect(anonymousCall.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
