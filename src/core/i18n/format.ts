// Format visible numbers and dates without changing stored values or time zones.
import type { Locale } from './locale';

function localeTag(locale: Locale): 'en-IN' | 'hi-IN' {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}

export function formatLocalizedNumber(
  value: number | bigint,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(localeTag(locale), {
    ...options,
    numberingSystem: 'latn',
  }).format(value);
}

export function formatLocalizedCurrency(
  amountPaise: number,
  locale: Locale,
): string {
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency: 'INR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(amountPaise / 100);
}

export function formatLocalizedDate(
  value: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    ...options,
    numberingSystem: 'latn',
  }).format(value);
}

export function formatLocalizedTime(
  value: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: 'numeric',
    minute: '2-digit',
    ...options,
    hourCycle: 'h12',
    numberingSystem: 'latn',
  }).format(value);
}

export function formatLocalizedDateTime(
  value: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    ...options,
    hourCycle: 'h12',
    numberingSystem: 'latn',
  }).format(value);
}
