// Expose authorized P46 election-management operations to admin screens.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  advancePollElection,
  cancelPollElection,
  savePollElection,
} from '@/core/poll/election-operations';
import {
  linkPollElectionSource,
  savePollElectionActivities,
  savePollElectionHelpers,
  setPollOfficialVoting,
  unlinkPollElectionSource,
  updatePollElectionSettings,
} from '@/core/poll/election-setup-operations';
import {
  assignPollElectionOfficer,
  revokePollElectionOfficer,
} from '@/core/poll/election-officer-operations';
import {
  initPollElectionVoters,
  removePollElectionVoter,
  restorePollElectionVoter,
  setPollElectionVoter,
} from '@/core/poll/election-participation';
import {
  linkPollElectionExpense,
  recordPollElectionExternalResult,
  savePollElectionOutside,
} from '@/core/poll/election-follow-up';

function action(
  path: string,
  operation: (id: string) => Promise<unknown>,
  message: string,
) {
  return runServerAction(path, async (id) => {
    await operation(id);
    return message;
  });
}

export async function savePollElectionAction(form: FormData) {
  return runServerAction('/admin/polls/elections', async (id) => {
    const data = await savePollElection(readModuleActionInput(form), id);
    return { message: 'Official election saved.', data };
  });
}
export async function advancePollElectionAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => advancePollElection(readModuleActionInput(form), id),
    'Official election advanced.',
  );
}
export async function cancelPollElectionAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => cancelPollElection(readModuleActionInput(form), id),
    'Official election cancelled.',
  );
}
export async function setPollOfficialVotingAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => setPollOfficialVoting(readModuleActionInput(form), id),
    'Official voting setting saved.',
  );
}
export async function updatePollElectionSettingsAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => updatePollElectionSettings(readModuleActionInput(form), id),
    'Election defaults saved.',
  );
}
export async function assignPollElectionOfficerAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => assignPollElectionOfficer(readModuleActionInput(form), id),
    'Returning officer assigned.',
  );
}
export async function revokePollElectionOfficerAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => revokePollElectionOfficer(readModuleActionInput(form), id),
    'Returning-officer access revoked.',
  );
}
export async function initPollElectionVotersAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => initPollElectionVoters(readModuleActionInput(form), id),
    'Owner voter list created.',
  );
}
export async function setPollElectionVoterAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => setPollElectionVoter(readModuleActionInput(form), id),
    'Unit voter saved.',
  );
}
export async function removePollElectionVoterAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => removePollElectionVoter(readModuleActionInput(form), id),
    'Unit removed from the voter list.',
  );
}
export async function restorePollElectionVoterAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => restorePollElectionVoter(readModuleActionInput(form), id),
    'Unit restored to the voter list.',
  );
}
export async function savePollElectionActivitiesAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => savePollElectionActivities(readModuleActionInput(form), id),
    'Election schedule saved.',
  );
}
export async function savePollElectionHelpersAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => savePollElectionHelpers(readModuleActionInput(form), id),
    'Election helpers saved.',
  );
}
export async function linkPollElectionSourceAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => linkPollElectionSource(readModuleActionInput(form), id),
    'Election source linked.',
  );
}
export async function unlinkPollElectionSourceAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => unlinkPollElectionSource(readModuleActionInput(form), id),
    'Election source unlinked.',
  );
}
export async function linkPollElectionExpenseAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => linkPollElectionExpense(readModuleActionInput(form), id),
    'Posted expense linked to the election.',
  );
}
export async function recordPollElectionExternalResultAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => recordPollElectionExternalResult(readModuleActionInput(form), id),
    'Outside-app result recorded.',
  );
}
export async function savePollElectionOutsideAction(form: FormData) {
  return action(
    '/admin/polls/elections',
    (id) => savePollElectionOutside(readModuleActionInput(form), id),
    'Outside-app election recorded.',
  );
}
