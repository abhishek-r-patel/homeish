// Show a privacy-filtered month calendar of confirmed society amenity bookings.
'use client';
import { Card } from '@/components/ui/data-display';
import { formatBillingTimestamp } from '@/core/billing/format';
import type { AmenityCalendar } from '@/core/amenity/validation';
import { formatLocalizedDateTime } from '@/core/i18n/format';
import { createComponentTranslator } from '@/core/i18n/catalogs/hi-components';
import { useUiTranslator } from '@/components/ui/language';

function moveMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year!, monthNumber! - 1 + amount, 1))
    .toISOString()
    .slice(0, 7);
}

export function AmenityCalendarView({
  calendar,
  baseHref,
}: {
  calendar: AmenityCalendar;
  baseHref: string;
}) {
  const { locale, translate } = useUiTranslator();
  const activeLocale = locale ?? 'en';
  const t = createComponentTranslator(activeLocale, translate);
  const formatTime = (value: string) =>
    activeLocale === 'hi'
      ? formatLocalizedDateTime(new Date(value), activeLocale, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: calendar.timezone,
        })
      : formatBillingTimestamp(value, calendar.timezone);
  return (
    <Card
      title={t('Month calendar')}
      description={t(
        'Confirmed bookings only. The booking picker on the date above keeps other units anonymous.',
      )}
    >
      <div className="grid gap-space-3">
        <nav
          aria-label={t('Calendar month navigation')}
          className="flex flex-wrap gap-space-3"
        >
          <a
            className="min-h-12 content-center text-brand underline"
            href={`${baseHref}?month=${moveMonth(calendar.month, -1)}`}
          >
            {t('Previous month')}
          </a>
          <a
            className="min-h-12 content-center text-brand underline"
            href={`${baseHref}?month=${moveMonth(calendar.month, 1)}`}
          >
            {t('Next month')}
          </a>
        </nav>
        <form
          method="get"
          className="flex min-w-0 flex-wrap items-end gap-space-3"
        >
          <label className="grid min-w-0 gap-space-1">
            {t('Calendar month')}
            <input
              className="min-h-12 rounded-md border border-rule px-space-3"
              name="month"
              type="month"
              defaultValue={calendar.month}
              required
            />
          </label>
          <button
            className="min-h-12 rounded-md border border-rule px-space-3"
            type="submit"
          >
            {t('Show month')}
          </button>
        </form>
        {calendar.items.length ? (
          <ul className="grid gap-space-3">
            {calendar.items.map((entry) => (
              <li
                key={`${entry.amenity_id}:${entry.starts_at}`}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">{entry.amenity_name}</p>
                <p>
                  {formatTime(entry.starts_at)} {t('to')}{' '}
                  {formatTime(entry.ends_at)}
                </p>
                {entry.booker_name ? (
                  <p>
                    {entry.booker_name}
                    {entry.unit_number
                      ? ` · ${t('Unit {unit}', { unit: entry.unit_number })}`
                      : ''}
                  </p>
                ) : (
                  <p className="text-caption text-ink-muted">
                    {t('Occupied; identity is not available in this calendar.')}
                  </p>
                )}
                {entry.overlap_warning ? (
                  <p className="text-caption text-danger" role="status">
                    {t(
                      'Data-integrity warning: this booking overlaps another confirmed booking. Existing booking rules were not changed.',
                    )}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No confirmed bookings in this month.')}
          </p>
        )}
        <p className="text-caption text-ink-muted">
          {t('Times use {timezone}.', { timezone: calendar.timezone })}
        </p>
      </div>
    </Card>
  );
}
