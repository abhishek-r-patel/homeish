// Keep delivery forms retry-safe and expose server-action feedback accessibly.
'use client';

import { useRef, useState, useTransition } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';

export type DeliveryFormAction = (
  formData: FormData,
) => Promise<ServerActionResult<unknown>>;

export function DeliveryActionForm({
  action,
  children,
  className,
  requestIdStorageKey,
}: {
  action: DeliveryFormAction;
  children: ReactNode;
  className?: string;
  requestIdStorageKey?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (completed) {
      setMessage('This delivery entry is already saved.');
      return;
    }
    const formData = new FormData(event.currentTarget);
    if (formData.get('photoUploadPending') === 'true') {
      setMessage('Wait for the delivery photo upload to finish.');
      return;
    }
    if (requestIdStorageKey && formData.has('clientRequestId')) {
      try {
        const requestId =
          sessionStorage.getItem(requestIdStorageKey) ?? crypto.randomUUID();
        sessionStorage.setItem(requestIdStorageKey, requestId);
        formData.set('clientRequestId', requestId);
      } catch {
        setMessage(
          'Could not prepare a safe retry key. Check browser storage.',
        );
        return;
      }
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const nextResult = await action(formData);
        setResult(nextResult);
        if (nextResult.ok && requestIdStorageKey) {
          setCompleted(true);
          try {
            sessionStorage.removeItem(requestIdStorageKey);
          } catch {
            setMessage(
              'The entry was saved, but its retry key could not be cleared. Do not submit it again.',
            );
          }
        }
      } catch {
        setMessage(
          'Could not reach the server. Your details remain here; reconnect and retry.',
        );
      }
    });
  }

  function startAnotherEntry() {
    try {
      if (requestIdStorageKey) sessionStorage.removeItem(requestIdStorageKey);
      formRef.current?.reset();
      setResult(null);
      setMessage(null);
      setCompleted(false);
    } catch {
      setMessage('Could not reset the form. Refresh before creating another.');
    }
  }

  return (
    <form className={className} onSubmit={submit} ref={formRef}>
      {children}
      {completed ? (
        <button
          className="min-h-12 w-fit rounded-md border border-rule-strong px-space-4 font-semibold"
          onClick={startAnotherEntry}
          type="button"
        >
          Log another delivery
        </button>
      ) : null}
      {message ? (
        <p
          aria-live="polite"
          className="text-caption text-danger"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {result ? (
        <p
          aria-live="polite"
          className={`text-caption ${result.ok ? 'text-ink-muted' : 'text-danger'}`}
          role="status"
        >
          {result.message}
          {!result.ok && result.referenceId
            ? ` Reference: ${result.referenceId}`
            : ''}
        </p>
      ) : null}
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? 'Working…' : ''}
      </span>
    </form>
  );
}
