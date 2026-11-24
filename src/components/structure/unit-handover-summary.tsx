// Show only the current party's D-85 unit handovers and acknowledgement control.
'use client';
import { acknowledgeUnitHandoverAction } from '@/app/(resident)/tenancy/actions';
import { Card, StatusChip } from '@/components/ui/data-display';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';
import type { UnitHandoverWorkspace } from '@/core/structure/handover-validation';
import { UnitHandoverFileLink } from './handover-file-link';

export function UnitHandoverSummary({
  workspace,
  acknowledgeAction = acknowledgeUnitHandoverAction,
}: {
  workspace: UnitHandoverWorkspace;
  acknowledgeAction?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  if (workspace.handovers.length === 0) return null;
  return (
    <Card
      title={t('Unit handovers')}
      description={t(
        'Condition records only. They do not change occupancy, ownership, bills, dues or NOCs.',
      )}
    >
      <ul className="grid gap-space-4">
        {workspace.handovers.map((handover) => (
          <li
            key={handover.id}
            className="grid gap-space-3 rounded-md border border-rule p-space-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-space-3">
              <div>
                <p className="font-semibold">
                  {t(handover.event_type.replaceAll('_', ' '))} ·{' '}
                  {handover.handover_on}
                </p>
                {handover.note ? <p>{handover.note}</p> : null}
              </div>
              <StatusChip
                status={
                  handover.status === 'closed'
                    ? 'tenancy.completed'
                    : 'tenancy.pending_review'
                }
                detail={handover.status === 'closed' ? t('Closed') : t('Open')}
              />
            </div>
            <ul className="grid gap-space-2">
              {handover.items.map((item) => (
                <li key={item.id}>
                  {item.label}:{' '}
                  {item.response
                    ? t(item.response.replaceAll('_', ' '))
                    : t('Not answered')}
                  {item.note ? ` · ${item.note}` : ''}
                </li>
              ))}
            </ul>
            {handover.readings.length ? (
              <p className="text-caption text-ink-muted">
                {t('Linked meter readings')}: {handover.readings.length}
              </p>
            ) : null}
            {handover.photos.length ? (
              <div className="grid gap-space-2">
                <p className="font-semibold">{t('Private handover files')}</p>
                {handover.photos.map((photo, index) => (
                  <UnitHandoverFileLink
                    key={photo.id}
                    path={photo.path}
                    label={t('file {number}', { number: index + 1 })}
                  />
                ))}
              </div>
            ) : null}
            {handover.can_acknowledge ? (
              <ModuleActionForm
                action={acknowledgeAction}
                submitLabel={t('Acknowledge handover')}
                input={(data) => ({
                  handoverId: handover.id,
                  note: data.get('note'),
                })}
              >
                <TextAreaInput
                  id={`handover-acknowledge-${handover.id}`}
                  name="note"
                  label={t('Acknowledgement note (optional)')}
                  maxLength={500}
                />
              </ModuleActionForm>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
