// Share accessible action feedback and retry identifiers across module forms.
'use client';
import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Button } from './button';

export type ModuleFormAction = (
  formData: FormData,
) => Promise<ServerActionResult<unknown>>;

export function ModuleActionForm({
  action,
  children,
  input,
  submitLabel,
  idempotent = false,
  confirmMessage,
  onSaved,
  refresh = true,
}: {
  action: ModuleFormAction;
  children: ReactNode;
  input: (formData: FormData) => unknown;
  submitLabel: string;
  idempotent?: boolean;
  confirmMessage?: string;
  onSaved?: (data: unknown) => void;
  refresh?: boolean;
}) {
  const router = useRouter();
  const retryId = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const formData = new FormData(event.currentTarget);
    if (formData.get('uploadPending') === 'true') {
      setLocalError('Wait for the upload to finish.');
      return;
    }
    try {
      let payload = input(formData);
      if (idempotent) {
        if (typeof payload !== 'object' || payload === null) {
          throw new Error('The request could not be prepared.');
        }
        retryId.current ??= crypto.randomUUID();
        payload = { ...payload, clientRequestId: retryId.current };
      }
      formData.set('input', JSON.stringify(payload));
    } catch {
      setLocalError('Check the form details and retry.');
      return;
    }
    setLocalError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await action(formData);
        setResult(response);
        if (response.ok) {
          retryId.current = null;
          onSaved?.(response.data);
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
    <form className="grid min-w-0 grid-cols-1 gap-space-3" onSubmit={submit}>
      {children}
      {localError ? (
        <p role="alert" className="text-caption text-danger">
          {localError}
        </p>
      ) : null}
      {result ? (
        <div
          role={result.ok ? 'status' : 'alert'}
          className={`grid gap-space-2 text-caption ${result.ok ? 'text-ink-muted' : 'text-danger'}`}
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
      <Button type="submit" disabled={pending} loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
