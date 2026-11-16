// Authorize Polls & Voting operations and validate their transactional RPC contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import {
  AppError,
  ConflictError,
  createRequestId,
  ValidationError,
} from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  DEFAULT_POLL_SETTINGS,
  pollAdminGetSchema,
  pollAdminListSchema,
  pollBallotResultSchema,
  pollDeadlineExtendInputSchema,
  pollDeadlineExtendResultSchema,
  pollDraftCreateInputSchema,
  pollDraftDeleteInputSchema,
  pollDraftDeleteResultSchema,
  pollDraftSaveInputSchema,
  pollMemberGetSchema,
  pollMemberListSchema,
  pollExportSchema,
  pollParticipationSchema,
  pollPrivateBallotInputSchema,
  pollPublicBallotInputSchema,
  pollRepresentativeResultSchema,
  pollRepresentativeSetInputSchema,
  pollRepresentativesSchema,
  pollReasonInputSchema,
  pollResultsSchema,
  pollScheduleInputSchema,
  pollScheduleWithdrawResultSchema,
  pollSettingsInputSchema,
  pollSettingsResultSchema,
  pollSettingsSchema,
  pollStateResultSchema,
  pollVoteInputSchema,
  pollWriteResultSchema,
} from './validation';

type PollPermission = 'poll:list' | 'poll:manage' | 'poll:vote';

async function getContext(
  permission: PollPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'poll',
    permission,
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

const readinessMessages: Readonly<Record<string, string>> = {
  title_missing: 'Add a title.',
  closes_at_missing: 'Choose a closing time.',
  closes_at_too_soon:
    'The closing time must be at least five minutes after opening.',
  closes_at_too_far: 'The closing time must be within one year of opening.',
  opens_at_invalid: 'Choose a valid opening time before closing.',
  options_too_few: 'Add at least two different options.',
  option_limit_invalid: 'Choose a valid selection limit.',
  offices_missing: 'Add at least one office.',
  office_without_candidates: 'Add at least one candidate to every office.',
  instructions_missing: 'Add instructions for this private election.',
  electorate_empty: 'No eligible voting units were found.',
};

function mapPollError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const info = rpcError(error);
  if (info?.code === '55P03') {
    throw new ConflictError(
      'invalid_state',
      'This poll is busy. Wait a moment, then try again.',
    );
  }
  if (info?.code !== 'P0001') throw error;

  switch (info.message) {
    case 'poll_not_open':
    case 'poll_invalid_state':
      throw new ConflictError(
        'invalid_state',
        'This poll is not in a state that allows this action. Refresh and retry.',
      );
    case 'poll_closed':
      throw new ConflictError(
        'expired',
        'Voting has closed. Your ballot was not changed.',
      );
    case 'poll_already_submitted':
      throw new ConflictError(
        'already_decided',
        'Your ballot has already been submitted and cannot be changed.',
      );
    case 'poll_not_eligible':
      throw new AppError('FORBIDDEN');
    case 'poll_ballot_invalid':
      throw new ValidationError({
        ballot: 'Check the selections for this ballot and try again.',
      });
    case 'poll_not_ready': {
      const keys = info.details
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      throw new ValidationError(
        Object.fromEntries(
          keys.map((key) => [
            key,
            readinessMessages[key] ?? 'Check the poll details.',
          ]),
        ),
        'This poll needs a few changes before it can open.',
      );
    }
    case 'poll_results_unavailable':
      throw new ConflictError(
        'invalid_state',
        'Results are not available for this poll.',
      );
    case 'poll_results_mismatch':
      throw new Error('Poll totals did not match participation.', {
        cause: error,
      });
    default:
      throw error;
  }
}

async function callPollRpc<T>(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  failureMessage: string,
): Promise<T> {
  try {
    return await callModuleRpc(context, name, args, schema, failureMessage);
  } catch (error) {
    return mapPollError(error);
  }
}

export async function getPollMemberList() {
  const { context, societyId } = await getContext('poll:vote');
  return callPollRpc(
    context,
    'poll_member_list',
    { p_society_id: societyId },
    pollMemberListSchema,
    'Could not load polls. Refresh and retry.',
  );
}

export async function getPollMemberVote(voteId: unknown) {
  const { context, societyId } = await getContext('poll:vote');
  const values = parseModuleInput(pollVoteInputSchema, { voteId });
  return callPollRpc(
    context,
    'poll_member_get',
    { p_society_id: societyId, p_vote_id: values.voteId },
    pollMemberGetSchema,
    'Could not load this poll. Refresh and retry.',
  );
}

export async function getPollAdminList() {
  const { context, societyId } = await getContext('poll:list');
  return callPollRpc(
    context,
    'poll_admin_list',
    { p_society_id: societyId },
    pollAdminListSchema,
    'Could not load polls. Refresh and retry.',
  );
}

export async function getPollSettings() {
  const { context, societyId } = await getContext('poll:manage');
  const { data, error } = await context.db
    .from('module_configs')
    .select('settings')
    .eq('society_id', societyId)
    .eq('module_key', 'poll')
    .maybeSingle();
  if (error) {
    throw new Error('Could not load poll settings.', { cause: error });
  }
  const settings = pollSettingsSchema.parse(data?.settings ?? {});
  return { ...DEFAULT_POLL_SETTINGS, ...settings };
}

export async function getPollBlocks() {
  const { context, societyId } = await getContext('poll:manage');
  const { data, error } = await context.db
    .from('blocks')
    .select('id, name')
    .eq('society_id', societyId)
    .eq('active', true)
    .order('name', { ascending: true })
    .limit(500);
  if (error) {
    throw new Error('Could not load active blocks.', { cause: error });
  }
  return z
    .array(z.object({ id: z.uuid(), name: z.string() }).strict())
    .parse(data);
}

export async function getPollAdminVote(voteId: unknown) {
  const { context, societyId } = await getContext('poll:list');
  const values = parseModuleInput(pollVoteInputSchema, { voteId });
  return callPollRpc(
    context,
    'poll_admin_get',
    { p_society_id: societyId, p_vote_id: values.voteId },
    pollAdminGetSchema,
    'Could not load this poll. Refresh and retry.',
  );
}

export async function getPollResults(voteId: unknown) {
  const context = await buildRequestContext(createRequestId());
  const permission: PollPermission = context.roles.some(
    (role) => role === 'admin' || role === 'committee',
  )
    ? 'poll:list'
    : 'poll:vote';
  authorizeRequest(context, { moduleKey: 'poll', permission });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const values = parseModuleInput(pollVoteInputSchema, { voteId });
  return callPollRpc(
    context,
    'poll_results_get',
    { p_society_id: context.societyId, p_vote_id: values.voteId },
    pollResultsSchema,
    'Could not load poll results. Refresh and retry.',
  );
}

export async function getPollParticipation(voteId: unknown) {
  const { context, societyId } = await getContext('poll:list');
  const values = parseModuleInput(pollVoteInputSchema, { voteId });
  return callPollRpc(
    context,
    'poll_participation_get',
    { p_society_id: societyId, p_vote_id: values.voteId },
    pollParticipationSchema,
    'Could not load the participation list. Refresh and retry.',
  );
}

export async function getPollExport(voteId: unknown) {
  const { context, societyId } = await getContext('poll:list');
  const values = parseModuleInput(pollVoteInputSchema, { voteId });
  return callPollRpc(
    context,
    'poll_export_get',
    { p_society_id: societyId, p_vote_id: values.voteId },
    pollExportSchema,
    'Could not prepare this poll export. Refresh and retry.',
  );
}

export async function getPollRepresentatives() {
  const context = await buildRequestContext(createRequestId());
  const isAdmin = context.roles.includes('admin');
  const permission: PollPermission = isAdmin ? 'poll:manage' : 'poll:vote';
  authorizeRequest(context, { moduleKey: 'poll', permission });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const representatives = await callPollRpc(
    context,
    'poll_representatives_get',
    { p_society_id: context.societyId },
    pollRepresentativesSchema,
    'Could not load voting representatives. Refresh and retry.',
  );
  return {
    ...representatives,
    canSetRepresentative: isAdmin || context.roles.includes('resident'),
  };
}

export async function createPollDraft(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollDraftCreateInputSchema, input);
  return callPollRpc(
    context,
    'poll_draft_create',
    {
      p_society_id: societyId,
      p_client_request_id: values.clientRequestId,
      p_voting_type: values.votingType,
    },
    pollWriteResultSchema,
    'The poll was not created. Refresh and retry.',
  );
}

export async function savePollDraft(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollDraftSaveInputSchema, input);
  return callPollRpc(
    context,
    'poll_draft_save',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_expected_revision: values.expectedRevision,
      p_draft: values.draft,
    },
    pollWriteResultSchema,
    'The draft was not saved. Check the poll details and retry.',
  );
}

export async function deletePollDraft(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollDraftDeleteInputSchema, input);
  return callPollRpc(
    context,
    'poll_draft_delete',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_expected_revision: values.expectedRevision,
    },
    pollDraftDeleteResultSchema,
    'The draft was not deleted. Refresh and retry.',
  );
}

export async function activatePoll(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollDraftDeleteInputSchema, input);
  return callPollRpc(
    context,
    'poll_activate',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_expected_revision: values.expectedRevision,
    },
    pollStateResultSchema,
    'The poll could not be opened. Check readiness and retry.',
  );
}

export async function schedulePoll(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollScheduleInputSchema, input);
  return callPollRpc(
    context,
    'poll_schedule',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_expected_revision: values.expectedRevision,
      p_opens_at: values.opensAt,
    },
    pollStateResultSchema,
    'The poll could not be scheduled. Check readiness and retry.',
  );
}

export async function withdrawPollSchedule(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollReasonInputSchema, input);
  return callPollRpc(
    context,
    'poll_schedule_withdraw',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_reason: values.reason,
    },
    pollScheduleWithdrawResultSchema,
    'The scheduled poll could not be withdrawn. Refresh and retry.',
  );
}

export async function extendPollDeadline(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollDeadlineExtendInputSchema, input);
  const result = await callPollRpc(
    context,
    'poll_deadline_extend',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_closes_at: values.closesAt,
      p_reason: values.reason,
    },
    pollDeadlineExtendResultSchema,
    'The poll deadline was not extended. Check the new closing time and retry.',
  );
  if (result.outcome === 'completed') {
    throw new ConflictError(
      'expired',
      'The poll has closed and was completed. The deadline was not extended; refresh to see its final status.',
    );
  }
  return result;
}

export async function completePollEarly(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollReasonInputSchema, input);
  return callPollRpc(
    context,
    'poll_complete_early',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_reason: values.reason,
    },
    pollStateResultSchema,
    'The poll could not be completed. Refresh and retry.',
  );
}

export async function cancelPoll(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(pollReasonInputSchema, input);
  return callPollRpc(
    context,
    'poll_cancel',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_reason: values.reason,
    },
    pollStateResultSchema,
    'The poll could not be cancelled. Refresh and retry.',
  );
}

export async function updatePollSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'poll:manage',
    true,
    requestId,
  );
  const settings = parseModuleInput(pollSettingsInputSchema, input);
  return callPollRpc(
    context,
    'poll_settings_update',
    { p_society_id: societyId, p_settings: settings },
    pollSettingsResultSchema,
    'The voting setting was not saved. Refresh and retry.',
  );
}

export async function setPollRepresentative(input: unknown, requestId: string) {
  const context = await buildRequestContext(requestId);
  const permission = context.roles.includes('admin')
    ? 'poll:manage'
    : 'poll:vote';
  authorizeRequest(context, { moduleKey: 'poll', permission, write: true });
  const values = parseModuleInput(pollRepresentativeSetInputSchema, input);
  if (!context.societyId) throw new AppError('FORBIDDEN');
  await enforceRateLimit(
    'otherWritesUserMinute',
    context.userId,
    context.requestId,
  );
  return callPollRpc(
    context,
    'poll_representative_set',
    {
      p_society_id: context.societyId,
      p_unit_id: values.unitId,
      p_membership_id: values.membershipId,
      p_expected_version: values.expectedVersion,
    },
    pollRepresentativeResultSchema,
    'The voting representative was not saved. Choose an eligible occupant and retry.',
  );
}

export async function submitPollPublicBallot(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext('poll:vote', true, requestId);
  const values = parseModuleInput(pollPublicBallotInputSchema, input);
  return callPollRpc(
    context,
    'poll_ballot_submit',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_unit_id: values.unitId,
      p_submission: { optionIds: values.optionIds },
    },
    pollBallotResultSchema,
    'Your ballot was not submitted. Check your selections and retry.',
  );
}

export async function submitPollPrivateBallot(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext('poll:vote', true, requestId);
  const values = parseModuleInput(pollPrivateBallotInputSchema, input);
  return callPollRpc(
    context,
    'poll_ballot_submit',
    {
      p_society_id: societyId,
      p_vote_id: values.voteId,
      p_unit_id: values.unitId,
      p_submission: { choices: values.choices },
    },
    pollBallotResultSchema,
    'Your ballot was not submitted. Check each office and retry.',
  );
}
