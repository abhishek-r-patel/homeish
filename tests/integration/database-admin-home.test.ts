// Verify the admin home (A-01) sections follow each module's rules, roles and the private audit allow-list.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminHomeActionsSchema,
  adminHomeSnapshotSchema,
} from '../../src/core/home/admin-validation';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Section = { status: string; [key: string]: unknown } | null;
type Home = Record<
  | 'visitors'
  | 'requests'
  | 'billing'
  | 'amc'
  | 'stock'
  | 'tenancy'
  | 'registrations'
  | 'meeting'
  | 'activity',
  Section
> & { timezone: string };

describe.skipIf(!hasDatabase)('database admin home', () => {
  let database: TestDatabase;
  let societyId: string;
  let otherSocietyId: string;
  const users: Record<string, string> = {};
  let meetingId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      for (const name of [
        'admin',
        'committee',
        'supervisor',
        'resident',
        'guard',
        'applicant',
      ]) {
        const email = `admin-home-${name}@example.test`;
        users[name] = await newAuthUser(client, email);
        await client.query(
          'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
          [users[name], email, `Synthetic ${name}`],
        );
      }
      const admin = users.admin!;
      const societies = await client.query<{ id: string }>(
        `insert into public.societies (name, created_by)
         values ('Admin Home Society', $1), ('Other Admin Society', $1) returning id`,
        [admin],
      );
      [societyId, otherSocietyId] = societies.rows.map(({ id }) => id) as [
        string,
        string,
      ];
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         select society, module_key, true, '{}'::jsonb
         from unnest(array[$1::uuid, $2::uuid]) as society,
              unnest(array['core', 'visitor', 'billing', 'service_request', 'housekeeping',
                           'amc', 'notice', 'tenancy', 'meeting']) as module_key`,
        [societyId, otherSocietyId],
      );
      await client.query(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, array['admin']::text[], 'active'),
                ($1, $3, array['committee']::text[], 'active'),
                ($1, $4, array['hk_supervisor']::text[], 'active'),
                ($1, $5, array['resident']::text[], 'active'),
                ($1, $6, array['guard']::text[], 'active'),
                ($1, $7, array['resident']::text[], 'pending_approval'),
                ($8, $2, array['admin']::text[], 'active')`,
        [
          societyId,
          admin,
          users.committee,
          users.supervisor,
          users.resident,
          users.guard,
          users.applicant,
          otherSocietyId,
        ],
      );
      const units = await client.query<{ id: string; number: string }>(
        `insert into public.units (society_id, number, created_by)
         values ($1, 'A-1', $3), ($1, 'A-2', $3), ($2, 'Z-1', $3)
         returning id, number`,
        [societyId, otherSocietyId, admin],
      );
      const unit = (number: string) =>
        units.rows.find((row) => row.number === number)!.id;
      const guardRoster = (
        await client.query<{ id: string }>(
          `insert into public.guard_roster (society_id, name, created_by)
           values ($1, 'Synthetic guard', $2), ($3, 'Other guard', $2) returning id`,
          [societyId, admin, otherSocietyId],
        )
      ).rows.map(({ id }) => id);
      // Two visitors checked in today and still inside, one checked out today, one inside since an
      // earlier day, plus another society's visitor that must never be counted.
      await client.query(
        `insert into public.visitor_entries
           (society_id, unit_id, visitor_name, purpose, handled_by_guard_id, status,
            checked_in_at, checked_out_at, created_by, created_at, updated_at)
         values ($1, $2, 'Inside today', 'guest', $4, 'checked_in', now(), null, $5, now(), now()),
                ($1, $2, 'Inside today too', 'guest', $4, 'checked_in', now(), null, $5, now(), now()),
                ($1, $3, 'Left today', 'guest', $4, 'checked_out', now(), now(), $5, now(), now()),
                ($1, $3, 'Inside since earlier', 'guest', $4, 'checked_in',
                 now() - interval '3 days', null, $5, now() - interval '3 days', now() - interval '3 days'),
                ($6, $7, 'Other society', 'guest', $8, 'checked_in', now(), null, $5, now(), now())`,
        [
          societyId,
          unit('A-1'),
          unit('A-2'),
          guardRoster[0],
          users.guard,
          otherSocietyId,
          unit('Z-1'),
          guardRoster[1],
        ],
      );
      // Overdue: two bills on A-1 count as one unit; A-2's bill is paid; Z-1 belongs elsewhere.
      await client.query(
        `insert into public.billing_bills
           (society_id, unit_id, title, period_start, due_date, total_paise, paid_paise, created_by)
         values ($1, $2, 'Old dues', '2025-01-01', '2025-01-31', 10000, 0, $5),
                ($1, $2, 'Older dues', '2024-12-01', '2024-12-31', 5000, 1000, $5),
                ($1, $3, 'Paid', '2025-01-01', '2025-01-31', 7000, 7000, $5),
                ($4, $6, 'Other society', '2025-01-01', '2025-01-31', 9000, 0, $5)`,
        [
          societyId,
          unit('A-1'),
          unit('A-2'),
          otherSocietyId,
          admin,
          unit('Z-1'),
        ],
      );
      await client.query(
        `insert into public.billing_payments
           (society_id, unit_id, amount_paise, mode, source, reference, paid_on,
            status, submitted_by, client_request_id, created_by)
         values ($1, $2, 5000, 'upi', 'resident_submitted', 'ADMINHOME01', current_date,
                 'awaiting_confirmation', $3, gen_random_uuid(), $3)`,
        [societyId, unit('A-1'), users.resident],
      );
      meetingId = (
        await client.query<{ id: string }>(
          `insert into public.meetings
             (society_id, meeting_type, status, title, starts_at, ends_at, venue,
              client_request_id, created_by, scheduled_at, notice_required_days,
              notice_given_days, quorum_percent)
           values ($1, 'agm', 'scheduled', 'Annual meeting', now() + interval '3 days',
                   now() + interval '3 days 2 hours', 'Clubhouse', 'admin-home-meeting', $2,
                   now() - interval '1 hour', 14, 14, 25)
           returning id`,
          [societyId, admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.notices (society_id, title, body, client_request_id, created_by)
         values ($1, 'Water shutdown', 'Synthetic notice body', gen_random_uuid(), $2)`,
        [societyId, admin],
      );
      await client.query(
        `insert into public.audit_logs
           (society_id, actor_id, actor_role, action, entity_type, before, after, reason, created_at)
         values ($1, $2, 'admin', 'billing.payment.confirm', 'billing_payment',
                 '{"secret":"before"}', '{"secret":"after"}', 'Synthetic reason', now() - interval '1 hour'),
                ($1, $3, 'committee', 'notice.publish', 'notice', null, null, null, now() - interval '2 hours'),
                ($1, $2, 'admin', 'staff.note.delete', 'staff_note', null, null, null, now()),
                ($1, $2, 'developer', 'developer.modules.toggle', 'module_config', null, null, null, now()),
                ($1, null, 'system', 'notice.publish', 'notice', null, null, null, now()),
                ($1, $2, 'admin', 'members.approve', 'membership', null, null, null, now() - interval '8 days'),
                ($4, $2, 'admin', 'members.approve', 'membership', null, null, null, now())`,
        [societyId, admin, users.committee, otherSocietyId],
      );
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function call<T>(
    fn: 'admin_home_get' | 'admin_home_admin_actions',
    userId: string,
    targetSociety = societyId,
  ) {
    return database.asRole(
      'authenticated',
      { sub: userId },
      async (client) =>
        (
          await client.query<{ result: T }>(
            `select public.${fn}($1) as result`,
            [targetSociety],
          )
        ).rows[0]!.result,
    );
  }

  it('gives an admin every section with counts that follow each module rule', async () => {
    const home = await call<Home>('admin_home_get', users.admin!);
    expect(() => adminHomeSnapshotSchema.parse(home)).not.toThrow();
    expect(home.visitors).toEqual({ status: 'ok', today: 3, inside: 3 });
    expect(home.requests).toEqual({ status: 'ok', open: 0, overdue: 0 });
    expect(home.billing).toMatchObject({
      status: 'ok',
      overdue_units: 1,
      pending_payments: 1,
      outstanding_paise: '14000',
    });
    expect(home.amc).toEqual({ status: 'ok', urgent: 0 });
    expect(home.stock).toEqual({ status: 'ok', low: 0, out: 0 });
    expect(home.tenancy).toEqual({ status: 'ok', pending: 0 });
    expect(home.registrations).toEqual({ status: 'ok', pending: 1 });
    expect(home.meeting).toMatchObject({
      status: 'ok',
      next: { id: meetingId, title: 'Annual meeting', venue: 'Clubhouse' },
    });
    const activity = adminHomeSnapshotSchema.parse(home).activity;
    if (activity?.status !== 'ok') throw new Error('Activity should load.');
    const items = activity.items;
    expect(items.map(({ kind }) => kind).sort()).toEqual([
      'meeting_scheduled',
      'notice_published',
      'registration',
    ]);
    expect(items.find(({ kind }) => kind === 'registration')!.title).toBeNull();
    expect(JSON.stringify(home)).not.toContain('Synthetic');
  });

  it('lets the committee see the dashboard but not the admin actions feed', async () => {
    const home = await call<Home>('admin_home_get', users.committee!);
    expect(home.visitors).toEqual({ status: 'ok', today: 3, inside: 3 });
    await expect(
      call('admin_home_admin_actions', users.committee!),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('denies housekeeping supervisors, residents, guards and other societies', async () => {
    for (const user of [users.supervisor!, users.resident!, users.guard!]) {
      expect(await dbError(call('admin_home_get', user))).toMatchObject({
        code: '42501',
      });
    }
    expect(
      await dbError(call('admin_home_admin_actions', users.supervisor!)),
    ).toMatchObject({ code: '42501' });
    expect(
      await dbError(call('admin_home_get', users.committee!, otherSocietyId)),
    ).toMatchObject({ code: '42501' });
  });

  it('hides the section of a module that is switched off', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled = false
         where society_id = $1 and module_key = 'visitor'`,
        [societyId],
      ),
    );
    try {
      const home = await call<Home>('admin_home_get', users.admin!);
      expect(home.visitors).toBeNull();
      expect(home.billing).not.toBeNull();
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = true
           where society_id = $1 and module_key = 'visitor'`,
          [societyId],
        ),
      );
    }
  });

  it('lists only recent allow-listed admin and committee actions without details', async () => {
    const actions = await call<unknown[]>(
      'admin_home_admin_actions',
      users.admin!,
    );
    expect(() => adminHomeActionsSchema.parse(actions)).not.toThrow();
    expect(actions).toEqual([
      expect.objectContaining({
        action: 'billing.payment.confirm',
        actor_role: 'admin',
      }),
      expect.objectContaining({
        action: 'notice.publish',
        actor_role: 'committee',
      }),
    ]);
    for (const entry of actions) {
      expect(Object.keys(entry as object).sort()).toEqual([
        'action',
        'actor_role',
        'created_at',
        'id',
      ]);
    }
  });
});
