// Save the resident's chosen dashboard graph mode.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { saveResidentGraphMode } from '@/core/home/workspace-operations';

export async function saveResidentGraphModeAction(input: unknown) {
  return runServerAction('home.saveGraphMode', async () => {
    await saveResidentGraphMode(input);
    revalidatePath('/home');
    return 'Graph preference saved.';
  });
}
