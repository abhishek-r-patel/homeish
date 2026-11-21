// Announce the resident home while its authorized household read is pending.
import { Skeleton } from '@/components/ui/feedback';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export default async function ResidentHomeLoading() {
  const locale = await getRequestLocale();
  return (
    <section className="grid gap-space-5">
      <h1 className="text-title font-semibold">
        {translateMessage(locale, 'Home')}
      </h1>
      <Skeleton label={translateMessage(locale, 'Loading home')} rows={6} />
    </section>
  );
}
