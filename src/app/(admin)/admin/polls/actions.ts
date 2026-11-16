// Expose authorized poll-management operations to admin and committee screens.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  activatePoll,
  cancelPoll,
  completePollEarly,
  createPollDraft,
  deletePollDraft,
  extendPollDeadline,
  savePollDraft,
  schedulePoll,
  setPollRepresentative,
  updatePollSettings,
  withdrawPollSchedule,
} from '@/core/poll/operations';

export async function createPollDraftAction(form: FormData) {
  return runServerAction('/admin/polls/new', async (requestId) => ({
    message: 'Draft created.',
    data: await createPollDraft(readModuleActionInput(form), requestId),
  }));
}

export async function savePollDraftAction(form: FormData) {
  return runServerAction('/admin/polls/edit', async (requestId) => {
    await savePollDraft(readModuleActionInput(form), requestId);
    return 'Draft saved.';
  });
}

export async function deletePollDraftAction(form: FormData) {
  return runServerAction('/admin/polls', async (requestId) => {
    await deletePollDraft(readModuleActionInput(form), requestId);
    return 'Draft deleted.';
  });
}

export async function activatePollAction(form: FormData) {
  return runServerAction('/admin/polls', async (requestId) => {
    await activatePoll(readModuleActionInput(form), requestId);
    return 'Voting is open.';
  });
}

export async function schedulePollAction(form: FormData) {
  return runServerAction('/admin/polls', async (requestId) => {
    await schedulePoll(readModuleActionInput(form), requestId);
    return 'Poll scheduled.';
  });
}

export async function withdrawPollScheduleAction(form: FormData) {
  return runServerAction('/admin/polls', async (requestId) => {
    await withdrawPollSchedule(readModuleActionInput(form), requestId);
    return 'Schedule withdrawn. The draft can be edited again.';
  });
}

export async function extendPollDeadlineAction(form: FormData) {
  return runServerAction('/admin/polls', async (requestId) => {
    await extendPollDeadline(readModuleActionInput(form), requestId);
    return 'Poll deadline extended.';
  });
}

export async function completePollEarlyAction(form: FormData) {
  return runServerAction('/admin/polls', async (requestId) => {
    await completePollEarly(readModuleActionInput(form), requestId);
    return 'Poll completed.';
  });
}

export async function cancelPollAction(form: FormData) {
  return runServerAction('/admin/polls', async (requestId) => {
    await cancelPoll(readModuleActionInput(form), requestId);
    return 'Poll cancelled.';
  });
}

export async function updatePollSettingsAction(form: FormData) {
  return runServerAction('/admin/polls/settings', async (requestId) => {
    await updatePollSettings(readModuleActionInput(form), requestId);
    return 'Voting settings saved.';
  });
}

export async function setPollRepresentativeAction(form: FormData) {
  return runServerAction('/admin/polls/representatives', async (requestId) => {
    await setPollRepresentative(readModuleActionInput(form), requestId);
    return 'Voting representative saved.';
  });
}
