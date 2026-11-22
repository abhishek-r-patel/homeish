// Let administrators edit a draft or scheduled meeting while preserving its version.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MeetingRouteState } from '@/components/meeting/shared';
import { MeetingEditor } from '@/components/meeting/editor';
import {
  archiveMeetingAgendaTemplateAction,
  saveMeetingAgendaTemplateAction,
  updateMeetingAction,
} from '@/app/(admin)/admin/meetings/server-actions';
import {
  getMeetingAgendaTemplates,
  getMeetingAdminDetail,
  getMeetingInviteeOptions,
} from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';

export const metadata = {
  title: 'Edit meeting | Homeish',
  robots: { index: false, follow: false },
};

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  if (!z.uuid().safeParse(meetingId).success) notFound();
  const result = await loadMeetingPage(['admin'], async () => {
    const [detail, options, templates] = await Promise.all([
      getMeetingAdminDetail(meetingId),
      getMeetingInviteeOptions(),
      getMeetingAgendaTemplates(),
    ]);
    return { detail, options, templates: templates.items };
  });
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref={`/admin/meetings/${meetingId}`}
        retryHref={`/admin/meetings/${meetingId}/edit`}
      />
    );
  }
  return (
    <MeetingEditor
      detail={result.data.detail}
      options={result.data.options}
      settings={result.data.detail.settings}
      templates={result.data.templates}
      templateSaveAction={saveMeetingAgendaTemplateAction}
      templateArchiveAction={archiveMeetingAgendaTemplateAction}
      action={updateMeetingAction}
      now={new Date().toISOString()}
    />
  );
}
