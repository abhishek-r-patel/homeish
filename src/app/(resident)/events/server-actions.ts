// Expose the resident's per-home event RSVP update.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import { setEventRsvp } from '@/core/event/operations';
import { rupeesFromPaise } from '@/lib/money';

export async function setEventRsvpAction(form: FormData) {
  return runServerAction('/events/rsvp', async (requestId) => {
    const result = await setEventRsvp(readModuleActionInput(form), requestId);
    const charge =
      result.chargedPaise > 0
        ? ` ₹${rupeesFromPaise(result.chargedPaise)} is on your flat’s bill.`
        : '';
    return {
      message:
        result.status === 'going'
          ? `RSVP saved: ${result.headcount} going.${charge}`
          : 'RSVP saved: not going.',
      data: result,
    };
  });
}
