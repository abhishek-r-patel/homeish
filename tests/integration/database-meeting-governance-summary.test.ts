// Verify the P43.5 meeting and committee summary: period, quorum, attendance, minutes, actions and roles.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database meeting governance summary', () => {
  let database: TestDatabase;
  let societyId: string;
  const users: Record<string, string> = {};

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      for (const name of ['admin', 'committee', 'resident']) {
        const email = `governance-${name}@example.test`;
        users[name] = await newAuthUser(client, email);
        await client.query(
          'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
          [users[name], email, `Synthetic ${name}`],
        );
      }
      const admin = users.admin!;
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by) values ('Governance Society', $1) returning id`,
          [admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         select $1, module_key, true, '{}'::jsonb from unnest(array['core', 'meeting']) as module_key`,
        [societyId],
      );
      const memberships = await client.query<{ id: string; user_id: string }>(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, array['admin']::text[], 'active'),
                ($1, $3, array['committee']::text[], 'active'),
                ($1, $4, array['resident']::text[], 'active')
         returning id, user_id`,
        [societyId, admin, users.committee, users.resident],
      );
      const membership = (user: string) =>
        memberships.rows.find((row) => row.user_id === user)!.id;
      const units = await client.query<{ id: string; number: string }>(
        `insert into public.units (society_id, number, created_by)
         values ($1, 'A-1', $2), ($1, 'A-2', $2) returning id, number`,
        [societyId, admin],
      );
      const unit = (number: string) =>
        units.rows.find((row) => row.number === number)!.id;
      // Held meetings freeze their invitees, so the fixtures bypass the lifecycle guards like other meeting tests.
      await client.query('set session_replication_role = replica');
      const meetings = await client.query<{ id: string; title: string }>(
        `insert into public.meetings
           (society_id, meeting_type, status, title, starts_at, ends_at, venue, client_request_id,
            created_by, scheduled_at, notice_required_days, notice_given_days, quorum_percent,
            held_at, held_by, cancelled_at, cancelled_by, cancellation_reason)
         values
           ($1, 'agm', 'held', 'AGM', '2025-03-10 10:00+05:30', '2025-03-10 12:00+05:30', 'Hall',
            'gov-1', $2, '2025-02-01', 14, 14, 50, '2025-03-10 12:00+05:30', $2, null, null, null),
           ($1, 'committee', 'held', 'Committee', '2025-04-10 10:00+05:30', '2025-04-10 11:00+05:30',
            'Office', 'gov-2', $2, '2025-04-01', 3, 3, 60, '2025-04-10 11:00+05:30', $2, null, null, null),
           ($1, 'sgm', 'cancelled', 'Cancelled SGM', '2025-05-01 10:00+05:30', '2025-05-01 11:00+05:30',
            'Hall', 'gov-3', $2, '2025-04-01', 14, 14, 50, null, null, '2025-04-20', $2, 'Postponed'),
           ($1, 'agm', 'scheduled', 'Upcoming', '2025-12-31 23:30+05:30', '2026-01-01 01:00+05:30',
            'Hall', 'gov-4', $2, '2025-12-01', 14, 14, 50, null, null, null, null, null),
           ($1, 'agm', 'held', 'Old AGM', '2024-03-10 10:00+05:30', '2024-03-10 12:00+05:30', 'Hall',
            'gov-5', $2, '2024-02-01', 14, 14, 50, '2024-03-10 12:00+05:30', $2, null, null, null)
         returning id, title`,
        [societyId, admin],
      );
      await client.query(
        `insert into public.meetings (society_id, meeting_type, status, client_request_id, created_by)
         values ($1, 'agm', 'draft', 'gov-draft', $2)`,
        [societyId, admin],
      );
      const meeting = (title: string) =>
        meetings.rows.find((row) => row.title === title)!.id;
      await client.query(
        `insert into public.meeting_invited_units (society_id, meeting_id, unit_id, unit_label)
         values ($1, $2, $3, 'A-1'), ($1, $2, $4, 'A-2')`,
        [societyId, meeting('AGM'), unit('A-1'), unit('A-2')],
      );
      await client.query(
        `insert into public.meeting_invited_members (society_id, meeting_id, membership_id, member_name)
         values ($1, $2, $3, 'Admin'), ($1, $2, $4, 'Committee')`,
        [
          societyId,
          meeting('Committee'),
          membership(admin),
          membership(users.committee!),
        ],
      );
      await client.query(
        `insert into public.meeting_attendance
           (society_id, meeting_id, unit_id, membership_id, mode, recorded_by)
         values ($1, $2, $3, null, 'in_person', $6), ($1, $4, null, $5, 'in_person', $6)`,
        [
          societyId,
          meeting('AGM'),
          unit('A-1'),
          meeting('Committee'),
          membership(admin),
          admin,
        ],
      );
      await client.query(
        `insert into public.meeting_minutes
           (society_id, meeting_id, body, status, drafted_by, updated_by, published_by, published_at)
         values ($1, $2, 'Synthetic minutes', 'published', $3, $3, $3, now())`,
        [societyId, meeting('AGM'), admin],
      );
      await client.query(
        `insert into public.meeting_resolutions
           (society_id, meeting_id, position, title, outcome, created_by, updated_by)
         values ($1, $2, 1, 'Repaint', 'passed', $4, $4), ($1, $2, 2, 'Solar', 'pending', $4, $4),
                ($1, $3, 1, 'Budget', 'deferred', $4, $4)`,
        [societyId, meeting('AGM'), meeting('Committee'), admin],
      );
      await client.query(
        `insert into public.meeting_action_items
           (society_id, meeting_id, title, owner_membership_id, owner_name, due_on, status,
            completed_at, completed_by, created_by, updated_by)
         values ($1, $2, 'Get quotes', $3, 'Committee member', '2025-04-01', 'open', null, null, $5, $5),
                ($1, $2, 'Install', $3, 'Committee member', '2099-01-01', 'open', null, null, $5, $5),
                ($1, $2, 'Book hall', $4, 'Admin member', '2025-03-20', 'done', now(), $5, $5, $5),
                ($1, $6, 'Old item', $4, 'Admin member', '2024-04-01', 'open', null, null, $5, $5)`,
        [
          societyId,
          meeting('AGM'),
          membership(users.committee!),
          membership(admin),
          admin,
          meeting('Old AGM'),
        ],
      );
      await client.query('set session_replication_role = origin');
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  const summary = (userId: string, from = '2025-01-01', to = '2025-12-31') =>
    database.asRole(
      'authenticated',
      { sub: userId },
      async (client) =>
        (
          await client.query<{ result: Record<string, unknown> }>(
            'select public.meeting_governance_summary($1, $2, $3) as result',
            [societyId, from, to],
          )
        ).rows[0]!.result,
    );

  it('summarises meetings, quorum, attendance, resolutions, minutes and actions in the period', async () => {
    const result = await summary(users.committee!);
    expect(result).toMatchObject({
      from: '2025-01-01',
      to: '2025-12-31',
      meetings: { scheduled: 1, held: 2, cancelled: 1 },
      quorum: { with_rule: 2, met: 1 },
      average_attendance_percent: 50,
      resolutions: { passed: 1, failed: 0, deferred: 1, pending: 1 },
      actions: { open: 1, overdue: 1, done: 1 },
      minutes_unpublished: 1,
      owners: [
        {
          owner_name: 'Committee member',
          open: 1,
          overdue: 1,
          next_due_on: '2025-04-01',
        },
      ],
    });
  });

  it('allows admins, denies residents and rejects periods over 24 months', async () => {
    expect(await summary(users.admin!)).toMatchObject({
      meetings: { held: 2 },
    });
    expect(await dbError(summary(users.resident!))).toMatchObject({
      code: '42501',
    });
    expect(
      await dbError(summary(users.admin!, '2023-01-01', '2025-12-31')),
    ).toMatchObject({ code: '22023' });
  });
});
