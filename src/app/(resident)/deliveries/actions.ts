// Handle resident delivery decisions, collection and unit preferences.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  markDeliveryCollected,
  respondToDelivery,
  setDeliveryPreference,
} from '@/core/delivery/operations';

function value(formData: FormData, key: string) {
  const result = formData.get(key);
  return typeof result === 'string' ? result : '';
}

export async function respondToDeliveryAction(formData: FormData) {
  return runServerAction('delivery.respond', async (requestId) => {
    await respondToDelivery(
      value(formData, 'entryId'),
      value(formData, 'decision'),
      requestId,
    );
    revalidatePath('/deliveries');
    revalidatePath('/guard/deliveries');
    revalidatePath('/admin/deliveries');
    return 'Your delivery response was recorded.';
  });
}

export async function collectDeliveryAction(formData: FormData) {
  return runServerAction('delivery.collect', async (requestId) => {
    await markDeliveryCollected(value(formData, 'entryId'), requestId);
    revalidatePath('/deliveries');
    revalidatePath('/guard/deliveries');
    revalidatePath('/admin/deliveries');
    return 'Delivery marked as collected.';
  });
}

export async function setDeliveryPreferenceAction(formData: FormData) {
  return runServerAction('delivery.preference.update', async (requestId) => {
    await setDeliveryPreference(
      value(formData, 'unitId'),
      value(formData, 'rule'),
      requestId,
    );
    revalidatePath('/deliveries');
    return 'Delivery preference saved.';
  });
}
