// Verify developer-only erasure removes identity/access while retaining history.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database user erasure', () => {
  let database: TestDatabase;
  let developerId: string;
  let targetId: string;
  let societyId: string;
  let membershipId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      developerId = await newAuthUser(client, 'erasure-developer@example.test');
      targetId = await newAuthUser(client, 'erasure-target@example.test');
      await client.query(
        `insert into public.profiles (id, email, full_name, phone)
         values ($1, 'erasure-developer@example.test', 'Erasure Developer', '+919876543210'),
                ($2, 'erasure-target@example.test', 'Target User', '+919876543211')`,
        [developerId, targetId],
      );
      await client.query(
        `insert into public.developers (user_id)
         values ($1), ($2)`,
        [developerId, targetId],
      );
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Erasure Society', $1) returning id`,
          [developerId],
        )
      ).rows[0]!.id;
      membershipId = (
        await client.query<{ id: string }>(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['resident']::text[], 'active')
           returning id`,
          [societyId, targetId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.guard_roster
           (society_id, created_by, name, membership_id, active, pin_hash)
         values ($1, $2, 'Target Guard', $3, true, repeat('a', 60))`,
        [societyId, developerId, membershipId],
      );
      await client.query(
        `insert into public.notifications
           (society_id, user_id, type, title, body)
         values ($1, $2, 'visitor_pending', 'Pending visit', 'Respond to the visit')`,
        [societyId, targetId],
      );
      await client.query(
        `insert into public.push_subscriptions
           (user_id, endpoint, p256dh, auth_secret)
         values ($1, 'https://fcm.googleapis.com/fcm/send/erasure-test',
                 'public-key', 'auth-secret')`,
        [targetId],
      );
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('removes login access and PII while keeping an anonymized profile tombstone', async () => {
    const preparation = await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query<{ result: Record<string, unknown> }>(
          `select public.user_erasure_prepare($1::uuid, $2::uuid, $3::text) as result`,
          [targetId, developerId, 'erasure-prepare'],
        ),
      { commit: true },
    );
    expect(preparation.rows[0]!.result).toMatchObject({
      alreadyAnonymized: false,
      authAccountPresent: true,
      membershipsDeactivated: 1,
      guardsDisabled: 1,
      notificationsDeleted: 1,
      pushSubscriptionsDeleted: 1,
    });

    const prematureCompletion = await dbError(
      database.asRole('service_role', null, (client) =>
        client.query(
          `select public.user_erasure_complete($1::uuid, $2::uuid, $3::text)`,
          [targetId, developerId, 'erasure-premature'],
        ),
      ),
    );
    expect(prematureCompletion.code).toBe('55000');

    await database.asSuperuser((client) =>
      client.query('delete from auth.users where id = $1', [targetId]),
    );
    const activeWithoutAuth = await dbError(
      database.asSuperuser((client) =>
        client.query(
          `update public.profiles set status = 'active' where id = $1`,
          [targetId],
        ),
      ),
    );
    expect(activeWithoutAuth.code).toBe('23503');

    const completion = await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query<{ result: Record<string, unknown> }>(
          `select public.user_erasure_complete($1::uuid, $2::uuid, $3::text) as result`,
          [targetId, developerId, 'erasure-complete'],
        ),
      { commit: true },
    );
    expect(completion.rows[0]!.result).toEqual({
      completed: true,
      profileStatus: 'anonymized',
    });

    await database.asSuperuser(async (client) => {
      const profile = await client.query<{
        email: string;
        full_name: string;
        phone: string | null;
        photo_path: string | null;
        status: string;
      }>(
        `select email, full_name, phone, photo_path, status
         from public.profiles where id = $1`,
        [targetId],
      );
      expect(profile.rows).toEqual([
        {
          email: `deleted+${targetId}@anonymized.invalid`,
          full_name: 'Deleted user',
          phone: null,
          photo_path: null,
          status: 'anonymized',
        },
      ]);

      const membership = await client.query<{
        status: string;
        invited_email: string | null;
        left_at: string | null;
      }>(
        `select status, invited_email, left_at
         from public.memberships where id = $1`,
        [membershipId],
      );
      expect(membership.rows[0]).toMatchObject({
        status: 'deactivated',
        invited_email: null,
      });
      expect(membership.rows[0]?.left_at).not.toBeNull();

      const guard = await client.query<{
        membership_id: string | null;
        pin_hash: string | null;
        active: boolean;
      }>(
        `select membership_id, pin_hash, active
         from public.guard_roster where society_id = $1`,
        [societyId],
      );
      expect(guard.rows).toEqual([
        { membership_id: null, pin_hash: null, active: false },
      ]);

      const authAccount = await client.query(
        `select id from auth.users where id = $1`,
        [targetId],
      );
      expect(authAccount.rowCount).toBe(0);
      const linkedNotifications = await client.query(
        `select id from public.notifications where user_id = $1`,
        [targetId],
      );
      expect(linkedNotifications.rowCount).toBe(0);
      const linkedSubscriptions = await client.query(
        `select id from public.push_subscriptions where user_id = $1`,
        [targetId],
      );
      expect(linkedSubscriptions.rowCount).toBe(0);
      const developerAccess = await client.query(
        `select user_id from public.developers where user_id = $1`,
        [targetId],
      );
      expect(developerAccess.rowCount).toBe(0);
      const audits = await client.query(
        `select id from public.audit_logs
         where entity_id = $1 and action in (
           'user.erasure_started', 'user.erasure_completed'
         )`,
        [targetId],
      );
      expect(audits.rowCount).toBe(2);
    });
  });
});
