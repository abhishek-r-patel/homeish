// Authorize Meetings & AGM operations, call their RPC contracts and deliver follow-up pushes.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { getDocumentWorkspace } from '../document/operations';
import {
  AppError,
  ConflictError,
  createRequestId,
  ValidationError,
} from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { createPollDraft, savePollDraft } from '../poll/operations';
import { POLL_INSTRUCTIONS_MAX, POLL_TITLE_MAX } from '../poll/validation';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import { canAdminEditAllModuleSettings } from '../modules/setting-access';
import {
  copyMinutesToDocuments,
  defaultMinutesFolderId,
  eligibleMinutesFolders,
} from './document-copy';
import {
  meetingAgendaDurationsSchema,
  meetingAgendaTemplateArchiveInputSchema,
  meetingAgendaTemplateArchiveResultSchema,
  meetingAgendaTemplateInputSchema,
  meetingAgendaTemplateSaveResultSchema,
  meetingAgendaTemplatesSchema,
  meetingActionResultSchema,
  meetingActionSaveInputSchema,
  meetingActionStatusInputSchema,
  meetingActionStatusResultSchema,
  meetingAdminGetSchema,
  meetingAdminListSchema,
  meetingAttendanceRemoveInputSchema,
  meetingAttendanceRemoveResultSchema,
  meetingAttendanceResultSchema,
  meetingAttendanceSetInputSchema,
  meetingCancelInputSchema,
  meetingCheckinResultSchema,
  meetingCheckinSetInputSchema,
  meetingCreateInputSchema,
  meetingDeletedResultSchema,
  meetingDocumentCopyInputSchema,
  meetingIdInputSchema,
  meetingInviteeOptionsSchema,
  meetingListFilterSchema,
  meetingMemberGetSchema,
  meetingMemberListSchema,
  meetingMinutesPublishInputSchema,
  meetingMinutesPublishResultSchema,
  meetingMinutesSaveInputSchema,
  meetingMinutesSaveResultSchema,
  meetingMyActionsSchema,
  meetingOwnerOptionsSchema,
  meetingOwnerSearchInputSchema,
  meetingPollLinkResultSchema,
  meetingResolutionDeleteInputSchema,
  meetingResolutionOutcomeInputSchema,
  meetingResolutionPollCreateInputSchema,
  meetingResolutionPollLinkInputSchema,
  meetingResolutionResultSchema,
  meetingResolutionSaveInputSchema,
  meetingScheduleResultSchema,
  meetingSelfCheckinInputSchema,
  meetingSelfCheckinResultSchema,
  meetingSettingsInputSchema,
  meetingUpdateInputSchema,
  meetingUpdateResultSchema,
  meetingVersionInputSchema,
  meetingWriteResultSchema,
  normalizeMeetingSettings,
} from './validation';

type MeetingPermission =
  'meeting:attend' | 'meeting:list' | 'meeting:minutes' | 'meeting:manage';

type Context = Awaited<ReturnType<typeof buildRequestContext>>;

async function getContext(
  permission: MeetingPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'meeting', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

function isManagement(context: Context) {
  return context.roles.some((role) => role === 'admin' || role === 'committee');
}

function rpcError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null) return null;
    const record = current as {
      cause?: unknown;
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    if (typeof record.code === 'string') {
      return {
        code: record.code,
        message: typeof record.message === 'string' ? record.message : '',
        details: typeof record.details === 'string' ? record.details : '',
      };
    }
    current = record.cause;
  }
  return null;
}

export const MEETING_READINESS_MESSAGES: Readonly<Record<string, string>> = {
  title_missing: 'Add a title.',
  time_invalid:
    'Choose a future start time and an end time within 24 hours after it.',
  place_missing: 'Add a venue or an online meeting link.',
  agenda_missing: 'Add at least one agenda item.',
  invitees_empty: 'No one would be invited. Check the invitee list.',
};

export function mapMeetingError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const info = rpcError(error);
  if (info?.code === '55P03') {
    throw new ConflictError(
      'invalid_state',
      'This meeting is busy. Wait a moment, then try again.',
    );
  }
  if (info?.code !== 'P0001') throw error;

  switch (info.message) {
    case 'meeting_invalid_state':
      throw new ConflictError(
        'invalid_state',
        'This meeting is not in a state that allows this action. Refresh and retry.',
      );
    case 'meeting_checkin_closed':
      throw new ConflictError(
        'invalid_state',
        'Self check-in is not open for this meeting right now.',
      );
    case 'meeting_checkin_window':
      throw new ConflictError(
        'invalid_state',
        'Check-in can open from one hour before the start until the meeting ends.',
      );
    case 'meeting_poll_unavailable':
      throw new ConflictError(
        'invalid_state',
        'That poll cannot be linked. Polls may be turned off, or the poll was cancelled.',
      );
    case 'meeting_document_unavailable':
      throw new ConflictError(
        'invalid_state',
        'Documents is turned off or the document was not found.',
      );
    case 'meeting_not_invited':
      throw new AppError('FORBIDDEN');
    case 'meeting_owner_ineligible':
      throw new ValidationError(
        {
          ownerMembershipId:
            'Choose an active member who is allowed to own action items.',
        },
        'This person cannot own action items.',
      );
    case 'meeting_not_ready': {
      const keys = info.details
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      throw new ValidationError(
        Object.fromEntries(
          (keys.length > 0 ? keys : ['form']).map((key) => [
            key,
            MEETING_READINESS_MESSAGES[key] ?? 'Check the meeting details.',
          ]),
        ),
        'This meeting needs a few changes before it can be scheduled.',
      );
    }
    default:
      throw error;
  }
}

async function callMeetingRpc<T>(
  context: Context,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  failureMessage: string,
): Promise<T> {
  try {
    return await callModuleRpc(context, name, args, schema, failureMessage);
  } catch (error) {
    return mapMeetingError(error);
  }
}

async function pushFor(context: Context) {
  await sendNotificationPushesForRequest(context.requestId);
}

// Reads

export async function getMeetingAdminList(status: unknown = null) {
  const { context, societyId } = await getContext('meeting:list');
  const filter = meetingListFilterSchema.parse(status);
  const list = await callMeetingRpc(
    context,
    'meeting_admin_list',
    {
      p_society_id: societyId,
      p_status: filter,
      p_limit: 100,
      p_offset: 0,
    },
    meetingAdminListSchema,
    'Could not load meetings. Refresh and retry.',
  );
  return { ...list, canManage: context.roles.includes('admin') };
}

export async function getMeetingAdminDetail(meetingId: unknown) {
  const { context, societyId } = await getContext('meeting:list');
  const values = parseModuleInput(meetingIdInputSchema, { meetingId });
  const [detail, durations] = await Promise.all([
    callMeetingRpc(
      context,
      'meeting_admin_get',
      { p_society_id: societyId, p_meeting_id: values.meetingId },
      meetingAdminGetSchema,
      'Could not load this meeting. Refresh and retry.',
    ),
    callMeetingRpc(
      context,
      'meeting_agenda_durations_get',
      { p_society_id: societyId, p_meeting_id: values.meetingId },
      meetingAgendaDurationsSchema,
      'Could not load agenda timings. Refresh and retry.',
    ),
  ]);
  const durationById = new Map(
    durations.map((item) => [item.id, item.durationMinutes]),
  );
  return {
    ...detail,
    agenda: detail.agenda.map((item) => ({
      ...item,
      durationMinutes: durationById.get(item.id) ?? null,
    })),
    settings: normalizeMeetingSettings(detail.settings ?? {}),
    canManage: context.roles.includes('admin'),
    canWriteMinutes: isManagement(context),
    pollEnabled: context.enabledModules.has('poll'),
    documentEnabled: context.enabledModules.has('document'),
  };
}

export async function getMeetingInviteeOptions() {
  const { context, societyId } = await getContext('meeting:manage');
  return callMeetingRpc(
    context,
    'meeting_invitee_options',
    { p_society_id: societyId },
    meetingInviteeOptionsSchema,
    'Could not load units and committee members. Refresh and retry.',
  );
}

export async function getMeetingAgendaTemplates() {
  const { context, societyId } = await getContext('meeting:manage');
  return callMeetingRpc(
    context,
    'meeting_agenda_templates_get',
    { p_society_id: societyId, p_meeting_type: null },
    meetingAgendaTemplatesSchema,
    'Could not load agenda templates. Refresh and retry.',
  );
}

export async function searchMeetingOwners(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    false,
    requestId,
  );
  const values = parseModuleInput(meetingOwnerSearchInputSchema, input);
  const result = await callMeetingRpc(
    context,
    'meeting_owner_options',
    { p_society_id: societyId, p_search: values.search, p_limit: 50 },
    meetingOwnerOptionsSchema,
    'Could not search members. Refresh and retry.',
  );
  return result.items;
}

export async function getMeetingMemberList() {
  const { context, societyId } = await getContext('meeting:attend');
  return callMeetingRpc(
    context,
    'meeting_member_list',
    { p_society_id: societyId },
    meetingMemberListSchema,
    'Could not load meetings. Refresh and retry.',
  );
}

export async function getMeetingMemberDetail(meetingId: unknown) {
  const { context, societyId } = await getContext('meeting:attend');
  const values = parseModuleInput(meetingIdInputSchema, { meetingId });
  return callMeetingRpc(
    context,
    'meeting_member_get',
    { p_society_id: societyId, p_meeting_id: values.meetingId },
    meetingMemberGetSchema,
    'Could not load this meeting. Refresh and retry.',
  );
}

async function getActionContext(write: boolean, requestId: string) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'meeting',
    permission: isManagement(context) ? 'meeting:list' : 'meeting:attend',
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

export async function getMyMeetingActions() {
  const { context, societyId } = await getActionContext(
    false,
    createRequestId(),
  );
  const result = await callMeetingRpc(
    context,
    'meeting_my_actions',
    { p_society_id: societyId },
    meetingMyActionsSchema,
    'Could not load your action items. Refresh and retry.',
  );
  return result.items;
}

export async function getMeetingSettings() {
  const { context, societyId } = await getContext('meeting:list');
  const settings = await callMeetingRpc(
    context,
    'meeting_settings_get',
    { p_society_id: societyId },
    z.unknown(),
    'Could not load meeting settings. Refresh and retry.',
  );
  return {
    settings: normalizeMeetingSettings(settings),
    canManage:
      context.roles.includes('admin') &&
      (await canAdminEditAllModuleSettings('meeting', context)),
  };
}

export async function getMeetingDocumentFolders(
  meetingType: 'agm' | 'sgm' | 'committee',
) {
  const { context } = await getContext('meeting:manage');
  if (!context.enabledModules.has('document')) {
    return { folders: [], defaultFolderId: null };
  }
  try {
    const workspace = await getDocumentWorkspace();
    return {
      folders: eligibleMinutesFolders(workspace.folders, meetingType).map(
        ({ id, name }) => ({ id, name }),
      ),
      defaultFolderId: defaultMinutesFolderId(workspace.folders, meetingType),
    };
  } catch (error) {
    if (error instanceof AppError) {
      return { folders: [], defaultFolderId: null };
    }
    throw error;
  }
}

// Admin lifecycle writes

export async function saveMeetingAgendaTemplate(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingAgendaTemplateInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_agenda_template_save',
    {
      p_society_id: societyId,
      p_template_id: values.templateId,
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_template: values.template,
      p_request_id: context.requestId,
    },
    meetingAgendaTemplateSaveResultSchema,
    'The agenda template was not saved. Check the details and retry.',
  );
}

export async function archiveMeetingAgendaTemplate(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(
    meetingAgendaTemplateArchiveInputSchema,
    input,
  );
  return callMeetingRpc(
    context,
    'meeting_agenda_template_archive',
    {
      p_society_id: societyId,
      p_template_id: values.templateId,
      p_expected_version: values.expectedVersion,
      p_archived: values.archived,
      p_request_id: context.requestId,
    },
    meetingAgendaTemplateArchiveResultSchema,
    'The agenda template was not updated. Refresh and retry.',
  );
}

export async function createMeeting(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingCreateInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_create',
    {
      p_society_id: societyId,
      p_client_request_id: values.clientRequestId,
      p_meeting: values.meeting,
      p_request_id: context.requestId,
    },
    meetingWriteResultSchema,
    'The meeting was not created. Check the details and retry.',
  );
}

export async function updateMeeting(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingUpdateInputSchema, input);
  const result = await callMeetingRpc(
    context,
    'meeting_update',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_expected_version: values.expectedVersion,
      p_meeting: values.meeting,
      p_request_id: context.requestId,
    },
    meetingUpdateResultSchema,
    'The meeting was not saved. Check the details and retry.',
  );
  await pushFor(context);
  return result;
}

export async function deleteMeetingDraft(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingVersionInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_draft_delete',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    meetingDeletedResultSchema,
    'The draft was not deleted. Refresh and retry.',
  );
}

export async function scheduleMeeting(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingVersionInputSchema, input);
  const result = await callMeetingRpc(
    context,
    'meeting_schedule',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    meetingScheduleResultSchema,
    'The meeting was not scheduled. Refresh and retry.',
  );
  await pushFor(context);
  return result;
}

export async function cancelMeeting(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingCancelInputSchema, input);
  const result = await callMeetingRpc(
    context,
    'meeting_cancel',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_expected_version: values.expectedVersion,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    meetingWriteResultSchema,
    'The meeting was not cancelled. Refresh and retry.',
  );
  await pushFor(context);
  return result;
}

export async function setMeetingCheckin(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingCheckinSetInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_checkin_set',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_open: values.open,
      p_request_id: context.requestId,
    },
    meetingCheckinResultSchema,
    'Check-in was not changed. Refresh and retry.',
  );
}

export async function markMeetingHeld(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingVersionInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_mark_held',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    meetingWriteResultSchema,
    'The meeting was not marked as held. Refresh and retry.',
  );
}

// Attendance

export async function setMeetingAttendance(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingAttendanceSetInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_attendance_set',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_attendee_id: values.attendeeId,
      p_mode: values.mode,
      p_proxy_name: values.proxyName,
      p_request_id: context.requestId,
    },
    meetingAttendanceResultSchema,
    'Attendance was not saved. Refresh and retry.',
  );
}

export async function removeMeetingAttendance(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingAttendanceRemoveInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_attendance_remove',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_attendee_id: values.attendeeId,
      p_request_id: context.requestId,
    },
    meetingAttendanceRemoveResultSchema,
    'Attendance was not removed. Refresh and retry.',
  );
}

export async function selfCheckInToMeeting(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:attend',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingSelfCheckinInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_self_checkin',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_unit_id: values.unitId,
      p_request_id: context.requestId,
    },
    meetingSelfCheckinResultSchema,
    'Check-in was not recorded. Refresh and retry.',
  );
}

// Resolutions

export async function saveMeetingResolution(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingResolutionSaveInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_resolution_save',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_resolution_id: values.resolutionId,
      p_expected_version: values.expectedVersion,
      p_resolution: values.resolution,
      p_request_id: context.requestId,
    },
    meetingResolutionResultSchema,
    'The resolution was not saved. Refresh and retry.',
  );
}

export async function deleteMeetingResolution(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingResolutionDeleteInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_resolution_delete',
    {
      p_society_id: societyId,
      p_resolution_id: values.resolutionId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    meetingDeletedResultSchema,
    'The resolution was not deleted. Refresh and retry.',
  );
}

export async function setMeetingResolutionOutcome(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingResolutionOutcomeInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_resolution_outcome_set',
    {
      p_society_id: societyId,
      p_resolution_id: values.resolutionId,
      p_expected_version: values.expectedVersion,
      p_outcome: values.outcome,
      p_votes_for: values.votesFor,
      p_votes_against: values.votesAgainst,
      p_votes_abstain: values.votesAbstain,
      p_request_id: context.requestId,
    },
    meetingResolutionResultSchema,
    'The outcome was not saved. Refresh and retry.',
  );
}

export async function linkMeetingResolutionPoll(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingResolutionPollLinkInputSchema, input);
  if (values.pollVoteId !== null && !context.enabledModules.has('poll')) {
    throw new ConflictError(
      'invalid_state',
      'Turn on Polls & Voting before linking a poll.',
    );
  }
  return callMeetingRpc(
    context,
    'meeting_resolution_poll_link',
    {
      p_society_id: societyId,
      p_resolution_id: values.resolutionId,
      p_expected_version: values.expectedVersion,
      p_poll_vote_id: values.pollVoteId,
      p_request_id: context.requestId,
    },
    meetingPollLinkResultSchema,
    'The poll link was not saved. Refresh and retry.',
  );
}

// The poll is pre-filled from the stored resolution, never from client-supplied text.
export async function createMeetingResolutionPoll(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(
    meetingResolutionPollCreateInputSchema,
    input,
  );
  if (!context.enabledModules.has('poll')) {
    throw new ConflictError(
      'invalid_state',
      'Turn on Polls & Voting before creating a poll.',
    );
  }
  const detail = await callMeetingRpc(
    context,
    'meeting_admin_get',
    { p_society_id: societyId, p_meeting_id: values.meetingId },
    meetingAdminGetSchema,
    'Could not load this meeting. Refresh and retry.',
  );
  const resolution = detail.resolutions.find(
    (item) => item.id === values.resolutionId,
  );
  if (!resolution) throw new AppError('NOT_FOUND');
  if (resolution.version !== values.expectedVersion) {
    throw new ConflictError('stale_version');
  }
  if (resolution.poll) {
    throw new ConflictError(
      'invalid_state',
      'This resolution already has a linked poll.',
    );
  }
  const poll = await createPollDraft(
    { votingType: 'public', clientRequestId: values.clientRequestId },
    requestId,
  );
  const saved = await savePollDraft(
    {
      voteId: poll.voteId,
      expectedRevision: poll.revision,
      draft: {
        title: resolution.title.slice(0, POLL_TITLE_MAX),
        instructions: resolution.body
          ? resolution.body.slice(0, POLL_INSTRUCTIONS_MAX)
          : null,
        opensAt: null,
        closesAt: null,
        selectionMode: 'single',
        selectionLimit: 1,
        tenantVotingOverride: null,
        blockIds: [],
        options: [{ label: 'For' }, { label: 'Against' }, { label: 'Abstain' }],
        offices: [],
      },
    },
    requestId,
  );
  const linked = await callMeetingRpc(
    context,
    'meeting_resolution_poll_link',
    {
      p_society_id: societyId,
      p_resolution_id: values.resolutionId,
      p_expected_version: values.expectedVersion,
      p_poll_vote_id: saved.voteId,
      p_request_id: context.requestId,
    },
    meetingPollLinkResultSchema,
    'The draft poll was created but not linked. Link it from the resolution.',
  );
  return { ...linked, pollVoteId: saved.voteId };
}

// Minutes

export async function saveMeetingMinutes(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:minutes',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingMinutesSaveInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_minutes_save',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_expected_version: values.expectedVersion,
      p_body: values.body,
      p_request_id: context.requestId,
    },
    meetingMinutesSaveResultSchema,
    'The minutes were not saved. Refresh and retry.',
  );
}

export async function publishMeetingMinutes(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingMinutesPublishInputSchema, input);
  const published = await callMeetingRpc(
    context,
    'meeting_minutes_publish',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    meetingMinutesPublishResultSchema,
    'The minutes were not published. Refresh and retry.',
  );
  await pushFor(context);
  const copy = context.enabledModules.has('document')
    ? await copyMinutesToDocuments({
        context,
        societyId,
        meetingId: values.meetingId,
        folderId: values.folderId,
        requestId: context.requestId,
      })
    : ({ copied: false, reason: 'document_disabled' } as const);
  if (copy.copied) await pushFor(context);
  return { ...published, copy };
}

export async function retryMeetingMinutesCopy(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingDocumentCopyInputSchema, input);
  const copy = await copyMinutesToDocuments({
    context,
    societyId,
    meetingId: values.meetingId,
    folderId: values.folderId,
    requestId: context.requestId,
  });
  if (copy.copied) await pushFor(context);
  return copy;
}

// Action items

export async function saveMeetingAction(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meetingActionSaveInputSchema, input);
  const result = await callMeetingRpc(
    context,
    'meeting_action_save',
    {
      p_society_id: societyId,
      p_meeting_id: values.meetingId,
      p_action_id: values.actionId,
      p_expected_version: values.expectedVersion,
      p_action: values.action,
      p_request_id: context.requestId,
    },
    meetingActionResultSchema,
    'The action item was not saved. Refresh and retry.',
  );
  await pushFor(context);
  return result;
}

export async function setMeetingActionStatus(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getActionContext(true, requestId);
  const values = parseModuleInput(meetingActionStatusInputSchema, input);
  return callMeetingRpc(
    context,
    'meeting_action_status_set',
    {
      p_society_id: societyId,
      p_action_id: values.actionId,
      p_expected_version: values.expectedVersion,
      p_status: values.status,
      p_note: values.note,
      p_request_id: context.requestId,
    },
    meetingActionStatusResultSchema,
    'The action item was not updated. Refresh and retry.',
  );
}

// Settings

export async function updateMeetingSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'meeting:manage',
    true,
    requestId,
  );
  const settings = parseModuleInput(meetingSettingsInputSchema, input);
  const result = await callMeetingRpc(
    context,
    'meeting_settings_update',
    {
      p_society_id: societyId,
      p_settings: settings,
      p_request_id: context.requestId,
    },
    z.unknown(),
    'Meeting settings were not saved. Check the values and retry.',
  );
  return normalizeMeetingSettings(result);
}
