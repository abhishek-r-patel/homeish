// Render the society guard roster and gate identification settings.
import { GuardSettingsControls } from '@/components/guards/guard-controls';
import { listGuards } from '@/core/guards/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export default async function GuardsPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const data = await listGuards();
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {t('Society settings')}
        </p>
        <h1 className="text-heading font-semibold">{t('Gate and guards')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Set how guards sign in and manage the names used in gate records.',
          )}
        </p>
      </header>
      <GuardSettingsControls {...data} />
    </section>
  );
}
