// Validate and authorize gate and guard settings at the server-action boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  addGuard,
  setGuardPin,
  updateGateSettings,
  updateGuard,
} from '@/core/guards/operations';

export async function addGuardAction(formData: FormData) {
  return runServerAction('guards.add', async (requestId) => {
    await addGuard(formData, requestId);
    revalidatePath('/admin/guards');
    return 'Guard added.';
  });
}

export async function updateGuardAction(formData: FormData) {
  return runServerAction('guards.update', async (requestId) => {
    await updateGuard(formData, requestId);
    revalidatePath('/admin/guards');
    return 'Guard settings updated.';
  });
}

export async function setGuardPinAction(formData: FormData) {
  return runServerAction('guards.setPin', async (requestId) => {
    await setGuardPin(formData, requestId);
    revalidatePath('/admin/guards');
    return 'Guard PIN saved.';
  });
}

export async function updateGateSettingsAction(formData: FormData) {
  return runServerAction('society.updateGateSettings', async (requestId) => {
    await updateGateSettings(formData, requestId);
    revalidatePath('/admin/guards');
    revalidatePath('/guard');
    return 'Gate settings updated.';
  });
}
