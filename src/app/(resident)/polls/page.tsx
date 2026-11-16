// Show the resident's frozen-electorate poll list.
import { PollRouteState } from '@/components/poll/shared';
import { ResidentPollListView } from '@/components/poll/resident';
import { getPollMemberList } from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';

export const metadata = {
  title: 'Polls | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentPollsPage() {
  const result = await loadPollPage(['resident'], getPollMemberList);
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/home"
        retryHref="/polls"
      />
    );
  }
  return <ResidentPollListView polls={result.data} />;
}
