// Let guards find a meter by unit, label or serial and record its reading quickly on a phone.
'use client';
import { useId, useState, type FormEvent } from 'react';
import { METERING_UNIT_LABELS } from '@/core/metering/presentation';
import type { MeteringGuardBoard } from '@/core/metering/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { TextInput } from '@/components/ui/text-input';
import {
  METERING_ACTIONS,
  MeteringReadingForm,
  meteringMeterName,
  meteringDisplayDate,
  meteringDisplayTime,
  meteringDisplayValue,
  useMeteringCopy,
  type MeteringActions,
} from './shared';

export function MeteringGuardView({
  board,
  baseHref,
  actions = METERING_ACTIONS,
  fileRequest,
  onSearch,
}: {
  board: MeteringGuardBoard;
  baseHref: string;
  actions?: MeteringActions;
  fileRequest?: typeof fetch;
  onSearch?: (query: string) => void;
}) {
  const { locale, t } = useMeteringCopy();
  const id = useId();
  const [query, setQuery] = useState(board.query ?? '');

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!onSearch) return;
    event.preventDefault();
    onSearch(query.trim());
  }

  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">{t('Meter readings')}</h1>

      <Card
        title={t('Find a meter')}
        description={t('Search by unit number, meter label or serial number.')}
      >
        <form
          action={baseHref}
          method="get"
          role="search"
          className="grid gap-space-3 medium:grid-cols-[1fr_auto] medium:items-end"
          onSubmit={submit}
        >
          <TextInput
            id={`${id}-query`}
            name="q"
            label={t('Unit, label or serial')}
            maxLength={40}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Button type="submit" size="guard">
            {t('Search')}
          </Button>
        </form>
      </Card>

      <Card
        title={
          board.query
            ? t('Meters matching “{query}”', { query: board.query })
            : t('Meters')
        }
        description={t(
          'Open a meter, read its display and save. Your readings count straight away.',
        )}
      >
        {board.meters.length === 0 ? (
          <p role="status" className="text-body text-ink-muted">
            {board.query
              ? t('No meter in use matches “{query}”.', {
                  query: board.query,
                })
              : t('No meters in use yet.')}
          </p>
        ) : (
          <ul className="grid gap-space-3">
            {board.meters.map((meter) => (
              <li
                key={meter.id}
                className="rounded-md border border-rule p-space-3"
              >
                <details className="grid gap-space-3">
                  <summary className="grid min-h-12 cursor-pointer content-center">
                    <span className="text-body-strong">
                      {meteringMeterName(meter, t)}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {meter.last_reading_date
                        ? t('Last {value} {unit} on {date}', {
                            value: meteringDisplayValue(
                              meter.base_value,
                              locale,
                            ),
                            unit: METERING_UNIT_LABELS[meter.meter_type],
                            date: meteringDisplayDate(
                              meter.last_reading_date,
                              locale,
                            ),
                          })
                        : t('Starting {value} {unit}', {
                            value: meteringDisplayValue(
                              meter.base_value,
                              locale,
                            ),
                            unit: METERING_UNIT_LABELS[meter.meter_type],
                          })}
                    </span>
                  </summary>
                  <MeteringReadingForm
                    meters={[meter]}
                    fixedMeterId={meter.id}
                    today={board.today}
                    action={actions.record}
                    mode="record"
                    request={fileRequest}
                  />
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('Recent readings')}>
        {board.recent.length === 0 ? (
          <p className="text-body text-ink-muted">{t('No readings yet.')}</p>
        ) : (
          <ul className="grid gap-space-2">
            {board.recent.map((reading) => (
              <li
                key={reading.id}
                className="rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {meteringMeterName(
                    {
                      label: reading.meter_label,
                      meter_type: reading.meter_type,
                      unit_number: reading.unit_number,
                    },
                    t,
                  )}
                </p>
                <p className="text-caption text-ink-muted">
                  {meteringDisplayValue(reading.reading_value, locale)}{' '}
                  {METERING_UNIT_LABELS[reading.meter_type]} {t('on')}{' '}
                  {meteringDisplayDate(reading.reading_date, locale)}
                  {reading.consumption !== null
                    ? ` · ${t('usage {value}', {
                        value: `${meteringDisplayValue(reading.consumption, locale)} ${METERING_UNIT_LABELS[reading.meter_type]}`,
                      })}`
                    : ''}
                  {reading.is_reset ? ` · ${t('meter reset')}` : ''} ·{' '}
                  {t('saved')} {meteringDisplayTime(reading.created_at, locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
