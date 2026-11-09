// Browser-only synthetic interaction; never creates or updates society records.
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { demoExample } from './content';

export const DEMO_RESET_INTERVAL_MS = 15 * 60 * 1000;

export function DemoPreview() {
  const [decision, setDecision] = useState<'waiting' | 'allowed' | 'denied'>(
    'waiting',
  );
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDecision('waiting');
      setResetMessage('The synthetic example was automatically reset.');
    }, DEMO_RESET_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="mt-space-6 rounded-lg border border-rule bg-surface p-space-5">
      <h2 className="text-heading font-semibold">
        Try a sample visitor decision
      </h2>
      <p className="mt-space-3 text-ink-muted">
        {demoExample.visitor} is visiting unit {demoExample.unit}. No real
        visitor is notified and nothing is saved.
      </p>
      <p aria-live="polite" className="mt-space-5 font-semibold" role="status">
        {decision === 'waiting'
          ? 'Awaiting your sample decision'
          : decision === 'allowed'
            ? 'Sample visitor allowed'
            : 'Sample visitor denied'}
      </p>
      <div className="mt-space-5 flex flex-wrap gap-space-3">
        {decision === 'waiting' && (
          <>
            <Button
              onClick={() => {
                setDecision('allowed');
                setResetMessage('');
              }}
            >
              Allow Sample Visitor
            </Button>
            <Button
              onClick={() => {
                setDecision('denied');
                setResetMessage('');
              }}
              variant="secondary"
            >
              Deny Sample Visitor
            </Button>
          </>
        )}
        <Button
          onClick={() => {
            setDecision('waiting');
            setResetMessage('The synthetic example was reset.');
          }}
          variant="secondary"
        >
          Reset Demo
        </Button>
      </div>
      <p className="mt-space-4 text-caption text-ink-muted">
        This example resets every 15 minutes while this page is open, or when
        you reload. Changes exist only in this browser tab.
      </p>
      <p aria-live="polite" className="mt-space-3 text-caption text-ink-muted">
        {resetMessage}
      </p>
    </section>
  );
}
