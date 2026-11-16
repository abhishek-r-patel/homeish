// Project authorized poll totals into percentages and plain-language outcomes.
import type { PollResults } from './validation';

type Percentage = number | null;
type PublicOutcome =
  | { kind: 'no_votes' }
  | { kind: 'tie'; labels: string[] }
  | { kind: 'winner'; label: string };
type PrivateOutcome =
  | { kind: 'no_winner' }
  | { kind: 'tie'; names: string[] }
  | { kind: 'winner'; name: string };

export function pollPercentage(count: number, denominator: number): Percentage {
  return denominator === 0 ? null : (count / denominator) * 100;
}

export function pollTurnoutPercentage(
  submitted: number,
  eligible: number,
): Percentage {
  return pollPercentage(submitted, eligible);
}

export function publicPollOutcome(
  options: readonly { label: string; count: number }[],
): PublicOutcome {
  const maximum = Math.max(0, ...options.map(({ count }) => count));
  if (maximum === 0) return { kind: 'no_votes' };
  const leaders = options
    .filter(({ count }) => count === maximum)
    .map(({ label }) => label);
  return leaders.length === 1
    ? { kind: 'winner', label: leaders[0]! }
    : { kind: 'tie', labels: leaders };
}

export function privatePollOutcome(
  candidates: readonly { name: string; count: number }[],
): PrivateOutcome {
  const maximum = Math.max(0, ...candidates.map(({ count }) => count));
  if (maximum === 0) return { kind: 'no_winner' };
  const leaders = candidates
    .filter(({ count }) => count === maximum)
    .map(({ name }) => name);
  return leaders.length === 1
    ? { kind: 'winner', name: leaders[0]! }
    : { kind: 'tie', names: leaders };
}

export function projectPollResults(result: PollResults) {
  const turnoutPercent = pollTurnoutPercentage(
    result.submitted,
    result.eligible,
  );
  if (result.votingType === 'public') {
    const options = result.options ?? [];
    return {
      votingType: 'public' as const,
      eligible: result.eligible,
      submitted: result.submitted,
      turnoutPercent,
      options: options.map((option) => ({
        ...option,
        submittedPercent: pollPercentage(option.count, result.submitted),
        eligiblePercent: pollPercentage(option.count, result.eligible),
      })),
      outcome: publicPollOutcome(options),
      responses: result.responses,
    };
  }

  const offices = result.offices ?? [];
  return {
    votingType: 'private' as const,
    eligible: result.eligible,
    submitted: result.submitted,
    turnoutPercent,
    offices: offices.map((office) => ({
      ...office,
      candidates: office.candidates.map((candidate) => ({
        ...candidate,
        submittedPercent: pollPercentage(candidate.count, result.submitted),
        eligiblePercent: pollPercentage(candidate.count, result.eligible),
      })),
      notaSubmittedPercent: pollPercentage(office.notaCount, result.submitted),
      notaEligiblePercent: pollPercentage(office.notaCount, result.eligible),
      outcome: privatePollOutcome(office.candidates),
    })),
  };
}

export type PollPublicOutcome = PublicOutcome;
export type PollPrivateOutcome = PrivateOutcome;
