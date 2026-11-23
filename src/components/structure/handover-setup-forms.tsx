// Render D-85 checklist-template and handover-start controls.
'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxInput } from '@/components/ui/choice-controls';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import type { UnitHandoverWorkspace } from '@/core/structure/handover-validation';

export function UnitHandoverTemplateForm({
  template,
  action,
}: {
  template: UnitHandoverWorkspace['template'];
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const [items, setItems] = useState(template.items);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Save handover checklist')}
      input={(_, clientRequestId) => ({
        items,
        expectedVersion: template.version,
        clientRequestId,
      })}
    >
      {items.map((item, index) => (
        <div
          className="grid gap-space-2 rounded-md border border-rule p-space-3"
          key={`${item.key}:${index}`}
        >
          <TextInput
            id={`handover-key-${index}`}
            label={t('Checklist key')}
            name={`key-${index}`}
            value={item.key}
            onChange={(event) =>
              setItems((current) =>
                current.map((value, itemIndex) =>
                  itemIndex === index
                    ? { ...value, key: event.currentTarget.value }
                    : value,
                ),
              )
            }
          />
          <TextInput
            id={`handover-label-${index}`}
            label={t('Checklist label')}
            name={`label-${index}`}
            value={item.label}
            onChange={(event) =>
              setItems((current) =>
                current.map((value, itemIndex) =>
                  itemIndex === index
                    ? { ...value, label: event.currentTarget.value }
                    : value,
                ),
              )
            }
          />
          <button
            type="button"
            className="justify-self-start text-brand underline"
            disabled={items.length === 1}
            onClick={() =>
              setItems((current) =>
                current.filter((_, itemIndex) => itemIndex !== index),
              )
            }
          >
            {t('Remove item')}
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={items.length >= 30}
        onClick={() =>
          setItems((current) => [
            ...current,
            { key: `item_${current.length + 1}`, label: '' },
          ])
        }
      >
        {t('Add checklist item')}
      </Button>
    </ModuleActionForm>
  );
}

export function UnitHandoverCreateForm({
  unitId,
  workspace,
  action,
  initialEvent,
  linkedMoveId,
  linkedCaseId,
}: {
  unitId: string;
  workspace: UnitHandoverWorkspace;
  action: ModuleFormAction;
  initialEvent?: UnitHandoverWorkspace['handovers'][number]['event_type'];
  linkedMoveId?: string | null;
  linkedCaseId?: string | null;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [eventType, setEventType] = useState<
    UnitHandoverWorkspace['handovers'][number]['event_type']
  >(initialEvent ?? 'standalone');
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Start handover')}
      input={(data, clientRequestId) => ({
        unitId,
        eventType,
        moveId: data.get('moveId') || null,
        transferCaseId: data.get('transferCaseId') || null,
        handoverOn: data.get('handoverOn'),
        note: data.get('note'),
        partyMembershipIds: workspace.parties
          .filter((party) => data.get(`party-${party.membership_id}`) === 'on')
          .map((party) => party.membership_id),
        clientRequestId,
      })}
    >
      <SelectInput
        id={`${id}-type`}
        name="eventType"
        label={t('Handover type')}
        value={eventType}
        onChange={(event) =>
          setEventType(
            event.currentTarget
              .value as UnitHandoverWorkspace['handovers'][number]['event_type'],
          )
        }
        options={[
          { value: 'standalone', label: t('Standalone check') },
          { value: 'tenant_move_in', label: t('Tenant move-in') },
          { value: 'tenant_move_out', label: t('Tenant move-out') },
          { value: 'owner_transfer', label: t('Owner transfer') },
        ]}
      />
      {eventType === 'tenant_move_in' || eventType === 'tenant_move_out' ? (
        <SelectInput
          id={`${id}-move`}
          name="moveId"
          label={t('Linked tenancy move')}
          required
          defaultValue={linkedMoveId ?? ''}
          options={workspace.moves
            .filter((move) =>
              eventType === 'tenant_move_in'
                ? move.kind === 'move_in'
                : move.kind === 'move_out',
            )
            .map((move) => ({ value: move.id, label: move.label }))}
        />
      ) : null}
      {eventType === 'owner_transfer' ? (
        <SelectInput
          id={`${id}-case`}
          name="transferCaseId"
          label={t('Linked owner-transfer case')}
          required
          defaultValue={linkedCaseId ?? ''}
          options={workspace.transfer_cases.map((transfer) => ({
            value: transfer.id,
            label: transfer.label,
          }))}
        />
      ) : null}
      <TextInput
        id={`${id}-date`}
        name="handoverOn"
        label={t('Handover date')}
        type="date"
        defaultValue={workspace.today}
        required
      />
      <fieldset className="grid gap-space-2">
        <legend className="font-semibold">{t('Parties (optional)')}</legend>
        {workspace.parties.map((party) => (
          <CheckboxInput
            key={party.membership_id}
            id={`${id}-${party.membership_id}`}
            name={`party-${party.membership_id}`}
            label={`${party.name ?? t('Unavailable')} · ${t(party.role)}`}
          />
        ))}
      </fieldset>
      <TextAreaInput
        id={`${id}-note`}
        name="note"
        label={t('Handover note (optional)')}
        maxLength={1000}
      />
    </ModuleActionForm>
  );
}
