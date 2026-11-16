// Show authorized poll setup, participation, results and lifecycle actions.
import { notFound } from 'next/navigation';
import { PollRouteState } from '@/components/poll/shared';
import {
  PollAdminDetailView,
  type PollAdminActions,
} from '@/components/poll/admin';
import {
  activatePollAction,
  cancelPollAction,
  completePollEarlyAction,
  deletePollDraftAction,
  extendPollDeadlineAction,
  schedulePollAction,
  withdrawPollScheduleAction,
} from '@/app/(admin)/admin/polls/actions';
import {
  getPollAdminVote,
  getPollParticipation,
  getPollResults,
} from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';
import { z } from 'zod';

export const metadata = {
  title: 'Poll details | Homeish',
  robots: { index: false, follow: false },
};

const actions: PollAdminActions = {
  activate: activatePollAction,
  schedule: schedulePollAction,
  withdraw: withdrawPollScheduleAction,
  extendDeadline: extendPollDeadlineAction,
  completeEarly: completePollEarlyAction,
  cancel: cancelPollAction,
  deleteDraft: deletePollDraftAction,
};

export default async function AdminPollDetailPage({
  params,
}: {
  params: Promise<{ voteId: string }>;
}) {
  const { voteId } = await params;
  if (!z.uuid().safeParse(voteId).success) notFound();
  const result = await loadPollPage(['admin', 'committee'], async () => {
    const detail = await getPollAdminVote(voteId);
    const hasOpened =
      detail.vote.activatedAt !== null ||
      detail.vote.status === 'active' ||
      detail.vote.status === 'completed';
    const hasResults =
      detail.vote.status === 'active' || detail.vote.status === 'completed';
    const [participation, results] = await Promise.all([
      hasOpened ? getPollParticipation(voteId) : null,
      hasResults ? getPollResults(voteId) : null,
    ]);
    return { detail, participation, results };
  });
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/admin/polls"
        retryHref={`/admin/polls/${voteId}`}
      />
    );
  }
  return (
    <PollAdminDetailView
      detail={result.data.detail}
      participation={result.data.participation}
      results={result.data.results}
      actions={actions}
    />
  );
}
