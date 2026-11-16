// Show the society's meeting notice, quorum and action-owner rules; administrators can change them.
import { MeetingRouteState } from '@/components/meeting/shared';
import { MeetingSettingsView } from '@/components/meeting/admin';
import { updateMeetingSettingsAction } from '@/app/(admin)/admin/meetings/server-actions';
import { getMeetingSettings } from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';

export const metadata = {
  title: 'Meeting settings | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminMeetingSettingsPage() {
  const result = await loadMeetingPage(
    ['admin', 'committee'],
    getMeetingSettings,
  );
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/admin/meetings"
        retryHref="/admin/meetings/settings"
      />
    );
  }
  return (
    <MeetingSettingsView
      settings={result.data.settings}
      canManage={result.data.canManage}
      action={result.data.canManage ? updateMeetingSettingsAction : null}
    />
  );
}
