// Verify public ballot replacement, atomic validation and private one-time voting.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  callPoll,
  createPollDraft,
  createPollFixture,
  errorFor,
  privatePollDraft,
  publicPollDraft,
  type PollFixture,
} from './support/poll-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('poll ballot database contracts', () => {
  let database: TestDatabase;
  let fixture: PollFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createPollFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function activatePublic(options = ['Option A', 'Option B']) {
    const draft = await publicPollDraft(fixture, {
      selectionMode: options.length > 2 ? 'multiple' : 'single',
      selectionLimit: options.length > 2 ? 2 : 1,
      options: options.map((label) => ({ label })),
    });
    const created = await createPollDraft(fixture, 'public', draft);
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      created.voteId,
      created.revision,
    ]);
    const result = await database.asSuperuser((client) =>
      client.query<{ id: string }>(
        `select id from public.poll_options
         where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, created.voteId],
      ),
    );
    return {
      voteId: created.voteId,
      optionIds: result.rows.map((row) => row.id),
    };
  }

  async function activatePrivate() {
    const created = await createPollDraft(
      fixture,
      'private',
      await privatePollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      created.voteId,
      created.revision,
    ]);
    const rows = await database.asSuperuser((client) =>
      client.query<{ office_id: string; candidate_id: string | null }>(
        `select office.id as office_id,candidate.id as candidate_id
         from public.poll_offices office
         left join public.poll_candidates candidate
           on candidate.society_id=office.society_id
          and candidate.vote_id=office.vote_id
          and candidate.office_id=office.id
         where office.society_id=$1 and office.vote_id=$2
         order by office.position,candidate.position`,
        [fixture.societyId, created.voteId],
      ),
    );
    const officeId = rows.rows[0]?.office_id;
    const candidateId = rows.rows.find((row) => row.candidate_id)?.candidate_id;
    if (!officeId || !candidateId) {
      throw new Error(
        'The active private poll did not expose its configured ballot.',
      );
    }
    return { voteId: created.voteId, officeId, candidateId };
  }

  it('lets the frozen representative replace a complete public ballot until closing', async () => {
    const { voteId, optionIds } = await activatePublic();
    expect(optionIds).toHaveLength(2);
    const unitId = fixture.units[0]!.id;
    const first = await callPoll(fixture, 'primary', 'poll_ballot_submit', [
      fixture.societyId,
      voteId,
      unitId,
      { optionIds: [optionIds[0]] },
    ]);
    expect(first).toMatchObject({ voteId, unitId, submitted: true });

    await callPoll(fixture, 'primary', 'poll_ballot_submit', [
      fixture.societyId,
      voteId,
      unitId,
      { optionIds: [optionIds[1]] },
    ]);
    const current = await database.asSuperuser((client) =>
      client.query<{ option_id: string }>(
        `select option_id from public.poll_public_responses
         where society_id=$1 and vote_id=$2 and unit_id=$3`,
        [fixture.societyId, voteId, unitId],
      ),
    );
    expect(current.rows).toEqual([{ option_id: optionIds[1] }]);
    const participation = await database.asSuperuser((client) =>
      client.query<{ count: number }>(
        `select count(*)::integer as count from public.poll_participation
         where society_id=$1 and vote_id=$2 and unit_id=$3`,
        [fixture.societyId, voteId, unitId],
      ),
    );
    expect(participation.rows[0]?.count).toBe(1);

    const nonRepresentative = await errorFor(
      callPoll(fixture, 'backup', 'poll_ballot_submit', [
        fixture.societyId,
        voteId,
        unitId,
        { optionIds: [optionIds[0]] },
      ]),
    );
    expect(nonRepresentative.code).toBe('P0001');
    expect(nonRepresentative.message).toContain('poll_not_eligible');
  });

  it('serializes competing public replacements into one current response set', async () => {
    const { voteId, optionIds } = await activatePublic();
    const unitId = fixture.units[0]!.id;
    const replacements = await Promise.allSettled(
      optionIds.map((optionId) =>
        callPoll(fixture, 'primary', 'poll_ballot_submit', [
          fixture.societyId,
          voteId,
          unitId,
          { optionIds: [optionId] },
        ]),
      ),
    );
    expect(
      replacements.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(2);
    const current = await database.asSuperuser((client) =>
      client.query<{ option_id: string }>(
        `select option_id from public.poll_public_responses
         where society_id=$1 and vote_id=$2 and unit_id=$3`,
        [fixture.societyId, voteId, unitId],
      ),
    );
    expect(current.rows).toHaveLength(1);
    expect(optionIds).toContain(current.rows[0]?.option_id);
    const participation = await database.asSuperuser((client) =>
      client.query<{ count: number }>(
        `select count(*)::integer as count from public.poll_participation
         where society_id=$1 and vote_id=$2 and unit_id=$3`,
        [fixture.societyId, voteId, unitId],
      ),
    );
    expect(participation.rows[0]?.count).toBe(1);
  });

  it('rejects malformed, duplicate, foreign and over-limit public choices atomically', async () => {
    const { voteId, optionIds } = await activatePublic([
      'Option A',
      'Option B',
      'Option C',
    ]);
    const unitId = fixture.units[0]!.id;
    const invalidSubmissions: unknown[] = [
      {},
      { optionIds: [] },
      { optionIds: [optionIds[0], optionIds[0]] },
      { optionIds: [optionIds[0], optionIds[1], optionIds[2]] },
      { optionIds: [crypto.randomUUID()] },
      { optionIds: [optionIds[0]], userId: fixture.actors.primary },
    ];
    for (const submission of invalidSubmissions) {
      const error = await errorFor(
        callPoll(fixture, 'primary', 'poll_ballot_submit', [
          fixture.societyId,
          voteId,
          unitId,
          submission,
        ]),
      );
      expect(error.code).toBe('P0001');
      expect(error.message).toContain('poll_ballot_invalid');
    }
    const writes = await database.asSuperuser((client) =>
      client.query<{ participation_count: number; response_count: number }>(
        `select
          (select count(*)::integer from public.poll_participation
           where society_id=$1 and vote_id=$2) as participation_count,
          (select count(*)::integer from public.poll_public_responses
           where society_id=$1 and vote_id=$2) as response_count`,
        [fixture.societyId, voteId],
      ),
    );
    expect(writes.rows[0]).toEqual({
      participation_count: 0,
      response_count: 0,
    });
  });

  it('counts explicit private NOTA and rejects a repeat without changing tallies', async () => {
    const { voteId, officeId } = await activatePrivate();
    const unitId = fixture.units[0]!.id;
    const invalidSubmissions: unknown[] = [
      { choices: [] },
      { choices: [{ officeId }] },
      { choices: [{ officeId, candidateId: crypto.randomUUID() }] },
      {
        choices: [
          { officeId, candidateId: null },
          { officeId, candidateId: null },
        ],
      },
      {
        choices: [
          { officeId, candidateId: null, userId: fixture.actors.primary },
        ],
      },
    ];
    for (const submission of invalidSubmissions) {
      const error = await errorFor(
        callPoll(fixture, 'primary', 'poll_ballot_submit', [
          fixture.societyId,
          voteId,
          unitId,
          submission,
        ]),
      );
      expect(error.code).toBe('P0001');
      expect(error.message).toContain('poll_ballot_invalid');
    }
    const untouched = await database.asSuperuser((client) =>
      client.query<{ participation_count: number; total_tally: string }>(
        `select
          (select count(*)::integer from public.poll_participation
           where society_id=$1 and vote_id=$2) as participation_count,
          (select sum(accepted_count)::text from public.poll_private_tallies
           where society_id=$1 and vote_id=$2) as total_tally`,
        [fixture.societyId, voteId],
      ),
    );
    expect(untouched.rows[0]).toEqual({
      participation_count: 0,
      total_tally: '0',
    });

    const accepted = await callPoll(fixture, 'primary', 'poll_ballot_submit', [
      fixture.societyId,
      voteId,
      unitId,
      { choices: [{ officeId, candidateId: null }] },
    ]);
    expect(accepted).toMatchObject({ voteId, unitId, submitted: true });

    const repeat = await errorFor(
      callPoll(fixture, 'primary', 'poll_ballot_submit', [
        fixture.societyId,
        voteId,
        unitId,
        { choices: [{ officeId, candidateId: null }] },
      ]),
    );
    expect(repeat.code).toBe('P0001');
    expect(repeat.message).toContain('poll_already_submitted');

    const counts = await database.asSuperuser((client) =>
      client.query<{
        candidate_id: string | null;
        accepted_count: string;
      }>(
        `select candidate_id,accepted_count::text
         from public.poll_private_tallies
         where society_id=$1 and vote_id=$2 and office_id=$3
         order by candidate_id nulls first`,
        [fixture.societyId, voteId, officeId],
      ),
    );
    expect(counts.rows).toHaveLength(3);
    expect(
      counts.rows.find((row) => row.candidate_id === null)?.accepted_count,
    ).toBe('1');
    expect(
      counts.rows
        .filter((row) => row.candidate_id !== null)
        .every((row) => row.accepted_count === '0'),
    ).toBe(true);

    const choiceLinks = await database.asSuperuser((client) =>
      client.query<{ count: number }>(
        `select count(*)::integer as count
         from information_schema.columns
         where table_schema='public' and table_name='poll_private_tallies'
           and column_name in
             ('unit_id','membership_id','user_id','accepted_at','submitted_at')`,
      ),
    );
    expect(choiceLinks.rows[0]?.count).toBe(0);
    const participation = await database.asSuperuser((client) =>
      client.query<{ count: number }>(
        `select count(*)::integer as count
         from public.poll_participation
         where society_id=$1 and vote_id=$2 and unit_id=$3`,
        [fixture.societyId, voteId, unitId],
      ),
    );
    expect(participation.rows[0]?.count).toBe(1);
  });

  it('serializes competing private submissions to exactly one accepted ballot', async () => {
    const { voteId, officeId, candidateId } = await activatePrivate();
    const unitId = fixture.units[0]!.id;
    const submissions = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        callPoll(fixture, 'primary', 'poll_ballot_submit', [
          fixture.societyId,
          voteId,
          unitId,
          { choices: [{ officeId, candidateId }] },
        ]),
      ),
    );
    expect(
      submissions.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      submissions.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const state = await database.asSuperuser((client) =>
      client.query<{ participation: number; accepted_count: string }>(
        `select
          (select count(*)::integer from public.poll_participation
           where society_id=$1 and vote_id=$2 and unit_id=$3) as participation,
          (select sum(accepted_count)::text from public.poll_private_tallies
           where society_id=$1 and vote_id=$2 and office_id=$4) as accepted_count`,
        [fixture.societyId, voteId, unitId, officeId],
      ),
    );
    expect(state.rows[0]).toEqual({ participation: 1, accepted_count: '1' });
  });

  it('rejects a ballot after the database deadline and leaves no participation', async () => {
    const { voteId, optionIds } = await activatePublic();
    const unitId = fixture.units[0]!.id;
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
          [fixture.societyId, voteId],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });

    const late = await errorFor(
      callPoll(fixture, 'primary', 'poll_ballot_submit', [
        fixture.societyId,
        voteId,
        unitId,
        { optionIds: [optionIds[0]] },
      ]),
    );
    expect(late.code).toBe('P0001');
    expect(late.message).toContain('poll_closed');
    const writes = await database.asSuperuser((client) =>
      client.query<{ participation_count: number; response_count: number }>(
        `select
          (select count(*)::integer from public.poll_participation
           where society_id=$1 and vote_id=$2) as participation_count,
          (select count(*)::integer from public.poll_public_responses
           where society_id=$1 and vote_id=$2) as response_count`,
        [fixture.societyId, voteId],
      ),
    );
    expect(writes.rows[0]).toEqual({
      participation_count: 0,
      response_count: 0,
    });
  });
});
