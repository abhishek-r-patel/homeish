// Present D-85 unit-condition handovers without changing occupancy or P51 clearance.
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, StatusChip } from '@/components/ui/data-display';
import { useUiTranslator } from '@/components/ui/language';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import type { UnitHandoverWorkspace } from '@/core/structure/handover-validation';
import {
  UnitHandoverCloseControl,
  UnitHandoverItemsForm,
  UnitHandoverPhotoControl,
  UnitHandoverReadingForm,
  type UnitHandoverFormActions,
} from './handover-forms';
import { UnitHandoverFileLink } from './handover-file-link';
import {
  UnitHandoverCreateForm,
  UnitHandoverTemplateForm,
} from './handover-setup-forms';

function asFormAction(
  action: UnitHandoverFormActions[keyof UnitHandoverFormActions],
  unitId: string,
): ModuleFormAction | undefined {
  if (!action) return undefined;
  return (form) => action(unitId, JSON.parse(String(form.get('input'))));
}

const eventLabels = {
  tenant_move_in: 'Tenant move-in',
  tenant_move_out: 'Tenant move-out',
  owner_transfer: 'Owner transfer',
  standalone: 'Standalone check',
} as const;

export function UnitHandoversPanel({
  unitId,
  workspace,
  actions,
  startContext,
}: {
  unitId: string;
  workspace: UnitHandoverWorkspace;
  actions?: UnitHandoverFormActions;
  startContext?: {
    eventType: UnitHandoverWorkspace['handovers'][number]['event_type'];
    moveId?: string | null;
    transferCaseId?: string | null;
  };
}) {
  const { translate: t } = useUiTranslator();
  const [started, setStarted] = useState(false);
  const templateAction = asFormAction(actions?.template, unitId);
  const createAction = asFormAction(actions?.create, unitId);
  const itemsAction = asFormAction(actions?.items, unitId);
  const readingAction = asFormAction(actions?.reading, unitId);
  return (
    <Card
      className="min-w-0"
      title={t('Unit handovers')}
      description={t(
        'Condition records only. A handover never changes occupancy, ownership, dues, bills or NOCs.',
      )}
    >
      <div className="grid gap-space-5">
        {workspace.can_manage && createAction ? (
          <div className="grid gap-space-3">
            <Button onClick={() => setStarted((value) => !value)}>
              {started ? t('Hide start form') : t('Start handover')}
            </Button>
            {started ? (
              <UnitHandoverCreateForm
                unitId={unitId}
                workspace={workspace}
                action={createAction}
                initialEvent={startContext?.eventType}
                linkedMoveId={startContext?.moveId}
                linkedCaseId={startContext?.transferCaseId}
              />
            ) : null}
          </div>
        ) : null}
        {workspace.can_manage && templateAction ? (
          <details className="rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer font-semibold">
              {t('Handover checklist')}
            </summary>
            <div className="mt-space-3">
              <UnitHandoverTemplateForm
                template={workspace.template}
                action={templateAction}
              />
            </div>
          </details>
        ) : null}
        {workspace.handovers.length ? (
          <ul className="grid gap-space-4">
            {workspace.handovers.map((handover) => (
              <li
                className="rounded-md border border-rule p-space-4"
                key={handover.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-space-3">
                  <div>
                    <p className="font-semibold">
                      {t(eventLabels[handover.event_type])} ·{' '}
                      {handover.handover_on}
                    </p>
                    {handover.note ? (
                      <p className="mt-space-1 text-ink-muted">
                        {handover.note}
                      </p>
                    ) : null}
                  </div>
                  <StatusChip
                    status={
                      handover.status === 'closed'
                        ? 'tenancy.completed'
                        : 'tenancy.pending_review'
                    }
                    detail={
                      handover.status === 'closed' ? t('Closed') : t('Open')
                    }
                  />
                </div>
                <p className="mt-space-3 text-caption text-ink-muted">
                  {t('Parties')}:{' '}
                  {handover.parties.length
                    ? handover.parties
                        .map(
                          (party) =>
                            `${party.name}${party.acknowledged_at ? ` · ${t('Acknowledged')}` : ''}`,
                        )
                        .join('; ')
                    : t('None recorded')}
                </p>
                {workspace.can_manage && handover.status === 'open' ? (
                  <>
                    {itemsAction ? (
                      <details className="mt-space-3 min-w-0">
                        <summary className="cursor-pointer font-semibold">
                          {t('Checklist answers')}
                        </summary>
                        <div className="mt-space-3">
                          <UnitHandoverItemsForm
                            handover={handover}
                            action={itemsAction}
                          />
                        </div>
                      </details>
                    ) : null}
                    {readingAction && workspace.readings.length ? (
                      <details className="mt-space-3 min-w-0">
                        <summary className="cursor-pointer font-semibold">
                          {t('Link meter reading')}
                        </summary>
                        <div className="mt-space-3">
                          <UnitHandoverReadingForm
                            handover={handover}
                            readings={workspace.readings}
                            action={readingAction}
                          />
                        </div>
                      </details>
                    ) : (
                      <p className="mt-space-2 text-caption text-ink-muted">
                        {t(
                          'No approved Metering readings are available to link.',
                        )}
                      </p>
                    )}
                    {actions?.photo ? (
                      <div className="mt-space-3">
                        <UnitHandoverPhotoControl
                          unitId={unitId}
                          handover={handover}
                          action={actions.photo}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
                {handover.readings.length ? (
                  <div className="mt-space-3">
                    <p className="font-semibold">
                      {t('Linked meter readings')}
                    </p>
                    <ul className="list-disc pl-space-5">
                      {handover.readings.map((reading) => (
                        <li key={reading.id}>
                          {reading.meter_type} · {reading.reading_date} ·{' '}
                          {reading.reading_value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {handover.photos.length ? (
                  <div className="mt-space-3 grid gap-space-2">
                    <p className="font-semibold">
                      {t('{count} private handover files', {
                        count: handover.photos.length,
                      })}
                    </p>
                    {handover.photos.map((photo, index) => (
                      <UnitHandoverFileLink
                        key={photo.id}
                        label={t('file {number}', { number: index + 1 })}
                        path={photo.path}
                      />
                    ))}
                  </div>
                ) : null}
                {workspace.can_manage &&
                handover.status === 'open' &&
                actions?.close ? (
                  <div className="mt-space-4">
                    <UnitHandoverCloseControl
                      unitId={unitId}
                      handover={handover}
                      action={actions.close}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No unit handovers have been recorded.')}</p>
        )}
      </div>
    </Card>
  );
}
