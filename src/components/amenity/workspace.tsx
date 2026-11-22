// Show local-date availability with anonymous occupied slots and private household bookings.
import { Card } from '@/components/ui/data-display';
import {
  AmenityForm,
  AmenityBookingForm,
  AmenityCancellationForm,
} from './controls';
import { AmenityCalendarView } from './calendar';
import { AmenityFacilitiesView } from './facilities';
import {
  getAmenityCalendarMonth,
  getAmenityFacilitiesReport,
  getAmenityWorkspace,
} from '@/core/amenity/operations';
import { formatBillingTimestamp, formatRupees } from '@/core/billing/format';
import {
  formatLocalizedCurrency,
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { createComponentTranslator } from '@/core/i18n/catalogs/hi-components';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

function amenityFee(paise: number, locale: 'en' | 'hi') {
  return locale === 'hi'
    ? formatLocalizedCurrency(paise, locale)
    : formatRupees(paise);
}

function amenityDateTime(value: string, timeZone: string, locale: 'en' | 'hi') {
  return locale === 'hi'
    ? formatLocalizedDateTime(new Date(value), locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      })
    : formatBillingTimestamp(value, timeZone);
}

export async function AmenityWorkspace({
  date,
  month,
  audience = 'resident',
}: {
  date?: string;
  month?: string;
  audience?: 'resident' | 'management';
}) {
  const [w, calendar, facilities] = await Promise.all([
    getAmenityWorkspace(date),
    getAmenityCalendarMonth(month),
    audience === 'management'
      ? getAmenityFacilitiesReport()
      : Promise.resolve(null),
  ]);
  const locale = await getRequestLocale();
  const t = createComponentTranslator(locale, (source, values) =>
    translateMessage(locale, source, values),
  );
  const formatTime = (value: string) =>
    amenityDateTime(value, w.timezone, locale);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Amenity booking')}</h1>
      <p>
        {t(
          'One exclusive reservation per slot. Book at least 24 hours ahead; no maximum booking horizon or daily unit limit. All times use {timezone}.',
          { timezone: w.timezone },
        )}
      </p>
      <form method="get" className="grid min-w-0 gap-space-2">
        <label htmlFor="amenity-date">{t('Booking date')}</label>
        <input
          className="min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3"
          id="amenity-date"
          name="date"
          type="date"
          required
          defaultValue={w.date}
        />
        <button
          type="submit"
          className="min-h-12 rounded-md border border-rule"
        >
          {t('Show availability and bookings')}
        </button>
      </form>
      <AmenityCalendarView
        calendar={calendar}
        baseHref={audience === 'management' ? '/admin/amenities' : '/amenities'}
      />
      {w.can_manage ? (
        <Card title={t('Add amenity')}>
          <AmenityForm />
        </Card>
      ) : null}
      {!w.billing_enabled ? (
        <p>
          {t(
            'Billing is disabled. Only free slots can be booked; cancellations still credit existing paid bookings.',
          )}
        </p>
      ) : null}
      {w.amenities.map((a) => (
        <Card key={a.id} title={a.name}>
          <div className="grid min-w-0 gap-space-3">
            <p>
              {t('Maximum guests: {count} · Fee: {amount}', {
                count: formatLocalizedNumber(a.capacity, locale),
                amount: amenityFee(a.fee_paise, locale),
              })}
              {!a.active ? ` · ${t('Inactive')}` : ''}
            </p>
            {w.can_manage ? (
              <details>
                <summary className="cursor-pointer">
                  {t('Edit amenity and recurring slots')}
                </summary>
                <AmenityForm
                  key={a.updated_at}
                  amenity={a}
                  slots={w.slots.filter((s) => s.amenity_id === a.id)}
                />
              </details>
            ) : null}
            {w.occurrences
              .filter((o) => o.amenity_id === a.id)
              .map((o) => (
                <div
                  key={o.slot_id}
                  className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
                >
                  <p>
                    {formatTime(o.starts_at)} {t('to')} {formatTime(o.ends_at)}
                  </p>
                  {o.available && w.can_book && w.units.length ? (
                    <AmenityBookingForm
                      key={`${o.slot_id}:${w.date}:${a.updated_at}`}
                      amenity={a}
                      occurrence={o}
                      date={w.date}
                      units={w.units}
                    />
                  ) : (
                    <p>
                      {!w.can_book
                        ? t('Read-only access.')
                        : o.available
                          ? t('Active occupancy is required to book.')
                          : t(
                              'Booked or unavailable: check the 24-hour lead and billing status.',
                            )}
                    </p>
                  )}
                </div>
              ))}
            {!w.occurrences.some((o) => o.amenity_id === a.id) ? (
              <p>{t('No recurring slots on this date.')}</p>
            ) : null}
          </div>
        </Card>
      ))}
      <Card title={t('Bookings for this date')}>
        {w.bookings.length ? (
          <ul className="grid min-w-0 gap-space-3">
            {w.bookings.map((b) => (
              <li
                key={b.id}
                className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {b.amenity_name} · {t('Unit {unit}', { unit: b.unit_number })}{' '}
                  · {b.status}
                </p>
                <p>
                  {formatTime(b.starts_at)} {t('to')} {formatTime(b.ends_at)} ·{' '}
                  {formatLocalizedNumber(b.guest_count, locale)} {t('guests')} ·{' '}
                  {t('Snapshotted fee {amount}', {
                    amount: amenityFee(b.fee_paise, locale),
                  })}
                </p>
                {b.rules_snapshot ? (
                  <details>
                    <summary>{t('Accepted booking rules')}</summary>
                    <p className="whitespace-pre-wrap break-words">
                      {b.rules_snapshot}
                    </p>
                  </details>
                ) : null}
                {b.cancel_reason ? <p>{b.cancel_reason}</p> : null}
                {b.can_cancel ? (
                  <AmenityCancellationForm booking={b} admin={w.can_manage} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {t(
              'No accessible bookings on this date. Other units’ occupied slots remain anonymous.',
            )}
          </p>
        )}
      </Card>
      {facilities ? <AmenityFacilitiesView report={facilities} /> : null}
    </section>
  );
}
