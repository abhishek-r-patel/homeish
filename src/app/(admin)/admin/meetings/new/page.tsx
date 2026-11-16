// Let administrators create a meeting draft with agenda and invitees.
import { MeetingRouteState } from '@/components/meeting/shared';
import { MeetingEditor } from '@/components/meeting/editor';
import { createMeetingAction } from '@/app/(admin)/admin/meetings/server-actions';
import {
  getMeetingInviteeOptions,
  getMeetingSettings,
} from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';

export const metadata = {
  title: 'New meeting | Homeish',
  robots: { index: false, follow: false },
};

export default async function NewMeetingPage() {
  const result = await loadMeetingPage(['admin'], async () => {
    const [options, settings] = await Promise.all([
      getMeetingInviteeOptions(),
      getMeetingSettings(),
    ]);
    return { options, settings: settings.settings };
  });
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/admin/meetings"
        retryHref="/admin/meetings/new"
      />
    );
  }
  return (
    <MeetingEditor
      detail={null}
      options={result.data.options}
      settings={result.data.settings}
      action={createMeetingAction}
      now={new Date().toISOString()}
    />
  );
}
