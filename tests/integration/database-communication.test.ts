// Verify P53 notice drafts, scheduling and planning fields, the contact log and the dashboard.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

type User = 'admin' | 'committee' | 'owner' | 'outsider';

type NoticeJson = {
  id: string;
  status: string;
  planning_status: string;
  scheduled_for: string | null;
  published_at: string | null;
  updated_at: string;
  plan: Record<string, unknown> | null;
};

type ContactJson = {
  id: string;
  status: string;
  closed_at: string | null;
  days_open: number;
  unit_label: string | null;
  handled_by_name: string;
  follow_up_overdue: boolean;
  updated_at: string;
};

type Query = (
  sql: string,
  params: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;

describe.skipIf(!hasDatabase)('database communication additions (P53)', () => {
  it('plans, schedules and posts notices; logs contacts; reports reconciled figures', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = {} as Record<User, string>;
        for (const name of [
          'admin',
          'committee',
          'owner',
          'outsider',
        ] as const) {
          users[name] = await newAuthUser(client, `p53-${name}@example.test`);
          await client.query(
            `insert into public.profiles (id, email, full_name) values ($1, $2, $3)`,
            [users[name], `p53-${name}@example.test`, `P53 ${name}`],
          );
        }
        const [societyId, otherSocietyId] = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P53 Society', $1), ('Other P53 Society', $2) returning id`,
            [users.admin, users.outsider],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           select society_id, module_key, true, '{}'::jsonb
           from unnest($1::uuid[]) as society_id
           cross join unnest(ARRAY['core', 'notice', 'service_request']) as module_key
           on conflict (society_id, module_key) do update set enabled = true`,
          [[societyId, otherSocietyId]],
        );
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active'),
                  ($1, $3, ARRAY['committee']::text[], 'active'),
                  ($1, $4, ARRAY['resident']::text[], 'active'),
                  ($5, $6, ARRAY['admin']::text[], 'active')`,
          [
            societyId,
            users.admin,
            users.committee,
            users.owner,
            otherSocietyId,
            users.outsider,
          ],
        );
        const block = (
          await client.query<{ id: string }>(
            `insert into public.blocks (society_id, name, created_by)
             values ($1, 'A', $2) returning id`,
            [societyId, users.admin],
          )
        ).rows[0]!.id;
        const unit = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, block_id, number, created_by)
             values ($1, $2, '101', $3) returning id`,
            [societyId, block, users.admin],
          )
        ).rows[0]!.id;
        const otherUnit = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, number, created_by)
             values ($1, '9', $2) returning id`,
            [otherSocietyId, users.outsider],
          )
        ).rows[0]!.id;
        const category = (
          await client.query<{ id: string }>(
            `insert into public.service_request_categories (society_id, name)
             values ($1, 'P53 test category') returning id`,
            [societyId],
          )
        ).rows[0]!.id;
        // One resolved after six minutes, one open, one rejected (left out of figures).
        const [resolvedRequest] = (
          await client.query<{ id: string }>(
            `insert into public.service_requests (
               society_id, category_id, location_type, description, created_by,
               client_request_id, status, created_at, resolved_at
             )
             values
               ($1, $2, 'common_area', 'Leak in lobby', $3, gen_random_uuid(),
                'resolved', now() - interval '6 minutes', now()),
               ($1, $2, 'common_area', 'Tap dripping', $3, gen_random_uuid(),
                'open', now(), null)
             returning id`,
            [societyId, category, users.owner],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.service_requests (
             society_id, category_id, location_type, description, created_by,
             client_request_id, status, reject_reason
           )
           values ($1, $2, 'common_area', 'Not ours', $3, gen_random_uuid(),
             'rejected', 'Outside society scope')`,
          [societyId, category, users.owner],
        );
        const today = (
          await client.query<{ today: string }>(
            `select ((now() at time zone 'Asia/Kolkata')::date)::text as today`,
          )
        ).rows[0]!.today;
        const tomorrow = (
          await client.query<{ day: string }>(
            `select ((now() at time zone 'Asia/Kolkata')::date + 1)::text as day`,
          )
        ).rows[0]!.day;
        return {
          users,
          societyId: societyId!,
          otherSocietyId: otherSocietyId!,
          unit,
          otherUnit,
          resolvedRequest: resolvedRequest!,
          today,
          tomorrow,
        };
      });

      const asUser = <T>(user: User, run: (query: Query) => Promise<T>) =>
        database.asRole(
          'authenticated',
          { sub: fixture.users[user] },
          (client) => run((sql, params) => client.query(sql, params)),
          { commit: true },
        );
      const rpc = async <T>(user: User, sql: string, params: unknown[]) =>
        asUser(
          user,
          async (query) => (await query(sql, params)).rows[0]!.result as T,
        );
      const saveDraft = (
        user: User,
        input: {
          noticeId?: string;
          title: string;
          scheduledFor?: string | null;
          postMode?: 'draft' | 'schedule';
          expectedUpdatedAt?: string | null;
          clientRequestId?: string;
        },
      ) =>
        rpc<NoticeJson>(
          user,
          `select public.notice_draft_save(
             $1, $2, $3, 'Synthetic notice body', 'all', ARRAY[]::uuid[], false,
             null, null, $4::timestamptz, $5, $6, 'p53-draft', $7
           ) as result`,
          [
            fixture.societyId,
            input.noticeId ?? null,
            input.title,
            input.scheduledFor ?? null,
            input.expectedUpdatedAt ?? null,
            input.clientRequestId ?? crypto.randomUUID(),
            input.postMode ?? (input.scheduledFor ? 'schedule' : 'draft'),
          ],
        );
      const list = (user: User, view: string) =>
        rpc<NoticeJson[]>(user, `select public.notice_list($1, $2) as result`, [
          fixture.societyId,
          view,
        ]);
      const notificationCount = (noticeId: string) =>
        database.asSuperuser(
          async (client) =>
            (
              await client.query<{ count: number }>(
                `select count(*)::integer as count from public.notifications
                 where entity_type = 'notice' and entity_id = $1`,
                [noticeId],
              )
            ).rows[0]!.count,
        );

      // P53.1: drafts stay unpublished, hidden from residents and send nothing.
      const draftRequest = crypto.randomUUID();
      const draft = await saveDraft('committee', {
        title: 'Diwali decorations',
        clientRequestId: draftRequest,
      });
      expect(draft).toMatchObject({
        status: 'draft',
        planning_status: 'draft',
        published_at: null,
        plan: null,
      });
      expect(
        (
          await saveDraft('committee', {
            title: 'Diwali decorations',
            clientRequestId: draftRequest,
          })
        ).id,
      ).toBe(draft.id);
      expect(await notificationCount(draft.id)).toBe(0);
      expect(await list('owner', 'current')).toEqual([]);
      expect((await dbError(list('owner', 'planned'))).code).toBe('42501');
      expect(
        (
          await dbError(
            rpc('owner', `select public.notice_get($1, $2) as result`, [
              fixture.societyId,
              draft.id,
            ]),
          )
        ).code,
      ).toBe('P0002');
      const residentSelect = await asUser(
        'owner',
        async (query) =>
          (await query(`select id from public.notices`, [])).rows,
      );
      expect(residentSelect).toEqual([]);

      // A schedule requires a future instant; P11 edits apply to posted notices only.
      expect(
        (
          await dbError(
            saveDraft('committee', {
              noticeId: draft.id,
              title: 'Diwali decorations',
              scheduledFor: fixture.today,
              expectedUpdatedAt: draft.updated_at,
            }),
          )
        ).code,
      ).toBe('22023');
      expect(
        (
          await dbError(
            saveDraft('committee', {
              title: 'Incomplete schedule',
              postMode: 'schedule',
            }),
          )
        ).code,
      ).toBe('22023');
      expect(
        (
          await dbError(
            rpc(
              'admin',
              `select public.notice_update($1, $2, 'T', 'B', 'all', ARRAY[]::uuid[],
                 null, null, $3, 'p53') as result`,
              [fixture.societyId, draft.id, draft.updated_at],
            ),
          )
        ).code,
      ).toBe('23505');

      const scheduled = await saveDraft('committee', {
        noticeId: draft.id,
        title: 'Diwali decorations',
        scheduledFor: `${fixture.tomorrow}T10:30:00+05:30`,
        expectedUpdatedAt: draft.updated_at,
      });
      expect(scheduled).toMatchObject({
        status: 'scheduled',
        planning_status: 'scheduled',
      });
      expect(Date.parse(scheduled.scheduled_for!)).toBe(
        Date.parse(`${fixture.tomorrow}T10:30:00+05:30`),
      );

      // Committee members change only their own notices; admins can change any.
      const adminDraft = await saveDraft('admin', { title: 'Lift audit' });
      expect(
        (
          await dbError(
            saveDraft('committee', {
              noticeId: adminDraft.id,
              title: 'Lift audit edited',
              expectedUpdatedAt: adminDraft.updated_at,
            }),
          )
        ).code,
      ).toBe('42501');

      // Planning fields are manager-only and never selectable directly.
      const planned = await rpc<NoticeJson>(
        'admin',
        `select public.notice_plan_save($1, $2, 'Secretary', 'Lobby board', 'high',
           'Print copies', $3::date, 'p53-plan') as result`,
        [fixture.societyId, draft.id, fixture.tomorrow],
      );
      expect(planned.plan).toMatchObject({
        prepared_by: 'Secretary',
        display_location: 'Lobby board',
        priority: 'high',
        next_action: 'Print copies',
        next_action_on: fixture.tomorrow,
      });
      expect(
        (
          await dbError(
            rpc(
              'committee',
              `select public.notice_plan_save($1, $2, 'Secretary', 'Lobby', 'high', null, null, 'deny') as result`,
              [fixture.societyId, draft.id],
            ),
          )
        ).code,
      ).toBe('42501');

      // Committee can propose on another author's notice; only admin review changes the official plan.
      const propose = () =>
        rpc<{ id: string; status: string }>(
          'committee',
          `select public.notice_plan_proposal_save($1, $2, '{"display_location":"Garden board","next_action":"Print copies"}', $3, 'proposal') as result`,
          [fixture.societyId, adminDraft.id, crypto.randomUUID()],
        );
      const review = (id: string, accept: boolean, user: User = 'admin') =>
        rpc<{ status: string }>(
          user,
          `select public.notice_plan_proposal_review($1, $2, $3, 'review') as result`,
          [fixture.societyId, id, accept],
        );
      const official = () =>
        rpc<NoticeJson>('admin', `select public.notice_get($1, $2) as result`, [
          fixture.societyId,
          adminDraft.id,
        ]);
      const rejected = await propose();
      expect((await official()).plan).toBeNull();
      expect((await dbError(review(rejected.id, true, 'committee'))).code).toBe(
        '42501',
      );
      expect((await review(rejected.id, false)).status).toBe('rejected');
      expect((await official()).plan).toBeNull();
      const accepted = await propose();
      expect((await review(accepted.id, true)).status).toBe('accepted');
      expect((await review(accepted.id, true)).status).toBe('accepted');
      expect((await dbError(review(accepted.id, false))).code).toBe('23505');
      expect((await official()).plan).toMatchObject({
        display_location: 'Garden board',
      });
      const staleProposal = await propose();
      await rpc(
        'admin',
        `select public.notice_plan_save($1, $2, null, 'Lobby', null, null, null, 'changed') as result`,
        [fixture.societyId, adminDraft.id],
      );
      expect((await dbError(review(staleProposal.id, true))).code).toBe(
        '23505',
      );
      expect((await official()).plan).toMatchObject({
        display_location: 'Lobby',
      });
      expect(
        await rpc<unknown[]>(
          'committee',
          `select public.notice_plan_proposals_get($1, $2) as result`,
          [fixture.societyId, adminDraft.id],
        ),
      ).toHaveLength(3);
      expect(
        (
          await dbError(
            rpc(
              'owner',
              `select public.notice_plan_proposals_get($1, $2) as result`,
              [fixture.societyId, adminDraft.id],
            ),
          )
        ).code,
      ).toBe('42501');
      for (const user of ['committee', 'owner'] as const) {
        expect(
          (
            await dbError(
              asUser(user, (query) =>
                query(`select * from public.notice_plans`, []),
              ),
            )
          ).code,
        ).toBe('42501');
      }
      expect(
        (await list('admin', 'planned')).map(({ id }) => id).sort(),
      ).toEqual([draft.id, adminDraft.id].sort());

      // Reads publish due schedules automatically; the daily job sends alerts once, never for expired schedules.
      const expiring = await saveDraft('admin', {
        title: 'Expired schedule',
        scheduledFor: `${fixture.tomorrow}T10:30:00+05:30`,
      });
      await database.asSuperuser(async (client) => {
        await client.query(
          `update public.notices set scheduled_for = created_at + interval '0.5 milliseconds'
           where id = any($1::uuid[])`,
          [[draft.id, expiring.id]],
        );
        await client.query(
          `update public.notices set expires_at = created_at + interval '1 millisecond'
           where id = $1`,
          [expiring.id],
        );
      });
      expect((await list('owner', 'current')).map(({ id }) => id)).toEqual([
        draft.id,
      ]);
      expect(await notificationCount(draft.id)).toBe(0);
      const reconciled = await rpc<NoticeJson>(
        'admin',
        `select public.notice_get($1, $2) as result`,
        [fixture.societyId, draft.id],
      );
      expect(reconciled.status).toBe('published');
      expect(reconciled.published_at).toBe(reconciled.scheduled_for);
      expect(
        await database.asSuperuser(
          async (client) =>
            (
              await client.query(
                `select count(*)::int as count from public.audit_logs where action = 'notice.publish' and entity_id = $1`,
                [draft.id],
              )
            ).rows[0]!.count,
        ),
      ).toBe(1);
      expect(
        (
          await dbError(
            database.asRole(
              'authenticated',
              { sub: fixture.users.admin },
              (c) =>
                c.query(
                  `select public.notice_scheduled_publish_run($1, $2::date, 'x')`,
                  [fixture.societyId, fixture.today],
                ),
            ),
          )
        ).code,
      ).toBe('42501');
      const published = await database.asRole(
        'service_role',
        null,
        async (client) =>
          (
            await client.query<{ result: number }>(
              `select public.notice_scheduled_publish_run($1, $2::date, 'p53-run') as result`,
              [fixture.societyId, fixture.today],
            )
          ).rows[0]!.result,
        { commit: true },
      );
      expect(published).toBe(1);
      expect(await notificationCount(draft.id)).toBe(1);
      expect((await list('owner', 'current')).map(({ id }) => id)).toEqual([
        draft.id,
      ]);
      const expired = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{
              status: string;
              scheduled_for: string | null;
            }>(
              `select status, scheduled_for from public.notices where id = $1`,
              [expiring.id],
            )
          ).rows[0]!,
      );
      expect(expired.status).toBe('published');
      expect(expired.scheduled_for).not.toBeNull();
      expect(await notificationCount(expiring.id)).toBe(0);
      expect(
        await database.asRole(
          'service_role',
          null,
          async (client) =>
            (
              await client.query(
                `select public.notice_scheduled_publish_run($1, $2::date, 'again') as result`,
                [fixture.societyId, fixture.today],
              )
            ).rows[0]!.result,
          { commit: true },
        ),
      ).toBe(0);
      expect(await notificationCount(draft.id)).toBe(1);

      // Publish now, then withdraw: the notice moves to the archive as removed.
      const posted = await rpc<NoticeJson>(
        'admin',
        `select public.notice_draft_publish($1, $2, $3, 'p53-publish') as result`,
        [fixture.societyId, adminDraft.id, adminDraft.updated_at],
      );
      expect(posted).toMatchObject({
        status: 'published',
        planning_status: 'posted',
      });
      expect(await notificationCount(adminDraft.id)).toBe(1);
      const removed = await rpc<NoticeJson>(
        'admin',
        `select public.notice_withdraw($1, $2, 'p53-withdraw') as result`,
        [fixture.societyId, adminDraft.id],
      );
      expect(removed.planning_status).toBe('removed');
      expect(
        (await list('admin', 'archive')).map(({ id }) => id).sort(),
      ).toEqual([adminDraft.id, expiring.id].sort());

      // P53.2: contact log is admin/committee only, society-scoped and audited.
      const saveContact = (
        user: User,
        values: Record<string, unknown>,
        options: { logId?: string; expectedUpdatedAt?: string } = {},
      ) =>
        rpc<ContactJson>(
          user,
          `select public.member_contact_log_save($1, $2, $3::jsonb, $4, $5, 'p53-contact') as result`,
          [
            fixture.societyId,
            options.logId ?? null,
            JSON.stringify(values),
            options.expectedUpdatedAt ?? null,
            crypto.randomUUID(),
          ],
        );
      const contactValues = {
        contact_on: fixture.today,
        unit_id: fixture.unit,
        contact_type: 'complaint',
        channel: 'phone',
        direction: 'incoming',
        summary: 'Noise after 11 pm',
        handled_by: fixture.users.committee,
        follow_up_on: fixture.today,
        status: 'follow_up',
        service_request_id: fixture.resolvedRequest,
      };
      expect(
        (await dbError(saveContact('committee', contactValues))).code,
      ).toBe('42501');
      const contact = await saveContact('admin', contactValues);
      expect(contact).toMatchObject({
        status: 'follow_up',
        unit_label: 'A-101',
        handled_by_name: 'P53 committee',
        days_open: 0,
        follow_up_overdue: false,
        closed_at: null,
      });
      expect(
        (
          await rpc<{ logs: ContactJson[] }>(
            'committee',
            `select public.member_contact_logs_get($1) as result`,
            [fixture.societyId],
          )
        ).logs.map(({ id }) => id),
      ).toContain(contact.id);
      expect(
        (
          await dbError(
            saveContact(
              'committee',
              { ...contactValues, summary: 'Edited' },
              { logId: contact.id, expectedUpdatedAt: contact.updated_at },
            ),
          )
        ).code,
      ).toBe('42501');
      for (const values of [
        { ...contactValues, unit_id: fixture.otherUnit },
        { ...contactValues, handled_by: fixture.users.owner },
        { ...contactValues, status: 'follow_up', follow_up_on: null },
        { ...contactValues, channel: 'fax' },
      ]) {
        expect((await dbError(saveContact('admin', values))).code).toBe(
          '22023',
        );
      }
      expect((await dbError(saveContact('owner', contactValues))).code).toBe(
        '42501',
      );
      expect(
        (
          await dbError(
            rpc(
              'owner',
              `select public.member_contact_logs_get($1) as result`,
              [fixture.societyId],
            ),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await dbError(
            asUser('admin', (query) =>
              query(`select * from public.member_contact_logs`, []),
            ),
          )
        ).code,
      ).toBe('42501');
      const closed = await saveContact(
        'admin',
        { ...contactValues, status: 'closed' },
        { logId: contact.id, expectedUpdatedAt: contact.updated_at },
      );
      expect(closed.closed_at).not.toBeNull();
      expect(
        (
          await dbError(
            saveContact('admin', contactValues, {
              logId: contact.id,
              expectedUpdatedAt: contact.updated_at,
            }),
          )
        ).code,
      ).toBe('23505');
      const listing = await rpc<{
        logs: ContactJson[];
        handlers: { id: string }[];
        units: { id: string; label: string }[];
        requests: { id: string }[];
      }>(
        'admin',
        `select public.member_contact_logs_get($1, 'closed') as result`,
        [fixture.societyId],
      );
      expect(listing.logs.map(({ id }) => id)).toEqual([contact.id]);
      expect(listing.handlers.map(({ id }) => id).sort()).toEqual(
        [fixture.users.admin, fixture.users.committee].sort(),
      );
      expect(listing.units).toEqual([{ id: fixture.unit, label: 'A-101' }]);
      expect(listing.requests).toHaveLength(2);
      const audits = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{
              action: string;
              after: Record<string, unknown>;
            }>(
              `select action, "after" from public.audit_logs
               where entity_type = 'member_contact_log' order by id`,
            )
          ).rows,
      );
      expect(audits.map(({ action }) => action)).toEqual([
        'core.contact_log.create',
        'core.contact_log.update',
      ]);
      expect(JSON.stringify(audits)).not.toContain('Noise after 11 pm');

      // P53.3: dashboard counts only stored records; modules that are off return null.
      const open = await saveContact('admin', {
        ...contactValues,
        status: 'open',
        follow_up_on: null,
        service_request_id: null,
      });
      expect(open.status).toBe('open');
      const dashboard = await rpc<Record<string, unknown>>(
        'committee',
        `select public.communication_dashboard_get($1, $2::date) as result`,
        [fixture.societyId, fixture.today],
      );
      expect(dashboard).toMatchObject({
        month: fixture.today.slice(0, 7),
        notices: { posted: 3, removed: 2, planned_now: 0 },
        meetings: null,
        events: null,
        sos: null,
        requests: { received: 2, resolved: 1, avg_days: 0 },
        contact_log: {
          logged: 2,
          closed: 1,
          open_now: 1,
          follow_up_overdue: 0,
        },
      });
      expect(
        (
          await dbError(
            rpc(
              'owner',
              `select public.communication_dashboard_get($1, $2::date) as result`,
              [fixture.societyId, fixture.today],
            ),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await dbError(
            rpc(
              'admin',
              `select public.communication_dashboard_get($1, $2::date) as result`,
              [fixture.societyId, fixture.tomorrow],
            ),
          )
        ).code,
      ).toBe('22023');

      // Retention deletes entries closed more than three years ago, and only those.
      await database.asSuperuser(async (client) => {
        await client.query('set session_replication_role = replica');
        await client.query(
          `update public.member_contact_logs
           set closed_at = now() - interval '3 years 2 days'
           where id = $1`,
          [contact.id],
        );
      });
      const retention = await database.asRole(
        'service_role',
        null,
        async (client) =>
          (
            await client.query<{ result: Record<string, number> }>(
              `select public.communication_retention_run($1::date, 'p53-retention') as result`,
              [fixture.today],
            )
          ).rows[0]!.result,
        { commit: true },
      );
      expect(retention).toEqual({ contactLogsDeleted: 1 });
      const remaining = await database.asSuperuser(async (client) =>
        (
          await client.query<{ id: string }>(
            `select id from public.member_contact_logs order by id`,
          )
        ).rows.map(({ id }) => id),
      );
      expect(remaining).toEqual([open.id]);
    } finally {
      await database.drop();
    }
  });

  it('does not resend already-published scheduled alerts when upgrading', async () => {
    const database = await createTestDatabase({
      throughMigration: '20261124190000',
    });
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const admin = await newAuthUser(client, 'legacy-admin@example.test');
        const resident = await newAuthUser(
          client,
          'legacy-resident@example.test',
        );
        await client.query(
          `insert into public.profiles(id,email,full_name)
          values($1,'legacy-admin@example.test','Legacy admin'),($2,'legacy-resident@example.test','Legacy resident')`,
          [admin, resident],
        );
        const society = (
          await client.query<{ id: string }>(
            `insert into public.societies(name,created_by)
          values('Legacy society',$1) returning id`,
            [admin],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled,settings)
          values($1,'notice',true,'{}') on conflict(society_id,module_key) do update set enabled=true`,
          [society],
        );
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
          values($1,$2,ARRAY['admin'],'active'),($1,$3,ARRAY['resident'],'active')`,
          [society, admin, resident],
        );
        return { admin, society };
      });
      const id = await database.asRole(
        'authenticated',
        { sub: fixture.admin },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.notice_draft_save(
          $1,null,'Legacy schedule','Synthetic body','all',ARRAY[]::uuid[],false,null,null,
          (now() at time zone 'Asia/Kolkata')::date+1,null,gen_random_uuid(),'legacy-create')->>'id' as id`,
              [fixture.society],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      await database.asSuperuser((client) =>
        client.query(
          `update public.notices
        set scheduled_for=(now() at time zone 'Asia/Kolkata')::date where id=$1`,
          [id],
        ),
      );
      const run = () =>
        database.asRole(
          'service_role',
          null,
          async (client) =>
            (
              await client.query<{ result: number }>(
                `select public.notice_scheduled_publish_run(
          $1,(now() at time zone 'Asia/Kolkata')::date,'legacy-run') as result`,
                [fixture.society],
              )
            ).rows[0]!.result,
          { commit: true },
        );
      expect(await run()).toBe(1);
      const count = () =>
        database.asSuperuser(
          async (client) =>
            (
              await client.query<{ count: number }>(
                `select count(*)::int as count from public.notifications where entity_id=$1`,
                [id],
              )
            ).rows[0]!.count,
        );
      expect(await count()).toBe(1);
      await database.asDeployment((client) =>
        client.query(
          readFileSync(
            new URL(
              '../../supabase/migrations/20261124220000_notice_timed_scheduling.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        ),
      );
      expect(await run()).toBe(0);
      expect(await count()).toBe(1);
    } finally {
      await database.drop();
    }
  });
});
