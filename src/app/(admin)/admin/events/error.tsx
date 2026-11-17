// Show a retry path when the events workspace cannot load.
'use client';
import { Button } from '@/components/ui/button';
import { ErrorPanel } from '@/components/ui/feedback';
import { useLanguage } from '@/components/language-provider';

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { translate: t } = useLanguage();
  return (
    <ErrorPanel
      title={t('Could not load events')}
      message={t('Nothing has changed. Try again in a moment.')}
      action={
        <Button onClick={retry} type="button" variant="secondary">
          {t('Try again')}
        </Button>
      }
    />
  );
}
