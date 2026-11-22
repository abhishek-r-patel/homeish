// Let administrators create a meeting draft with agenda and invitees.
import { MeetingRouteState } from '@/components/meeting/shared';
import { MeetingEditor } from '@/components/meeting/editor';
import {
  archiveMeetingAgendaTemplateAction,
  createMeetingAction,
  saveMeetingAgendaTemplateAction,
} from '@/app/(admin)/admin/meetings/server-actions';
import {
  getMeetingAgendaTemplates,
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
    const [options, settings, templates] = await Promise.all([
      getMeetingInviteeOptions(),
      getMeetingSettings(),
      getMeetingAgendaTemplates(),
    ]);
    return { options, settings: settings.settings, templates: templates.items };
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
      templates={result.data.templates}
      templateSaveAction={saveMeetingAgendaTemplateAction}
      templateArchiveAction={archiveMeetingAgendaTemplateAction}
      action={createMeetingAction}
      now={new Date().toISOString()}
    />
  );
}
