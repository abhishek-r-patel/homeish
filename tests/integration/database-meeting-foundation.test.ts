// Verify meeting tables, RPC ACLs and the record-protection triggers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  callMeeting,
  callMeetingService,
  createHeldMeeting,
  createMeetingFixture,
  createScheduledMeeting,
  expectCode,
  requestId,
  setModule,
  type MeetingFixture,
} from './support/meeting-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const MEETING_TABLES = [
  'meetings',
  'meeting_agenda_items',
  'meeting_invitee_selections',
  'meeting_invited_units',
  'meeting_invited_members',
  'meeting_attendance',
  'meeting_resolutions',
  'meeting_minutes',
  'meeting_action_items',
];

describe.skipIf(!hasDatabase)('meeting database foundation', () => {
  let database: TestDatabase;
  let fixture: MeetingFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createMeetingFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps every meeting table tenant-scoped, RLS-enabled and inaccessible directly', async () => {
    const tables = await database.asSuperuser((client) =>
      client.query<{
        table_name: string;
        society_id_required: boolean;
        rls_enabled: boolean;
        deny_policy: boolean;
        anon_select: boolean;
        authenticated_select: boolean;
        authenticated_insert: boolean;
        service_select: boolean;
        truncate_guard: boolean;
      }>(
        `select c.relname as table_name,
          coalesce((select column_info.is_nullable='NO' from information_schema.columns column_info
            where column_info.table_schema='public' and column_info.table_name=c.relname
              and column_info.column_name='society_id'),false) as society_id_required,
          c.relrowsecurity as rls_enabled,
          exists(select 1 from pg_policies policy
            where policy.schemaname='public' and policy.tablename=c.relname
              and policy.policyname=c.relname || '_no_direct_access'
              and policy.qual='false' and policy.with_check='false') as deny_policy,
          has_table_privilege('anon', c.oid, 'select') as anon_select,
          has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
          has_table_privilege('authenticated', c.oid, 'insert') as authenticated_insert,
          has_table_privilege('service_role', c.oid, 'select') as service_select,
          exists(select 1 from pg_trigger trigger_info
            where trigger_info.tgrelid=c.oid and not trigger_info.tgisinternal
              and (trigger_info.tgtype & 32)<>0) as truncate_guard
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relname=any($1::text[])
         order by c.relname`,
        [MEETING_TABLES],
      ),
    );

    expect(tables.rows.map((row) => row.table_name)).toEqual(
      [...MEETING_TABLES].sort(),
    );
    for (const table of tables.rows) {
      expect(table).toMatchObject({
        society_id_required: true,
        rls_enabled: true,
        deny_policy: true,
        anon_select: false,
        authenticated_select: false,
        authenticated_insert: false,
        service_select: false,
        truncate_guard: true,
      });
    }
  });

  it('exposes final SECURITY DEFINER RPC signatures only to their intended roles', async () => {
    const functions = await database.asSuperuser((client) =>
      client.query<{
        name: string;
        society_first: boolean;
        is_definer: boolean;
        safe_search_path: boolean;
        public_execute: boolean;
        anon_execute: boolean;
        authenticated_execute: boolean;
        service_execute: boolean;
      }>(
        `select p.proname as name,
          p.proargnames[1]='p_society_id' as society_first,
          p.prosecdef as is_definer,
          'search_path=""'=any(p.proconfig) as safe_search_path,
          exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
            where acl.grantee=0 and acl.privilege_type='EXECUTE') as public_execute,
          has_function_privilege('anon',p.oid,'execute') as anon_execute,
          has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
          has_function_privilege('service_role',p.oid,'execute') as service_execute
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname like 'meeting\\_%' escape '\\'
         order by p.proname`,
      ),
    );

    expect(functions.rows).toHaveLength(29);
    for (const fn of functions.rows) {
      expect(fn).toMatchObject({
        society_first: true,
        is_definer: true,
        safe_search_path: true,
        public_execute: false,
        anon_execute: false,
      });
      if (fn.name === 'meeting_action_reminders_run') {
        expect(fn.authenticated_execute).toBe(false);
        expect(fn.service_execute).toBe(true);
      } else {
        expect(fn.authenticated_execute).toBe(true);
        expect(fn.service_execute).toBe(false);
      }
    }
  });

  it('rejects truncation and direct changes to published minutes', async () => {
    for (const table of MEETING_TABLES) {
      await expectCode(
        database.asSuperuser((client) =>
          client.query(`truncate public.${table} cascade`),
        ),
        '55000',
      );
    }

    const held = await createHeldMeeting(fixture);
    const saved = await callMeeting(fixture, 'admin', 'meeting_minutes_save', [
      fixture.societyId,
      held.meetingId,
      null,
      'Synthetic minutes body.',
      requestId('minutes'),
    ]);
    await callMeeting(fixture, 'admin', 'meeting_minutes_publish', [
      fixture.societyId,
      held.meetingId,
      saved.version,
      requestId('publish'),
    ]);

    await expectCode(
      database.asSuperuser((client) =>
        client.query(
          `update public.meeting_minutes set body='Changed synthetic body.'
           where society_id=$1 and meeting_id=$2`,
          [fixture.societyId, held.meetingId],
        ),
      ),
      '55000',
    );
    await expectCode(
      database.asSuperuser((client) =>
        client.query(
          'delete from public.meeting_minutes where society_id=$1 and meeting_id=$2',
          [fixture.societyId, held.meetingId],
        ),
      ),
      '55000',
    );
  });

  it('blocks calls and reminders while the meeting module is disabled', async () => {
    const scheduled = await createScheduledMeeting(fixture);
    const action = await callMeeting(fixture, 'admin', 'meeting_action_save', [
      fixture.societyId,
      scheduled.meetingId,
      null,
      null,
      {
        title: 'Synthetic overdue action',
        ownerMembershipId: fixture.memberships.owner,
        dueOn: '2099-01-01',
      },
      requestId('action'),
    ]);
    await database.asSuperuser((client) =>
      client.query(
        `update public.meeting_action_items set due_on=date '2000-01-01'
         where society_id=$1 and id=$2`,
        [fixture.societyId, action.actionId],
      ),
    );

    await setModule(fixture, 'meeting', false);
    try {
      await expectCode(
        callMeeting(fixture, 'admin', 'meeting_admin_get', [
          fixture.societyId,
          scheduled.meetingId,
        ]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, 'owner', 'meeting_my_actions', [
          fixture.societyId,
        ]),
        '42501',
      );
      const request = requestId('reminders');
      expect(
        await callMeetingService(fixture, 'meeting_action_reminders_run', [
          fixture.societyId,
          request,
        ]),
      ).toEqual({ notified: 0 });
      const sent = await database.asSuperuser((client) =>
        client.query('select 1 from public.notifications where request_id=$1', [
          request,
        ]),
      );
      expect(sent.rowCount).toBe(0);
    } finally {
      await setModule(fixture, 'meeting', true);
    }

    expect(
      await callMeetingService(fixture, 'meeting_action_reminders_run', [
        fixture.societyId,
        requestId('reminders'),
      ]),
    ).toEqual({ notified: 1 });
  });
});
