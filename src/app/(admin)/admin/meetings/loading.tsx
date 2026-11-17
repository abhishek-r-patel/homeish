// Keep the meetings workspace responsive while authorized data loads.
import { Skeleton } from '@/components/ui/feedback';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export default async function Loading() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  return <Skeleton label={t('Loading meetings')} rows={5} />;
}
