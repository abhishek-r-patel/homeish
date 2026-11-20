// Confirm an actual tenant move-in for billing without changing Core access.
'use client';

import type { FormEvent } from 'react';
import { confirmTenantMoveInAction } from '@/app/(admin)/admin/billing/actions';
import { Button } from '@/components/ui/button';
import { useUiTranslator } from '@/components/ui/language';
import { TextInput } from '@/components/ui/text-input';
import { ActionResult, useBillingAction } from './action-state';

export function TenantMoveInForm({
  id,
  name,
  maxDate,
}: {
  id: string;
  name: string | null;
  maxDate: string;
}) {
  const { translate: t } = useUiTranslator();
  const confirmation = useBillingAction(confirmTenantMoveInAction);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new FormData(event.currentTarget).get('moveInOn');
    confirmation.run({
      occupantId: id,
      moveInOn: typeof date === 'string' ? date : '',
    });
  }
  return (
    <form
      className="grid gap-space-2 border-b border-rule py-space-3"
      onSubmit={submit}
    >
      <p className="text-body-strong">{name ?? t('Tenant name unavailable')}</p>
      <div className="flex flex-wrap items-end gap-space-3">
        <TextInput
          id={`tenant-move-in-${id}`}
          name="moveInOn"
          type="date"
          max={maxDate}
          label={t('Actual move-in date')}
          required
          disabled={confirmation.pending}
        />
        <Button type="submit" loading={confirmation.pending}>
          {t('Confirm Move-In Date')}
        </Button>
      </div>
      <ActionResult result={confirmation.result} />
    </form>
  );
}
