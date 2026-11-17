// Save the signed-in user's editable profile fields.
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import { serverEnvironment } from '@/core/config/server-env';
import { LANGUAGE_PREFERENCE_COOKIE, isLocale } from '@/core/i18n/locale';
import {
  updateLanguagePreference,
  updateProfile,
} from '@/core/members/operations';

export async function updateProfileAction(formData: FormData) {
  return runServerAction('profile.update', async () => {
    await updateProfile(formData);
    revalidatePath('/profile');
    return 'Profile saved.';
  });
}

export async function saveLanguagePreferenceAction(input: unknown) {
  return runServerAction(
    'profile.updateLanguagePreference',
    async (requestId) => {
      await updateLanguagePreference(input, requestId);
      return 'Language preference saved.';
    },
  );
}

export async function saveDeviceLanguageAction(input: unknown) {
  return runServerAction('language.saveDevicePreference', async () => {
    if (!isLocale(input)) {
      throw new ValidationError({ language: 'Choose English or Hindi.' });
    }
    (await cookies()).set(LANGUAGE_PREFERENCE_COOKIE, input, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: serverEnvironment.public.NEXT_PUBLIC_APP_ENV !== 'local',
    });
    return 'Language preference saved.';
  });
}
