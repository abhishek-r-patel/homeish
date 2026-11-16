// Configure the society default for tenant representative eligibility.
import { PollRouteState } from '@/components/poll/shared';
import { PollSettingsView } from '@/components/poll/admin';
import { updatePollSettingsAction } from '@/app/(admin)/admin/polls/actions';
import { getPollSettings } from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';

export const metadata = {
  title: 'Poll settings | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminPollSettingsPage() {
  const result = await loadPollPage(['admin'], getPollSettings);
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/admin/polls"
        retryHref="/admin/polls/settings"
      />
    );
  }
  return (
    <PollSettingsView
      settings={result.data}
      action={updatePollSettingsAction}
    />
  );
}
