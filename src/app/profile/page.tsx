// Account profile settings for the signed-in user.
import { ErrorPanel } from '@/components/ui/feedback';
import { ProfileContent } from '@/components/members/profile-controls';
import { LanguageProvider } from '@/components/language-provider';
import { AppError } from '@/core/errors';
import { isLocale } from '@/core/i18n/locale';
import { getProfile } from '@/core/members/operations';

export const metadata = {
  title: 'Profile | Homeish',
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  let loadError: unknown;
  try {
    profile = await getProfile();
  } catch (error) {
    loadError = error;
  }
  if (!profile) {
    if (
      loadError instanceof AppError &&
      ['UNAUTHENTICATED', 'SESSION_EXPIRED'].includes(loadError.code)
    ) {
      return (
        <ErrorPanel
          message="Sign in to view and update your account profile."
          title="Profile unavailable"
        />
      );
    }
    if (loadError !== undefined) throw loadError;
    throw new Error('Profile lookup returned no result.');
  }
  if (!isLocale(profile.language_preference)) {
    throw new Error('The saved language preference is unsupported.');
  }
  return (
    <LanguageProvider
      hindiEnabled={profile.isHindiEnabled}
      initialLocale={profile.language_preference}
      mode="account"
    >
      <ProfileContent profile={profile} />
    </LanguageProvider>
  );
}
