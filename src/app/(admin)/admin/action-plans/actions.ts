// Create, edit and archive plans, and retain task history when admins remove tasks.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  createSampleActionPlan,
  deleteActionTask,
  saveActionPlan,
  saveActionTask,
  setActionPlanArchived,
} from '@/core/toolkit/operations';

const ROUTE = '/admin/action-plans';

export async function saveActionPlanAction(form: FormData) {
  return runServerAction<{ planId: string }>(ROUTE, async (requestId) => ({
    message: 'Plan saved.',
    data: {
      planId: await saveActionPlan(readModuleActionInput(form), requestId),
    },
  }));
}

export async function createSampleActionPlanAction(form: FormData) {
  return runServerAction<{ planId: string }>(ROUTE, async (requestId) => ({
    message: 'Sample plan created. Edit its tasks to suit your society.',
    data: {
      planId: await createSampleActionPlan(
        readModuleActionInput(form),
        requestId,
      ),
    },
  }));
}

export async function setActionPlanArchivedAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) =>
    (await setActionPlanArchived(readModuleActionInput(form), requestId))
      ? 'Plan archived.'
      : 'Plan restored.',
  );
}

export async function saveActionTaskAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await saveActionTask(readModuleActionInput(form), requestId);
    return 'Task saved.';
  });
}

export async function deleteActionTaskAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await deleteActionTask(readModuleActionInput(form), requestId);
    return 'Task removed. Its history is retained.';
  });
}
