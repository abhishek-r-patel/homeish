// Let administrators update a draft while preserving its revision contract.
import { notFound } from 'next/navigation';
import { PollRouteState } from '@/components/poll/shared';
import { PollDraftEditor } from '@/components/poll/editor';
import { savePollDraftAction } from '@/app/(admin)/admin/polls/actions';
import { getPollAdminVote, getPollBlocks } from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';
import { z } from 'zod';

export const metadata = {
  title: 'Edit poll draft | Homeish',
  robots: { index: false, follow: false },
};

export default async function EditPollPage({
  params,
}: {
  params: Promise<{ voteId: string }>;
}) {
  const { voteId } = await params;
  if (!z.uuid().safeParse(voteId).success) notFound();
  const result = await loadPollPage(['admin'], async () => {
    const [detail, blocks] = await Promise.all([
      getPollAdminVote(voteId),
      getPollBlocks(),
    ]);
    return { detail, blocks };
  });
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref={`/admin/polls/${voteId}`}
        retryHref={`/admin/polls/${voteId}/edit`}
      />
    );
  }
  if (result.data.detail.vote.status !== 'draft') {
    return (
      <PollRouteState kind="not-found" returnHref={`/admin/polls/${voteId}`} />
    );
  }
  return (
    <PollDraftEditor
      detail={result.data.detail}
      blocks={result.data.blocks}
      action={savePollDraftAction}
    />
  );
}
