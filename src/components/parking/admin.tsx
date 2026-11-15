// Let administrators manage slots, allocations, waitlists, reports and photo retention; committee members read only.
'use client';
import { useId, useState } from 'react';
import {
  PARKING_PASS_STATE_LABELS,
  PARKING_SLOT_TYPE_LABELS,
  formatParkingTime,
  formatParkingWindow,
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
  type ParkingActions,
} from './shared';

type AdminSlot = ParkingAdminWorkspace['slots'][number];

function SlotForm({
  slot,
  actions,
}: {
  slot: AdminSlot | null;
  actions: ParkingActions;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.saveSlot}
      idempotent
      submitLabel={slot ? `Save slot ${slot.label}` : 'Add slot'}
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
        label="Slot label or number"
        required
        maxLength={40}
        defaultValue={slot?.label}
        autoComplete="off"
      />
      {slot ? (
        <p className="text-caption text-ink-muted">
          Type: {PARKING_SLOT_TYPE_LABELS[slot.slot_type]}. Archive the slot and
          add a new one to change its type.
        </p>
      ) : (
        <SelectInput
          id={`${id}-type`}
          name="slotType"
          label="Slot type"
          required
          options={PARKING_SLOT_TYPES.map((value) => ({
            value,
            label: PARKING_SLOT_TYPE_LABELS[value],
          }))}
        />
      )}
      <TextInput
        id={`${id}-location`}
        name="locationNote"
        label="Location note (optional)"
        helpText="For example Basement 1, near lift B."
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
  const id = useId();
  const next = workspace.queues.find(
    (request) =>
      request.slot_type === slot.slot_type && request.queue_position === 1,
  );
  return (
    <ModuleActionForm
      action={actions.allocate}
      submitLabel={`Allocate slot ${slot.label}`}
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
          ? `Next in the ${PARKING_SLOT_TYPE_LABELS[slot.slot_type].toLowerCase()} waitlist: unit ${next.unit_number}. Allocating to any other unit needs a reason, which is recorded.`
          : 'Nobody is waiting for this slot type.'}
      </p>
      <SelectInput
        id={`${id}-unit`}
        name="unitId"
        label="Unit"
        required
        defaultValue={next?.unit_id ?? workspace.units[0]?.id}
        options={workspace.units.map((unit) => ({
          value: unit.id,
          label: `Unit ${unit.number}`,
        }))}
      />
      {next ? (
        <TextAreaInput
          id={`${id}-reason`}
          name="skipReason"
          label="Reason for skipping the waitlist (only if not the next unit)"
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
  const linked = allocation ? parkingLinkedVehicles(allocation) : [];
  const manage = workspace.can_manage && !slot.archived_at;
  return (
    <li className="grid gap-space-3 rounded-md border border-rule p-space-4">
      <div className="grid gap-space-1">
        <p className="text-body-strong">
          Slot {slot.label} · {PARKING_SLOT_TYPE_LABELS[slot.slot_type]}
        </p>
        <p className="text-caption text-ink-muted">
          {slot.archived_at
            ? `Archived ${formatParkingTime(slot.archived_at)}`
            : allocation
              ? `Allocated to unit ${allocation.unit_number} since ${formatParkingTime(allocation.started_at)}`
              : slot.slot_type === 'visitor'
                ? 'Visitor slot, used through visitor passes'
                : 'Free'}
          {slot.location_note ? ` · ${slot.location_note}` : ''}
        </p>
        {allocation?.skip_reason ? (
          <p className="text-caption">
            Waitlist skipped: {allocation.skip_reason}
          </p>
        ) : null}
        {workspace.directory_enabled && allocation ? (
          <p className="text-caption">
            Vehicles:{' '}
            {linked.length > 0
              ? linked.map((vehicle) => vehicle.registration_number).join(', ')
              : 'none marked'}
          </p>
        ) : null}
      </div>
      {manage ? (
        <div className="grid gap-space-3">
          {allocation ? (
            <ParkingQuickAction
              action={actions.endAllocation}
              label={`End allocation of slot ${slot.label}`}
              confirmMessage={`End unit ${allocation.unit_number}'s allocation of slot ${slot.label}?`}
              input={{ allocationId: allocation.id }}
            />
          ) : slot.slot_type !== 'visitor' ? (
            <details className="grid gap-space-2">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                Allocate slot {slot.label}
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
              Edit slot {slot.label}
            </summary>
            <SlotForm slot={slot} actions={actions} />
          </details>
          {allocation ? null : (
            <ParkingQuickAction
              action={actions.archiveSlot}
              label={`Archive slot ${slot.label}`}
              confirmMessage={`Archive slot ${slot.label}? Its history is kept.`}
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
      <h1 className="text-title font-semibold">Society parking</h1>
      {workspace.can_manage ? null : (
        <Banner tone="neutral" title="View only">
          Only administrators can change slots, allocations and settings.
        </Banner>
      )}

      <Card
        title="Slots"
        description={`${active.length} active slot${active.length === 1 ? '' : 's'}, ${active.filter((slot) => slot.allocation).length} allocated.`}
      >
        <div className="grid gap-space-4">
          {active.length === 0 ? (
            <p className="text-body text-ink-muted">No slots yet.</p>
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
                Add a slot
              </summary>
              <SlotForm slot={null} actions={actions} />
            </details>
          ) : null}
          {archived.length > 0 ? (
            <details className="grid gap-space-2">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                Archived slots ({archived.length})
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
        title="Waitlists"
        description="One queue per slot type, served in order. Allocate from a slot above."
      >
        <div className="grid gap-space-4 medium:grid-cols-3">
          {PARKING_REQUEST_SLOT_TYPES.map((type) => {
            const queue = workspace.queues.filter(
              (request) => request.slot_type === type,
            );
            return (
              <section key={type} className="grid content-start gap-space-2">
                <h3 className="text-body-strong">
                  {PARKING_SLOT_TYPE_LABELS[type]} ({queue.length})
                </h3>
                {queue.length === 0 ? (
                  <p className="text-caption text-ink-muted">Nobody waiting.</p>
                ) : (
                  <ol className="grid gap-space-2">
                    {queue.map((request) => (
                      <li key={request.id} className="text-caption">
                        <span className="text-body-strong">
                          Unit {request.unit_number}
                        </span>{' '}
                        · {parkingQueueText(request.queue_position)} · since{' '}
                        {formatParkingTime(request.created_at)}
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

      <Card title="Visitor passes">
        {!workspace.visitor_enabled ? (
          <p className="text-body text-ink-muted">
            Visitor passes need the Visitors module, which is turned off.
          </p>
        ) : workspace.passes.length === 0 ? (
          <p className="text-body text-ink-muted">No current visitor passes.</p>
        ) : (
          <ul className="grid gap-space-2">
            {workspace.passes.map((pass) => (
              <li key={pass.id} className="text-caption">
                <span className="text-body-strong">
                  Slot {pass.slot_label} · {pass.visitor_name}
                </span>{' '}
                · Unit {pass.unit_number} ·{' '}
                {PARKING_PASS_STATE_LABELS[parkingPassState(pass, now)]} ·{' '}
                {formatParkingWindow(pass.starts_at, pass.ends_at)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Wrong-parking reports"
        description={`${openReports.length} open.`}
      >
        {workspace.reports.length === 0 ? (
          <p className="text-body text-ink-muted">No reports.</p>
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
                    submitLabel="Mark resolved"
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
                      label="Resolution note (optional)"
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
        title="Photo retention"
        description="Wrong-parking photos are deleted automatically after this many days."
      >
        {workspace.can_manage ? (
          <ModuleActionForm
            action={actions.saveSettings}
            submitLabel="Save retention"
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
              label="Keep photos for (days)"
              helpText={`${PARKING_PHOTO_RETENTION_MIN_DAYS} to ${PARKING_PHOTO_RETENTION_MAX_DAYS} days.`}
              min={PARKING_PHOTO_RETENTION_MIN_DAYS}
              max={PARKING_PHOTO_RETENTION_MAX_DAYS}
              required
              defaultValue={workspace.settings.photo_retention_days}
            />
          </ModuleActionForm>
        ) : (
          <p className="text-body">
            Photos are kept for {workspace.settings.photo_retention_days} day
            {workspace.settings.photo_retention_days === 1 ? '' : 's'}.
          </p>
        )}
      </Card>
    </section>
  );
}
