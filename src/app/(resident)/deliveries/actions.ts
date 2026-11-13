// Handle resident delivery decisions, collection, preferences and expected deliveries.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  cancelDeliveryPreAnnouncement,
  getDeliverySocietyTimezone,
  markDeliveryCollected,
  preAnnounceDelivery,
  respondToDelivery,
  setDeliveryPreference,
} from '@/core/delivery/operations';
import { localTimeToIso } from '@/lib/local-time';

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

export async function preAnnounceDeliveryAction(formData: FormData) {
  return runServerAction('delivery.pre_announce.create', async (requestId) => {
    const timezone = await getDeliverySocietyTimezone();
    await preAnnounceDelivery(
      {
        unitId: value(formData, 'unitId'),
        platform: value(formData, 'platform'),
        expectedFrom: localTimeToIso(value(formData, 'expectedFrom'), timezone),
        expectedTo: localTimeToIso(value(formData, 'expectedTo'), timezone),
        clientRequestId: value(formData, 'clientRequestId'),
      },
      requestId,
    );
    revalidatePath('/deliveries');
    revalidatePath('/guard/deliveries');
    return 'Expected delivery saved. The gate can see it.';
  });
}

export async function cancelDeliveryPreAnnouncementAction(formData: FormData) {
  return runServerAction('delivery.pre_announce.cancel', async (requestId) => {
    await cancelDeliveryPreAnnouncement(
      value(formData, 'announcementId'),
      requestId,
    );
    revalidatePath('/deliveries');
    revalidatePath('/guard/deliveries');
    return 'Expected delivery cancelled.';
  });
}
