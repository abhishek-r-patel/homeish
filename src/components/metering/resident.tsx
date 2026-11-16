// Show a resident's unit meters, send readings with a photo, and follow their review and billing status.
'use client';
import Link from 'next/link';
import {
  METERING_CHARGE_LABELS,
  METERING_SOURCE_LABELS,
  METERING_STATUS_LABELS,
  METERING_TYPE_LABELS,
  METERING_UNIT_LABELS,
  formatConsumption,
  formatMeterValue,
  formatMeteringDate,
  formatMeteringPaise,
  formatRatePaise,
} from '@/core/metering/presentation';
import type {
  MeteringResidentReading,
  MeteringResidentWorkspace,
} from '@/core/metering/validation';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import {
  METERING_ACTIONS,
  MeteringPhotoLink,
  MeteringReadingForm,
  meteringMeterName,
  type MeteringActions,
} from './shared';

function ReadingItem({
  reading,
  fileRequest,
}: {
  reading: MeteringResidentReading;
  fileRequest?: typeof fetch;
}) {
  const unit = METERING_UNIT_LABELS[reading.meter_type];
  return (
    <li className="grid gap-space-2 rounded-md border border-rule p-space-4">
      <p className="font-semibold">
        {reading.meter_label}: {formatMeterValue(reading.reading_value)} {unit}
      </p>
      <p className="text-caption text-ink-muted">
        {formatMeteringDate(reading.reading_date)} ·{' '}
        {METERING_STATUS_LABELS[reading.status]} · Recorded by{' '}
        {reading.is_mine
          ? 'you'
          : METERING_SOURCE_LABELS[reading.source].toLowerCase()}
      </p>
      {reading.consumption !== null ? (
        <p className="text-body">
          Usage {formatConsumption(reading.consumption, reading.meter_type)}
          {reading.is_reset
            ? ` (meter reset: ${reading.lower_reason ?? 'no reason given'})`
            : ''}
        </p>
      ) : null}
      {reading.status === 'rejected' && reading.rejection_reason ? (
        <p className="text-body text-danger">
          Not accepted: {reading.rejection_reason}
        </p>
      ) : null}
      {reading.charge_status ? (
        <p className="text-caption">
          {METERING_CHARGE_LABELS[reading.charge_status]}
          {reading.charge_amount_paise !== null &&
          reading.charge_status === 'billed'
            ? `: ${formatMeteringPaise(reading.charge_amount_paise)}`
            : ''}
          {reading.bill_id ? (
            <>
              {' · '}
              <Link className="text-brand underline" href="/bills">
                See your bills
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {reading.photo_path ? (
        <MeteringPhotoLink path={reading.photo_path} request={fileRequest} />
      ) : null}
    </li>
  );
}

export function MeteringResidentView({
  workspace,
  actions = METERING_ACTIONS,
  fileRequest,
}: {
  workspace: MeteringResidentWorkspace;
  actions?: MeteringActions;
  fileRequest?: typeof fetch;
}) {
  if (workspace.units.length === 0) {
    return (
      <section className="grid min-w-0 gap-space-5">
        <h1 className="text-title font-semibold">Meters</h1>
        <EmptyState
          title="No unit linked to you yet"
          description="Meters belong to units. Ask your society administrator to add you to your unit."
        />
      </section>
    );
  }
  const activeMeters = workspace.meters.filter((meter) => meter.active);
  const pending = workspace.readings.filter(
    (reading) => reading.status === 'pending',
  );

  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Meters</h1>
      {!workspace.billing_enabled ? (
        <Banner tone="info" title="Usage is not billed right now">
          Readings are recorded for your information. Your society has not
          turned on billing for utilities.
        </Banner>
      ) : null}

      <Card
        title="My meters"
        description="Water, electricity, DG and gas meters for your units."
      >
        {workspace.meters.length === 0 ? (
          <p className="text-body text-ink-muted">
            No meter has been added for your unit yet.
          </p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.meters.map((meter) => (
              <li
                key={meter.id}
                className="grid gap-space-1 rounded-md border border-rule p-space-4"
              >
                <p className="font-semibold">{meteringMeterName(meter)}</p>
                <p className="text-caption text-ink-muted">
                  {meter.serial_number
                    ? `Serial ${meter.serial_number} · `
                    : ''}
                  {meter.active ? 'Active' : 'Not in use'}
                </p>
                <p className="text-body">
                  {meter.last_reading_date
                    ? `Last approved ${formatMeterValue(meter.base_value)} ${METERING_UNIT_LABELS[meter.meter_type]} on ${formatMeteringDate(meter.last_reading_date)}`
                    : `Starting reading ${formatMeterValue(meter.base_value)} ${METERING_UNIT_LABELS[meter.meter_type]}`}
                  {meter.has_pending ? ' · reading waiting for review' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {activeMeters.length > 0 ? (
        <Card
          title="Send a reading"
          description="Take a clear photo of the meter display. An administrator checks it before the usage counts."
        >
          <MeteringReadingForm
            meters={activeMeters}
            today={workspace.today}
            action={actions.submit}
            mode="submit"
            request={fileRequest}
          />
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <Card title="Waiting for review">
          <ul className="grid gap-space-3">
            {pending.map((reading) => (
              <ReadingItem
                key={reading.id}
                reading={reading}
                fileRequest={fileRequest}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card
        title="Reading history"
        description="Usage is this reading minus the previous approved reading."
      >
        {workspace.readings.length === pending.length ? (
          <p className="text-body text-ink-muted">No readings yet.</p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.readings
              .filter((reading) => reading.status !== 'pending')
              .map((reading) => (
                <ReadingItem
                  key={reading.id}
                  reading={reading}
                  fileRequest={fileRequest}
                />
              ))}
          </ul>
        )}
      </Card>

      {workspace.rates.length > 0 ? (
        <Card title="Current rates">
          <ul className="grid gap-space-2">
            {workspace.rates.map((rate) => (
              <li key={rate.meter_type} className="text-body">
                {METERING_TYPE_LABELS[rate.meter_type]}:{' '}
                {formatRatePaise(rate.rate_paise, rate.meter_type)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
