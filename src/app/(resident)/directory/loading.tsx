// Announce directory loading while its authenticated server read is pending.
import { Skeleton } from '@/components/ui/feedback';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export default async function DirectoryLoading() {
  const locale = await getRequestLocale();
  return (
    <section className="grid gap-space-5">
      <h1 className="text-title font-semibold">
        {translateMessage(locale, 'Resident directory')}
      </h1>
      <Skeleton
        label={translateMessage(locale, 'Loading resident directory')}
        rows={6}
      />
    </section>
  );
}
