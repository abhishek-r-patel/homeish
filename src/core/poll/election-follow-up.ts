// Authorize P46 counting, declaration, disputes, costs and outside results.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { FILE_CONTENT_TYPES, verifyFileAttachment } from '../files/attachments';
import {
  getElectionContext,
  getElectionOfficerContext,
} from './election-context';
import {
  pollElectionDisputeInputSchema,
  pollElectionDisputeUpdateInputSchema,
  pollElectionExpenseInputSchema,
  pollElectionExternalResultInputSchema,
  pollElectionIdSchema,
  pollElectionOutsideInputSchema,
  pollElectionPostChoiceInputSchema,
  pollElectionPostDecisionInputSchema,
  pollElectionTieInputSchema,
} from './election-inputs';

const stateResult = z.object({
  stage: z.string(),
  revision: z.number().int().positive(),
  counted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  winnerCount: z.number().int().nonnegative().optional(),
});

export async function countPollElection(
  input: unknown,
  requestId: string,
  officerSocietyId?: string,
) {
  const value = parseModuleInput(pollElectionIdSchema, input);
  const standard = officerSocietyId
    ? null
    : await getElectionContext('poll:list', true, requestId);
  const context = officerSocietyId
    ? await getElectionOfficerContext(requestId, true)
    : standard!.context;
  return callModuleRpc(
    context,
    'poll_election_count',
    {
      p_society_id: officerSocietyId ?? standard!.societyId,
      p_election_id: value.electionId,
      p_request_trace: requestId,
    },
    stateResult,
    'Could not count the election yet.',
  );
}

export async function extendPollElectionVoting(
  input: unknown,
  requestId: string,
  officerSocietyId: string,
) {
  const schema = pollElectionIdSchema.extend({
    closesAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(500),
  });
  const value = parseModuleInput(schema, input);
  const context = await getElectionOfficerContext(requestId, true);
  return callModuleRpc(
    context,
    'poll_election_voting_extend',
    {
      p_society_id: officerSocietyId,
      p_election_id: value.electionId,
      p_closes_at: value.closesAt,
      p_reason: value.reason,
      p_request_trace: requestId,
    },
    z.iso.datetime({ offset: true }),
    'Could not extend voting.',
  );
}

export async function resolvePollElectionTie(
  input: unknown,
  requestId: string,
  officerSocietyId: string,
) {
  const value = parseModuleInput(pollElectionTieInputSchema, input);
  const context = await getElectionOfficerContext(requestId, true);
  return callModuleRpc(
    context,
    'poll_election_tie_resolve',
    {
      p_society_id: officerSocietyId,
      p_election_id: value.electionId,
      p_post_id: value.postId,
      p_candidate_user_id: value.candidateUserId,
      p_method: value.method,
      p_reason: value.reason,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not resolve the tied post.',
  );
}

export async function choosePollElectionPost(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:vote',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionPostChoiceInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_post_choose',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_candidate_user_id: value.candidateUserId,
      p_chosen_post_id: value.chosenPostId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not record the chosen post.',
  );
}

export async function decidePollElectionPost(
  input: unknown,
  requestId: string,
  officerSocietyId: string,
) {
  const value = parseModuleInput(pollElectionPostDecisionInputSchema, input);
  const context = await getElectionOfficerContext(requestId, true);
  return callModuleRpc(
    context,
    'poll_election_post_decide',
    {
      p_society_id: officerSocietyId,
      p_election_id: value.electionId,
      p_candidate_user_id: value.candidateUserId,
      p_chosen_post_id: value.chosenPostId,
      p_reason: value.reason,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not record the post decision.',
  );
}

export async function declarePollElection(
  input: unknown,
  requestId: string,
  officerSocietyId: string,
) {
  const value = parseModuleInput(pollElectionIdSchema, input);
  const context = await getElectionOfficerContext(requestId, true);
  return callModuleRpc(
    context,
    'poll_election_declare',
    {
      p_society_id: officerSocietyId,
      p_election_id: value.electionId,
      p_request_trace: requestId,
    },
    stateResult,
    'Could not declare the election. Resolve any tie first.',
  );
}

export async function recordPollElectionExternalResult(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionExternalResultInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_external_result',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_post_id: value.postId,
      p_winner_name: value.winnerName,
      p_votes_count: value.votesCount,
      p_document_id: value.documentId,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not record the outside-app result.',
  );
}

export async function savePollElectionOutside(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionOutsideInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_external_save',
    {
      p_society_id: societyId,
      p_title: value.title,
      p_held_on: value.heldOn,
      p_posts: value.posts,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not record the outside-app election.',
  );
}

export async function raisePollElectionDispute(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:vote',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionDisputeInputSchema, input);
  if (value.filePath) {
    await verifyFileAttachment(context, {
      bucket: 'poll-dispute-files',
      contentTypes: FILE_CONTENT_TYPES,
      ownerPath: `${societyId}/elections/${value.electionId}/disputes/${context.userId}`,
      path: value.filePath,
      societyId,
    });
  }
  return callModuleRpc(
    context,
    'poll_election_dispute_raise',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_text: value.text,
      p_file_path: value.filePath,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not raise the dispute. Check the window and attachment.',
  );
}

export async function updatePollElectionDispute(
  input: unknown,
  requestId: string,
  officerSocietyId?: string,
) {
  const value = parseModuleInput(pollElectionDisputeUpdateInputSchema, input);
  const standard = officerSocietyId
    ? null
    : await getElectionContext('poll:manage', true, requestId);
  const context = officerSocietyId
    ? await getElectionOfficerContext(requestId, true)
    : standard!.context;
  return callModuleRpc(
    context,
    'poll_election_dispute_update',
    {
      p_society_id: officerSocietyId ?? standard!.societyId,
      p_dispute_id: value.disputeId,
      p_status: value.status,
      p_resolution_note: value.resolutionNote.trim() || null,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Could not update the dispute.',
  );
}

export async function linkPollElectionExpense(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getElectionContext(
    'poll:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(pollElectionExpenseInputSchema, input);
  return callModuleRpc(
    context,
    'poll_election_expense_link',
    {
      p_society_id: societyId,
      p_election_id: value.electionId,
      p_expense_id: value.expenseId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose a posted Accounts expense.',
  );
}
