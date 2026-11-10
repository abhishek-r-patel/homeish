// Verify notification ownership, read state, push-key secrecy and quota RPCs.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database notifications', () => {
  it('isolates inbox state, hides subscription keys and reserves the quota once', async () => {
    const database = await createTestDatabase({
      throughMigration: '20261110100000',
    });
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const ownerId = await newAuthUser(client, 'owner@example.test');
        const otherId = await newAuthUser(client, 'other@example.test');
        const pendingId = await newAuthUser(client, 'pending@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'owner@example.test', 'Owner'),
             ($2, 'other@example.test', 'Other'),
             ($3, 'pending@example.test', 'Pending')`,
          [ownerId, otherId, pendingId],
        );
        const society = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Notification Society', $1) returning id`,
          [ownerId],
        );
        const societyId = society.rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['resident']::text[], 'active'),
             ($1, $3, ARRAY['resident']::text[], 'active'),
             ($1, $4, ARRAY['resident']::text[], 'pending_approval')`,
          [societyId, ownerId, otherId, pendingId],
        );
        const firstNotification = await client.query<{ id: string }>(
          `select private.create_notification(
             $1, $2, 'visitor_pending', 'Visitor at gate',
             'A visitor is waiting.', 'visitor_entry', gen_random_uuid()
           ) as id`,
          [societyId, ownerId],
        );
        const secondNotification = await client.query<{ id: string }>(
          `select private.create_notification(
             $1, $2, 'delivery_pending', 'Delivery arrived',
             'A delivery is waiting.', null, null
           ) as id`,
          [societyId, otherId],
        );
        return {
          firstNotificationId: firstNotification.rows[0]?.id,
          otherNotificationId: secondNotification.rows[0]?.id,
          ownerId,
          otherId,
          pendingId,
          societyId,
        };
      });

      expect(fixture.firstNotificationId).toBeTruthy();
      expect(fixture.otherNotificationId).toBeTruthy();
      const [ownerRows, otherRows] = await Promise.all([
        database.asRole('authenticated', { sub: fixture.ownerId }, (client) =>
          client.query<{ id: string; read_at: string | null }>(
            'select id, read_at from public.notifications order by id',
          ),
        ),
        database.asRole('authenticated', { sub: fixture.otherId }, (client) =>
          client.query<{ id: string }>(
            'select id from public.notifications order by id',
          ),
        ),
      ]);
      expect(ownerRows.rows).toHaveLength(1);
      expect(ownerRows.rows[0]?.id).toBe(fixture.firstNotificationId);
      expect(otherRows.rows).toEqual([{ id: fixture.otherNotificationId }]);

      await database.asRole(
        'authenticated',
        { sub: fixture.ownerId },
        async (client) => {
          await client.query('select public.mark_notification_read($1)', [
            fixture.otherNotificationId,
          ]);
          await client.query('select public.mark_all_notifications_read()');
        },
        { commit: true },
      );
      const readState = await database.asSuperuser((client) =>
        client.query<{ id: string; read_at: string | null }>(
          `select id, read_at from public.notifications
           where id = any($1::uuid[])`,
          [[fixture.firstNotificationId, fixture.otherNotificationId]],
        ),
      );
      expect(
        readState.rows.find((row) => row.id === fixture.firstNotificationId)
          ?.read_at,
      ).not.toBeNull();
      expect(
        readState.rows.find((row) => row.id === fixture.otherNotificationId)
          ?.read_at,
      ).toBeNull();

      await database.asRole(
        'authenticated',
        { sub: fixture.ownerId },
        (client) =>
          client.query(
            `select public.register_push_subscription($1, $2, $3, $4)`,
            [
              'https://fcm.googleapis.com/fcm/send/subscription-token',
              'a'.repeat(87),
              'b'.repeat(22),
              'test browser',
            ],
          ),
        { commit: true },
      );
      const untrustedEndpoint = await dbError(
        database.asRole('authenticated', { sub: fixture.ownerId }, (client) =>
          client.query(
            `select public.register_push_subscription(
                 $1, $2, $3, null
               )`,
            [
              'https://attacker.example.test/receive',
              'a'.repeat(87),
              'b'.repeat(22),
            ],
          ),
        ),
      );
      expect(untrustedEndpoint.code).toBe('22023');
      const privateKeys = await dbError(
        database.asRole('authenticated', { sub: fixture.ownerId }, (client) =>
          client.query(
            'select endpoint, p256dh, auth_secret from public.push_subscriptions',
          ),
        ),
      );
      expect(privateKeys.code).toBe('42501');

      const crossOwnerDelete = await database.asRole(
        'authenticated',
        { sub: fixture.otherId },
        async (client) => {
          await client.query(
            `select public.delete_push_subscription(
               'https://fcm.googleapis.com/fcm/send/subscription-token'
             )`,
          );
        },
        { commit: true },
      );
      expect(crossOwnerDelete).toBeUndefined();
      const privilegedKey = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ auth_secret: string }>(
            `select auth_secret from public.push_subscriptions
             where user_id = $1`,
            [fixture.ownerId],
          ),
      );
      expect(privilegedKey.rows[0]?.auth_secret).toBe('b'.repeat(22));

      const quotaResults = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const results = [];
          for (let attempt = 0; attempt < 6; attempt += 1) {
            results.push(
              await client.query<{
                allowed: boolean;
                sent_count: number;
                should_alert: boolean;
              }>('select * from public.record_email_send(5)'),
            );
          }
          return results.map((result) => result.rows[0]);
        },
        { commit: true },
      );
      expect(quotaResults[3]).toMatchObject({
        sent_count: 4,
        allowed: true,
        should_alert: true,
      });
      expect(quotaResults[4]).toMatchObject({
        sent_count: 5,
        allowed: true,
        should_alert: false,
      });
      expect(quotaResults[5]).toMatchObject({
        sent_count: 6,
        allowed: false,
        should_alert: false,
      });

      const rolledBackId = await database.asSuperuser(async (client) => {
        await client.query('begin');
        const created = await client.query<{ id: string }>(
          `select private.create_notification(
             $1, $2, 'test_event', 'Transactional update',
             'This row will be rolled back.'
           ) as id`,
          [fixture.societyId, fixture.ownerId],
        );
        await client.query('rollback');
        return created.rows[0]?.id;
      });
      const rolledBackRow = await database.asSuperuser((client) =>
        client.query('select id from public.notifications where id = $1', [
          rolledBackId,
        ]),
      );
      expect(rolledBackRow.rows).toHaveLength(0);

      await expect(
        database.asSuperuser((client) =>
          client.query(
            `select private.create_notification(
               $1, $2, 'test_event', 'Pending account',
               'This recipient is not active.'
             )`,
            [fixture.societyId, fixture.pendingId],
          ),
        ),
      ).rejects.toMatchObject({ code: '23514' });

      const realtimePublication = await database.asSuperuser((client) =>
        client.query<{
          publication_exists: boolean;
          notifications_published: boolean;
        }>(
          `select
             exists (
               select 1 from pg_catalog.pg_publication
               where pubname = 'supabase_realtime'
             ) as publication_exists,
             exists (
               select 1 from pg_catalog.pg_publication_tables
               where pubname = 'supabase_realtime'
                 and schemaname = 'public'
                 and tablename = 'notifications'
             ) as notifications_published`,
        ),
      );
      if (realtimePublication.rows[0]?.publication_exists) {
        expect(realtimePublication.rows[0].notifications_published).toBe(true);
      }
    } finally {
      await database.drop();
    }
  });
});
