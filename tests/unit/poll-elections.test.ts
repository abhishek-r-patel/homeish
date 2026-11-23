// Verify P46 input boundaries and privacy-safe summary rendering.
import { describe, expect, it } from 'vitest';
import {
  POLL_OFFICIAL_CONFIRMATION,
  pollElectionBallotInputSchema,
  pollElectionDisputeInputSchema,
  pollElectionSaveInputSchema,
  pollOfficialVotingInputSchema,
} from '../../src/core/poll/election-inputs';
import { pollElectionSummaryPdf } from '../../src/core/poll/election-documents';
import type { PollElectionDetail } from '../../src/core/poll/election-read-model';

const id = '00000000-0000-4000-8000-000000000201';

describe('P46 official election inputs', () => {
  it('requires the exact accepted-risk confirmation to switch on', () => {
    expect(
      pollOfficialVotingInputSchema.safeParse({
        enabled: true,
        legalType: 'cooperative',
        confirmation: 'I checked it',
        clientRequestId: id,
      }).success,
    ).toBe(false);
    expect(
      pollOfficialVotingInputSchema.parse({
        enabled: true,
        legalType: 'cooperative',
        confirmation: POLL_OFFICIAL_CONFIRMATION,
        clientRequestId: id,
      }).enabled,
    ).toBe(true);
  });

  it('requires paired windows, posts and an edit version', () => {
    expect(
      pollElectionSaveInputSchema.safeParse({
        electionId: id,
        title: 'Synthetic election',
        nominationsOpenAt: '2026-12-01T09:00:00Z',
        nominationsCloseAt: null,
        votingOpensAt: null,
        votingClosesAt: null,
        posts: [{ name: 'Chair', seats: 1 }],
        expectedRevision: 1,
        clientRequestId: '00000000-0000-4000-8000-000000000202',
      }).success,
    ).toBe(false);
    expect(
      pollElectionBallotInputSchema.safeParse({
        electionId: id,
        unitId: '00000000-0000-4000-8000-000000000203',
        choices: [{ postId: id, candidateId: null }],
      }).success,
    ).toBe(true);
  });

  it('bounds dispute text and keeps a private-file path optional', () => {
    expect(
      pollElectionDisputeInputSchema.safeParse({
        electionId: id,
        text: ' ',
        filePath: null,
        clientRequestId: '00000000-0000-4000-8000-000000000204',
      }).success,
    ).toBe(false);
  });

  it('renders a PDF summary without per-voter or per-choice fields', async () => {
    const detail = {
      id,
      society_name: 'Synthetic Society',
      title: 'Synthetic election',
      legal_type: 'cooperative',
      stage: 'declared',
      source: 'in_app',
      revision: 4,
      nominations_open_at: null,
      nominations_close_at: null,
      voting_opens_at: null,
      voting_closes_at: null,
      declared_at: '2026-12-10T00:00:00Z',
      outside_held_on: null,
      closed_at: null,
      cancelled_at: null,
      cancellation_reason: null,
      dispute_window_days: 5,
      multi_post_win_rule: 'candidate_choice',
      can_manage: true,
      is_officer: false,
      actor_id: id,
      posts: [],
      activities: [],
      links: [],
      officer: null,
      helpers: [],
      voters: [],
      member_options: [],
      source_options: { notices: [], meetings: [], documents: [] },
      expense_options: [],
      my_unit_id: null,
      my_unit_has_voted: false,
      nominations: [],
      results: [
        {
          post_id: id,
          post_name: 'Secretary',
          tallies: [],
          winners: [
            {
              candidate_user_id: id,
              candidate_name: 'Synthetic winner',
              unopposed: false,
            },
          ],
        },
      ],
      outside_results: [],
      participation_count: 2,
      voter_count: 3,
      voted_units: [],
      dispute_count: 0,
      disputes: [],
      total_cost_paise: 10000,
      expense_links: [],
    } satisfies PollElectionDetail;
    const pdf = await pollElectionSummaryPdf('Synthetic Society', detail);
    const text = new TextDecoder().decode(pdf);
    expect(text.slice(0, 5)).toBe('%PDF-');
    expect(text).not.toContain('unit_label');
    expect(text).not.toContain('candidate_user_id');
  });
});
