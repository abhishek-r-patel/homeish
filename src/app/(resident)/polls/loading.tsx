// Keep poll navigation responsive while the authorized list loads.
import { Skeleton } from '@/components/ui/feedback';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export default async function Loading() {
  const locale = await getRequestLocale();
  return (
    <Skeleton label={translateMessage(locale, 'Loading polls')} rows={5} />
  );
}
