// Manage meters, rates, the reading approval queue, utility billing and the consumption report.
'use client';
import { useId, useState } from 'react';
import {
  METERING_CHARGE_LABELS,
  METERING_SCOPE_LABELS,
  METERING_SOURCE_LABELS,
  METERING_TYPE_LABELS,
  METERING_UNIT_LABELS,
  METERING_USAGE_FLAG_LABELS,
  formatConsumption,
  formatMeterValue,
  formatMeteringDate,
  formatMeteringMonth,
  formatMeteringPaise,
  formatMeteringTime,
  formatRatePaise,
  meteringConsumption,
  meteringRatePaiseFromRupees,
  meteringUsageFlag,
} from '@/core/metering/presentation';
import {
  METERING_REASON_MAX,
  METERING_SCOPES,
  METERING_TYPES,
  meteringBillingRunInputSchema,
  meteringMeterInputSchema,
  meteringRateInputSchema,
  meteringReviewInputSchema,
  type MeteringAdminMeter,
  type MeteringAdminWorkspace,
  type MeteringQueueItem,
  type MeteringScope,
} from '@/core/metering/validation';
import { ValidationError } from '@/core/errors';
import { Banner } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  METERING_ACTIONS,
  MeteringPhotoLink,
  MeteringReadingForm,
  meteringMeterName,
  type MeteringActions,
} from './shared';

const REPORT_MONTHS = 6;

function MeterForm({
  meter,
  workspace,
  actions,
}: {
  meter: MeteringAdminMeter | null;
  workspace: MeteringAdminWorkspace;
  actions: MeteringActions;
}) {
  const id = useId();
  const [scope, setScope] = useState<MeteringScope>(meter?.scope ?? 'unit');
  return (
    <ModuleActionForm
      action={actions.saveMeter}
      idempotent
      submitLabel={meter ? `Save meter ${meter.label}` : 'Add meter'}
      input={(form, clientRequestId) =>
        meteringMeterInputSchema.parse({
          meterId: meter?.id ?? null,
          meterType: meter?.meter_type ?? form.get('meterType'),
          scope: meter?.scope ?? scope,
          unitId: meter
            ? meter.unit_id
            : scope === 'unit'
              ? String(form.get('unitId') ?? '') || null
              : null,
          label: String(form.get('label') ?? ''),
          serialNumber: String(form.get('serialNumber') ?? ''),
          initialReading: meter?.has_readings
            ? meter.initial_reading
            : String(form.get('initialReading') ?? ''),
          active: form.get('active') === 'on',
          expectedVersion: meter?.version ?? null,
          clientRequestId,
        })
      }
    >
      {meter ? (
        <p className="text-caption text-ink-muted">
          {METERING_TYPE_LABELS[meter.meter_type]} ·{' '}
          {meter.unit_number
            ? `Unit ${meter.unit_number}`
            : METERING_SCOPE_LABELS.common}
          . Type, scope and unit cannot change; add a new meter instead.
        </p>
      ) : (
        <>
          <SelectInput
            id={`${id}-type`}
            name="meterType"
            label="Meter type"
            required
            options={METERING_TYPES.map((value) => ({
              value,
              label: `${METERING_TYPE_LABELS[value]} (${METERING_UNIT_LABELS[value]})`,
            }))}
          />
          <SelectInput
            id={`${id}-scope`}
            name="scope"
            label="Belongs to"
            required
            value={scope}
            onChange={(event) =>
              setScope(event.currentTarget.value as MeteringScope)
            }
            options={METERING_SCOPES.map((value) => ({
              value,
              label: METERING_SCOPE_LABELS[value],
            }))}
            helpText="Common-area meters are never billed to a unit."
          />
          {scope === 'unit' ? (
            <SelectInput
              id={`${id}-unit`}
              name="unitId"
              label="Unit"
              required
              placeholder="Choose a unit"
              options={workspace.units.map((unit) => ({
                value: unit.id,
                label: `Unit ${unit.number}`,
              }))}
            />
          ) : null}
        </>
      )}
      <TextInput
        id={`${id}-label`}
        name="label"
        label="Meter label"
        helpText="For example A-101 water or Clubhouse DG."
        required
        maxLength={60}
        defaultValue={meter?.label}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-serial`}
        name="serialNumber"
        label="Serial number (optional)"
        maxLength={60}
        defaultValue={meter?.serial_number ?? ''}
        autoComplete="off"
      />
      {meter?.has_readings ? (
        <p className="text-caption text-ink-muted">
          Starting reading {formatMeterValue(meter.initial_reading)}. It cannot
          change after readings exist.
        </p>
      ) : (
        <TextInput
          id={`${id}-initial`}
          name="initialReading"
          label="Starting reading"
          helpText="The meter value when Homeish starts tracking it. Up to 3 decimals."
          inputMode="decimal"
          required
          maxLength={20}
          defaultValue={meter ? meter.initial_reading : '0'}
          autoComplete="off"
        />
      )}
      <CheckboxInput
        id={`${id}-active`}
        name="active"
        label="In use"
        description="Readings can only be added to meters in use."
        defaultChecked={meter?.active ?? true}
      />
    </ModuleActionForm>
  );
}

function RateForm({ actions }: { actions: MeteringActions }) {
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.setRate}
      idempotent
      submitLabel="Save rate"
      input={(form, clientRequestId) => {
        const ratePaise = meteringRatePaiseFromRupees(
          String(form.get('rate') ?? ''),
        );
        if (ratePaise === null) {
          throw new ValidationError({
            rate: 'Enter rupees with up to 2 decimals, for example 8.50.',
          });
        }
        return meteringRateInputSchema.parse({
          meterType: form.get('meterType'),
          ratePaise,
          clientRequestId,
        });
      }}
    >
      <SelectInput
        id={`${id}-type`}
        name="meterType"
        label="Meter type"
        required
        options={METERING_TYPES.map((value) => ({
          value,
          label: METERING_TYPE_LABELS[value],
        }))}
      />
      <TextInput
        id={`${id}-rate`}
        name="rate"
        label="Rate in rupees per unit of usage"
        helpText="Per kL of water, kWh of electricity or DG, or SCM of gas. Applies to readings not yet billed."
        inputMode="decimal"
        required
        maxLength={12}
        autoComplete="off"
      />
    </ModuleActionForm>
  );
}

function QueueItem({
  item,
  canManage,
  actions,
  fileRequest,
}: {
  item: MeteringQueueItem;
  canManage: boolean;
  actions: MeteringActions;
  fileRequest?: typeof fetch;
}) {
  const id = useId();
  const unit = METERING_UNIT_LABELS[item.meter_type];
  const preview = meteringConsumption(item.base_value, item.reading_value);
  return (
    <li className="grid gap-space-3 rounded-md border border-rule p-space-4">
      <div className="grid gap-space-1">
        <p className="font-semibold">
          {meteringMeterName({
            label: item.meter_label,
            meter_type: item.meter_type,
            unit_number: item.unit_number,
          })}
        </p>
        <p className="text-body">
          {formatMeterValue(item.reading_value)} {unit} on{' '}
          {formatMeteringDate(item.reading_date)} · previous{' '}
          {formatMeterValue(item.base_value)} {unit}
        </p>
        <p className="text-body">
          {preview.isReset
            ? `Lower than the previous reading: counts as 0 usage and resets the meter. Reason: ${item.lower_reason ?? 'none given, add one to approve'}.`
            : `Usage ${formatConsumption(preview.consumption, item.meter_type)}`}
        </p>
        <p className="text-caption text-ink-muted">
          Sent by {item.submitted_by ?? 'a resident'} ·{' '}
          {formatMeteringTime(item.created_at)}
        </p>
      </div>
      {item.photo_path ? (
        <MeteringPhotoLink path={item.photo_path} request={fileRequest} />
      ) : null}
      {canManage ? (
        <div className="grid gap-space-3 md:grid-cols-2">
          <ModuleActionForm
            action={actions.review}
            submitLabel="Approve"
            input={(form) =>
              meteringReviewInputSchema.parse({
                readingId: item.id,
                decision: 'approve',
                reason: String(form.get('reason') ?? ''),
              })
            }
          >
            {preview.isReset && !item.lower_reason ? (
              <TextAreaInput
                id={`${id}-approve`}
                name="reason"
                label="Why is the reading lower?"
                required
                maxLength={METERING_REASON_MAX}
              />
            ) : null}
          </ModuleActionForm>
          <ModuleActionForm
            action={actions.review}
            submitLabel="Reject"
            input={(form) =>
              meteringReviewInputSchema.parse({
                readingId: item.id,
                decision: 'reject',
                reason: String(form.get('reason') ?? ''),
              })
            }
          >
            <TextAreaInput
              id={`${id}-reject`}
              name="reason"
              label="Reason for rejecting"
              helpText="The resident sees this, for example the photo is unclear."
              required
              maxLength={METERING_REASON_MAX}
            />
          </ModuleActionForm>
        </div>
      ) : null}
    </li>
  );
}

function BillingCard({
  workspace,
  actions,
}: {
  workspace: MeteringAdminWorkspace;
  actions: MeteringActions;
}) {
  const id = useId();
  const { charges } = workspace;
  return (
    <Card
      title="Utility billing"
      description="Monthly bill generation adds approved unit-meter readings to a separate utility bill for each unit, once. Use this to add readings for units not yet covered. Common-area meters are never billed."
    >
      <div className="grid gap-space-4">
        {!workspace.billing_enabled ? (
          <Banner tone="info" title="Billing is turned off">
            Readings and reports still work. Nothing is billed, and readings
            approved while billing is off are never billed later.
          </Banner>
        ) : null}
        <dl className="grid gap-space-2 md:grid-cols-2">
          <div>
            <dt className="text-caption text-ink-muted">Waiting to bill</dt>
            <dd className="text-body">
              {charges.pending_count}
              {charges.pending_without_rate > 0
                ? ` (${charges.pending_without_rate} need a rate first)`
                : ''}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Billed so far</dt>
            <dd className="text-body">
              {charges.billed_count} charge
              {charges.billed_count === 1 ? '' : 's'},{' '}
              {formatMeteringPaise(charges.billed_paise)}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">No charge</dt>
            <dd className="text-body">{charges.no_charge_count}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Last billed</dt>
            <dd className="text-body">
              {charges.last_billed_at
                ? formatMeteringTime(charges.last_billed_at)
                : 'Not yet'}
            </dd>
          </div>
        </dl>
        {workspace.can_manage && workspace.billing_enabled ? (
          <ModuleActionForm
            action={actions.runBilling}
            submitLabel="Add usage to bills"
            confirmMessage="Add approved usage up to this date to each unit's bills? Usage already billed is never added again."
            input={(form) =>
              meteringBillingRunInputSchema.parse({
                billDate: String(form.get('billDate') ?? ''),
              })
            }
          >
            <TextInput
              id={`${id}-date`}
              name="billDate"
              type="date"
              label="Bill date"
              helpText="Readings dated on or before this day are billed. Run it once a month."
              required
              max={workspace.today}
              defaultValue={workspace.today}
            />
          </ModuleActionForm>
        ) : null}
      </div>
    </Card>
  );
}

function ReportCard({ workspace }: { workspace: MeteringAdminWorkspace }) {
  const { months, meters } = workspace.report;
  const shownFrom = Math.max(0, months.length - REPORT_MONTHS);
  const shown = months.slice(shownFrom);
  return (
    <Card
      title="Usage by month"
      description="Flags: high is more than twice the average of the previous 3 months with usage; zero is no usage on an occupied unit's meter in a month with a reading."
    >
      {meters.length === 0 ? (
        <p className="text-body text-ink-muted">
          No approved readings in the last {months.length} months.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-body">
            <caption className="sr-only">
              Usage per meter for the last {shown.length} months
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-space-2">
                  Meter
                </th>
                {shown.map((month) => (
                  <th key={month} scope="col" className="p-space-2">
                    {formatMeteringMonth(month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meters.map((meter) => (
                <tr key={meter.meter_id} className="border-t border-rule">
                  <th scope="row" className="p-space-2 font-semibold">
                    {meteringMeterName(meter)}
                  </th>
                  {shown.map((month, offset) => {
                    const index = shownFrom + offset;
                    const period = meter.periods[index];
                    const flag = meteringUsageFlag(meter, meter.periods, index);
                    return (
                      <td key={month} className="p-space-2 align-top">
                        {period && period.readings > 0 ? (
                          <>
                            {formatConsumption(
                              period.consumption,
                              meter.meter_type,
                            )}
                            {period.resets > 0 ? (
                              <span className="block text-caption text-ink-muted">
                                Meter reset
                              </span>
                            ) : null}
                            {flag ? (
                              <span className="block text-caption font-semibold text-danger">
                                {METERING_USAGE_FLAG_LABELS[flag]}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-ink-muted">No reading</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function MeteringAdminView({
  workspace,
  actions = METERING_ACTIONS,
  fileRequest,
}: {
  workspace: MeteringAdminWorkspace;
  actions?: MeteringActions;
  fileRequest?: typeof fetch;
}) {
  const activeMeters = workspace.meters.filter((meter) => meter.active);
  const inactive = workspace.meters.filter((meter) => !meter.active);

  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Utility meters</h1>
      {workspace.can_manage ? null : (
        <Banner tone="neutral" title="View only">
          Only administrators can change meters and rates, review readings and
          bill usage.
        </Banner>
      )}

      <Card
        title={`Readings to review (${workspace.queue.length})`}
        description="Residents send readings with a photo. Check the photo before approving; only approved readings count."
      >
        {workspace.queue.length === 0 ? (
          <p className="text-body text-ink-muted">Nothing to review.</p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.queue.map((item) => (
              <QueueItem
                key={item.id}
                item={item}
                canManage={workspace.can_manage}
                actions={actions}
                fileRequest={fileRequest}
              />
            ))}
          </ul>
        )}
      </Card>

      {workspace.can_manage && activeMeters.length > 0 ? (
        <Card
          title="Record a reading"
          description="Readings you record are approved straight away."
        >
          <MeteringReadingForm
            meters={activeMeters}
            today={workspace.today}
            action={actions.record}
            mode="record"
            request={fileRequest}
          />
        </Card>
      ) : null}

      <Card
        title="Meters"
        description={`${activeMeters.length} meter${activeMeters.length === 1 ? '' : 's'} in use.`}
      >
        <div className="grid gap-space-4">
          {workspace.meters.length === 0 ? (
            <p className="text-body text-ink-muted">No meters yet.</p>
          ) : (
            <ul className="grid gap-space-3">
              {[...activeMeters, ...inactive].map((meter) => (
                <li
                  key={meter.id}
                  className="grid gap-space-2 rounded-md border border-rule p-space-4"
                >
                  <p className="font-semibold">{meteringMeterName(meter)}</p>
                  <p className="text-caption text-ink-muted">
                    {meter.serial_number
                      ? `Serial ${meter.serial_number} · `
                      : ''}
                    {meter.active ? 'In use' : 'Not in use'} ·{' '}
                    {meter.last_reading_date
                      ? `Last ${formatMeterValue(meter.base_value)} ${METERING_UNIT_LABELS[meter.meter_type]} on ${formatMeteringDate(meter.last_reading_date)}`
                      : `Starting ${formatMeterValue(meter.base_value)} ${METERING_UNIT_LABELS[meter.meter_type]}`}
                  </p>
                  {workspace.can_manage ? (
                    <details className="grid gap-space-2">
                      <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                        Edit {meter.label}
                      </summary>
                      <MeterForm
                        meter={meter}
                        workspace={workspace}
                        actions={actions}
                      />
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {workspace.can_manage ? (
            <details className="grid gap-space-2">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                Add a meter
              </summary>
              <MeterForm meter={null} workspace={workspace} actions={actions} />
            </details>
          ) : null}
        </div>
      </Card>

      <Card
        title="Rates"
        description="One flat rate per meter type. The rate in force when usage is billed is stored on each charge."
      >
        <div className="grid gap-space-4">
          {workspace.rates.length === 0 ? (
            <p className="text-body text-ink-muted">
              No rates yet. Usage stays unbilled until a rate is set.
            </p>
          ) : (
            <ul className="grid gap-space-2">
              {workspace.rates.map((rate) => (
                <li key={rate.meter_type} className="text-body">
                  {METERING_TYPE_LABELS[rate.meter_type]}:{' '}
                  {formatRatePaise(rate.rate_paise, rate.meter_type)} (since{' '}
                  {formatMeteringTime(rate.set_at)})
                </li>
              ))}
            </ul>
          )}
          {workspace.can_manage ? <RateForm actions={actions} /> : null}
          {workspace.rate_history.length > workspace.rates.length ? (
            <details className="grid gap-space-2">
              <summary className="min-h-12 cursor-pointer content-center text-brand underline">
                Rate history
              </summary>
              <ul className="grid gap-space-2">
                {workspace.rate_history.map((rate) => (
                  <li key={rate.id} className="text-caption">
                    {METERING_TYPE_LABELS[rate.meter_type]}:{' '}
                    {formatRatePaise(rate.rate_paise, rate.meter_type)} from{' '}
                    {formatMeteringTime(rate.set_at)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </Card>

      <BillingCard workspace={workspace} actions={actions} />

      <ReportCard workspace={workspace} />

      <Card title="Recent readings">
        {workspace.recent.length === 0 ? (
          <p className="text-body text-ink-muted">No readings yet.</p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.recent.map((reading) => (
              <li
                key={reading.id}
                className="grid gap-space-1 rounded-md border border-rule p-space-4"
              >
                <p className="font-semibold">
                  {meteringMeterName({
                    label: reading.meter_label,
                    meter_type: reading.meter_type,
                    unit_number: reading.unit_number,
                  })}
                </p>
                <p className="text-body">
                  {formatMeterValue(reading.reading_value)}{' '}
                  {METERING_UNIT_LABELS[reading.meter_type]} on{' '}
                  {formatMeteringDate(reading.reading_date)}
                  {reading.consumption !== null
                    ? ` · usage ${formatConsumption(reading.consumption, reading.meter_type)}`
                    : ''}
                  {reading.is_reset ? ` · reset: ${reading.lower_reason}` : ''}
                </p>
                <p className="text-caption text-ink-muted">
                  {reading.status === 'rejected'
                    ? `Rejected: ${reading.rejection_reason ?? ''}`
                    : 'Approved'}{' '}
                  · {METERING_SOURCE_LABELS[reading.source]}
                  {reading.charge_status
                    ? ` · ${METERING_CHARGE_LABELS[reading.charge_status]}${reading.charge_status === 'billed' && reading.charge_amount_paise !== null ? ` ${formatMeteringPaise(reading.charge_amount_paise)}` : ''}`
                    : ''}
                </p>
                {reading.photo_path ? (
                  <MeteringPhotoLink
                    path={reading.photo_path}
                    request={fileRequest}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
