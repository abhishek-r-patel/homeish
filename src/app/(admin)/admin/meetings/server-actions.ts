// Expose authorized meeting-management operations to administrator and committee screens.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  archiveMeetingAgendaTemplate,
  cancelMeeting,
  createMeeting,
  createMeetingResolutionPoll,
  deleteMeetingDraft,
  deleteMeetingResolution,
  linkMeetingResolutionPoll,
  markMeetingHeld,
  publishMeetingMinutes,
  removeMeetingAttendance,
  retryMeetingMinutesCopy,
  saveMeetingAction,
  saveMeetingAgendaTemplate,
  saveMeetingMinutes,
  saveMeetingResolution,
  scheduleMeeting,
  searchMeetingOwners,
  setMeetingActionStatus,
  setMeetingAttendance,
  setMeetingCheckin,
  setMeetingResolutionOutcome,
  updateMeeting,
  updateMeetingSettings,
} from '@/core/meeting/operations';

function shortNoticeSuffix(
  notice: { requiredDays: number; givenDays: number; short: boolean } | null,
) {
  return notice?.short
    ? ` Notice is shorter than the society’s ${notice.requiredDays}-day rule.`
    : '';
}

export async function createMeetingAction(form: FormData) {
  return runServerAction('/admin/meetings/new', async (requestId) => ({
    message: 'Meeting draft saved.',
    data: await createMeeting(readModuleActionInput(form), requestId),
  }));
}

export async function updateMeetingAction(form: FormData) {
  return runServerAction('/admin/meetings/edit', async (requestId) => {
    const result = await updateMeeting(readModuleActionInput(form), requestId);
    return {
      message: `${result.rescheduled ? 'Changes saved and invitees notified.' : 'Changes saved.'}${shortNoticeSuffix(result.notice)}`,
      data: result,
    };
  });
}

export async function saveMeetingAgendaTemplateAction(form: FormData) {
  return runServerAction('/admin/meetings/templates', async (requestId) => ({
    message: 'Agenda template saved.',
    data: await saveMeetingAgendaTemplate(
      readModuleActionInput(form),
      requestId,
    ),
  }));
}

export async function archiveMeetingAgendaTemplateAction(form: FormData) {
  return runServerAction('/admin/meetings/templates', async (requestId) => {
    const result = await archiveMeetingAgendaTemplate(
      readModuleActionInput(form),
      requestId,
    );
    return result.archived
      ? 'Agenda template archived.'
      : 'Agenda template restored.';
  });
}

export async function deleteMeetingDraftAction(form: FormData) {
  return runServerAction('/admin/meetings', async (requestId) => {
    await deleteMeetingDraft(readModuleActionInput(form), requestId);
    return 'Draft deleted.';
  });
}

export async function scheduleMeetingAction(form: FormData) {
  return runServerAction('/admin/meetings', async (requestId) => {
    const result = await scheduleMeeting(
      readModuleActionInput(form),
      requestId,
    );
    return `Meeting scheduled and invitees notified.${shortNoticeSuffix(result.notice)}`;
  });
}

export async function cancelMeetingAction(form: FormData) {
  return runServerAction('/admin/meetings', async (requestId) => {
    await cancelMeeting(readModuleActionInput(form), requestId);
    return 'Meeting cancelled and invitees notified.';
  });
}

export async function markMeetingHeldAction(form: FormData) {
  return runServerAction('/admin/meetings', async (requestId) => {
    await markMeetingHeld(readModuleActionInput(form), requestId);
    return 'Meeting marked as held.';
  });
}

export async function setMeetingCheckinAction(form: FormData) {
  return runServerAction('/admin/meetings/check-in', async (requestId) => {
    const result = await setMeetingCheckin(
      readModuleActionInput(form),
      requestId,
    );
    return result.checkinOpen
      ? 'Self check-in is open.'
      : 'Self check-in is closed.';
  });
}

export async function setMeetingAttendanceAction(form: FormData) {
  return runServerAction('/admin/meetings/attendance', async (requestId) => {
    await setMeetingAttendance(readModuleActionInput(form), requestId);
    return 'Attendance saved.';
  });
}

export async function removeMeetingAttendanceAction(form: FormData) {
  return runServerAction('/admin/meetings/attendance', async (requestId) => {
    await removeMeetingAttendance(readModuleActionInput(form), requestId);
    return 'Attendance mark removed.';
  });
}

export async function saveMeetingResolutionAction(form: FormData) {
  return runServerAction('/admin/meetings/resolutions', async (requestId) => {
    await saveMeetingResolution(readModuleActionInput(form), requestId);
    return 'Resolution saved.';
  });
}

export async function deleteMeetingResolutionAction(form: FormData) {
  return runServerAction('/admin/meetings/resolutions', async (requestId) => {
    await deleteMeetingResolution(readModuleActionInput(form), requestId);
    return 'Resolution deleted.';
  });
}

export async function setMeetingResolutionOutcomeAction(form: FormData) {
  return runServerAction('/admin/meetings/resolutions', async (requestId) => {
    await setMeetingResolutionOutcome(readModuleActionInput(form), requestId);
    return 'Outcome saved.';
  });
}

export async function linkMeetingResolutionPollAction(form: FormData) {
  return runServerAction('/admin/meetings/resolutions', async (requestId) => {
    const result = await linkMeetingResolutionPoll(
      readModuleActionInput(form),
      requestId,
    );
    return result.pollVoteId ? 'Poll linked.' : 'Poll unlinked.';
  });
}

export async function createMeetingResolutionPollAction(form: FormData) {
  return runServerAction('/admin/meetings/resolutions', async (requestId) => {
    await createMeetingResolutionPoll(readModuleActionInput(form), requestId);
    return 'Draft poll created and linked. Open it from Polls when ready.';
  });
}

export async function saveMeetingMinutesAction(form: FormData) {
  return runServerAction('/admin/meetings/minutes', async (requestId) => {
    await saveMeetingMinutes(readModuleActionInput(form), requestId);
    return 'Minutes draft saved.';
  });
}

export async function publishMeetingMinutesAction(form: FormData) {
  return runServerAction('/admin/meetings/minutes', async (requestId) => {
    const result = await publishMeetingMinutes(
      readModuleActionInput(form),
      requestId,
    );
    if (result.copy.copied)
      return 'Minutes published, invitees notified and a PDF saved in Documents.';
    if (result.copy.reason === 'document_disabled')
      return 'Minutes published and invitees notified.';
    return 'Minutes published; copying to Documents failed — Retry.';
  });
}

export async function retryMeetingMinutesCopyAction(form: FormData) {
  return runServerAction('/admin/meetings/minutes', async (requestId) => {
    const result = await retryMeetingMinutesCopy(
      readModuleActionInput(form),
      requestId,
    );
    return result.copied
      ? 'A PDF of the minutes is saved in Documents.'
      : 'Copying to Documents failed again. Check the folder and retry.';
  });
}

export async function saveMeetingActionItemAction(form: FormData) {
  return runServerAction('/admin/meetings/actions', async (requestId) => {
    await saveMeetingAction(readModuleActionInput(form), requestId);
    return 'Action item saved and the owner notified.';
  });
}

export async function setMeetingActionStatusAction(form: FormData) {
  return runServerAction('/admin/meetings/actions', async (requestId) => {
    const result = await setMeetingActionStatus(
      readModuleActionInput(form),
      requestId,
    );
    return result.status === 'done'
      ? 'Action item marked as done.'
      : 'Action item reopened.';
  });
}

export async function searchMeetingOwnersAction(form: FormData) {
  return runServerAction('/admin/meetings/owners', async (requestId) => {
    const items = await searchMeetingOwners(
      readModuleActionInput(form),
      requestId,
    );
    return {
      message:
        items.length === 0
          ? 'Nobody matched. Try another name.'
          : `${items.length} ${items.length === 1 ? 'person' : 'people'} found. Choose an owner below.`,
      data: items,
    };
  });
}

export async function updateMeetingSettingsAction(form: FormData) {
  return runServerAction('/admin/meetings/settings', async (requestId) => {
    await updateMeetingSettings(readModuleActionInput(form), requestId);
    return 'Meeting settings saved.';
  });
}
