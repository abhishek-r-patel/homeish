// Show the resident's upcoming and past meetings with their own action items.
import { MeetingRouteState } from '@/components/meeting/shared';
import { ResidentMeetingListView } from '@/components/meeting/resident';
import { setMyMeetingActionStatusAction } from '@/app/(resident)/meetings/server-actions';
import { getMeetingMemberList } from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';

export const metadata = {
  title: 'Meetings | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentMeetingsPage() {
  const result = await loadMeetingPage(['resident'], getMeetingMemberList);
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/home"
        retryHref="/meetings"
      />
    );
  }
  return (
    <ResidentMeetingListView
      workspace={result.data}
      now={new Date().toISOString()}
      statusAction={setMyMeetingActionStatusAction}
    />
  );
}
