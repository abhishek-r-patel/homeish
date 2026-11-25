// Show published platform release notes to society managers.
import { PlatformUpdateList } from '@/components/updates/update-list';
import { getPlatformUpdates } from '@/core/updates/operations';
import { markPlatformUpdateReadAction } from './actions';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: "What's new | Homeish",
  robots: { index: false, follow: false },
};

export default async function WhatsNewPage() {
  const updates = await getPlatformUpdates();
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  return (
    <section className="mx-auto grid max-w-content-narrow gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t("What's new")}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Product notes from the Homeish developer. There are no email or push alerts.',
          )}
        </p>
      </header>
      <PlatformUpdateList
        markReadAction={markPlatformUpdateReadAction}
        updates={updates}
      />
    </section>
  );
}
