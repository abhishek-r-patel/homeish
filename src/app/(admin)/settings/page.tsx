// Configure self-registration for the active society.
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { JoinCodeControls } from '@/components/society/join-code-controls';
import { AppError } from '@/core/errors';
import { getJoinCodeSettings } from '@/core/society/operations';

export const metadata = {
  title: 'Registration settings | Homeish',
  robots: { index: false, follow: false },
};

export default async function SocietySettingsPage() {
  let settings: Awaited<ReturnType<typeof getJoinCodeSettings>> | null = null;
  let loadError: unknown;
  try {
    settings = await getJoinCodeSettings();
  } catch (error) {
    loadError = error;
  }
  if (!settings) {
    if (loadError instanceof AppError && loadError.code === 'FORBIDDEN') {
      return (
        <ErrorPanel
          message="Sign in with an administrator account for this society."
          title="Registration settings are restricted"
        />
      );
    }
    throw loadError;
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Registration settings</h1>
        <p className="text-body text-ink-muted">
          Manage the code residents use to request access to this society.
        </p>
      </header>
      <Card
        description="Requests remain pending until an administrator approves them."
        title="Society join code"
      >
        <JoinCodeControls initialJoinCode={settings.joinCode} />
      </Card>
    </section>
  );
}
