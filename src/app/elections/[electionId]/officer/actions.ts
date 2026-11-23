// Expose only P46 returning-officer operations on the election-only workspace.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  advancePollElection,
  cancelPollElection,
} from '@/core/poll/election-operations';
import { confirmPollElectionOfficer } from '@/core/poll/election-officer-operations';
import { decidePollElectionNomination } from '@/core/poll/election-participation';
import {
  countPollElection,
  declarePollElection,
  decidePollElectionPost,
  extendPollElectionVoting,
  resolvePollElectionTie,
  updatePollElectionDispute,
} from '@/core/poll/election-follow-up';

function officerInput(form: FormData): {
  societyId: string;
  electionId: string;
  payload: unknown;
} {
  const society = form.get('societyId');
  const election = form.get('electionId');
  if (typeof society !== 'string' || typeof election !== 'string') {
    throw new Error('The election assignment is missing.');
  }
  return {
    societyId: society,
    electionId: election,
    payload: readModuleActionInput(form),
  };
}

export async function confirmPollOfficerAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await confirmPollElectionOfficer(
      { ...(input.payload as object), societyId: input.societyId },
      id,
    );
    return 'Conflict confirmation saved.';
  });
}
export async function advancePollOfficerElectionAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await advancePollElection(input.payload, id, input.societyId);
    return 'Election stage advanced.';
  });
}
export async function cancelPollOfficerElectionAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await cancelPollElection(input.payload, id, input.societyId);
    return 'Election cancelled.';
  });
}
export async function decidePollOfficerNominationAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await decidePollElectionNomination(input.payload, id, input.societyId);
    return 'Nomination decision saved.';
  });
}
export async function countPollOfficerElectionAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await countPollElection(input.payload, id, input.societyId);
    return 'Election counted.';
  });
}
export async function extendPollOfficerVotingAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await extendPollElectionVoting(input.payload, id, input.societyId);
    return 'Voting deadline extended.';
  });
}
export async function resolvePollOfficerTieAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await resolvePollElectionTie(input.payload, id, input.societyId);
    return 'Tie resolution recorded.';
  });
}
export async function decidePollOfficerPostAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await decidePollElectionPost(input.payload, id, input.societyId);
    return 'Post decision recorded.';
  });
}
export async function declarePollOfficerElectionAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await declarePollElection(input.payload, id, input.societyId);
    return 'Election declared. The declaration is final.';
  });
}
export async function updatePollOfficerDisputeAction(form: FormData) {
  const input = officerInput(form);
  return runServerAction('/elections/officer', async (id) => {
    await updatePollElectionDispute(input.payload, id, input.societyId);
    return 'Dispute updated.';
  });
}
