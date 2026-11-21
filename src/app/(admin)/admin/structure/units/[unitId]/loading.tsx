// Keep the unit workspace's loading state distinct from empty records.
import { Skeleton } from '@/components/ui/feedback';
import { translateMessage } from '@/core/i18n/messages';
import { getRequestLocale } from '@/core/i18n/request-locale';

export default async function Loading() {
  return (
    <Skeleton
      label={translateMessage(await getRequestLocale(), 'Loading unit records')}
    />
  );
}
