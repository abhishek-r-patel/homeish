// Expose resident meeting check-in and personal action-item updates.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  selfCheckInToMeeting,
  setMeetingActionStatus,
} from '@/core/meeting/operations';

export async function selfCheckInToMeetingAction(form: FormData) {
  return runServerAction('/meetings/check-in', async (requestId) => {
    const result = await selfCheckInToMeeting(
      readModuleActionInput(form),
      requestId,
    );
    return result.alreadyPresent
      ? 'This home was already marked present.'
      : 'You are checked in. Thank you.';
  });
}

export async function setMyMeetingActionStatusAction(form: FormData) {
  return runServerAction('/meetings/actions', async (requestId) => {
    const result = await setMeetingActionStatus(
      readModuleActionInput(form),
      requestId,
    );
    return result.status === 'done'
      ? 'Action item marked as done.'
      : 'Action item reopened.';
  });
}
