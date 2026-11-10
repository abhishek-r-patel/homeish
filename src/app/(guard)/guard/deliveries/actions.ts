// Keep guard delivery mutations behind the shared server-action boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  createDeliveryEntry,
  markDeliveryCollected,
  overrideDelivery,
} from '@/core/delivery/operations';

function value(formData: FormData, key: string) {
  const result = formData.get(key);
  return typeof result === 'string' ? result : '';
}

export async function createDeliveryEntryAction(formData: FormData) {
  return runServerAction('delivery.createEntry', async (requestId) => {
    const result = await createDeliveryEntry(
      {
        unitId: value(formData, 'unitId'),
        company: value(formData, 'company'),
        deliveryPerson: value(formData, 'deliveryPerson') || null,
        deliveryType: value(formData, 'deliveryType'),
        photoPath: value(formData, 'photoPath') || null,
        clientRequestId: value(formData, 'clientRequestId'),
      },
      requestId,
    );
    revalidatePath('/guard/deliveries');
    revalidatePath('/deliveries');
    revalidatePath('/admin/deliveries');
    return {
      message:
        result.status === 'pending_response'
          ? 'Resident notified.'
          : 'Delivery preference applied.',
      data: result.id,
    };
  });
}

export async function collectDeliveryAsGuardAction(formData: FormData) {
  return runServerAction('delivery.collect.guard', async (requestId) => {
    await markDeliveryCollected(value(formData, 'entryId'), requestId);
    revalidatePath('/guard/deliveries');
    revalidatePath('/deliveries');
    revalidatePath('/admin/deliveries');
    return 'Delivery marked as collected.';
  });
}

export async function overrideDeliveryAction(formData: FormData) {
  return runServerAction('delivery.override', async (requestId) => {
    await overrideDelivery(
      value(formData, 'entryId'),
      value(formData, 'decision'),
      value(formData, 'reason'),
      requestId,
    );
    revalidatePath('/guard/deliveries');
    revalidatePath('/deliveries');
    revalidatePath('/admin/deliveries');
    return 'Guard decision recorded and residents notified.';
  });
}
