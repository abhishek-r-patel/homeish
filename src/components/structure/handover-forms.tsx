// Render D-85 checklist, record, item, reading, file and close controls.
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';
import { translateMessage } from '@/core/i18n/messages';
import type { UnitHandoverWorkspace } from '@/core/structure/handover-validation';
import { HandoverFileUpload } from './handover-file-upload';
import type { ServerActionResult } from '@/core/actions/server-action';

export type UnitHandoverFormActions = {
  template?: UnitHandoverPayloadAction;
  create?: UnitHandoverPayloadAction;
  items?: UnitHandoverPayloadAction;
  reading?: UnitHandoverPayloadAction;
  close?: UnitHandoverPayloadAction;
  photo?: UnitHandoverPayloadAction;
};
export type UnitHandoverPayloadAction = (
  unitId: string,
  payload: unknown,
) => Promise<ServerActionResult<unknown>>;

export function UnitHandoverItemsForm({
  handover,
  action,
}: {
  handover: UnitHandoverWorkspace['handovers'][number];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={action!}
      submitLabel={t('Save answers')}
      input={(data) => ({
        handoverId: handover.id,
        expectedVersion: handover.version,
        reason: data.get('reason'),
        items: handover.items.map((item) => ({
          itemId: item.id,
          response: data.get(`response-${item.id}`),
          note: data.get(`note-${item.id}`),
        })),
      })}
    >
      {handover.items.map((item) => (
        <div className="grid gap-space-2" key={item.id}>
          <SelectInput
            id={`handover-response-${item.id}`}
            name={`response-${item.id}`}
            label={item.label}
            required
            defaultValue={item.response ?? ''}
            placeholder={t('Choose an answer')}
            options={[
              { value: 'yes', label: t('Yes') },
              { value: 'no', label: t('No') },
              { value: 'not_applicable', label: t('N.A.') },
            ]}
          />
          <TextAreaInput
            id={`handover-item-note-${item.id}`}
            name={`note-${item.id}`}
            label={t('Note (optional)')}
            maxLength={300}
            defaultValue={item.note ?? ''}
          />
        </div>
      ))}
      <TextAreaInput
        id={`handover-reason-${handover.id}`}
        name="reason"
        label={t('Change reason (optional)')}
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

export function UnitHandoverReadingForm({
  handover,
  readings,
  action,
}: {
  handover: UnitHandoverWorkspace['handovers'][number];
  readings: UnitHandoverWorkspace['readings'];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={action!}
      idempotent
      submitLabel={t('Link meter reading')}
      input={(data, clientRequestId) => ({
        handoverId: handover.id,
        readingId: data.get('readingId'),
        clientRequestId,
      })}
    >
      <SelectInput
        id={`handover-reading-${handover.id}`}
        name="readingId"
        label={t('Approved meter reading')}
        required
        placeholder={t('Choose a reading')}
        options={readings.map((reading) => ({
          value: reading.id,
          label: `${reading.meter_type} · ${reading.reading_date} · ${reading.reading_value}`,
        }))}
      />
    </ModuleActionForm>
  );
}

export function UnitHandoverCloseControl({
  unitId,
  handover,
  action,
}: {
  unitId: string;
  handover: UnitHandoverWorkspace['handovers'][number];
  action: UnitHandoverPayloadAction;
}) {
  const { translate: t, locale } = useUiTranslator();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('Close handover')}
      </Button>
      <ConfirmDialog
        id={`close-handover-${handover.id}`}
        open={open}
        onOpenChange={setOpen}
        loading={pending}
        title={t('Close handover')}
        actionLabel={t('Close handover')}
        description={t(
          'Close this unit-condition handover? It stays as a permanent record and does not change occupancy, money, ownership or NOCs.',
        )}
        error={error ? translateMessage(locale ?? 'en', error) : undefined}
        onConfirm={() => {
          setError(null);
          startTransition(async () => {
            const result = await action(unitId, {
              handoverId: handover.id,
              expectedVersion: handover.version,
            });
            if (!result.ok) {
              setError(result.message ?? 'The handover could not be closed.');
              return;
            }
            setOpen(false);
            router.refresh();
          });
        }}
      />
    </>
  );
}

export function UnitHandoverPhotoControl({
  unitId,
  handover,
  action,
}: {
  unitId: string;
  handover: UnitHandoverWorkspace['handovers'][number];
  action: UnitHandoverPayloadAction;
}) {
  const { translate: t } = useUiTranslator();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="grid gap-space-2">
      <HandoverFileUpload
        handoverId={handover.id}
        onUploaded={(file) => {
          void action(unitId, {
            handoverId: handover.id,
            ...file,
            clientRequestId: crypto.randomUUID(),
          }).then((result) => {
            setMessage(result.message ?? null);
            if (result.ok) router.refresh();
          });
        }}
      />
      {message ? (
        <p className="text-caption text-ink-muted" role="status">
          {t(message)}
        </p>
      ) : null}
    </div>
  );
}
