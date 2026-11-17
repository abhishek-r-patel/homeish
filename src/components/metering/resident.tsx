// Show a resident's unit meters, send readings with a photo, and follow their review and billing status.
'use client';
import Link from 'next/link';
import {
  METERING_CHARGE_LABELS,
  METERING_SOURCE_LABELS,
  METERING_STATUS_LABELS,
  METERING_TYPE_LABELS,
  METERING_UNIT_LABELS,
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
  meteringDisplayDate,
  meteringDisplayPaise,
  meteringDisplayRate,
  meteringDisplayValue,
  useMeteringCopy,
  type MeteringActions,
} from './shared';

function ReadingItem({
  reading,
  fileRequest,
}: {
  reading: MeteringResidentReading;
  fileRequest?: typeof fetch;
}) {
  const { locale, t } = useMeteringCopy();
  const unit = METERING_UNIT_LABELS[reading.meter_type];
  return (
    <li className="grid gap-space-2 rounded-md border border-rule p-space-4">
      <p className="font-semibold">
        {reading.meter_label}:{' '}
        {meteringDisplayValue(reading.reading_value, locale)} {unit}
      </p>
      <p className="text-caption text-ink-muted">
        {meteringDisplayDate(reading.reading_date, locale)} ·{' '}
        {t(METERING_STATUS_LABELS[reading.status])} · {t('Recorded by')}{' '}
        {reading.is_mine ? t('you') : t(METERING_SOURCE_LABELS[reading.source])}
      </p>
      {reading.consumption !== null ? (
        <p className="text-body">
          {t('Usage: {value} {unit}', {
            value: meteringDisplayValue(reading.consumption, locale),
            unit,
          })}
          {reading.is_reset
            ? ` (${t('meter reset')}: ${reading.lower_reason ?? t('no reason given')})`
            : ''}
        </p>
      ) : null}
      {reading.status === 'rejected' && reading.rejection_reason ? (
        <p className="text-body text-danger">
          {t('Not accepted:')} {reading.rejection_reason}
        </p>
      ) : null}
      {reading.charge_status ? (
        <p className="text-caption">
          {t(METERING_CHARGE_LABELS[reading.charge_status])}
          {reading.charge_amount_paise !== null &&
          reading.charge_status === 'billed'
            ? `: ${meteringDisplayPaise(reading.charge_amount_paise, locale)}`
            : ''}
          {reading.bill_id ? (
            <>
              {' · '}
              <Link className="text-brand underline" href="/bills">
                {t('See your bills')}
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
  const { locale, t } = useMeteringCopy();
  if (workspace.units.length === 0) {
    return (
      <section className="grid min-w-0 gap-space-5">
        <h1 className="text-title font-semibold">{t('Meters')}</h1>
        <EmptyState
          title={t('No unit linked to you yet')}
          description={t(
            'Meters belong to units. Ask your society administrator to add you to your unit.',
          )}
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
      <h1 className="text-title font-semibold">{t('Meters')}</h1>
      {!workspace.billing_enabled ? (
        <Banner tone="info" title={t('Usage is not billed right now')}>
          {t(
            'Readings are recorded for your information. Your society has not turned on billing for utilities.',
          )}
        </Banner>
      ) : null}

      <Card
        title={t('My meters')}
        description={t('Water, electricity, DG and gas meters for your units.')}
      >
        {workspace.meters.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('No meter has been added for your unit yet.')}
          </p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.meters.map((meter) => (
              <li
                key={meter.id}
                className="grid gap-space-1 rounded-md border border-rule p-space-4"
              >
                <p className="font-semibold">{meteringMeterName(meter, t)}</p>
                <p className="text-caption text-ink-muted">
                  {meter.serial_number
                    ? `${t('Serial')} ${meter.serial_number} · `
                    : ''}
                  {t(meter.active ? 'Active' : 'Not in use')}
                </p>
                <p className="text-body">
                  {meter.last_reading_date
                    ? t('Last approved {value} {unit} on {date}', {
                        value: meteringDisplayValue(meter.base_value, locale),
                        unit: METERING_UNIT_LABELS[meter.meter_type],
                        date: meteringDisplayDate(
                          meter.last_reading_date,
                          locale,
                        ),
                      })
                    : t('Starting reading {value} {unit}', {
                        value: meteringDisplayValue(meter.base_value, locale),
                        unit: METERING_UNIT_LABELS[meter.meter_type],
                      })}
                  {meter.has_pending
                    ? ` · ${t('reading waiting for review')}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {activeMeters.length > 0 ? (
        <Card
          title={t('Send a reading')}
          description={t(
            'Take a clear photo of the meter display. An administrator checks it before the usage counts.',
          )}
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
        <Card title={t('Waiting for review')}>
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
        title={t('Reading history')}
        description={t(
          'Usage is this reading minus the previous approved reading.',
        )}
      >
        {workspace.readings.length === pending.length ? (
          <p className="text-body text-ink-muted">{t('No readings yet.')}</p>
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
        <Card title={t('Current rates')}>
          <ul className="grid gap-space-2">
            {workspace.rates.map((rate) => (
              <li key={rate.meter_type} className="text-body">
                {t(METERING_TYPE_LABELS[rate.meter_type])}:{' '}
                {meteringDisplayRate(rate.rate_paise, rate.meter_type, locale)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
