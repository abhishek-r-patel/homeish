// Let administrators manage voting representatives for active units.
import { PollRouteState } from '@/components/poll/shared';
import { PollRepresentativesView } from '@/components/poll/resident';
import { setPollRepresentativeAction } from '@/app/(admin)/admin/polls/actions';
import { getPollRepresentatives } from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';

export const metadata = {
  title: 'Voting representatives | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminPollRepresentativesPage() {
  const result = await loadPollPage(['admin'], getPollRepresentatives);
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/admin/polls"
        retryHref="/admin/polls/representatives"
      />
    );
  }
  return (
    <PollRepresentativesView
      representatives={result.data}
      action={setPollRepresentativeAction}
    />
  );
}
