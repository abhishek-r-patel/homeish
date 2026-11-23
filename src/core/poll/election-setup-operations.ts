// Authorize P46 settings, advisory schedule, source and helper operations.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { getElectionContext } from './election-context';
import {
  pollElectionActivityInputSchema,
  pollElectionHelpersInputSchema,
  pollElectionSettingsInputSchema,
  pollElectionSettingsSchema,
  pollElectionSourceInputSchema,
  pollElectionSourceRemoveInputSchema,
  pollOfficialVotingInputSchema,
} from './election-inputs';
import { DEFAULT_POLL_SETTINGS } from './validation';

export async function getPollElectionSettings() {
  const { context, societyId } = await getElectionContext('poll:manage');
  const { data, error } = await context.db
    .from('module_configs')
    .select('settings, updated_at')
    .eq('society_id', societyId)
    .eq('module_key', 'poll')
    .single();
  if (error || !data) {
    throw new Error('Could not load official election settings.', {
      cause: error,
    });
  }
  return {
    ...DEFAULT_POLL_SETTINGS,
    ...pollElectionSettingsSchema.parse(data.settings),
    updated_at: data.updated_at,
  };
}

export async function getPollElectionDocumentOptions() {
  const { context, societyId } = await getElectionContext('poll:manage');
  if (!context.enabledModules.has('document')) return [];
  const { data, error } = await context.db
    .from('documents')
    .select('id, title')
    .eq('society_id', societyId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) {
    throw new Error('Could not load election evidence documents.', {
      cause: error,
    });
  }
  return z.array(z.object({ id: z.uuid(), title: z.string() })).parse(data);
}

export async function setPollOfficialVoting(input: unknown, requestId: string) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollOfficialVotingInputSchema, input);
  return callModuleRpc(
    context,
    'poll_official_voting_set',
    {
      p_society_id: societyId,
      p_enabled: value.enabled,
      p_legal_type: value.legalType,
      p_confirmation: value.confirmation,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.object({ enabled: z.boolean(), legal_type: z.string().nullable() }),
    'Could not save official voting. Check the legal-type confirmation.',
  );
}

export async function updatePollElectionSettings(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionSettingsInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_settings_update',
    {
      p_society_id: societyId,
      p_dispute_window_days: value.disputeWindowDays,
      p_nomination_supporters_enabled: value.nominationSupportersEnabled,
      p_multi_post_win_rule: value.multiPostWinRule,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.iso.datetime({ offset: true }),
    'Could not save the official election settings.',
  );
}

export async function savePollElectionActivities(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionActivityInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_activities_save',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_activities: value.activities,
      p_client_request_id: crypto.randomUUID(),
      p_request_trace: requestId,
    },
    z.number(),
    'Could not save the election schedule.',
  );
}

export async function linkPollElectionSource(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionSourceInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_link_source',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_source_type: value.sourceType,
      p_source_id: value.sourceId,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not link the election source.',
  );
}

export async function unlinkPollElectionSource(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionSourceRemoveInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_link_remove',
    {
      p_society_id: societyId,
      p_link_id: value.linkId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not remove the election source link.',
  );
}

export async function savePollElectionHelpers(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionHelpersInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_helpers_save',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_helpers: value.helpers,
      p_request_trace: requestId,
    },
    z.number(),
    'Could not save election assistants and observers.',
  );
}
