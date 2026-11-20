// Keep request actions responsive and show expected server-action feedback.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Button, type ButtonProps } from '@/components/ui/button';

export type RequestFormAction = (
  formData: FormData,
) => Promise<ServerActionResult<unknown>>;

export function ServiceRequestActionForm({
  action,
  buttonSize,
  buttonVariant,
  children,
  className = 'grid min-w-0 grid-cols-1 gap-space-4',
  input,
  onSuccess,
  refresh = true,
  submitLabel,
}: {
  action: RequestFormAction;
  buttonSize?: ButtonProps['size'];
  buttonVariant?: ButtonProps['variant'];
  children: ReactNode;
  className?: string;
  input: (formData: FormData) => unknown;
  onSuccess?: () => void;
  refresh?: boolean;
  submitLabel: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
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
      setLocalError('Wait for request photos to finish uploading.');
      return;
    }
    let payload: unknown;
    try {
      payload = input(formData);
      formData.set('input', JSON.stringify(payload));
    } catch {
      setLocalError('The request could not be prepared. Check the form.');
      return;
    }
    setLocalError(null);
    startTransition(async () => {
      try {
        const nextResult = await action(formData);
        setResult(nextResult);
        if (nextResult.ok) {
          onSuccess?.();
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
        <p aria-live="polite" className="text-caption text-danger" role="alert">
          {translateFeedback(localError)}
        </p>
      ) : null}
      {result ? (
        <div
          aria-live="polite"
          className={`grid gap-space-2 text-caption ${result.ok ? 'text-ink-muted' : 'text-danger'}`}
          role={result.ok ? 'status' : 'alert'}
        >
          <p>
            {result.message ? translateFeedback(result.message) : null}
            {!result.ok && result.referenceId
              ? ` ${t('Reference: {id}', { id: result.referenceId })}`
              : ''}
          </p>
          {!result.ok && result.fieldErrors ? (
            <ul className="list-disc pl-space-5">
              {Object.entries(result.fieldErrors).map(([field, message]) => (
                <li key={field}>{translateFeedback(message)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Button
        disabled={pending}
        loading={pending}
        size={buttonSize}
        type="submit"
        variant={buttonVariant}
      >
        {submitLabel}
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? t('Working…') : ''}
      </span>
    </form>
  );
}
