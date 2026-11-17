// Show the current resident's household and approver controls.
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { HouseholdDirectory } from '@/components/members/household-controls';
import { AppError } from '@/core/errors';
import { getHouseholdMembers } from '@/core/members/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'My Household | Homeish',
  robots: { index: false, follow: false },
};

export default async function HouseholdPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  let households: Awaited<ReturnType<typeof getHouseholdMembers>> | null = null;
  let loadError: unknown;
  try {
    households = await getHouseholdMembers();
  } catch (error) {
    loadError = error;
  }
  if (!households) {
    if (loadError instanceof AppError && loadError.code === 'FORBIDDEN') {
      return (
        <ErrorPanel
          message={t(
            'Only an owner or primary resident can manage household access.',
          )}
          title={t('Household access is restricted')}
        />
      );
    }
    throw loadError;
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('My Household')}</h1>
        <p className="text-body text-ink-muted">
          {t('Manage who can approve visitors for your unit.')}
        </p>
      </header>
      <Card title={t('Household members')}>
        <HouseholdDirectory data={households} />
      </Card>
    </section>
  );
}
