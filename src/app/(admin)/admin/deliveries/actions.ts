// Save delivery module settings through the shared server-action boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { updateDeliverySettings } from '@/core/delivery/operations';

function value(formData: FormData, key: string) {
  const result = formData.get(key);
  return typeof result === 'string' ? result : '';
}

export async function updateDeliverySettingsAction(formData: FormData) {
  return runServerAction('delivery.settings.update', async (requestId) => {
    await updateDeliverySettings(
      {
        response_timeout_minutes: Number(
          value(formData, 'responseTimeoutMinutes'),
        ),
        uncollected_days: Number(value(formData, 'uncollectedDays')),
        leave_at_gate_enabled: formData.get('leaveAtGateEnabled') === 'on',
      },
      requestId,
    );
    revalidatePath('/admin/deliveries');
    revalidatePath('/guard/deliveries');
    revalidatePath('/deliveries');
    return 'Delivery settings saved.';
  });
}
