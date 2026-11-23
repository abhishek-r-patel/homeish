// Authorize P46 returning-officer assignment, sign-in and election-only reads.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import type { RequestContext } from '../tenancy/request-context';
import {
  getElectionContext,
  getElectionOfficerContext,
  signElectionDisputeFile,
} from './election-context';
import {
  pollElectionOfficerAssignInputSchema,
  pollElectionOfficerConfirmInputSchema,
  pollElectionOfficerLookupSchema,
  pollElectionOfficerRevokeInputSchema,
} from './election-inputs';
import {
  pollElectionDetailSchema,
  pollElectionOfficerAssignmentsSchema,
} from './election-read-model';

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

export async function assignPollElectionOfficer(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionOfficerAssignInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_officer_assign',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_profile_id: value.profileId,
      p_invited_email: value.invitedEmail,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not assign the returning officer.',
  );
}

export async function revokePollElectionOfficer(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionOfficerRevokeInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_officer_revoke',
    {
      p_society_id: societyId,
      p_officer_id: value.officerId,
      p_reason: value.reason,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not revoke returning-officer access.',
  );
}

export async function getPollOfficerAssignments() {
  const context = await getElectionOfficerContext(createRequestId());
  return callModuleRpc(
    context,
    'poll_election_officer_assignments',
    {},
    pollElectionOfficerAssignmentsSchema,
    'Could not load returning-officer assignments.',
  );
}

export async function getPollOfficerElection(input: unknown) {
  const value = parseModuleInput(pollElectionOfficerLookupSchema, input);
  const context = await getElectionOfficerContext(createRequestId());
  if (!context.userId) throw new AppError('UNAUTHENTICATED');
  const election = await callModuleRpc(
    context,
    'poll_election_officer_get',
    {
      p_society_id: value.societyId,
      p_election_id: value.electionId,
    },
    pollElectionDetailSchema,
    'Could not open the returning-officer workspace.',
  );
  return withElectionFileUrls(context, election);
}

export async function confirmPollElectionOfficer(
  input: unknown,
  requestId: string,
) {
  const context = await getElectionOfficerContext(requestId, true);
  const value = parseModuleInput(pollElectionOfficerConfirmInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_officer_confirm',
    {
      p_society_id: value.societyId,
      p_election_id: value.electionId,
      p_confirmation: value.confirmation,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not confirm the returning-officer assignment.',
  );
}
