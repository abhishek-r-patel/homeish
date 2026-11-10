// Save the signed-in user's editable profile fields.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { updateProfile } from '@/core/members/operations';

export async function updateProfileAction(formData: FormData) {
  return runServerAction('profile.update', async () => {
    await updateProfile(formData);
    revalidatePath('/profile');
    return 'Profile saved.';
  });
}
