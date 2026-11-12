// Confirm and report a developer-only user-erasure request.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { eraseUserAction } from '@/app/developer/actions';
import type { DeveloperActionResult } from '@/core/developer/console';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';

export function UserErasureForm() {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setState(null);
    setLocalError(null);
    startTransition(async () => {
      try {
        const result = await eraseUserAction(formData);
        setState(result);
        if (result.ok) {
          form.reset();
          router.refresh();
        }
      } catch {
        setLocalError(
          'The request did not return a result. Review the audit log before retrying; prepared erasures can be safely retried.',
        );
      }
    });
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <TextInput
        autoComplete="off"
        helpText="Enter the exact UUID of the account covered by the approved erasure request."
        id="user-erasure-id"
        label="User UUID"
        maxLength={36}
        minLength={36}
        name="userId"
        pattern="[0-9a-fA-F-]{36}"
        required
      />
      <TextInput
        autoComplete="off"
        helpText="Type ERASE to confirm this irreversible action."
        id="user-erasure-confirmation"
        label="Confirmation"
        maxLength={5}
        minLength={5}
        name="confirmation"
        pattern="ERASE"
        required
        spellCheck={false}
      />
      {localError ? (
        <p aria-live="polite" className="text-caption text-danger" role="alert">
          {localError}
        </p>
      ) : null}
      {state ? (
        <div
          aria-live="polite"
          className={state.ok ? 'text-body text-ink' : 'text-body text-danger'}
          role={state.ok ? 'status' : 'alert'}
        >
          <p>{state.message ?? 'Could not complete the request.'}</p>
          {!state.ok && state.referenceId ? (
            <p className="mt-space-2 text-caption">
              Reference ID: <code>{state.referenceId}</code>
            </p>
          ) : null}
          {!state.ok && state.fieldErrors ? (
            <ul className="mt-space-2 list-inside list-disc text-caption">
              {Object.entries(state.fieldErrors).map(([field, message]) => (
                <li key={field}>
                  {field === 'form' ? message : `${field}: ${message}`}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Button
        disabled={pending}
        loading={pending}
        type="submit"
        variant="destructive"
      >
        Erase user account
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? 'Erasing user account…' : ''}
      </span>
    </form>
  );
}
