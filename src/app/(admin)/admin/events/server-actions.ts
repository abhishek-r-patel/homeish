// Expose authorized event-management operations to administrator and committee screens.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  cancelEvent,
  createEvent,
  deleteEventDraft,
  publishEvent,
  updateEvent,
} from '@/core/event/operations';
import { eventUpdateMessage } from '@/core/event/summary';

export async function createEventAction(form: FormData) {
  return runServerAction('/admin/events/new', async (requestId) => ({
    message: 'Event draft saved.',
    data: await createEvent(readModuleActionInput(form), requestId),
  }));
}

export async function updateEventAction(form: FormData) {
  return runServerAction('/admin/events/edit', async (requestId) => {
    const result = await updateEvent(readModuleActionInput(form), requestId);
    return {
      message: eventUpdateMessage(result),
      data: result,
    };
  });
}

export async function deleteEventDraftAction(form: FormData) {
  return runServerAction('/admin/events', async (requestId) => {
    await deleteEventDraft(readModuleActionInput(form), requestId);
    return 'Draft deleted.';
  });
}

export async function publishEventAction(form: FormData) {
  return runServerAction('/admin/events', async (requestId) => {
    const result = await publishEvent(readModuleActionInput(form), requestId);
    return result.notified === 0
      ? 'Event published. Nobody in the audience could be notified yet.'
      : `Event published and ${result.notified} ${result.notified === 1 ? 'person' : 'people'} notified.`;
  });
}

export async function cancelEventAction(form: FormData) {
  return runServerAction('/admin/events', async (requestId) => {
    const result = await cancelEvent(readModuleActionInput(form), requestId);
    return result.refundedUnits === 0
      ? 'Event cancelled and invited homes notified.'
      : `Event cancelled, invited homes notified and ${result.refundedUnits} ${result.refundedUnits === 1 ? 'flat' : 'flats'} credited.`;
  });
}
