// List the resident's own meeting action items and let them mark progress.
import { MeetingRouteState } from '@/components/meeting/shared';
import { MyMeetingActionsView } from '@/components/meeting/resident';
import { setMyMeetingActionStatusAction } from '@/app/(resident)/meetings/server-actions';
import { getMyMeetingActions } from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';

export const metadata = {
  title: 'My action items | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentMeetingActionsPage() {
  const result = await loadMeetingPage(['resident'], getMyMeetingActions);
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/meetings"
        retryHref="/meetings/actions"
      />
    );
  }
  return (
    <MyMeetingActionsView
      actions={result.data}
      statusAction={setMyMeetingActionStatusAction}
      meetingHrefBase="/meetings"
      backHref="/meetings"
    />
  );
}
