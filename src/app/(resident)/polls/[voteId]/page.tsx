// Show an authorized poll summary, representative ballot and permitted results.
import { notFound } from 'next/navigation';
import { PollRouteState } from '@/components/poll/shared';
import { ResidentPollDetailView } from '@/components/poll/resident';
import {
  submitPollPrivateBallotAction,
  submitPollPublicBallotAction,
} from '@/app/(resident)/polls/actions';
import { getPollMemberVote, getPollResults } from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';
import { z } from 'zod';

export const metadata = {
  title: 'Poll | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentPollDetailPage({
  params,
}: {
  params: Promise<{ voteId: string }>;
}) {
  const { voteId } = await params;
  if (!z.uuid().safeParse(voteId).success) notFound();
  const result = await loadPollPage(['resident'], async () => {
    const detail = await getPollMemberVote(voteId);
    const results =
      detail.vote.status === 'active' || detail.vote.status === 'completed'
        ? await getPollResults(voteId)
        : null;
    return { detail, results };
  });
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/polls"
        retryHref={`/polls/${voteId}`}
      />
    );
  }
  return (
    <ResidentPollDetailView
      detail={result.data.detail}
      results={result.data.results}
      now={new Date().toISOString()}
      publicAction={submitPollPublicBallotAction}
      privateAction={submitPollPrivateBallotAction}
    />
  );
}
