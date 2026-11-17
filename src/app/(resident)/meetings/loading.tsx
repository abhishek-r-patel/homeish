// Keep the resident meetings screen responsive while authorized data loads.
import { Skeleton } from '@/components/ui/feedback';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export default async function Loading() {
  const locale = await getRequestLocale();
  return (
    <Skeleton label={translateMessage(locale, 'Loading meetings')} rows={5} />
  );
}
