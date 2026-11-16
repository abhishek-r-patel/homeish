// Verify public and private poll projections, including zero and tied totals.
import { describe, expect, it } from 'vitest';
import {
  pollPercentage,
  pollTurnoutPercentage,
  projectPollResults,
  publicPollOutcome,
  privatePollOutcome,
} from '../../src/core/poll/results';
import type { PollResults } from '../../src/core/poll/validation';

const publicResults: PollResults = {
  voteId: '00000000-0000-4000-8000-000000000001',
  votingType: 'public',
  status: 'completed',
  selectionMode: 'multiple',
  eligible: 4,
  submitted: 2,
  options: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      label: 'Garden',
      count: 2,
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      label: 'Lift',
      count: 1,
    },
  ],
  offices: null,
  responses: null,
};

describe('poll results projection', () => {
  it('uses the submitted and eligible denominators independently', () => {
    const result = projectPollResults(publicResults);
    expect(result.votingType).toBe('public');
    if (result.votingType !== 'public')
      throw new Error('Expected public results');
    expect(result.turnoutPercent).toBe(50);
    expect(
      result.options.map(({ submittedPercent, eligiblePercent }) => [
        submittedPercent,
        eligiblePercent,
      ]),
    ).toEqual([
      [100, 50],
      [50, 25],
    ]);
    expect(result.outcome).toEqual({ kind: 'winner', label: 'Garden' });
  });

  it('does not invent percentages or a winner for zero totals', () => {
    expect(pollPercentage(0, 0)).toBeNull();
    expect(pollTurnoutPercentage(0, 0)).toBeNull();
    expect(publicPollOutcome([{ label: 'A', count: 0 }])).toEqual({
      kind: 'no_votes',
    });
    expect(
      privatePollOutcome([
        { name: 'Candidate A', count: 0 },
        { name: 'Candidate B', count: 0 },
      ]),
    ).toEqual({ kind: 'no_winner' });
  });

  it('reports all equal positive leaders as a tie', () => {
    expect(
      publicPollOutcome([
        { label: 'Garden', count: 3 },
        { label: 'Lift', count: 3 },
      ]),
    ).toEqual({ kind: 'tie', labels: ['Garden', 'Lift'] });
    expect(
      privatePollOutcome([
        { name: 'Candidate A', count: 3 },
        { name: 'Candidate B', count: 3 },
      ]),
    ).toEqual({ kind: 'tie', names: ['Candidate A', 'Candidate B'] });
  });

  it('keeps NOTA in the private totals but never considers it a winner', () => {
    const result: PollResults = {
      voteId: publicResults.voteId,
      votingType: 'private',
      status: 'completed',
      selectionMode: 'single',
      eligible: 10,
      submitted: 5,
      options: null,
      offices: [
        {
          id: '00000000-0000-4000-8000-000000000004',
          name: 'Committee chair',
          candidates: [
            {
              id: '00000000-0000-4000-8000-000000000005',
              name: 'Candidate A',
              count: 2,
            },
            {
              id: '00000000-0000-4000-8000-000000000006',
              name: 'Candidate B',
              count: 0,
            },
          ],
          notaCount: 3,
        },
      ],
      responses: null,
    };
    const projection = projectPollResults(result);
    expect(projection.votingType).toBe('private');
    if (projection.votingType !== 'private')
      throw new Error('Expected private results');
    expect(projection.offices[0]?.notaSubmittedPercent).toBe(60);
    expect(projection.offices[0]?.outcome).toEqual({
      kind: 'winner',
      name: 'Candidate A',
    });
  });
});
