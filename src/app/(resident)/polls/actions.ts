// Submit a resident's own-unit ballot or voting-representative designation.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  setPollRepresentative,
  submitPollPrivateBallot,
  submitPollPublicBallot,
} from '@/core/poll/operations';
import {
  addPollElectionSupporters,
  respondPollElectionSupporter,
  submitPollElectionBallot,
  submitPollElectionNomination,
  withdrawPollElectionNomination,
} from '@/core/poll/election-participation';
import {
  choosePollElectionPost,
  raisePollElectionDispute,
} from '@/core/poll/election-follow-up';

export async function submitPollPublicBallotAction(form: FormData) {
  return runServerAction('/polls', async (requestId) => {
    await submitPollPublicBallot(readModuleActionInput(form), requestId);
    return 'Ballot submitted. You can change your public selection until voting closes.';
  });
}

export async function submitPollPrivateBallotAction(form: FormData) {
  return runServerAction('/polls', async (requestId) => {
    await submitPollPrivateBallot(readModuleActionInput(form), requestId);
    return 'Ballot submitted. Your private choices are not shown here.';
  });
}

export async function setOwnPollRepresentativeAction(form: FormData) {
  return runServerAction('/polls/representatives', async (requestId) => {
    await setPollRepresentative(readModuleActionInput(form), requestId);
    return 'Voting representative saved.';
  });
}

export async function submitPollElectionNominationAction(form: FormData) {
  return runServerAction('/polls/elections', async (requestId) => {
    await submitPollElectionNomination(readModuleActionInput(form), requestId);
    return 'Nomination submitted.';
  });
}
export async function withdrawPollElectionNominationAction(form: FormData) {
  return runServerAction('/polls/elections', async (requestId) => {
    await withdrawPollElectionNomination(
      readModuleActionInput(form),
      requestId,
    );
    return 'Nomination withdrawn.';
  });
}
export async function addPollElectionSupportersAction(form: FormData) {
  return runServerAction('/polls/elections', async (requestId) => {
    await addPollElectionSupporters(readModuleActionInput(form), requestId);
    return 'Supporter requests saved.';
  });
}
export async function respondPollElectionSupporterAction(form: FormData) {
  return runServerAction('/polls/elections', async (requestId) => {
    const input = readModuleActionInput(form);
    if (!input || typeof input !== 'object') return 'Check the response.';
    const value = input as { supporterId?: unknown; confirm?: unknown };
    await respondPollElectionSupporter(
      value.supporterId,
      value.confirm === true,
      requestId,
    );
    return 'Supporter response saved.';
  });
}
export async function submitPollElectionBallotAction(form: FormData) {
  return runServerAction('/polls/elections', async (requestId) => {
    await submitPollElectionBallot(readModuleActionInput(form), requestId);
    return 'Your unit ballot is submitted. Choices are not shown here.';
  });
}
export async function choosePollElectionPostAction(form: FormData) {
  return runServerAction('/polls/elections', async (requestId) => {
    await choosePollElectionPost(readModuleActionInput(form), requestId);
    return 'Post choice saved.';
  });
}
export async function raisePollElectionDisputeAction(form: FormData) {
  return runServerAction('/polls/elections', async (requestId) => {
    await raisePollElectionDispute(readModuleActionInput(form), requestId);
    return 'Dispute raised.';
  });
}
