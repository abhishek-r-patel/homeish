// Rotate or disable the society join code through audited database functions.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { disableJoinCode, rotateJoinCode } from '@/core/society/operations';

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
