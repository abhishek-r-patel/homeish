// Rotate or disable the society join code through audited database functions.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  disableJoinCode,
  rotateJoinCode,
  updateHindiAvailability,
} from '@/core/society/operations';
import { saveManagingBodyName } from '@/core/tenancy/workspace-settings';

export async function rotateJoinCodeAction() {
  return runServerAction<string>(
    'society.rotateJoinCode',
    async (requestId) => {
      const joinCode = await rotateJoinCode(requestId);
      revalidatePath('/admin/settings');
      return { message: 'A new society join code is active.', data: joinCode };
    },
  );
}

export async function disableJoinCodeAction() {
  return runServerAction('society.disableJoinCode', async (requestId) => {
    await disableJoinCode(requestId);
    revalidatePath('/admin/settings');
    return 'Society self-registration is disabled.';
  });
}

export async function updateHindiAvailabilityAction(formData: FormData) {
  return runServerAction(
    'society.updateHindiAvailability',
    async (requestId) => {
      const settings = await updateHindiAvailability(
        {
          hindiAvailable: formData.get('hindiAvailable'),
          expectedVersion: formData.get('expectedVersion'),
        },
        requestId,
      );
      revalidatePath('/admin/settings');
      return { message: 'Language settings saved.', data: settings };
    },
  );
}

export async function saveManagingBodyNameAction(formData: FormData) {
  return runServerAction('society.updateManagingBodyName', async () => {
    await saveManagingBodyName(formData.get('name'));
    revalidatePath('/admin/settings');
    revalidatePath('/admin');
    return 'Managing-body name saved.';
  });
}
