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
