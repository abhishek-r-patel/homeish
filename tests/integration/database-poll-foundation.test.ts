// Verify poll tables, RPC ACLs and the private-vote storage boundary.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  callPoll,
  createPollDraft,
  createPollFixture,
  databaseTimestamp,
  privatePollDraft,
  publicPollDraft,
  type PollFixture,
} from './support/poll-fixtures';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const POLL_TABLES = [
  'poll_votes',
  'poll_vote_blocks',
  'poll_options',
  'poll_offices',
  'poll_candidates',
  'poll_unit_representatives',
  'poll_electorate',
  'poll_participation',
  'poll_public_responses',
  'poll_private_tallies',
];

describe.skipIf(!hasDatabase)('poll database foundation', () => {
  let database: TestDatabase;
  let fixture: PollFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createPollFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps every poll table tenant-scoped, RLS-enabled and inaccessible directly', async () => {
    const tables = await database.asSuperuser((client) =>
      client.query<{
        table_name: string;
        has_society_id: boolean;
        society_id_required: boolean;
        rls_enabled: boolean;
        deny_policy: boolean;
        anon_select: boolean;
        authenticated_select: boolean;
        service_select: boolean;
      }>(
        `select c.relname as table_name,
          exists(select 1 from information_schema.columns column_info
            where column_info.table_schema='public' and column_info.table_name=c.relname
              and column_info.column_name='society_id') as has_society_id,
          (select column_info.is_nullable='NO' from information_schema.columns column_info
            where column_info.table_schema='public' and column_info.table_name=c.relname
              and column_info.column_name='society_id') as society_id_required,
          c.relrowsecurity as rls_enabled,
          exists(select 1 from pg_policies policy
            where policy.schemaname='public' and policy.tablename=c.relname
              and policy.policyname=c.relname || '_no_direct_access'
              and policy.qual='false' and policy.with_check='false') as deny_policy,
          has_table_privilege('anon', c.oid, 'select') as anon_select,
          has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
          has_table_privilege('service_role', c.oid, 'select') as service_select
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relname=any($1::text[])
         order by c.relname`,
        [POLL_TABLES],
      ),
    );

    expect(tables.rows.map((row) => row.table_name)).toEqual(
      [...POLL_TABLES].sort(),
    );
    for (const table of tables.rows) {
      expect(table).toMatchObject({
        has_society_id: true,
        society_id_required: true,
        rls_enabled: true,
        deny_policy: true,
        anon_select: false,
        authenticated_select: false,
        service_select: false,
      });
    }

    const privateColumns = await database.asSuperuser((client) =>
      client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema='public' and table_name='poll_private_tallies'
           and column_name in ('unit_id','membership_id','user_id','accepted_at','submitted_at')`,
      ),
    );
    expect(privateColumns.rows).toEqual([]);
  });

  it('exposes final SECURITY DEFINER RPC signatures only to their intended roles', async () => {
    const functions = await database.asSuperuser((client) =>
      client.query<{
        name: string;
        has_society_first: boolean;
        is_definer: boolean;
        safe_search_path: boolean;
        authenticated_execute: boolean;
        service_execute: boolean;
      }>(
        `select p.proname as name,
          (p.proname in ('poll_retention_run','poll_election_reconcile_due')
            or coalesce(p.proargnames[1]='p_society_id', false)) as has_society_first,
          p.prosecdef as is_definer,
          'search_path=""'=any(p.proconfig) as safe_search_path,
          has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
          has_function_privilege('service_role',p.oid,'execute') as service_execute
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname like 'poll\\_%' escape '\\'
         order by p.proname`,
      ),
    );

    expect(functions.rows).toHaveLength(61);
    for (const fn of functions.rows) {
      expect(fn).toMatchObject({
        has_society_first: fn.name !== 'poll_election_officer_assignments',
        is_definer: true,
        safe_search_path: true,
      });
      if (
        fn.name === 'poll_reconcile_due' ||
        fn.name === 'poll_retention_run' ||
        fn.name === 'poll_election_reconcile_due'
      ) {
        expect(fn.authenticated_execute).toBe(false);
        expect(fn.service_execute).toBe(true);
      } else {
        expect(fn.authenticated_execute).toBe(true);
        expect(fn.service_execute).toBe(false);
      }
    }
  });

  it('does not reconcile or notify due votes while the poll module is disabled', async () => {
    const draft = await publicPollDraft(fixture);
    const created = await createPollDraft(fixture, 'public', draft);
    const opensAt = await databaseTimestamp(fixture, "+ interval '5 seconds'");
    await callPoll(fixture, 'admin', 'poll_schedule', [
      fixture.societyId,
      created.voteId,
      created.revision,
      opensAt,
    ]);
    await database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled=false
         where society_id=$1 and module_key='poll'`,
        [fixture.societyId],
      ),
    );

    try {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.max(0, Date.parse(opensAt) - Date.now() + 100),
        ),
      );
      const reconciliation = await database.asRole(
        'service_role',
        null,
        async (client) => {
          const result = await client.query<{
            value: { opened: number; completed: number; notified: number };
          }>('select public.poll_reconcile_due($1) as value', [
            fixture.societyId,
          ]);
          return result.rows[0]!.value;
        },
        { commit: true },
      );
      expect(reconciliation).toEqual({
        opened: 0,
        completed: 0,
        notified: 0,
      });

      const state = await database.asSuperuser((client) =>
        client.query<{
          status: string;
          activated_at: string | null;
          opened_notified_at: string | null;
          notification_count: number;
        }>(
          `select vote.status,vote.activated_at,vote.opened_notified_at,
            (select count(*)::integer from public.notifications notification
             where notification.society_id=vote.society_id
               and notification.entity_type='poll'
               and notification.entity_id=vote.id) as notification_count
           from public.poll_votes vote
           where vote.society_id=$1 and vote.id=$2`,
          [fixture.societyId, created.voteId],
        ),
      );
      expect(state.rows[0]).toEqual({
        status: 'scheduled',
        activated_at: null,
        opened_notified_at: null,
        notification_count: 0,
      });
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=true
           where society_id=$1 and module_key='poll'`,
          [fixture.societyId],
        ),
      );
    }
  });

  it('serves authorized member and management snapshots through RPCs', async () => {
    const publicVote = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      publicVote.voteId,
      publicVote.revision,
    ]);

    const memberList = (await callPoll(fixture, 'primary', 'poll_member_list', [
      fixture.societyId,
    ])) as { votes: { id: string; units: { isRepresentative: boolean }[] }[] };
    expect(memberList.votes[0]?.id).toBe(publicVote.voteId);
    expect(memberList.votes[0]?.units).toEqual([
      expect.objectContaining({ isRepresentative: true }),
    ]);

    const familyView = (await callPoll(fixture, 'family', 'poll_member_get', [
      fixture.societyId,
      publicVote.voteId,
    ])) as {
      options: { id: string }[];
      units: { isRepresentative: boolean; myOptionIds: unknown }[];
    };
    expect(familyView.options).toHaveLength(2);
    expect(familyView.units).toEqual([
      expect.objectContaining({
        isRepresentative: false,
        myOptionIds: null,
      }),
    ]);

    const adminList = (await callPoll(fixture, 'admin', 'poll_admin_list', [
      fixture.societyId,
    ])) as { canManage: boolean; votes: { id: string }[] };
    expect(adminList.canManage).toBe(true);
    expect(adminList.votes[0]?.id).toBe(publicVote.voteId);
    const committeeView = (await callPoll(
      fixture,
      'committee',
      'poll_admin_get',
      [fixture.societyId, publicVote.voteId],
    )) as {
      canManage: boolean;
      readiness: { ready: boolean };
      turnout: { eligible: number; submitted: number };
    };
    expect(committeeView).toMatchObject({
      canManage: false,
      readiness: { ready: true },
      turnout: { eligible: 2, submitted: 0 },
    });
  });

  it('blocks direct ballot reads, participation deletion and private tally changes', async () => {
    const privateVote = await createPollDraft(
      fixture,
      'private',
      await privatePollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      privateVote.voteId,
      privateVote.revision,
    ]);
    const privateRead = await dbError(
      database.asRole(
        'authenticated',
        { sub: fixture.actors.primary },
        (client) => client.query('select * from public.poll_private_tallies'),
      ),
    );
    expect(privateRead.code).toBe('42501');
    const privateUpdate = await dbError(
      database.asSuperuser((client) =>
        client.query(
          `update public.poll_private_tallies set accepted_count=accepted_count+1
           where society_id=$1 and vote_id=$2`,
          [fixture.societyId, privateVote.voteId],
        ),
      ),
    );
    expect(privateUpdate.code).toBe('55000');

    const publicVote = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      publicVote.voteId,
      publicVote.revision,
    ]);
    const options = await database.asSuperuser((client) =>
      client.query<{ id: string }>(
        `select id from public.poll_options
         where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, publicVote.voteId],
      ),
    );
    await callPoll(fixture, 'primary', 'poll_ballot_submit', [
      fixture.societyId,
      publicVote.voteId,
      fixture.units[0]!.id,
      { optionIds: [options.rows[0]!.id] },
    ]);
    const participation = await database.asSuperuser((client) =>
      client.query<{ unit_id: string }>(
        `select unit_id from public.poll_participation
         where society_id=$1 and vote_id=$2`,
        [fixture.societyId, publicVote.voteId],
      ),
    );
    const participationDelete = await dbError(
      database.asSuperuser((client) =>
        client.query(
          `delete from public.poll_participation
           where society_id=$1 and vote_id=$2 and unit_id=$3`,
          [
            fixture.societyId,
            publicVote.voteId,
            participation.rows[0]!.unit_id,
          ],
        ),
      ),
    );
    expect(participationDelete.code).toBe('55000');
    const truncate = await dbError(
      database.asSuperuser((client) =>
        client.query('truncate public.poll_vote_blocks'),
      ),
    );
    expect(truncate.code).toBe('55000');
  });
});
