// Toggle a resident's upvote on a common-area request and show the shared count.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { RequestFormAction } from './action-form';

export function ServiceRequestUpvote({
  action,
  canVote,
  count,
  requestId,
  upvoted,
}: {
  action: RequestFormAction;
  canVote: boolean;
  count: number;
  requestId: string;
  upvoted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const countLabel = `${count} ${count === 1 ? 'upvote' : 'upvotes'}`;

  function toggle() {
    const formData = new FormData();
    formData.set('input', JSON.stringify({ requestId, upvoted: !upvoted }));
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.ok) router.refresh();
        else setError(result.message);
      } catch {
        setError('Could not reach the server. Reconnect and retry.');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-space-3">
      <span className="text-caption text-ink-muted">{countLabel}</span>
      {canVote ? (
        <Button
          aria-pressed={upvoted}
          disabled={pending}
          loading={pending}
          onClick={toggle}
          type="button"
          variant="secondary"
        >
          {upvoted ? 'Remove upvote' : 'Upvote'}
        </Button>
      ) : null}
      {error ? (
        <p aria-live="polite" className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
