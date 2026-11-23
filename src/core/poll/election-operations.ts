// Authorize P46 official-election settings, lifecycle and officer operations.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import {
  getElectionContext,
  getElectionOfficerContext,
  signElectionDisputeFile,
} from './election-context';
import type { RequestContext } from '../tenancy/request-context';
import {
  pollElectionCancelInputSchema,
  pollElectionIdSchema,
  pollElectionSaveInputSchema,
  pollElectionStageInputSchema,
} from './election-inputs';
import {
  getPollOfficerAssignments,
  getPollOfficerElection,
} from './election-officer-operations';
import {
  pollElectionDetailSchema,
  pollElectionListSchema,
} from './election-read-model';

const writeResult = z.object({
  stage: z.string().optional(),
  revision: z.number().int().positive().optional(),
  winnerCount: z.number().int().nonnegative().optional(),
});

async function withElectionFileUrls(
  context: RequestContext,
  election: z.infer<typeof pollElectionDetailSchema>,
) {
  return {
    ...election,
    disputes: await Promise.all(
      election.disputes.map(async (dispute) => ({
        ...dispute,
        file_url: await signElectionDisputeFile(context, dispute.file_path),
      })),
    ),
  };
}

export async function getPollElectionList() {
  const { context, societyId } = await getElectionContext('poll:list');
  const election = await callModuleRpc(
    context,
    'poll_election_list',
    { p_society_id: societyId },
    pollElectionListSchema,
    'Could not load official elections.',
  );
  return election;
}

export async function getPollMemberElectionList() {
  const { context, societyId } = await getElectionContext('poll:vote');
  const election = await callModuleRpc(
    context,
    'poll_election_list',
    { p_society_id: societyId },
    pollElectionListSchema,
    'Could not load official elections.',
  );
  return election;
}

export async function getPollElection(id: unknown) {
  const { context, societyId } = await getElectionContext('poll:list');
  const parsed = parseModuleInput(pollElectionIdSchema, { electionId: id });
  const election = await callModuleRpc(
    context,
    'poll_election_get',
    {
      p_society_id: societyId,
      p_election_id: parsed.electionId,
    },
    pollElectionDetailSchema,
    'Could not load this official election.',
  );
  return withElectionFileUrls(context, election);
}

export async function getPollMemberElection(id: unknown) {
  const { context, societyId } = await getElectionContext('poll:vote');
  const parsed = parseModuleInput(pollElectionIdSchema, { electionId: id });
  const election = await callModuleRpc(
    context,
    'poll_election_get',
    { p_society_id: societyId, p_election_id: parsed.electionId },
    pollElectionDetailSchema,
    'Could not load this official election.',
  );
  return withElectionFileUrls(context, election);
}

export async function savePollElection(input: unknown, requestId: string) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionSaveInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_save',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_title: value.title,
      p_nominations_open_at: value.nominationsOpenAt,
      p_nominations_close_at: value.nominationsCloseAt,
      p_voting_opens_at: value.votingOpensAt,
      p_voting_closes_at: value.votingClosesAt,
      p_posts: value.posts,
      p_expected_revision: value.expectedRevision,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not save the election. Check the dates and posts.',
  );
}

export async function advancePollElection(
  input: unknown,
  requestId: string,
  officerSocietyId?: string,
) {
  const standard = officerSocietyId
    ? null
    : await getElectionContext('poll:list', true, requestId);
  const context = officerSocietyId
    ? await getElectionOfficerContext(requestId, true)
    : standard!.context;
  const value = parseModuleInput(pollElectionStageInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_stage_advance',
    {
      p_society_id: officerSocietyId ?? standard!.societyId,
      p_election_id: value.electionId,
      p_expected_revision: value.expectedRevision,
      p_request_trace: requestId,
    },
    writeResult,
    'Could not advance the election. Check its readiness and try again.',
  );
}

export async function cancelPollElection(
  input: unknown,
  requestId: string,
  officerSocietyId?: string,
) {
  const standard = officerSocietyId
    ? null
    : await getElectionContext('poll:list', true, requestId);
  const context = officerSocietyId
    ? await getElectionOfficerContext(requestId, true)
    : standard!.context;
  const value = parseModuleInput(pollElectionCancelInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_cancel',
    {
      p_society_id: officerSocietyId ?? standard!.societyId,
      p_election_id: value.electionId,
      p_reason: value.reason,
      p_expected_revision: value.expectedRevision,
      p_request_trace: requestId,
    },
    writeResult,
    'Could not cancel the election.',
  );
}

export async function getPollElectionSummary(id: unknown) {
  const electionId = parseModuleInput(z.uuid(), id);
  const assignments = await getPollOfficerAssignments();
  const assignment = assignments.find(
    (candidate) => candidate.election_id === electionId,
  );
  if (assignment) {
    return getPollOfficerElection({
      societyId: assignment.society_id,
      electionId,
    });
  }
  return getPollElection(electionId);
}
