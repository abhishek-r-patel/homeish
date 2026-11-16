// List the administrator's or committee member's own meeting action items.
import { MeetingRouteState } from '@/components/meeting/shared';
import { MyMeetingActionsView } from '@/components/meeting/resident';
import { setMeetingActionStatusAction } from '@/app/(admin)/admin/meetings/server-actions';
import { getMyMeetingActions } from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';

export const metadata = {
  title: 'My action items | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminMeetingActionsPage() {
  const result = await loadMeetingPage(
    ['admin', 'committee'],
    getMyMeetingActions,
  );
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/admin/meetings"
        retryHref="/admin/meetings/actions"
      />
    );
  }
  return (
    <MyMeetingActionsView
      actions={result.data}
      statusAction={setMeetingActionStatusAction}
      meetingHrefBase="/admin/meetings"
      backHref="/admin/meetings"
    />
  );
}
