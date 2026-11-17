// Run billing server actions with a single pending state and readable results.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Banner } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';

export type BillingFormAction<T> = (
  data: FormData,
) => Promise<ServerActionResult<T>>;

export function useBillingAction<T>(action: BillingFormAction<T>) {
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult<T> | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    fields: Record<string, string>,
    onSuccess?: (data: T | undefined) => void,
  ) {
    if (pending) return;
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    setResult(null);
    startTransition(async () => {
      try {
        const next = await action(formData);
        setResult(next);
        if (next.ok) {
          onSuccess?.(next.data);
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          code: 'INTEGRATION_FAILED',
          message:
            'The request could not be completed. Check your connection, refresh and retry.',
        });
      }
    });
  }

  return { pending, result, run, reset: () => setResult(null) };
}

export function fieldError(
  result: ServerActionResult<unknown> | null,
  ...fields: string[]
): string | undefined {
  if (!result || result.ok || !result.fieldErrors) return undefined;
  for (const field of fields) {
    const message = result.fieldErrors[field];
    if (message) return message;
  }
  return undefined;
}

export function useBillingFieldError() {
  const { translateFeedback } = useUiTranslator();
  return (result: ServerActionResult<unknown> | null, ...fields: string[]) => {
    const message = fieldError(result, ...fields);
    return message ? translateFeedback(message) : undefined;
  };
}

export function ActionResult({
  result,
}: {
  result: ServerActionResult<unknown> | null;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (!result) return null;
  if (result.ok) {
    return result.message ? (
      <Banner tone="success">
        <p>{translateFeedback(result.message)}</p>
      </Banner>
    ) : null;
  }
  const fieldMessages = Object.values(result.fieldErrors ?? {});
  return (
    <Banner tone="danger">
      <p>{translateFeedback(result.message)}</p>
      {fieldMessages.length > 0 ? (
        <ul className="mt-space-2 list-inside list-disc">
          {fieldMessages.map((message) => (
            <li key={message}>{translateFeedback(message)}</li>
          ))}
        </ul>
      ) : null}
      {result.referenceId ? (
        <p className="mt-space-2 text-caption">
          {t('Reference: {reference}', { reference: result.referenceId })}
        </p>
      ) : null}
    </Banner>
  );
}
