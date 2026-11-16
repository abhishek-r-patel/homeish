// Let a resident owner choose eligible representatives for their own units.
import { PollRouteState } from '@/components/poll/shared';
import { PollRepresentativesView } from '@/components/poll/resident';
import { setOwnPollRepresentativeAction } from '@/app/(resident)/polls/actions';
import { getPollRepresentatives } from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';

export const metadata = {
  title: 'Voting representatives | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentPollRepresentativesPage() {
  const result = await loadPollPage(['resident'], getPollRepresentatives);
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/polls"
        retryHref="/polls/representatives"
      />
    );
  }
  return (
    <PollRepresentativesView
      representatives={result.data}
      action={setOwnPollRepresentativeAction}
    />
  );
}
