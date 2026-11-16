// Verify result visibility, turnout privacy, completed snapshots and exports.
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

function objectRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected the poll RPC to return a row list.');
  }
  return value.map((row) => pollObject(row));
}

describe.skipIf(!hasDatabase)('poll result database contracts', () => {
  let database: TestDatabase;
  let fixture: PollFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createPollFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function activate(
    type: 'public' | 'private',
    options: { options?: { label: string }[] } = {},
  ) {
    const draft =
      type === 'private'
        ? await privatePollDraft(fixture)
        : await publicPollDraft(fixture, options);
    const created = await createPollDraft(fixture, type, draft);
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      created.voteId,
      created.revision,
    ]);
    return created.voteId;
  }

  async function finish(voteId: string) {
    await callPoll(fixture, 'admin', 'poll_complete_early', [
      fixture.societyId,
      voteId,
      'Synthetic results are ready',
    ]);
  }

  it('shows live public totals without names, and named frozen responses after completion', async () => {
    const voteId = await activate('public');
    const unitIds = fixture.units.map((unit) => unit.id);
    const optionRows = await database.asSuperuser((client) =>
      client.query<{ id: string }>(
        `select id from public.poll_options
         where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, voteId],
      ),
    );
    const options = optionRows.rows.map((row) => row.id);
    await callPoll(fixture, 'primary', 'poll_ballot_submit', [
      fixture.societyId,
      voteId,
      unitIds[0],
      { optionIds: [options[0]] },
    ]);
    await callPoll(fixture, 'owner2', 'poll_ballot_submit', [
      fixture.societyId,
      voteId,
      unitIds[1],
      { optionIds: [options[1]] },
    ]);

    for (const actor of ['primary', 'committee', 'admin'] as const) {
      const live = pollObject(
        await callPoll(fixture, actor, 'poll_results_get', [
          fixture.societyId,
          voteId,
        ]),
      );
      expect(live).toMatchObject({
        voteId,
        votingType: 'public',
        status: 'active',
        eligible: 2,
        submitted: 2,
        responses: null,
      });
      expect(objectRows(live.options)).toEqual([
        expect.objectContaining({ id: options[0], count: 1 }),
        expect.objectContaining({ id: options[1], count: 1 }),
      ]);
    }

    const committeeRoster = pollObject(
      await callPoll(fixture, 'committee', 'poll_participation_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(committeeRoster).toMatchObject({
      eligible: 2,
      submitted: 2,
      units: null,
    });
    const adminRoster = pollObject(
      await callPoll(fixture, 'admin', 'poll_participation_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(objectRows(adminRoster.units)).toHaveLength(2);

    await finish(voteId);
    const completed = pollObject(
      await callPoll(fixture, 'committee', 'poll_results_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(completed).toMatchObject({
      voteId,
      status: 'completed',
      eligible: 2,
      submitted: 2,
    });
    const responses = objectRows(completed.responses);
    expect(responses).toHaveLength(2);
    expect(responses.map((response) => response.unitLabel).sort()).toEqual([
      'A-101',
      'B-201',
    ]);
    expect(JSON.stringify(completed)).not.toContain('@example.test');
  });

  it('keeps private choices hidden while open and exposes only aggregates plus a separate voter roster when complete', async () => {
    const voteId = await activate('private');
    const office = await database.asSuperuser((client) =>
      client.query<{ office_id: string; candidate_id: string }>(
        `select office.id as office_id,candidate.id as candidate_id
         from public.poll_offices office
         join public.poll_candidates candidate
           on candidate.society_id=office.society_id
          and candidate.vote_id=office.vote_id
          and candidate.office_id=office.id
         where office.society_id=$1 and office.vote_id=$2
         order by office.position,candidate.position`,
        [fixture.societyId, voteId],
      ),
    );
    const officeId = office.rows[0]?.office_id;
    const candidateId = office.rows[0]?.candidate_id;
    if (!officeId || !candidateId)
      throw new Error('Missing private ballot fixture.');
    await callPoll(fixture, 'primary', 'poll_ballot_submit', [
      fixture.societyId,
      voteId,
      fixture.units[0]!.id,
      { choices: [{ officeId, candidateId }] },
    ]);

    for (const actor of ['primary', 'committee', 'admin'] as const) {
      const live = pollObject(
        await callPoll(fixture, actor, 'poll_results_get', [
          fixture.societyId,
          voteId,
        ]),
      );
      expect(live).toMatchObject({
        votingType: 'private',
        status: 'active',
        eligible: 2,
        submitted: 1,
        offices: null,
        responses: null,
      });
      expect(JSON.stringify(live)).not.toContain('Candidate A');
    }
    const liveRoster = pollObject(
      await callPoll(fixture, 'committee', 'poll_participation_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(liveRoster).toMatchObject({
      eligible: 2,
      submitted: 1,
      units: null,
    });
    const adminLiveRoster = pollObject(
      await callPoll(fixture, 'admin', 'poll_participation_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(objectRows(adminLiveRoster.units)).toEqual([
      expect.objectContaining({
        unitId: fixture.units[0]!.id,
        representativeName: 'Synthetic poll primary',
        submitted: true,
      }),
      expect.objectContaining({
        unitId: fixture.units[1]!.id,
        submitted: false,
      }),
    ]);
    expect(JSON.stringify(adminLiveRoster)).not.toContain('Candidate A');

    await finish(voteId);
    const completed = pollObject(
      await callPoll(fixture, 'committee', 'poll_results_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(completed).toMatchObject({
      status: 'completed',
      eligible: 2,
      submitted: 1,
      responses: null,
    });
    const offices = objectRows(completed.offices);
    expect(offices).toHaveLength(1);
    const candidates = objectRows(offices[0]!.candidates);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ id: candidateId, count: 1 });
    expect(offices[0]!.notaCount).toBe(0);

    const privateExport = pollObject(
      await callPoll(fixture, 'committee', 'poll_export_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(privateExport).toMatchObject({
      vote: { id: voteId },
      eligible: 2,
      submitted: 1,
      responses: null,
    });
    expect(objectRows(privateExport.roster)).toEqual([
      expect.objectContaining({
        unitLabel: 'A-101',
        representativeName: 'Synthetic poll primary',
      }),
    ]);
    expect(JSON.stringify(privateExport)).not.toContain('@example.test');
    expect(JSON.stringify(privateExport)).not.toContain(fixture.units[0]!.id);

    const completedRoster = pollObject(
      await callPoll(fixture, 'committee', 'poll_participation_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(objectRows(completedRoster.units)).toHaveLength(2);
  });

  it('makes results unavailable to residents outside the frozen electorate and after cancellation', async () => {
    const scheduled = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_schedule', [
      fixture.societyId,
      scheduled.voteId,
      scheduled.revision,
      await databaseTimestamp(fixture, "+ interval '1 hour'"),
    ]);
    const outside = await errorFor(
      callPoll(fixture, 'outsider', 'poll_results_get', [
        fixture.societyId,
        scheduled.voteId,
      ]),
    );
    expect(outside.code).toBe('P0002');
    await callPoll(fixture, 'admin', 'poll_cancel', [
      fixture.societyId,
      scheduled.voteId,
      'The scheduled meeting was cancelled',
    ]);
    const cancelled = await errorFor(
      callPoll(fixture, 'admin', 'poll_results_get', [
        fixture.societyId,
        scheduled.voteId,
      ]),
    );
    expect(cancelled.code).toBe('P0001');
    expect(cancelled.message).toContain('poll_results_unavailable');
  });

  it('purges per-person public data after two years while preserving final totals', async () => {
    const voteId = await activate('public');
    const options = await database.asSuperuser((client) =>
      client.query<{ id: string }>(
        `select id from public.poll_options
         where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, voteId],
      ),
    );
    await callPoll(fixture, 'primary', 'poll_ballot_submit', [
      fixture.societyId,
      voteId,
      fixture.units[0]!.id,
      { optionIds: [options.rows[0]!.id] },
    ]);
    await finish(voteId);

    await database.asSuperuser(async (client) => {
      await client.query('begin');
      try {
        await client.query(
          "select set_config('poll.lifecycle_write','on',true)",
        );
        await client.query(
          `update public.poll_votes
           set completed_at=clock_timestamp()-interval '3 years'
           where society_id=$1 and id=$2 and status='completed'`,
          [fixture.societyId, voteId],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
    const purged = await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query<{ value: unknown }>(
          'select public.poll_retention_run() as value',
        ),
      { commit: true },
    );
    expect(purged.rows[0]?.value).toMatchObject({ purgedVotes: 1 });

    const remaining = await database.asSuperuser((client) =>
      client.query<{
        response_count: number;
        participation_count: number;
        electorate_count: number;
        final_count: string;
        purged_at: string | null;
      }>(
        `select
          (select count(*)::integer from public.poll_public_responses
           where society_id=vote.society_id and vote_id=vote.id) as response_count,
          (select count(*)::integer from public.poll_participation
           where society_id=vote.society_id and vote_id=vote.id) as participation_count,
          (select count(*)::integer from public.poll_electorate
           where society_id=vote.society_id and vote_id=vote.id) as electorate_count,
          (select sum(option.final_count)::text from public.poll_options option
           where option.society_id=vote.society_id and option.vote_id=vote.id) as final_count,
          vote.personal_data_purged_at::text as purged_at
         from public.poll_votes vote
         where vote.society_id=$1 and vote.id=$2`,
        [fixture.societyId, voteId],
      ),
    );
    expect(remaining.rows[0]).toMatchObject({
      response_count: 0,
      participation_count: 0,
      electorate_count: 0,
      final_count: '1',
    });
    expect(remaining.rows[0]?.purged_at).not.toBeNull();
    const finalResults = pollObject(
      await callPoll(fixture, 'admin', 'poll_results_get', [
        fixture.societyId,
        voteId,
      ]),
    );
    expect(finalResults).toMatchObject({
      status: 'completed',
      submitted: 1,
      responses: null,
    });
    expect(objectRows(finalResults.options)).toEqual([
      expect.objectContaining({ id: options.rows[0]!.id, count: 1 }),
      expect.objectContaining({ id: options.rows[1]!.id, count: 0 }),
    ]);
  });
});
