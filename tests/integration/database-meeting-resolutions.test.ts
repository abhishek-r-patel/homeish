// Verify meeting resolutions: editing, outcomes after the meeting, deletion and poll links.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  auditActionsFor,
  callMeeting,
  createHeldMeeting,
  createMeeting,
  createMeetingFixture,
  createPollVote,
  createScheduledMeeting,
  databaseTimestamp,
  expectCode,
  expectDomainError,
  records,
  requestId,
  setModule,
  type MeetingFixture,
} from './support/meeting-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('meeting resolution database contracts', () => {
  let database: TestDatabase;
  let fixture: MeetingFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createMeetingFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  function saveResolution(
    meetingId: string,
    resolutionId: string | null,
    version: number | null,
    resolution: Record<string, unknown>,
    request = requestId('resolution'),
  ) {
    return callMeeting(fixture, 'admin', 'meeting_resolution_save', [
      fixture.societyId,
      meetingId,
      resolutionId,
      version,
      resolution,
      request,
    ]);
  }

  async function newResolution(meetingId: string, title = 'Approve accounts') {
    const saved = await saveResolution(meetingId, null, null, {
      title,
      body: 'Synthetic resolution text.',
      agendaItemId: null,
    });
    return {
      resolutionId: saved.resolutionId as string,
      version: saved.version as number,
    };
  }

  function setOutcome(
    resolutionId: string,
    version: number,
    outcome: string,
    votes: [number | null, number | null, number | null] = [null, null, null],
  ) {
    return callMeeting(fixture, 'admin', 'meeting_resolution_outcome_set', [
      fixture.societyId,
      resolutionId,
      version,
      outcome,
      ...votes,
      requestId('outcome'),
    ]);
  }

  function linkPoll(
    resolutionId: string,
    version: number,
    voteId: string | null,
  ) {
    return callMeeting(fixture, 'admin', 'meeting_resolution_poll_link', [
      fixture.societyId,
      resolutionId,
      version,
      voteId,
      requestId('poll-link'),
    ]);
  }

  async function storedPollLink(resolutionId: string) {
    const result = await database.asSuperuser((client) =>
      client.query<{ society_id: string; poll_vote_id: string | null }>(
        `select society_id,poll_vote_id from public.meeting_resolutions where id=$1`,
        [resolutionId],
      ),
    );
    return result.rows[0];
  }

  async function adminResolution(meetingId: string, resolutionId: string) {
    const view = await callMeeting(fixture, 'admin', 'meeting_admin_get', [
      fixture.societyId,
      meetingId,
    ]);
    return records(view.resolutions).find((row) => row.id === resolutionId);
  }

  it('creates and edits resolutions with an agenda link, optimistic versions and length checks', async () => {
    const draft = await createMeeting(fixture);
    const view = await callMeeting(fixture, 'admin', 'meeting_admin_get', [
      fixture.societyId,
      draft.meetingId,
    ]);
    const agendaItemId = records(view.agenda)[0]!.id as string;
    const request = requestId('resolution');
    const created = await saveResolution(
      draft.meetingId,
      null,
      null,
      { title: 'Approve budget', body: null, agendaItemId },
      request,
    );
    expect(created).toMatchObject({ version: 1 });
    expect(await auditActionsFor(fixture, request)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^meeting\./)]),
    );
    const resolutionId = created.resolutionId as string;
    const updated = await saveResolution(draft.meetingId, resolutionId, 1, {
      title: 'Approve revised budget',
      body: 'Body text',
      agendaItemId: null,
    });
    expect(updated).toEqual({ resolutionId, version: 2 });
    await expectCode(
      saveResolution(draft.meetingId, resolutionId, 1, {
        title: 'Stale edit',
        body: null,
        agendaItemId: null,
      }),
      '40001',
    );
    await expectCode(
      saveResolution(draft.meetingId, null, null, {
        title: ' ',
        body: null,
        agendaItemId: null,
      }),
      '22023',
    );
    await expectCode(
      saveResolution(draft.meetingId, null, null, {
        title: 'x'.repeat(201),
        body: null,
        agendaItemId: null,
      }),
      '22023',
    );
    await expectCode(
      saveResolution(draft.meetingId, null, null, {
        title: 'Long body',
        body: 'x'.repeat(5001),
        agendaItemId: null,
      }),
      '22023',
    );
    await expectCode(
      callMeeting(fixture, 'committee', 'meeting_resolution_save', [
        fixture.societyId,
        draft.meetingId,
        null,
        null,
        { title: 'Committee cannot', body: null, agendaItemId: null },
        requestId('resolution'),
      ]),
      '42501',
    );
    expect(await adminResolution(draft.meetingId, resolutionId)).toMatchObject({
      title: 'Approve revised budget',
      body: 'Body text',
      agendaItemId: null,
      outcome: 'pending',
      version: 2,
      poll: null,
    });
  });

  it('records outcomes only once the meeting is held and validates vote counts', async () => {
    const scheduled = await createScheduledMeeting(fixture);
    const early = await newResolution(scheduled.meetingId);
    await expectDomainError(
      setOutcome(early.resolutionId, early.version, 'passed'),
      'meeting_invalid_state',
    );

    const held = await createHeldMeeting(fixture);
    const resolution = await newResolution(held.meetingId);
    await expectCode(
      setOutcome(resolution.resolutionId, resolution.version, 'approved'),
      '22023',
    );
    await expectCode(
      setOutcome(
        resolution.resolutionId,
        resolution.version,
        'passed',
        [-1, 0, 0],
      ),
      '22023',
    );
    const passed = await setOutcome(
      resolution.resolutionId,
      resolution.version,
      'passed',
      [40, 3, 2],
    );
    expect(passed).toEqual({
      resolutionId: resolution.resolutionId,
      version: resolution.version + 1,
    });
    await expectCode(
      setOutcome(resolution.resolutionId, resolution.version, 'failed'),
      '40001',
    );
    expect(
      await adminResolution(held.meetingId, resolution.resolutionId),
    ).toMatchObject({
      outcome: 'passed',
      votesFor: 40,
      votesAgainst: 3,
      votesAbstain: 2,
    });
    const member = await callMeeting(fixture, 'owner', 'meeting_member_get', [
      fixture.societyId,
      held.meetingId,
    ]);
    expect(
      records(member.resolutions).find(
        (row) => row.id === resolution.resolutionId,
      ),
    ).toMatchObject({ outcome: 'passed', votesFor: 40 });

    const scheduledView = await callMeeting(
      fixture,
      'owner',
      'meeting_member_get',
      [fixture.societyId, scheduled.meetingId],
    );
    expect(records(scheduledView.resolutions)).toEqual([]);
  });

  it('deletes only pending, unlinked resolutions and refuses edits on cancelled meetings', async () => {
    const held = await createHeldMeeting(fixture);
    const decided = await newResolution(held.meetingId, 'Decided');
    const decidedNow = await setOutcome(
      decided.resolutionId,
      decided.version,
      'deferred',
    );
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_resolution_delete', [
        fixture.societyId,
        decided.resolutionId,
        decidedNow.version,
        requestId('resolution-delete'),
      ]),
      'meeting_invalid_state',
    );

    const linked = await newResolution(held.meetingId, 'Linked');
    const poll = await createPollVote(fixture);
    const linkedNow = await linkPoll(
      linked.resolutionId,
      linked.version,
      poll.voteId,
    );
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_resolution_delete', [
        fixture.societyId,
        linked.resolutionId,
        linkedNow.version,
        requestId('resolution-delete'),
      ]),
      'meeting_invalid_state',
    );

    const plain = await newResolution(held.meetingId, 'Plain');
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_resolution_delete', [
        fixture.societyId,
        plain.resolutionId,
        plain.version + 1,
        requestId('resolution-delete'),
      ]),
      '40001',
    );
    expect(
      await callMeeting(fixture, 'admin', 'meeting_resolution_delete', [
        fixture.societyId,
        plain.resolutionId,
        plain.version,
        requestId('resolution-delete'),
      ]),
    ).toEqual({ deleted: true });

    const scheduled = await createScheduledMeeting(fixture);
    await callMeeting(fixture, 'admin', 'meeting_cancel', [
      fixture.societyId,
      scheduled.meetingId,
      scheduled.version,
      'Postponed',
      requestId('cancel'),
    ]);
    await expectDomainError(
      saveResolution(scheduled.meetingId, null, null, {
        title: 'Too late',
        body: null,
        agendaItemId: null,
      }),
      'meeting_invalid_state',
    );
  });

  it('links, reports and unlinks polls, refusing disabled, cancelled and foreign polls', async () => {
    const held = await createHeldMeeting(fixture);
    const resolution = await newResolution(held.meetingId);
    const poll = await createPollVote(fixture);

    await setModule(fixture, 'poll', false);
    try {
      await expectDomainError(
        linkPoll(resolution.resolutionId, resolution.version, poll.voteId),
        'meeting_poll_unavailable',
      );
    } finally {
      await setModule(fixture, 'poll', true);
    }

    const foreign = await createPollVote(fixture, 'foreignAdmin');
    await expectDomainError(
      linkPoll(resolution.resolutionId, resolution.version, foreign.voteId),
      'meeting_poll_unavailable',
    );
    await expectDomainError(
      linkPoll(
        resolution.resolutionId,
        resolution.version,
        crypto.randomUUID(),
      ),
      'meeting_poll_unavailable',
    );

    const cancelledPoll = await createPollVote(fixture);
    await callMeeting(fixture, 'admin', 'poll_schedule', [
      fixture.societyId,
      cancelledPoll.voteId,
      cancelledPoll.revision,
      await databaseTimestamp(fixture, "+ interval '1 hour'"),
    ]);
    await callMeeting(fixture, 'admin', 'poll_cancel', [
      fixture.societyId,
      cancelledPoll.voteId,
      'Superseded by the meeting',
    ]);
    await expectDomainError(
      linkPoll(
        resolution.resolutionId,
        resolution.version,
        cancelledPoll.voteId,
      ),
      'meeting_poll_unavailable',
    );

    const linked = await linkPoll(
      resolution.resolutionId,
      resolution.version,
      poll.voteId,
    );
    expect(linked).toEqual({
      resolutionId: resolution.resolutionId,
      version: resolution.version + 1,
      pollVoteId: poll.voteId,
    });
    expect(
      await adminResolution(held.meetingId, resolution.resolutionId),
    ).toMatchObject({
      poll: {
        id: poll.voteId,
        title: 'Synthetic resolution poll',
        status: 'draft',
      },
    });

    // Residents never see a draft poll; it appears once the poll is scheduled.
    const memberResolution = async () =>
      records(
        (
          await callMeeting(fixture, 'owner', 'meeting_member_get', [
            fixture.societyId,
            held.meetingId,
          ])
        ).resolutions,
      ).find((row) => row.id === resolution.resolutionId);
    expect((await memberResolution())?.poll).toBeNull();
    await callMeeting(fixture, 'admin', 'poll_schedule', [
      fixture.societyId,
      poll.voteId,
      poll.revision,
      await databaseTimestamp(fixture, "+ interval '1 hour'"),
    ]);
    expect((await memberResolution())?.poll).toEqual({
      id: poll.voteId,
      title: 'Synthetic resolution poll',
      status: 'scheduled',
    });
    expect(
      (await adminResolution(held.meetingId, resolution.resolutionId))?.poll,
    ).toMatchObject({ status: 'scheduled' });

    await setModule(fixture, 'poll', false);
    try {
      expect(
        (await adminResolution(held.meetingId, resolution.resolutionId))?.poll,
      ).toBeNull();
      const member = await callMeeting(fixture, 'owner', 'meeting_member_get', [
        fixture.societyId,
        held.meetingId,
      ]);
      expect(
        records(member.resolutions).find(
          (row) => row.id === resolution.resolutionId,
        )?.poll,
      ).toBeNull();
      expect(
        (await storedPollLink(resolution.resolutionId))?.poll_vote_id,
      ).toBe(poll.voteId);
    } finally {
      await setModule(fixture, 'poll', true);
    }

    const unlinked = await linkPoll(
      resolution.resolutionId,
      linked.version as number,
      null,
    );
    expect(unlinked).toMatchObject({ pollVoteId: null });
    expect(
      (await storedPollLink(resolution.resolutionId))?.poll_vote_id,
    ).toBeNull();
  });

  it('clears the link but keeps the society when a linked poll draft is deleted', async () => {
    const held = await createHeldMeeting(fixture);
    const resolution = await newResolution(held.meetingId);
    const poll = await createPollVote(fixture);
    await linkPoll(resolution.resolutionId, resolution.version, poll.voteId);
    await callMeeting(fixture, 'admin', 'poll_draft_delete', [
      fixture.societyId,
      poll.voteId,
      poll.revision,
    ]);
    expect(await storedPollLink(resolution.resolutionId)).toEqual({
      society_id: fixture.societyId,
      poll_vote_id: null,
    });
    expect(
      (await adminResolution(held.meetingId, resolution.resolutionId))?.poll,
    ).toBeNull();
  });

  it('caps a meeting at 50 resolutions', async () => {
    const held = await createHeldMeeting(fixture);
    await database.asSuperuser((client) =>
      client.query(
        `insert into public.meeting_resolutions(
           society_id,meeting_id,position,title,created_by,updated_by)
         select $1,$2,n,'Synthetic resolution '||n,$3,$3 from generate_series(1,49) n`,
        [fixture.societyId, held.meetingId, fixture.actors.admin],
      ),
    );
    await newResolution(held.meetingId, 'Fiftieth resolution');
    await expectCode(
      newResolution(held.meetingId, 'Fifty-first resolution'),
      '22023',
    );
  });

  it('freezes resolutions once minutes are published', async () => {
    const held = await createHeldMeeting(fixture);
    const resolution = await newResolution(held.meetingId);
    const minutes = await callMeeting(
      fixture,
      'admin',
      'meeting_minutes_save',
      [
        fixture.societyId,
        held.meetingId,
        null,
        'Synthetic minutes.',
        requestId('minutes'),
      ],
    );
    await callMeeting(fixture, 'admin', 'meeting_minutes_publish', [
      fixture.societyId,
      held.meetingId,
      minutes.version,
      requestId('publish'),
    ]);
    await expectDomainError(
      saveResolution(
        held.meetingId,
        resolution.resolutionId,
        resolution.version,
        {
          title: 'After publish',
          body: null,
          agendaItemId: null,
        },
      ),
      'meeting_invalid_state',
    );
    await expectDomainError(
      setOutcome(resolution.resolutionId, resolution.version, 'passed'),
      'meeting_invalid_state',
    );
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_resolution_delete', [
        fixture.societyId,
        resolution.resolutionId,
        resolution.version,
        requestId('resolution-delete'),
      ]),
      'meeting_invalid_state',
    );
  });
});
