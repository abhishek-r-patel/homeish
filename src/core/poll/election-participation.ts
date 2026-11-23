// Authorize P46 voter, nomination, supporter and secret-ballot operations.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import {
  getElectionContext,
  getElectionOfficerContext,
} from './election-context';
import {
  pollElectionBallotInputSchema,
  pollElectionNominationDecisionInputSchema,
  pollElectionNominationInputSchema,
  pollElectionSupportersInputSchema,
  pollElectionVoterRemoveInputSchema,
  pollElectionVoterRestoreInputSchema,
  pollElectionVoterSetInputSchema,
  pollElectionVotersInitInputSchema,
} from './election-inputs';

export async function initPollElectionVoters(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionVotersInitInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_voters_init',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_request_trace: requestId,
    },
    z.number().int().nonnegative(),
    'Could not build the owner voter list.',
  );
}

export async function setPollElectionVoter(input: unknown, requestId: string) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionVoterSetInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_voter_set',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_unit_id: value.unitId,
      p_membership_id: value.membershipId,
      p_expected_revision: value.expectedRevision,
      p_request_trace: requestId,
    },
    z.number().int().positive(),
    'Choose an active owner of this unit.',
  );
}

export async function removePollElectionVoter(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionVoterRemoveInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_voter_remove',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_unit_id: value.unitId,
      p_reason: value.reason,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not remove the voter. Give a reason and try again.',
  );
}

export async function restorePollElectionVoter(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionVoterRestoreInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_voter_restore',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_unit_id: value.unitId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not restore the voter.',
  );
}

export async function submitPollElectionNomination(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:vote',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionNominationInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_nomination_submit',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_post_ids: value.postIds,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.number().int().nonnegative(),
    'Could not submit your nomination.',
  );
}

export async function withdrawPollElectionNomination(
  nominationId: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:vote',
    true,
    requestId,
  );
  const value = parseModuleInput(z.uuid(), nominationId);
  return callModuleRpc(
    context,
    'poll_election_nomination_withdraw',
    {
      p_society_id: societyId,
      p_nomination_id: value,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not withdraw the nomination.',
  );
}

export async function addPollElectionSupporters(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:vote',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionSupportersInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_supporters_add',
    {
      p_society_id: societyId,
      p_nomination_id: value.nominationId,
      p_proposer_user_id: value.proposerUserId,
      p_seconder_user_id: value.seconderUserId,
      p_request_trace: requestId,
    },
    z.number(),
    'Could not request the supporters.',
  );
}

export async function respondPollElectionSupporter(
  supporterId: unknown,
  confirm: boolean,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:vote',
    true,
    requestId,
  );
  return callModuleRpc(
    context,
    'poll_election_supporter_respond',
    {
      p_society_id: societyId,
      p_supporter_id: parseModuleInput(z.uuid(), supporterId),
      p_confirm: confirm,
    },
    z.uuid(),
    'Could not save your supporter response.',
  );
}

export async function decidePollElectionNomination(
  input: unknown,
  requestId: string,
  officerSocietyId?: string,
) {
  const value = parseModuleInput(
    pollElectionNominationDecisionInputSchema,
    input,
  );
  const standard = officerSocietyId
    ? null
    : await getElectionContext('poll:manage', true, requestId);
  const context = officerSocietyId
    ? await getElectionOfficerContext(requestId, true)
    : standard!.context;
  const societyId = officerSocietyId ?? standard!.societyId;
  return callModuleRpc(
    context,
    'poll_election_nomination_decide',
    {
      p_society_id: societyId,
      p_nomination_id: value.nominationId,
      p_accept: value.accept,
      p_reason: value.reason.trim() || null,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not decide the nomination.',
  );
}

export async function submitPollElectionBallot(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:vote',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionBallotInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_ballot_submit',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_unit_id: value.unitId,
      p_choices: value.choices,
    },
    z.object({
      electionId: z.uuid(),
      unitId: z.uuid(),
      submitted: z.boolean(),
    }),
    'Your ballot was not submitted. Check every post and retry.',
  );
}
