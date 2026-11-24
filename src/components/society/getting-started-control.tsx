// Restore the admin's dismissed P55 Getting started card.
'use client';

import { useState, useTransition } from 'react';
import { setGettingStartedDismissedAction } from '@/app/workspace-actions';
import { Button } from '@/components/ui/button';
import { useUiTranslator } from '@/components/ui/language';

export function GettingStartedControl() {
  const { translate: t, translateFeedback } = useUiTranslator();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  return (
    <div className="grid gap-space-3">
      <p className="text-body text-ink-muted">
        {t(
          'Bring back the self-ticking Getting started card on the admin dashboard.',
        )}
      </p>
      <Button
        disabled={pending}
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setGettingStartedDismissedAction(false);
            setMessage(result.message ?? t('Getting started restored.'));
          })
        }
        variant="secondary"
      >
        {t('Show Getting started')}
      </Button>
      {message ? (
        <p aria-live="polite" className="text-caption" role="status">
          {translateFeedback(message)}
        </p>
      ) : null}
    </div>
  );
}
