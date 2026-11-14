// Submit notice forms through server actions and show the expected feedback.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Button } from '@/components/ui/button';

export type NoticeFormAction = (
  formData: FormData,
) => Promise<ServerActionResult<unknown>>;

export function NoticeActionForm({
  action,
  children,
  className = 'grid min-w-0 grid-cols-1 gap-space-4',
  confirmMessage,
  input,
  onSuccess,
  refresh = true,
  submitLabel,
  submitVariant = 'primary',
}: {
  action: NoticeFormAction;
  children?: ReactNode;
  className?: string;
  confirmMessage?: string;
  input: (formData: FormData) => unknown;
  onSuccess?: (data: unknown) => void;
  refresh?: boolean;
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
      setLocalError('Wait for the attachment to finish uploading.');
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    try {
      formData.set('input', JSON.stringify(input(formData)));
    } catch {
      setLocalError('The notice could not be prepared. Check the form.');
      return;
    }
    setLocalError(null);
    startTransition(async () => {
      try {
        const nextResult = await action(formData);
        setResult(nextResult);
        if (nextResult.ok) {
          onSuccess?.(nextResult.data);
          if (refresh) router.refresh();
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
        <div
          className={`grid gap-space-2 text-caption ${result.ok ? 'text-ink-muted' : 'text-danger'}`}
          role={result.ok ? 'status' : 'alert'}
        >
          <p>
            {result.message}
            {!result.ok && result.referenceId
              ? ` Reference: ${result.referenceId}`
              : ''}
          </p>
          {!result.ok && result.fieldErrors ? (
            <ul className="list-disc pl-space-5">
              {Object.entries(result.fieldErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
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
