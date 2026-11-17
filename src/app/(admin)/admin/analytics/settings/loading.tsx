// Keep the analytics settings responsive while the catalogue loads.
import { Skeleton } from '@/components/ui/feedback';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export default async function Loading() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  return <Skeleton label={t('Loading analytics settings')} rows={6} />;
}
