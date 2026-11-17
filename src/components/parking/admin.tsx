// Let administrators manage slots, allocations, waitlists, reports and photo retention; committee members read only.
'use client';
import { useId, useState } from 'react';
import {
  PARKING_PASS_STATE_LABELS,
  PARKING_SLOT_TYPE_LABELS,
  parkingLinkedVehicles,
  parkingPassState,
  parkingQueueText,
} from '@/core/parking/presentation';
import {
  PARKING_PHOTO_RETENTION_MAX_DAYS,
  PARKING_PHOTO_RETENTION_MIN_DAYS,
  PARKING_REQUEST_SLOT_TYPES,
  PARKING_SLOT_TYPES,
  parkingAllocateInputSchema,
  parkingReportResolveInputSchema,
  parkingSettingsInputSchema,
  parkingSlotInputSchema,
  type ParkingAdminWorkspace,
} from '@/core/parking/validation';
import { Banner } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { ParkingReportItem } from './resident';
import {
  PARKING_ACTIONS,
  ParkingQuickAction,
  parkingDisplayTime,
  useParkingCopy,
  type ParkingActions,
} from './shared';
import { formatLocalizedNumber } from '@/core/i18n/format';

type AdminSlot = ParkingAdminWorkspace['slots'][number];

function SlotForm({
  slot,
  actions,
}: {
  slot: AdminSlot | null;
  actions: ParkingActions;
}) {
  const { t } = useParkingCopy();
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.saveSlot}
      idempotent
      submitLabel={
        slot ? t('Save slot {label}', { label: slot.label }) : t('Add slot')
      }
      input={(form, clientRequestId) =>
        parkingSlotInputSchema.parse({
          slotId: slot?.id ?? null,
          label: String(form.get('label') ?? ''),
          slotType: slot?.slot_type ?? form.get('slotType'),
          locationNote: String(form.get('locationNote') ?? ''),
          expectedVersion: slot?.version ?? null,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-label`}
        name="label"
        label={t('Slot label or number')}
        required
        maxLength={40}
        defaultValue={slot?.label}
        autoComplete="off"
      />
      {slot ? (
        <p className="text-caption text-ink-muted">
          {t(
            'Type: {type}. Archive the slot and add a new one to change its type.',
            {
              type: t(PARKING_SLOT_TYPE_LABELS[slot.slot_type]),
            },
          )}
        </p>
      ) : (
        <SelectInput
          id={`${id}-type`}
          name="slotType"
          label={t('Slot type')}
          required
          options={PARKING_SLOT_TYPES.map((value) => ({
            value,
            label: t(PARKING_SLOT_TYPE_LABELS[value]),
          }))}
        />
      )}
      <TextInput
        id={`${id}-location`}
        name="locationNote"
        label={t('Location note (optional)')}
        helpText={t('For example Basement 1, near lift B.')}
        maxLength={200}
        defaultValue={slot?.location_note ?? ''}
        autoComplete="off"
      />
    </ModuleActionForm>
  );
}

function AllocateForm({
  slot,
  workspace,
  actions,
}: {
  slot: AdminSlot;
  workspace: ParkingAdminWorkspace;
  actions: ParkingActions;
}) {
  const { t } = useParkingCopy();
  const id = useId();
  const next = workspace.queues.find(
    (request) =>
      request.slot_type === slot.slot_type && request.queue_position === 1,
  );
  return (
    <ModuleActionForm
      action={actions.allocate}
      submitLabel={t('Allocate slot {label}', { label: slot.label })}
      input={(form) =>
        parkingAllocateInputSchema.parse({
          slotId: slot.id,
          unitId: form.get('unitId'),
          skipReason: String(form.get('skipReason') ?? ''),
        })
      }
    >
      <p className="text-caption text-ink-muted">
        {next
          ? t(
              'Next in the {type} waitlist: unit {unit}. Allocating to any other unit needs a reason, which is recorded.',
              {
                type: t(PARKING_SLOT_TYPE_LABELS[slot.slot_type]),
                unit: next.unit_number,
              },
            )
          : t('Nobody is waiting for this slot type.')}
      </p>
      <SelectInput
        id={`${id}-unit`}
        name="unitId"
        label={t('Unit')}
        required
        defaultValue={next?.unit_id ?? workspace.units[0]?.id}
        options={workspace.units.map((unit) => ({
          value: unit.id,
          label: t('Unit {unit}', { unit: unit.number }),
        }))}
      />
      {next ? (
        <TextAreaInput
          id={`${id}-reason`}
          name="skipReason"
          label={t(
            'Reason for skipping the waitlist (only if not the next unit)',
          )}
          maxLength={500}
        />
      ) : null}
    </ModuleActionForm>
  );
}

function SlotItem({
  slot,
  workspace,
  actions,
}: {
  slot: AdminSlot;
  workspace: ParkingAdminWorkspace;
  actions: ParkingActions;
}) {
  const allocation = slot.allocation;
  const { locale, t } = useParkingCopy();
  const linked = allocation ? parkingLinkedVehicles(allocation) : [];
  const manage = workspace.can_manage && !slot.archived_at;
  return (
    <li className="grid gap-space-3 rounded-md border border-rule p-space-4">
      <div className="grid gap-space-1">
        <p className="text-body-strong">
          {t('Slot {label} · {type}', {
            label: slot.label,
            type: t(PARKING_SLOT_TYPE_LABELS[slot.slot_type]),
          })}
        </p>
        <p className="text-caption text-ink-muted">
          {slot.archived_at
            ? t('Archived {date}', {
                date: parkingDisplayTime(slot.archived_at ?? '', locale),
              })
            : allocation
              ? t('Allocated to unit {unit} since {date}', {
                  unit: allocation.unit_number,
                  date: parkingDisplayTime(allocation.started_at, locale),
                })
              : slot.slot_type === 'visitor'
                ? t('Visitor slot, used through visitor passes')
                : t('Free')}
          {slot.location_note ? ` · ${slot.location_note}` : ''}
        </p>
        {allocation?.skip_reason ? (
          <p className="text-caption">
            {t('Waitlist skipped:')} {allocation.skip_reason}
          </p>
        ) : null}
        {workspace.directory_enabled && allocation ? (
          <p className="text-caption">
            {t('Vehicles:')}{' '}
            {linked.length > 0
              ? linked.map((vehicle) => vehicle.registration_number).join(', ')
              : t('none marked')}
          </p>
        ) : null}
      </div>
      {manage ? (
        <div className="grid gap-space-3">
          {allocation ? (
            <ParkingQuickAction
              action={actions.endAllocation}
              label={t('End allocation of slot {label}', { label: slot.label })}
              confirmMessage={t(
                "End unit {unit}'s allocation of slot {label}?",
                {
                  unit: allocation.unit_number,
                  label: slot.label,
                },
              )}
              input={{ allocationId: allocation.id }}
            />
          ) : slot.slot_type !== 'visitor' ? (
            <details className="grid gap-space-2">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                {t('Allocate slot {label}', { label: slot.label })}
              </summary>
              <AllocateForm
                slot={slot}
                workspace={workspace}
                actions={actions}
              />
            </details>
          ) : null}
          <details className="grid gap-space-2">
            <summary className="min-h-12 cursor-pointer content-center text-brand underline">
              {t('Edit slot {label}', { label: slot.label })}
            </summary>
            <SlotForm slot={slot} actions={actions} />
          </details>
          {allocation ? null : (
            <ParkingQuickAction
              action={actions.archiveSlot}
              label={t('Archive slot {label}', { label: slot.label })}
              confirmMessage={t('Archive slot {label}? Its history is kept.', {
                label: slot.label,
              })}
              input={{ slotId: slot.id, expectedVersion: slot.version }}
            />
          )}
        </div>
      ) : null}
    </li>
  );
}

export function ParkingAdminView({
  workspace,
  actions = PARKING_ACTIONS,
  fileRequest,
  now: fixedNow,
}: {
  workspace: ParkingAdminWorkspace;
  actions?: ParkingActions;
  fileRequest?: typeof fetch;
  now?: number;
}) {
  const { locale, t } = useParkingCopy();
  const id = useId();
  const [now] = useState(() => fixedNow ?? Date.now());
  const active = workspace.slots.filter((slot) => !slot.archived_at);
  const archived = workspace.slots.filter((slot) => slot.archived_at);
  const openReports = workspace.reports.filter(
    (report) => report.status === 'open',
  );
  const closedReports = workspace.reports.filter(
    (report) => report.status === 'resolved',
  );

  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">{t('Society parking')}</h1>
      {workspace.can_manage ? null : (
        <Banner tone="neutral" title={t('View only')}>
          {t('Only administrators can change slots, allocations and settings.')}
        </Banner>
      )}

      <Card
        title={t('Slots')}
        description={t('{active} active slots, {allocated} allocated.', {
          active: formatLocalizedNumber(active.length, locale),
          allocated: formatLocalizedNumber(
            active.filter((slot) => slot.allocation).length,
            locale,
          ),
        })}
      >
        <div className="grid gap-space-4">
          {active.length === 0 ? (
            <p className="text-body text-ink-muted">{t('No slots yet.')}</p>
          ) : (
            <ul className="grid gap-space-3">
              {active.map((slot) => (
                <SlotItem
                  key={slot.id}
                  slot={slot}
                  workspace={workspace}
                  actions={actions}
                />
              ))}
            </ul>
          )}
          {workspace.can_manage ? (
            <details className="grid gap-space-2">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                {t('Add a slot')}
              </summary>
              <SlotForm slot={null} actions={actions} />
            </details>
          ) : null}
          {archived.length > 0 ? (
            <details className="grid gap-space-2">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                {t('Archived slots ({count})', {
                  count: formatLocalizedNumber(archived.length, locale),
                })}
              </summary>
              <ul className="grid gap-space-3">
                {archived.map((slot) => (
                  <SlotItem
                    key={slot.id}
                    slot={slot}
                    workspace={workspace}
                    actions={actions}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </Card>

      <Card
        title={t('Waitlists')}
        description={t(
          'One queue per slot type, served in order. Allocate from a slot above.',
        )}
      >
        <div className="grid gap-space-4 medium:grid-cols-3">
          {PARKING_REQUEST_SLOT_TYPES.map((type) => {
            const queue = workspace.queues.filter(
              (request) => request.slot_type === type,
            );
            return (
              <section key={type} className="grid content-start gap-space-2">
                <h3 className="text-body-strong">
                  {t(PARKING_SLOT_TYPE_LABELS[type])} (
                  {formatLocalizedNumber(queue.length, locale)})
                </h3>
                {queue.length === 0 ? (
                  <p className="text-caption text-ink-muted">
                    {t('Nobody waiting.')}
                  </p>
                ) : (
                  <ol className="grid gap-space-2">
                    {queue.map((request) => (
                      <li key={request.id} className="text-caption">
                        <span className="text-body-strong">
                          {t('Unit {unit}', { unit: request.unit_number })}
                        </span>{' '}
                        · {t(parkingQueueText(request.queue_position) ?? '')} ·{' '}
                        {t('since')}{' '}
                        {request.created_at
                          ? parkingDisplayTime(request.created_at, locale)
                          : t('Not available')}
                        {request.note ? ` · ${request.note}` : ''}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      </Card>

      <Card title={t('Visitor passes')}>
        {!workspace.visitor_enabled ? (
          <p className="text-body text-ink-muted">
            {t('Visitor passes need the Visitors module, which is turned off.')}
          </p>
        ) : workspace.passes.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('No current visitor passes.')}
          </p>
        ) : (
          <ul className="grid gap-space-2">
            {workspace.passes.map((pass) => (
              <li key={pass.id} className="text-caption">
                <span className="text-body-strong">
                  {t('Slot {label} · {name}', {
                    label: pass.slot_label,
                    name: pass.visitor_name,
                  })}
                </span>{' '}
                · {t('Unit {unit}', { unit: pass.unit_number })} ·{' '}
                {t(PARKING_PASS_STATE_LABELS[parkingPassState(pass, now)])} ·{' '}
                {parkingDisplayTime(pass.starts_at, locale)} –{' '}
                {parkingDisplayTime(pass.ends_at, locale)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={t('Wrong-parking reports')}
        description={t('{count} open.', {
          count: formatLocalizedNumber(openReports.length, locale),
        })}
      >
        {workspace.reports.length === 0 ? (
          <p className="text-body text-ink-muted">{t('No reports.')}</p>
        ) : (
          <ul className="grid gap-space-3">
            {[...openReports, ...closedReports].map((report) => (
              <ParkingReportItem
                key={report.id}
                report={report}
                request={fileRequest}
              >
                {workspace.can_manage && report.status === 'open' ? (
                  <ModuleActionForm
                    action={actions.resolveReport}
                    submitLabel={t('Mark resolved')}
                    input={(form) =>
                      parkingReportResolveInputSchema.parse({
                        reportId: report.id,
                        resolutionNote: String(
                          form.get('resolutionNote') ?? '',
                        ),
                      })
                    }
                  >
                    <TextAreaInput
                      id={`${id}-resolve-${report.id}`}
                      name="resolutionNote"
                      label={t('Resolution note (optional)')}
                      maxLength={500}
                    />
                  </ModuleActionForm>
                ) : null}
              </ParkingReportItem>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={t('Photo retention')}
        description={t(
          'Wrong-parking photos are deleted automatically after this many days.',
        )}
      >
        {workspace.can_manage ? (
          <ModuleActionForm
            action={actions.saveSettings}
            submitLabel={t('Save retention')}
            input={(form) =>
              parkingSettingsInputSchema.parse({
                photoRetentionDays: Number(form.get('photoRetentionDays')),
              })
            }
          >
            <TextInput
              id={`${id}-retention`}
              name="photoRetentionDays"
              type="number"
              inputMode="numeric"
              label={t('Keep photos for (days)')}
              helpText={t('{min} to {max} days.', {
                min: formatLocalizedNumber(
                  PARKING_PHOTO_RETENTION_MIN_DAYS,
                  locale,
                ),
                max: formatLocalizedNumber(
                  PARKING_PHOTO_RETENTION_MAX_DAYS,
                  locale,
                ),
              })}
              min={PARKING_PHOTO_RETENTION_MIN_DAYS}
              max={PARKING_PHOTO_RETENTION_MAX_DAYS}
              required
              defaultValue={workspace.settings.photo_retention_days}
            />
          </ModuleActionForm>
        ) : (
          <p className="text-body">
            {t('Photos are kept for {count} days.', {
              count: formatLocalizedNumber(
                workspace.settings.photo_retention_days,
                locale,
              ),
            })}
          </p>
        )}
      </Card>
    </section>
  );
}
