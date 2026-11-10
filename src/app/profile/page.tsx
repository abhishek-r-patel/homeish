// Account profile settings for the signed-in user.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { ProfileForm } from '@/components/members/profile-controls';
import { AppError } from '@/core/errors';
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
  return (
    <main className="mx-auto grid min-h-dvh max-w-content-default content-start gap-space-5 px-space-4 py-space-6">
      <Link className="text-brand underline-offset-2 hover:underline" href="/">
        Back to Homeish
      </Link>
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Your Profile</h1>
        <p className="text-body text-ink-muted">
          Update your contact details and saved display preferences.
        </p>
      </header>
      <Card title="Account details">
        <ProfileForm profile={profile} />
      </Card>
    </main>
  );
}
