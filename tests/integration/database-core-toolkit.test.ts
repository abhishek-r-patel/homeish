// Verify P35 core toolkit access, privacy, assignment notices, sample plans, letter log and audit.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Role = 'admin' | 'committee' | 'owner' | 'other' | 'foreignAdmin';

interface PlanTask {
  id: string;
  title: string;
  status: string;
  progress: number;
  owner_membership_id: string | null;
  start_on: string;
  due_on: string;
  version: number;
  meeting_action: { status: string } | null;
}

interface Plan {
  id: string;
  name: string;
  notes?: string | null;
  version?: number;
  tasks: PlanTask[];
}

describe.skipIf(!hasDatabase)('database core toolkit (P35)', () => {
  let database: TestDatabase;
  let societyId: string;
  let foreignSocietyId: string;
  let users: Record<Role, string>;
  let memberships: Record<Role, string>;
  let meetingActionId: string;

  const as = <T>(
    role: Role,
    fn: (client: Client) => Promise<T>,
    commit = true,
  ) => database.asRole('authenticated', { sub: users[role] }, fn, { commit });

  async function rpc<T>(role: Role, sql: string, args: unknown[]) {
    return as(role, async (client) => {
      const result = await client.query<{ result: T }>(sql, args);
      return result.rows[0]!.result;
    });
  }

  const getProfile = (role: Role) =>
    rpc<Record<string, unknown>>(
      role,
      'select public.society_reference_profile_get($1) as result',
      [societyId],
    );

  const getPlans = (role: Role) =>
    rpc<{ can_manage: boolean; can_delete_tasks: boolean; plans: Plan[] }>(
      role,
      'select public.committee_action_plans_get($1) as result',
      [societyId],
    );

  function saveTask(
    role: Role,
    planId: string,
    taskId: string | null,
    values: {
      title?: string;
      owner?: string | null;
      status?: string;
      progress?: number;
      meetingActionId?: string | null;
      version?: number | null;
    } = {},
  ) {
    return rpc<string>(
      role,
      `select public.committee_action_plan_task_save(
        $1, $2, $3, $4, 'governance', 'high', $5, 3, 10, $6, $7, null,
        'https://example.test/evidence', $8, $9, $10, $11
      ) as result`,
      [
        societyId,
        taskId,
        planId,
        values.title ?? 'Collect registration certificate',
        values.owner ?? null,
        values.status ?? 'not_started',
        values.progress ?? 0,
        values.meetingActionId ?? null,
        values.version ?? null,
        randomUUID(),
        randomUUID(),
      ],
    );
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      users = {} as Record<Role, string>;
      memberships = {} as Record<Role, string>;
      for (const role of [
        'admin',
        'committee',
        'owner',
        'other',
        'foreignAdmin',
      ] as const) {
        const email = `toolkit-${role}@example.test`;
        const id = await newAuthUser(client, email);
        users[role] = id;
        await client.query(
          `insert into public.profiles (id, email, full_name) values ($1, $2, $3)`,
          [id, email, `Toolkit ${role}`],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, address, city, contact_email, contact_phone, created_by, timezone)
           values ('Toolkit Society', '1 Test Road', 'Pune', 'office@example.test', '9876543210', $1, 'UTC')
           returning id`,
          [users.admin],
        )
      ).rows[0]!.id;
      foreignSocietyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by, timezone)
           values ('Other Toolkit Society', $1, 'UTC') returning id`,
          [users.foreignAdmin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'), ($2, 'core', true, '{}')`,
        [societyId, foreignSocietyId],
      );
      const roles: Record<Exclude<Role, 'foreignAdmin'>, string> = {
        admin: 'admin',
        committee: 'committee',
        owner: 'resident',
        other: 'resident',
      };
      for (const [role, dbRole] of Object.entries(roles) as [
        Exclude<Role, 'foreignAdmin'>,
        string,
      ][]) {
        memberships[role] = (
          await client.query<{ id: string }>(
            `insert into public.memberships (society_id, user_id, roles, status)
             values ($1, $2, ARRAY[$3]::text[], 'active') returning id`,
            [societyId, users[role], dbRole],
          )
        ).rows[0]!.id;
      }
      memberships.foreignAdmin = (
        await client.query<{ id: string }>(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active') returning id`,
          [foreignSocietyId, users.foreignAdmin],
        )
      ).rows[0]!.id;

      await client.query('set session_replication_role = replica');
      const meetingId = (
        await client.query<{ id: string }>(
          `insert into public.meetings (society_id, meeting_type, title, client_request_id, created_by)
           values ($1, 'committee', 'Committee meeting', 'seed', $2) returning id`,
          [societyId, users.admin],
        )
      ).rows[0]!.id;
      meetingActionId = (
        await client.query<{ id: string }>(
          `insert into public.meeting_action_items (
             society_id, meeting_id, title, owner_membership_id, owner_name, due_on,
             created_by, updated_by
           ) values ($1, $2, 'File annual return', $3, 'Toolkit committee', current_date, $4, $4)
           returning id`,
          [societyId, meetingId, memberships.committee, users.admin],
        )
      ).rows[0]!.id;
      await client.query('set session_replication_role = origin');
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps toolkit tables closed to direct API access', async () => {
    for (const table of [
      'society_reference_profiles',
      'society_capability_adoptions',
      'committee_action_plans',
      'committee_action_plan_tasks',
      'letter_generation_logs',
    ]) {
      const error = await dbError(
        as(
          'admin',
          (client) => client.query(`select * from public.${table}`),
          false,
        ),
      );
      expect(error.code).toBe('42501');
    }
  });

  it('lets admins save the profile and hides admin-only fields from committee', async () => {
    const empty = await getProfile('admin');
    expect(empty.version).toBeNull();
    expect((empty.profile as Record<string, unknown>).pan).toBeNull();
    expect(
      (empty.completeness as { missing_fields: string[] }).missing_fields,
    ).toContain('registration_number');

    const saved = await rpc<Record<string, unknown>>(
      'admin',
      'select public.society_reference_profile_save($1, $2, null, $3) as result',
      [
        societyId,
        {
          society_type: 'cooperative_housing_society',
          registration_number: 'REG-001',
          registration_date: '2001-04-01',
          state: 'Maharashtra',
          pin_code: '411001',
          financial_year_start_month: 4,
          pan: 'abcde1234f',
          bank_name: 'Test Bank',
          bank_account_last4: '1234',
          ifsc: 'test0123456',
          chairman_name: 'Chair Person',
          chairman_mobile: '9999999999',
          statutory_members_count: 40,
          built_up_area_sq_ft: '12500.5',
        },
        randomUUID(),
      ],
    );
    const profile = saved.profile as Record<string, unknown>;
    expect(saved.version).toBe(1);
    expect(profile.pan).toBe('ABCDE1234F');
    expect(profile.ifsc).toBe('TEST0123456');
    expect(profile.chairman_mobile).toBe('9999999999');
    const completeness = saved.completeness as {
      missing_fields: string[];
      required_count: number;
    };
    expect(completeness.missing_fields).toEqual([
      'registration_authority',
      'auditor_name',
    ]);
    expect(completeness.required_count).toBe(14);

    const committeeView = await getProfile('committee');
    const committeeProfile = committeeView.profile as Record<string, unknown>;
    expect(committeeView.restricted_visible).toBe(false);
    expect(committeeView.can_manage).toBe(false);
    expect(committeeProfile.chairman_name).toBe('Chair Person');
    expect(committeeProfile.registration_number).toBe('REG-001');
    for (const key of [
      'pan',
      'bank_name',
      'bank_account_last4',
      'ifsc',
      'chairman_mobile',
      'secretary_mobile',
      'treasurer_mobile',
    ]) {
      expect(committeeProfile).not.toHaveProperty(key);
    }
    expect(committeeView.society).toMatchObject({
      name: 'Toolkit Society',
      city: 'Pune',
    });

    const audit = await as('committee', (client) =>
      client.query<{ after: Record<string, unknown> }>(
        `select "after" from public.audit_logs
         where society_id = $1 and action = 'core.society_profile.create'`,
        [societyId],
      ),
    );
    expect(audit.rows).toHaveLength(1);
    const after = audit.rows[0]!.after;
    expect(after).not.toHaveProperty('pan');
    expect(after).not.toHaveProperty('bank_account_last4');
    expect(after.restricted_fields_changed).toEqual([
      'bank_account_last4',
      'bank_name',
      'chairman_mobile',
      'ifsc',
      'pan',
    ]);
  });

  it('rejects profile writes from non-admins, stale versions and full account numbers', async () => {
    for (const role of ['committee', 'owner', 'foreignAdmin'] as const) {
      const error = await dbError(
        rpc(
          role,
          'select public.society_reference_profile_save($1, $2, 1, null) as result',
          [societyId, { state: 'Goa' }],
        ),
      );
      expect(error.code).toBe('42501');
    }
    for (const role of ['owner', 'foreignAdmin'] as const) {
      expect((await dbError(getProfile(role))).code).toBe('42501');
    }
    const stale = await dbError(
      rpc(
        'admin',
        'select public.society_reference_profile_save($1, $2, null, null) as result',
        [societyId, { state: 'Goa' }],
      ),
    );
    expect(stale.code).toBe('40001');
    const account = await dbError(
      rpc(
        'admin',
        'select public.society_reference_profile_save($1, $2, 1, null) as result',
        [societyId, { bank_account_last4: '123456789012' }],
      ),
    );
    expect(account.code).toBe('22023');
    const unknown = await dbError(
      rpc(
        'admin',
        'select public.society_reference_profile_save($1, $2, 1, null) as result',
        [societyId, { bank_account_number: '123456789012' }],
      ),
    );
    expect(unknown.message).toContain('Unknown profile field');
  });

  it('records capability adoption for admins without toggling modules', async () => {
    const saved = await rpc<{ status: string; version: number }>(
      'admin',
      `select public.society_capability_adoption_save(
        $1, 'visitor', 'exploring', 'high', $2, current_date, 'Trial at main gate', null, $3
      ) as result`,
      [societyId, memberships.committee, randomUUID()],
    );
    expect(saved).toMatchObject({ status: 'exploring', version: 1 });

    const list = await rpc<{
      capabilities: {
        module_key: string;
        status: string;
        enabled: boolean;
        owner_name: string | null;
      }[];
    }>(
      'committee',
      'select public.society_capability_adoptions_get($1) as result',
      [societyId],
    );
    const visitor = list.capabilities.find(
      (row) => row.module_key === 'visitor',
    );
    expect(visitor).toMatchObject({
      status: 'exploring',
      enabled: false,
      owner_name: 'Toolkit committee',
    });
    expect(
      list.capabilities.find((row) => row.module_key === 'billing')?.status,
    ).toBe('not_started');

    const residentOwner = await dbError(
      rpc(
        'admin',
        `select public.society_capability_adoption_save(
        $1, 'billing', 'in_use', 'low', $2, null, null, null, null) as result`,
        [societyId, memberships.owner],
      ),
    );
    expect(residentOwner.code).toBe('22023');
    for (const role of ['committee', 'owner', 'foreignAdmin'] as const) {
      const error = await dbError(
        rpc(
          role,
          `select public.society_capability_adoption_save(
          $1, 'billing', 'in_use', 'low', null, null, null, null, null) as result`,
          [societyId],
        ),
      );
      expect(error.code).toBe('42501');
    }
    expect(
      (
        await dbError(
          rpc(
            'owner',
            'select public.society_capability_adoptions_get($1) as result',
            [societyId],
          ),
        )
      ).code,
    ).toBe('42501');
  });

  it('shows plans to managers, only assigned tasks to owners, and notifies on assignment', async () => {
    const planId = await rpc<string>(
      'committee',
      `select public.committee_action_plan_save(
        $1, null, 'Setup plan', '2026-01-01', 'Internal notes', null, $2, $3
      ) as result`,
      [societyId, randomUUID(), randomUUID()],
    );
    const ownedTaskId = await saveTask('committee', planId, null, {
      owner: memberships.owner,
    });
    await saveTask('admin', planId, null, { title: 'Unassigned task' });

    const notices = await as('owner', (client) =>
      client.query<{ type: string; entity_type: string; entity_id: string }>(
        'select type, entity_type, entity_id from public.notifications',
      ),
    );
    expect(notices.rows).toEqual([
      {
        type: 'committee_action_task_assigned',
        entity_type: 'committee_action_plan',
        entity_id: planId,
      },
    ]);

    const managerView = await getPlans('admin');
    expect(managerView.can_manage).toBe(true);
    const managerPlan = managerView.plans.find((plan) => plan.id === planId)!;
    expect(managerPlan.tasks).toHaveLength(2);
    expect(managerPlan.notes).toBe('Internal notes');
    const owned = managerPlan.tasks.find((task) => task.id === ownedTaskId)!;
    expect(owned.start_on).toBe('2026-01-03');
    expect(owned.due_on).toBe('2026-01-10');

    const ownerView = await getPlans('owner');
    expect(ownerView.can_manage).toBe(false);
    expect(ownerView.plans).toHaveLength(1);
    expect(ownerView.plans[0]!.tasks.map((task) => task.id)).toEqual([
      ownedTaskId,
    ]);
    expect(ownerView.plans[0]).not.toHaveProperty('notes');

    expect((await getPlans('other')).plans).toEqual([]);
    expect((await dbError(getPlans('foreignAdmin'))).code).toBe('42501');
    const ownerEdit = await dbError(
      saveTask('owner', planId, ownedTaskId, { version: 1, status: 'done' }),
    );
    expect(ownerEdit.code).toBe('42501');

    await saveTask('admin', planId, ownedTaskId, {
      owner: memberships.other,
      version: 1,
      status: 'done',
      progress: 10,
    });
    const otherNotices = await as('other', (client) =>
      client.query('select id from public.notifications'),
    );
    expect(otherNotices.rows).toHaveLength(1);
    const reassigned = (await getPlans('other')).plans[0]!.tasks[0]!;
    expect(reassigned).toMatchObject({ status: 'done', progress: 100 });
    expect((await getPlans('owner')).plans).toEqual([]);

    const foreignOwner = await dbError(
      saveTask('admin', planId, null, { owner: memberships.foreignAdmin }),
    );
    expect(foreignOwner.code).toBe('22023');
  });

  it('reads linked task completion from the meeting action', async () => {
    const planId = await rpc<string>(
      'admin',
      `select public.committee_action_plan_save(
        $1, null, 'Linked plan', current_date, null, null, $2, null
      ) as result`,
      [societyId, randomUUID()],
    );
    const doneLinked = await dbError(
      saveTask('admin', planId, null, {
        meetingActionId: meetingActionId,
        status: 'done',
      }),
    );
    expect(doneLinked.message).toContain('linked meeting action');
    const taskId = await saveTask('admin', planId, null, {
      meetingActionId: meetingActionId,
      owner: memberships.owner,
      status: 'in_progress',
    });
    await database.asSuperuser(async (client) => {
      await client.query('set session_replication_role = replica');
      await client.query(
        `update public.meeting_action_items
         set status = 'done', completed_at = now(), completed_by = $2
         where id = $1`,
        [meetingActionId, users.admin],
      );
    });
    const task = (await getPlans('admin')).plans
      .find((plan) => plan.id === planId)!
      .tasks.find((row) => row.id === taskId)!;
    expect(task).toMatchObject({ status: 'done', progress: 100 });
    expect(task.meeting_action?.status).toBe('done');

    const remove = (
      role: Role,
      version: number,
      reason = 'Duplicate planning task',
    ) =>
      rpc(
        role,
        `select public.committee_action_plan_task_delete($1, $2, $3, $4, 'remove-task') as result`,
        [societyId, taskId, version, reason],
      );
    expect((await getPlans('committee')).can_delete_tasks).toBe(false);
    expect((await getPlans('admin')).can_delete_tasks).toBe(true);
    expect((await dbError(remove('committee', task.version))).code).toBe(
      '42501',
    );
    expect((await dbError(remove('foreignAdmin', task.version))).code).toBe(
      '42501',
    );
    expect((await dbError(remove('admin', task.version, '   '))).code).toBe(
      '22023',
    );
    expect((await dbError(remove('admin', task.version + 1))).code).toBe(
      '40001',
    );
    await remove('admin', task.version);
    await remove('admin', task.version);
    expect(
      (await getPlans('owner')).plans.some((plan) =>
        plan.tasks.some((row) => row.id === taskId),
      ),
    ).toBe(false);
    expect(
      (await getPlans('admin')).plans.find((plan) => plan.id === planId)!.tasks,
    ).toEqual([]);
    expect(
      (
        await dbError(
          saveTask('admin', planId, taskId, { version: task.version + 1 }),
        )
      ).message,
    ).toContain('removed task');
    const retained = await database.asSuperuser(
      async (client) =>
        (
          await client.query(
            `select task.deleted_by, task.deletion_reason, action.status as meeting_status,
        (select count(*)::int from public.audit_logs where action = 'core.action_plan.task_remove' and entity_id = task.id::text) as audit_count
       from public.committee_action_plan_tasks task
       join public.meeting_action_items action on action.id = task.meeting_action_item_id where task.id = $1`,
            [taskId],
          )
        ).rows[0]!,
    );
    expect(retained).toEqual({
      deleted_by: users.admin,
      deletion_reason: 'Duplicate planning task',
      meeting_status: 'done',
      audit_count: 1,
    });
  });

  it('creates an editable sample plan and archives instead of deleting', async () => {
    const requestId = randomUUID();
    const planId = await rpc<string>(
      'committee',
      `select public.committee_action_plan_create_sample($1, null, '2026-02-01', $2, $3) as result`,
      [societyId, requestId, randomUUID()],
    );
    const again = await rpc<string>(
      'committee',
      `select public.committee_action_plan_create_sample($1, null, '2026-02-01', $2, null) as result`,
      [societyId, requestId],
    );
    expect(again).toBe(planId);
    const plan = (await getPlans('committee')).plans.find(
      (row) => row.id === planId,
    )!;
    expect(plan.name).toBe('Committee setup plan');
    expect(plan.tasks.length).toBeGreaterThanOrEqual(10);
    expect(plan.tasks.every((task) => task.owner_membership_id === null)).toBe(
      true,
    );

    await rpc(
      'committee',
      'select public.committee_action_plan_set_archived($1, $2, true, $3, null) as result',
      [societyId, planId, plan.version],
    );
    expect(
      (await getPlans('committee')).plans.some((row) => row.id === planId),
    ).toBe(false);
    const archivedEdit = await dbError(
      saveTask('committee', planId, plan.tasks[0]!.id, { version: 1 }),
    );
    expect(archivedEdit.message).toContain('archived');
    const deletion = await dbError(
      database.asSuperuser((client) =>
        client.query(
          'delete from public.committee_action_plans where id = $1',
          [planId],
        ),
      ),
    );
    expect(deletion.code).toBe('55000');

    const audit = await as('admin', (client) =>
      client.query<{ action: string }>(
        `select action from public.audit_logs
         where society_id = $1 and entity_id = $2 order by id`,
        [societyId, planId],
      ),
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'core.action_plan.create_sample',
      'core.action_plan.archive',
    ]);
  });

  it('logs letter generation for admins and committee only', async () => {
    const id = await rpc<string>(
      'committee',
      `select public.letter_generation_record($1, 'utility_shutdown', null, null, $2) as result`,
      [societyId, randomUUID()],
    );
    await rpc(
      'admin',
      `select public.letter_generation_record($1, 'member_welcome', 'membership', $2, null) as result`,
      [societyId, memberships.owner],
    );
    const logs = await rpc<
      { id: string; letter_type: string; generated_by_name: string }[]
    >('admin', 'select public.letter_generation_logs_get($1) as result', [
      societyId,
    ]);
    expect(logs).toHaveLength(2);
    expect(logs.find((row) => row.id === id)).toMatchObject({
      letter_type: 'utility_shutdown',
      generated_by_name: 'Toolkit committee',
    });

    const badType = await dbError(
      rpc(
        'admin',
        `select public.letter_generation_record($1, 'loan_application', null, null, null) as result`,
        [societyId],
      ),
    );
    expect(badType.code).toBe('22023');
    for (const role of ['owner', 'foreignAdmin'] as const) {
      const write = await dbError(
        rpc(
          role,
          `select public.letter_generation_record($1, 'circular', null, null, null) as result`,
          [societyId],
        ),
      );
      expect(write.code).toBe('42501');
      const read = await dbError(
        rpc(role, 'select public.letter_generation_logs_get($1) as result', [
          societyId,
        ]),
      );
      expect(read.code).toBe('42501');
    }
  });
});
