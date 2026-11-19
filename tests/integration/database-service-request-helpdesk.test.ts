// Verify P49 helpdesk rules: priority targets, holds, feedback, escalation
// responses, vendor links, off-app logging, the report and daily checks.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Row = Record<string, unknown>;
type Role = 'admin' | 'committee' | 'resident' | 'hk_supervisor' | 'guard';

const HELPDESK_MIGRATION = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261124120000_service_request_helpdesk.sql',
);
const indiaToday = `(now() at time zone 'Asia/Kolkata')::date`;

describe.skipIf(!hasDatabase)('database service request helpdesk', () => {
  let database: TestDatabase;
  let founderId: string;
  let societyId: string;
  let otherSocietyId: string;
  let categoryId: string;
  let unitId: string;
  let adminId: string;
  let committeeId: string;
  let residentId: string;
  let neighbourId: string;
  let supervisorId: string;
  let guardId: string;
  let counter = 0;

  const nextId = () => {
    counter += 1;
    return `00000000-0000-4000-9200-${String(counter).padStart(12, '0')}`;
  };

  async function addMember(society: string, role: Role, label: string) {
    return database.asSuperuser(async (client) => {
      const email = `helpdesk-${label}@example.test`;
      const userId = await newAuthUser(client, email);
      await client.query(
        `insert into public.profiles (id, email, full_name) values ($1, $2, $3)`,
        [userId, email, `Synthetic ${label}`],
      );
      await client.query(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, ARRAY[$3]::text[], 'active')`,
        [society, userId, role],
      );
      return userId;
    });
  }

  async function createSociety(name: string) {
    return database.asSuperuser(async (client) => {
      const id = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by) values ($1, $2)
           returning id`,
          [name, founderId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'),
                ($1, 'service_request', true, '{"auto_close_days":3}')`,
        [id],
      );
      return id;
    });
  }

  function call<T = Row>(userId: string, sql: string, params: unknown[]) {
    return database.asRole(
      'authenticated',
      { sub: userId },
      async (client) =>
        (await client.query<{ result: T }>(sql, params)).rows[0]!.result,
      { commit: true },
    );
  }

  function create(
    userId: string,
    priority: string,
    location: 'unit' | 'common_area' = 'unit',
  ) {
    return call<Row>(
      userId,
      `select to_jsonb(public.request_create(
         $1, $2, $3, $4, 'Synthetic leaking tap', $5, '[]'::jsonb, $6::uuid,
         'helpdesk-integration'
       )) as result`,
      [
        societyId,
        categoryId,
        location,
        location === 'unit' ? unitId : null,
        priority,
        nextId(),
      ],
    );
  }

  function superuser<T extends Row = Row>(sql: string, params: unknown[] = []) {
    return database.asSuperuser(
      async (client) => (await client.query<T>(sql, params)).rows,
    );
  }

  function getAs(userId: string, requestId: string) {
    return call<{ request: Row; escalations: Row[] }>(
      userId,
      `select public.request_get($1, $2) as result`,
      [societyId, requestId],
    );
  }

  function setTargets(values: (number | null)[]) {
    return call(
      adminId,
      `select public.request_category_targets_save(
         $1, $2, $3, $4, $5, $6, 'helpdesk-integration'
       ) as result`,
      [societyId, categoryId, ...values],
    );
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    founderId = await database.asSuperuser(async (client) => {
      const id = await newAuthUser(client, 'helpdesk-founder@example.test');
      await client.query(
        `insert into public.profiles (id, email, full_name)
         values ($1, 'helpdesk-founder@example.test', 'Synthetic founder')`,
        [id],
      );
      return id;
    });
    societyId = await createSociety('Helpdesk Society');
    otherSocietyId = await createSociety('Other Helpdesk Society');
    adminId = await addMember(societyId, 'admin', 'admin');
    committeeId = await addMember(societyId, 'committee', 'committee');
    residentId = await addMember(societyId, 'resident', 'resident');
    neighbourId = await addMember(societyId, 'resident', 'neighbour');
    supervisorId = await addMember(societyId, 'hk_supervisor', 'supervisor');
    guardId = await addMember(societyId, 'guard', 'guard');
    await addMember(otherSocietyId, 'admin', 'other-admin');
    const fixture = await database.asSuperuser(async (client) => {
      const category = await client.query<{ id: string }>(
        `select id from public.service_request_categories
         where society_id = $1 and name = 'Plumbing'`,
        [societyId],
      );
      const unit = await client.query<{ id: string }>(
        `insert into public.units (society_id, number, created_by, updated_by)
         values ($1, 'N-101', $2, $2) returning id`,
        [societyId, adminId],
      );
      await client.query(
        `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
         select $1, $2, member.id, 'owner', true, 'active', $4
         from public.memberships as member
         where member.society_id = $1 and member.user_id = $3`,
        [societyId, unit.rows[0]!.id, residentId, adminId],
      );
      return { categoryId: category.rows[0]!.id, unitId: unit.rows[0]!.id };
    });
    categoryId = fixture.categoryId;
    unitId = fixture.unitId;
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('maps old priorities, seeds targets and keeps existing societies per category', async () => {
    const upgrade = await createTestDatabase({
      throughMigration: '20261124110000',
    });
    try {
      const ids = await upgrade.asSuperuser(async (client) => {
        const owner = await newAuthUser(client, 'upgrade-owner@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'upgrade-owner@example.test', 'Upgrade owner')`,
          [owner],
        );
        const society = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Upgrade Society', $1) returning id`,
            [owner],
          )
        ).rows[0]!.id;
        const category = (
          await client.query<{ id: string }>(
            `update public.service_request_categories set sla_hours = 50
             where society_id = $1 and name = 'Plumbing' returning id`,
            [society],
          )
        ).rows[0]!.id;
        const requests = await client.query<{ id: string; priority: string }>(
          `insert into public.service_requests (
             society_id, created_by, category_id, location_type, description,
             priority, sla_due_at, client_request_id, updated_at
           )
           select $1, $2, $3, 'common_area', 'Synthetic', p,
             '2030-01-01T00:00:00Z', gen_random_uuid(), '2020-01-01T00:00:00Z'
           from unnest(ARRAY['urgent', 'normal']) as p
           returning id, priority`,
          [society, owner, category],
        );
        return { society, category, requests: requests.rows };
      });
      await upgrade.asDeployment((client) =>
        client.query(readFileSync(HELPDESK_MIGRATION, 'utf8')),
      );
      const after = await upgrade.asSuperuser(async (client) => ({
        requests: (
          await client.query<{
            id: string;
            priority: string;
            sla_due_at: Date;
            updated_at: Date;
          }>(
            `select id, priority, sla_due_at, updated_at
             from public.service_requests where society_id = $1`,
            [ids.society],
          )
        ).rows,
        targets: (
          await client.query<{ priority: string; target_days: number }>(
            `select priority, target_days
             from public.service_request_priority_targets
             where category_id = $1`,
            [ids.category],
          )
        ).rows,
        mode: (
          await client.query<{ committee_wait_mode: string }>(
            `select committee_wait_mode
             from public.service_request_escalation_settings
             where society_id = $1`,
            [ids.society],
          )
        ).rows[0]?.committee_wait_mode,
      }));
      const byId = new Map(after.requests.map((row) => [row.id, row]));
      for (const before of ids.requests) {
        const row = byId.get(before.id)!;
        expect(row.priority).toBe(
          before.priority === 'urgent' ? 'high' : 'medium',
        );
        expect(row.sla_due_at.toISOString()).toBe('2030-01-01T00:00:00.000Z');
        expect(row.updated_at.toISOString()).toBe('2020-01-01T00:00:00.000Z');
      }
      // 50 hours → Medium 3 days; High half of that, Critical 1, Low double.
      expect(
        Object.fromEntries(
          after.targets.map(({ priority, target_days }) => [
            priority,
            target_days,
          ]),
        ),
      ).toEqual({ critical: 1, high: 2, medium: 3, low: 6 });
      expect(after.mode).toBe('per_category');
    } finally {
      await upgrade.drop();
    }
  });

  it('sets due times from category × priority targets and recomputes on priority change', async () => {
    expect((await dbError(setTargets([1, 2, 3, null]))).code).toBe('22023');
    expect((await dbError(setTargets([0, 2, 3, 4]))).code).toBe('22023');
    expect(
      (
        await dbError(
          call(
            committeeId,
            `select public.request_category_targets_save(
               $1, $2, 1, 2, 3, 4, 'helpdesk-integration') as result`,
            [societyId, categoryId],
          ),
        )
      ).code,
    ).toBe('42501');
    await setTargets([1, 2, 5, 10]);
    const listed = await call<Row[]>(
      committeeId,
      `select public.request_category_targets_list($1) as result`,
      [societyId],
    );
    expect(listed).toHaveLength(4);

    expect((await dbError(create(residentId, 'normal'))).code).toBe('22023');
    const request = await create(residentId, 'medium');
    const due = (row: Row) =>
      (new Date(String(row.sla_due_at)).getTime() -
        new Date(String(row.created_at)).getTime()) /
      86_400_000;
    expect(due(request)).toBe(5);

    const change = (priority: string, reason: string, userId = adminId) =>
      call<Row>(
        userId,
        `select to_jsonb(public.request_priority_change(
           $1, $2, $3, $4, 'helpdesk-integration')) as result`,
        [societyId, request.id, priority, reason],
      );
    expect((await dbError(change('critical', 'x'))).code).toBe('22023');
    expect(
      (await dbError(change('critical', 'Water everywhere', residentId))).code,
    ).toBe('42501');
    const changed = await change('critical', 'Water everywhere');
    expect(changed.priority).toBe('critical');
    expect(due(changed)).toBe(1);
    const events = await superuser<{ event_type: string; note: string }>(
      `select event_type, note from public.service_request_events
       where request_id = $1 and event_type = 'priority_changed'`,
      [request.id],
    );
    expect(events[0]!.note).toContain('medium to critical');

    await setTargets([null, null, null, null]);
    const untargeted = await create(residentId, 'low');
    expect(untargeted.sla_due_at).toBeNull();
    await setTargets([1, 2, 5, 10]);
  });

  it('pauses the clock while on hold and blocks work until released', async () => {
    const request = await create(residentId, 'high');
    const hold = (reason: string | null, userId = adminId) =>
      call<Row>(
        userId,
        `select to_jsonb(public.request_hold(
           $1, $2, $3, 'helpdesk-integration')) as result`,
        [societyId, request.id, reason],
      );
    const release = () =>
      call<Row>(
        adminId,
        `select to_jsonb(public.request_release(
           $1, $2, 'helpdesk-integration')) as result`,
        [societyId, request.id],
      );
    expect((await dbError(hold('Waiting', committeeId))).code).toBe('42501');
    expect((await dbError(hold(' '))).code).toBe('22023');
    expect((await dbError(release())).code).toBe('23505');
    await hold('Waiting for spare part');
    expect((await dbError(hold('Again'))).code).toBe('23505');

    // A held Open request cannot be assigned into Assigned.
    const assign = await dbError(
      call(
        adminId,
        `select to_jsonb(public.request_assign(
           $1, $2, null, 'Synthetic plumber', '+919800000010', null,
           'helpdesk-integration')) as result`,
        [societyId, request.id],
      ),
    );
    expect(assign.code).toBe('23505');

    // Two days on hold, already past the original due time.
    await superuser(
      `update public.service_requests
       set on_hold_since = now() - interval '2 days',
           sla_due_at = now() - interval '1 hour'
       where id = $1`,
      [request.id],
    );
    const held = await getAs(residentId, String(request.id));
    expect(held.request.held_days).toBe(2);
    expect(held.request.is_overdue).toBe(false);
    const dashboard = await call<{ overdue: number }>(
      adminId,
      `select public.request_dashboard($1) as result`,
      [societyId],
    );
    expect(dashboard.overdue).toBe(0);
    const escalation = await database.asRole(
      'service_role',
      {},
      async (client) =>
        (
          await client.query<{ result: { admin: number } }>(
            `select public.request_escalation_run(
               $1, ${indiaToday}, 'helpdesk-integration') as result`,
            [societyId],
          )
        ).rows[0]!.result,
      { commit: true },
    );
    expect(escalation.admin).toBe(0);

    const released = await release();
    expect(released.on_hold_since).toBeNull();
    expect(Number(released.held_seconds)).toBeGreaterThanOrEqual(172_800);
    const extendedBy =
      new Date(String(released.sla_due_at)).getTime() - Date.now();
    // Due one hour ago, moved later by two days.
    expect(extendedBy).toBeGreaterThan(46 * 3_600_000);
    expect(extendedBy).toBeLessThan(48 * 3_600_000);

    const notified = await superuser<{ title: string }>(
      `select title from public.notifications
       where user_id = $1 and entity_id = $2 order by created_at`,
      [residentId, request.id],
    );
    expect(notified.map(({ title }) => title)).toEqual([
      'Request on hold',
      'Request released from hold',
    ]);
  });

  it('rejecting a held request ends the hold', async () => {
    const request = await create(residentId, 'low');
    await call(
      adminId,
      `select to_jsonb(public.request_hold(
         $1, $2, 'Waiting', 'helpdesk-integration')) as result`,
      [societyId, request.id],
    );
    const rejected = await call<Row>(
      adminId,
      `select to_jsonb(public.request_reject(
         $1, $2, 'Duplicate request', 'helpdesk-integration')) as result`,
      [societyId, request.id],
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.on_hold_since).toBeNull();
    expect(rejected.on_hold_reason).toBeNull();
  });

  it('records detailed feedback, hides written feedback and tracks follow-up', async () => {
    const request = await create(residentId, 'medium', 'common_area');
    await superuser(
      `update public.service_requests
       set status = 'closed', resolved_at = now(), closed_at = now()
       where id = $1`,
      [request.id],
    );
    const rate = (scores: (number | null)[]) =>
      call<Row>(
        residentId,
        `select to_jsonb(public.request_rate(
           $1, $2, 4, 'Synthetic thanks', 'helpdesk-integration',
           $3, $4, $5)) as result`,
        [societyId, request.id, ...scores],
      );
    expect((await dbError(rate([5, null, 4]))).code).toBe('22023');
    expect((await dbError(rate([6, 4, 4]))).code).toBe('22023');
    const follow = (value: string | null) =>
      call<Row>(
        adminId,
        `select to_jsonb(public.request_feedback_follow_up_set(
           $1, $2, $3, 'helpdesk-integration')) as result`,
        [societyId, request.id, value],
      );
    expect((await dbError(follow('needed'))).code).toBe('23505');
    const rated = await rate([5, 3, 4]);
    expect([rated.rating_quality, rated.rating_speed]).toEqual([5, 3]);
    expect((await dbError(follow('maybe'))).code).toBe('22023');
    expect((await follow('needed')).feedback_follow_up).toBe('needed');

    expect(
      (await getAs(residentId, String(request.id))).request.rating_comment,
    ).toBe('Synthetic thanks');
    expect(
      (await getAs(adminId, String(request.id))).request.rating_comment,
    ).toBe('Synthetic thanks');
    expect(
      (await getAs(committeeId, String(request.id))).request.rating_comment,
    ).toBeNull();
    expect(
      (await getAs(neighbourId, String(request.id))).request.rating_comment,
    ).toBeNull();
    const audit = await superuser(
      `select 1 from public.audit_logs
       where action = 'request.feedback_follow_up.set' and entity_id = $1`,
      [String(request.id)],
    );
    expect(audit).toHaveLength(1);
  });

  it('lets admins and committee respond to escalations without showing residents', async () => {
    const request = await create(residentId, 'medium', 'common_area');
    await superuser(
      `insert into public.service_request_escalations (
         society_id, request_id, level, escalated_on, delivery, recipient_count
       ) values
         ($1, $2, 'admin', ${indiaToday} - 3, 'in_app', 1),
         ($1, $2, 'committee', ${indiaToday} - 1, 'in_app', 1)`,
      [societyId, request.id],
    );
    const respond = (userId: string, level: string, status: string) =>
      call<Row>(
        userId,
        `select public.request_escalation_respond(
           $1, $2, $3, $4, 'Synthetic note', 'helpdesk-integration') as result`,
        [societyId, request.id, level, status],
      );
    expect(
      (await dbError(respond(committeeId, 'admin', 'action_taken'))).code,
    ).toBe('42501');
    expect(
      (await dbError(respond(residentId, 'committee', 'action_taken'))).code,
    ).toBe('42501');
    expect(
      (await dbError(respond(adminId, 'admin', 'pending_response'))).code,
    ).toBe('22023');
    await respond(adminId, 'admin', 'action_taken');
    await respond(committeeId, 'committee', 'resolved');

    const managed = await getAs(adminId, String(request.id));
    expect(managed.escalations).toEqual([
      expect.objectContaining({
        level: 'admin',
        response_status: 'action_taken',
        responder_name: 'Synthetic admin',
      }),
      expect.objectContaining({
        level: 'committee',
        response_status: 'resolved',
        responder_name: 'Synthetic committee',
        days_to_respond: 1,
      }),
    ]);
    expect((await getAs(residentId, String(request.id))).escalations).toEqual(
      [],
    );
  });

  it('assigns an active vendor only when the vendor module is on', async () => {
    const request = await create(residentId, 'medium');
    const vendors = await superuser<{ id: string }>(
      `insert into public.vendors (
         society_id, name, category, phone, active, client_request_id, created_by
       ) values
         ($1, 'Synthetic Pipes', 'Plumbing', '+919800000020', true, gen_random_uuid(), $2),
         ($1, 'Synthetic Retired', 'Plumbing', '+919800000021', false, gen_random_uuid(), $2),
         ($1, 'Synthetic No Phone', 'Plumbing', null, true, gen_random_uuid(), $2),
         ($3, 'Synthetic Other', 'Plumbing', '+919800000022', true, gen_random_uuid(), $2)
       returning id`,
      [societyId, adminId, otherSocietyId],
    );
    const [active, inactive, noPhone, foreign] = vendors.map(({ id }) => id);
    const assign = (vendorId: string) =>
      call<Row>(
        adminId,
        `select to_jsonb(public.request_assign(
           $1, $2, null, null, null, null, 'helpdesk-integration', $3
         )) as result`,
        [societyId, request.id, vendorId],
      );
    expect((await dbError(assign(active!))).code).toBe('22023');
    await superuser(
      `insert into public.module_configs (society_id, module_key, enabled, settings)
       values ($1, 'vendor', true, '{}')`,
      [societyId],
    );
    expect((await dbError(assign(inactive!))).code).toBe('23514');
    expect((await dbError(assign(foreign!))).code).toBe('23514');
    expect((await dbError(assign(noPhone!))).code).toBe('22023');
    const assigned = await assign(active!);
    expect(assigned).toMatchObject({
      status: 'assigned',
      assigned_vendor_id: active,
      assigned_vendor_name: 'Synthetic Pipes',
      assigned_vendor_phone: '+919800000020',
    });
    const freeText = await call<Row>(
      adminId,
      `select to_jsonb(public.request_assign(
         $1, $2, null, 'Synthetic Handyman', '+919800000030', null,
         'helpdesk-integration')) as result`,
      [societyId, request.id],
    );
    expect(freeText.assigned_vendor_id).toBeNull();
  });

  it('lets supervisors log a request for a unit with its source', async () => {
    const log = (userId: string, source: string) =>
      call<Row>(
        userId,
        `select to_jsonb(public.request_create_for_unit(
           $1, $2, 'unit', $3, 'Synthetic phoned-in leak', 'high', $4,
           '[]'::jsonb, $5::uuid, 'helpdesk-integration')) as result`,
        [societyId, categoryId, unitId, source, nextId()],
      );
    expect((await dbError(log(residentId, 'phone'))).code).toBe('42501');
    expect((await dbError(log(guardId, 'phone'))).code).toBe('42501');
    expect((await dbError(log(supervisorId, 'fax'))).code).toBe('22023');
    const logged = await log(supervisorId, 'phone');
    expect(logged).toMatchObject({
      intake_source: 'phone',
      priority: 'high',
      created_by: supervisorId,
    });
    // The resident of the unit can follow it like any other unit request.
    expect(
      (await getAs(residentId, String(logged.id))).request.intake_source,
    ).toBe('phone');
  });

  it('reports resolution, on-time and feedback figures and hides unit detail from committee', async () => {
    const reportAs = (userId: string) =>
      call<{
        totals: Record<string, number>;
        by_month: Array<{ month: string; closing_backlog: number }>;
        repeats: Row[] | null;
        comments: Row[] | null;
        feedback: Record<string, number>;
      }>(userId, `select public.request_report($1) as result`, [societyId]);
    expect((await dbError(reportAs(residentId))).code).toBe('42501');

    const admin = await reportAs(adminId);
    const counts = (
      await superuser<{
        logged: number;
        rejected: number;
        resolved: number;
        on_time: number;
      }>(
        `select count(*)::integer as logged,
           count(*) filter (where status = 'rejected')::integer as rejected,
           count(resolved_at)::integer as resolved,
           count(*) filter (where resolved_at <= sla_due_at)::integer as on_time
         from public.service_requests where society_id = $1`,
        [societyId],
      )
    )[0]!;
    expect(admin.totals).toMatchObject(counts);
    expect(admin.by_month).toHaveLength(12);
    expect(admin.by_month.at(-1)!.closing_backlog).toBe(
      counts.logged - counts.rejected - counts.resolved,
    );
    expect(admin.feedback.follow_up_needed).toBe(1);
    // Three or more requests in 90 days for the same unit and category.
    expect(admin.repeats).toEqual([
      expect.objectContaining({ unit_number: 'N-101', category: 'Plumbing' }),
    ]);
    expect(admin.comments).toHaveLength(1);

    const committee = await reportAs(committeeId);
    expect(committee.repeats).toBeNull();
    expect(committee.comments).toBeNull();
    expect(committee.totals).toEqual(admin.totals);
  });

  it('uses the per-priority committee wait when chosen', async () => {
    const settings = await call<{
      committee_wait_mode: string;
      committee_waits: Record<string, number>;
      updated_at: string | null;
    }>(adminId, `select public.request_escalation_settings_get($1) as result`, [
      societyId,
    ]);
    expect(settings.committee_wait_mode).toBe('per_priority');
    expect(settings.committee_waits).toEqual({
      critical: 2,
      high: 2,
      medium: 2,
      low: 2,
    });
    const save = (waits: unknown) =>
      call<{ committee_waits: Record<string, number> }>(
        adminId,
        `select public.request_escalation_settings_save(
           $1, 'in_app', $2::timestamptz, 'helpdesk-integration',
           'per_priority', $3::jsonb) as result`,
        [societyId, settings.updated_at, JSON.stringify(waits)],
      );
    expect(
      (await dbError(save({ critical: 0, high: 2, medium: 2, low: 2 }))).code,
    ).toBe('22023');
    expect((await dbError(save({ critical: 1 }))).code).toBe('22023');
    const saved = await save({ critical: 1, high: 3, medium: 5, low: 9 });
    expect(saved.committee_waits).toEqual({
      critical: 1,
      high: 3,
      medium: 5,
      low: 9,
    });

    const request = await create(residentId, 'critical', 'common_area');
    await superuser(
      `update public.service_requests set sla_due_at = now() - interval '1 day'
       where id = $1`,
      [request.id],
    );
    await superuser(
      `insert into public.service_request_escalations (
         society_id, request_id, level, escalated_on, delivery, recipient_count
       ) values ($1, $2, 'admin', ${indiaToday} - 1, 'in_app', 1)`,
      [societyId, request.id],
    );
    const result = await database.asRole(
      'service_role',
      {},
      async (client) =>
        (
          await client.query<{ result: { committee: number } }>(
            `select public.request_escalation_run(
               $1, ${indiaToday}, 'helpdesk-integration') as result`,
            [societyId],
          )
        ).rows[0]!.result,
      { commit: true },
    );
    expect(result.committee).toBe(1);
  });

  describe('daily checks', () => {
    let pointId: string;

    const record = (
      userId: string,
      args: {
        point?: string;
        result: 'ok' | 'issue';
        note?: string | null;
        action?: 'none' | 'raise' | 'link';
        category?: string | null;
        link?: string | null;
        clientId?: string;
      },
    ) =>
      call<Row>(
        userId,
        `select public.request_round_check_record(
           $1, $2, $3, $4, $5, $6, null, $7, $8::uuid, 'helpdesk-integration'
         ) as result`,
        [
          societyId,
          args.point ?? pointId,
          args.result,
          args.note ?? null,
          args.action ?? 'none',
          args.category ?? null,
          args.link ?? null,
          args.clientId ?? nextId(),
        ],
      );
    const savePoint = (userId: string, name: string, active = true) =>
      call<Row>(
        userId,
        `select public.request_inspection_point_save(
           $1, null, $2, 'Basement', 10, $3, 'helpdesk-integration') as result`,
        [societyId, name, active],
      );

    it('lets admins manage points and checkers record once per day', async () => {
      expect((await dbError(savePoint(supervisorId, 'Pump room'))).code).toBe(
        '42501',
      );
      pointId = String((await savePoint(adminId, 'Pump room')).id);
      expect((await dbError(savePoint(adminId, ' pump ROOM '))).code).toBe(
        '23505',
      );
      const lift = String((await savePoint(adminId, 'Lift lobby')).id);
      const retired = String((await savePoint(adminId, 'Old gate', false)).id);

      expect((await dbError(record(residentId, { result: 'ok' }))).code).toBe(
        '42501',
      );
      expect(
        (await dbError(record(guardId, { result: 'issue', note: null }))).code,
      ).toBe('22023');
      expect(
        (await dbError(record(guardId, { point: retired, result: 'ok' }))).code,
      ).toBe('P0002');

      const clientId = nextId();
      const first = await record(guardId, { result: 'ok', clientId });
      expect(await record(guardId, { result: 'ok', clientId })).toEqual(first);
      expect((await dbError(record(supervisorId, { result: 'ok' }))).code).toBe(
        '23505',
      );

      const raised = await record(supervisorId, {
        point: lift,
        result: 'issue',
        note: 'Light flickering',
        action: 'raise',
        category: categoryId,
      });
      const request = (
        await superuser<{
          location_type: string;
          intake_source: string;
          description: string;
        }>(
          `select location_type, intake_source, description
           from public.service_requests where id = $1`,
          [raised.request_id],
        )
      )[0]!;
      expect(request).toEqual({
        location_type: 'common_area',
        intake_source: 'daily_rounds',
        description: 'Lift lobby: Light flickering',
      });

      const today = await call<{ points: Row[] }>(
        guardId,
        `select public.request_rounds_today($1) as result`,
        [societyId],
      );
      expect(today.points.map(({ name }) => name)).toEqual([
        'Lift lobby',
        'Pump room',
      ]);
      expect(today.points[1]!.check).toMatchObject({
        result: 'ok',
        checked_by_name: 'Synthetic guard',
      });
      const adminView = await call<{ points: Row[] }>(
        adminId,
        `select public.request_rounds_today($1) as result`,
        [societyId],
      );
      expect(adminView.points).toHaveLength(3);
    });

    it('links an open request and reports the OK rate', async () => {
      const open = await create(residentId, 'medium', 'common_area');
      const point = String((await savePoint(adminId, 'Terrace')).id);
      const options = await call<{
        categories: Row[];
        open_common_requests: Row[];
      }>(guardId, `select public.request_intake_options($1) as result`, [
        societyId,
      ]);
      expect(options.categories.map(({ id }) => id)).toContain(categoryId);
      expect(options.open_common_requests.map(({ id }) => id)).toContain(
        open.id,
      );
      expect(
        (
          await dbError(
            call(
              residentId,
              `select public.request_intake_options($1) as result`,
              [societyId],
            ),
          )
        ).code,
      ).toBe('42501');
      const unitRequest = await create(residentId, 'medium');
      expect(
        (
          await dbError(
            record(guardId, {
              point,
              result: 'issue',
              note: 'Wrong link',
              action: 'link',
              link: String(unitRequest.id),
            }),
          )
        ).code,
      ).toBe('P0002');
      const linked = await record(guardId, {
        point,
        result: 'issue',
        note: 'Door left open',
        action: 'link',
        link: String(open.id),
      });
      expect(linked.request_id).toBe(open.id);

      expect(
        (
          await dbError(
            call(
              guardId,
              `select public.request_rounds_report($1, 30) as result`,
              [societyId],
            ),
          )
        ).code,
      ).toBe('42501');
      const report = await call<{
        totals: { checks: number; ok: number; issues: number; ok_pct: number };
        points: Array<{ name: string; issues: number }>;
      }>(committeeId, `select public.request_rounds_report($1, 30) as result`, [
        societyId,
      ]);
      expect(report.totals).toMatchObject({ checks: 3, ok: 1, issues: 2 });
      expect(Number(report.totals.ok_pct)).toBeCloseTo(33.3, 1);
      expect(report.points[0]!.issues).toBe(1);
    });

    it('purges checks older than two years in the retention run', async () => {
      await superuser(
        `update public.service_request_round_checks
         set check_date = check_date - interval '3 years'
         where society_id = $1 and result = 'ok'`,
        [societyId],
      );
      const result = await database.asRole(
        'service_role',
        {},
        async (client) =>
          (
            await client.query<{ result: { roundChecksDeleted: number } }>(
              `select public.housekeeping_retention_run(
                 ${indiaToday}, 'helpdesk-integration') as result`,
            )
          ).rows[0]!.result,
        { commit: true },
      );
      expect(result.roundChecksDeleted).toBe(1);
    });
  });
});
