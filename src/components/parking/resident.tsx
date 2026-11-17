// Show a resident's slots, linked vehicles, waitlist requests, visitor passes and wrong-parking reports.
'use client';
import { useId, useState, type ReactNode } from 'react';
import { localTimeToIso } from '@/lib/local-time';
import {
  PARKING_PASS_DURATIONS,
  PARKING_PASS_STATE_LABELS,
  PARKING_REPORT_STATUS_LABELS,
  PARKING_REQUEST_STATUS_LABELS,
  PARKING_SLOT_TYPE_LABELS,
  PARKING_TIME_ZONE,
  parkingPassEnd,
  parkingPassState,
  parkingQueueText,
  parkingVehicleTypeLabel,
} from '@/core/parking/presentation';
import {
  PARKING_REQUEST_SLOT_TYPES,
  parkingPassInputSchema,
  parkingRequestInputSchema,
  type ParkingAllocation,
  type ParkingPass,
  type ParkingReport,
  type ParkingResidentWorkspace,
} from '@/core/parking/validation';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import {
  DatePicker,
  TimePicker,
  type TimeParts,
} from '@/components/ui/date-time-inputs';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { formatLocalizedNumber } from '@/core/i18n/format';
import {
  PARKING_ACTIONS,
  ParkingPhotoLink,
  ParkingQuickAction,
  ParkingReportForm,
  parkingDisplayTime,
  useParkingCopy,
  type ParkingActions,
} from './shared';

function parkingLocalDate(instant: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PARKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function parkingNextHour(instant: number): TimeParts {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: PARKING_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(instant + 60 * 60 * 1000),
  );
  return {
    hour: String(hour % 12 || 12),
    minute: '00',
    period: hour < 12 ? 'AM' : 'PM',
  };
}

function parkingLocalInstant(date: string, time: TimeParts) {
  const hour = (Number(time.hour) % 12) + (time.period === 'PM' ? 12 : 0);
  return localTimeToIso(
    `${date}T${String(hour).padStart(2, '0')}:${time.minute}`,
    PARKING_TIME_ZONE,
  );
}

function SlotCard({
  allocation,
  directoryEnabled,
  actions,
}: {
  allocation: ParkingAllocation;
  directoryEnabled: boolean;
  actions: ParkingActions;
}) {
  const { t } = useParkingCopy();
  return (
    <li className="grid gap-space-3 rounded-md border border-rule p-space-4">
      <div className="grid gap-space-1">
        <p className="text-body-strong">
          {t('Slot {label} · {type}', {
            label: allocation.slot_label,
            type: t(PARKING_SLOT_TYPE_LABELS[allocation.slot_type]),
          })}
        </p>
        <p className="text-caption text-ink-muted">
          {t('Unit {unit}', { unit: allocation.unit_number })}
          {allocation.location_note ? ` · ${allocation.location_note}` : ''}
        </p>
      </div>
      {directoryEnabled ? (
        allocation.vehicles.length > 0 ? (
          <div className="grid gap-space-2">
            <p className="text-caption text-ink-muted">
              {t('Vehicles from your directory that use this slot.')}
              {allocation.slot_type === 'two_wheeler'
                ? ` ${t('This slot takes two-wheelers only.')}`
                : ` ${t('This slot takes one car plus any number of two-wheelers.')}`}
            </p>
            <ul className="grid gap-space-2">
              {allocation.vehicles.map((vehicle) => (
                <li
                  key={vehicle.vehicle_id}
                  className="grid gap-space-2 medium:grid-cols-[1fr_auto] medium:items-center"
                >
                  <p>
                    {vehicle.registration_number} ·{' '}
                    {parkingVehicleTypeLabel(vehicle.vehicle_type)}
                    {vehicle.linked
                      ? ` · ${t('uses this slot')}`
                      : vehicle.linked_elsewhere
                        ? ` · ${t('uses another slot')}`
                        : ''}
                  </p>
                  {vehicle.linked_elsewhere && !vehicle.linked ? null : (
                    <ParkingQuickAction
                      action={actions.setVehicleLink}
                      label={
                        vehicle.linked
                          ? t('Stop using slot for {number}', {
                              number: vehicle.registration_number,
                            })
                          : t('Use slot for {number}', {
                              number: vehicle.registration_number,
                            })
                      }
                      input={{
                        allocationId: allocation.id,
                        vehicleId: vehicle.vehicle_id,
                        linked: !vehicle.linked,
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-caption text-ink-muted">
            {t(
              'Add your vehicles in the directory to show which ones use this slot.',
            )}
          </p>
        )
      ) : null}
    </li>
  );
}

function PassItem({
  pass,
  actions,
  now,
}: {
  pass: ParkingPass;
  actions: ParkingActions;
  now: number;
}) {
  const { locale, t } = useParkingCopy();
  const state = parkingPassState(pass, now);
  return (
    <li className="grid gap-space-2 rounded-md border border-rule p-space-4">
      <p className="text-body-strong">
        {pass.visitor_name} · {t('Slot {label}', { label: pass.slot_label })}
      </p>
      <p className="text-caption text-ink-muted">
        {t(PARKING_PASS_STATE_LABELS[state])} ·{' '}
        {parkingDisplayTime(pass.starts_at, locale)} –{' '}
        {parkingDisplayTime(pass.ends_at, locale)}
        {pass.vehicle_number ? ` · ${pass.vehicle_number}` : ''} ·{' '}
        {t('Unit {unit}', { unit: pass.unit_number })}
      </p>
      {state === 'upcoming' || state === 'current' ? (
        <ParkingQuickAction
          action={actions.cancelPass}
          label={t('Cancel pass for {name}', { name: pass.visitor_name })}
          confirmMessage={t('Cancel this visitor pass?')}
          input={{ passId: pass.id }}
        />
      ) : null}
    </li>
  );
}

export function ParkingReportItem({
  report,
  request,
  children,
}: {
  report: ParkingReport;
  request?: typeof fetch;
  children?: ReactNode;
}) {
  const { locale, t } = useParkingCopy();
  return (
    <li className="grid gap-space-2 rounded-md border border-rule p-space-4">
      <p className="text-body-strong">
        {report.slot_label
          ? t('Slot {label}', { label: report.slot_label })
          : t('No slot')}
        {report.vehicle_number ? ` · ${report.vehicle_number}` : ''}
      </p>
      <p className="text-caption text-ink-muted">
        {t(PARKING_REPORT_STATUS_LABELS[report.status])} · {t('Reported by')}{' '}
        {report.is_mine
          ? t('you')
          : report.reporter_role === 'guard'
            ? t('a guard')
            : t('a resident')}{' '}
        {t('on')} {parkingDisplayTime(report.created_at, locale)}
        {report.matched_unit_number
          ? ` · ${t('Unit {unit}', { unit: report.matched_unit_number })}`
          : ` · ${t('No unit matched')}`}
      </p>
      {report.note ? <p>{report.note}</p> : null}
      {report.resolution_note ? (
        <p className="text-caption">
          {t('Resolution:')} {report.resolution_note}
        </p>
      ) : null}
      {report.photo_path ? (
        <ParkingPhotoLink path={report.photo_path} request={request} />
      ) : null}
      {children}
    </li>
  );
}

export function ParkingResidentView({
  workspace,
  actions = PARKING_ACTIONS,
  fileRequest,
  now: fixedNow,
}: {
  workspace: ParkingResidentWorkspace;
  actions?: ParkingActions;
  fileRequest?: typeof fetch;
  now?: number;
}) {
  const { locale, t } = useParkingCopy();
  const id = useId();
  const [passUnit, setPassUnit] = useState(workspace.units[0]?.id ?? '');
  const [now] = useState(() => fixedNow ?? Date.now());
  const [passDate, setPassDate] = useState(() =>
    parkingLocalDate(now + 60 * 60 * 1000),
  );
  const [passTime, setPassTime] = useState<TimeParts>(() =>
    parkingNextHour(now),
  );
  const today = parkingLocalDate(now);
  const lastPassDate = parkingLocalDate(now + 30 * 24 * 60 * 60 * 1000);
  const unitOptions = workspace.units.map((unit) => ({
    value: unit.id,
    label: t('Unit {unit}', { unit: unit.number }),
  }));
  const entryOptions = workspace.visitor_entries.filter(
    (entry) => entry.unit_id === passUnit,
  );
  const waiting = workspace.requests.filter(
    (request) => request.status === 'waiting',
  );
  const pastRequests = workspace.requests.filter(
    (request) => request.status !== 'waiting',
  );

  if (workspace.units.length === 0) {
    return (
      <section className="grid min-w-0 gap-space-5">
        <h1 className="text-title font-semibold">{t('Parking')}</h1>
        <EmptyState
          title={t('No unit linked to you yet')}
          description={t(
            'Parking is managed per unit. Ask your society administrator to add you to your unit.',
          )}
        />
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">{t('Parking')}</h1>

      <Card
        title={t('My slots')}
        description={t('Slots your society has allocated to your units.')}
      >
        {workspace.allocations.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t(
              'No slot allocated yet. Join the waitlist below to ask for one.',
            )}
          </p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.allocations.map((allocation) => (
              <SlotCard
                key={allocation.id}
                allocation={allocation}
                directoryEnabled={workspace.directory_enabled}
                actions={actions}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={t('Waitlist')}
        description={t(
          'Requests are served in the order they were made, one queue per slot type.',
        )}
      >
        <div className="grid gap-space-4">
          {waiting.length > 0 ? (
            <ul className="grid gap-space-3">
              {waiting.map((request) => (
                <li
                  key={request.id}
                  className="grid gap-space-2 rounded-md border border-rule p-space-4"
                >
                  <p className="text-body-strong">
                    {t('{type} slot · Unit {unit}', {
                      type: t(PARKING_SLOT_TYPE_LABELS[request.slot_type]),
                      unit: request.unit_number,
                    })}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {t(parkingQueueText(request.queue_position) ?? '')} ·{' '}
                    {t('Requested')}{' '}
                    {request.created_at
                      ? parkingDisplayTime(request.created_at, locale)
                      : t('Not available')}
                  </p>
                  {request.note ? <p>{request.note}</p> : null}
                  <ParkingQuickAction
                    action={actions.cancelRequest}
                    label={t('Cancel request')}
                    confirmMessage={t(
                      'Leave the waitlist? You would need to join again at the back of the queue.',
                    )}
                    input={{ waitlistRequestId: request.id }}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          <ModuleActionForm
            action={actions.createRequest}
            idempotent
            submitLabel={t('Join waitlist')}
            input={(form, clientRequestId) =>
              parkingRequestInputSchema.parse({
                unitId: form.get('unitId'),
                slotType: form.get('slotType'),
                note: String(form.get('note') ?? ''),
                clientRequestId,
              })
            }
          >
            <SelectInput
              id={`${id}-request-unit`}
              name="unitId"
              label={t('Unit')}
              required
              options={unitOptions}
            />
            <SelectInput
              id={`${id}-request-type`}
              name="slotType"
              label={t('Slot type')}
              required
              options={PARKING_REQUEST_SLOT_TYPES.map((value) => ({
                value,
                label: t(PARKING_SLOT_TYPE_LABELS[value]),
              }))}
            />
            <TextAreaInput
              id={`${id}-request-note`}
              name="note"
              label={t('Note for the administrator (optional)')}
              maxLength={300}
            />
          </ModuleActionForm>
          {pastRequests.length > 0 ? (
            <details className="grid gap-space-2">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                {t('Past requests ({count})', {
                  count: formatLocalizedNumber(pastRequests.length, locale),
                })}
              </summary>
              <ul className="grid gap-space-2">
                {pastRequests.map((request) => (
                  <li key={request.id} className="text-caption">
                    {t(PARKING_SLOT_TYPE_LABELS[request.slot_type])} ·{' '}
                    {t('Unit {unit}', { unit: request.unit_number })} ·{' '}
                    {t(PARKING_REQUEST_STATUS_LABELS[request.status])}
                    {request.closed_at
                      ? ` ${t('on')} ${parkingDisplayTime(request.closed_at ?? '', locale)}`
                      : ''}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </Card>

      <Card
        title={t('Visitor parking passes')}
        description={t(
          'Reserve a visitor slot for up to 24 hours. Guards see the pass at the gate.',
        )}
      >
        {!workspace.visitor_enabled ? (
          <Banner tone="neutral" title={t('Visitor passes are not available')}>
            {t('Your society has not turned on the Visitors module.')}
          </Banner>
        ) : workspace.visitor_slots.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('Your society has no visitor slots yet.')}
          </p>
        ) : (
          <div className="grid gap-space-4">
            {workspace.passes.length > 0 ? (
              <ul className="grid gap-space-3">
                {workspace.passes.map((pass) => (
                  <PassItem
                    key={pass.id}
                    pass={pass}
                    actions={actions}
                    now={now}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-body text-ink-muted">
                {t('No visitor passes.')}
              </p>
            )}
            <ModuleActionForm
              action={actions.createPass}
              idempotent
              submitLabel={t('Create visitor pass')}
              submitDisabled={!passDate}
              input={(form, clientRequestId) => {
                const startsAt = parkingLocalInstant(passDate, passTime);
                return parkingPassInputSchema.parse({
                  unitId: form.get('unitId'),
                  slotId: String(form.get('slotId') ?? '') || null,
                  startsAt,
                  endsAt: parkingPassEnd(
                    startsAt,
                    Number(form.get('hours') ?? 0),
                  ),
                  visitorName: String(form.get('visitorName') ?? ''),
                  vehicleNumber: String(form.get('vehicleNumber') ?? ''),
                  visitorEntryId:
                    String(form.get('visitorEntryId') ?? '') || null,
                  clientRequestId,
                });
              }}
            >
              <SelectInput
                id={`${id}-pass-unit`}
                name="unitId"
                label={t('Unit')}
                required
                value={passUnit}
                onChange={(event) => setPassUnit(event.currentTarget.value)}
                options={unitOptions}
              />
              <TextInput
                id={`${id}-pass-name`}
                name="visitorName"
                label={t('Visitor name')}
                required
                maxLength={120}
                autoComplete="off"
              />
              <TextInput
                id={`${id}-pass-vehicle`}
                name="vehicleNumber"
                label={t('Vehicle number (optional)')}
                maxLength={40}
                autoComplete="off"
              />
              <SelectInput
                id={`${id}-pass-slot`}
                name="slotId"
                label={t('Visitor slot')}
                defaultValue=""
                options={[
                  { value: '', label: t('Any free visitor slot') },
                  ...workspace.visitor_slots.map((slot) => ({
                    value: slot.id,
                    label: slot.location_note
                      ? `${slot.label} (${slot.location_note})`
                      : slot.label,
                  })),
                ]}
              />
              <DatePicker
                id={`${id}-pass-start-date`}
                label={t('Start date')}
                helpText={t(
                  'India time. A pass can start up to 30 days ahead.',
                )}
                required
                min={today}
                max={lastPassDate}
                value={passDate}
                onChange={setPassDate}
              />
              <TimePicker
                id={`${id}-pass-start-time`}
                label={t('Start time')}
                required
                timeZone={PARKING_TIME_ZONE}
                value={passTime}
                onChange={setPassTime}
              />
              <SelectInput
                id={`${id}-pass-hours`}
                name="hours"
                label={t('Duration')}
                defaultValue="4"
                options={PARKING_PASS_DURATIONS.map((hours) => ({
                  value: String(hours),
                  label: t('{count} hours', {
                    count: formatLocalizedNumber(hours, locale),
                  }),
                }))}
              />
              {entryOptions.length > 0 ? (
                <SelectInput
                  id={`${id}-pass-entry`}
                  name="visitorEntryId"
                  label={t('Link to a visitor entry (optional)')}
                  defaultValue=""
                  options={[
                    { value: '', label: t('No visitor entry') },
                    ...entryOptions.map((entry) => ({
                      value: entry.id,
                      label: `${entry.visitor_name} · ${parkingDisplayTime(entry.created_at, locale)}`,
                    })),
                  ]}
                />
              ) : null}
            </ModuleActionForm>
          </div>
        )}
      </Card>

      <Card
        title={t('Report wrong parking')}
        description={t(
          'Choose the slot or enter the vehicle number. The unit and administrators are told.',
        )}
      >
        <ParkingReportForm
          slots={workspace.report_slots}
          action={actions.createReport}
          request={fileRequest}
        />
      </Card>

      <Card title={t('Wrong-parking reports')}>
        {workspace.reports.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('No reports about your units or made by you.')}
          </p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.reports.map((report) => (
              <ParkingReportItem
                key={report.id}
                report={report}
                request={fileRequest}
              />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
