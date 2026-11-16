// Show a retry path when an administrator Community screen cannot load.
'use client';
import { Button } from '@/components/ui/button';
import { ErrorPanel } from '@/components/ui/feedback';

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorPanel
      title="Could not load Community administration"
      message="Nothing has changed. Try again in a moment."
      action={
        <Button onClick={retry} type="button" variant="secondary">
          Try again
        </Button>
      }
    />
  );
}
