// Create a public poll or private election draft.
import { PollRouteState } from '@/components/poll/shared';
import { NewPollView } from '@/components/poll/admin';
import { createPollDraftAction } from '@/app/(admin)/admin/polls/actions';
import { loadPollPage } from '@/core/poll/page-access';

export const metadata = {
  title: 'New poll | Homeish',
  robots: { index: false, follow: false },
};

export default async function NewPollPage() {
  const result = await loadPollPage(['admin'], async () => true);
  if (result.state) {
    return <PollRouteState kind={result.state} returnHref="/admin/polls" />;
  }
  return <NewPollView action={createPollDraftAction} />;
}
