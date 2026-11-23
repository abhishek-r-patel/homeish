// Create one P46 official election after the society-level switch is on.
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/data-display';
import { PollElectionEditorForm } from '@/components/poll/election-admin-forms';
import { getPollElectionSettings } from '@/core/poll/election-setup-operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'New official election | Homeish',
  robots: { index: false, follow: false },
};

export default async function NewPollElectionPage() {
  const locale = await getRequestLocale();
  const settings = await getPollElectionSettings();
  if (!settings.official_voting_enabled) notFound();
  const t = (source: string) => translateMessage(locale, source);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">
        {t('Start official election')}
      </h1>
      <Card title={t('Planning')}>
        <PollElectionEditorForm />
      </Card>
    </section>
  );
}
