// Verify poll scheduling, withdrawal, completion, cancellation and extension rules.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  callPoll,
  createPollDraft,
  createPollFixture,
  databaseTimestamp,
  errorFor,
  privatePollDraft,
  pollObject,
  publicPollDraft,
  type PollFixture,
} from './support/poll-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('poll lifecycle database contracts', () => {
  let database: TestDatabase;
  let fixture: PollFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createPollFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('freezes tenant voting and the electorate at scheduling, then clears only the snapshot on withdrawal', async () => {
    await callPoll(fixture, 'admin', 'poll_settings_update', [
      fixture.societyId,
      { tenant_voting_default: true },
    ]);
    const draft = await publicPollDraft(fixture, {
      tenantVotingOverride: false,
    });
    const created = await createPollDraft(fixture, 'public', draft);
    const opensAt = await databaseTimestamp(fixture, "+ interval '1 hour'");
    const scheduled = pollObject(
      await callPoll(fixture, 'admin', 'poll_schedule', [
        fixture.societyId,
        created.voteId,
        created.revision,
        opensAt,
      ]),
    );
    expect(scheduled).toMatchObject({
      voteId: created.voteId,
      status: 'scheduled',
    });

    await callPoll(fixture, 'admin', 'poll_settings_update', [
      fixture.societyId,
      { tenant_voting_default: false },
    ]);
    const scheduledVote = await database.asSuperuser((client) =>
      client.query<{
        tenant_voting: boolean;
        tenant_voting_override: boolean;
        electorate_count: number;
      }>(
        `select vote.tenant_voting,vote.tenant_voting_override,
          (select count(*)::integer from public.poll_electorate electorate
           where electorate.society_id=vote.society_id
             and electorate.vote_id=vote.id) as electorate_count
         from public.poll_votes vote
         where vote.society_id=$1 and vote.id=$2`,
        [fixture.societyId, created.voteId],
      ),
    );
    expect(scheduledVote.rows[0]).toEqual({
      tenant_voting: false,
      tenant_voting_override: false,
      electorate_count: 2,
    });

    const withdrawn = pollObject(
      await callPoll(fixture, 'admin', 'poll_schedule_withdraw', [
        fixture.societyId,
        created.voteId,
        'Correcting the opening time',
      ]),
    );
    expect(withdrawn).toMatchObject({
      voteId: created.voteId,
      status: 'draft',
    });
    const afterWithdrawal = await database.asSuperuser((client) =>
      client.query<{
        status: string;
        tenant_voting: boolean | null;
        tenant_voting_override: boolean | null;
        revision: number;
        electorate_count: number;
      }>(
        `select vote.status,vote.tenant_voting,vote.tenant_voting_override,
          vote.revision,
          (select count(*)::integer from public.poll_electorate electorate
           where electorate.society_id=vote.society_id
             and electorate.vote_id=vote.id) as electorate_count
         from public.poll_votes vote
         where vote.society_id=$1 and vote.id=$2`,
        [fixture.societyId, created.voteId],
      ),
    );
    expect(afterWithdrawal.rows[0]).toMatchObject({
      status: 'draft',
      tenant_voting: null,
      tenant_voting_override: false,
      revision: 3,
      electorate_count: 0,
    });
  });

  it('requires reasons for early completion and cancellation, and never reopens terminal votes', async () => {
    const active = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      active.voteId,
      active.revision,
    ]);
    const missingCompletionReason = await errorFor(
      callPoll(fixture, 'admin', 'poll_complete_early', [
        fixture.societyId,
        active.voteId,
        ' ',
      ]),
    );
    expect(missingCompletionReason.code).toBe('22023');
    const completed = pollObject(
      await callPoll(fixture, 'admin', 'poll_complete_early', [
        fixture.societyId,
        active.voteId,
        'The agenda item is resolved',
      ]),
    );
    expect(completed).toMatchObject({
      voteId: active.voteId,
      status: 'completed',
    });
    const reopen = await errorFor(
      callPoll(fixture, 'admin', 'poll_activate', [
        fixture.societyId,
        active.voteId,
        active.revision,
      ]),
    );
    expect(reopen.code).toBe('P0001');
    expect(reopen.message).toContain('poll_invalid_state');

    const scheduled = await createPollDraft(
      fixture,
      'private',
      await privatePollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_schedule', [
      fixture.societyId,
      scheduled.voteId,
      scheduled.revision,
      await databaseTimestamp(fixture, "+ interval '1 hour'"),
    ]);
    const missingCancellationReason = await errorFor(
      callPoll(fixture, 'admin', 'poll_cancel', [
        fixture.societyId,
        scheduled.voteId,
        ' ',
      ]),
    );
    expect(missingCancellationReason.code).toBe('22023');
    const cancelled = pollObject(
      await callPoll(fixture, 'admin', 'poll_cancel', [
        fixture.societyId,
        scheduled.voteId,
        'The meeting was postponed',
      ]),
    );
    expect(cancelled).toMatchObject({
      voteId: scheduled.voteId,
      status: 'cancelled',
    });
    const cannotReactivate = await errorFor(
      callPoll(fixture, 'admin', 'poll_activate', [
        fixture.societyId,
        scheduled.voteId,
        scheduled.revision,
      ]),
    );
    expect(cannotReactivate.code).toBe('P0001');
    expect(cannotReactivate.message).toContain('poll_invalid_state');
  });

  it('extends an active deadline only later than the current close and audits a reason', async () => {
    const created = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      created.voteId,
      created.revision,
    ]);
    const later = await databaseTimestamp(fixture, "+ interval '3 days'");
    const extension = pollObject(
      await callPoll(fixture, 'admin', 'poll_deadline_extend', [
        fixture.societyId,
        created.voteId,
        later,
        'Allow more time for residents',
      ]),
    );
    expect(extension.voteId).toBe(created.voteId);
    expect(extension.outcome).toBe('extended');
    expect(typeof extension.closesAt).toBe('string');
    expect(new Date(String(extension.closesAt)).getTime()).toBe(
      new Date(later).getTime(),
    );

    const noReason = await errorFor(
      callPoll(fixture, 'admin', 'poll_deadline_extend', [
        fixture.societyId,
        created.voteId,
        await databaseTimestamp(fixture, "+ interval '4 days'"),
        '',
      ]),
    );
    expect(noReason.code).toBe('22023');
    const audit = await database.asSuperuser((client) =>
      client.query<{ reason: string | null }>(
        `select reason from public.audit_logs
         where society_id=$1 and entity_id=$2
           and action='poll.deadline.extend'`,
        [fixture.societyId, created.voteId],
      ),
    );
    expect(audit.rows.map((row) => row.reason)).toContain(
      'Allow more time for residents',
    );
  });

  it('completes an overdue vote when its deadline extension is requested', async () => {
    const created = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      created.voteId,
      created.revision,
    ]);
    const options = await database.asSuperuser((client) =>
      client.query<{ id: string }>(
        `select id from public.poll_options
         where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, created.voteId],
      ),
    );
    await callPoll(fixture, 'primary', 'poll_ballot_submit', [
      fixture.societyId,
      created.voteId,
      fixture.units[0]!.id,
      { optionIds: [options.rows[0]!.id] },
    ]);
    await database.asSuperuser(async (client) => {
      await client.query('begin');
      try {
        await client.query(
          "select set_config('poll.deadline_extension','on',true)",
        );
        await client.query(
          `update public.poll_votes
           set closes_at=clock_timestamp()-interval '1 second'
           where society_id=$1 and id=$2 and status='active'`,
          [fixture.societyId, created.voteId],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });

    const result = pollObject(
      await callPoll(fixture, 'admin', 'poll_deadline_extend', [
        fixture.societyId,
        created.voteId,
        await databaseTimestamp(fixture, "+ interval '3 days'"),
        'The vote deadline has passed',
      ]),
    );
    expect(result).toMatchObject({
      voteId: created.voteId,
      outcome: 'completed',
    });
    expect(typeof result.closesAt).toBe('string');

    const persisted = await database.asSuperuser((client) =>
      client.query<{
        status: string;
        completed_at: string | null;
        participation_count: number;
        response_count: number;
      }>(
        `select vote.status,vote.completed_at,
          (select count(*)::integer from public.poll_participation participation
           where participation.society_id=vote.society_id
             and participation.vote_id=vote.id) as participation_count,
          (select count(*)::integer from public.poll_public_responses response
           where response.society_id=vote.society_id
             and response.vote_id=vote.id) as response_count
         from public.poll_votes vote
         where vote.society_id=$1 and vote.id=$2`,
        [fixture.societyId, created.voteId],
      ),
    );
    expect(persisted.rows[0]).toMatchObject({
      status: 'completed',
      participation_count: 1,
      response_count: 1,
    });
    expect(persisted.rows[0]?.completed_at).not.toBeNull();
  });

  it('freezes a block-restricted electorate and hides it from other residents', async () => {
    const draft = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture, { blockIds: [fixture.blocks.A] }),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      draft.voteId,
      draft.revision,
    ]);
    const electorate = await database.asSuperuser((client) =>
      client.query<{ unit_id: string; block_id: string }>(
        `select unit_id,block_id from public.poll_electorate
         where society_id=$1 and vote_id=$2`,
        [fixture.societyId, draft.voteId],
      ),
    );
    expect(electorate.rows).toEqual([
      { unit_id: fixture.units[0]!.id, block_id: fixture.blocks.A },
    ]);
    const hidden = await errorFor(
      callPoll(fixture, 'owner2', 'poll_results_get', [
        fixture.societyId,
        draft.voteId,
      ]),
    );
    expect(hidden.code).toBe('P0002');
  });

  it('rejects poll operations when the society module is disabled', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled=false
         where society_id=$1 and module_key='poll'`,
        [fixture.societyId],
      ),
    );
    const denied = await errorFor(
      callPoll(fixture, 'admin', 'poll_draft_create', [
        fixture.societyId,
        crypto.randomUUID(),
        'public',
      ]),
    );
    expect(denied.code).toBe('42501');
  });
});
