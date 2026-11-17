// Show a retry path when a resident Community screen cannot load.
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
  const { translate } = useLanguage();
  return (
    <ErrorPanel
      title={translate('Could not load Community')}
      message={translate('Nothing has changed. Try again in a moment.')}
      action={
        <Button onClick={retry} type="button" variant="secondary">
          {translate('Try again')}
        </Button>
      }
    />
  );
}
