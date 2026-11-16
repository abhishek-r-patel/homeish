// Show meeting details, lifecycle, attendance, resolutions, minutes and action items.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MeetingRouteState } from '@/components/meeting/shared';
import {
  MeetingAdminDetailView,
  type MeetingAdminActions,
} from '@/components/meeting/admin';
import {
  cancelMeetingAction,
  createMeetingResolutionPollAction,
  deleteMeetingDraftAction,
  deleteMeetingResolutionAction,
  linkMeetingResolutionPollAction,
  markMeetingHeldAction,
  publishMeetingMinutesAction,
  removeMeetingAttendanceAction,
  retryMeetingMinutesCopyAction,
  saveMeetingActionItemAction,
  saveMeetingMinutesAction,
  saveMeetingResolutionAction,
  scheduleMeetingAction,
  searchMeetingOwnersAction,
  setMeetingActionStatusAction,
  setMeetingAttendanceAction,
  setMeetingCheckinAction,
  setMeetingResolutionOutcomeAction,
} from '@/app/(admin)/admin/meetings/server-actions';
import {
  getMeetingAdminDetail,
  getMeetingDocumentFolders,
} from '@/core/meeting/operations';
import { loadMeetingPage } from '@/core/meeting/page-access';

export const metadata = {
  title: 'Meeting details | Homeish',
  robots: { index: false, follow: false },
};

const actions: MeetingAdminActions = {
  schedule: scheduleMeetingAction,
  cancel: cancelMeetingAction,
  deleteDraft: deleteMeetingDraftAction,
  markHeld: markMeetingHeldAction,
  setCheckin: setMeetingCheckinAction,
  setAttendance: setMeetingAttendanceAction,
  removeAttendance: removeMeetingAttendanceAction,
  saveResolution: saveMeetingResolutionAction,
  deleteResolution: deleteMeetingResolutionAction,
  setOutcome: setMeetingResolutionOutcomeAction,
  linkPoll: linkMeetingResolutionPollAction,
  createPoll: createMeetingResolutionPollAction,
  saveMinutes: saveMeetingMinutesAction,
  publishMinutes: publishMeetingMinutesAction,
  retryCopy: retryMeetingMinutesCopyAction,
  saveAction: saveMeetingActionItemAction,
  setActionStatus: setMeetingActionStatusAction,
  searchOwners: searchMeetingOwnersAction,
};

const NO_FOLDERS = { folders: [], defaultFolderId: null };

export default async function AdminMeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  if (!z.uuid().safeParse(meetingId).success) notFound();
  const result = await loadMeetingPage(['admin', 'committee'], async () => {
    const detail = await getMeetingAdminDetail(meetingId);
    // Only administrators publish, so only they need the Documents folder list.
    const folders =
      detail.canManage &&
      detail.documentEnabled &&
      detail.meeting.status === 'held'
        ? await getMeetingDocumentFolders(detail.meeting.meetingType)
        : NO_FOLDERS;
    return { detail, folders };
  });
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/admin/meetings"
        retryHref={`/admin/meetings/${meetingId}`}
      />
    );
  }
  return (
    <MeetingAdminDetailView
      detail={result.data.detail}
      folders={result.data.folders}
      actions={actions}
    />
  );
}
