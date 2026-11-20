// Format billing interface values without changing English documents or stored amounts.
import {
  formatBillingDate,
  formatBillingPeriod,
  formatBillingTimestamp,
  formatRupees,
} from '../../core/billing/format';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedDateTime,
} from '../../core/i18n/format';
import type { Locale } from '../../core/i18n/locale';

export function billingMoney(value: number | string, locale: Locale | null) {
  return locale === 'hi'
    ? formatLocalizedCurrency(value, locale)
    : formatRupees(value);
}

export function billingDate(value: string, locale: Locale | null) {
  return locale === 'hi'
    ? formatLocalizedDate(new Date(`${value.slice(0, 10)}T00:00:00Z`), locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : formatBillingDate(value);
}

export function billingPeriod(value: string, locale: Locale | null) {
  return locale === 'hi'
    ? formatLocalizedDate(
        new Date(`${value.slice(0, 7)}-01T00:00:00Z`),
        locale,
        {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        },
      )
    : formatBillingPeriod(value);
}

export function billingTimestamp(
  value: string,
  timeZone: string,
  locale: Locale | null,
) {
  return locale === 'hi'
    ? formatLocalizedDateTime(new Date(value), locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      })
    : formatBillingTimestamp(value, timeZone);
}
