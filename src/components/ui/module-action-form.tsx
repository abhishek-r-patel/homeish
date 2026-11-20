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
import { ZodError } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import { Button } from './button';
import { useUiTranslator } from './language';

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
  submitDisabled = false,
}: {
  action: ModuleFormAction;
  children: ReactNode;
  input: (formData: FormData, clientRequestId: string | null) => unknown;
  submitLabel: string;
  idempotent?: boolean;
  confirmMessage?: string;
  onSaved?: (data: unknown, message?: string) => void;
  refresh?: boolean;
  submitDisabled?: boolean;
}) {
  const { translate, translateFeedback } = useUiTranslator();
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
      if (idempotent) retryId.current ??= crypto.randomUUID();
      let payload = input(formData, idempotent ? retryId.current : null);
      if (idempotent) {
        if (typeof payload !== 'object' || payload === null) {
          throw new Error('The request could not be prepared.');
        }
        payload = { ...payload, clientRequestId: retryId.current };
      }
      formData.set('input', JSON.stringify(payload));
    } catch (error) {
      setLocalError(
        error instanceof ZodError
          ? error.issues[0]?.message
            ? error.issues[0].message
            : 'Check the form details and retry.'
          : error instanceof ValidationError
            ? (Object.values(error.fieldErrors ?? {})[0] ?? error.message)
            : 'Check the form details and retry.',
      );
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
          onSaved?.(response.data, response.message);
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
          {translateFeedback(localError)}
        </p>
      ) : null}
      {result ? (
        <div
          role={result.ok ? 'status' : 'alert'}
          className={`grid gap-space-2 text-caption ${result.ok ? 'text-ink-muted' : 'text-danger'}`}
        >
          <p>
            {result.message ? translateFeedback(result.message) : null}
            {!result.ok && result.referenceId
              ? ` ${translate('Reference: {id}', { id: result.referenceId })}`
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
        type="submit"
        disabled={pending || submitDisabled}
        loading={pending}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
