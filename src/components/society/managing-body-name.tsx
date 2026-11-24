// Let admins save the society's displayed managing-body name.
'use client';

import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { saveManagingBodyNameAction } from '@/app/(admin)/admin/settings/actions';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import type { ServerActionResult } from '@/core/actions/server-action';

export function ManagingBodyName({
  canManage,
  name,
}: {
  canManage: boolean;
  name: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const nextResult = await saveManagingBodyNameAction(formData);
      setResult(nextResult);
      if (nextResult.ok) router.refresh();
    });
  }

  if (!canManage) {
    return <p className="text-title font-semibold">{name}</p>;
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <TextInput
        defaultValue={name}
        helpText={t(
          'Use a preset or your own name. This appears in the place picker and society work headings.',
        )}
        id="managing-body-name"
        label={t('Managing-body name')}
        list="managing-body-presets"
        maxLength={24}
        name="name"
        pattern="[A-Za-z ]{1,24}"
        required
      />
      <datalist id="managing-body-presets">
        <option value="Association" />
        <option value="Committee" />
        <option value="Managing Committee" />
        <option value="Board" />
        <option value="Office" />
      </datalist>
      <Button disabled={pending} loading={pending} type="submit">
        {t('Save name')}
      </Button>
      {result?.message ? (
        <p
          aria-live="polite"
          className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {translateFeedback(result.message)}
        </p>
      ) : null}
    </form>
  );
}
