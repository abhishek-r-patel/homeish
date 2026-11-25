// Mark platform release notes read for the signed-in manager.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { markPlatformUpdateRead } from '@/core/updates/operations';

export async function markPlatformUpdateReadAction(formData: FormData) {
  return runServerAction('updates.mark_read', async () => {
    await markPlatformUpdateRead(String(formData.get('updateId') ?? ''));
    revalidatePath('/admin/whats-new');
    return { data: null, message: 'Release note marked read.' };
  });
}
