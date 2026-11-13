// Submit staff forms through server actions and render accessible feedback.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Button } from '@/components/ui/button';

export type StaffFormAction = (
  formData: FormData,
) => Promise<ServerActionResult<unknown>>;

export function StaffActionForm({
  action,
  children,
  className = 'grid min-w-0 gap-space-3',
  confirmMessage,
  input,
  requestIdStorageKey,
  submitLabel,
  submitVariant = 'primary',
}: {
  action: StaffFormAction;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  input: (formData: FormData) => unknown;
  requestIdStorageKey?: string | ((formData: FormData) => string);
  submitLabel: string;
  submitVariant?: 'primary' | 'secondary' | 'destructive';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (formData.get('uploadPending') === 'true') {
      setLocalError('Wait for the staff photo to finish uploading.');
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    let payload: unknown;
    let activeRequestIdStorageKey: string | null = null;
    try {
      payload = input(formData);
      if (requestIdStorageKey) {
        activeRequestIdStorageKey =
          typeof requestIdStorageKey === 'function'
            ? requestIdStorageKey(formData)
            : requestIdStorageKey;
        const requestId =
          sessionStorage.getItem(activeRequestIdStorageKey) ??
          crypto.randomUUID();
        sessionStorage.setItem(activeRequestIdStorageKey, requestId);
        if (typeof payload !== 'object' || payload === null) {
          throw new Error('The staff request could not be prepared.');
        }
        payload = { ...payload, requestId };
      }
      formData.set('input', JSON.stringify(payload));
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : 'The staff details could not be prepared.',
      );
      return;
    }
    setLocalError(null);
    startTransition(async () => {
      try {
        const nextResult = await action(formData);
        setResult(nextResult);
        if (nextResult.ok) {
          if (activeRequestIdStorageKey) {
            try {
              sessionStorage.removeItem(activeRequestIdStorageKey);
            } catch {
              setLocalError(
                'Saved, but the retry key could not be cleared. Refresh before registering another staff member.',
              );
            }
          }
          router.refresh();
        }
      } catch {
        setLocalError(
          'Could not reach the server. Your details remain here; reconnect and retry.',
        );
      }
    });
  }

  return (
    <form className={className} onSubmit={submit}>
      {children}
      {localError ? (
        <p className="text-caption text-danger" role="alert">
          {localError}
        </p>
      ) : null}
      {result ? (
        <p
          className={`text-caption ${result.ok ? 'text-ink-muted' : 'text-danger'}`}
          role={result.ok ? 'status' : 'alert'}
        >
          {result.message}
          {!result.ok && result.referenceId
            ? ` Reference: ${result.referenceId}`
            : ''}
          {!result.ok && result.fieldErrors
            ? ` ${Object.values(result.fieldErrors).join(' ')}`
            : ''}
        </p>
      ) : null}
      <Button
        disabled={pending}
        loading={pending}
        type="submit"
        variant={submitVariant}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
