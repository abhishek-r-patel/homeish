// Show the administrator and committee meetings workspace with a status filter.
import { MeetingRouteState } from '@/components/meeting/shared';
import { MeetingAdminListView } from '@/components/meeting/admin';
import { getMeetingAdminList } from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';
import { meetingListFilterSchema } from '@/core/meeting/validation';

export const metadata = {
  title: 'Meetings | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = meetingListFilterSchema.parse(
    typeof rawStatus === 'string' ? rawStatus : null,
  );
  const result = await loadMeetingPage(['admin', 'committee'], () =>
    getMeetingAdminList(status),
  );
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/admin"
        retryHref="/admin/meetings"
      />
    );
  }
  return <MeetingAdminListView workspace={result.data} status={status} />;
}
