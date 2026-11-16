// Verify poll draft idempotency, replacement, revision checks and readiness.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  callPoll,
  createPollDraft,
  createPollFixture,
  errorFor,
  pollObject,
  publicPollDraft,
  type PollDraft,
  type PollFixture,
} from './support/poll-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('poll draft database contracts', () => {
  let database: TestDatabase;
  let fixture: PollFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createPollFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('creates drafts idempotently and gives management writes to admins only', async () => {
    const requestId = crypto.randomUUID();
    const first = pollObject(
      await callPoll(fixture, 'admin', 'poll_draft_create', [
        fixture.societyId,
        requestId,
        'public',
      ]),
    );
    const repeated = pollObject(
      await callPoll(fixture, 'admin', 'poll_draft_create', [
        fixture.societyId,
        requestId,
        'public',
      ]),
    );
    expect(repeated).toEqual(first);
    expect(first.revision).toBe(1);

    const denied = await errorFor(
      callPoll(fixture, 'committee', 'poll_draft_create', [
        fixture.societyId,
        crypto.randomUUID(),
        'public',
      ]),
    );
    expect(denied.code).toBe('42501');
    const crossSociety = await errorFor(
      callPoll(fixture, 'foreignAdmin', 'poll_draft_create', [
        fixture.societyId,
        crypto.randomUUID(),
        'public',
      ]),
    );
    expect(crossSociety.code).toBe('42501');
    const inaccessibleList = await errorFor(
      callPoll(fixture, 'foreignAdmin', 'poll_admin_list', [fixture.societyId]),
    );
    expect(inaccessibleList.code).toBe('42501');
    const guard = await errorFor(
      callPoll(fixture, 'guard', 'poll_member_list', [fixture.societyId]),
    );
    expect(guard.code).toBe('42501');
  });

  it('replaces draft children atomically and rejects stale revisions and unknown keys', async () => {
    const draft = await publicPollDraft(fixture);
    const created = pollObject(
      await callPoll(fixture, 'admin', 'poll_draft_create', [
        fixture.societyId,
        crypto.randomUUID(),
        'public',
      ]),
    );
    const voteId = created.voteId;
    expect(typeof voteId).toBe('string');
    const saved = pollObject(
      await callPoll(fixture, 'admin', 'poll_draft_save', [
        fixture.societyId,
        voteId,
        1,
        draft,
      ]),
    );
    expect(saved).toMatchObject({ voteId, revision: 2 });

    const originalOptions = await database.asSuperuser((client) =>
      client.query<{ id: string; label: string }>(
        `select id,label from public.poll_options
         where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, voteId],
      ),
    );
    expect(originalOptions.rows.map((row) => row.label)).toEqual([
      'Option A',
      'Option B',
    ]);

    const replacement: PollDraft = {
      ...draft,
      title: 'Revised synthetic poll',
      options: [{ label: 'New option A' }, { label: 'New option B' }],
    };
    const next = pollObject(
      await callPoll(fixture, 'admin', 'poll_draft_save', [
        fixture.societyId,
        voteId,
        2,
        replacement,
      ]),
    );
    expect(next).toMatchObject({ voteId, revision: 3 });
    const currentOptions = await database.asSuperuser((client) =>
      client.query<{ id: string; label: string }>(
        `select id,label from public.poll_options
         where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, voteId],
      ),
    );
    expect(currentOptions.rows.map((row) => row.label)).toEqual([
      'New option A',
      'New option B',
    ]);
    expect(
      currentOptions.rows.some((row) =>
        originalOptions.rows.some((original) => original.id === row.id),
      ),
    ).toBe(false);

    const stale = await errorFor(
      callPoll(fixture, 'admin', 'poll_draft_save', [
        fixture.societyId,
        voteId,
        2,
        replacement,
      ]),
    );
    expect(stale.code).toBe('40001');
    const unknownKey = await errorFor(
      callPoll(fixture, 'admin', 'poll_draft_save', [
        fixture.societyId,
        voteId,
        3,
        { ...replacement, unrecognizedField: true },
      ]),
    );
    expect(unknownKey.code).toBe('22023');
    const unchanged = await database.asSuperuser((client) =>
      client.query<{ label: string }>(
        `select label from public.poll_options
         where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, voteId],
      ),
    );
    expect(unchanged.rows.map((row) => row.label)).toEqual([
      'New option A',
      'New option B',
    ]);
  });

  it('allows incomplete drafts but blocks activation with readiness issues', async () => {
    const draft = await publicPollDraft(fixture, { options: [] });
    const created = pollObject(
      await callPoll(fixture, 'admin', 'poll_draft_create', [
        fixture.societyId,
        crypto.randomUUID(),
        'public',
      ]),
    );
    const voteId = created.voteId;
    expect(typeof voteId).toBe('string');
    await callPoll(fixture, 'admin', 'poll_draft_save', [
      fixture.societyId,
      voteId,
      1,
      draft,
    ]);

    const error = await errorFor(
      callPoll(fixture, 'admin', 'poll_activate', [
        fixture.societyId,
        voteId,
        2,
      ]),
    );
    expect(error.code).toBe('P0001');
    expect(error.message).toContain('poll_not_ready');
    expect(error.detail).toContain('options_too_few');
    const state = await database.asSuperuser((client) =>
      client.query<{ status: string; electorate_count: number }>(
        `select vote.status,
          (select count(*)::integer from public.poll_electorate electorate
           where electorate.society_id=vote.society_id
             and electorate.vote_id=vote.id) as electorate_count
         from public.poll_votes vote
         where vote.society_id=$1 and vote.id=$2`,
        [fixture.societyId, voteId],
      ),
    );
    expect(state.rows[0]).toEqual({
      status: 'draft',
      electorate_count: 0,
    });
  });

  it('deletes only a draft at its expected revision', async () => {
    const { voteId, revision } = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture),
    );
    const stale = await errorFor(
      callPoll(fixture, 'admin', 'poll_draft_delete', [
        fixture.societyId,
        voteId,
        revision - 1,
      ]),
    );
    expect(stale.code).toBe('40001');

    expect(
      await callPoll(fixture, 'admin', 'poll_draft_delete', [
        fixture.societyId,
        voteId,
        revision,
      ]),
    ).toMatchObject({ deleted: true });
    const absent = await database.asSuperuser((client) =>
      client.query(
        'select id from public.poll_votes where society_id=$1 and id=$2',
        [fixture.societyId, voteId],
      ),
    );
    expect(absent.rowCount).toBe(0);
  });
});
